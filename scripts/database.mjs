import pg from "pg";

const { Client } = pg;
const PRODUCTION_PROJECT_REFS = new Set(["ijgxodotgscoldjevpwp"]);
const ALLOWED_TYPES = new Set([
  "bigint",
  "boolean",
  "date",
  "integer",
  "jsonb",
  "numeric",
  "text",
  "timestamptz",
  "uuid",
]);
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;

function quoteIdentifier(value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw new Error(`Invalid database identifier: ${String(value)}`);
  }
  return `"${value}"`;
}

function getProjectRef(url) {
  const directMatch = url.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i);
  if (directMatch) return directMatch[1].toLowerCase();

  if (/^[a-z0-9-]+\.pooler\.supabase\.com$/i.test(url.hostname)) {
    const userMatch = decodeURIComponent(url.username).match(/^[^.]+\.([a-z0-9-]+)$/i);
    if (userMatch) return userMatch[1].toLowerCase();
  }

  return null;
}

function validateConnection(connectionString, expectedProjectRef) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("SUPABASE_DEV_DB_URL must be a valid PostgreSQL URI.");
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("SUPABASE_DEV_DB_URL must use the PostgreSQL protocol.");
  }

  const projectRef = getProjectRef(url);
  if (!projectRef || !/^[a-z0-9-]+$/i.test(expectedProjectRef ?? "")) {
    throw new Error("Use a Supabase Connect URI and set SUPABASE_DEV_PROJECT_REF to its project reference.");
  }
  if (projectRef !== expectedProjectRef.toLowerCase()) {
    throw new Error("SUPABASE_DEV_PROJECT_REF does not match the project reference in SUPABASE_DEV_DB_URL.");
  }
  if (PRODUCTION_PROJECT_REFS.has(projectRef)) {
    throw new Error("This utility blocks writes to the configured production Supabase project. Use a separate development project.");
  }

  for (const parameter of [...url.searchParams.keys()]) {
    if (parameter.toLowerCase().startsWith("ssl")) {
      url.searchParams.delete(parameter);
    }
  }

  return { connectionString: url.toString(), projectRef };
}

function makeWhere(where, startingParameter = 1) {
  if (!where || typeof where !== "object" || Array.isArray(where)) {
    throw new Error("A where object is required.");
  }
  const entries = Object.entries(where);
  if (!entries.length) {
    throw new Error("A non-empty where object is required for update and delete.");
  }

  const values = [];
  const clauses = entries.map(([column, value]) => {
    const name = quoteIdentifier(column);
    if (value === undefined) {
      throw new Error(`Undefined where value for ${column}.`);
    }
    if (value === null) return `${name} IS NULL`;
    values.push(value);
    return `${name} = $${startingParameter + values.length - 1}`;
  });
  return { sql: clauses.join(" AND "), values };
}

export class SupabaseDatabase {
  #client;
  #connected = false;
  #inTransaction = false;
  projectRef;

