import { createHash } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local", quiet: true });

const requiredEnvironment = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_CONNECTION_VAULT_PASSPHRASE",
];
const MAX_DOCUMENT_FILE_BYTES = 13 * 1024 * 1024;
if (requiredEnvironment.some((name) => !process.env[name])) {
  throw new Error("Set the original Supabase settings and database-vault passphrase in ignored .env.local.");
}

function decodeBase64(value) {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

function pathUrl(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function documentPathIsValid(value) {
  return typeof value === "string" &&
    /^documents\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:pdf|png|jpg|jpeg|webp|txt|csv|doc|docx|xls|xlsx|ppt|pptx|rtf)$/i.test(value);
}

async function loadTargetProfile() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_CONNECTION_VAULT_PASSPHRASE } = process.env;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/database_connection_vault?select=vault&id=eq.shared`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Could not load the saved database profiles (HTTP ${response.status}).`);
  const rows = await response.json();
  const vault = rows?.[0]?.vault;
  if (!vault || vault.kdf !== "PBKDF2-SHA-256" || vault.iterations !== 310_000) {
    throw new Error("The shared database profile vault is missing or unsupported.");
  }
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(DATABASE_CONNECTION_VAULT_PASSPHRASE), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: decodeBase64(vault.salt), iterations: vault.iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  let payload;
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decodeBase64(vault.iv) },
      key,
      decodeBase64(vault.ciphertext),
    );
    payload = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("Could not unlock the database profile vault with the local passphrase.");
  }
  const profile = payload?.profiles?.find((entry) => entry?.name === "mydocumentsmanager");
  const requiredModules = ["Documents", "Personal Documents", "Account credentials"];
  if (!profile || !requiredModules.every((module) => profile.modules?.includes(module))) {
    throw new Error("The mydocumentsmanager profile must be assigned to all document modules.");
  }
  if (!profile.storageUrl || !profile.storageServiceRoleKey || !profile.storageBucket) {
    throw new Error("Configure and save the target private Storage bucket in Database connections before migrating files.");
  }
  const storageUrl = new URL(profile.storageUrl);
  if (storageUrl.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/i.test(storageUrl.hostname) ||
    storageUrl.port || storageUrl.username || storageUrl.password ||
    (storageUrl.pathname !== "/" && !/^\/rest\/v1\/?$/i.test(storageUrl.pathname)) ||
    storageUrl.search || storageUrl.hash) {
    throw new Error("The target project URL must be a Supabase HTTPS project URL.");
  }
  return { ...profile, storageUrl: storageUrl.origin };
}

function storageHeaders(key) {
  return key.startsWith("sb_secret_")
    ? { apikey: key }
    : { apikey: key, Authorization: `Bearer ${key}` };
}

