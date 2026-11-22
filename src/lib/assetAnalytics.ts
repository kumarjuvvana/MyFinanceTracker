import { reportDateKey } from "./reportAnalytics";
import type { InvestmentPosition } from "./investmentReport";
import type { AssetPriceHistoryRecord, AssetRecord, AutomatedPriceAssetType, TrackerData } from "../types.js";

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
  assetId: string;
  instrumentId: string;
  assetName: string;
  instrumentName: string;
  currency: string;
  unit: "per share" | "per unit";
  points: AssetAnalyticsPoint[];
}

export interface AssetPortfolioValuePoint {
  id: string;
  date: string;
  value: number;
  pricedInstruments: number;
  eligibleInstruments: number;
}

export interface AssetPortfolioValueSeries {
  currency: string;
  points: AssetPortfolioValuePoint[];
}

export interface AssetPortfolioProfitLoss {
  currency: string;
  investedValue: number;
  currentValue: number;
  profitLoss: number;
  pricedHoldings: number;
  eligibleHoldings: number;
}

function recordedUnits(series: AssetAnalyticsSeries, data: TrackerData): number | null {
  let units: number | null | undefined;
  if (series.assetType === "Stocks") {
    units = (data.stocks ?? []).find((stock) => stock.id === series.assetId)?.quantity;
  } else {
    const asset: AssetRecord | undefined = (data.assets ?? []).find((entry) => entry.id === series.assetId);
    if (series.assetType === "Mutual fund") {
      units = asset?.quantity;
    } else {
      units = asset?.npsSchemes?.find((scheme) => scheme.schemeId === series.instrumentId)?.units;
    }
  }
  return typeof units === "number" && Number.isFinite(units) && units > 0 ? units : null;
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
        assetId: record.asset_id,
        instrumentId: record.instrument_id,
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

export function buildAssetPortfolioValueSeries(
  series: readonly AssetAnalyticsSeries[],
  data: TrackerData,
  fromDate = "",
  toDate = "",
): AssetPortfolioValueSeries[] {
  const byCurrency = new Map<string, Array<{
    id: string;
    units: number;
    points: AssetAnalyticsPoint[];
  }>>();
  for (const entry of series) {
    const units = recordedUnits(entry, data);
    if (units === null) continue;
    const holdings = byCurrency.get(entry.currency) ?? [];
    holdings.push({ id: entry.id, units, points: entry.points });
    byCurrency.set(entry.currency, holdings);
  }

  return [...byCurrency.entries()].map(([currency, holdings]) => {
    const firstDates = holdings.map((holding) => holding.points[0]?.date).filter((date): date is string => Boolean(date));
    const sortedFirstDates = firstDates.sort();
    const startDate = fromDate || sortedFirstDates[sortedFirstDates.length - 1] || "";
    if (!startDate || (toDate && startDate > toDate)) return { currency, points: [] };

    const matchedHoldings = holdings.flatMap((holding) => {
      const startPoints = holding.points.filter((point) => point.date <= startDate);
      const startPoint = startPoints[startPoints.length - 1];
      return startPoint ? [{ ...holding, startPoint }] : [];
    });
    if (!matchedHoldings.length) return { currency, points: [] };

    const eventsByDate = new Map<string, Array<{ id: string; value: number }>>();
    for (const holding of matchedHoldings) {
      for (const point of holding.points) {
        if (point.date <= startDate || (toDate && point.date > toDate)) continue;
        const events = eventsByDate.get(point.date) ?? [];
        events.push({ id: holding.id, value: point.price * holding.units });
        eventsByDate.set(point.date, events);
      }
    }

    const currentValues = new Map(matchedHoldings.map((holding) =>
      [holding.id, holding.startPoint.price * holding.units]));
    let total = [...currentValues.values()].reduce((sum, value) => sum + value, 0);
    const points: AssetPortfolioValuePoint[] = [{
      id: `${currency}:${startDate}`,
      date: startDate,
      value: total,
      pricedInstruments: matchedHoldings.length,
      eligibleInstruments: holdings.length,
    }];
    for (const [date, events] of [...eventsByDate.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      for (const event of events) {
        const previous = currentValues.get(event.id);
        if (previous !== undefined) total -= previous;
        currentValues.set(event.id, event.value);
        total += event.value;
      }
      points.push({
        id: `${currency}:${date}`,
        date,
        value: total,
        pricedInstruments: matchedHoldings.length,
        eligibleInstruments: holdings.length,
      });
    }
    const lastPoint = points[points.length - 1];
    if (toDate && lastPoint && toDate > lastPoint.date) {
      points.push({ ...lastPoint, id: `${currency}:${toDate}`, date: toDate });
    }
    return { currency, points };
  }).sort((left, right) => left.currency.localeCompare(right.currency));
}

export function buildAssetPortfolioProfitLoss(
  positions: readonly InvestmentPosition[],
  data: TrackerData,
  assetType: "all" | AutomatedPriceAssetType,
): AssetPortfolioProfitLoss[] {
  const grouped = new Map<string, AssetPortfolioProfitLoss>();
  const allowedTypes = assetType === "all"
    ? new Set(["Stock", "Mutual fund", "NPS"])
    : new Set([assetType === "Stocks" ? "Stock" : assetType]);

  for (const position of positions) {
    if (!allowedTypes.has(position.assetType) || !position.currency || position.currency === "Not recorded" ||
      typeof position.investedValue !== "number" || !Number.isFinite(position.investedValue) || position.investedValue <= 0) continue;

    const summary = grouped.get(position.currency) ?? {
      currency: position.currency,
      investedValue: 0,
      currentValue: 0,
      profitLoss: 0,
      pricedHoldings: 0,
      eligibleHoldings: 0,
    };
    summary.eligibleHoldings += 1;
    if (typeof position.currentValue !== "number" || !Number.isFinite(position.currentValue) || position.currentValue < 0) {
      grouped.set(position.currency, summary);
      continue;
    }

    const assetId = position.id.startsWith("asset:") ? position.id.slice("asset:".length) : "";
    const withdrawals = position.assetType === "NPS"
      ? data.assets?.find((asset) => asset.id === assetId)?.withdrawnValue ?? 0
      : 0;
    const validWithdrawals = Number.isFinite(withdrawals) && withdrawals > 0 ? withdrawals : 0;
    summary.investedValue += position.investedValue;
    summary.currentValue += position.currentValue;
    summary.profitLoss += position.currentValue + validWithdrawals - position.investedValue;
    summary.pricedHoldings += 1;
    grouped.set(position.currency, summary);
  }

  return [...grouped.values()].sort((left, right) => left.currency.localeCompare(right.currency));
}
