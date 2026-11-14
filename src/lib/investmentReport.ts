import type { AssetPriceHistoryRecord, AssetRecord, TrackerData, TrackedStock } from "../types.js";

export interface InvestmentPosition {
  id: string;
  name: string;
  assetType: string;
  institution: string;
  currency: string;
  quantity: number | null;
  investedValue: number | null;
  currentValue: number | null;
  valueDate: string;
  source: string;
  recordedDifference: number | null;
}

export interface AssetHistoryPoint {
  id: string;
  seriesId: string;
  name: string;
  assetType: string;
  date: string;
  value: number;
  currency: string;
  unit: string;
  units: number | null;
  source: string;
}

export interface AssetManagerRecord extends InvestmentPosition {
  isLiability: boolean;
}

function validAmount(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function quoteDate(value: string | undefined): string {
  if (!value) return "";
  const time = Date.parse(value);
  return Number.isNaN(time) ? "" : new Date(time).toISOString().slice(0, 10);
}

function latestStockQuote(stock: TrackedStock, data: TrackerData) {
  const snapshots = (data.stockQuotes ?? []).filter((snapshot) => snapshot.stockId === stock.id);
  if (stock.latestQuote) {
    snapshots.push({ ...stock.latestQuote, id: "latest", stockId: stock.id });
  }
  return snapshots
    .filter((snapshot) => Number.isFinite(snapshot.price) && snapshot.price > 0 && !Number.isNaN(Date.parse(snapshot.timestamp)))
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))[0];
}

function latestNav(asset: AssetRecord) {
  return [...(asset.navHistory ?? [])]
    .filter((snapshot) => Number.isFinite(snapshot.nav) && snapshot.nav > 0 && /^\d{4}-\d{2}-\d{2}$/.test(snapshot.date))
    .sort((left, right) => right.date.localeCompare(left.date))[0];
}

function latestAutomatedPrice(records: readonly AssetPriceHistoryRecord[], assetId: string, instrumentId?: string) {
  return records.filter((record) =>
    record.asset_id === assetId && (!instrumentId || record.instrument_id === instrumentId))
    .sort((left, right) => right.fetched_at.localeCompare(left.fetched_at))[0];
}

function npsValue(asset: AssetRecord, automatedHistory: readonly AssetPriceHistoryRecord[]): number | null {
  const schemes = asset.npsSchemes ?? [];
  if (!schemes.length) return null;
  const automatedValues = schemes.map((scheme) => {
    const history = scheme.schemeId ? latestAutomatedPrice(automatedHistory, asset.id, scheme.schemeId) : undefined;
    return history && validAmount(scheme.units) !== null &&
      (!scheme.navDate || history.price_date >= scheme.navDate)
      ? history.price * (scheme.units ?? 0)
      : null;
  });
  if (automatedValues.every((value) => value !== null)) {
    return automatedValues.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  }
  if (validAmount(asset.currentValue) !== null) return asset.currentValue;
  const schemeValues = schemes.map((scheme) => {
    if (validAmount(scheme.currentValue) !== null) return scheme.currentValue;
    return validAmount(scheme.units) !== null && validAmount(scheme.nav) !== null
      ? (scheme.units ?? 0) * (scheme.nav ?? 0)
      : null;
  });
  if (schemeValues.every((value) => value !== null)) {
    return schemeValues.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  }
  return null;
}