async function targetStorageRequest(profile, path, init = {}) {
  const response = await fetch(`${profile.storageUrl}/storage/v1/${path}`, {
    ...init,
    headers: {
      ...storageHeaders(profile.storageServiceRoleKey),
      ...(init.body instanceof Uint8Array ? { "Content-Type": "application/octet-stream" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  return response;
}

async function targetStorageError(response) {
  try {
    const payload = await response.json();
    for (const key of ["message", "error", "error_description"]) {
      if (typeof payload?.[key] === "string" && payload[key].trim()) {
        return payload[key].trim().slice(0, 300);
      }
    }
  } catch {
    // Keep the HTTP status when Storage does not return a JSON error.
  }
  return `HTTP ${response.status}`;
}

async function getTargetBucket(profile) {
  const response = await targetStorageRequest(
    profile,
    `bucket/${encodeURIComponent(profile.storageBucket)}`,
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Could not inspect the target Storage bucket: ${await targetStorageError(response)}.`);
  }
  return response.json();
}

async function ensureTargetBucket(profile) {
  let bucket = await getTargetBucket(profile);
  if (bucket === null) {
    const response = await targetStorageRequest(profile, "bucket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: profile.storageBucket,
        name: profile.storageBucket,
        public: false,
        file_size_limit: MAX_DOCUMENT_FILE_BYTES,
      }),
    });
    if (!response.ok) {
      bucket = await getTargetBucket(profile);
      if (bucket === null) {
        throw new Error(`Could not create the target private bucket: ${await targetStorageError(response)}.`);
      }
    } else {
      bucket = await getTargetBucket(profile);
    }
  }
  if (!bucket || bucket.public !== false) {
    throw new Error("The target bucket must be private before copying files.");
  }
  const currentLimit = bucket.file_size_limit ?? bucket.fileSizeLimit;
  if (Number(currentLimit) !== MAX_DOCUMENT_FILE_BYTES) {
    const response = await targetStorageRequest(
      profile,
      `bucket/${encodeURIComponent(profile.storageBucket)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_size_limit: MAX_DOCUMENT_FILE_BYTES }),
      },
    );
    if (!response.ok) {
      throw new Error(`Could not set the target bucket limit: ${await targetStorageError(response)}.`);
    }
    bucket = await getTargetBucket(profile);
    if (!bucket || bucket.public !== false ||
      Number(bucket.file_size_limit ?? bucket.fileSizeLimit) !== MAX_DOCUMENT_FILE_BYTES) {
      throw new Error("Could not verify the target private bucket limit of 13 MB.");
    }
  }
}

async function loadSourcePaths(client) {
  const result = await client.query(
    `select id, record->>'storagePath' as storage_path,
            record->>'fileName' as file_name, record->>'contentType' as content_type
     from public.documents
     where nullif(record->>'storagePath', '') is not null
     order by id`,
  );
  const byPath = new Map();
  for (const row of result.rows) {
    if (!documentPathIsValid(row.storage_path)) {
      throw new Error(`Document ${row.id} has an invalid storage path; no files were copied.`);
    }
    if (!byPath.has(row.storage_path)) byPath.set(row.storage_path, row);
  }
  return [...byPath.values()];
}

async function downloadSource(path) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/authenticated/daybook-documents/${pathUrl(path)}`,
    { headers: storageHeaders(SUPABASE_SERVICE_ROLE_KEY), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Could not download an existing source file (HTTP ${response.status}). Source files remain untouched.`);
  return new Uint8Array(await response.arrayBuffer());
}

async function downloadTarget(profile, path) {
  const response = await targetStorageRequest(
    profile,
    `object/authenticated/${encodeURIComponent(profile.storageBucket)}/${pathUrl(path)}`,
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = await targetStorageError(response);
    if (response.status === 400 && /^object not found$/i.test(detail)) return null;
    throw new Error(`Could not verify the target file ${path}: ${detail}.`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function fingerprint(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function copyAndVerify(profile, row) {
  const sourceBytes = await downloadSource(row.storage_path);
  const sourceHash = fingerprint(sourceBytes);
  let existing = await downloadTarget(profile, row.storage_path);
  if (!existing) {
    const response = await targetStorageRequest(
      profile,
      `object/${encodeURIComponent(profile.storageBucket)}/${pathUrl(row.storage_path)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": row.content_type || "application/octet-stream",
          "x-upsert": "false",
          "cache-control": "3600",
        },
        body: sourceBytes,
      },
    );
    if (!response.ok) {
      existing = await downloadTarget(profile, row.storage_path);
      if (!existing || fingerprint(existing) !== sourceHash) {
        throw new Error(`Could not copy ${row.storage_path} to the target bucket: ${await targetStorageError(response)}. Source file remains untouched.`);
      }
    } else {
      existing = await downloadTarget(profile, row.storage_path);
    }
  }
  if (!existing || fingerprint(existing) !== sourceHash) {
    throw new Error(`Target verification failed for ${row.storage_path}. Source file remains untouched.`);
  }
  return { path: row.storage_path, sizeBytes: sourceBytes.byteLength, sha256: sourceHash, status: "verified" };
}

const profile = await loadTargetProfile();
const { Client } = pg;
const client = new Client({
  connectionString: profile.connectionString,
  ssl: { rejectUnauthorized: true, ...(profile.caCertificate ? { ca: profile.caCertificate } : {}) },
  connectionTimeoutMillis: 10000,
  query_timeout: 15000,
  statement_timeout: 15000,
});

try {
  await client.connect();
  await ensureTargetBucket(profile);
  const files = await loadSourcePaths(client);
  const migrated = [];
  for (const file of files) migrated.push(await copyAndVerify(profile, file));
  console.log(JSON.stringify({
    targetProfile: profile.name,
    targetBucket: profile.storageBucket,
    filesVerified: migrated.length,
    bytesVerified: migrated.reduce((total, file) => total + file.sizeBytes, 0),
    files: migrated.map(({ path, sizeBytes, status }) => ({ path, sizeBytes, status })),
    sourceFilesDeleted: false,
    documentPathsChanged: false,
  }, null, 2));
} finally {
  await client.end().catch(() => {});
}
