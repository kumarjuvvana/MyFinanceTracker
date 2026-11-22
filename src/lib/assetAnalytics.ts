import { reportDateKey } from "./reportAnalytics";
import type { AssetPriceHistoryRecord, AutomatedPriceAssetType } from "../types.js";

export interface AssetAnalyticsPoint {
  id: string;
  date: string;
  price: number;
  currency: string;
  provider: string;
}

export interface AssetAnalyticsSeries {
  id: string;
  assetType: AutomatedPriceAssetType;
  assetName: string;
  instrumentName: string;
  currency: string;
  unit: "per share" | "per unit";
  points: AssetAnalyticsPoint[];
}

export function buildAssetAnalyticsSeries(
  records: readonly AssetPriceHistoryRecord[],
  assetType: AutomatedPriceAssetType,
): AssetAnalyticsSeries[] {
  const series = new Map<string, AssetAnalyticsSeries>();
  const byDay = new Map<string, AssetAnalyticsPoint>();

  for (const record of records) {
    const date = reportDateKey(record.price_date);
    if (record.asset_type !== assetType || !date ||
      !Number.isFinite(record.price) || record.price <= 0 ||
      !record.currency || !record.asset_id || !record.instrument_id) continue;

    const id = `${assetType}:${record.asset_id}:${record.instrument_id}:${record.currency}`;
    let entry = series.get(id);
    if (!entry) {
      entry = {
        id,
        assetType,
        assetName: record.asset_name,
        instrumentName: record.instrument_name || record.asset_name,
        currency: record.currency,
        unit: assetType === "Stocks" ? "per share" : "per unit",
        points: [],
      };
      series.set(id, entry);
    }

    const dayKey = `${id}:${date}`;
    const existing = byDay.get(dayKey);
    if (!existing || record.fetched_at > existing.id) {
      const point = {
        id: record.fetched_at,
        date,
        price: record.price,
        currency: record.currency,
        provider: record.provider,
      };
      byDay.set(dayKey, point);
    }
  }

  for (const [dayKey, point] of byDay) {
    const seriesId = dayKey.slice(0, dayKey.lastIndexOf(":"));
    series.get(seriesId)?.points.push(point);
  }

  return [...series.values()]
    .map((entry) => ({
      ...entry,
      points: entry.points.sort((left, right) => left.date.localeCompare(right.date)),
    }))
    .sort((left, right) =>
      left.assetName.localeCompare(right.assetName) ||
      left.instrumentName.localeCompare(right.instrumentName) ||
      left.currency.localeCompare(right.currency));
}
