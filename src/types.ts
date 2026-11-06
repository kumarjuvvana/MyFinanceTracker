export const CATEGORIES = [
  "Vegetables",
  "Groceries",
  "Fruits",
  "Household",
  "Personal Care",
  "Others",
] as const;
export const REMINDER_CATEGORIES = ["General", "Personal", "Health", "Finance", "Work", "Education", "Home"] as const;

export type Category = (typeof CATEGORIES)[number];
export const CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];
export type Page =
  | "Dashboard"
  | "Shopping list"
  | "Shopping trips"
  | "Purchase history"
  | "Price history"
  | "Reports"
  | "Notes & reminders"
  | "Master data"
  | "Stocks"
  | "Asset manager"
  | "Learning"
  | "Devotional"
  | "Schools & Colleges"
  | "Vehicles"
  | "Electricity"
  | "Personal documents"
  | "Account credentials"
  | "Data management"
  | "R&D / Test Connectors";

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: Category;
  estimatedPrice: number;
  purchased: boolean;
}

export interface Purchase {
  id: string;
  itemId: string;
  itemName: string;
  category: Category;
  quantity: number;
  unit: string;
  price: number;
  date: string;
  store: string;
  tripId?: string;
}

export interface ShoppingTrip {
  id: string;
  date: string;
  store: string;
  notes: string;
  purchaseIds: string[];
}

export interface Store {
  id: string;
  name: string;
  location: string;
}

export interface Product {
  id: string;
  name: string;
  category: Category;
  unit: string;
  estimatedPrice: number;
}

export interface Reminder {
  id: string;
  title: string;
  date: string;
  details: string;
  completed: boolean;
  category?: string;
}

export type StockExchange = "NSE" | "BSE";

export interface TrackedStock {
  id: string;
  symbol: string;
  name: string;
  exchange: StockExchange;
  broker: string;
  averageBuyPrice?: number | null;
  quantity?: number;
}

export interface StockQuoteSnapshot {
  id: string;
  stockId: string;
  price: number;
  currency: string;
  timestamp: string;
  marketState: string;
  previousClose: number | null;
}

export const ASSET_TYPES = [
  "Mutual fund",
  "Stock",
  "Loan",
  "Real estate",
  "Bond",
  "Digital gold",
  "Cash / deposit",
  "Other",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export interface AssetRecord {
  id: string;
  name: string;
  type: AssetType;
  institution: string;
  reference: string;
  link: string;
  currency: Currency;
  investedValue: number | null;
  currentValue: number | null;
  quantity: number | null;
  interestRate: number | null;
  startDate: string;
  maturityDate: string;
  location: string;
  notes: string;
  tags: string[];
}

export const EDUCATION_LEVELS = [
  "Nursery / Pre-KG",
  "LKG",
  "UKG",
  "Primary (Grades 1–5)",
  "Middle (Grades 6–8)",
  "Secondary (Grades 9–10)",
  "Higher secondary (Grades 11–12)",
  "College / university",
  "Other",
] as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export type EducationStatus = "Current" | "Completed" | "On hold";
export const EDUCATION_FEE_TYPES = ["Tuition", "Admission", "School van / transport", "Other"] as const;
export type EducationFeeType = (typeof EDUCATION_FEE_TYPES)[number];

export interface EducationSubject {
  id: string;
  name: string;
  code: string;
  credits: number | null;
  notes: string;
}

export interface EducationExam {
  id: string;
  name: string;
  assessmentType: string;
  subject: string;
  date: string;
  marksObtained: number | null;
  maximumMarks: number | null;
  grade: string;
  notes: string;
}

export interface EducationPayment {
  id: string;
  feeType?: EducationFeeType;
  period: string;
  amount: number;
  date: string;
  method: string;
  reference: string;
  notes: string;
}

export interface EducationRecord {
  id: string;
  studentName: string;
  institution: string;
  level: EducationLevel;
  gradeCourse: string;
  academicYear: string;
  status: EducationStatus;
  boardUniversity: string;
  startDate: string;
  endDate: string;
  annualFee: number | null;
  admissionFee?: number | null;
  schoolVanFee?: number | null;
  otherFee?: number | null;
  paidFee: number | null;
  currency: Currency;
  contactName: string;
  contact: string;
  link: string;
  notes: string;
  subjects?: EducationSubject[];
  exams?: EducationExam[];
  payments?: EducationPayment[];
}

export type LearningLevel = "Beginner" | "Basic" | "Intermediate" | "Advanced" | "Expert";
export type LearningStatus = "Not started" | "In progress" | "Completed";

export interface LearningRecord {
  id: string;
  title: string;
  topic: string;
  level: LearningLevel;
  status: LearningStatus;
  provider: string;
  resourceLink: string;
  aiLink: string;
  startedDate: string;
  completedDate: string;
  notes: string;
}

export interface Vehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  year: number | null;
  registration: string;
  fuelType: string;
  notes: string;
}

