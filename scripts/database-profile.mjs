import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: resolve(root, ".env.local"), quiet: true });

const { Client } = pg;
const ITERATIONS = 310_000;
const MAX_ROWS = 50;
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;
const PROTECTED_TABLES = ["credential_vault", "database_connection_vault", "daybook_data", "daybook_state"];

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEncryptedVault(value) {
  return isRecord(value) && value.version === 1 && value.kdf === "PBKDF2-SHA-256" &&
    value.iterations === ITERATIONS && typeof value.salt === "string" &&
    /^[A-Za-z0-9+/]{22}==$/.test(value.salt) && typeof value.iv === "string" &&
    /^[A-Za-z0-9+/]{16}$/.test(value.iv) && typeof value.ciphertext === "string" &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value.ciphertext) && value.ciphertext.length <= 1_000_000;
}

function decodeBase64(value) {
  return new Uint8Array(Buffer.from(value, "base64"));
}

async function decryptProfiles(vault, passphrase) {
  if (!isEncryptedVault(vault)) {
    throw new Error("The shared database connection vault is missing or invalid.");
  }

  const keyMaterial = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await webcrypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: decodeBase64(vault.salt), iterations: ITERATIONS },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  let payload;
  try {
    const plaintext = await webcrypto.subtle.decrypt(
      { name: "AES-GCM", iv: decodeBase64(vault.iv) },
      key,
      decodeBase64(vault.ciphertext),
    );
    payload = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("The vault passphrase is incorrect, or its encrypted data has been changed.");
  }

  if (!isRecord(payload) || payload.version !== 1 || !Array.isArray(payload.profiles) ||
    payload.profiles.length > 20) {
    throw new Error("The decrypted database connection profiles are invalid.");
  }

  const ids = new Set();
  for (const profile of payload.profiles) {
    if (!isRecord(profile) || typeof profile.id !== "string" || !profile.id.trim() ||
      ids.has(profile.id) || typeof profile.name !== "string" || !profile.name.trim() ||
      profile.name.length > 80 || !Array.isArray(profile.modules) || profile.modules.length > 50 ||
      !profile.modules.every((module) => typeof module === "string" && module.trim() && module.length <= 80) ||
      typeof profile.connectionString !== "string" || profile.connectionString.length < 1 ||
      profile.connectionString.length > 2000 || typeof profile.caCertificate !== "string" ||
      profile.caCertificate.length > 20000) {
      throw new Error("The decrypted database connection profiles are invalid.");
    }
    ids.add(profile.id);
  }
  return payload.profiles;
}

function getSupabaseCredentials() {
  const configuredUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!configuredUrl || !key) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the ignored .env.local file.");
  }

  let url;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error("SUPABASE_URL must be a valid Supabase project URL.");
  }
  if ((url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") ||
    url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SUPABASE_URL must be the HTTPS origin of your Supabase project.");
  }
  return { baseUrl: url.origin, key };
}

async function loadProfiles() {
  const passphrase = process.env.DATABASE_CONNECTION_VAULT_PASSPHRASE;
  if (!passphrase || passphrase.length < 16 || passphrase.length > 256) {
    throw new Error("Set DATABASE_CONNECTION_VAULT_PASSPHRASE (at least 16 characters) in the ignored .env.local file.");
  }

  const { baseUrl, key } = getSupabaseCredentials();
  let response;
  try {
    response = await fetch(`${baseUrl}/rest/v1/database_connection_vault?select=vault&id=eq.shared`, {
      headers: { Accept: "application/json", apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not reach Supabase to load the saved database connection vault.");
  }
  if (!response.ok) {
    throw new Error(`Could not load the saved database connection vault (HTTP ${response.status}).`);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Supabase returned an invalid database connection vault response.");
  }
  if (!Array.isArray(result) || result.length !== 1 || !isRecord(result[0]) ||
    !isEncryptedVault(result[0].vault)) {
    throw new Error("The shared database connection vault is missing or invalid.");
  }
  return decryptProfiles(result[0].vault, passphrase);
}

function findProfile(profiles, selector) {
  const matches = profiles.filter((profile) =>
    profile.id === selector || profile.name.toLocaleLowerCase() === selector.toLocaleLowerCase());
  if (matches.length === 0) throw new Error("No saved database profile matches that ID or name.");
  if (matches.length > 1) throw new Error("More than one profile has that name; select it by profile ID.");
  return matches[0];
}

function validateProfileConnection(profile) {
  let url;
  try {
    url = new URL(profile.connectionString);
  } catch {
    throw new Error("The saved profile has an invalid PostgreSQL connection URI.");
  }
  const isSupabaseHost = /^db\.[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) ||
    /^[a-z0-9-]+\.pooler\.supabase\.com$/i.test(url.hostname);
  if ((url.protocol !== "postgres:" && url.protocol !== "postgresql:") || !isSupabaseHost ||
    !["5432", "6543"].includes(url.port) || !url.username || !url.password ||
    !/^\/[^/]+$/.test(url.pathname) || url.hash) {
    throw new Error("The saved profile must use a supported Supabase PostgreSQL connection URI.");
  }
  if (url.search) {
    const options = new URLSearchParams(url.search);
    if ([...options.keys()].some((key) => key !== "sslmode") ||
      (options.has("sslmode") && !["require", "verify-full"].includes(options.get("sslmode") ?? ""))) {
      throw new Error("The saved profile contains unsupported PostgreSQL URI options.");
    }
    url.search = "";
  }

  let caCertificate;
  if (profile.caCertificate.trim()) {
    caCertificate = profile.caCertificate.trim();
    if (caCertificate.length > 20000 || !caCertificate.startsWith("-----BEGIN CERTIFICATE-----") ||
      !caCertificate.endsWith("-----END CERTIFICATE-----")) {
      throw new Error("The saved profile contains an invalid CA certificate.");
    }
  }
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true, ...(caCertificate ? { ca: caCertificate } : {}) },
  };
}

function inspectProfile(profile) {
  validateProfileConnection(profile);
  const url = new URL(profile.connectionString);
  const redactedConnectionString = `${url.protocol}//[redacted]@${url.host}${url.pathname}${url.search}`;
  return {
    profile: profile.name,
    connectionString: redactedConnectionString,
    host: url.hostname,
    port: Number(url.port || 5432),
    database: decodeURIComponent(url.pathname.slice(1)),
    sslMode: url.searchParams.get("sslmode") ?? "not specified; CLI enforces TLS",
    tlsRequired: true,
    caCertificateConfigured: Boolean(profile.caCertificate.trim()),
  };
}

function quoteIdentifier(value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw new Error("Table names must be simple PostgreSQL identifiers.");
  }
  return `"${value}"`;
}

