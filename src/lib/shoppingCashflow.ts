import type { Purchase } from "../types";
import {
  loadFinanceSourceDataset,
  MAX_FINANCE_SOURCE_RECORDS,
} from "./externalFinanceSource";
import type { ReportDefinition } from "./reportAnalytics";

export const LOCAL_SHOPPING_SOURCE = "MyFinanceTracker";
export const EXTERNAL_SHOPPING_SOURCE = "External payments";
export const ALL_SHOPPING_SOURCES = "All sources";
export const MAX_EXTERNAL_SHOPPING_RECORDS = MAX_FINANCE_SOURCE_RECORDS;

export interface ExternalShoppingPayment {
  id: string;
  date: string;
  amount: number;
  currency: string;
  category: string;
  payee: string;
  traderName: string;
  type: string;
  status: string;
  quantity: number | null;
  unit: string;
}

export interface ShoppingCashflowRecord {
  id: string;
  date: string;
  category: string;
  price: number;
  currency: string;
  store: string;
  source: string;
  paymentStatus: string;
  paymentType: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  tripId?: string;
  localPurchase?: Purchase;
}

export const shoppingCashflowReport: ReportDefinition<ShoppingCashflowRecord> = {
  id: "shopping-cashflow-sources",
  dateOf: (record) => record.date,
  dimensions: [
    { id: "store", label: "Store / payee", getValue: (record) => record.store },
    { id: "category", label: "Category", getValue: (record) => record.category },
    { id: "source", label: "Data source", getValue: (record) => record.source },
    { id: "paymentType", label: "Payment type", getValue: (record) => record.paymentType },
  ],
  measures: [
    { id: "spend", label: "Recorded payments", getValue: (record) => record.price },
  ],
};

function amountValue(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function quantityValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const quantity = typeof value === "number" ? value : Number(value);
  return Number.isFinite(quantity) ? quantity : null;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseExternalShoppingPayment(value: unknown): ExternalShoppingPayment {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("The external shopping source returned an invalid payment record.");
  }
  const row = value as Record<string, unknown>;
  const id = textValue(row.id);
  const date = textValue(row.date);
  const amount = amountValue(row.amount);
  const currency = textValue(row.currency);
  const category = textValue(row.category);
  const payee = textValue(row.payee);
  const traderName = textValue(row.traderName);
  const type = textValue(row.type);
  const status = textValue(row.status);
  const unit = textValue(row.unit);
  const quantity = quantityValue(row.quantity);
  if (!id || !date || !isDate(date) || amount === null || currency === null || category === null ||
    payee === null || traderName === null || type === null || status === null || unit === null ||
    (row.quantity !== null && row.quantity !== undefined && quantity === null)) {
    throw new Error("The external shopping source returned a payment with missing or invalid fields.");
  }
  return {
    id,
    date,
    amount,
    currency: currency ? currency.toUpperCase() : "Not recorded",
    category: category || "Uncategorized",
    payee,
    traderName,
    type: type || "Unspecified",
    status: status || "unspecified",
    quantity,
    unit,
  };
}

export function localShoppingCashflowRecords(
  purchases: readonly Purchase[],
  currency: string,
): ShoppingCashflowRecord[] {
  return purchases.map((purchase) => ({
    id: `local:${purchase.id}`,
    date: purchase.date,
    category: purchase.category,
    price: purchase.price,
    currency,
    store: purchase.store || "Not recorded",
    source: LOCAL_SHOPPING_SOURCE,
    paymentStatus: "paid",
    paymentType: "Purchase",
    itemId: purchase.itemId,
    itemName: purchase.itemName,
    quantity: purchase.quantity,
    unit: purchase.unit,
    ...(purchase.tripId ? { tripId: purchase.tripId } : {}),
    localPurchase: purchase,
  }));
}

export function externalShoppingCashflowRecords(
  payments: readonly ExternalShoppingPayment[],
): { records: ShoppingCashflowRecord[]; excludedStatusCount: number } {
  const paidPayments = payments.filter((payment) => payment.status.toLocaleLowerCase() === "paid");
  return {
    records: paidPayments.map((payment) => ({
      id: `external:${payment.id}`,
      date: payment.date,
      category: payment.category || "Uncategorized",
      price: payment.amount,
      currency: payment.currency,
      store: payment.traderName || payment.payee || "Not recorded",
      source: EXTERNAL_SHOPPING_SOURCE,
      paymentStatus: payment.status,
      paymentType: payment.type,
      itemId: "",
      itemName: "",
      quantity: payment.quantity ?? 0,
      unit: payment.unit,
    })),
    excludedStatusCount: payments.length - paidPayments.length,
  };
}

export async function loadExternalShoppingPayments(
  from: string,
  to: string,
  signal: AbortSignal,
): Promise<ExternalShoppingPayment[]> {
  const rows = await loadFinanceSourceDataset("payments", from, to, signal);
  return rows.map(parseExternalShoppingPayment);
}
