import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, BarChart3, Bell, Car, ChevronDown, Copy, Database, Eye, Fuel, Gauge, Grid2X2, LayoutDashboard, List, LockKeyhole, Pencil, Plus, RefreshCw, Search, ShieldCheck, Table2, Trash2, Wallet, Wrench, X } from "lucide-react";
import { Badge, Button, Card, DateInput, EmptyState, Field, FilterDrawer, Input, Select } from "./ui";
import { loadSavedProfileVehicleData, mutateSavedProfileVehicleRecord, type VehicleProfileColumn, type VehicleProfileData, type VehicleProfileRow, type VehicleProfileTable, type VehicleProfileTableName } from "../lib/databaseApi";
import { loadDatabaseConnectionVault } from "../lib/databaseConnectionsApi";
import { decryptDatabaseConnectionProfiles, type DatabaseConnectionProfile } from "../lib/databaseConnectionProfiles";
import { vehicleDisplayName, vehicleNameForId, vehicleTypeLabel } from "../lib/vehicleProfilePresentation";
import { VehicleFleetIntelligence } from "./VehicleFleetIntelligence";

const TABLE_LABELS: Record<VehicleProfileTableName, string> = {
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
type FleetModuleId = "overview" | "vehicles" | "operations" | "maintenance" | "finance" | "compliance" | "reports";
type VehicleView = "grid" | "table" | "list";
type FleetPage = "overview" | "reports" | "fleet-intelligence" | VehicleProfileTableName;
const FLEET_MODULES: { id: FleetModuleId; label: string; icon: typeof Car; entries: { label: string; table: FleetPage }[] }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, entries: [{ label: "Fleet dashboard", table: "overview" }] },
  { id: "vehicles", label: "Vehicles", icon: Car, entries: [{ label: "Vehicle registry", table: "vehicles" }] },
  { id: "operations", label: "Operations", icon: Gauge, entries: [{ label: "Odometer", table: "odometer_logs" }, { label: "Travel logs", table: "travel_logs" }] },
  { id: "maintenance", label: "Maintenance", icon: Wrench, entries: [{ label: "Services", table: "services" }, { label: "Alerts", table: "alerts" }] },
  { id: "finance", label: "Finance", icon: Wallet, entries: [{ label: "Expenses", table: "expenses" }, { label: "Fuel", table: "fuel_consumptions" }, { label: "Monthly targets", table: "monthly_targets" }] },
  { id: "compliance", label: "Compliance", icon: ShieldCheck, entries: [{ label: "Insurance", table: "insurance_policies" }, { label: "Certificates", table: "certificates" }] },
  { id: "reports", label: "Reports & Analytics", icon: BarChart3, entries: [{ label: "Reports & analytics", table: "reports" }, { label: "Fleet Intelligence", table: "fleet-intelligence" }] },
];
const VEHICLES_SESSION_PASSPHRASE_KEY = "myfinance-tracker.vehicles-profile-passphrase";

export function clearVehiclesProfileSessionPassphrase(): boolean {
  try {
    window.sessionStorage.removeItem(VEHICLES_SESSION_PASSPHRASE_KEY);
    return true;
  } catch {
    return false;
  }
}

function rowValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function numericValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function formatProfileDate(value: unknown, includeTime = false): string {
  if (typeof value !== "string" || !value.trim()) return "—";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString(undefined, includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" });
}

function findProfileColumn(table: VehicleProfileTable | undefined, names: string[]): VehicleProfileColumn | undefined {
  return table?.columns.find((column) => names.includes(column.name.toLocaleLowerCase()));
}

function isTechnicalTimestampColumn(column: VehicleProfileColumn): boolean {
  const name = column.name.toLocaleLowerCase();
  return ["created_at", "updated_at", "created_on", "updated_on", "modified_at", "last_updated_at"].includes(name);
}

function displayProfileValue(row: VehicleProfileRow, column: VehicleProfileColumn, vehicles: VehicleProfileRow[] = []): string {
  const value = row[column.name];
  if (value === null || value === undefined || value === "") return "—";
  if (column.name.toLocaleLowerCase() === "vehicle_id") return vehicleNameForId(vehicles, value);
  if (column.dataType === "date") return formatProfileDate(value);
  if (column.dataType.startsWith("timestamp")) return formatProfileDate(value, true);
  return rowValue(value);
}

function currencyValue(value: number): string {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function currentDateValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function getDefaultInput(column: VehicleProfileColumn): string {
  if (!column.defaultValue) return "";
  if (/^(true|false)$/i.test(column.defaultValue)) return column.defaultValue.toLowerCase();
  if (/^-?\d+(?:\.\d+)?$/.test(column.defaultValue)) return column.defaultValue;
  return "";
}

function columnLabel(name: string): string {
  return name.replace(/_/g, " ").replace(/\b[a-z]/g, (letter) => letter.toLocaleUpperCase());
}

function compareColumnValues(left: unknown, right: unknown, dataType: string): number {
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
  if (right === null || right === undefined) return -1;
  if (["smallint", "integer", "bigint", "numeric", "real", "double precision"].includes(dataType)) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  }
  if (dataType === "boolean") return Number(left === true || left === "true") - Number(right === true || right === "true");
  if (dataType === "date" || dataType.startsWith("timestamp")) {
    const leftTime = Date.parse(String(left));
    const rightTime = Date.parse(String(right));
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime;
  }
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
}

function profileRecordTitle(table: VehicleProfileTableName, row: VehicleProfileRow, vehicles: VehicleProfileRow[] = []): string {
  const description = ["name", "title", "description", "registration_number", "certificate_number"]
    .map((column) => row[column])
    .find((value) => typeof value === "string" && value.trim());
  if (table === "vehicles") return vehicleDisplayName(row);
  if (description) return String(description);
  if (row.vehicle_id !== null && row.vehicle_id !== undefined) return `${vehicleNameForId(vehicles, row.vehicle_id)} · ${TABLE_LABELS[table]}`;
  return `${TABLE_LABELS[table]} record`;
}

export function VehiclesProfilePage({ localView }: { localView: ReactNode }) {
  const [source, setSource] = useState<"ridertracker" | "daybook">("ridertracker");
  const [vaultLoading, setVaultLoading] = useState(true);
  const [vault, setVault] = useState<Awaited<ReturnType<typeof loadDatabaseConnectionVault>>>(null);
  const [passphrase, setPassphrase] = useState("");
  const [profiles, setProfiles] = useState<DatabaseConnectionProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [data, setData] = useState<VehicleProfileData | null>(null);
  const [activeTable, setActiveTable] = useState<FleetPage>("overview");
  const [activeModule, setActiveModule] = useState<FleetModuleId>("overview");
  const [vehicleView, setVehicleView] = useState<VehicleView>("table");
  const [vehicleStatus, setVehicleStatus] = useState("all");
  const [vehicleType, setVehicleType] = useState("all");
  const [vehicleManufacturer, setVehicleManufacturer] = useState("all");
  const [vehicleYear, setVehicleYear] = useState("all");
  const [relatedVehicleId, setRelatedVehicleId] = useState("all");
  const [viewingRecord, setViewingRecord] = useState<{ table: VehicleProfileTable; row: VehicleProfileRow } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{
    table: VehicleProfileTable;
    row: VehicleProfileRow | null;
    mode: "add" | "edit" | "copy";
  } | null>(null);
  const [filterColumn, setFilterColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [filterMatch, setFilterMatch] = useState<"contains" | "exact">("contains");
  const [sortColumn, setSortColumn] = useState("id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const sessionResumeAttempted = useRef(false);

  function resetTableFilters() {
    setSearch("");
    setFilterColumn("");
    setFilterValue("");
    setFilterMatch("contains");
    setSortColumn("id");
    setSortDirection("asc");
    setPage(0);
    setVehicleStatus("all");
    setVehicleType("all");
    setVehicleManufacturer("all");
    setVehicleYear("all");
    setRelatedVehicleId("all");
  }

  function openFleetModule(module: FleetModuleId) {
    const entry = FLEET_MODULES.find((item) => item.id === module)?.entries[0];
    if (!entry) return;
    setActiveModule(module);
    setActiveTable(entry.table);
    resetTableFilters();
  }

  function openFleetEntry(table: FleetPage, module?: FleetModuleId) {
    const resolvedModule = module ?? FLEET_MODULES.find((item) =>
      item.id !== "overview" && item.entries.some((entry) => entry.table === table))?.id ?? "reports";
    setActiveModule(resolvedModule);
    setActiveTable(table);
    resetTableFilters();
  }

  useEffect(() => {
    let active = true;
    void loadDatabaseConnectionVault()
      .then((savedVault) => { if (active) setVault(savedVault); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load the saved database profiles."); })
      .finally(() => { if (active) setVaultLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (vaultLoading || !vault || sessionResumeAttempted.current) return;
    sessionResumeAttempted.current = true;
    let savedPassphrase: string | null;
    try {
      savedPassphrase = window.sessionStorage.getItem(VEHICLES_SESSION_PASSPHRASE_KEY);
    } catch {
      setError("Browser session storage is unavailable. Enter the vault passphrase to connect.");
      return;
    }
    if (!savedPassphrase) return;
    setPassphrase(savedPassphrase);
    void unlockProfilesWithPassphrase(savedPassphrase, vault, false, true);
  }, [unlockProfilesWithPassphrase, vault, vaultLoading]);

  async function loadProfileData(profileId: string, key = passphrase, resetToReports = true) {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const loaded = await loadSavedProfileVehicleData(profileId, key);
      setData(loaded);
      setSelectedProfileId(profileId);
      if (resetToReports) {
        setActiveTable("overview");
        setActiveModule("overview");
      }
      setNotice("Vehicles data loaded directly from the assigned saved database profile. No data was copied.");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load data from the saved Vehicles profile.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function unlockProfilesWithPassphrase(
    key: string,
    savedVault: Awaited<ReturnType<typeof loadDatabaseConnectionVault>>,
    rememberForSession: boolean,
    restoringSession = false,
  ) {
    setError("");
    setNotice("");
    if (!savedVault) {
      setError("No saved database connection vault is available. Add a profile assigned to Vehicles first.");
      return false;
    }
    setBusy(true);
    let storageWarning = "";
    try {
      const unlocked = await decryptDatabaseConnectionProfiles(savedVault, key);
      const assigned = unlocked.filter((profile) =>
        profile.modules.some((module) => module.trim().toLocaleLowerCase() === "vehicles"));
      if (!assigned.length) {
        setProfiles([]);
        setError("No saved database profile is assigned to Vehicles. Assign the profile to Vehicles in Database connections.");
        if (restoringSession && !clearVehiclesProfileSessionPassphrase()) {
          setError("No saved profile is assigned to Vehicles, and the remembered passphrase could not be cleared. Close this browser tab.");
        }
        return false;
      }
      if (rememberForSession) {
        try {
          window.sessionStorage.setItem(VEHICLES_SESSION_PASSPHRASE_KEY, key);
        } catch {
          storageWarning = "Connected, but this browser could not remember the passphrase for this tab session.";
        }
      }
      setProfiles(assigned);
      setSelectedProfileId(assigned[0].id);
      setPassphrase(key);
      if (assigned.length === 1) await loadProfileData(assigned[0].id, key);
      if (storageWarning) setError(storageWarning);
      return true;
    } catch (caught) {
      const cleared = restoringSession ? clearVehiclesProfileSessionPassphrase() : true;
      const detail = caught instanceof Error ? caught.message : "Could not unlock the database connection vault.";
      setError(restoringSession && !cleared
        ? `${detail} The remembered passphrase could not be cleared; close this browser tab.`
        : detail);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function unlockProfiles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await unlockProfilesWithPassphrase(passphrase, vault, true);
  }

  function lockProfiles() {
    const cleared = clearVehiclesProfileSessionPassphrase();
    setData(null);
    setProfiles([]);
    setSelectedProfileId("");
    setActiveModule("overview");
    setViewingRecord(null);
    setPassphrase("");
    setError(cleared ? "" : "The remembered passphrase could not be cleared. Close this browser tab to remove it.");
    setNotice("The Vehicles database profile is locked.");
  }

  async function saveRecord(table: VehicleProfileTable, values: Record<string, string | number | boolean | null>) {
    if (!selectedProfileId) return;
    setBusy(true);
    setError("");
    const mode = editor?.mode ?? "add";
    const operation = mode === "edit" ? "update" : "insert";
    try {
      await mutateSavedProfileVehicleRecord(
        selectedProfileId,
        passphrase,
        table.name,
        operation,
        values,
        operation === "update" && editor?.row ? Number(editor.row.id) : undefined,
      );
      setEditor(null);
      if (await loadProfileData(selectedProfileId, passphrase, false)) {
        setNotice(mode === "edit"
          ? `${TABLE_LABELS[table.name]} record updated in RiderTracker.`
          : mode === "copy"
            ? `${TABLE_LABELS[table.name]} record copied to RiderTracker.`
            : `${TABLE_LABELS[table.name]} record added to RiderTracker.`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The record could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRecord(table: VehicleProfileTable, row: VehicleProfileRow) {
    const recordId = Number(row.id);
    if (!selectedProfileId) {
      setError("Select a saved Vehicles profile before deleting a record.");
      return;
    }
    if (!Number.isSafeInteger(recordId) || recordId < 1) {
      setError("This record does not have a valid ID and cannot be deleted.");
      return;
    }
    if (!window.confirm(`Permanently delete this record from RiderTracker's ${TABLE_LABELS[table.name]} table? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      await mutateSavedProfileVehicleRecord(selectedProfileId, passphrase, table.name, "delete", undefined, recordId);
      if (await loadProfileData(selectedProfileId, passphrase, false)) {
        setNotice(`Record deleted from RiderTracker's ${TABLE_LABELS[table.name]} table.`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The record could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  const tableData = data?.tables ?? [];
  const tableRows = (table: VehicleProfileTableName) => tableData.find((entry) => entry.name === table)?.rows ?? [];
  const vehicles = tableRows("vehicles");
  const expenses = tableRows("expenses");
  const fuel = tableRows("fuel_consumptions");
  const services = tableRows("services");
  const travel = tableRows("travel_logs");
  const odometer = tableRows("odometer_logs");
  const certificates = tableRows("certificates");
  const insurance = tableRows("insurance_policies");
  const alerts = tableRows("alerts");
  const vehiclesTable = tableData.find((table) => table.name === "vehicles");
  const vehicleManufacturerColumn = findProfileColumn(vehiclesTable, ["manufacturer", "make", "brand"]);
  const vehicleTypeColumn = findProfileColumn(vehiclesTable, ["vehicle_type", "type", "category", "vehicle_category"]);
  const vehiclePurchaseColumn = findProfileColumn(vehiclesTable, ["purchase_date", "purchased_on", "purchase_on", "acquisition_date"]);
  const vehicleStatusColumn = findProfileColumn(vehiclesTable, ["status", "vehicle_status"]);
  const vehicleStatusValue = (row: VehicleProfileRow) => vehicleStatusColumn ? String(row[vehicleStatusColumn.name] ?? "").trim().toLocaleLowerCase() : "";
  const statusCounts = vehicleStatusColumn ? {
    active: vehicles.filter((row) => ["active", "available", "in service"].includes(vehicleStatusValue(row))).length,
    inactive: vehicles.filter((row) => ["inactive", "retired", "out of service"].includes(vehicleStatusValue(row))).length,
    maintenance: vehicles.filter((row) => ["maintenance", "under maintenance", "in maintenance"].includes(vehicleStatusValue(row))).length,
  } : null;
  const vehicleStatusOptions = vehicleStatusColumn
    ? [...new Set(vehicles.map((row) => rowValue(row[vehicleStatusColumn.name])).filter((value) => value !== "—"))].sort()
    : [];
  const vehicleTypeOptions = vehicleTypeColumn
    ? [...new Set(vehicles.map((row) => vehicleTypeLabel(row[vehicleTypeColumn.name])).filter((value) => value !== "—"))].sort()
    : [];
  const vehicleManufacturerOptions = vehicleManufacturerColumn
    ? [...new Set(vehicles.map((row) => rowValue(row[vehicleManufacturerColumn.name])).filter((value) => value !== "—"))].sort()
    : [];
  const vehicleYearOptions = vehiclePurchaseColumn
    ? [...new Set(vehicles.map((row) => dateValue(row[vehiclePurchaseColumn.name]).slice(0, 4)).filter((value) => /^\d{4}$/.test(value)))].sort((a, b) => b.localeCompare(a))
    : [];

  const analytics = useMemo(() => {
    const costByMonth = new Map<string, { expenses: number; fuel: number; services: number }>();
    const addMonthlyCost = (date: unknown, key: "expenses" | "fuel" | "services", amount: unknown) => {
      const month = dateValue(date).slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) return;
      const bucket = costByMonth.get(month) ?? { expenses: 0, fuel: 0, services: 0 };
      bucket[key] += numericValue(amount);
      costByMonth.set(month, bucket);
    };
    expenses.forEach((row) => addMonthlyCost(row.date, "expenses", row.amount));
    fuel.forEach((row) => addMonthlyCost(row.fill_date, "fuel", row.total_cost));
    services.forEach((row) => addMonthlyCost(row.service_date, "services", row.cost));
    const months = [...costByMonth.keys()].sort().slice(-6).reverse();
    const dueSoon = [
      ...alerts.map((row) => ({ kind: "Alert", title: row.title, date: row.due_date })),
      ...certificates.map((row) => ({ kind: "Certificate", title: row.certificate_number ?? "Certificate", date: row.due_date })),
      ...insurance.map((row) => ({ kind: "Insurance", title: row.provider, date: row.due_date })),
    ].filter((row) => {
      const date = dateValue(row.date);
      return date >= currentDateValue() && date <= daysFromToday(30);
    }).sort((a, b) => dateValue(a.date).localeCompare(dateValue(b.date)));
    const perVehicle = vehicles.map((vehicle) => {
      const matching = (rows: VehicleProfileRow[]) => rows.filter((row) => String(row.vehicle_id) === String(vehicle.id));
      const vehicleExpenses = matching(expenses);
      const vehicleFuel = matching(fuel);
      const vehicleServices = matching(services);
      const vehicleTravel = matching(travel);
      return {
        id: vehicle.id,
        name: vehicleDisplayName(vehicle),
        expenses: vehicleExpenses.reduce((sum, row) => sum + numericValue(row.amount), 0),
        fuel: vehicleFuel.reduce((sum, row) => sum + numericValue(row.total_cost), 0),
        services: vehicleServices.reduce((sum, row) => sum + numericValue(row.cost), 0),
        distance: vehicleTravel.reduce((sum, row) => sum + numericValue(row.distance), 0),
      };
    });
    return {
      expenseTotal: expenses.reduce((sum, row) => sum + numericValue(row.amount), 0),
      fuelTotal: fuel.reduce((sum, row) => sum + numericValue(row.total_cost), 0),
      serviceTotal: services.reduce((sum, row) => sum + numericValue(row.cost), 0),
      distanceTotal: travel.reduce((sum, row) => sum + numericValue(row.distance), 0),
      fuelQuantity: fuel.reduce((sum, row) => sum + numericValue(row.fuel_quantity), 0),
      averageMileage: fuel.filter((row) => row.mileage !== null && row.mileage !== undefined)
        .reduce((sum, row, _, rows) => sum + numericValue(row.mileage) / rows.length, 0),
      latestOdometer: odometer.reduce((max, row) => Math.max(max, numericValue(row.reading)), 0),
      dueSoon,
      costByMonth: months.map((month) => ({ month, ...costByMonth.get(month)! })),
      perVehicle,
    };
  }, [alerts, certificates, expenses, fuel, insurance, odometer, services, travel, vehicles]);

  if (source === "daybook") {
    return <>
      <div className="page-head"><div><p className="eyebrow">Separate local collection</p><h1 className="page-title">MyFinanceTracker vehicle records</h1><p className="page-subtitle">These records remain in MyFinanceTracker and are not copied to or synchronized with RiderTracker.</p></div><Button variant="outline" onClick={() => setSource("ridertracker")}><Database size={14} />RiderTracker database</Button></div>
      {localView}
    </>;
  }

  const activeTableData = activeTable === "reports" || activeTable === "overview" ? null : tableData.find((table) => table.name === activeTable) ?? null;
  const searchTerm = search.trim().toLocaleLowerCase();
  const fieldFilter = filterValue.trim().toLocaleLowerCase();
  const matchingRows = (activeTableData?.rows ?? []).filter((row) => {
    const matchesSearch = !searchTerm || (activeTableData?.columns ?? [])
      .filter((column) => !activeTableData?.primaryKey.includes(column.name))
      .some((column) => {
        const value = column.name.toLocaleLowerCase() === "vehicle_id"
          ? vehicleNameForId(vehicles, row[column.name])
          : activeTable === "vehicles" && vehicleTypeColumn?.name === column.name
            ? vehicleTypeLabel(row[column.name])
            : rowValue(row[column.name]);
        return value.toLocaleLowerCase().includes(searchTerm);
      });
    const cell = filterColumn ? row[filterColumn] : undefined;
    const filterText = cell === null || cell === undefined ? "" : rowValue(cell).toLocaleLowerCase();
    const matchesField = !fieldFilter || !filterColumn || (filterMatch === "exact" ? filterText === fieldFilter : filterText.includes(fieldFilter));
    const matchesRelatedVehicle = relatedVehicleId === "all" || (activeTable === "vehicles"
      ? String(row.id) === relatedVehicleId
      : String(row.vehicle_id) === relatedVehicleId);
    const matchesVehicleFilters = activeTable !== "vehicles" ||
      ((!vehicleStatusColumn || vehicleStatus === "all" || rowValue(row[vehicleStatusColumn.name]) === vehicleStatus) &&
        (!vehicleTypeColumn || vehicleType === "all" || vehicleTypeLabel(row[vehicleTypeColumn.name]) === vehicleType) &&
        (!vehicleManufacturerColumn || vehicleManufacturer === "all" || rowValue(row[vehicleManufacturerColumn.name]) === vehicleManufacturer) &&
        (!vehiclePurchaseColumn || vehicleYear === "all" || dateValue(row[vehiclePurchaseColumn.name]).startsWith(vehicleYear)));
    return matchesSearch && matchesField && matchesRelatedVehicle && matchesVehicleFilters;
  });
  const relatedVehicleFilterAvailable = Boolean(activeTableData) &&
    (activeTable === "vehicles" || Boolean(activeTableData?.columns.some((column) => column.name.toLocaleLowerCase() === "vehicle_id")));
  const visibleRecordColumns = activeTableData?.columns.filter((column) =>
    !activeTableData.primaryKey.includes(column.name) && !isTechnicalTimestampColumn(column)) ?? [];
  const selectedSortColumn = visibleRecordColumns.find((column) => column.name === sortColumn) ?? visibleRecordColumns[0];
  const sortedRows = selectedSortColumn
    ? [...matchingRows].sort((left, right) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      return direction * compareColumnValues(left[selectedSortColumn.name], right[selectedSortColumn.name], selectedSortColumn.dataType)
        || compareColumnValues(left.id, right.id, "integer");
    })
    : matchingRows;
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = sortedRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const firstVisibleRow = sortedRows.length ? currentPage * pageSize + 1 : 0;
  const lastVisibleRow = Math.min((currentPage + 1) * pageSize, sortedRows.length);
  const activeFilterCount = [
    Boolean(searchTerm),
    Boolean(filterColumn && fieldFilter),
    Boolean(activeTable === "vehicles" && vehicleStatus !== "all"),
    Boolean(activeTable === "vehicles" && vehicleType !== "all"),
    Boolean(activeTable === "vehicles" && vehicleManufacturer !== "all"),
    Boolean(activeTable === "vehicles" && vehicleYear !== "all"),
    Boolean(relatedVehicleFilterAvailable && relatedVehicleId !== "all"),
    sortColumn !== "id",
    sortDirection !== "asc",
  ].filter(Boolean).length;
  const monthlyMax = Math.max(1, ...analytics.costByMonth.flatMap((month) => [month.expenses, month.fuel, month.services]));
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);
  const truncatedTables = tableData.filter((table) => table.truncated);

  return <div className="rider-fleet">
    <div className="page-head rider-fleet-page-head"><div><p className="eyebrow">RiderTracker · Fleet workspace</p><h1 className="page-title">Fleet Management</h1><p className="page-subtitle">Manage the assigned RiderTracker profile directly. Records stay in RiderTracker; nothing is copied into MyFinanceTracker.</p></div>
      <div className="connector-actions">
        <Button type="button" variant="outline" disabled={!data} onClick={() => openFleetEntry("alerts", "maintenance")}><Bell size={14} />Alerts <span className="rider-fleet-nav-count">{alerts.length}</span></Button>
        <Button type="button" variant="outline" disabled={!data || loading || busy} onClick={() => void loadProfileData(selectedProfileId, passphrase, false)}><RefreshCw size={14} />Refresh</Button>
        {profiles.length > 0 && <Button type="button" variant="ghost" onClick={lockProfiles}><LockKeyhole size={14} />Lock profile</Button>}
        <Button type="button" variant="outline" onClick={() => setSource("daybook")}>MyFinanceTracker records</Button>
      </div>
    </div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    {vaultLoading
      ? <Card><p className="section-description">Loading the saved connection vault...</p></Card>
      : !profiles.length
        ? <Card className="connector-card"><div className="card-head"><div><h2 className="section-title">Connect the Vehicles profile</h2><p className="section-description">Unlock the encrypted connection vault once per tab. The passphrase is remembered in this browser tab until you lock the profile or sign out; avoid this on shared devices.</p></div><LockKeyhole size={16} /></div>
          <form className="connector-form" onSubmit={(event) => void unlockProfiles(event)}>
            <Field className="full" label="Database connection vault passphrase"><Input type="password" autoComplete="current-password" maxLength={256} required value={passphrase} onChange={(event) => setPassphrase(event.target.value)} /></Field>
            <div className="full"><Button type="submit" disabled={busy || !vault}>{busy ? "Unlocking..." : "Unlock Vehicles profile"}</Button></div>
            {!vault && !error && <p className="section-description full">No saved profile vault was found. Create a profile assigned to Vehicles in Database connections.</p>}
          </form>
        </Card>
        : <Card className="connector-card"><div className="connector-form">
          <Field className="full" label="Saved profile assigned to Vehicles"><Select value={selectedProfileId} onChange={(event) => { setSelectedProfileId(event.target.value); setData(null); setActiveTable("overview"); setActiveModule("overview"); setError(""); setNotice(""); }}>{profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</Select></Field>
          {selectedProfile && <p className="section-description full">Connected to {selectedProfile.name} · {selectedProfile.modules.join(", ")}</p>}
          {!data && <div className="full"><Button type="button" disabled={loading || busy} onClick={() => void loadProfileData(selectedProfileId)}>{loading ? "Connecting..." : "Connect selected profile"}</Button></div>}
        </div></Card>}
    {data && <>
      {loading && <div className="alert" role="status">Refreshing RiderTracker data...</div>}
      {truncatedTables.length > 0 && <div className="alert alert-warning"><AlertTriangle size={15} style={{ flex: "none", marginTop: 1 }} /><span>For safety, only the first 1,000 records per table are loaded. Reports use the loaded rows for: {truncatedTables.map((table) => table.name).join(", ")}.</span></div>}
      <nav className="rider-fleet-primary-nav" aria-label="Fleet management modules">
        {FLEET_MODULES.map((module) => {
          const Icon = module.icon;
          return <Button key={module.id} type="button" variant={activeModule === module.id ? "primary" : "outline"} aria-current={activeModule === module.id ? "page" : undefined} onClick={() => openFleetModule(module.id)}>
            <Icon size={16} />{module.label}{activeModule === module.id && <ChevronDown className="rider-fleet-nav-chevron" size={14} />}
          </Button>;
        })}
      </nav>
      <nav className="rider-fleet-secondary-nav" aria-label={`${FLEET_MODULES.find((module) => module.id === activeModule)?.label ?? "Fleet"} pages`}>
        {FLEET_MODULES.find((module) => module.id === activeModule)?.entries.map((entry) => {
          const count = entry.table === "overview" || entry.table === "reports" || entry.table === "fleet-intelligence"
            ? undefined
            : tableData.find((table) => table.name === entry.table)?.totalRows;
          return <Button key={entry.table} type="button" variant="ghost" aria-current={activeTable === entry.table ? "page" : undefined} className={activeTable === entry.table ? "is-current" : ""} onClick={() => openFleetEntry(entry.table, activeModule)}>
            {entry.label}{count !== undefined && <span className="rider-fleet-nav-count">{count}</span>}
          </Button>;
        })}
      </nav>
      {activeTable === "fleet-intelligence"
        ? <VehicleFleetIntelligence data={data} onOpenTable={(table) => openFleetEntry(table)} />
        : activeTable === "overview" ? <>
        <section className="rider-fleet-overview" aria-labelledby="fleet-overview-heading">
          <div className="rider-fleet-overview-heading"><div><p className="eyebrow">Operational snapshot</p><h2 id="fleet-overview-heading">Fleet overview</h2><p>Live totals from the selected RiderTracker database profile.</p></div><Button type="button" variant="outline" onClick={() => openFleetEntry("reports", "reports")}><BarChart3 size={14} />Open reports</Button></div>
          <div className="rider-fleet-kpis">
            <Card><span>Total vehicles</span><strong>{vehiclesTable?.totalRows ?? vehicles.length}</strong><small>Vehicle records in profile</small></Card>
            <Card><span>Active vehicles</span><strong>{statusCounts ? statusCounts.active : "—"}</strong><small>{statusCounts ? vehiclesTable?.truncated ? "First 1,000 loaded records" : "Based on recorded status" : "Status field unavailable"}</small></Card>
            <Card><span>Under maintenance</span><strong>{statusCounts ? statusCounts.maintenance : "—"}</strong><small>{statusCounts ? vehiclesTable?.truncated ? "First 1,000 loaded records" : "Based on recorded status" : "Status field unavailable"}</small></Card>
            <Card><span>Recorded expenses</span><strong>{currencyValue(analytics.expenseTotal)}</strong><small>Expense-table total from loaded records</small></Card>
          </div>
          <div className="rider-fleet-overview-grid">
            <Card><div className="card-head"><div><h2 className="section-title">Recorded activity</h2><p className="section-description">Totals from the available linked records.</p></div><Gauge size={17} /></div>
              <div className="rider-fleet-overview-metrics">
                <div><span>Fuel spend</span><strong>{currencyValue(analytics.fuelTotal)}</strong></div>
                <div><span>Service costs</span><strong>{currencyValue(analytics.serviceTotal)}</strong></div>
                <div><span>Travel distance</span><strong>{analytics.distanceTotal.toLocaleString()} km</strong></div>
                <div><span>Odometer records</span><strong>{odometer.length.toLocaleString()}</strong></div>
              </div>
            </Card>
            <Card><div className="card-head"><div><h2 className="section-title">Upcoming due dates</h2><p className="section-description">Alerts, certificates and policies due within 30 days.</p></div><AlertTriangle size={17} /></div>
              {analytics.dueSoon.length
                ? <div className="vehicle-profile-due-list">{analytics.dueSoon.slice(0, 5).map((entry, index) => <div className="vehicle-record" key={`${entry.kind}-${index}`}><div className="vehicle-record-main"><strong>{rowValue(entry.title)}</strong><span>{entry.kind} · {formatProfileDate(entry.date)}</span></div></div>)}</div>
                : <EmptyState icon={<ShieldCheck size={18} />} title="No upcoming due dates" description="No alert, certificate, or insurance due dates were found in the next 30 days." />}
            </Card>
          </div>
          <div className="rider-fleet-overview-shortcuts">
            <Button type="button" variant="outline" onClick={() => openFleetEntry("vehicles", "vehicles")}><Car size={15} />Open vehicle registry</Button>
            <Button type="button" variant="outline" onClick={() => openFleetEntry("services", "maintenance")}><Wrench size={15} />Review maintenance</Button>
            <Button type="button" variant="outline" onClick={() => openFleetEntry("fleet-intelligence", "reports")}><BarChart3 size={15} />Fleet Intelligence</Button>
          </div>
        </section>
      </> : activeTable === "reports" ? <>
        <div className="electricity-summary vehicle-profile-summary">
          <Card><span>Vehicles</span><strong>{vehicles.length}</strong></Card>
          <Card><span>Expense records</span><strong>{currencyValue(analytics.expenseTotal)}</strong></Card>
          <Card><span>Fuel spend · {analytics.fuelQuantity.toLocaleString()} L</span><strong>{currencyValue(analytics.fuelTotal)}</strong></Card>
          <Card><span>Service costs</span><strong>{currencyValue(analytics.serviceTotal)}</strong></Card>
          <Card><span>Travel distance</span><strong>{analytics.distanceTotal.toLocaleString()} km</strong></Card>
          <Card><span>Latest odometer</span><strong>{analytics.latestOdometer.toLocaleString()} km</strong></Card>
        </div>
        <div className="vehicle-profile-report-grid">
          <Card><div className="card-head"><div><h2 className="section-title">Monthly recorded costs</h2><p className="section-description">Expenses, fuel and services are shown separately to avoid double-counting.</p></div><BarChart3 size={16} /></div>
            {analytics.costByMonth.length ? <div className="vehicle-profile-months">{analytics.costByMonth.map((month) => <div className="vehicle-profile-month" key={month.month}>
              <strong>{monthLabel(month.month)}</strong>
              {(["expenses", "fuel", "services"] as const).map((key) => <div className="vehicle-profile-bar-row" key={key}><span>{key === "expenses" ? "Expenses" : key === "fuel" ? "Fuel" : "Services"}</span><div className="vehicle-profile-bar-track"><div className={`vehicle-profile-bar vehicle-profile-bar-${key}`} style={{ width: `${Math.max(month[key] > 0 ? 2 : 0, month[key] / monthlyMax * 100)}%` }} /></div><strong>{currencyValue(month[key])}</strong></div>)}
            </div>)}</div> : <EmptyState icon={<BarChart3 size={18} />} title="No cost history" description="Monthly reports will appear when expenses, fuel fills, or service records are entered." />}
          </Card>
          <Card><div className="card-head"><div><h2 className="section-title">Due dates · next 30 days</h2><p className="section-description">Alerts, certificates and insurance due dates from RiderTracker.</p></div><AlertTriangle size={16} /></div>
            {analytics.dueSoon.length ? <div className="vehicle-profile-due-list">{analytics.dueSoon.map((entry, index) => <div className="vehicle-record" key={`${entry.kind}-${index}`}><div className="vehicle-record-main"><strong>{rowValue(entry.title)}</strong><span>{entry.kind} · {formatProfileDate(entry.date)}</span></div></div>)}</div> : <p className="section-description">No due dates in the next 30 days.</p>}
          </Card>
        </div>
        <Card><div className="card-head"><div><h2 className="section-title">Per-vehicle summary</h2><p className="section-description">Costs and travel are derived from the linked RiderTracker records.</p></div><Car size={16} /></div>
          {analytics.perVehicle.length ? <div className="database-sql-result-table"><table><thead><tr><th>Vehicle</th><th>Expenses</th><th>Fuel</th><th>Services</th><th>Travel distance</th></tr></thead><tbody>{analytics.perVehicle.map((vehicle) => <tr key={String(vehicle.id)}><td>{vehicle.name}</td><td>{currencyValue(vehicle.expenses)}</td><td>{currencyValue(vehicle.fuel)}</td><td>{currencyValue(vehicle.services)}</td><td>{vehicle.distance.toLocaleString()} km</td></tr>)}</tbody></table></div> : <EmptyState icon={<Car size={18} />} title="No vehicles" description="Add a vehicle record to start the fleet report." />}
        </Card>
        <Card><div className="card-head"><div><h2 className="section-title">Fuel analytics</h2><p className="section-description">Mileage values are displayed as recorded in RiderTracker.</p></div><Fuel size={16} /></div>
          <p className="section-description">{fuel.filter((row) => row.mileage !== null && row.mileage !== undefined).length} fuel records include mileage · average recorded mileage: {analytics.averageMileage ? `${analytics.averageMileage.toFixed(2)} km/L` : "not available"}.</p>
        </Card>
      </> : activeTable === "vehicles"
        ? <VehicleRegistryView
          table={activeTableData ?? undefined}
          tables={tableData}
          rows={sortedRows}
          pageRows={pageRows}
          totalRows={matchingRows.length}
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          firstVisibleRow={firstVisibleRow}
          lastVisibleRow={lastVisibleRow}
          busy={busy}
          search={search}
          onSearchChange={(value) => { setSearch(value); setPage(0); }}
          activeFilterCount={activeFilterCount}
          filterColumn={filterColumn}
          filterValue={filterValue}
          filterMatch={filterMatch}
          sortColumn={selectedSortColumn?.name ?? ""}
          sortDirection={sortDirection}
          onFilterColumnChange={(value) => { setFilterColumn(value); setPage(0); }}
          onFilterValueChange={(value) => { setFilterValue(value); setPage(0); }}
          onFilterMatchChange={(value) => { setFilterMatch(value); setPage(0); }}
          onSortColumnChange={(value) => { setSortColumn(value); setPage(0); }}
          onSortDirectionChange={(value) => { setSortDirection(value); setPage(0); }}
          vehicleStatus={vehicleStatus}
          vehicleType={vehicleType}
          vehicleManufacturer={vehicleManufacturer}
          vehicleYear={vehicleYear}
          onVehicleStatusChange={(value) => { setVehicleStatus(value); setPage(0); }}
          onVehicleTypeChange={(value) => { setVehicleType(value); setPage(0); }}
          onVehicleManufacturerChange={(value) => { setVehicleManufacturer(value); setPage(0); }}
          onVehicleYearChange={(value) => { setVehicleYear(value); setPage(0); }}
          statusOptions={vehicleStatusOptions}
          typeOptions={vehicleTypeOptions}
          manufacturerOptions={vehicleManufacturerOptions}
          yearOptions={vehicleYearOptions}
          vehicles={vehicles}
          relatedVehicleId={relatedVehicleId}
          onRelatedVehicleChange={(value) => { setRelatedVehicleId(value); setPage(0); }}
          statusCounts={statusCounts}
          view={vehicleView}
          onViewChange={setVehicleView}
          onPageChange={setPage}
          onPageSizeChange={(value) => { setPageSize(value); setPage(0); }}
          onAdd={() => activeTableData && setEditor({ table: activeTableData, row: null, mode: "add" })}
          onViewRow={(row) => activeTableData && setViewingRecord({ table: activeTableData, row })}
          onEditRow={(row) => activeTableData && setEditor({ table: activeTableData, row, mode: "edit" })}
          onCopyRow={(row) => activeTableData && setEditor({ table: activeTableData, row, mode: "copy" })}
          onDeleteRow={(row) => activeTableData && void deleteRecord(activeTableData, row)}
          onClearFilters={() => { resetTableFilters(); setSortColumn("id"); setSortDirection("asc"); }}
        />
        : activeTableData && <>
        <Card className="database-browser"><div className="database-table-select"><div><h2 className="section-title">{TABLE_LABELS[activeTableData.name]}</h2><p className="section-description">{activeTableData.totalRows} record(s) in RiderTracker</p></div><Button type="button" disabled={busy} onClick={() => setEditor({ table: activeTableData, row: null, mode: "add" })}><Plus size={14} />Add record</Button></div>
          <div className="toolbar filter-toolbar vehicle-profile-table-toolbar">
            <div className="search-wrap"><Input aria-label={`Search ${TABLE_LABELS[activeTableData.name]}`} placeholder={`Search ${TABLE_LABELS[activeTableData.name].toLocaleLowerCase()}...`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></div>
            {relatedVehicleFilterAvailable && <Field label="Vehicle name"><Select value={relatedVehicleId} onChange={(event) => { setRelatedVehicleId(event.target.value); setPage(0); }}><option value="all">All vehicles</option>{vehicles.map((vehicle) => <option key={String(vehicle.id)} value={String(vehicle.id)}>{vehicleDisplayName(vehicle)}</option>)}</Select></Field>}
            <FilterDrawer activeCount={activeFilterCount} label={`Filter and sort ${TABLE_LABELS[activeTableData.name]}`} closeOnChange={false}>
              <Field label="Filter field"><Select value={filterColumn} onChange={(event) => { setFilterColumn(event.target.value); setPage(0); }}><option value="">Choose a field</option>{activeTableData.columns.filter((column) => !activeTableData.primaryKey.includes(column.name) && column.name.toLocaleLowerCase() !== "vehicle_id").map((column) => <option value={column.name} key={column.name}>{columnLabel(column.name)}</option>)}</Select></Field>
              <Field label="Filter value"><Input value={filterValue} onChange={(event) => { setFilterValue(event.target.value); setPage(0); }} placeholder="Enter a value" /></Field>
              <Field label="Match"><Select value={filterMatch} onChange={(event) => { setFilterMatch(event.target.value as "contains" | "exact"); setPage(0); }}><option value="contains">Contains</option><option value="exact">Exact match</option></Select></Field>
              <Field label="Sort by"><Select value={selectedSortColumn?.name ?? ""} onChange={(event) => { setSortColumn(event.target.value); setPage(0); }}>{visibleRecordColumns.map((column) => <option value={column.name} key={column.name}>{columnLabel(column.name)}</option>)}</Select></Field>
              <Field label="Order"><Select value={sortDirection} onChange={(event) => { setSortDirection(event.target.value as "asc" | "desc"); setPage(0); }}><option value="asc">Ascending</option><option value="desc">Descending</option></Select></Field>
              <Button type="button" size="sm" variant="outline" onClick={() => {
                setSearch("");
                setFilterColumn("");
                setFilterValue("");
                setFilterMatch("contains");
                setSortColumn("id");
                setSortDirection("asc");
                setRelatedVehicleId("all");
                setPage(0);
              }}>Clear filters</Button>
            </FilterDrawer>
            <div className="rider-fleet-view-toggle" role="group" aria-label={`${TABLE_LABELS[activeTableData.name]} display mode`}>
              <Button type="button" variant={vehicleView === "grid" ? "primary" : "outline"} aria-pressed={vehicleView === "grid"} aria-label="Card grid view" title="Card grid view" onClick={() => setVehicleView("grid")}><Grid2X2 size={15} /><span>Grid</span></Button>
              <Button type="button" variant={vehicleView === "table" ? "primary" : "outline"} aria-pressed={vehicleView === "table"} aria-label="Table view" title="Table view" onClick={() => setVehicleView("table")}><Table2 size={15} /><span>Table</span></Button>
              <Button type="button" variant={vehicleView === "list" ? "primary" : "outline"} aria-pressed={vehicleView === "list"} aria-label="Compact list view" title="Compact list view" onClick={() => setVehicleView("list")}><List size={15} /><span>List</span></Button>
            </div>
            <Badge>{matchingRows.length} {matchingRows.length === 1 ? "record" : "records"}</Badge>
          </div>
          {pageRows.length ? vehicleView === "table"
            ? <div className="rider-fleet-table-wrap"><table className="rider-fleet-table"><thead><tr>{visibleRecordColumns.map((column) => <th key={column.name}>{columnLabel(column.name)}</th>)}<th><span className="sr-only">Actions</span></th></tr></thead><tbody>{pageRows.map((row) => <tr key={String(row.id)}>{visibleRecordColumns.map((column) => <td key={column.name}>{displayProfileValue(row, column, vehicles)}</td>)}<td><VehicleRecordActions entityLabel={TABLE_LABELS[activeTableData.name].toLocaleLowerCase()} row={row} busy={busy} onView={(record) => setViewingRecord({ table: activeTableData, row: record })} onEdit={(record) => setEditor({ table: activeTableData, row: record, mode: "edit" })} onCopy={(record) => setEditor({ table: activeTableData, row: record, mode: "copy" })} onDelete={(record) => void deleteRecord(activeTableData, record)} /></td></tr>)}</tbody></table></div>
            : vehicleView === "list"
              ? <div className="rider-fleet-data-list">{pageRows.map((row) => {
                const summaryColumns = visibleRecordColumns.slice(0, 3);
                return <article className="rider-fleet-data-list-row" key={String(row.id)}>
                  <div><h3>{profileRecordTitle(activeTableData.name, row, vehicles)}</h3><div>{summaryColumns.map((column) => <span key={column.name}><strong>{columnLabel(column.name)}:</strong> {displayProfileValue(row, column, vehicles)}</span>)}</div></div>
                  <VehicleRecordActions entityLabel={TABLE_LABELS[activeTableData.name].toLocaleLowerCase()} row={row} busy={busy} onView={(record) => setViewingRecord({ table: activeTableData, row: record })} onEdit={(record) => setEditor({ table: activeTableData, row: record, mode: "edit" })} onCopy={(record) => setEditor({ table: activeTableData, row: record, mode: "copy" })} onDelete={(record) => void deleteRecord(activeTableData, record)} />
                </article>;
              })}</div>
              : <div className="rider-fleet-data-grid">{pageRows.map((row) => <article className="database-row" key={String(row.id)}>
                <div className="database-row-head"><strong>{profileRecordTitle(activeTableData.name, row, vehicles)}</strong><VehicleRecordActions entityLabel={TABLE_LABELS[activeTableData.name].toLocaleLowerCase()} row={row} busy={busy} onView={(record) => setViewingRecord({ table: activeTableData, row: record })} onEdit={(record) => setEditor({ table: activeTableData, row: record, mode: "edit" })} onCopy={(record) => setEditor({ table: activeTableData, row: record, mode: "copy" })} onDelete={(record) => void deleteRecord(activeTableData, record)} /></div>
                <div className="database-fields">{visibleRecordColumns.map((column) => <div key={column.name}><span>{columnLabel(column.name)}</span><pre>{displayProfileValue(row, column, vehicles)}</pre></div>)}</div>
                {activeTableData.columns.some(isTechnicalTimestampColumn) && <details className="fleet-technical-details"><summary>Technical details</summary><div>{activeTableData.columns.filter(isTechnicalTimestampColumn).map((column) => <p key={column.name}><span>{columnLabel(column.name)}</span><strong>{displayProfileValue(row, column, vehicles)}</strong></p>)}</div></details>}
              </article>)}</div>
            : <EmptyState icon={<Database size={18} />} title={searchTerm || fieldFilter ? "No matching records" : "No records yet"} description={searchTerm || fieldFilter ? "Try changing the search or field filter." : `Add the first record to ${TABLE_LABELS[activeTableData.name]}.`} />}
          <div className="database-pagination vehicle-profile-pagination">
            <span aria-live="polite">Rows {firstVisibleRow}–{lastVisibleRow} of {sortedRows.length} matching · {activeTableData.totalRows} total</span>
            <div>
              <Field label="Rows"><Select aria-label={`${TABLE_LABELS[activeTableData.name]} rows per page`} value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></Select></Field>
              <Button type="button" variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button>
              <span aria-live="polite">{currentPage + 1} / {pageCount}</span>
              <Button type="button" variant="outline" size="sm" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</Button>
            </div>
          </div>
          {activeTableData.truncated && <p className="section-description">Filters, sorting, and paging use the first 1,000 loaded records. This table has {activeTableData.totalRows} records; use Database Manager to inspect records beyond that limit.</p>}
        </Card>
      </>}
    </>}
    {editor && <VehicleProfileRecordEditor
      key={`${editor.table.name}-${editor.mode}-${editor.row?.id ?? "new"}`}
      table={editor.table}
      initial={editor.row}
      mode={editor.mode}
      vehicles={vehicles}
      busy={busy}
      onClose={() => setEditor(null)}
      onSave={(values) => saveRecord(editor.table, values)}
    />}
    {viewingRecord && <ProfileRecordDetailsDialog
      row={viewingRecord.row}
      table={viewingRecord.table}
      vehicles={vehicles}
      onClose={() => setViewingRecord(null)}
      onEdit={() => { setEditor({ table: viewingRecord.table, row: viewingRecord.row, mode: "edit" }); setViewingRecord(null); }}
    />}
  </div>;
}

function VehicleRegistryView({
  table, tables, rows, pageRows, totalRows, page, pageCount, pageSize, firstVisibleRow, lastVisibleRow, busy, vehicles, relatedVehicleId, onRelatedVehicleChange,
  search, onSearchChange, activeFilterCount, filterColumn, filterValue, filterMatch, sortColumn, sortDirection,
  onFilterColumnChange, onFilterValueChange, onFilterMatchChange, onSortColumnChange, onSortDirectionChange,
  vehicleStatus, vehicleType, vehicleManufacturer, vehicleYear, onVehicleStatusChange, onVehicleTypeChange,
  onVehicleManufacturerChange, onVehicleYearChange, statusOptions, typeOptions, manufacturerOptions, yearOptions,
  statusCounts, view, onViewChange, onPageChange, onPageSizeChange, onAdd, onViewRow, onEditRow, onCopyRow,
  onDeleteRow, onClearFilters,
}: {
  table?: VehicleProfileTable;
  tables: VehicleProfileTable[];
  rows: VehicleProfileRow[];
  pageRows: VehicleProfileRow[];
  totalRows: number;
  page: number;
  pageCount: number;
  pageSize: number;
  firstVisibleRow: number;
  lastVisibleRow: number;
  busy: boolean;
  vehicles: VehicleProfileRow[];
  relatedVehicleId: string;
  onRelatedVehicleChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  activeFilterCount: number;
  filterColumn: string;
  filterValue: string;
  filterMatch: "contains" | "exact";
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onFilterColumnChange: (value: string) => void;
  onFilterValueChange: (value: string) => void;
  onFilterMatchChange: (value: "contains" | "exact") => void;
  onSortColumnChange: (value: string) => void;
  onSortDirectionChange: (value: "asc" | "desc") => void;
  vehicleStatus: string;
  vehicleType: string;
  vehicleManufacturer: string;
  vehicleYear: string;
  onVehicleStatusChange: (value: string) => void;
  onVehicleTypeChange: (value: string) => void;
  onVehicleManufacturerChange: (value: string) => void;
  onVehicleYearChange: (value: string) => void;
  statusOptions: string[];
  typeOptions: string[];
  manufacturerOptions: string[];
  yearOptions: string[];
  statusCounts: { active: number; inactive: number; maintenance: number } | null;
  view: VehicleView;
  onViewChange: (value: VehicleView) => void;
  onPageChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
  onAdd: () => void;
  onViewRow: (row: VehicleProfileRow) => void;
  onEditRow: (row: VehicleProfileRow) => void;
  onCopyRow: (row: VehicleProfileRow) => void;
  onDeleteRow: (row: VehicleProfileRow) => void;
  onClearFilters: () => void;
}) {
  const nameColumn = findProfileColumn(table, ["name", "vehicle_name", "title"]);
  const registrationColumn = findProfileColumn(table, ["registration_number", "registration_no", "registration", "reg_number", "plate_number"]);
  const manufacturerColumn = findProfileColumn(table, ["manufacturer", "make", "brand"]);
  const modelColumn = findProfileColumn(table, ["model", "model_name"]);
  const typeColumn = findProfileColumn(table, ["vehicle_type", "type", "category", "vehicle_category"]);
  const purchaseColumn = findProfileColumn(table, ["purchase_date", "purchased_on", "purchase_on", "acquisition_date"]);
  const statusColumn = findProfileColumn(table, ["status", "vehicle_status"]);
  const odometerTable = tables.find((entry) => entry.name === "odometer_logs");
  const odometerColumn = findProfileColumn(odometerTable, ["reading", "odometer", "odometer_reading"]);
  const odometerDateColumn = findProfileColumn(odometerTable, ["recorded_at", "reading_date", "date", "created_at"]);
  const serviceTable = tables.find((entry) => entry.name === "services");
  const serviceDateColumn = findProfileColumn(serviceTable, ["service_date", "date", "performed_on"]);
  const serviceTypeColumn = findProfileColumn(serviceTable, ["service_type", "type", "description", "name"]);

  function linkedRows(source: VehicleProfileTable | undefined, row: VehicleProfileRow): VehicleProfileRow[] {
    const foreignKey = findProfileColumn(source, ["vehicle_id"]);
    return foreignKey && row.id !== null && row.id !== undefined
      ? (source?.rows ?? []).filter((entry) => String(entry[foreignKey.name]) === String(row.id))
      : [];
  }

  function latestRecord(records: VehicleProfileRow[], column?: VehicleProfileColumn): VehicleProfileRow | undefined {
    if (!records.length) return undefined;
    if (!column) return records[records.length - 1];
    return [...records].sort((left, right) => {
      const leftTime = Date.parse(String(left[column.name] ?? ""));
      const rightTime = Date.parse(String(right[column.name] ?? ""));
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    })[0];
  }

  const vehicleColumns = [nameColumn, registrationColumn, manufacturerColumn, modelColumn, typeColumn, purchaseColumn, statusColumn]
    .filter((column, index, list): column is VehicleProfileColumn => Boolean(column) && list.findIndex((entry) => entry?.name === column?.name) === index);
  const tableColumns = vehicleColumns.length
    ? vehicleColumns
    : (table?.columns ?? []).filter((column) => !table?.primaryKey.includes(column.name) && !isTechnicalTimestampColumn(column));
  const displayVehicleColumn = (row: VehicleProfileRow, column: VehicleProfileColumn) =>
    typeColumn?.name === column.name ? vehicleTypeLabel(row[column.name]) : displayProfileValue(row, column, vehicles);
  const countValue = table?.totalRows ?? "0";
  const dataScopeNote = table?.truncated ? "Status totals use the first 1,000 loaded vehicle records." : "Vehicle status counts use recorded values.";

  return <section className="rider-fleet-registry" aria-labelledby="vehicle-registry-heading">
    <header className="rider-fleet-registry-heading">
      <div><p className="eyebrow">Fleet inventory</p><h2 id="vehicle-registry-heading">Vehicle registry</h2><p>Search, filter and manage vehicle records from the connected RiderTracker database.</p></div>
      <Button type="button" disabled={!table || busy} onClick={onAdd}><Plus size={15} />Add vehicle</Button>
    </header>
    <div className="rider-fleet-kpis">
      <Card><span>Total vehicles</span><strong>{countValue}</strong><small>Records in RiderTracker</small></Card>
      <Card><span>Active</span><strong>{statusCounts ? statusCounts.active : "—"}</strong><small>{statusCounts ? dataScopeNote : "Status field unavailable"}</small></Card>
      <Card><span>Inactive</span><strong>{statusCounts ? statusCounts.inactive : "—"}</strong><small>{statusCounts ? dataScopeNote : "Status field unavailable"}</small></Card>
      <Card><span>Under maintenance</span><strong>{statusCounts ? statusCounts.maintenance : "—"}</strong><small>{statusCounts ? dataScopeNote : "Status field unavailable"}</small></Card>
    </div>
    <Card className="rider-fleet-registry-panel">
      <div className="rider-fleet-toolbar">
        <div className="search-wrap"><Search size={15} /><Input aria-label="Search vehicles" placeholder="Search name, registration, make, model..." value={search} onChange={(event) => onSearchChange(event.target.value)} /></div>
        <Field label="Vehicle name"><Select value={relatedVehicleId} onChange={(event) => onRelatedVehicleChange(event.target.value)}><option value="all">All vehicle names</option>{vehicles.map((vehicle) => <option key={String(vehicle.id)} value={String(vehicle.id)}>{vehicleDisplayName(vehicle)}</option>)}</Select></Field>
        <FilterDrawer activeCount={activeFilterCount} label="Advanced filters" closeOnChange={false}>
          {statusColumn && <Field label="Status"><Select value={vehicleStatus} onChange={(event) => onVehicleStatusChange(event.target.value)}><option value="all">All statuses</option>{statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>}
          {typeColumn && <Field label="Vehicle type"><Select value={vehicleType} onChange={(event) => onVehicleTypeChange(event.target.value)}><option value="all">All types</option>{typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>}
          {manufacturerColumn && <Field label="Manufacturer"><Select value={vehicleManufacturer} onChange={(event) => onVehicleManufacturerChange(event.target.value)}><option value="all">All manufacturers</option>{manufacturerOptions.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>}
          {purchaseColumn && <Field label="Purchase year"><Select value={vehicleYear} onChange={(event) => onVehicleYearChange(event.target.value)}><option value="all">All years</option>{yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field>}
          <Field label="Filter field"><Select value={filterColumn} onChange={(event) => onFilterColumnChange(event.target.value)}><option value="">Any field</option>{(table?.columns ?? []).filter((column) => !table?.primaryKey.includes(column.name) && column.name !== typeColumn?.name).map((column) => <option key={column.name} value={column.name}>{columnLabel(column.name)}</option>)}</Select></Field>
          <Field label="Field value"><Input value={filterValue} onChange={(event) => onFilterValueChange(event.target.value)} placeholder="Enter a value" /></Field>
          <Field label="Match"><Select value={filterMatch} onChange={(event) => onFilterMatchChange(event.target.value as "contains" | "exact")}><option value="contains">Contains</option><option value="exact">Exact match</option></Select></Field>
          <Field label="Sort by"><Select value={sortColumn} onChange={(event) => onSortColumnChange(event.target.value)}>{(table?.columns ?? []).filter((column) => !table?.primaryKey.includes(column.name)).map((column) => <option key={column.name} value={column.name}>{columnLabel(column.name)}</option>)}</Select></Field>
          <Field label="Sort order"><Select value={sortDirection} onChange={(event) => onSortDirectionChange(event.target.value as "asc" | "desc")}><option value="asc">Ascending</option><option value="desc">Descending</option></Select></Field>
          <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>Clear filters</Button>
        </FilterDrawer>
        <div className="rider-fleet-view-toggle" role="group" aria-label="Vehicle display mode">
          <Button type="button" variant={view === "grid" ? "primary" : "outline"} aria-pressed={view === "grid"} aria-label="Card grid view" title="Card grid view" onClick={() => onViewChange("grid")}><Grid2X2 size={15} /><span>Grid</span></Button>
          <Button type="button" variant={view === "table" ? "primary" : "outline"} aria-pressed={view === "table"} aria-label="Table view" title="Table view" onClick={() => onViewChange("table")}><Table2 size={15} /><span>Table</span></Button>
          <Button type="button" variant={view === "list" ? "primary" : "outline"} aria-pressed={view === "list"} aria-label="Compact list view" title="Compact list view" onClick={() => onViewChange("list")}><List size={15} /><span>List</span></Button>
        </div>
        <Badge>{totalRows} {totalRows === 1 ? "vehicle" : "vehicles"}</Badge>
      </div>
      {!table
        ? <EmptyState icon={<Database size={18} />} title="Vehicle table unavailable" description="The connected profile did not return a vehicles table. Check the profile assignment and database schema." />
        : !totalRows
          ? <EmptyState icon={<Car size={18} />} title={rows.length ? "No matching vehicles" : table.totalRows === "0" ? "No vehicle records yet" : "No matching vehicles"} description={rows.length ? "Adjust or clear your search and filters to see vehicles." : table.totalRows === "0" ? "Add the first vehicle record to the connected RiderTracker database." : "Adjust or clear your search and filters to see vehicles."} />
          : view === "table"
            ? <div className="rider-fleet-table-wrap"><table className="rider-fleet-table"><thead><tr>{tableColumns.map((column) => <th key={column.name}>{columnLabel(column.name)}</th>)}<th><span className="sr-only">Actions</span></th></tr></thead><tbody>{pageRows.map((row) => <tr key={String(row.id)}>{tableColumns.map((column) => <td key={column.name}>{displayVehicleColumn(row, column)}</td>)}<td><VehicleRecordActions entityLabel={vehicleDisplayName(row)} row={row} busy={busy} onView={onViewRow} onEdit={onEditRow} onCopy={onCopyRow} onDelete={onDeleteRow} /></td></tr>)}</tbody></table></div>
            : view === "list"
              ? <div className="rider-fleet-compact-list">{pageRows.map((row) => {
                const status = statusColumn ? rowValue(row[statusColumn.name]) : "";
                const name = vehicleDisplayName(row);
                return <article className="rider-fleet-compact-row" key={String(row.id)}>
                  <div className="rider-fleet-compact-main"><div><h3>{name}</h3><span>{registrationColumn ? rowValue(row[registrationColumn.name]) : "Registration not recorded"}</span></div><VehicleStatus value={status} columnAvailable={Boolean(statusColumn)} /></div>
                  <p>{[manufacturerColumn && rowValue(row[manufacturerColumn.name]), modelColumn && rowValue(row[modelColumn.name]), typeColumn && vehicleTypeLabel(row[typeColumn.name])].filter((value): value is string => Boolean(value && value !== "—")).join(" · ") || "Vehicle details not recorded"}</p>
                  <VehicleRecordActions entityLabel={name} row={row} busy={busy} onView={onViewRow} onEdit={onEditRow} onCopy={onCopyRow} onDelete={onDeleteRow} />
                </article>;
              })}</div>
              : <div className="rider-fleet-vehicle-grid">{pageRows.map((row) => {
                const odometerRow = latestRecord(linkedRows(odometerTable, row), odometerDateColumn);
                const serviceRow = latestRecord(linkedRows(serviceTable, row), serviceDateColumn);
                const status = statusColumn ? rowValue(row[statusColumn.name]) : "";
                const name = vehicleDisplayName(row);
                return <article className="rider-fleet-vehicle-card" key={String(row.id)}>
                  <div className="rider-fleet-vehicle-card-head"><div className="rider-fleet-vehicle-mark"><Car size={19} /></div><div className="rider-fleet-vehicle-title"><h3>{name}</h3><span>{registrationColumn ? rowValue(row[registrationColumn.name]) : "Registration not recorded"}</span></div><VehicleStatus value={status} columnAvailable={Boolean(statusColumn)} /></div>
                  <div className="rider-fleet-vehicle-metadata">
                    <div><span>Manufacturer</span><strong>{manufacturerColumn ? rowValue(row[manufacturerColumn.name]) : "Not recorded"}</strong></div>
                    <div><span>Model</span><strong>{modelColumn ? rowValue(row[modelColumn.name]) : "Not recorded"}</strong></div>
                    <div><span>Vehicle type</span><strong>{typeColumn ? vehicleTypeLabel(row[typeColumn.name]) : "Not recorded"}</strong></div>
                    <div><span>Purchase date</span><strong>{purchaseColumn ? displayProfileValue(row, purchaseColumn) : "Not recorded"}</strong></div>
                  </div>
                  {((odometerColumn && odometerRow) || ((serviceDateColumn || serviceTypeColumn) && serviceRow)) && <div className="rider-fleet-vehicle-extras">
                    {odometerColumn && odometerRow && <div><Gauge size={14} /><span>Odometer</span><strong>{rowValue(odometerRow[odometerColumn.name])} km</strong></div>}
                    {(serviceDateColumn || serviceTypeColumn) && serviceRow && <div><Wrench size={14} /><span>Service</span><strong>{[serviceTypeColumn ? rowValue(serviceRow[serviceTypeColumn.name]) : "", serviceDateColumn ? displayProfileValue(serviceRow, serviceDateColumn) : ""].filter((value) => value && value !== "—").join(" · ") || "Record available"}</strong></div>}
                  </div>}
                  <div className="rider-fleet-vehicle-card-footer"><VehicleRecordActions entityLabel={name} row={row} busy={busy} onView={onViewRow} onEdit={onEditRow} onCopy={onCopyRow} onDelete={onDeleteRow} /></div>
                </article>;
              })}</div>}
      {table && <div className="database-pagination vehicle-profile-pagination">
        <span aria-live="polite">Rows {firstVisibleRow}–{lastVisibleRow} of {totalRows} matching · {table.totalRows} total</span>
        <div><Field label="Rows"><Select aria-label="Vehicles rows per page" value={String(pageSize)} onChange={(event) => onPageSizeChange(Number(event.target.value))}><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></Select></Field>
          <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)}>Previous</Button><span aria-live="polite">{page + 1} / {pageCount}</span><Button type="button" variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)}>Next</Button>
        </div>
      </div>}
      {table?.truncated && <p className="section-description">Filters, sorting and pagination use the first 1,000 loaded vehicle records. The table contains {table.totalRows} records.</p>}
    </Card>
  </section>;
}

function VehicleStatus({ value, columnAvailable }: { value: string; columnAvailable: boolean }) {
  if (!columnAvailable) return <span className="rider-fleet-status status-unknown">Status not recorded</span>;
  const normalized = value.toLocaleLowerCase();
  const tone = ["active", "available", "in service"].includes(normalized) ? "status-active"
    : ["maintenance", "under maintenance", "in maintenance"].includes(normalized) ? "status-maintenance"
      : ["inactive", "retired", "out of service"].includes(normalized) ? "status-inactive" : "status-neutral";
  return <span className={`rider-fleet-status ${tone}`}>{value || "Status not set"}</span>;
}

function VehicleRecordActions({ row, busy, entityLabel = "vehicle", onView, onEdit, onCopy, onDelete }: {
  row: VehicleProfileRow;
  busy: boolean;
  entityLabel?: string;
  onView: (row: VehicleProfileRow) => void;
  onEdit: (row: VehicleProfileRow) => void;
  onCopy: (row: VehicleProfileRow) => void;
  onDelete: (row: VehicleProfileRow) => void;
}) {
  const label = entityLabel;
  return <div className="rider-fleet-record-actions">
    <button type="button" className="icon-button" disabled={busy} aria-label={`View ${label}`} title="View" onClick={() => onView(row)}><Eye size={14} /></button>
    <button type="button" className="icon-button" disabled={busy} aria-label={`Edit ${label}`} title="Edit" onClick={() => onEdit(row)}><Pencil size={14} /></button>
    <button type="button" className="icon-button" disabled={busy} aria-label={`Duplicate ${label}`} title="Duplicate" onClick={() => onCopy(row)}><Copy size={14} /></button>
    <button type="button" className="icon-button" disabled={busy} aria-label={`Delete ${label}`} title="Delete" onClick={() => onDelete(row)}><Trash2 size={14} /></button>
  </div>;
}

function ProfileRecordDetailsDialog({ row, table, vehicles, onClose, onEdit }: {
  row: VehicleProfileRow;
  table: VehicleProfileTable;
  vehicles: VehicleProfileRow[];
  onClose: () => void;
  onEdit: () => void;
}) {
  const columns = table.columns;
  const technicalColumns = columns.filter(isTechnicalTimestampColumn);
  const title = profileRecordTitle(table.name, row, vehicles);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal modal-wide rider-fleet-details-dialog" role="dialog" aria-modal="true" aria-labelledby="vehicle-details-title">
      <div className="modal-head"><div><p className="eyebrow">{TABLE_LABELS[table.name]} record</p><h2 id="vehicle-details-title">{title}</h2></div><button type="button" className="icon-button" aria-label={`Close ${TABLE_LABELS[table.name]} details`} onClick={onClose}><X size={18} /></button></div>
      <dl className="rider-fleet-detail-fields">{columns.filter((column) => !table.primaryKey.includes(column.name) && !isTechnicalTimestampColumn(column)).map((column) => <div key={column.name}><dt>{columnLabel(column.name)}</dt><dd>{table.name === "vehicles" && findProfileColumn(table, ["vehicle_type", "type", "category", "vehicle_category"])?.name === column.name ? vehicleTypeLabel(row[column.name]) : displayProfileValue(row, column, vehicles)}</dd></div>)}</dl>
      {technicalColumns.length > 0 && <details className="fleet-technical-details"><summary>Technical details</summary><div>{technicalColumns.map((column) => <p key={column.name}><span>{columnLabel(column.name)}</span><strong>{displayProfileValue(row, column, vehicles)}</strong></p>)}</div></details>}
      <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Close</Button><Button type="button" onClick={onEdit}><Pencil size={14} />Edit {table.name === "vehicles" ? "vehicle" : "record"}</Button></div>
    </section>
  </div>;
}

function VehicleProfileRecordEditor({ table, initial, mode, vehicles, busy, onClose, onSave }: {
  table: VehicleProfileTable;
  initial: VehicleProfileRow | null;
  mode: "add" | "edit" | "copy";
  vehicles: VehicleProfileRow[];
  busy: boolean;
  onClose: () => void;
  onSave: (values: Record<string, string | number | boolean | null>) => Promise<void>;
}) {
  const editableColumns = useMemo(() => table.columns.filter((column) =>
    !table.primaryKey.includes(column.name) && column.name !== "created_at" && column.name !== "updated_at"), [table]);
  const isEditing = mode === "edit";
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(editableColumns.map((column) => {
    const value = initial?.[column.name];
    return [column.name, value === null || value === undefined
      ? getDefaultInput(column)
      : column.dataType === "date" ? dateValue(value) : String(value)];
  })));
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const payload: Record<string, string | number | boolean | null> = {};
    for (const column of editableColumns) {
      const rawValue = values[column.name] ?? "";
      if (rawValue === "") {
        if (column.nullable) payload[column.name] = null;
        else if (!isEditing && column.defaultValue) continue;
        else {
          setError(`${column.name} is required.`);
          return;
        }
        continue;
      }
      if (column.dataType === "boolean") {
        payload[column.name] = rawValue === "true";
      } else if (["smallint", "integer", "bigint", "numeric", "real", "double precision"].includes(column.dataType)) {
        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed)) {
          setError(`${column.name} must be a valid number.`);
          return;
        }
        payload[column.name] = parsed;
      } else {
        payload[column.name] = rawValue.trim();
      }
    }
    await onSave(payload);
  }

  const title = `${mode === "edit" ? "Edit" : mode === "copy" ? "Copy" : "Add"} ${TABLE_LABELS[table.name]} record`;
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="vehicle-record-title">
      <div className="modal-head"><h2 id="vehicle-record-title">{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button></div>
      <form onSubmit={(event) => void submit(event)}><div className="form-grid">
        {editableColumns.map((column) => {
          const label = columnLabel(column.name);
          const required = !column.nullable && !(column.defaultValue && !isEditing);
          const isDate = column.dataType === "date";
          const isBoolean = column.dataType === "boolean";
          const isNumeric = ["smallint", "integer", "bigint", "numeric", "real", "double precision"].includes(column.dataType);
          const options = column.name === "vehicle_id" ? vehicles : [];
          if (isDate) return <Field key={column.name} label={label}><DateInput required={required} value={values[column.name] ?? ""} onValueChange={(value) => setValues((current) => ({ ...current, [column.name]: value }))} /></Field>;
          if (isBoolean) return <Field key={column.name} label={label}><Select required={required} value={values[column.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [column.name]: event.target.value }))}><option value="">Choose...</option><option value="true">Yes</option><option value="false">No</option></Select></Field>;
          if (options.length || column.name === "vehicle_id") return <Field key={column.name} label={label}><Select required={required} value={values[column.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [column.name]: event.target.value }))}><option value="">{column.nullable ? "None" : "Choose a vehicle"}</option>{options.map((vehicle) => <option key={String(vehicle.id)} value={String(vehicle.id)}>{vehicleDisplayName(vehicle)}</option>)}</Select></Field>;
          if (isNumeric) return <Field key={column.name} label={`${label} · ${column.dataType}`}><Input type="number" step={["smallint", "integer", "bigint"].includes(column.dataType) ? "1" : "any"} required={required} value={values[column.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [column.name]: event.target.value }))} /></Field>;
          if (column.dataType === "text" || column.dataType.startsWith("character varying")) return <Field key={column.name} label={label}><textarea className="field textarea" rows={column.dataType === "text" ? 3 : 1} maxLength={column.dataType.startsWith("character varying") ? Number(column.dataType.match(/\d+/)?.[0] ?? 5000) : 5000} required={required} value={values[column.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [column.name]: event.target.value }))} /></Field>;
          return <Field key={column.name} label={`${label} · ${column.dataType}`}><Input required={required} value={values[column.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [column.name]: event.target.value }))} /></Field>;
        })}
        <p className="section-description full">Numeric type codes are stored and shown as-is; RiderTracker does not expose a label map for them.</p>
      </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
        <div className="modal-actions"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving..." : mode === "edit" ? "Save changes" : mode === "copy" ? "Create copy" : "Add record"}</Button></div>
      </form>
    </section>
  </div>;
}
