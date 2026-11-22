export interface FinanceSourceDatasetInfo {
  id: string;
  label: string;
  dateLabel: string;
  amountField?: string;
  currencyField?: string;
  fields: readonly string[];
}

export const FINANCE_SOURCE_DATASETS = [
  {
    id: "payments",
    label: "Payments",
    dateLabel: "Payment date",
    amountField: "amount",
    currencyField: "currency",
    fields: ["date", "payee", "traderName", "category", "amount", "currency", "method", "type", "status", "account", "quantity", "unit"],
  },
  {
    id: "incomes",
    label: "Incomes",
    dateLabel: "Income date",
    amountField: "amount",
    currencyField: "currency",
    fields: ["date", "payer", "sourceName", "category", "amount", "currency", "method", "type", "status", "account"],
  },
  {
    id: "recurring_transactions",
    label: "Recurring transactions",
    dateLabel: "Next due date",
    amountField: "amount",
    fields: ["date", "title", "category", "amount", "method", "frequency", "active"],
  },
  {
    id: "budget_targets",
    label: "Budget targets",
    dateLabel: "Budget month",
    amountField: "amount",
    fields: ["date", "name", "category", "amount", "warningPct", "criticalPct", "active"],
  },
  {
    id: "debt_loans",
    label: "Debt & loans",
    dateLabel: "Opening date",
    amountField: "openingPrincipal",
    currencyField: "currency",
    fields: ["date", "name", "lender", "openingPrincipal", "currency", "annualRate", "monthlyEmi", "dueDay"],
  },
  {
    id: "balancer_months",
    label: "Monthly balance snapshots",
    dateLabel: "Snapshot month",
    fields: ["date", "data"],
  },
  {
    id: "shopping_lists",
    label: "Shopping lists",
    dateLabel: "Planned date",
    amountField: "tentativeAmount",
    fields: ["date", "title", "tentativeAmount"],
  },
  {
    id: "shopping_items",
    label: "Shopping items",
    dateLabel: "Parent list planned date",
    amountField: "price",
    fields: ["date", "listId", "name", "quantity", "unit", "price", "isPurchased", "sortOrder"],
  },
] as const satisfies readonly FinanceSourceDatasetInfo[];

export type FinanceSourceDataset = (typeof FINANCE_SOURCE_DATASETS)[number]["id"];
export type FinanceSourceRecord = Record<string, unknown>;

export const MAX_FINANCE_SOURCE_RECORDS = 50000;

export function financeSourceDataset(dataset: FinanceSourceDataset): FinanceSourceDatasetInfo {
  const found = FINANCE_SOURCE_DATASETS.find((entry) => entry.id === dataset);
  if (!found) throw new Error("Choose a supported source dataset.");
  return found;
}

function isRecord(value: unknown): value is FinanceSourceRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function loadFinanceSourceDataset(
  dataset: FinanceSourceDataset,
  from: string,
  to: string,
  signal: AbortSignal,
): Promise<FinanceSourceRecord[]> {
  const pageSize = 500;
  const records: FinanceSourceRecord[] = [];
  let expectedTotal: number | null = null;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const query = new URLSearchParams({ dataset, offset: String(offset), limit: String(pageSize) });
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const response = await fetch(`/api/finance-source?${query}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error(`The external finance source returned an invalid response (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      const message = isRecord(body) && typeof body.error === "string"
        ? body.error
        : `Could not load external finance data (HTTP ${response.status}).`;
      throw new Error(message);
    }
    if (!isRecord(body) || body.dataset !== dataset || !Array.isArray(body.records) ||
      typeof body.total !== "number" || !Number.isSafeInteger(body.total) || body.total < 0 ||
      typeof body.hasMore !== "boolean" || !body.records.every(isRecord)) {
      throw new Error("The external finance source returned an invalid page.");
    }
    if (expectedTotal === null) expectedTotal = body.total;
    if (body.total !== expectedTotal || expectedTotal > MAX_FINANCE_SOURCE_RECORDS) {
      throw new Error(`The external source returned ${body.total} ${dataset} records; this screen can safely load up to ${MAX_FINANCE_SOURCE_RECORDS}. Narrow the date range.`);
    }
    const page = body.records;
    if (page.length > pageSize || (body.hasMore && page.length === 0)) {
      throw new Error("The external finance source returned an inconsistent page.");
    }
    records.push(...page);
    hasMore = body.hasMore;
    offset += page.length;
    if (offset > expectedTotal || (hasMore && offset >= expectedTotal)) {
      throw new Error("The external finance source returned inconsistent pagination details.");
    }
  }

  return records;
}
