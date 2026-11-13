export interface ReportDateRange {
  from?: string;
  to?: string;
}

export type ReportDatePreset = "all-time" | "last-30-days" | "month-to-date" | "year-to-date";
export type ReportTimeUnit = "day" | "month" | "year";
export type ReportGroupBy =
  | { type: "dimension"; id: string }
  | { type: "time"; unit: ReportTimeUnit };

export interface ReportDimension<T> {
  id: string;
  label: string;
  getValue(record: T): string | null | undefined;
}

export interface ReportMeasure<T> {
  id: string;
  label: string;
  getValue(record: T): number | null | undefined;
}

export interface ReportDefinition<T> {
  id: string;
  dateOf(record: T): string | null | undefined;
  dimensions: readonly ReportDimension<T>[];
  measures: readonly ReportMeasure<T>[];
}

export type ReportFilters = Readonly<Record<string, string | readonly string[]>>;

export interface ReportOptions {
  dateRange?: ReportDateRange;
  filters?: ReportFilters;
  groupBy: ReportGroupBy;
  measureId: string;
}

export interface ReportGroup<T> {
  key: string;
  label: string;
  records: T[];
  recordCount: number;
  measuredCount: number;
  total: number;
  average: number | null;
}

export interface ReportResult<T> {
  records: T[];
  groups: ReportGroup<T>[];
  recordCount: number;
  measuredCount: number;
  total: number;
  average: number | null;
  missingDateCount: number;
}

export function reportDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (value.length > 10 && Number.isNaN(Date.parse(value))) return null;
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function resolveReportDateRange(preset: ReportDatePreset, now = new Date()): ReportDateRange | undefined {
  const today = localDateKey(now);
  if (preset === "all-time") return undefined;
  if (preset === "month-to-date") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === "year-to-date") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - 29);
  return { from: localDateKey(start), to: today };
}

function resolveDateRange(range: ReportDateRange | undefined): { from?: string; to?: string } {
  const from = range?.from === undefined ? undefined : reportDateKey(range.from);
  const to = range?.to === undefined ? undefined : reportDateKey(range.to);
  if ((range?.from !== undefined && !from) || (range?.to !== undefined && !to)) {
    throw new Error("Report date ranges must use valid YYYY-MM-DD dates.");
  }
  if (from && to && from > to) {
    throw new Error("The report start date must not be after its end date.");
  }
  return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

function timeGroupKey(date: string, unit: ReportTimeUnit): string {
  if (unit === "year") return date.slice(0, 4);
  if (unit === "month") return date.slice(0, 7);
  return date;
}

function summary<T>(records: T[], getValue: (record: T) => number | null | undefined) {
  const values = records.map(getValue).filter((value): value is number =>
    typeof value === "number" && Number.isFinite(value));
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    recordCount: records.length,
    measuredCount: values.length,
    total,
    average: values.length ? total / values.length : null,
  };
}

export function reportDimensionValues<T>(
  records: readonly T[],
  definition: ReportDefinition<T>,
  dimensionId: string,
): string[] {
  const dimension = definition.dimensions.find((candidate) => candidate.id === dimensionId);
  if (!dimension) throw new Error(`Unknown report dimension: ${dimensionId}`);
  return [...new Set(records.map((record) => dimension.getValue(record)).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  ))].sort((a, b) => a.localeCompare(b));
}

export function buildReport<T>(
  records: readonly T[],
  definition: ReportDefinition<T>,
  options: ReportOptions,
): ReportResult<T> {
  const measure = definition.measures.find((candidate) => candidate.id === options.measureId);
  if (!measure) throw new Error(`Unknown report measure: ${options.measureId}`);

  const dimensions = new Map(definition.dimensions.map((dimension) => [dimension.id, dimension]));
  const filters = Object.entries(options.filters ?? {}).map(([id, selected]) => {
    const dimension = dimensions.get(id);
    if (!dimension) throw new Error(`Unknown report dimension: ${id}`);
    return {
      dimension,
      selected: new Set(typeof selected === "string" ? [selected] : selected),
    };
  });
  const range = resolveDateRange(options.dateRange);
  const filtered = records.filter((record) => {
    if (!filters.every(({ dimension, selected }) => {
      const value = dimension.getValue(record);
      return typeof value === "string" && selected.has(value);
    })) return false;

    if (!range.from && !range.to) return true;
    const date = reportDateKey(definition.dateOf(record));
    return date !== null && (!range.from || date >= range.from) && (!range.to || date <= range.to);
  });

  const groupDimension = options.groupBy.type === "dimension"
    ? dimensions.get(options.groupBy.id)
    : undefined;
  if (options.groupBy.type === "dimension" && !groupDimension) {
    throw new Error(`Unknown report dimension: ${options.groupBy.id}`);
  }

  const groups = new Map<string, T[]>();
  for (const record of filtered) {
    let key: string;
    if (groupDimension) {
      const value = groupDimension.getValue(record);
      key = typeof value === "string" && value.length ? value : "unspecified";
    } else {
      const date = reportDateKey(definition.dateOf(record));
      key = date ? timeGroupKey(date, (options.groupBy as { type: "time"; unit: ReportTimeUnit }).unit) : "undated";
    }
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  const grouped = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  const resultGroups = grouped.map(([key, groupRecords]) => {
    const totals = summary(groupRecords, measure.getValue);
    const label = key === "undated" ? "Date not recorded"
      : key === "unspecified" ? "Not specified" : key;
    return { key, label, records: groupRecords, ...totals };
  });
  const totals = summary(filtered, measure.getValue);

  return {
    records: filtered,
    groups: resultGroups,
    ...totals,
    missingDateCount: filtered.filter((record) => reportDateKey(definition.dateOf(record)) === null).length,
  };
}