async function withConnection(profile, operation, { readOnly = true } = {}) {
  const target = validateProfileConnection(profile);
  const client = new Client({
    ...target,
    connectionTimeoutMillis: 10000,
    query_timeout: 20000,
  });
  try {
    await client.connect();
    await client.query(readOnly ? "BEGIN READ ONLY" : "BEGIN ISOLATION LEVEL SERIALIZABLE");
    await client.query("SET LOCAL statement_timeout = '15000ms'");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection is closed immediately; preserve the original query error.
    }
    throw error;
  } finally {
    await client.end();
  }
}

function parseJsonArgument(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

function makeWhere(where, startingParameter = 1) {
  if (!isRecord(where) || Object.keys(where).length === 0) {
    throw new Error("Provide a non-empty JSON where object to identify one row.");
  }
  const values = [];
  const clauses = Object.entries(where).map(([column, value]) => {
    const name = quoteIdentifier(column);
    if (value === undefined) throw new Error(`Where value for ${column} cannot be undefined.`);
    if (value === null) return `${name} IS NULL`;
    values.push(value);
    return `${name} = $${startingParameter + values.length - 1}`;
  });
  return { sql: clauses.join(" AND "), values };
}

async function updateOneRow(profile, table, values, where) {
  if (PROTECTED_TABLES.includes(table)) throw new Error("The requested public table is protected.");
  if (!isRecord(values) || Object.keys(values).length === 0) {
    throw new Error("Provide a non-empty JSON object of column values to update.");
  }
  if (Object.values(values).some((value) => value === undefined)) {
    throw new Error("Update values cannot be undefined.");
  }
  const entries = Object.entries(values);
  const columns = entries.map(([column]) => quoteIdentifier(column));
  const selectConditions = makeWhere(where);
  const updateConditions = makeWhere(where, entries.length + 1);
  const quotedTable = quoteIdentifier(table);

  return withConnection(profile, async (client) => {
    const exists = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 AND table_type = 'BASE TABLE'",
      [table],
    );
    if (exists.rowCount !== 1) throw new Error("The requested public base table was not found.");

    const matchingRows = await client.query(
      `SELECT * FROM public.${quotedTable} WHERE ${selectConditions.sql} LIMIT 2 FOR UPDATE`,
      selectConditions.values,
    );
    if (matchingRows.rowCount !== 1) {
      throw new Error(`Update cancelled: the filter matched ${matchingRows.rowCount > 1 ? "multiple rows" : "no rows"}; exactly one row must match.`);
    }

    const assignments = columns.map((column, index) => `${column} = $${index + 1}`);
    const updated = await client.query(
      `UPDATE public.${quotedTable} SET ${assignments.join(", ")} WHERE ${updateConditions.sql} RETURNING *`,
      [...entries.map(([, value]) => value), ...updateConditions.values],
    );
    if (updated.rowCount !== 1) {
      throw new Error("Update cancelled because exactly one row was not changed.");
    }
    return { before: matchingRows.rows[0], after: updated.rows[0] };
  }, { readOnly: false });
}

