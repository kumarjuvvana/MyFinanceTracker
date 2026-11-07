import { parse, type Statement } from "pgsql-ast-parser";

const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/i;
const PROTECTED_TABLES = new Set(["daybook_data", "daybook_state", "credential_vault"]);
const MAX_SQL_LENGTH = 16_000;
const MAX_SELECT_ROWS = 100;
const MAX_INSERT_ROWS = 100;

export type SqlCommand = "select" | "insert" | "update" | "delete";

export interface SqlInspection {
  command: SqlCommand;
  statement: Statement;
  tables: string[];
  requiresConfirmation: boolean;
}

interface TableReference {
  name: string;
  schema?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function statementName(value: unknown): string | null {
  return isRecord(value) && typeof value.name === "string" ? value.name : null;
}

function statementSchema(value: unknown): string | undefined {
  return isRecord(value) && typeof value.schema === "string" ? value.schema : undefined;
}

function inspectAst(value: unknown, tables: TableReference[], nestedStatements: string[], functionCalls: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => inspectAst(item, tables, nestedStatements, functionCalls));
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.type === "string") {
    if (value.type === "table") {
      const name = statementName(value.name);
      if (name) tables.push({ name, schema: statementSchema(value.name) });
    } else if (value.type === "call") {
      const call = isRecord(value.function) ? statementName(value.function) : null;
      functionCalls.push(call ?? "unknown");
    } else if (["select", "insert", "update", "delete", "with", "with recursive"].includes(value.type)) {
      nestedStatements.push(value.type);
    }
  }
  Object.values(value).forEach((item) => inspectAst(item, tables, nestedStatements, functionCalls));
}

export function inspectSqlStatement(sql: unknown): SqlInspection {
  if (typeof sql !== "string" || !sql.trim()) throw new Error("Enter one SQL statement.");
  if (sql.length > MAX_SQL_LENGTH) throw new Error("SQL is limited to 16,000 characters.");

  let statements: Statement[];
  try {
    statements = parse(sql);
  } catch {
    throw new Error("SQL syntax is invalid or uses a command not supported by this manager.");
  }
  if (statements.length !== 1) throw new Error("Run exactly one SQL statement at a time.");

  const statement = statements[0];
  if (!["select", "insert", "update", "delete"].includes(statement.type)) {
    throw new Error("Only SELECT, INSERT, UPDATE, and DELETE statements are allowed. DDL and transaction commands are blocked.");
  }
  const command = statement.type as SqlCommand;
  const tables: TableReference[] = [];
  const nestedStatements: string[] = [];
  const functionCalls: string[] = [];
  inspectAst(statement, tables, nestedStatements, functionCalls);
  if (functionCalls.length) {
    throw new Error("SQL function calls are not allowed in the SQL console.");
  }
  if (nestedStatements.length > 1 || nestedStatements.some((type) => type !== command)) {
    throw new Error("Nested SQL statements, including CTEs and subqueries, are not allowed.");
  }
  if (tables.some(({ name, schema }) => !IDENTIFIER_PATTERN.test(name) ||
    schema?.toLowerCase() !== "public" || PROTECTED_TABLES.has(name.toLowerCase()))) {
    throw new Error("Qualify tables with public. and use eligible public tables only; core Daybook tables are protected.");
  }

  const target = command === "insert"
    ? statement.type === "insert" ? statement.into : undefined
    : command === "update"
      ? statement.type === "update" ? statement.table : undefined
      : command === "delete" ? statement.type === "delete" ? statement.from : undefined : undefined;

  if (command === "select") {
    if (statement.type !== "select" || !statement.limit?.limit ||
      statement.limit.limit.type !== "integer" || statement.limit.limit.value < 1 ||
      statement.limit.limit.value > MAX_SELECT_ROWS || statement.for) {
      throw new Error("SELECT must include LIMIT 1–100 and cannot lock rows.");
    }
    if (!tables.length && statement.from?.length) {
      throw new Error("The SELECT source is not supported.");
    }
  } else {
    const targetName = statementName(target);
    const targetSchema = statementSchema(target);
    if (!targetName || !IDENTIFIER_PATTERN.test(targetName) || targetSchema?.toLowerCase() !== "public" ||
      PROTECTED_TABLES.has(targetName.toLowerCase())) {
      throw new Error("Write statements must target an eligible public.<table>; core Daybook tables are protected.");
    }
    if (tables.length) {
      throw new Error("Write statements must target one table and cannot contain subqueries or additional table references.");
    }
    if (command === "insert" && statement.type === "insert" &&
      (statement.insert.type !== "values" || statement.insert.values.length > MAX_INSERT_ROWS ||
        statement.returning || statement.onConflict)) {
      throw new Error("INSERT must use VALUES for at most 100 rows and cannot use RETURNING or ON CONFLICT.");
    }
    if (command === "update" && statement.type === "update" &&
      (!statement.where || statement.from || statement.returning)) {
      throw new Error("UPDATE requires a WHERE clause and cannot use FROM or RETURNING.");
    }
    if (command === "delete" && statement.type === "delete" &&
      (!statement.where || statement.returning)) {
      throw new Error("DELETE requires a WHERE clause and cannot use RETURNING.");
    }
  }

  const targetName = statementName(target);
  return {
    command,
    statement,
    tables: [...new Set([...tables.map(({ name }) => name), ...(targetName ? [targetName] : [])])],
    requiresConfirmation: command !== "select",
  };
}

export function sqlConfirmationPhrase(command: SqlCommand): string {
  return `EXECUTE ${command.toUpperCase()}`;
}