function assetPosition(asset: AssetRecord, automatedHistory: readonly AssetPriceHistoryRecord[]): InvestmentPosition {
  const nav = latestNav(asset);
  const localNavValue = nav?.nav ?? validAmount(asset.latestNav) ?? null;
  const localNavDate = nav?.date ?? asset.latestNavDate ?? "";
  const automatedNav = latestAutomatedPrice(automatedHistory, asset.id);
  const latestRecordedValuationDate = [asset.valuationDate, localNavDate].filter(Boolean).sort().pop();
  const useAutomatedNav = asset.type === "Mutual fund" && automatedNav &&
    asset.quantity !== null && asset.quantity > 0 &&
    (!latestRecordedValuationDate || automatedNav.price_date >= latestRecordedValuationDate);
  const npsDerived = asset.type === "NPS" && validAmount(asset.currentValue) === null &&
    npsValue(asset, automatedHistory) !== null;
  const latestNpsDate = npsDerived
    ? [
      ...automatedHistory.filter((record) => record.asset_id === asset.id && record.asset_type === "NPS").map((record) => record.price_date),
      ...(asset.npsSchemes ?? []).map((scheme) => scheme.navDate ?? ""),
    ].filter(Boolean).sort().pop()
    : undefined;
  const currentValue = asset.type === "NPS"
    ? npsValue(asset, automatedHistory)
    : useAutomatedNav ? null : validAmount(asset.currentValue);
  const currentWithNav = currentValue ?? (
    asset.type === "Mutual fund" && asset.quantity !== null && asset.quantity > 0 && (useAutomatedNav || localNavValue !== null)
      ? asset.quantity * (useAutomatedNav ? automatedNav.price : localNavValue ?? 0)
      : null
  );
  const investedValue = validAmount(asset.investedValue);
  return {
    id: `asset:${asset.id}`,
    name: asset.name,
    assetType: asset.type,
    institution: asset.institution || "Not recorded",
    currency: asset.currency,
    quantity: validAmount(asset.quantity),
    investedValue,
    currentValue: currentWithNav,
    valueDate: useAutomatedNav ? automatedNav.price_date : npsDerived
      ? latestNpsDate || asset.valuationDate || ""
      : currentValue !== null
        ? asset.valuationDate || localNavDate || ""
        : localNavDate || asset.valuationDate || "",
    source: npsDerived
      ? "NPS scheme values from recorded units and available NAVs"
      : currentValue === null && currentWithNav !== null
        ? `Calculated from units × ${useAutomatedNav ? "automated NAV" : "latest NAV"}`
        : "Asset record",
    recordedDifference: investedValue !== null && currentWithNav !== null ? currentWithNav - investedValue : null,
  };
}

export function buildInvestmentPositions(
  data: TrackerData,
  automatedHistory: readonly AssetPriceHistoryRecord[] = [],
): InvestmentPosition[] {
  const stockPositions = (data.stocks ?? []).map((stock): InvestmentPosition => {
    const quote = latestStockQuote(stock, data);
    const automatedQuote = latestAutomatedPrice(automatedHistory, stock.id);
    const useAutomatedQuote = automatedQuote &&
      (!quote || automatedQuote.fetched_at > quote.timestamp);
    const quantity = validAmount(stock.quantity);
    const averageBuyPrice = validAmount(stock.averageBuyPrice);
    const investedValue = averageBuyPrice !== null && quantity !== null
      ? averageBuyPrice * quantity
      : null;
    const quotePrice = useAutomatedQuote ? automatedQuote.price : quote?.price;
    const currentValue = quotePrice !== undefined && quantity !== null ? quotePrice * quantity : null;
    return {
      id: `stock:${stock.id}`,
      name: stock.name || stock.symbol,
      assetType: "Stock",
      institution: stock.broker || "Not recorded",
      currency: useAutomatedQuote ? automatedQuote.currency : quote?.currency || "Not recorded",
      quantity,
      investedValue,
      currentValue,
      valueDate: useAutomatedQuote ? automatedQuote.price_date : quoteDate(quote?.timestamp),
      source: useAutomatedQuote ? "Latest automated quote × quantity" : quote ? "Latest recorded quote × quantity" : "No recorded quote",
      recordedDifference: investedValue !== null && currentValue !== null ? currentValue - investedValue : null,
    };
  });
  const assetPositions = (data.assets ?? [])
    .filter((asset) => asset.type !== "Loan" && asset.type !== "Home loan" && asset.type !== "Vehicle")
    .map((asset) => assetPosition(asset, automatedHistory));
  return [...stockPositions, ...assetPositions].sort((left, right) =>
    left.assetType.localeCompare(right.assetType) || left.name.localeCompare(right.name));
}

