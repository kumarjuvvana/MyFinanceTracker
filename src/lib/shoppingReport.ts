import type { Purchase } from "../types";
import type { ReportDefinition } from "./reportAnalytics";

export const shoppingPurchaseReport: ReportDefinition<Purchase> = {
  id: "shopping-purchases",
  dateOf: (purchase) => purchase.date,
  dimensions: [
    { id: "store", label: "Store", getValue: (purchase) => purchase.store },
    { id: "category", label: "Category", getValue: (purchase) => purchase.category },
  ],
  measures: [
    { id: "spend", label: "Spend", getValue: (purchase) => purchase.price },
  ],
};
