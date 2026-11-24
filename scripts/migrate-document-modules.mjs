import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local", quiet: true });

const requiredEnvironment = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_CONNECTION_VAULT_PASSPHRASE",
];
if (requiredEnvironment.some((name) => !process.env[name])) {
  throw new Error("Set the source Supabase settings and database-vault passphrase in ignored .env.local.");
}

function decodeBase64(value) {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

async function loadProfiles() {
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
  const result = await response.json();
  const vault = result?.[0]?.vault;
  if (!vault || vault.kdf !== "PBKDF2-SHA-256" || vault.iterations !== 310_000) {
    throw new Error("The shared database profile vault is missing or unsupported.");
  }

  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(DATABASE_CONNECTION_VAULT_PASSPHRASE),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
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
  if (payload?.version !== 1 || !Array.isArray(payload.profiles)) {
    throw new Error("The decrypted database profile vault has an invalid format.");
  }
  return payload.profiles;
}

async function loadSourceData() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/load_daybook_data_with_devotional_songs`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: "{}",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Could not load source Daybook records (HTTP ${response.status}).`);
  const result = await response.json();
  if (!Array.isArray(result) || !result[0]?.data || typeof result[0].data !== "object") {
    throw new Error("The source Daybook database returned an invalid data set.");
  }
  return result[0].data;
}

function archivedRecords(data, collectionName) {
  return (data.archivedRecords ?? []).flatMap((archive) => {
    const records = archive?.snapshot?.[collectionName];
    if (!Array.isArray(records)) return [];
    return records.map((record) => ({
      ...record,
      isArchived: true,
      ...(typeof archive.archivedAt === "string" ? { archivedAt: archive.archivedAt } : {}),
    }));
  });
}

function combineById(active, archived) {
  const records = new Map();
  for (const record of [...archived, ...(Array.isArray(active) ? active : [])]) {
    if (typeof record?.id !== "string" || !record.id) {
      throw new Error("A source record is missing its stable ID; no target data was changed.");
    }
    records.set(record.id, record);
  }
  return [...records.values()];
}

