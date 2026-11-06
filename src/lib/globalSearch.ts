import type { Page, TrackerData } from "../types";

export interface GlobalSearchField {
  label: string;
  value: string;
}

export interface GlobalSearchResult {
  key: string;
  title: string;
  collection: string;
  page: Page;
  snippet: string;
  fields: GlobalSearchField[];
}

const collections: { key: keyof TrackerData; label: string; page: Page; titles: string[] }[] = [
  { key: "items", label: "Shopping list", page: "Shopping list", titles: ["name"] },
  { key: "purchases", label: "Purchase history", page: "Purchase history", titles: ["itemName"] },
  { key: "trips", label: "Shopping trips", page: "Shopping trips", titles: ["store"] },
  { key: "stores", label: "Stores", page: "Master data", titles: ["name"] },
  { key: "products", label: "Products", page: "Master data", titles: ["name"] },
  { key: "reminders", label: "Notes & reminders", page: "Notes & reminders", titles: ["title"] },
  { key: "stocks", label: "Stocks", page: "Stocks", titles: ["name", "symbol"] },
  { key: "stockQuotes", label: "Stock price snapshots", page: "Stocks", titles: ["symbol", "stockId"] },
  { key: "assets", label: "Assets", page: "Asset manager", titles: ["name"] },
  { key: "learningRecords", label: "Learning", page: "Learning", titles: ["title"] },
  { key: "trainingSessions", label: "Training & classes", page: "Training & classes", titles: ["courseName"] },
  { key: "educationRecords", label: "Schools & Colleges", page: "Schools & Colleges", titles: ["studentName", "institution"] },
  { key: "vehicles", label: "Vehicles", page: "Vehicles", titles: ["name"] },
  { key: "vehicleJourneys", label: "Vehicle journeys", page: "Vehicles", titles: ["purpose", "date"] },
  { key: "vehicleMaintenance", label: "Vehicle maintenance", page: "Vehicles", titles: ["description", "date"] },
  { key: "electricityReadings", label: "Electricity readings", page: "Electricity", titles: ["meterName", "location"] },
  { key: "subscriptions", label: "Subscriptions & bills", page: "Subscriptions & bills", titles: ["name", "provider"] },
  { key: "devotionalEntries", label: "Devotional entries", page: "Devotional", titles: ["scriptureReference", "date"] },
  { key: "devotionalResources", label: "Devotional resources", page: "Devotional", titles: ["title"] },
  { key: "prayerRequests", label: "Prayer requests", page: "Devotional", titles: ["title"] },
  { key: "cookingRecipes", label: "Cooking recipes", page: "Cooking", titles: ["name"] },
  { key: "cookingLogs", label: "Cooking logs", page: "Cooking", titles: ["occasion", "date"] },
  { key: "issueRecords", label: "Issues & maintenance", page: "Issues & maintenance", titles: ["title"] },
  { key: "personalEducation", label: "Education & career", page: "Education & career", titles: ["qualification", "institution"] },
  { key: "professionalQualifications", label: "Professional qualifications", page: "Education & career", titles: ["name"] },
  { key: "workExperiences", label: "Work experience", page: "Education & career", titles: ["jobTitle", "company"] },
  { key: "professionalSkills", label: "Professional skills", page: "Education & career", titles: ["name"] },
  { key: "familyMembers", label: "Family", page: "Family", titles: ["name"] },
  { key: "personalRecords", label: "Personal documents", page: "Personal documents", titles: ["title"] },
  { key: "documents", label: "Documents", page: "Documents", titles: ["title", "fileName"] },
  { key: "promptRecords", label: "AI Prompts", page: "AI Prompts", titles: ["title"] },
  { key: "mindfulHabits", label: "Mind & habits", page: "Mind & habits", titles: ["title"] },
  { key: "mindfulnessLogs", label: "Mindfulness logs", page: "Mind & habits", titles: ["emotion", "date"] },
  { key: "archivedRecords", label: "Archive", page: "Archive", titles: ["label"] },
];

const excludedKeys = new Set([
  "id", "itemid", "tripid", "vehicleid", "stockid", "recipeid", "completedhabitids",
  "password", "recoveryinfo", "credentialvault", "ciphertext", "salt", "iv", "storagepath",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectFields(value: unknown, fields: GlobalSearchField[], parentLabel = "") {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectFields(entry, fields, parentLabel));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (excludedKeys.has(key.toLocaleLowerCase())) continue;
    const label = parentLabel ? `${parentLabel} · ${key}` : key;
    if (typeof entry === "string" && entry.trim()) fields.push({ label, value: entry.trim() });
    else if (typeof entry === "number" || typeof entry === "boolean") fields.push({ label, value: String(entry) });
    else if (Array.isArray(entry) || isRecord(entry)) collectFields(entry, fields, label);
  }
}

function displayLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toLocaleUpperCase());
}

function getSnippet(fields: GlobalSearchField[], terms: string[]) {
  const match = fields.find((field) => terms.some((term) => `${field.label} ${field.value}`.toLocaleLowerCase().includes(term)));
  if (!match) return "";
  const text = `${displayLabel(match.label)}: ${match.value}`;
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

export function searchTrackerData(data: TrackerData, query: string): GlobalSearchResult[] {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const results: GlobalSearchResult[] = [];
  const stockNames = new Map((data.stocks ?? []).map((stock) => [stock.id, `${stock.symbol} · ${stock.name}`]));
  const vehicleNames = new Map((data.vehicles ?? []).map((vehicle) => [vehicle.id, vehicle.name]));

  for (const collection of collections) {
    const entries = data[collection.key];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!isRecord(entry) || typeof entry.id !== "string") continue;
      const fields: GlobalSearchField[] = [];
      collectFields(entry, fields);
      if (collection.key === "stockQuotes" && typeof entry.stockId === "string") {
        const stockName = stockNames.get(entry.stockId);
        if (stockName) fields.push({ label: "Stock", value: stockName });
      }
      if ((collection.key === "vehicleJourneys" || collection.key === "vehicleMaintenance") &&
        typeof entry.vehicleId === "string") {
        const vehicleName = vehicleNames.get(entry.vehicleId);
        if (vehicleName) fields.push({ label: "Vehicle", value: vehicleName });
      }
      const searchableText = fields.map(({ label, value }) => `${label} ${value}`).join(" ").toLocaleLowerCase();
      if (!terms.every((term) => searchableText.includes(term))) continue;
      const relatedTitle = collection.key === "stockQuotes" && typeof entry.stockId === "string"
        ? stockNames.get(entry.stockId)?.split(" · ")[0]
        : undefined;
      const title = relatedTitle ?? collection.titles
        .map((key) => entry[key])
        .find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? collection.label;
      results.push({
        key: `${collection.key}:${entry.id}`,
        title,
        collection: collection.label,
        page: collection.page,
        snippet: getSnippet(fields, terms),
        fields,
      });
    }
  }
  return results;
}