export interface VehicleJourney {
  id: string;
  vehicleId: string;
  date: string;
  startLocation: string;
  endLocation: string;
  odometerStart: number | null;
  odometerEnd: number | null;
  purpose: string;
  cost: number;
  notes: string;
}

export type VehicleMaintenanceType = "Service" | "Repair";

export interface VehicleMaintenance {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number | null;
  type: VehicleMaintenanceType;
  description: string;
  provider: string;
  cost: number;
  nextDueDate: string;
  nextDueOdometer: number | null;
  notes: string;
}

export interface ElectricityReading {
  id: string;
  meterName: string;
  location: string;
  readingDate: string;
  meterReading: number;
  periodStart: string;
  periodEnd: string;
  ratePerUnit: number | null;
  billAmount: number | null;
  paid: boolean;
  paidDate: string;
  notes: string;
}

export interface DevotionalEntry {
  id: string;
  date: string;
  scriptureReference: string;
  takeaway: string;
  reflection: string;
  prayerNotes: string;
}

export type PrayerRequestStatus = "Ongoing" | "Answered";

export interface PrayerRequest {
  id: string;
  title: string;
  details: string;
  dateAdded: string;
  status: PrayerRequestStatus;
  answeredDate: string;
}

export type PersonalRecordType =
  | "Identity"
  | "Insurance"
  | "License"
  | "Certificate"
  | "Other";

export interface PersonalRecordField {
  label: string;
  value: string;
}

export interface PersonalRecord {
  id: string;
  title: string;
  type: PersonalRecordType;
  holder: string;
  recordNumber: string;
  issuer: string;
  issueDate: string;
  dueDate: string;
  documentLink: string;
  notes: string;
  reminderDays: number;
  additionalFields: PersonalRecordField[];
}

export interface CredentialRecord {
  id: string;
  provider: string;
  category: string;
  website: string;
  username: string;
  password: string;
  recoveryInfo: string;
  notes: string;
  tags: string[];
  additionalFields: PersonalRecordField[];
}

export interface EncryptedCredentialVault {
  version: 1;
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface TrackerData {
  version: 1;
  items: ShoppingItem[];
  purchases: Purchase[];
  trips: ShoppingTrip[];
  stores?: Store[];
  products?: Product[];
  reminders?: Reminder[];
  reminderCategories?: string[];
  brokers?: string[];
  stocks?: TrackedStock[];
  stockQuotes?: StockQuoteSnapshot[];
  stockSeedVersion?: 1 | 2 | 3;
  assets?: AssetRecord[];
  learningRecords?: LearningRecord[];
  educationRecords?: EducationRecord[];
  vehicles?: Vehicle[];
  vehicleJourneys?: VehicleJourney[];
  vehicleMaintenance?: VehicleMaintenance[];
  electricityReadings?: ElectricityReading[];
  devotionalEntries?: DevotionalEntry[];
  prayerRequests?: PrayerRequest[];
  personalRecords?: PersonalRecord[];
  credentialVault?: EncryptedCredentialVault;
}

export const ITEM_UNITS = [
  "pcs", "kg", "g", "mg", "L", "ml", "dozen", "pack", "box", "bottle",
  "carton", "bag", "loaf", "bunch", "roll", "can", "jar", "pair", "set", "other",
] as const;
export const ACCENT_COLORS = ["green", "blue", "purple", "rose", "teal"] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];
export const DARK_THEMES = ["forest", "slate", "midnight"] as const;
export type DarkTheme = (typeof DARK_THEMES)[number];
export const VISUAL_THEMES = ["sage", "cloud", "sand"] as const;
export type VisualTheme = (typeof VISUAL_THEMES)[number];
export type FontSize = "small" | "medium" | "large";
export type FontStyle = "modern" | "editorial" | "rounded";