async function insertRecords(client, table, records) {
  let inserted = 0;
  for (const [index, record] of records.entries()) {
    const result = await client.query(
      `insert into public.${table} (id, position, record) values ($1, $2, $3::jsonb) on conflict (id) do nothing`,
      [record.id, index + 1, JSON.stringify(record)],
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

async function verifyRecords(client, table, expected) {
  const result = await client.query(`select id, record from public.${table} order by id`);
  const targetRecords = new Map(result.rows.map((row) => [row.id, row.record]));
  for (const record of expected) {
    if (!isDeepStrictEqual(record, targetRecords.get(record.id))) {
      throw new Error(`The target ${table} record set did not preserve source record ${record.id}.`);
    }
  }
  return { sourceRecords: expected.length, targetRecords: targetRecords.size, verified: expected.length };
}

function ensureProfile(profile) {
  const requiredModules = ["Documents", "Personal Documents", "Account credentials"];
  if (!profile || profile.name !== "mydocumentsmanager" ||
    !requiredModules.every((module) => profile.modules.includes(module))) {
    throw new Error("The mydocumentsmanager profile must be assigned Documents, Personal Documents, and Account credentials.");
  }
  return profile;
}

const profiles = await loadProfiles();
const profile = ensureProfile(profiles.find((entry) => entry.name === "mydocumentsmanager"));
const data = await loadSourceData();
const documents = combineById(data.documents, archivedRecords(data, "documents"));
const personalDocuments = combineById(data.personalRecords, archivedRecords(data, "personalRecords"));
const credentials = Array.isArray(data.credentialRecords) ? data.credentialRecords : [];
const archivedCredentials = archivedRecords(data, "credentialRecords");
const { Client } = pg;
const client = new Client({
  connectionString: profile.connectionString,
  ssl: { rejectUnauthorized: true, ...(profile.caCertificate ? { ca: profile.caCertificate } : {}) },
  connectionTimeoutMillis: 10000,
  query_timeout: 15000,
  statement_timeout: 15000,
});

const schema = await readFile(new URL("../database-profiles/mydocumentsmanager/001_document_vault_schema.sql", import.meta.url), "utf8");
const resultCounts = {
  documents: 0,
  personalDocuments: 0,
  accountCredentials: 0,
  archivedAccountCredentials: 0,
  credentialVaultCopied: false,
};
let verificationCounts = {};

try {
  await client.connect();
  await client.query(schema);
  await client.query("begin");
  resultCounts.documents = await insertRecords(client, "documents", documents);
  resultCounts.personalDocuments = await insertRecords(client, "personal_documents", personalDocuments);
  resultCounts.accountCredentials = await insertRecords(client, "account_credentials", credentials);

  for (const [index, record] of archivedCredentials.entries()) {
    if (typeof record.id !== "string" || !record.id) {
      throw new Error("An archived account credential is missing its stable ID; the migration transaction was rolled back.");
    }
    const result = await client.query(
      `insert into public.archived_account_credentials (id, position, record, archived_at)
       values ($1, $2, $3::jsonb, $4::timestamptz)
       on conflict (id) do nothing`,
      [record.id, index + 1, JSON.stringify(record), record.archivedAt ?? null],
    );
    resultCounts.archivedAccountCredentials += result.rowCount ?? 0;
  }

  if (data.credentialVault && typeof data.credentialVault === "object") {
    const result = await client.query(
      `insert into public.credential_vault (id, vault) values ('shared', $1::jsonb)
       on conflict (id) do nothing`,
      [JSON.stringify(data.credentialVault)],
    );
    resultCounts.credentialVaultCopied = (result.rowCount ?? 0) > 0;
  }

  await client.query(
    `insert into public.document_activity (id, module, record_id, action, details)
     values ('initial-source-copy', 'Documents', 'migration', 'migration', $1::jsonb)
     on conflict (id) do nothing`,
    [JSON.stringify({
      source: "existing Daybook collections",
      sourceDocuments: documents.length,
      sourcePersonalDocuments: personalDocuments.length,
      sourceCredentials: credentials.length,
      sourceArchivedCredentials: archivedCredentials.length,
    })],
  );
  verificationCounts = {
    documents: await verifyRecords(client, "documents", documents),
    personalDocuments: await verifyRecords(client, "personal_documents", personalDocuments),
    accountCredentials: await verifyRecords(client, "account_credentials", credentials),
    archivedAccountCredentials: await verifyRecords(
      client,
      "archived_account_credentials",
      archivedCredentials,
    ),
  };
  if (data.credentialVault) {
    const vaultResult = await client.query("select vault from public.credential_vault where id = 'shared'");
    if (!vaultResult.rows[0] || !isDeepStrictEqual(data.credentialVault, vaultResult.rows[0].vault)) {
      throw new Error("The encrypted credential-vault blob did not verify in the target database.");
    }
  }
  await client.query("commit");
} catch (error) {
  await client.query("rollback").catch(() => {});
  const safeCode = typeof error?.code === "string" ? error.code.replace(/[^A-Z0-9_]/g, "") : "";
  throw new Error(`Document database setup or migration failed${safeCode ? ` (code ${safeCode})` : ""}. Source records were not changed.`);
} finally {
  await client.end().catch(() => {});
}

console.log("Document database schema and initial data copy completed.");
console.log(JSON.stringify({
  targetProfile: profile.name,
  sourceRecordsAvailable: {
    documents: documents.length,
    personalDocuments: personalDocuments.length,
    accountCredentials: credentials.length,
    archivedAccountCredentials: archivedCredentials.length,
    encryptedCredentialVaultPresent: Boolean(data.credentialVault),
  },
  insertedIntoTarget: resultCounts,
  targetVerification: verificationCounts,
  sourceRecordsRetained: true,
  uploadedFilesMoved: false,
}, null, 2));
