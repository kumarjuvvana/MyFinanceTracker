import { ASSET_TYPES, CATEGORIES, CURRENCIES, EDUCATION_LEVELS, type AssetRecord, type Category, type Currency, type EducationRecord, type LearningRecord, type PersonalRecord, type Product, type Purchase, type Reminder, type StockQuoteSnapshot, type Store, type TrackerData, type TrackedStock, type Vehicle, type VehicleJourney, type VehicleMaintenance } from "../types.js";

export const STORAGE_KEY = "daybook-shopping-tracker";
export const STORAGE_VERSION = 1;
const STOCK_SEED_VERSION = 3;

export const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
export const createId = () => crypto.randomUUID();

export function makeSeedData(): TrackerData {
  const date = today();
  const previousDate = new Date();
  previousDate.setDate(previousDate.getDate() - 1);
  const yesterday = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}-${String(previousDate.getDate()).padStart(2, "0")}`;
  const items = [
    { id: "seed-1", name: "Ripe avocados", quantity: 3, unit: "pcs", category: "Fruits" as Category, estimatedPrice: 4.5, purchased: false },
    { id: "seed-2", name: "Sourdough bread", quantity: 1, unit: "loaf", category: "Groceries" as Category, estimatedPrice: 5.25, purchased: false },
    { id: "seed-3", name: "Cherry tomatoes", quantity: 2, unit: "boxes", category: "Vegetables" as Category, estimatedPrice: 6, purchased: false },
    { id: "seed-4", name: "Oat milk", quantity: 2, unit: "cartons", category: "Groceries" as Category, estimatedPrice: 7.5, purchased: true },
    { id: "seed-5", name: "Fresh tulips", quantity: 1, unit: "bunch", category: "Others" as Category, estimatedPrice: 8, purchased: true },
  ];
  const purchases: Purchase[] = [
    { id: "purchase-seed-1", itemId: "seed-4", itemName: "Oat milk", category: "Groceries", quantity: 2, unit: "cartons", price: 7.5, date, store: "The Corner Market" },
    { id: "purchase-seed-2", itemId: "seed-5", itemName: "Fresh tulips", category: "Others", quantity: 1, unit: "bunch", price: 8, date, store: "The Corner Market" },
    { id: "purchase-seed-3", itemId: "seed-6", itemName: "Baby spinach", category: "Vegetables", quantity: 1, unit: "bag", price: 3.75, date: yesterday, store: "Green Basket" },
  ];
  return {
    version: STORAGE_VERSION,
    items,
    purchases,
    trips: [
      { id: "trip-seed-1", date, store: "The Corner Market", notes: "A few everyday essentials", purchaseIds: ["purchase-seed-1", "purchase-seed-2"] },
      { id: "trip-seed-2", date: yesterday, store: "Green Basket", notes: "Fresh greens for the week", purchaseIds: ["purchase-seed-3"] },
    ],
    stores: [
      { id: "store-seed-1", name: "The Corner Market", location: "" },
      { id: "store-seed-2", name: "Green Basket", location: "" },
    ],
    products: [],
    reminders: [],
    brokers: [],
    stocks: [],
    stockQuotes: [],
    stockSeedVersion: STOCK_SEED_VERSION,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORIES.some((category) => category === value);
}

export function validateData(value: unknown): value is TrackerData {
  if (!isRecord(value) || value.version !== STORAGE_VERSION) return false;
  if (!Array.isArray(value.items) || !Array.isArray(value.purchases) || !Array.isArray(value.trips)) return false;
  const storesOk = value.stores === undefined || (Array.isArray(value.stores) && value.stores.every((store) =>
    isRecord(store) && typeof store.id === "string" && typeof store.name === "string" &&
    typeof store.location === "string"));
  const productsOk = value.products === undefined || (Array.isArray(value.products) && value.products.every((product) =>
    isRecord(product) && typeof product.id === "string" && typeof product.name === "string" &&
    isCategory(product.category) && typeof product.unit === "string" && product.unit.trim().length > 0 &&
    typeof product.estimatedPrice === "number" && Number.isFinite(product.estimatedPrice) && product.estimatedPrice >= 0));
  const remindersOk = value.reminders === undefined || (Array.isArray(value.reminders) && value.reminders.every((reminder) =>
    isRecord(reminder) && typeof reminder.id === "string" && typeof reminder.title === "string" &&
    typeof reminder.date === "string" && !Number.isNaN(Date.parse(reminder.date)) &&
    typeof reminder.details === "string" && typeof reminder.completed === "boolean" &&
    (reminder.category === undefined || typeof reminder.category === "string")));
  const brokersOk = value.brokers === undefined || (Array.isArray(value.brokers) && value.brokers.every((broker) =>
    typeof broker === "string" && broker.trim().length > 0));
  const stocksOk = value.stocks === undefined || (Array.isArray(value.stocks) && value.stocks.every((stock) => {
    if (!isRecord(stock)) return false;
    const averageMissing = stock.averageBuyPrice === undefined || stock.averageBuyPrice === null;
    const quantityMissing = stock.quantity === undefined || stock.quantity === 0;
    return typeof stock.id === "string" && typeof stock.symbol === "string" &&
      /^[A-Z0-9][A-Z0-9.&_-]{0,29}$/.test(stock.symbol) &&
      typeof stock.name === "string" && stock.name.trim().length > 0 &&
      (stock.exchange === "NSE" || stock.exchange === "BSE") &&
      typeof stock.broker === "string" &&
      (averageMissing || (typeof stock.averageBuyPrice === "number" &&
        Number.isFinite(stock.averageBuyPrice) && stock.averageBuyPrice > 0)) &&
      (stock.quantity === undefined || (typeof stock.quantity === "number" &&
        Number.isInteger(stock.quantity) && stock.quantity >= 0)) &&
      averageMissing === quantityMissing;
  }));
  const stockQuotesOk = value.stockQuotes === undefined || (Array.isArray(value.stockQuotes) && value.stockQuotes.every((quote) =>
    isRecord(quote) && typeof quote.id === "string" && typeof quote.stockId === "string" &&
    typeof quote.price === "number" && Number.isFinite(quote.price) && quote.price >= 0 &&
    typeof quote.currency === "string" && /^[A-Z]{3}$/.test(quote.currency) && typeof quote.timestamp === "string" &&
    !Number.isNaN(Date.parse(quote.timestamp)) && typeof quote.marketState === "string" &&
    (quote.previousClose === null || (typeof quote.previousClose === "number" &&
      Number.isFinite(quote.previousClose) && quote.previousClose >= 0))));
  const stockSeedVersionOk = value.stockSeedVersion === undefined ||
    (typeof value.stockSeedVersion === "number" && Number.isInteger(value.stockSeedVersion) &&
      value.stockSeedVersion >= 1 && value.stockSeedVersion <= STOCK_SEED_VERSION);
  const assetsOk = value.assets === undefined || (Array.isArray(value.assets) && value.assets.every((asset) =>
    isRecord(asset) && typeof asset.id === "string" && asset.id.length > 0 &&
    typeof asset.name === "string" && asset.name.trim().length > 0 &&
    typeof asset.type === "string" && ASSET_TYPES.some((type) => type === asset.type) &&
    typeof asset.institution === "string" && typeof asset.reference === "string" &&
    typeof asset.link === "string" && isSafeExternalLink(asset.link) &&
    typeof asset.currency === "string" && CURRENCIES.some((currency) => currency === asset.currency) &&
    (asset.investedValue === null || (typeof asset.investedValue === "number" && Number.isFinite(asset.investedValue) && asset.investedValue >= 0)) &&
    (asset.currentValue === null || (typeof asset.currentValue === "number" && Number.isFinite(asset.currentValue) && asset.currentValue >= 0)) &&
    (asset.quantity === null || (typeof asset.quantity === "number" && Number.isFinite(asset.quantity) && asset.quantity >= 0)) &&
    (asset.interestRate === null || (typeof asset.interestRate === "number" && Number.isFinite(asset.interestRate) && asset.interestRate >= 0 && asset.interestRate <= 100)) &&
    typeof asset.startDate === "string" && (asset.startDate === "" || !Number.isNaN(Date.parse(asset.startDate))) &&
    typeof asset.maturityDate === "string" && (asset.maturityDate === "" || !Number.isNaN(Date.parse(asset.maturityDate))) &&
    typeof asset.location === "string" && typeof asset.notes === "string" &&
    Array.isArray(asset.tags) && asset.tags.every((tag) => typeof tag === "string")));
  const educationRecordsOk = value.educationRecords === undefined || (Array.isArray(value.educationRecords) && value.educationRecords.every((entry) =>
    isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
    typeof entry.studentName === "string" && entry.studentName.trim().length > 0 &&
    typeof entry.institution === "string" && entry.institution.trim().length > 0 &&
    typeof entry.level === "string" && EDUCATION_LEVELS.some((level) => level === entry.level) &&
    typeof entry.gradeCourse === "string" && typeof entry.academicYear === "string" &&
    (entry.status === "Current" || entry.status === "Completed" || entry.status === "On hold") &&
    typeof entry.boardUniversity === "string" &&
    typeof entry.startDate === "string" && (entry.startDate === "" || !Number.isNaN(Date.parse(entry.startDate))) &&
    typeof entry.endDate === "string" && (entry.endDate === "" || !Number.isNaN(Date.parse(entry.endDate))) &&
    (entry.annualFee === null || (typeof entry.annualFee === "number" && Number.isFinite(entry.annualFee) && entry.annualFee >= 0)) &&
    (entry.paidFee === null || (typeof entry.paidFee === "number" && Number.isFinite(entry.paidFee) && entry.paidFee >= 0)) &&
    typeof entry.currency === "string" && CURRENCIES.some((currency) => currency === entry.currency) &&
    typeof entry.contactName === "string" && typeof entry.contact === "string" &&
    typeof entry.link === "string" && isSafeExternalLink(entry.link) &&
    typeof entry.notes === "string" &&
    (entry.subjects === undefined || (Array.isArray(entry.subjects) && entry.subjects.every((subject) =>
      isRecord(subject) && typeof subject.id === "string" && subject.id.length > 0 &&
      typeof subject.name === "string" && subject.name.trim().length > 0 &&
      typeof subject.code === "string" &&
      (subject.credits === null || (typeof subject.credits === "number" && Number.isFinite(subject.credits) && subject.credits >= 0)) &&
      typeof subject.notes === "string"))) &&
    (entry.exams === undefined || (Array.isArray(entry.exams) && entry.exams.every((exam) =>
      isRecord(exam) && typeof exam.id === "string" && exam.id.length > 0 &&
      typeof exam.name === "string" && exam.name.trim().length > 0 &&
      typeof exam.assessmentType === "string" && exam.assessmentType.trim().length > 0 &&
      typeof exam.subject === "string" &&
      typeof exam.date === "string" && (exam.date === "" || !Number.isNaN(Date.parse(exam.date))) &&
      (exam.marksObtained === null || (typeof exam.marksObtained === "number" && Number.isFinite(exam.marksObtained) && exam.marksObtained >= 0)) &&
      (exam.maximumMarks === null || (typeof exam.maximumMarks === "number" && Number.isFinite(exam.maximumMarks) && exam.maximumMarks > 0)) &&
      ((exam.marksObtained === null) === (exam.maximumMarks === null)) &&
      (exam.marksObtained === null || exam.maximumMarks === null || exam.marksObtained <= exam.maximumMarks) &&
      typeof exam.grade === "string" && (exam.marksObtained !== null || exam.grade.trim().length > 0) &&
      typeof exam.notes === "string"))) &&
    (entry.payments === undefined || (Array.isArray(entry.payments) && entry.payments.every((payment) =>
      isRecord(payment) && typeof payment.id === "string" && payment.id.length > 0 &&
      typeof payment.period === "string" && payment.period.trim().length > 0 &&
      typeof payment.amount === "number" && Number.isFinite(payment.amount) && payment.amount > 0 &&
      typeof payment.date === "string" && !Number.isNaN(Date.parse(payment.date)) &&
      typeof payment.method === "string" && typeof payment.reference === "string" &&
      typeof payment.notes === "string")))));
  const learningRecordsOk = value.learningRecords === undefined || (Array.isArray(value.learningRecords) && value.learningRecords.every((entry) =>
    isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
    typeof entry.title === "string" && entry.title.trim().length > 0 &&
    typeof entry.topic === "string" &&
    (entry.level === "Beginner" || entry.level === "Basic" || entry.level === "Intermediate" ||
      entry.level === "Advanced" || entry.level === "Expert") &&
    (entry.status === "Not started" || entry.status === "In progress" || entry.status === "Completed") &&
    typeof entry.provider === "string" &&
    typeof entry.resourceLink === "string" && isSafeExternalLink(entry.resourceLink) &&
    typeof entry.aiLink === "string" && isSafeExternalLink(entry.aiLink) &&
    typeof entry.startedDate === "string" && (entry.startedDate === "" || !Number.isNaN(Date.parse(entry.startedDate))) &&
    typeof entry.completedDate === "string" && (entry.completedDate === "" || !Number.isNaN(Date.parse(entry.completedDate))) &&
    typeof entry.notes === "string"));
  const vehiclesOk = value.vehicles === undefined || (Array.isArray(value.vehicles) && value.vehicles.every((vehicle) =>
    isRecord(vehicle) && typeof vehicle.id === "string" && typeof vehicle.name === "string" &&
    typeof vehicle.make === "string" && typeof vehicle.model === "string" &&
    (vehicle.year === null || (typeof vehicle.year === "number" && Number.isInteger(vehicle.year) && vehicle.year >= 1886)) &&
    typeof vehicle.registration === "string" && typeof vehicle.fuelType === "string" && typeof vehicle.notes === "string"));
  const vehicleJourneysOk = value.vehicleJourneys === undefined || (Array.isArray(value.vehicleJourneys) && value.vehicleJourneys.every((journey) =>
    isRecord(journey) && typeof journey.id === "string" && typeof journey.vehicleId === "string" &&
    typeof journey.date === "string" && !Number.isNaN(Date.parse(journey.date)) &&
    typeof journey.startLocation === "string" && typeof journey.endLocation === "string" &&
    (journey.odometerStart === null || (typeof journey.odometerStart === "number" && Number.isFinite(journey.odometerStart) && journey.odometerStart >= 0)) &&
    (journey.odometerEnd === null || (typeof journey.odometerEnd === "number" && Number.isFinite(journey.odometerEnd) && journey.odometerEnd >= 0)) &&
    (journey.odometerStart === null || journey.odometerEnd === null || journey.odometerEnd >= journey.odometerStart) &&
    typeof journey.purpose === "string" && typeof journey.cost === "number" &&
    Number.isFinite(journey.cost) && journey.cost >= 0 && typeof journey.notes === "string"));
  const vehicleMaintenanceOk = value.vehicleMaintenance === undefined || (Array.isArray(value.vehicleMaintenance) && value.vehicleMaintenance.every((entry) =>
    isRecord(entry) && typeof entry.id === "string" && typeof entry.vehicleId === "string" &&
    typeof entry.date === "string" && !Number.isNaN(Date.parse(entry.date)) &&
    (entry.odometer === null || (typeof entry.odometer === "number" && Number.isFinite(entry.odometer) && entry.odometer >= 0)) &&
    (entry.type === "Service" || entry.type === "Repair") && typeof entry.description === "string" &&
    typeof entry.provider === "string" && typeof entry.cost === "number" &&
    Number.isFinite(entry.cost) && entry.cost >= 0 &&
    typeof entry.nextDueDate === "string" &&
    (entry.nextDueDate === "" || !Number.isNaN(Date.parse(entry.nextDueDate))) &&
    (entry.nextDueOdometer === null || (typeof entry.nextDueOdometer === "number" &&
      Number.isFinite(entry.nextDueOdometer) && entry.nextDueOdometer >= 0)) &&
    typeof entry.notes === "string"));
  const personalRecordsOk = value.personalRecords === undefined || (Array.isArray(value.personalRecords) && value.personalRecords.every((entry) =>
    isRecord(entry) && typeof entry.id === "string" && typeof entry.title === "string" &&
    (entry.type === "Identity" || entry.type === "Insurance" || entry.type === "License" ||
      entry.type === "Certificate" || entry.type === "Other") &&
    typeof entry.holder === "string" && typeof entry.recordNumber === "string" &&
    typeof entry.issuer === "string" && typeof entry.issueDate === "string" &&
    (entry.issueDate === "" || !Number.isNaN(Date.parse(entry.issueDate))) &&
    typeof entry.dueDate === "string" &&
    (entry.dueDate === "" || !Number.isNaN(Date.parse(entry.dueDate))) &&
    typeof entry.documentLink === "string" && isSafeExternalLink(entry.documentLink) &&
    typeof entry.notes === "string" &&
    typeof entry.reminderDays === "number" && [0, 7, 30, 60, 90].includes(entry.reminderDays) &&
    (entry.additionalFields === undefined || (Array.isArray(entry.additionalFields) && entry.additionalFields.every((field) =>
      isRecord(field) && typeof field.label === "string" && typeof field.value === "string")))));
  const credentialVaultOk = value.credentialVault === undefined || (() => {
    const vault = value.credentialVault;
    return isRecord(vault) && vault.version === 1 && vault.kdf === "PBKDF2-SHA-256" &&
      Number.isInteger(vault.iterations) && vault.iterations === 310_000 &&
      typeof vault.salt === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(vault.salt) &&
      typeof vault.iv === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(vault.iv) &&
      typeof vault.ciphertext === "string" && /^[A-Za-z0-9+/]+={0,2}$/.test(vault.ciphertext);
  })();
  const itemOk = value.items.every((item) =>
    isRecord(item) && typeof item.id === "string" && typeof item.name === "string" &&
    typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0 &&
    typeof item.unit === "string" && isCategory(item.category) &&
    typeof item.estimatedPrice === "number" && Number.isFinite(item.estimatedPrice) && item.estimatedPrice >= 0 &&
    typeof item.purchased === "boolean");
  const purchaseOk = value.purchases.every((purchase) =>
    isRecord(purchase) && typeof purchase.id === "string" && typeof purchase.itemId === "string" &&
    typeof purchase.itemName === "string" && isCategory(purchase.category) &&
    typeof purchase.quantity === "number" && Number.isFinite(purchase.quantity) && purchase.quantity > 0 &&
    typeof purchase.unit === "string" && typeof purchase.price === "number" &&
    Number.isFinite(purchase.price) && purchase.price >= 0 &&
    typeof purchase.date === "string" && !Number.isNaN(Date.parse(purchase.date)) &&
    typeof purchase.store === "string" && (purchase.tripId === undefined || typeof purchase.tripId === "string"));
  const tripOk = value.trips.every((trip) =>
    isRecord(trip) && typeof trip.id === "string" && typeof trip.date === "string" &&
    !Number.isNaN(Date.parse(trip.date)) && typeof trip.store === "string" &&
    typeof trip.notes === "string" && Array.isArray(trip.purchaseIds) &&
    trip.purchaseIds.every((id) => typeof id === "string"));
  if (!itemOk || !purchaseOk || !tripOk || !storesOk || !productsOk || !remindersOk ||
    !brokersOk || !stocksOk || !stockQuotesOk || !stockSeedVersionOk ||
    !assetsOk || !educationRecordsOk || !learningRecordsOk ||
    !vehiclesOk || !vehicleJourneysOk || !vehicleMaintenanceOk || !personalRecordsOk ||
    !credentialVaultOk) return false;
  if (Array.isArray(value.stores) && new Set((value.stores as Store[]).map((store) => store.id)).size !== value.stores.length) return false;
  if (Array.isArray(value.products) && new Set((value.products as Product[]).map((product) => product.id)).size !== value.products.length) return false;
  if (Array.isArray(value.reminders) && new Set((value.reminders as Reminder[]).map((reminder) => reminder.id)).size !== value.reminders.length) return false;
  if (Array.isArray(value.stocks) && new Set((value.stocks as TrackedStock[]).map((stock) => stock.id)).size !== value.stocks.length) return false;
  if (Array.isArray(value.assets) && new Set((value.assets as AssetRecord[]).map((asset) => asset.id)).size !== value.assets.length) return false;
  if (Array.isArray(value.educationRecords) && new Set((value.educationRecords as EducationRecord[]).map((entry) => entry.id)).size !== value.educationRecords.length) return false;
  if (Array.isArray(value.learningRecords) && new Set((value.learningRecords as LearningRecord[]).map((entry) => entry.id)).size !== value.learningRecords.length) return false;
  if (Array.isArray(value.educationRecords)) {
    for (const record of value.educationRecords as EducationRecord[]) {
      if (new Set((record.subjects ?? []).map((subject) => subject.id)).size !== (record.subjects ?? []).length ||
        new Set((record.exams ?? []).map((exam) => exam.id)).size !== (record.exams ?? []).length ||
        new Set((record.payments ?? []).map((payment) => payment.id)).size !== (record.payments ?? []).length) return false;
    }
  }
  if (Array.isArray(value.stockQuotes) && new Set((value.stockQuotes as StockQuoteSnapshot[]).map((quote) => quote.id)).size !== value.stockQuotes.length) return false;
  if (Array.isArray(value.vehicles) && new Set((value.vehicles as Vehicle[]).map((vehicle) => vehicle.id)).size !== value.vehicles.length) return false;
  if (Array.isArray(value.vehicleJourneys) && new Set((value.vehicleJourneys as VehicleJourney[]).map((journey) => journey.id)).size !== value.vehicleJourneys.length) return false;
  if (Array.isArray(value.vehicleMaintenance) && new Set((value.vehicleMaintenance as VehicleMaintenance[]).map((entry) => entry.id)).size !== value.vehicleMaintenance.length) return false;
  if (Array.isArray(value.personalRecords) && new Set((value.personalRecords as PersonalRecord[]).map((entry) => entry.id)).size !== value.personalRecords.length) return false;
  if (Array.isArray(value.brokers) && new Set((value.brokers as string[]).map((broker) => broker.toLowerCase())).size !== value.brokers.length) return false;
  if (Array.isArray(value.stocks)) {
    const stocks = value.stocks as TrackedStock[];
    if (new Set(stocks.map((stock) => `${stock.exchange}:${stock.symbol.toUpperCase()}`)).size !== stocks.length) return false;
    const brokerNames = new Set((value.brokers as string[] | undefined ?? []));
    if (!stocks.every((stock) => stock.broker === "" || brokerNames.has(stock.broker))) return false;
  }
  const uniqueIds = (entries: unknown[]) => {
    const ids = entries.map((entry) => (entry as Record<string, unknown>).id);
    return new Set(ids).size === ids.length;
  };
  if (!uniqueIds(value.items) || !uniqueIds(value.purchases) || !uniqueIds(value.trips)) return false;
  const purchaseIds = new Set((value.purchases as Purchase[]).map((purchase) => purchase.id));
  if (!(value.trips as TrackerData["trips"]).every((trip) => trip.purchaseIds.every((id) => purchaseIds.has(id)))) return false;
  if (Array.isArray(value.stockQuotes)) {
    const stockIds = new Set((value.stocks as TrackedStock[] | undefined ?? []).map((stock) => stock.id));
    if (!(value.stockQuotes as StockQuoteSnapshot[]).every((quote) => stockIds.has(quote.stockId))) return false;
  }
  const vehicleIds = new Set((value.vehicles as Vehicle[] | undefined ?? []).map((vehicle) => vehicle.id));
  if (!(value.vehicleJourneys as VehicleJourney[] | undefined ?? []).every((journey) => vehicleIds.has(journey.vehicleId)) ||
    !(value.vehicleMaintenance as VehicleMaintenance[] | undefined ?? []).every((entry) => vehicleIds.has(entry.vehicleId))) return false;
  return true;
}

export function normalizeTrackerData(data: TrackerData): TrackerData {
  const stocks = (data.stocks ?? []).map((stock) => ({
    ...stock,
    averageBuyPrice: stock.averageBuyPrice ?? null,
    quantity: stock.quantity ?? 0,
  }));
  const stockQuotes = [...(data.stockQuotes ?? [])];
  return {
    ...data,
    stores: data.stores ?? [],
    products: data.products ?? [],
    reminders: (data.reminders ?? []).map((reminder) => ({
      ...reminder,
      category: reminder.category?.trim() || "General",
    })),
    brokers: data.brokers ?? [],
    stocks,
    stockQuotes,
    stockSeedVersion: STOCK_SEED_VERSION,
    assets: data.assets ?? [],
    learningRecords: data.learningRecords ?? [],
    educationRecords: (data.educationRecords ?? []).map((record) => ({
      ...record,
      subjects: record.subjects ?? [],
      exams: record.exams ?? [],
      payments: record.payments ?? [],
    })),
    vehicles: data.vehicles ?? [],
    vehicleJourneys: data.vehicleJourneys ?? [],
    vehicleMaintenance: data.vehicleMaintenance ?? [],
    personalRecords: (data.personalRecords ?? []).map((record) => ({
      ...record,
      additionalFields: record.additionalFields ?? [],
    })),
  };
}

function isSafeExternalLink(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function formatCurrency(amount: number, currency: Currency = "INR"): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function exportCsv(purchases: Purchase[]): string {
  const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  return [
    ["Date", "Item", "Category", "Quantity", "Unit", "Price", "Store"],
    ...purchases.map((purchase) => [
      purchase.date,
      purchase.itemName,
      purchase.category,
      purchase.quantity,
      purchase.unit,
      purchase.price.toFixed(2),
      purchase.store,
    ]),
  ].map((row) => row.map(quote).join(",")).join("\r\n");
}