export function buildAssetHistory(data: TrackerData): AssetHistoryPoint[] {
  const points: AssetHistoryPoint[] = [];
  const stocks = new Map((data.stocks ?? []).map((stock) => [stock.id, stock]));
  for (const quote of data.stockQuotes ?? []) {
    const stock = stocks.get(quote.stockId);
    const date = quoteDate(quote.timestamp);
    if (!stock || !date || !Number.isFinite(quote.price) || quote.price <= 0) continue;
    points.push({
      id: `stock:${quote.id}`,
      seriesId: `stock:${stock.id}`,
      name: stock.name || stock.symbol,
      assetType: "Stock",
      date,
      value: quote.price,
      currency: quote.currency,
      unit: "per share",
      units: validAmount(stock.quantity),
      source: "Recorded quote",
    });
  }
  for (const stock of data.stocks ?? []) {
    if (!stock.latestQuote) continue;
    const date = quoteDate(stock.latestQuote.timestamp);
    const id = `stock:latest:${stock.id}:${stock.latestQuote.timestamp}`;
    if (!date || points.some((point) =>
      point.seriesId === `stock:${stock.id}` && point.date === date &&
      point.value === stock.latestQuote?.price && point.currency === stock.latestQuote?.currency) ||
      !Number.isFinite(stock.latestQuote.price) || stock.latestQuote.price <= 0) continue;
    points.push({
      id,
      seriesId: `stock:${stock.id}`,
      name: stock.name || stock.symbol,
      assetType: "Stock",
      date,
      value: stock.latestQuote.price,
      currency: stock.latestQuote.currency,
      unit: "per share",
      units: validAmount(stock.quantity),
      source: "Latest recorded quote",
    });
  }

  for (const asset of data.assets ?? []) {
    for (const snapshot of asset.navHistory ?? []) {
      if (!Number.isFinite(snapshot.nav) || snapshot.nav <= 0) continue;
      points.push({
        id: `nav:${asset.id}:${snapshot.id}`,
        seriesId: `asset:${asset.id}`,
        name: asset.name,
        assetType: asset.type,
        date: snapshot.date,
        value: snapshot.nav,
        currency: asset.currency,
        unit: "per unit",
        units: validAmount(asset.quantity),
        source: "Recorded NAV",
      });
    }
    if (asset.latestNav !== undefined && asset.latestNavDate && Number.isFinite(asset.latestNav) && asset.latestNav > 0 &&
      !points.some((point) => point.seriesId === `asset:${asset.id}` && point.date === asset.latestNavDate && point.value === asset.latestNav)) {
      points.push({
        id: `nav:latest:${asset.id}:${asset.latestNavDate}`,
        seriesId: `asset:${asset.id}`,
        name: asset.name,
        assetType: asset.type,
        date: asset.latestNavDate,
        value: asset.latestNav,
        currency: asset.currency,
        unit: "per unit",
        units: validAmount(asset.quantity),
        source: "Latest recorded NAV",
      });
    }
    for (const scheme of asset.npsSchemes ?? []) {
      for (const snapshot of scheme.navHistory ?? []) {
        if (!Number.isFinite(snapshot.nav) || snapshot.nav <= 0) continue;
        points.push({
          id: `nps:${asset.id}:${scheme.schemeId ?? scheme.schemeName}:${snapshot.id}`,
          seriesId: `nps:${asset.id}:${scheme.schemeId ?? scheme.schemeName}`,
          name: `${asset.name} · ${scheme.schemeName}`,
          assetType: "NPS",
          date: snapshot.date,
          value: snapshot.nav,
          currency: asset.currency,
          unit: "per unit",
          units: validAmount(scheme.units),
          source: "Recorded NPS NAV",
        });
      }
      if (scheme.nav !== null && scheme.navDate && Number.isFinite(scheme.nav) && scheme.nav > 0 &&
        !points.some((point) => point.seriesId === `nps:${asset.id}:${scheme.schemeId ?? scheme.schemeName}` &&
          point.date === scheme.navDate && point.value === scheme.nav)) {
        points.push({
          id: `nps:latest:${asset.id}:${scheme.schemeId ?? scheme.schemeName}:${scheme.navDate}`,
          seriesId: `nps:${asset.id}:${scheme.schemeId ?? scheme.schemeName}`,
          name: `${asset.name} · ${scheme.schemeName}`,
          assetType: "NPS",
          date: scheme.navDate,
          value: scheme.nav,
          currency: asset.currency,
          unit: "per unit",
          units: validAmount(scheme.units),
          source: "Latest recorded NPS NAV",
        });
      }
    }
    if (asset.type !== "Mutual fund" && asset.type !== "NPS" &&
      asset.valuationDate && validAmount(asset.currentValue) !== null &&
      !points.some((point) => point.seriesId === `asset:${asset.id}` &&
        point.date === asset.valuationDate && point.value === asset.currentValue)) {
      points.push({
        id: `valuation:${asset.id}:${asset.valuationDate}`,
        seriesId: `asset:${asset.id}`,
        name: asset.name,
        assetType: asset.type,
        date: asset.valuationDate,
        value: asset.currentValue ?? 0,
        currency: asset.currency,
        unit: "asset value",
        units: null,
        source: "Recorded valuation",
      });
    }
  }
  for (const vehicle of data.vehicles ?? []) {
    const valuations = [...(vehicle.valuationHistory ?? [])]
      .filter((valuation) => Number.isFinite(valuation.currentValue) && valuation.currentValue >= 0)
      .sort((left, right) => left.date.localeCompare(right.date));
    for (const valuation of valuations) {
      points.push({
        id: `vehicle:${vehicle.id}:${valuation.id}`,
        seriesId: `vehicle:${vehicle.id}`,
        name: vehicle.name,
        assetType: "Vehicle",
        date: valuation.date,
        value: valuation.currentValue,
        currency: "Not recorded",
        unit: "asset value",
        units: null,
        source: "Recorded vehicle valuation",
      });
    }
    if (vehicle.valuationDate && validAmount(vehicle.currentValue) !== null &&
      !points.some((point) => point.seriesId === `vehicle:${vehicle.id}` &&
        point.date === vehicle.valuationDate && point.value === vehicle.currentValue)) {
      points.push({
        id: `vehicle:latest:${vehicle.id}:${vehicle.valuationDate}`,
        seriesId: `vehicle:${vehicle.id}`,
        name: vehicle.name,
        assetType: "Vehicle",
        date: vehicle.valuationDate,
        value: vehicle.currentValue ?? 0,
        currency: "Not recorded",
        unit: "asset value",
        units: null,
        source: "Latest recorded vehicle valuation",
      });
    }
  }
  return points.filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date))
    .sort((left, right) => right.date.localeCompare(left.date) || left.name.localeCompare(right.name));
}

