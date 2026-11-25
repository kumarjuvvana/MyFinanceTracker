import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, BarChart3, Car, Database, Download, Fuel, Gauge, Printer, Route, ShieldCheck, Wrench,
} from "lucide-react";
import { Badge, Button, Card, DateInput, EmptyState, Field, Input, Select } from "./ui";
import { VehicleMarketValuePanel } from "./VehicleMarketValuePanel";
import {
  VEHICLE_PROFILE_TABLES,
  type VehicleProfileData,
  type VehicleProfileRow,
  type VehicleProfileTableName,
} from "../lib/databaseApi";
import { fleetCategoryLabel, isUserIdColumn, monthTargetLabel, vehicleDisplayName, vehicleNameForId, vehicleTypeLabel } from "../lib/vehicleProfilePresentation";

const LABELS: Record<VehicleProfileTableName, string> = {
  vehicles: "Vehicles",
  alerts: "Alerts",
  certificates: "Certificates",
  expenses: "Expenses",
  fuel_consumptions: "Fuel",
  insurance_policies: "Insurance",
  monthly_targets: "Monthly targets",
  odometer_logs: "Odometer",
  services: "Services",
  travel_logs: "Travel logs",
};

const DATE_COLUMNS = ["date", "fill_date", "service_date", "travel_date", "trip_date", "log_date", "recorded_at", "created_at"];
const DISTANCE_COLUMNS = ["distance", "distance_km", "distance_travelled", "total_distance", "trip_distance"];
const FUEL_QUANTITY_COLUMNS = ["fuel_quantity", "quantity", "litres", "liters", "volume"];
const FUEL_COST_COLUMNS = ["total_cost", "fuel_cost", "cost", "amount"];
const SERVICE_COST_COLUMNS = ["cost", "amount", "service_cost", "total_cost"];
const EXPENSE_COST_COLUMNS = ["amount", "cost", "total_cost"];
const VALUE_COLUMNS = ["market_value", "current_value", "purchase_value", "vehicle_value", "acquisition_cost"];
const BLUE = "#2563EB";
const TEAL = "#0D9488";
const AMBER = "#F59E0B";

type ReportName = "fleet" | "performance" | "fuel" | "maintenance" | "expenses" | "compliance" | "insurance" | "alerts" | "lifecycle";
type ReportRow = { id: string; title: string; subtitle: string; source: VehicleProfileTableName; row: VehicleProfileRow };

function firstValue(row: VehicleProfileRow, candidates: string[]): unknown {
  const key = candidates.find((candidate) => row[candidate] !== undefined && row[candidate] !== null && row[candidate] !== "");
  return key ? row[key] : undefined;
}

function asNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function formatFleetDate(value: unknown): string {
  const date = asDate(value);
  if (!date) return valueText(value);
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatFleetMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  return match
    ? new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : value;
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b[a-z]/g, (letter) => letter.toLocaleUpperCase());
}

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatNumber(value: number, fractionDigits = 1): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: fractionDigits });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function dateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateMatches(row: VehicleProfileRow, start: string, end: string): boolean {
  if (!start && !end) return true;
  const date = asDate(firstValue(row, [...DATE_COLUMNS, "due_date", "expiry_date", "valid_until"]));
  return Boolean(date) && (!start || date >= start) && (!end || date <= end);
}

function csvCell(value: unknown): string {
  const text = valueText(value);
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const content = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function aggregateBy(rows: VehicleProfileRow[], getKey: (row: VehicleProfileRow) => string, getValue: (row: VehicleProfileRow) => number) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row).trim() || "Unspecified";
    totals.set(key, (totals.get(key) ?? 0) + getValue(row));
  }
  return [...totals.entries()].sort((left, right) => right[1] - left[1]);
}

function HorizontalBars({ items, format = formatNumber, onSelect }: {
  items: Array<[string, number]>;
  format?: (value: number) => string;
  onSelect?: (label: string) => void;
}) {
  const maximum = Math.max(0, ...items.map(([, value]) => value));
  if (!items.length || maximum <= 0) {
    return <EmptyState icon={<BarChart3 size={18} />} title="Not enough recorded data" description="This chart appears when the connected profile contains matching records." />;
  }
  return <div className="fleet-bars">{items.slice(0, 7).map(([label, value], index) => <button
    type="button"
    className="fleet-bar-row"
    key={label}
    title={`${label}: ${format(value)}${onSelect ? " · Select to drill down" : ""}`}
    onClick={() => onSelect?.(label)}
    disabled={!onSelect}
  >
    <span>{label}</span>
    <span className="fleet-bar-track"><span className="fleet-bar-fill" style={{ width: `${Math.max(2, value / maximum * 100)}%`, background: index % 2 ? TEAL : BLUE }} /></span>
    <strong>{format(value)}</strong>
  </button>)}</div>;
}

