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
  | "Training & classes"
  | "Devotional"
  | "Cooking"
  | "Issues & maintenance"
  | "Education & career"
  | "Family"
  | "Schools & Colleges"
  | "Vehicles"
  | "Electricity"
  | "Personal documents"
  | "Documents"
  | "Archive"
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

export type TrainingDeliveryMode = "In-person class" | "Online class" | "Virtual class" | "Self-study";

export interface TrainingSession {
  id: string;
  courseName: string;
  institution: string;
  mode: TrainingDeliveryMode;
  date: string;
  startTime: string;
  endTime: string;
  topic: string;
  instructor: string;
  learned: string;
  resourceLink: string;
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

export interface CookingRecipe {
  id: string;
  name: string;
  dishType: string;
  cuisine: string;
  country: string;
  ingredients: string;
  steps: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  nutritionNotes: string;
  healthNotes: string;
  dietaryTags: string[];
  allergens: string[];
  notes: string;
}

export interface CookedDish {
  recipeId: string | null;
  name: string;
}

export interface CookingLog {
  id: string;
  date: string;
  occasion: string;
  dishes: CookedDish[];
  rating: number | null;
  learning: string;
  notes: string;
}

export type IssueArea = "Personal" | "Professional" | "Home" | "Vehicle" | "Other";
export type IssueKind = "Issue" | "Repair" | "Maintenance" | "Task";
export type IssueStatus = "Open" | "In progress" | "Waiting" | "Resolved" | "Closed";
export type IssuePriority = "Low" | "Medium" | "High" | "Urgent";

export interface IssueRecord {
  id: string;
  title: string;
  area: IssueArea;
  customArea: string;
  kind: IssueKind;
  status: IssueStatus;
  priority: IssuePriority;
  dateReported: string;
  dueDate: string;
  assetName: string;
  location: string;
  assignedTo: string;
  provider: string;
  description: string;
  updates: string;
  estimatedCost: number | null;
  actualCost: number | null;
}

export interface PersonalEducationRecord {
  id: string;
  institution: string;
  qualification: string;
  fieldOfStudy: string;
  location: string;
  startDate: string;
  endDate: string;
  status: "Completed" | "In progress" | "On hold";
  grade: string;
  link: string;
  notes: string;
}

export interface ProfessionalQualification {
  id: string;
  name: string;
  issuer: string;
  credentialId: string;
  issueDate: string;
  expiryDate: string;
  link: string;
  notes: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  jobTitle: string;
  location: string;
  employmentType: string;
  startDate: string;
  endDate: string;
  current: boolean;
  summary: string;
  skills: string;
}

export interface ProfessionalSkill {
  id: string;
  name: string;
  category: string;
  proficiency: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  yearsExperience: number | null;
  notes: string;
}

export type FamilyRelationship =
  | "Self"
  | "Spouse"
  | "Child"
  | "Parent"
  | "Sibling"
  | "Grandparent"
  | "Grandchild"
  | "Aunt / Uncle"
  | "Cousin"
  | "In-law"
  | "Other";

export interface FamilyMember {
  id: string;
  name: string;
  relationship: FamilyRelationship;
  relationshipDetail: string;
  birthYear: number | null;
  birthPlace: string;
  currentResidence: string;
  phone: string;
  email: string;
  education: string;
  institution: string;
  occupation: string;
  organization: string;
  notes: string;
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

export interface DocumentAttachment {
  id: string;
  title: string;
  personName: string;
  notes: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedAt: string;
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
  trainingSessions?: TrainingSession[];
  educationRecords?: EducationRecord[];
  vehicles?: Vehicle[];
  vehicleJourneys?: VehicleJourney[];
  vehicleMaintenance?: VehicleMaintenance[];
  electricityReadings?: ElectricityReading[];
  devotionalEntries?: DevotionalEntry[];
  prayerRequests?: PrayerRequest[];
  cookingRecipes?: CookingRecipe[];
  cookingLogs?: CookingLog[];
  issueRecords?: IssueRecord[];
  personalEducation?: PersonalEducationRecord[];
  professionalQualifications?: ProfessionalQualification[];
  workExperiences?: WorkExperience[];
  professionalSkills?: ProfessionalSkill[];
  familyMembers?: FamilyMember[];
  archivedRecords?: ArchivedRecord[];
  personalRecords?: PersonalRecord[];
  documents?: DocumentAttachment[];
  credentialVault?: EncryptedCredentialVault;
}

export type ArchiveSnapshot = Partial<Omit<TrackerData, "version" | "archivedRecords" | "credentialVault">>;

export interface ArchivedRecord {
  id: string;
  label: string;
  archivedAt: string;
  snapshot: ArchiveSnapshot;
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