export function buildAssetManagerRecords(
  data: TrackerData,
  automatedHistory: readonly AssetPriceHistoryRecord[] = [],
): AssetManagerRecord[] {
  const vehicleNames = new Set((data.vehicles ?? []).map((vehicle) => vehicle.name.trim().toLocaleLowerCase()));
  const positions = buildInvestmentPositions(data, automatedHistory)
    .filter((position) => position.assetType !== "Vehicle" || !vehicleNames.has(position.name.trim().toLocaleLowerCase()));
  const records: AssetManagerRecord[] = positions.map((position) => ({ ...position, isLiability: false }));
  for (const asset of data.assets ?? []) {
    if (asset.type === "Vehicle" && !vehicleNames.has(asset.name.trim().toLocaleLowerCase())) {
      records.push({ ...assetPosition(asset, automatedHistory), isLiability: false });
      continue;
    }
    if (asset.type !== "Loan" && asset.type !== "Home loan") continue;
    const value = validAmount(asset.principalOutstanding) ?? validAmount(asset.currentValue);
    records.push({
      id: `asset:${asset.id}`,
      name: asset.name,
      assetType: asset.type,
      institution: asset.institution || "Not recorded",
      currency: asset.currency,
      quantity: null,
      investedValue: validAmount(asset.sanctionedAmount),
      currentValue: value,
      valueDate: asset.lastStatementDate || asset.valuationDate || "",
      source: "Recorded outstanding principal",
      recordedDifference: null,
      isLiability: true,
    });
  }
  for (const vehicle of data.vehicles ?? []) {
    const latest = [...(vehicle.valuationHistory ?? [])].sort((left, right) => right.date.localeCompare(left.date))[0];
    const currentValue = validAmount(vehicle.currentValue) ?? validAmount(latest?.currentValue);
    records.push({
      id: `vehicle:${vehicle.id}`,
      name: vehicle.name,
      assetType: "Vehicle",
      institution: "Not recorded",
      currency: "Not recorded",
      quantity: null,
      investedValue: validAmount(vehicle.purchaseValue) ?? validAmount(latest?.purchaseValue),
      currentValue,
      valueDate: vehicle.valuationDate || latest?.date || "",
      source: "Vehicle valuation",
      recordedDifference: null,
      isLiability: false,
    });
  }
  for (const account of data.bankAccounts ?? []) {
    records.push({
      id: `bank:${account.id}`,
      name: account.bankName,
      assetType: "Bank account",
      institution: account.bankName,
      currency: "Not recorded",
      quantity: null,
      investedValue: null,
      currentValue: validAmount(account.currentBalance),
      valueDate: account.balanceAsOfDate || "",
      source: "Recorded balance; currency not recorded",
      recordedDifference: null,
      isLiability: false,
    });
  }
  return records.sort((left, right) =>
    left.assetType.localeCompare(right.assetType) || left.name.localeCompare(right.name));
}
