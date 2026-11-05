import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import dotenv from "dotenv";
import { SupabaseDatabase } from "./database.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: resolve(root, ".env.local"), quiet: true });

function getDatabase() {
  const connectionString = process.env.SUPABASE_DEV_DB_URL;
  const expectedProjectRef = process.env.SUPABASE_DEV_PROJECT_REF;
  if (!connectionString || !expectedProjectRef) {
    throw new Error("Set SUPABASE_DEV_DB_URL and SUPABASE_DEV_PROJECT_REF in the ignored .env.local file.");
  }
  return new SupabaseDatabase({ connectionString, expectedProjectRef });
}

async function confirm(action) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Database writes require an interactive terminal.");
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(`${action} in the development database? Type APPLY to continue: `);
    if (answer !== "APPLY") throw new Error("Cancelled; no changes were made.");
  } finally {
    readline.close();
  }
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const supported = ["test", "tables", "select", "insert", "insert-many", "update", "delete", "create-table"];
  if (!supported.includes(command)) {
    throw new Error(`Usage: npm run db:<${supported.join("|")}> -- [arguments]`);
  }

  const db = getDatabase();
  await db.connect();
  try {
    if (command === "test") {
      const result = await db.testConnection();
      console.log(`Connected to development project ${result.projectRef}.`);
    } else if (command === "tables") {
      console.table(await db.listTables());
    } else if (command === "select") {
      const [table, rawLimit] = args;
      if (!table || args.length > 2) throw new Error("Usage: npm run db:select -- <table> [limit]");
      const limit = rawLimit === undefined ? 100 : Number(rawLimit);
      console.table(await db.select(table, { limit }));
    } else if (command === "insert") {
      const [table, rawRecord] = args;
      if (!table || !rawRecord || args.length > 2) throw new Error("Usage: npm run db:insert -- <table> '<record-json>'");
      const record = parseJson(rawRecord, "Record");
      await confirm(`Insert one record into ${table}`);
      console.table([await db.insert(table, record)]);
    } else if (command === "insert-many") {
      const [table, filename] = args;
      if (!table || !filename || args.length > 2) throw new Error("Usage: npm run db:insert-many -- <table> <json-file>");
      const records = parseJson(await readFile(resolve(process.cwd(), filename), "utf8"), "Input file");
      if (!Array.isArray(records) || records.length > 1000) throw new Error("Input file must contain an array of at most 1000 records.");
      await confirm(`Insert ${records.length} records into ${table}`);
      console.table(await db.insertMany(table, records));
    } else if (command === "update") {
      const [table, rawValues, rawWhere] = args;
      if (!table || !rawValues || !rawWhere || args.length > 3) throw new Error("Usage: npm run db:update -- <table> '<values-json>' '<where-json>'");
      const values = parseJson(rawValues, "Update values");
      const where = parseJson(rawWhere, "Where clause");
      await confirm(`Update rows in ${table} matching ${JSON.stringify(where)}`);
      console.table(await db.update(table, values, where));
    } else if (command === "delete") {
      const [table, rawWhere] = args;
      if (!table || !rawWhere || args.length > 2) throw new Error("Usage: npm run db:delete -- <table> '<where-json>'");
      const where = parseJson(rawWhere, "Where clause");
      await confirm(`Delete rows from ${table} matching ${JSON.stringify(where)}`);
      console.table(await db.delete(table, where));
    } else if (command === "create-table") {
      const [table, rawColumns] = args;
      if (!table || !rawColumns || args.length > 2) throw new Error("Usage: npm run db:create-table -- <table> '<columns-json>'");
      const columns = parseJson(rawColumns, "Column definitions");
      await confirm(`Create table ${table}`);
      await db.createTable(table, columns);
      console.log(`Created ${table}.`);
    }
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  if (error && typeof error.code === "string" && /^[0-9A-Z]{5}$/.test(error.code)) {
    console.error(`Database operation failed (PostgreSQL ${error.code}).`);
  } else {
    console.error(error instanceof Error ? error.message : "Database operation failed.");
  }
  process.exitCode = 1;
});
