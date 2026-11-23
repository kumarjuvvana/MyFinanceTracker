import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, BarChart3, Car, Copy, Database, Fuel, LockKeyhole, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Badge, Button, Card, DateInput, EmptyState, Field, FilterDrawer, Input, Select } from "./ui";
import { loadSavedProfileVehicleData, mutateSavedProfileVehicleRecord, VEHICLE_PROFILE_TABLES, type VehicleProfileColumn, type VehicleProfileData, type VehicleProfileRow, type VehicleProfileTable, type VehicleProfileTableName } from "../lib/databaseApi";
import { loadDatabaseConnectionVault } from "../lib/databaseConnectionsApi";
import { decryptDatabaseConnectionProfiles, type DatabaseConnectionProfile } from "../lib/databaseConnectionProfiles";

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

function profileRecordTitle(table: VehicleProfileTableName, row: VehicleProfileRow): string {
  const description = ["name", "title", "description", "registration_number", "certificate_number"]
    .map((column) => row[column])
    .find((value) => typeof value === "string" && value.trim());
  return `${TABLE_LABELS[table]} #${rowValue(row.id)}${description ? ` · ${String(description)}` : ""}`;
}

export function VehiclesProfilePage({ localView }: { localView: ReactNode }) {
  const [source, setSource] = useState<"ridertracker" | "daybook">("ridertracker");
  const [vaultLoading, setVaultLoading] = useState(true);
  const [vault, setVault] = useState<Awaited<ReturnType<typeof loadDatabaseConnectionVault>>>(null);
  const [passphrase, setPassphrase] = useState("");
  const [profiles, setProfiles] = useState<DatabaseConnectionProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [data, setData] = useState<VehicleProfileData | null>(null);
  const [activeTable, setActiveTable] = useState<"reports" | VehicleProfileTableName>("reports");
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
      if (resetToReports) setActiveTable("reports");
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
        name: String(vehicle.name ?? `Vehicle ${vehicle.id}`),
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

  const activeTableData = activeTable === "reports" ? null : tableData.find((table) => table.name === activeTable) ?? null;
  const searchTerm = search.trim().toLocaleLowerCase();
  const fieldFilter = filterValue.trim().toLocaleLowerCase();
  const matchingRows = (activeTableData?.rows ?? []).filter((row) => {
    const matchesSearch = !searchTerm ||
      Object.values(row).some((value) => rowValue(value).toLocaleLowerCase().includes(searchTerm));
    if (!matchesSearch || !fieldFilter || !filterColumn) return matchesSearch;
    const cell = row[filterColumn];
    const filterText = cell === null || cell === undefined ? "" : rowValue(cell).toLocaleLowerCase();
    return filterMatch === "exact" ? filterText === fieldFilter : filterText.includes(fieldFilter);
  });
  const selectedSortColumn = activeTableData?.columns.find((column) => column.name === sortColumn)
    ?? activeTableData?.columns.find((column) => column.name === "id")
    ?? activeTableData?.columns[0];
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
    sortColumn !== "id",
    sortDirection !== "asc",
  ].filter(Boolean).length;
  const monthlyMax = Math.max(1, ...analytics.costByMonth.flatMap((month) => [month.expenses, month.fuel, month.services]));
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);
  const truncatedTables = tableData.filter((table) => table.truncated);

  return <>
    <div className="page-head"><div><p className="eyebrow">RiderTracker · Live database</p><h1 className="page-title">Vehicles</h1><p className="page-subtitle">Manage the assigned RiderTracker profile directly. Records stay in RiderTracker; nothing is copied into MyFinanceTracker.</p></div>
      <div className="connector-actions">
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
          <Field className="full" label="Saved profile assigned to Vehicles"><Select value={selectedProfileId} onChange={(event) => { setSelectedProfileId(event.target.value); setData(null); setActiveTable("reports"); setError(""); setNotice(""); }}>{profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}</Select></Field>
          {selectedProfile && <p className="section-description full">Connected to {selectedProfile.name} · {selectedProfile.modules.join(", ")}</p>}
          {!data && <div className="full"><Button type="button" disabled={loading || busy} onClick={() => void loadProfileData(selectedProfileId)}>{loading ? "Connecting..." : "Connect selected profile"}</Button></div>}
        </div></Card>}
    {data && <>
      {loading && <div className="alert" role="status">Refreshing RiderTracker data...</div>}
      {truncatedTables.length > 0 && <div className="alert alert-warning"><AlertTriangle size={15} style={{ flex: "none", marginTop: 1 }} /><span>For safety, only the first 1,000 records per table are loaded. Reports use the loaded rows for: {truncatedTables.map((table) => table.name).join(", ")}.</span></div>}
      <div className="database-tabs" role="tablist" aria-label="Vehicles data and reports">
        <Button type="button" variant={activeTable === "reports" ? "primary" : "outline"} role="tab" aria-selected={activeTable === "reports"} onClick={() => setActiveTable("reports")}><BarChart3 size={14} />Reports & analytics</Button>
        {VEHICLE_PROFILE_TABLES.map((table) => {
          const count = tableData.find((item) => item.name === table)?.totalRows ?? "0";
          return <Button type="button" key={table} variant={activeTable === table ? "primary" : "outline"} role="tab" aria-selected={activeTable === table} onClick={() => {
            setActiveTable(table);
            setSearch("");
            setFilterColumn("");
            setFilterValue("");
            setFilterMatch("contains");
            setSortColumn("id");
            setSortDirection("asc");
            setPage(0);
          }}>{TABLE_LABELS[table]} · {count}</Button>;
        })}
      </div>
      {activeTable === "reports" ? <>
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
            {analytics.dueSoon.length ? <div className="vehicle-profile-due-list">{analytics.dueSoon.map((entry, index) => <div className="vehicle-record" key={`${entry.kind}-${index}`}><div className="vehicle-record-main"><strong>{rowValue(entry.title)}</strong><span>{entry.kind} · {dateValue(entry.date)}</span></div></div>)}</div> : <p className="section-description">No due dates in the next 30 days.</p>}
          </Card>
        </div>
        <Card><div className="card-head"><div><h2 className="section-title">Per-vehicle summary</h2><p className="section-description">Costs and travel are derived from the linked RiderTracker records.</p></div><Car size={16} /></div>
          {analytics.perVehicle.length ? <div className="database-sql-result-table"><table><thead><tr><th>Vehicle</th><th>Expenses</th><th>Fuel</th><th>Services</th><th>Travel distance</th></tr></thead><tbody>{analytics.perVehicle.map((vehicle) => <tr key={String(vehicle.id)}><td>{vehicle.name}</td><td>{currencyValue(vehicle.expenses)}</td><td>{currencyValue(vehicle.fuel)}</td><td>{currencyValue(vehicle.services)}</td><td>{vehicle.distance.toLocaleString()} km</td></tr>)}</tbody></table></div> : <EmptyState icon={<Car size={18} />} title="No vehicles" description="Add a vehicle record to start the fleet report." />}
        </Card>
        <Card><div className="card-head"><div><h2 className="section-title">Fuel analytics</h2><p className="section-description">Mileage values are displayed as recorded in RiderTracker.</p></div><Fuel size={16} /></div>
          <p className="section-description">{fuel.filter((row) => row.mileage !== null && row.mileage !== undefined).length} fuel records include mileage · average recorded mileage: {analytics.averageMileage ? `${analytics.averageMileage.toFixed(2)} km/L` : "not available"}.</p>
        </Card>
      </> : activeTableData && <>
        <Card className="database-browser"><div className="database-table-select"><div><h2 className="section-title">{TABLE_LABELS[activeTableData.name]}</h2><p className="section-description">{activeTableData.totalRows} record(s) in RiderTracker</p></div><Button type="button" disabled={busy} onClick={() => setEditor({ table: activeTableData, row: null, mode: "add" })}><Plus size={14} />Add record</Button></div>
          <div className="toolbar filter-toolbar vehicle-profile-table-toolbar">
            <div className="search-wrap"><Input aria-label={`Search ${TABLE_LABELS[activeTableData.name]}`} placeholder={`Search ${TABLE_LABELS[activeTableData.name].toLocaleLowerCase()}...`} value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></div>
            <FilterDrawer activeCount={activeFilterCount} label={`Filter and sort ${TABLE_LABELS[activeTableData.name]}`} closeOnChange={false}>
              <Field label="Filter field"><Select value={filterColumn} onChange={(event) => { setFilterColumn(event.target.value); setPage(0); }}><option value="">Choose a field</option>{activeTableData.columns.map((column) => <option value={column.name} key={column.name}>{columnLabel(column.name)}</option>)}</Select></Field>
              <Field label="Filter value"><Input value={filterValue} onChange={(event) => { setFilterValue(event.target.value); setPage(0); }} placeholder="Enter a value" /></Field>
              <Field label="Match"><Select value={filterMatch} onChange={(event) => { setFilterMatch(event.target.value as "contains" | "exact"); setPage(0); }}><option value="contains">Contains</option><option value="exact">Exact match</option></Select></Field>
              <Field label="Sort by"><Select value={selectedSortColumn?.name ?? ""} onChange={(event) => { setSortColumn(event.target.value); setPage(0); }}>{activeTableData.columns.map((column) => <option value={column.name} key={column.name}>{columnLabel(column.name)}</option>)}</Select></Field>
              <Field label="Order"><Select value={sortDirection} onChange={(event) => { setSortDirection(event.target.value as "asc" | "desc"); setPage(0); }}><option value="asc">Ascending</option><option value="desc">Descending</option></Select></Field>
              <Button type="button" size="sm" variant="outline" onClick={() => {
                setSearch("");
                setFilterColumn("");
                setFilterValue("");
                setFilterMatch("contains");
                setSortColumn("id");
                setSortDirection("asc");
                setPage(0);
              }}>Clear filters</Button>
            </FilterDrawer>
            <Badge>{matchingRows.length} {matchingRows.length === 1 ? "record" : "records"}</Badge>
          </div>
          {pageRows.length ? <div className="vehicle-profile-records">{pageRows.map((row) => <article className="database-row" key={String(row.id)}>
            <div className="database-row-head"><strong>{profileRecordTitle(activeTableData.name, row)}</strong><div className="table-actions">
              <button type="button" className="icon-button" disabled={busy} aria-label={`Copy ${TABLE_LABELS[activeTableData.name]} record ${rowValue(row.id)}`} onClick={() => setEditor({ table: activeTableData, row, mode: "copy" })}><Copy size={14} /></button>
              <button type="button" className="icon-button" disabled={busy} aria-label={`Edit ${TABLE_LABELS[activeTableData.name]} record ${rowValue(row.id)}`} onClick={() => setEditor({ table: activeTableData, row, mode: "edit" })}><Pencil size={14} /></button>
              <button type="button" className="icon-button" disabled={busy} aria-label={`Delete ${TABLE_LABELS[activeTableData.name]} record ${rowValue(row.id)}`} onClick={() => void deleteRecord(activeTableData, row)}><Trash2 size={14} /></button>
            </div></div>
            <div className="database-fields">{activeTableData.columns.filter((column) => !activeTableData.primaryKey.includes(column.name)).map((column) => <div key={column.name}><span>{columnLabel(column.name)}</span><pre>{rowValue(row[column.name])}</pre></div>)}</div>
          </article>)}</div> : <EmptyState icon={<Database size={18} />} title={searchTerm || fieldFilter ? "No matching records" : "No records yet"} description={searchTerm || fieldFilter ? "Try changing the search or field filter." : `Add the first record to ${TABLE_LABELS[activeTableData.name]}.`} />}
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
  </>;
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
          if (options.length || column.name === "vehicle_id") return <Field key={column.name} label={label}><Select required={required} value={values[column.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [column.name]: event.target.value }))}><option value="">{column.nullable ? "None" : "Choose a vehicle"}</option>{options.map((vehicle) => <option key={String(vehicle.id)} value={String(vehicle.id)}>{String(vehicle.name ?? "Vehicle")} · ID {String(vehicle.id)}</option>)}</Select></Field>;
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