export function VehicleFleetIntelligence({ data, onOpenTable, onSaveMarketValue }: {
  data: VehicleProfileData;
  onOpenTable: (table: VehicleProfileTableName) => void;
  onSaveMarketValue: (vehicle: VehicleProfileRow, value: number | null) => Promise<void>;
}) {
  const [period, setPeriod] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [vehicleId, setVehicleId] = useState("all");
  const [manufacturer, setManufacturer] = useState("all");
  const [category, setCategory] = useState("all");
  const [model, setModel] = useState("all");
  const [report, setReport] = useState<ReportName>("fleet");
  const [search, setSearch] = useState("");
  const [reportFilterColumn, setReportFilterColumn] = useState("");
  const [reportFilterValue, setReportFilterValue] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const tables = useMemo(() => new Map(data.tables.map((table) => [table.name, table])), [data.tables]);
  const sourceRows = (name: VehicleProfileTableName) => tables.get(name)?.rows ?? [];
  const vehiclesAll = sourceRows("vehicles");
  const manufacturerColumn = tables.get("vehicles")?.columns.find((column) => ["manufacturer", "make", "brand"].includes(column.name));
  const categoryColumn = tables.get("vehicles")?.columns.find((column) => ["category", "type", "vehicle_type"].includes(column.name));
  const modelColumn = tables.get("vehicles")?.columns.find((column) => ["model", "vehicle_model"].includes(column.name));
  const manufacturerOptions = manufacturerColumn
    ? [...new Set(vehiclesAll.map((vehicle) => valueText(vehicle[manufacturerColumn.name])).filter((value) => value !== "—"))].sort()
    : [];
  const categoryOptions = categoryColumn
    ? [...new Set(vehiclesAll.map((vehicle) => vehicleTypeLabel(vehicle[categoryColumn.name])).filter((value) => value !== "—"))].sort()
    : [];
  const modelOptions = modelColumn
    ? [...new Set(vehiclesAll.map((vehicle) => valueText(vehicle[modelColumn.name])).filter((value) => value !== "—"))].sort()
    : [];
  const inferredFrom = period === "all" ? "" : dateOffset(Number(period));
  const start = fromDate || inferredFrom;
  const end = toDate;
  const selectedVehicles = vehiclesAll.filter((vehicle) =>
    (vehicleId === "all" || String(vehicle.id) === vehicleId) &&
    (manufacturer === "all" || valueText(vehicle[manufacturerColumn?.name ?? ""]) === manufacturer) &&
    (category === "all" || vehicleTypeLabel(vehicle[categoryColumn?.name ?? ""]) === category) &&
    (model === "all" || valueText(vehicle[modelColumn?.name ?? ""]) === model));
  const selectedVehicleIds = new Set(selectedVehicles.map((vehicle) => String(vehicle.id)));
  const hasVehicleFilter = vehicleId !== "all" || manufacturer !== "all" || category !== "all" || model !== "all";

  function filterRecords(name: VehicleProfileTableName): VehicleProfileRow[] {
    return sourceRows(name).filter((row) => {
      const hasVehicleLink = row.vehicle_id !== undefined && row.vehicle_id !== null;
      const vehicleMatches = name === "vehicles"
        ? selectedVehicles.some((vehicle) => String(vehicle.id) === String(row.id))
        : !hasVehicleFilter || hasVehicleLink && selectedVehicleIds.has(String(row.vehicle_id));
      const rangeMatches = name === "vehicles" || name === "monthly_targets" ? true : dateMatches(row, start, end);
      return vehicleMatches && rangeMatches;
    });
  }

  const trips = filterRecords("travel_logs");
  const fuel = filterRecords("fuel_consumptions");
  const services = filterRecords("services");
  const expenses = filterRecords("expenses");
  const odometer = filterRecords("odometer_logs");
  const alerts = filterRecords("alerts");
  const certificates = filterRecords("certificates");
  const insurance = filterRecords("insurance_policies");
  const activityRecordCount = trips.length + fuel.length + services.length + expenses.length + odometer.length;
  const totalDistance = trips.reduce((sum, row) => sum + (asNumber(firstValue(row, DISTANCE_COLUMNS)) ?? 0), 0);
  const fuelVolume = fuel.reduce((sum, row) => sum + (asNumber(firstValue(row, FUEL_QUANTITY_COLUMNS)) ?? 0), 0);
  const fuelCost = fuel.reduce((sum, row) => sum + (asNumber(firstValue(row, FUEL_COST_COLUMNS)) ?? 0), 0);
  const mileageRows = fuel.map((row) => asNumber(row.mileage)).filter((value): value is number => value !== null);
  const averageMileage = mileageRows.length ? mileageRows.reduce((sum, value) => sum + value, 0) / mileageRows.length : null;
  const serviceCost = services.reduce((sum, row) => sum + (asNumber(firstValue(row, SERVICE_COST_COLUMNS)) ?? 0), 0);
  const expenseCost = expenses.reduce((sum, row) => sum + (asNumber(firstValue(row, EXPENSE_COST_COLUMNS)) ?? 0), 0);
  const fleetValueColumn = tables.get("vehicles")?.columns.find((column) => VALUE_COLUMNS.includes(column.name));
  const recordedVehicleValues = fleetValueColumn
    ? selectedVehicles.map((vehicle) => asNumber(vehicle[fleetValueColumn.name])).filter((value): value is number => value !== null)
    : [];
  const fleetValue = recordedVehicleValues.length
    ? recordedVehicleValues.reduce((sum, value) => sum + value, 0)
    : null;
  const latestOdometer = odometer.reduce((maximum, row) => Math.max(maximum, asNumber(firstValue(row, ["reading", "odometer", "odometer_reading"])) ?? 0), 0);
  const hasOdometerData = (tables.get("odometer_logs")?.columns ?? []).some((column) => ["reading", "odometer", "odometer_reading"].includes(column.name));
  const activeVehicleCount = new Set(trips.map((row) => String(row.vehicle_id))
    .filter((id) => id !== "undefined" && id !== "null" && selectedVehicleIds.has(id))).size;
  const dueItems = [
    ...alerts.map((row) => ({ kind: "Alert", label: valueText(firstValue(row, ["title", "name", "description"])), due: asDate(firstValue(row, ["due_date", "expiry_date"])) })),
    ...certificates.map((row) => ({ kind: "Certificate", label: valueText(firstValue(row, ["certificate_number", "name", "type"])), due: asDate(firstValue(row, ["due_date", "expiry_date", "valid_until"])) })),
    ...insurance.map((row) => ({ kind: "Insurance", label: valueText(firstValue(row, ["provider", "policy_number", "name"])), due: asDate(firstValue(row, ["due_date", "expiry_date", "valid_until"])) })),
  ].filter((item) => item.due && item.due >= dateOffset(0) && item.due <= dateOffset(30))
    .sort((left, right) => left.due.localeCompare(right.due));

  const monthlyFuel = aggregateBy(fuel.filter((row) => asDate(firstValue(row, ["fill_date", ...DATE_COLUMNS]))),
    (row) => asDate(firstValue(row, ["fill_date", ...DATE_COLUMNS])).slice(0, 7),
    (row) => asNumber(firstValue(row, FUEL_COST_COLUMNS)) ?? 0);
  const manufacturerMix = manufacturerColumn
    ? aggregateBy(selectedVehicles, (row) => valueText(row[manufacturerColumn.name]), () => 1)
    : [];
  const categoryMix = categoryColumn
    ? aggregateBy(selectedVehicles, (row) => vehicleTypeLabel(row[categoryColumn.name]), () => 1)
    : [];
  const modelMix = modelColumn
    ? aggregateBy(selectedVehicles, (row) => valueText(row[modelColumn.name]), () => 1)
    : [];
  const fuelByVehicle = aggregateBy(fuel, (row) => {
    const vehicle = vehiclesAll.find((entry) => String(entry.id) === String(row.vehicle_id));
    return vehicle ? vehicleDisplayName(vehicle) : "Vehicle not linked";
  }, (row) => asNumber(firstValue(row, FUEL_QUANTITY_COLUMNS)) ?? 0);
  const distanceByVehicle = aggregateBy(trips, (row) => {
    const vehicle = vehiclesAll.find((entry) => String(entry.id) === String(row.vehicle_id));
    return vehicle ? vehicleDisplayName(vehicle) : "Vehicle not linked";
  }, (row) => asNumber(firstValue(row, DISTANCE_COLUMNS)) ?? 0);
  const serviceByVehicle = aggregateBy(services, (row) => {
    const vehicle = vehiclesAll.find((entry) => String(entry.id) === String(row.vehicle_id));
    return vehicle ? vehicleDisplayName(vehicle) : "Vehicle not linked";
  }, (row) => asNumber(firstValue(row, SERVICE_COST_COLUMNS)) ?? 0);
  const monthlyServices = aggregateBy(services.filter((row) => asDate(firstValue(row, ["service_date", ...DATE_COLUMNS]))),
    (row) => asDate(firstValue(row, ["service_date", ...DATE_COLUMNS])).slice(0, 7),
    (row) => asNumber(firstValue(row, SERVICE_COST_COLUMNS)) ?? 0);
  const monthlyExpenses = aggregateBy(expenses.filter((row) => asDate(firstValue(row, DATE_COLUMNS))),
    (row) => asDate(firstValue(row, DATE_COLUMNS)).slice(0, 7),
    (row) => asNumber(firstValue(row, EXPENSE_COST_COLUMNS)) ?? 0);
  const serviceCostAverage = selectedVehicles.length ? serviceCost / selectedVehicles.length : 0;
  const highestServiceSpend = serviceByVehicle[0];

  const reportConfigs: Record<ReportName, { title: string; source: VehicleProfileTableName }> = {
    fleet: { title: "Fleet summary", source: "vehicles" },
    performance: { title: "Vehicle performance", source: "travel_logs" },
    fuel: { title: "Fuel consumption", source: "fuel_consumptions" },
    maintenance: { title: "Maintenance costs", source: "services" },
    expenses: { title: "Operating expenses", source: "expenses" },
    compliance: { title: "Certificates", source: "certificates" },
    insurance: { title: "Insurance policies", source: "insurance_policies" },
    alerts: { title: "Vehicle alerts", source: "alerts" },
    lifecycle: { title: "Vehicle lifecycle", source: "odometer_logs" },
  };
  const reportSource = reportConfigs[report].source;
  const reportTable = tables.get(reportSource);
  const reportRows: ReportRow[] = filterRecords(reportSource).map((row) => ({
    id: `${reportSource}-${String(row.id)}`,
    title: valueText(firstValue(row, ["name", "title", "description", "registration_number", "certificate_number"])) === "—"
      ? reportSource === "vehicles" ? vehicleDisplayName(row) : row.vehicle_id !== undefined
        ? vehicleNameForId(vehiclesAll, row.vehicle_id)
        : `${LABELS[reportSource]} record`
      : valueText(firstValue(row, ["name", "title", "description", "registration_number", "certificate_number"])),
    subtitle: asDate(firstValue(row, DATE_COLUMNS))
      ? formatFleetDate(firstValue(row, DATE_COLUMNS))
      : "No date recorded",
    source: reportSource,
    row,
  })).filter((item) => {
    const term = search.trim().toLocaleLowerCase();
    const searchableColumns = (reportTable?.columns ?? []).filter((column) => !reportTable?.primaryKey.includes(column.name) && !column.name.endsWith("_at") && !isUserIdColumn(column));
    const matchesSearch = !term || searchableColumns.some((column) => {
      const value = column.name.toLocaleLowerCase() === "vehicle_id"
        ? vehicleNameForId(vehiclesAll, item.row[column.name])
        : reportSource === "vehicles" && categoryColumn?.name === column.name
          ? vehicleTypeLabel(item.row[column.name])
          : valueText(item.row[column.name]);
      return value.toLocaleLowerCase().includes(term);
    });
    const filterValue = reportFilterValue.trim().toLocaleLowerCase();
    const fieldValue = reportFilterColumn
      ? reportFilterColumn.toLocaleLowerCase() === "vehicle_id"
        ? vehicleNameForId(vehiclesAll, item.row[reportFilterColumn]).toLocaleLowerCase()
        : reportSource === "vehicles" && categoryColumn?.name === reportFilterColumn
          ? vehicleTypeLabel(item.row[reportFilterColumn]).toLocaleLowerCase()
          : valueText(item.row[reportFilterColumn]).toLocaleLowerCase()
      : "";
    const matchesColumn = !filterValue || Boolean(reportFilterColumn) && fieldValue.includes(filterValue);
    return matchesSearch && matchesColumn;
  });
  const allReportColumns = reportTable?.columns.filter((column) => !reportTable.primaryKey.includes(column.name) && !column.name.endsWith("_at") && !isUserIdColumn(column)) ?? [];
  const reportColumnLabel = (name: string) => name.toLocaleLowerCase() === "vehicle_id" ? "Vehicle" : humanize(name);
  const reportColumnValue = (row: VehicleProfileRow, name: string) => name.toLocaleLowerCase() === "vehicle_id"
    ? vehicleNameForId(vehiclesAll, row[name])
    : reportSource === "monthly_targets" && name.toLocaleLowerCase() === "month"
      ? monthTargetLabel(row[name]) ?? row[name]
      : fleetCategoryLabel(reportSource, name, row[name]) ?? (reportSource === "vehicles" && categoryColumn?.name === name
        ? vehicleTypeLabel(row[name])
        : row[name]);
  const reportColumns = visibleColumns.length
    ? allReportColumns.filter((column) => visibleColumns.includes(column.name))
    : allReportColumns;
  const activeSortKey = reportColumns.some((column) => column.name === sortKey) ? sortKey : reportColumns[0]?.name ?? "id";
  const sortColumn = reportColumns.find((column) => column.name === activeSortKey);
  const sortedReportRows = [...reportRows].sort((left, right) => {
    const leftValue = reportColumnValue(left.row, activeSortKey);
    const rightValue = reportColumnValue(right.row, activeSortKey);
    const result = sortColumn?.dataType.match(/int|numeric|double|real|decimal/) && asNumber(leftValue) !== null && asNumber(rightValue) !== null
      ? (asNumber(leftValue) ?? 0) - (asNumber(rightValue) ?? 0)
      : String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, { numeric: true, sensitivity: "base" });
    return (sortDirection === "asc" ? 1 : -1) * result;
  });
  const pageCount = Math.max(1, Math.ceil(sortedReportRows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleReportRows = sortedReportRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const summaryColumns = reportColumns.map((column) => {
    const canSummarize = /int|numeric|double|real|decimal/.test(column.dataType) &&
      /amount|cost|distance|quantity|fuel|reading|mileage|value|total/i.test(column.name) &&
      column.name !== "id";
    const values = canSummarize
      ? sortedReportRows.map((item) => asNumber(item.row[column.name])).filter((value): value is number => value !== null)
      : [];
    return {
      name: column.name,
      total: values.reduce((sum, value) => sum + value, 0),
      average: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    };
  });
  const hasFuelData = (tables.get("fuel_consumptions")?.rows.length ?? 0) > 0;
  const hasDistanceData = (tables.get("travel_logs")?.columns ?? []).some((column) => DISTANCE_COLUMNS.includes(column.name));
  const hasServiceCost = (tables.get("services")?.columns ?? []).some((column) => SERVICE_COST_COLUMNS.includes(column.name));
  const hasExpenseCost = (tables.get("expenses")?.columns ?? []).some((column) => EXPENSE_COST_COLUMNS.includes(column.name));
  const hasDriverData = VEHICLE_PROFILE_TABLES.some((name) => (tables.get(name)?.columns ?? []).some((column) => ["driver_id", "driver_name"].includes(column.name)));
  const availableCount = activeVehicleCount;
  const activityPercent = selectedVehicles.length ? Math.round(availableCount / selectedVehicles.length * 100) : 0;

  function exportReport(excelCompatible: boolean) {
    const columns = reportColumns;
    const rows = sortedReportRows.map((item) => columns.map((column) => reportColumnValue(item.row, column.name)));
    downloadCsv(`${report}-${new Date().toISOString().slice(0, 10)}${excelCompatible ? "-excel" : ""}.csv`, columns.map((column) => reportColumnLabel(column.name)), rows);
  }

  return <div className="fleet-dashboard">
    <section className="fleet-header">
      <div><p className="eyebrow">RIDERTRACKER · FLEET INTELLIGENCE</p><h2>Advanced reports & analytics</h2><p>Management insights from records available in the connected profile. Missing measures are clearly marked rather than estimated.</p></div>
      <div className="fleet-header-actions"><Badge tone="blue">{selectedVehicles.length} vehicles in scope</Badge><Button type="button" variant="outline" onClick={() => onOpenTable("vehicles")}><Database size={14} />Vehicle records</Button><Button type="button" variant="outline" onClick={() => window.print()}><Printer size={14} />Print / PDF</Button></div>
    </section>

    <Card className="fleet-filter-panel">
      <div className="fleet-filter-heading"><div><h3>Report filters</h3><p>Applied across the analytics and detailed report.</p></div><Button type="button" variant="ghost" size="sm" onClick={() => { setPeriod("all"); setFromDate(""); setToDate(""); setVehicleId("all"); setManufacturer("all"); setCategory("all"); setModel("all"); setPage(0); }}>Reset</Button></div>
      <div className="fleet-filters">
        <Field label="Period"><Select value={period} onChange={(event) => { setPeriod(event.target.value); setFromDate(""); setToDate(""); setPage(0); }}><option value="all">All available records</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></Select></Field>
        <Field label="From"><DateInput value={fromDate} max={toDate || undefined} onValueChange={(value) => { setFromDate(value); setPeriod("all"); setPage(0); }} /></Field>
        <Field label="To"><DateInput value={toDate} min={fromDate || undefined} onValueChange={(value) => { setToDate(value); setPeriod("all"); setPage(0); }} /></Field>
        <Field label="Vehicle"><Select value={vehicleId} onChange={(event) => { setVehicleId(event.target.value); setPage(0); }}><option value="all">All vehicles</option>{vehiclesAll.map((vehicle) => <option key={String(vehicle.id)} value={String(vehicle.id)}>{vehicleDisplayName(vehicle)}</option>)}</Select></Field>
        {manufacturerColumn && <Field label="Manufacturer"><Select value={manufacturer} onChange={(event) => { setManufacturer(event.target.value); setPage(0); }}><option value="all">All manufacturers</option>{manufacturerOptions.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>}
        {categoryColumn && <Field label="Recorded type"><Select value={category} onChange={(event) => { setCategory(event.target.value); setPage(0); }}><option value="all">All recorded types</option>{categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>}
        {modelColumn && <Field label="Model"><Select value={model} onChange={(event) => { setModel(event.target.value); setPage(0); }}><option value="all">All models</option>{modelOptions.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>}
        <p className="fleet-filter-note">Location, driver, and department filters are unavailable because these fields are not present in the selected profile.</p>
      </div>
    </Card>
    {!activityRecordCount && <div className="fleet-period-empty" role="status"><AlertTriangle size={15} /><span>{period === "all" && !fromDate && !toDate
      ? "No dated activity records are available for this vehicle selection."
      : <>No dated activity records match this period and vehicle selection. Choose <strong>All available records</strong> or set a custom date range to view historical activity.</>}</span></div>}

    <div className="fleet-kpis">
      <Kpi icon={<Car size={17} />} label="Total vehicles" value={String(selectedVehicles.length)} note="Saved fleet records" color={BLUE} />
      <Kpi icon={<Route size={17} />} label="Vehicles with trips" value={`${activeVehicleCount}`} note={`${activityPercent}% trip coverage · selected period`} color={TEAL} />
      <Kpi icon={<Gauge size={17} />} label="Distance travelled" value={hasDistanceData ? `${formatNumber(totalDistance)} km` : "Unavailable"} note={hasDistanceData ? `${trips.length} travel records` : "No distance field in profile"} color={BLUE} />
      <Kpi icon={<Fuel size={17} />} label="Fuel expenses" value={hasFuelData ? formatCurrency(fuelCost) : "No records"} note={hasFuelData ? `${formatNumber(fuelVolume)} L recorded` : "No fuel records available"} color={AMBER} />
      <Kpi icon={<Gauge size={17} />} label="Average recorded mileage" value={averageMileage === null ? "Unavailable" : `${formatNumber(averageMileage, 2)} km/L`} note={averageMileage === null ? "No mileage values recorded" : `${mileageRows.length} fuel records`} color={TEAL} />
      <Kpi icon={<Wrench size={17} />} label="Maintenance expenses" value={hasServiceCost ? formatCurrency(serviceCost) : "Unavailable"} note={`${services.length} service records`} color="#7C3AED" />
      <Kpi icon={<BarChart3 size={17} />} label="Other expenses" value={hasExpenseCost ? formatCurrency(expenseCost) : "Unavailable"} note={`${expenses.length} expense records · separate category`} color="#0F766E" />
      <Kpi icon={<ShieldCheck size={17} />} label="Recorded vehicle value" value={fleetValue === null ? "Unavailable" : formatCurrency(fleetValue)} note={fleetValueColumn ? `From ${humanize(fleetValueColumn.name)}` : "No valuation field available"} color={BLUE} />
      <Kpi icon={<Gauge size={17} />} label="Latest odometer" value={hasOdometerData ? `${formatNumber(latestOdometer)} km` : "Unavailable"} note={`${odometer.length} odometer records`} color="#0F766E" />
      <Kpi icon={<AlertTriangle size={17} />} label="Due in 30 days" value={String(dueItems.length)} note="Alerts, certificates & insurance" color={dueItems.length ? AMBER : "#16A34A"} />
    </div>
    <VehicleMarketValuePanel
      vehicles={selectedVehicles}
      marketValueColumnAvailable={(tables.get("vehicles")?.columns ?? []).some((column) => column.name.toLocaleLowerCase() === "market_value")}
      onSave={onSaveMarketValue}
    />
    <p className="fleet-data-note">Fuel, services, and expense totals are shown separately; they may overlap in the source records and are not combined into a potentially double-counted total. No previous-period comparison or availability percentage is shown because the profile does not provide verified status history.</p>

    <div className="fleet-chart-grid">
      <ChartCard title="Fleet by manufacturer" subtitle={manufacturerColumn ? `Grouped by ${humanize(manufacturerColumn.name)}` : "Manufacturer field not available"} icon={<Car size={16} />}>
        {manufacturerMix.length ? <HorizontalBars items={manufacturerMix} format={(value) => `${formatNumber(value, 0)} vehicles`} /> : <Unavailable title="Manufacturer breakdown unavailable" detail="The linked vehicles table has no manufacturer field." />}
      </ChartCard>
      <ChartCard title="Fleet by recorded type" subtitle={categoryColumn ? `Stored values from ${humanize(categoryColumn.name)}` : "Category field not available"} icon={<BarChart3 size={16} />}>
        {categoryMix.length ? <HorizontalBars items={categoryMix} format={(value) => `${formatNumber(value, 0)} vehicles`} /> : <Unavailable title="Vehicle category unavailable" detail="The table records a type code; its label map is not available, so category names are not inferred." />}
      </ChartCard>
      <ChartCard title="Fleet by model" subtitle={modelColumn ? `Grouped by ${humanize(modelColumn.name)}` : "Model field not available"} icon={<Car size={16} />}>
        {modelMix.length ? <HorizontalBars items={modelMix} format={(value) => `${formatNumber(value, 0)} vehicles`} /> : <Unavailable title="Model breakdown unavailable" detail="No model values are available in the linked vehicles table." />}
      </ChartCard>
      <ChartCard title="Distance by vehicle" subtitle={`${trips.length} travel logs in selected date range`} icon={<Route size={16} />}>
        {hasDistanceData ? <HorizontalBars items={distanceByVehicle} format={(value) => `${formatNumber(value)} km`} onSelect={(label) => {
          const found = vehiclesAll.find((vehicle) => vehicleDisplayName(vehicle) === label);
          if (found) setVehicleId(String(found.id));
        }} /> : <Unavailable title="Distance data unavailable" detail="Travel logs do not expose a recognized distance field." />}
      </ChartCard>
      <ChartCard title="Fuel spend by month" subtitle="Actual recorded fuel cost · selected period" icon={<Fuel size={16} />}>
        {hasFuelData && monthlyFuel.length ? <HorizontalBars items={[...monthlyFuel].reverse().map(([month, value]): [string, number] => [formatFleetMonth(month), value])} format={formatCurrency} /> : <Unavailable title="Fuel cost history unavailable" detail="No fuel records with dates and cost values are available in this period." />}
      </ChartCard>
      <ChartCard title="Fuel consumption by vehicle" subtitle="Recorded quantity · selected period" icon={<Fuel size={16} />}>
        {fuelVolume > 0 ? <HorizontalBars items={fuelByVehicle} format={(value) => `${formatNumber(value)} L`} /> : <Unavailable title="Fuel quantities unavailable" detail="The selected records do not contain a recognized fuel quantity." />}
      </ChartCard>
      <ChartCard title="Maintenance cost by vehicle" subtitle="Service costs, kept separate from general expenses" icon={<Wrench size={16} />}>
        {hasServiceCost ? <HorizontalBars items={serviceByVehicle} format={formatCurrency} onSelect={(label) => {
          const found = vehiclesAll.find((vehicle) => vehicleDisplayName(vehicle) === label);
          if (found) setVehicleId(String(found.id));
        }} /> : <Unavailable title="Maintenance cost unavailable" detail="Service cost is not recorded in the connected profile." />}
      </ChartCard>
      <ChartCard title="Maintenance spend by month" subtitle="Recorded service dates and costs · selected period" icon={<Wrench size={16} />}>
        {hasServiceCost && monthlyServices.length ? <HorizontalBars items={[...monthlyServices].reverse().map(([month, value]): [string, number] => [formatFleetMonth(month), value])} format={formatCurrency} /> : <Unavailable title="Maintenance trend unavailable" detail="No dated service cost records are available in this period." />}
      </ChartCard>
      <ChartCard title="Other expenses by month" subtitle="Recorded expenses, shown separately from fuel and services" icon={<BarChart3 size={16} />}>
        {hasExpenseCost && monthlyExpenses.length ? <HorizontalBars items={[...monthlyExpenses].reverse().map(([month, value]): [string, number] => [formatFleetMonth(month), value])} format={formatCurrency} /> : <Unavailable title="Expense trend unavailable" detail="No dated expense amounts are available in this period." />}
      </ChartCard>
      <ChartCard title="Driver performance" subtitle="Driver metrics require linked driver records" icon={<Gauge size={16} />}>
        {hasDriverData
          ? <Unavailable title="Driver attribution is incomplete" detail="Driver columns exist, but no dedicated driver registry or verified performance fields are available." />
          : <Unavailable title="No driver data available" detail="The connected RiderTracker tables do not include driver assignments. No driver rankings are fabricated." />}
      </ChartCard>
    </div>

    <Card className="fleet-insights-card">
      <div className="fleet-card-head"><span className="fleet-card-icon"><BarChart3 size={16} /></span><div><h3>Management insights</h3><p>Observations derived from the filtered records; no predictive or estimated values are included.</p></div></div>
      <div className="fleet-insights">
        {dueItems.length > 0 && <div className="fleet-insight fleet-insight-warning"><Badge tone="amber">{dueItems.length} due soon</Badge><span>{dueItems.length} alert, certificate, or insurance record has a due date within 30 days.</span></div>}
        {highestServiceSpend && highestServiceSpend[1] > 0 && serviceCostAverage > 0 &&
          <div className="fleet-insight"><Badge tone="blue">Maintenance</Badge><span>{highestServiceSpend[0]} has the highest recorded service spend ({formatCurrency(highestServiceSpend[1])}) in this selection. The fleet-wide average is {formatCurrency(serviceCostAverage)} per vehicle.</span></div>}
        {trips.length > 0 && <div className="fleet-insight"><Badge tone="green">Travel activity</Badge><span>{formatNumber(totalDistance)} km recorded across {trips.length} travel logs; {activeVehicleCount} vehicle(s) have linked trip records in the selected period.</span></div>}
        {!dueItems.length && !trips.length && !(highestServiceSpend && highestServiceSpend[1] > 0) &&
          <Unavailable title="No actionable insight yet" detail="Add travel, service, or due-date records to generate evidence-based management insights." />}
      </div>
    </Card>

    <div className="fleet-detail-grid">
      <ChartCard title="Compliance & upcoming dates" subtitle="Actual due dates recorded in RiderTracker" icon={<ShieldCheck size={16} />}>
        {dueItems.length ? <div className="fleet-due-list">{dueItems.slice(0, 8).map((item, index) => <div className="fleet-due-row" key={`${item.kind}-${index}`}><span className="fleet-due-dot" /><div><strong>{item.label}</strong><small>{item.kind} · {formatFleetDate(item.due)}</small></div><Badge tone="amber">Due soon</Badge></div>)}</div> : <Unavailable title="No upcoming expirations found" detail="No matching alert, certificate, or insurance due dates within 30 days." />}
      </ChartCard>
      <ChartCard title="Fleet availability & utilization" subtitle="Availability requires explicit active/maintenance status and time-at-work data" icon={<Gauge size={16} />}>
        <Unavailable title={`${activeVehicleCount} vehicles have recorded trips`} detail={`Trip coverage is ${activityPercent}% in this period. Trip coverage is not the same as vehicle utilization or availability; the source profile has no verified downtime/status denominator.`} />
        {(tables.get("vehicles")?.columns ?? []).some((column) => ["status", "active", "is_active"].includes(column.name)) &&
          <div className="fleet-insight"><Badge tone="blue">Status field available</Badge><span>Review stored status codes in the Vehicles table; this dashboard does not assign meanings to undocumented codes.</span></div>}
      </ChartCard>
    </div>

    <Card className="fleet-report-card">
      <div className="fleet-report-head">
        <div><p className="eyebrow">MANAGEMENT REPORT</p><h3>Detailed report table</h3><p>Search, sort, page, export, or print the selected profile records.</p></div>
        <div className="fleet-export-actions"><Button type="button" variant="outline" disabled={!sortedReportRows.length} onClick={() => exportReport(false)}><Download size={14} />CSV</Button><Button type="button" variant="outline" disabled={!sortedReportRows.length} onClick={() => exportReport(true)}><Download size={14} />Excel CSV</Button></div>
      </div>
      <div className="fleet-report-controls">
        <Field label="Report"><Select value={report} onChange={(event) => { setReport(event.target.value as ReportName); setSearch(""); setReportFilterColumn(""); setReportFilterValue(""); setVisibleColumns([]); setSortKey(""); setPage(0); }}>{Object.entries(reportConfigs).map(([key, config]) => <option key={key} value={key}>{config.title}</option>)}</Select></Field>
        <div className="search-wrap"><Input aria-label="Search management report" placeholder="Search report records..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></div>
        <Button type="button" variant="outline" onClick={() => window.print()}><Printer size={14} />Print / PDF</Button>
      </div>
      <div className="fleet-report-extra-filters">
        <Field label="Filter column"><Select value={reportFilterColumn} onChange={(event) => { setReportFilterColumn(event.target.value); setPage(0); }}><option value="">All columns</option>{allReportColumns.map((column) => <option value={column.name} key={column.name}>{reportColumnLabel(column.name)}</option>)}</Select></Field>
        <Field label="Column value"><Input value={reportFilterValue} onChange={(event) => { setReportFilterValue(event.target.value); setPage(0); }} placeholder="Contains..." /></Field>
        <details className="fleet-column-visibility"><summary>Columns ({reportColumns.length} of {allReportColumns.length})</summary><div>{allReportColumns.map((column) => {
          const current = visibleColumns.length ? visibleColumns : allReportColumns.map((entry) => entry.name);
          const checked = current.includes(column.name);
          return <label key={column.name}><input type="checkbox" checked={checked} onChange={(event) => {
            const next = event.target.checked
              ? [...current, column.name]
              : current.filter((name) => name !== column.name);
            if (next.length) setVisibleColumns(next);
          }} />{reportColumnLabel(column.name)}</label>;
        })}</div></details>
      </div>
      {reportTable && reportColumns.length && visibleReportRows.length
        ? <div className="fleet-report-table-wrap"><table className="fleet-report-table"><thead><tr>{reportColumns.map((column) => <th key={column.name}><button type="button" onClick={() => {
          if (sortKey === column.name) setSortDirection(sortDirection === "asc" ? "desc" : "asc");
          else { setSortKey(column.name); setSortDirection("asc"); }
          setPage(0);
        }}>{reportColumnLabel(column.name)}{activeSortKey === column.name ? sortDirection === "asc" ? " ↑" : " ↓" : ""}</button></th>)}</tr></thead>
          <tbody>{visibleReportRows.map((item) => <tr key={item.id}>{reportColumns.map((column) => <td key={column.name}>{column.dataType === "date" || column.dataType.startsWith("timestamp")
            ? formatFleetDate(reportColumnValue(item.row, column.name))
            : valueText(reportColumnValue(item.row, column.name))}</td>)}</tr>)}</tbody>
          <tfoot>
            <tr><th>Filtered total</th>{reportColumns.slice(1).map((column) => {
              const summary = summaryColumns.find((entry) => entry.name === column.name);
              const formatted = summary && /amount|cost|value/i.test(column.name) ? formatCurrency(summary.total) : summary ? formatNumber(summary.total, 2) : "—";
              return <td key={column.name}>{summary && summary.total !== 0 ? formatted : "—"}</td>;
            })}</tr>
            <tr><th>Average</th>{reportColumns.slice(1).map((column) => {
              const summary = summaryColumns.find((entry) => entry.name === column.name);
              const formatted = summary?.average === null || summary?.average === undefined
                ? "—"
                : /amount|cost|value/i.test(column.name) ? formatCurrency(summary.average) : formatNumber(summary.average, 2);
              return <td key={column.name}>{formatted}</td>;
            })}</tr>
          </tfoot>
        </table></div>
        : <EmptyState icon={<BarChart3 size={18} />} title={reportRows.length ? "No matching records" : `${reportConfigs[report].title} unavailable`} description={reportRows.length ? "Try a different search." : "No records are available for this report and filter selection."} />}
      <div className="fleet-report-pagination"><span>Rows {sortedReportRows.length ? currentPage * pageSize + 1 : 0}–{Math.min((currentPage + 1) * pageSize, sortedReportRows.length)} of {sortedReportRows.length}</span><div><Field label="Rows"><Select aria-label="Report rows per page" value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}><option value="10">10</option><option value="25">25</option><option value="50">50</option></Select></Field><Button size="sm" variant="outline" type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>{currentPage + 1} / {pageCount}</span><Button size="sm" variant="outline" type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div>
      {reportTable?.truncated && <p className="fleet-footnote">Report table uses the first 1,000 loaded records. Database Manager can inspect larger tables in pages.</p>}
    </Card>

    <div className="fleet-footer-note"><AlertTriangle size={15} /><span>This dashboard analyzes records loaded from the assigned profile. Counts and totals use available rows only; table truncation warnings are shown above the dashboard. Maps, driver registry, prior-period snapshots, registration status, depreciation, and profitability data are not available in the current schema.</span></div>
  </div>;
}

function Kpi({ icon, label, value, note, color }: { icon: ReactNode; label: string; value: string; note: string; color: string }) {
  return <Card className="fleet-kpi"><span className="fleet-kpi-icon" style={{ color, background: `${color}12` }}>{icon}</span><span className="fleet-kpi-label">{label}</span><strong>{value}</strong><small>{note}</small></Card>;
}

function ChartCard({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: ReactNode; children: ReactNode }) {
  return <Card className="fleet-chart-card"><div className="fleet-card-head"><span className="fleet-card-icon">{icon}</span><div><h3>{title}</h3><p>{subtitle}</p></div></div>{children}</Card>;
}

function Unavailable({ title, detail }: { title: string; detail: string }) {
  return <div className="fleet-unavailable"><BarChart3 size={18} /><strong>{title}</strong><span>{detail}</span></div>;
}
