import type { VehicleProfileRow } from "./databaseApi";

const VEHICLE_NAME_FIELDS = ["name", "vehicle_name", "title"];
const VEHICLE_REGISTRATION_FIELDS = ["registration_number", "registration_no", "registration", "reg_number", "plate_number"];

export function vehicleDisplayName(vehicle: VehicleProfileRow): string {
  for (const field of VEHICLE_NAME_FIELDS) {
    const value = vehicle[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const manufacturer = ["manufacturer", "make", "brand"].map((field) => vehicle[field])
    .find((value) => typeof value === "string" && value.trim());
  const model = ["model", "model_name", "vehicle_model"].map((field) => vehicle[field])
    .find((value) => typeof value === "string" && value.trim());
  if (manufacturer && model) return `${String(manufacturer).trim()} ${String(model).trim()}`;
  if (manufacturer) return String(manufacturer).trim();
  for (const field of VEHICLE_REGISTRATION_FIELDS) {
    const value = vehicle[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "Unnamed vehicle";
}

export function vehicleNameForId(vehicles: VehicleProfileRow[], id: unknown): string {
  if (id === null || id === undefined || id === "") return "—";
  const vehicle = vehicles.find((entry) => String(entry.id) === String(id));
  return vehicle ? vehicleDisplayName(vehicle) : "Vehicle not linked";
}

export function vehicleTypeLabel(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const label = String(value).trim();
  const normalized = label.toLocaleLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (/^(car|automobile|sedan|hatchback|suv)$/.test(normalized) || /four wheeler|4 wheeler/.test(normalized)) return "Car";
  if (/^(bike|motorbike|motorcycle|scooter)$/.test(normalized) || /two wheeler|2 wheeler/.test(normalized)) return "Bike";
  return label;
}

export function isUserIdColumn(column: { name: string }): boolean {
  return column.name.toLocaleLowerCase() === "user_id";
}

export function monthTargetLabel(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) return undefined;
  return new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(2020, month - 1, 1));
}

export function fleetCategoryLabel(tableName: string, columnName: string, value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const code = String(value).trim();
  if (!/^\d+$/.test(code)) return undefined;
  const table = tableName.toLocaleLowerCase();
  const column = columnName.toLocaleLowerCase();
  if (table === "fuel_consumptions" && column === "fuel_type") {
    return ({ "1": "Petrol", "2": "Diesel" } as Record<string, string>)[code] ?? `Fuel type ${code}`;
  }
  if (table === "expenses" && column === "expense_type") return `Expense type ${code}`;
  if (table === "certificates" && column === "certificate_type") return `Certificate type ${code}`;
  return undefined;
}