  constructor({ connectionString, expectedProjectRef }) {
    const target = validateConnection(connectionString, expectedProjectRef);
    this.projectRef = target.projectRef;
    this.#client = new Client({
      connectionString: target.connectionString,
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
    });
  }

  async connect() {
    if (!this.#connected) {
      try {
        await this.#client.connect();
        this.#connected = true;
      } catch {
        throw new Error(`Could not connect to Supabase development project ${this.projectRef}. Check the local URI and network access.`);
      }
    }
    return this;
  }

  async close() {
    if (this.#connected) {
      this.#connected = false;
      await this.#client.end();
    }
  }

  async #query(sql, values = []) {
    if (!this.#connected) throw new Error("Connect to the development database before running a query.");
    return this.#client.query(sql, values);
  }

  async testConnection() {
    await this.#query("SELECT 1");
    return { connected: true, projectRef: this.projectRef };
  }

  async listTables(schema = "public") {
    const result = await this.#query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name",
      [schema],
    );
    return result.rows.map((row) => row.table_name);
  }

  async select(table, { columns = ["*"], where = {}, limit = 100, offset = 0, orderBy } = {}) {
    if (!Array.isArray(columns) || columns.length === 0) {
      throw new Error("Select at least one column.");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error("Select limit must be from 1 to 1000.");
    }
    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error("Select offset must be zero or a positive integer.");
    }

    const selected = columns.map((column) => column === "*" ? "*" : quoteIdentifier(column)).join(", ");
    const conditions = Object.keys(where).length ? makeWhere(where) : { sql: "", values: [] };
    const order = orderBy
      ? ` ORDER BY ${quoteIdentifier(orderBy.column)} ${orderBy.direction === "desc" ? "DESC" : "ASC"}`
      : "";
    const result = await this.#query(
      `SELECT ${selected} FROM ${quoteIdentifier(table)}${conditions.sql ? ` WHERE ${conditions.sql}` : ""}${order} LIMIT $${conditions.values.length + 1} OFFSET $${conditions.values.length + 2}`,
      [...conditions.values, limit, offset],
    );
    return result.rows;
  }

  async insert(table, record) {
    const rows = await this.insertMany(table, [record]);
    return rows[0];
  }

  async insertMany(table, records) {
    if (!Array.isArray(records) || records.length === 0 || records.length > 1000) {
      throw new Error("Insert between 1 and 1000 records at a time.");
    }
    const columns = Object.keys(records[0] ?? {});
    if (!columns.length) throw new Error("An inserted record must contain at least one field.");
    if (records.some((record) =>
      !record || typeof record !== "object" || Array.isArray(record) ||
      Object.keys(record).length !== columns.length ||
      columns.some((column) => !Object.hasOwn(record, column) || record[column] === undefined)
    )) {
      throw new Error("Every record must have the same fields and no undefined values.");
    }

    const quotedColumns = columns.map(quoteIdentifier).join(", ");
    const values = [];
    const placeholders = records.map((record) => {
      const row = columns.map((column) => {
        values.push(record[column]);
        return `$${values.length}`;
      });
      return `(${row.join(", ")})`;
    });
    const result = await this.#query(
      `INSERT INTO ${quoteIdentifier(table)} (${quotedColumns}) VALUES ${placeholders.join(", ")} RETURNING *`,
      values,
    );
    return result.rows;
  }

  async update(table, values, where) {
    if (!values || typeof values !== "object" || Array.isArray(values) || !Object.keys(values).length) {
      throw new Error("Provide at least one field to update.");
    }
    const entries = Object.entries(values);
    if (entries.some(([, value]) => value === undefined)) {
      throw new Error("Update values cannot be undefined.");
    }

    const assignments = entries.map(([column], index) => `${quoteIdentifier(column)} = $${index + 1}`);
    const conditions = makeWhere(where, entries.length + 1);
    const result = await this.#query(
      `UPDATE ${quoteIdentifier(table)} SET ${assignments.join(", ")} WHERE ${conditions.sql} RETURNING *`,
      [...entries.map(([, value]) => value), ...conditions.values],
    );
    return result.rows;
  }

  async delete(table, where) {
    const conditions = makeWhere(where);
    const result = await this.#query(
      `DELETE FROM ${quoteIdentifier(table)} WHERE ${conditions.sql} RETURNING *`,
      conditions.values,
    );
    return result.rows;
  }

  async createTable(table, columns) {
    if (!Array.isArray(columns) || columns.length === 0) {
      throw new Error("Provide at least one column definition.");
    }
    const seen = new Set();
    const definitions = columns.map((column) => {
      const name = quoteIdentifier(column.name);
      if (seen.has(column.name.toLowerCase())) throw new Error(`Duplicate column: ${column.name}`);
      seen.add(column.name.toLowerCase());
      const type = String(column.type).toLowerCase();
      if (!ALLOWED_TYPES.has(type)) {
        throw new Error(`Unsupported type "${column.type}". Allowed types: ${[...ALLOWED_TYPES].join(", ")}.`);
      }
      return `${name} ${type}${column.nullable === false ? " NOT NULL" : ""}${column.primaryKey ? " PRIMARY KEY" : ""}`;
    });

    await this.#query(`CREATE TABLE ${quoteIdentifier(table)} (${definitions.join(", ")})`);
  }

  async transaction(operation) {
    if (this.#inTransaction) throw new Error("Nested transactions are not supported.");
    await this.#query("BEGIN");
    this.#inTransaction = true;
    try {
      const result = await operation(this);
      await this.#query("COMMIT");
      return result;
    } catch (error) {
      try {
        await this.#query("ROLLBACK");
      } catch {
        throw new Error("Transaction failed and rollback could not be confirmed. Inspect the development database before retrying.");
      }
      throw error;
    } finally {
      this.#inTransaction = false;
    }
  }
}