function usage() {
  console.log([
    "Access saved encrypted database profiles:",
    "  npm run db:profile -- profiles",
    "  npm run db:profile -- inspect <profile-id-or-name>",
    "  npm run db:profile -- tables <profile-id-or-name>",
    "  npm run db:profile -- schema <profile-id-or-name>",
    "  npm run db:profile -- count <profile-id-or-name> <table>",
    "  npm run db:profile -- select <profile-id-or-name> <table> [limit]",
    "  npm run db:profile -- update <profile-id-or-name> <table> '<values-json>' '<where-json>' CONFIRM",
    "",
    `Select returns at most ${MAX_ROWS} rows. Reads are read-only; updates require CONFIRM and a filter matching exactly one public-table row.`,
  ].join("\n"));
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
    usage();
    return;
  }
  if (!["profiles", "inspect", "tables", "schema", "count", "select", "update"].includes(command)) {
    usage();
    throw new Error("Unsupported database profile command.");
  }

  if (command === "update") {
    const [selector, table, rawValues, rawWhere, confirmation] = args;
    if (args.length !== 5 || !selector || !table || !IDENTIFIER.test(table) ||
      confirmation !== "CONFIRM") {
      throw new Error("Usage: update <profile-id-or-name> <table> '<values-json>' '<where-json>' CONFIRM");
    }
    const values = parseJsonArgument(rawValues, "Update values");
    const where = parseJsonArgument(rawWhere, "Where filter");
    const profiles = await loadProfiles();
    const profile = findProfile(profiles, selector);
    const result = await updateOneRow(profile, table, values, where);
    console.log(JSON.stringify({ profile: profile.name, table, ...result }, null, 2));
    return;
  }

  const profiles = await loadProfiles();
  if (command === "profiles") {
    if (args.length) throw new Error("Usage: profiles");
    console.log(JSON.stringify(profiles.map(({ id, name, modules }) => ({ id, name, modules })), null, 2));
    return;
  }

  if (command === "inspect") {
    if (args.length !== 1) throw new Error("Usage: inspect <profile-id-or-name>");
    console.log(JSON.stringify(inspectProfile(findProfile(profiles, args[0])), null, 2));
    return;
  }

  const [selector, table, rawLimit] = args;
  if (!selector) throw new Error(`Usage: ${command} <profile-id-or-name>${command === "tables" ? "" : " <table>"}`);
  const profile = findProfile(profiles, selector);
  if (command === "tables" || command === "schema") {
    if (args.length !== 1) throw new Error(`Usage: ${command} <profile-id-or-name>`);
    const rows = await withConnection(profile, async (client) => {
      const result = await client.query(
        `SELECT c.relname AS table_name,
                a.attname AS column_name,
                pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
                a.attnotnull AS not_null,
                pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_value,
                EXISTS (
                  SELECT 1 FROM pg_catalog.pg_constraint pk
                  WHERE pk.conrelid = c.oid AND pk.contype = 'p' AND a.attnum = ANY(pk.conkey)
                ) AS primary_key
         FROM pg_catalog.pg_class c
         JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
         LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
         WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
           AND c.relname <> ALL($1::text[]) AND a.attnum > 0 AND NOT a.attisdropped
         ORDER BY c.relname, a.attnum`,
        [PROTECTED_TABLES],
      );
      return result.rows;
    });
    console.log(JSON.stringify({ profile: profile.name, ...(command === "tables" ? { tables: rows } : { columns: rows }) }, null, 2));
    return;
  }

  if (!table || !IDENTIFIER.test(table)) {
    throw new Error(`Usage: ${command} <profile-id-or-name> <table>${command === "select" ? " [limit]" : ""}`);
  }
  const quotedTable = quoteIdentifier(table);
  const result = await withConnection(profile, async (client) => {
    const exists = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 AND table_type = 'BASE TABLE'",
      [table],
    );
    if (exists.rowCount !== 1 || PROTECTED_TABLES.includes(table)) {
      throw new Error("The requested public table was not found or is protected.");
    }
    if (command === "count") {
      if (args.length !== 2) throw new Error("Usage: count <profile-id-or-name> <table>");
      const count = await client.query(`SELECT COUNT(*)::text AS count FROM public.${quotedTable}`);
      return { profile: profile.name, table, count: count.rows[0].count };
    }
    if (args.length > 3) throw new Error("Usage: select <profile-id-or-name> <table> [limit]");
    const limit = rawLimit === undefined ? MAX_ROWS : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ROWS) {
      throw new Error(`Select limit must be from 1 to ${MAX_ROWS}.`);
    }
    const rows = await client.query(`SELECT * FROM public.${quotedTable} LIMIT $1`, [limit]);
    return { profile: profile.name, table, limit, rows: rows.rows };
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const code = error && typeof error.code === "string" && /^[0-9A-Z_]+$/.test(error.code)
    ? error.code
    : "";
  if (/^[0-9A-Z]{5}$/.test(code)) {
    const detail = code === "42P18" ? ": PostgreSQL could not infer a parameter type." : "";
    console.error(`Database profile query failed (PostgreSQL ${code})${detail}`);
  }
  else if (code) console.error(`Database profile query failed (${code}).`);
  else console.error(error instanceof Error && error.message ? error.message : "Database profile query failed.");
  process.exitCode = 1;
});
