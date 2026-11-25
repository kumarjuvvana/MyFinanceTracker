import { useState } from "react";
import { Car } from "lucide-react";
import type { VehicleProfileRow } from "../lib/databaseApi";
import { vehicleDisplayName } from "../lib/vehicleProfilePresentation";
import { Button, Card, Input } from "./ui";

function textValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function VehicleMarketValuePanel({ vehicles, marketValueColumnAvailable, onSave }: {
  vehicles: VehicleProfileRow[];
  marketValueColumnAvailable: boolean;
  onSave: (vehicle: VehicleProfileRow, value: number | null) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  async function save(vehicle: VehicleProfileRow, key: string, value: string) {
    const trimmed = value.trim();
    const amount = trimmed ? Number(trimmed) : null;
    if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 999999999999.99)) {
      setError("Enter a market value from ₹0 to ₹999,999,999,999.99, or clear the field to remove it.");
      return;
    }

    setError("");
    setSavingId(key);
    try {
      await onSave(vehicle, amount);
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[key];
        return next;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The market value could not be saved.");
    } finally {
      setSavingId("");
    }
  }

  return <Card className="fleet-market-card">
    <div className="fleet-card-head"><span className="fleet-card-icon"><Car size={16} /></span><div>
      <h3>Manual vehicle market values</h3>
      <p>Enter a current indicative value in INR for each vehicle. Values are saved to the RiderTracker vehicles table; they are not fetched or independently verified.</p>
    </div></div>
    {!marketValueColumnAvailable && <p className="fleet-market-error" role="status">The RiderTracker vehicles table needs the market_value column before values can be saved.</p>}
    {error && <p className="fleet-market-error" role="alert">{error}</p>}
    {vehicles.length ? <div className="fleet-market-list">{vehicles.map((vehicle, index) => {
      const key = String(vehicle.id ?? `${index}-${vehicleDisplayName(vehicle)}`);
      const storedValue = textValue(vehicle.market_value);
      const value = drafts[key] ?? storedValue;
      const numericValue = storedValue ? Number(storedValue) : NaN;
      return <div className="fleet-market-row" key={key}>
        <div className="fleet-market-details">
          <strong>{vehicleDisplayName(vehicle)}</strong>
          <small>{Number.isFinite(numericValue) ? `Saved value: ${formatPrice(numericValue)}` : "No market value saved."}</small>
        </div>
        <div className="fleet-market-editor">
          <label className="sr-only" htmlFor={`market-value-${key}`}>Market value in INR for {vehicleDisplayName(vehicle)}</label>
          <Input
            id={`market-value-${key}`}
            type="number"
            min="0"
            max="999999999999.99"
            step="0.01"
            inputMode="decimal"
            placeholder="Market value (₹)"
            value={value}
            disabled={!marketValueColumnAvailable || Boolean(savingId)}
            onChange={(event) => setDrafts((previous) => ({ ...previous, [key]: event.target.value }))}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!marketValueColumnAvailable || Boolean(savingId) || value === storedValue}
            onClick={() => void save(vehicle, key, value)}
          >
            {savingId === key ? "Saving…" : "Save value"}
          </Button>
        </div>
      </div>;
    })}</div> : <p className="fleet-market-empty">No vehicles are in the current selection.</p>}
  </Card>;
}
