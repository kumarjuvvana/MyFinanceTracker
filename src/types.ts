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
  | "Favorites"
  | "Global search"
  | "Shopping list"
  | "Shopping trips"
  | "Purchase history"
  | "Price history"
  | "Reports"
  | "Notes & reminders"
  | "Important dates"
  | "Master data"
  | "Stocks"
  | "Asset manager"
  | "Bank accounts"
  | "Learning"
  | "Mind & habits"
  | "Activities"
  | "Morning exercise"
  | "Training & classes"
  | "Devotional"
  | "Cooking"
  | "Issues & maintenance"
  | "Education & career"
  | "Family"
  | "Schools & Colleges"
  | "Vehicles"
  | "Electricity"
  | "Subscriptions & bills"
  | "Personal documents"
  | "Documents"
  | "AI Prompts"
  | "Database manager"
  | "Hosting & storage"
  | "Archive"
  | "Account credentials"
  | "Data management"
  | "R&D / Test Connectors";
export const FAVORITABLE_PAGES: Page[] = [
  "Dashboard", "Global search", "Shopping list", "Shopping trips", "Purchase history",
  "Price history", "Reports", "Notes & reminders", "Important dates", "Master data", "Stocks", "Asset manager", "Bank accounts",
  "Learning", "Mind & habits", "Activities", "Morning exercise", "Training & classes", "Devotional", "Cooking",
  "Issues & maintenance", "Education & career", "Family", "Schools & Colleges", "Vehicles",
  "Electricity", "Subscriptions & bills", "Personal documents", "Documents", "AI Prompts",
  "Database manager", "Hosting & storage", "Archive", "Account credentials",
  "Data management", "R&D / Test Connectors",
];

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

export interface ImportantDateCategory {
  id: string;
  name: string;
}

export interface ImportantDateFeeling {
  id: string;
  name: string;
  sentiment: "Good" | "Bad" | "Mixed";
}

export interface ImportantDate {
  id: string;
  title: string;
  date: string;
  categoryId: string;
  feelingId: string;
  person: string;
  note: string;
  link: string;
  reminder: boolean;
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
  latestQuote?: StockQuotePrice;
}

export interface StockQuotePrice {
  price: number;
  currency: string;
  timestamp: string;
  marketState: string;
  previousClose: number | null;
}

export interface StockQuoteSnapshot extends StockQuotePrice {
  id: string;
  stockId: string;
}

export const ASSET_TYPES = [
  "Mutual fund",
  "NPS",
  "Stock",
  "Loan",
  "Home loan",
  "Fixed deposit",
  "Real estate",
  "Bond",
  "Digital gold",
  "Gold savings scheme",
  "Cash / deposit",
  "Vehicle",
  "Insurance",
  "Other",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];
export type AssetManagerVisibleType = Exclude<AssetType, "Stock"> | "Stocks" | "Bank accounts";

export const ASSET_MANAGER_VISIBLE_TYPES: AssetManagerVisibleType[] = [
  "Mutual fund",
  "NPS",
  "Stocks",
  "Loan",
  "Home loan",
  "Fixed deposit",
  "Real estate",
  "Bond",
  "Digital gold",
  "Gold savings scheme",
  "Cash / deposit",
  "Bank accounts",
  "Vehicle",
  "Insurance",
  "Other",
];

export interface NpsSchemeHolding {
  schemeName: string;
  allocationPercent: number | null;
  units: number | null;
  nav: number | null;
  currentValue: number | null;
}

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
  valuationDate?: string;
  installmentsPaid?: number | null;
  npsTier?: "Tier I" | "Tier II";
  withdrawnValue?: number | null;
  chargesValue?: number | null;
  lastWithdrawalDate?: string;
  npsSchemes?: NpsSchemeHolding[];
  sanctionedAmount?: number | null;
  principalOutstanding?: number | null;
  interestPaidToDate?: number | null;
  loanTenureMonths?: number | null;
  remainingTenureMonths?: number | null;
  emiAmount?: number | null;
  interestRateType?: "Fixed" | "Floating" | "Mixed" | "Unknown";
  lastStatementDate?: string;
  firstEmiDate?: string;
  lenderLoanType?: string;
  maturityAmount?: number | null;
  depositTerm?: string;
  depositScheme?: string;
  maturityInstruction?: string;
  bondScheme?: string;
  bondInterestPaymentFrequency?: "Monthly" | "Quarterly" | "Semi-annual" | "Annual" | "At maturity" | "Other" | "Unknown";
  bondCouponResetDates?: string;
  insuranceType?: "Term life" | "Endowment" | "ULIP" | "Whole life" | "Other";
  insuranceSumAssured?: number | null;
  insurancePremium?: number | null;
  insurancePremiumFrequency?: "Monthly" | "Quarterly" | "Half-yearly" | "Annual" | "Single premium" | "Other" | "Unknown";
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
  subjectId?: string;
  name: string;
  assessmentType: string;
  subject: string;
  date: string;
  marksObtained: number | null;
  maximumMarks: number | null;
  grade: string;
  resultStatus?: "Scored" | "Absent" | "Not assessed";
  teacherRemark?: string;
  notes: string;
}

export interface EducationReportSummary {
  totalMarksObtained: number | null;
  totalMaximumMarks: number | null;
  percentage: number | null;
  grade: string;
  rank: string;
  result: string;
  teacherRemark: string;
}

export type EducationAttendanceStatus = "Present" | "Absent" | "Leave" | "Late" | "Other";

export interface EducationMonthlyAttendance {
  id: string;
  month: string;
  workingDays: number;
  daysPresent: number;
  notes: string;
}

export interface EducationDailyAttendance {
  id: string;
  date: string;
  status: EducationAttendanceStatus;
  notes: string;
}

export interface EducationHoliday {
  id: string;
  name: string;
  type: "Single-day" | "Seasonal";
  startDate: string;
  endDate: string;
  notes: string;
}

export interface EducationAward {
  id: string;
  type: "Award" | "Certificate";
  name: string;
  issuer: string;
  date: string;
  details: string;
}

export interface EducationLeave {
  id: string;
  date: string;
  reason: string;
}

export interface EducationFeeCharge {
  id: string;
  feeType: EducationFeeType;
  description: string;
  period: string;
  amount: number;
  dueDate: string;
  notes: string;
}

export interface EducationPaymentAllocation {
  chargeId: string;
  amount: number;
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
  allocations?: EducationPaymentAllocation[];
}

export const EDUCATION_EXPENSE_TYPES = ["Books", "Uniform", "Stationery", "Transport", "Exam / activity", "Other"] as const;
export type EducationExpenseType = (typeof EDUCATION_EXPENSE_TYPES)[number];

export interface EducationExpense {
  id: string;
  type: EducationExpenseType;
  description: string;
  amount: number;
  date: string;
  vendor: string;
  method: string;
  reference: string;
  notes: string;
}

export interface EducationRecord {
  id: string;
  studentProfileId?: string;
  studentName: string;
  institution: string;
  level: EducationLevel;
  gradeCourse: string;
  academicYear: string;
  section?: string;
  rollNumber?: string;
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
  idCardImageStoragePath?: string;
  subjects?: EducationSubject[];
  exams?: EducationExam[];
  payments?: EducationPayment[];
  educationExpenses?: EducationExpense[];
  reportSummary?: EducationReportSummary;
  monthlyAttendance?: EducationMonthlyAttendance[];
  dailyAttendance?: EducationDailyAttendance[];
  schoolHolidays?: EducationHoliday[];
  awards?: EducationAward[];
  studentLeaves?: EducationLeave[];
  feeCharges?: EducationFeeCharge[];
}

export interface StudentProfile {
  id: string;
  name: string;
  dateOfBirth: string;
  fatherName: string;
  motherName: string;
  bloodGroup: string;
  contactNumber: string;
  address: string;
  photoStoragePath: string;
  interests: string[];
  notes?: string;
  educationPlanFilters?: StudentEducationPlanFilterPreference;
}

export interface StudentEducationPlanFilterPreference {
  academicYears: string[];
  feeTypes: string[];
  knownAcademicYears: string[];
  knownFeeTypes: string[];
}

export const EDUCATION_PLAN_COST_CATEGORIES = [
  "Tuition",
  "Admission",
  "Transport",
  "Hostel / accommodation",
  "Books / learning materials",
  "Exams / activities",
  "Other",
] as const;

export interface StudentEducationPlanCost {
  id: string;
  category: string;
  description: string;
  amount: number;
}

export interface StudentEducationPlan {
  id: string;
  studentProfileId: string;
  level: EducationLevel;
  institution: string;
  gradeCourse: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  currency: Currency;
  notes: string;
  costs: StudentEducationPlanCost[];
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

export type PromptType = "System" | "Developer" | "User" | "Task" | "Other";

export interface PromptRecord {
  id: string;
  title: string;
  description: string;
  prompt: string;
  tool: string;
  type: PromptType | "";
  category: string;
}

export interface MindfulHabit {
  id: string;
  title: string;
  description: string;
  startDate?: string;
  targetDays?: number | null;
  completedDates?: string[];
}

export type MindfulnessEmotion = "Anger" | "Frustration" | "Stress" | "Calm" | "Love / kindness" | "Gratitude" | "Other";

export interface MindfulnessLog {
  id: string;
  date: string;
  emotion: MindfulnessEmotion;
  intensity: number;
  trigger: string;
  response: string;
  positiveAction: string;
  reflection: string;
  completedHabitIds: string[];
}

export const MORNING_EXERCISE_OPTIONS = [
  "Walking", "Brisk walking", "Jogging", "Running", "Yoga", "Stretching",
  "Strength training", "Bodyweight exercise", "Cycling", "Skipping rope", "Dance",
  "Breathing exercises", "Other",
] as const;
export const EXERCISE_INTENSITIES = ["Easy", "Moderate", "Vigorous"] as const;
export type ExerciseIntensity = (typeof EXERCISE_INTENSITIES)[number];
export const EXERCISE_DAYPARTS = ["Morning", "Afternoon", "Evening", "Night"] as const;
export type ExerciseDaypart = (typeof EXERCISE_DAYPARTS)[number];

export interface MorningExerciseLog {
  id: string;
  date: string;
  daypart?: ExerciseDaypart;
  time?: string;
  activity: string;
  durationMinutes: number | null;
  count: number | null;
  intensity: ExerciseIntensity;
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
  purchaseValue?: number | null;
  currentValue?: number | null;
  valuationDate?: string;
  valuationHistory?: VehicleValuation[];
}

export interface VehicleValuation {
  id: string;
  date: string;
  purchaseValue: number | null;
  currentValue: number;
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

export type SubscriptionCategory = "Mobile" | "Electricity" | "Gas" | "Internet" | "Streaming" | "Tickets" | "Other";
export type SubscriptionBillingType = "Prepaid" | "Postpaid" | "Recurring" | "One-time";
export type SubscriptionTransactionType = "Recharge" | "Bill" | "Booking" | "Renewal" | "Other";

export interface SubscriptionTransaction {
  id: string;
  type: SubscriptionTransactionType;
  transactionDate: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amount: number | null;
  paid: boolean;
  paymentDate: string;
  reference: string;
  notes: string;
}

export interface SubscriptionAccount {
  id: string;
  name: string;
  category: SubscriptionCategory;
  provider: string;
  billingType: SubscriptionBillingType;
  currency: Currency;
  accountReference: string;
  notes: string;
  transactions: SubscriptionTransaction[];
}

export interface DevotionalEntry {
  id: string;
  date: string;
  scriptureReference: string;
  takeaway: string;
  reflection: string;
  prayerNotes: string;
}

export type BibleTestament = "Old Testament" | "New Testament";

export interface DailyBibleReading {
  id: string;
  date: string;
  fromTestament: BibleTestament;
  fromBook: string;
  fromChapterName: string;
  fromChapterNumber: number;
  fromVerseNumber: number;
  toTestament: BibleTestament;
  toBook: string;
  toChapterName: string;
  toChapterNumber: number;
  toVerseNumber: number;
  people: string;
  notes: string;
}

export type PrayerPeriod = "Morning" | "Afternoon" | "Evening" | "Night";
export type DailyPrayerType = "Praise & worship" | "Thanksgiving" | "Confession" | "Personal request" | "Intercession" | "Guidance" | "Other";

export interface DailyPrayerLog {
  id: string;
  date: string;
  period: PrayerPeriod;
  time?: string;
  prayerType: DailyPrayerType;
  prayerNotes: string;
}

export interface DevotionalResource {
  id: string;
  dateAdded?: string;
  title: string;
  link: string;
  description: string;
  source: string;
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
  inventoryIngredients?: CookingRecipeIngredient[];
}

export interface CookingStockMeasure {
  id: string;
  unit: string;
  stockQuantity: number | null;
  unitPrice: number | null;
  piecesPerKg?: number | null;
}

export interface CookingInventoryItem {
  id: string;
  name: string;
  category: string;
  measures: CookingStockMeasure[];
}

export interface CookingInventoryUsage {
  logId: string;
  recipeId: string;
  recipeName: string;
  date: string;
  inventoryItemId: string;
  itemName: string;
  inventoryMeasureId: string;
  unit: string;
  quantity: number;
}

export interface CookingRecipeIngredient {
  id: string;
  inventoryItemId: string | null;
  inventoryMeasureId: string | null;
  name: string;
  quantity: number | null;
  unit: string;
  unitPrice: number | null;
  measureNote?: string;
  unitPriceOverride?: boolean;
}

export interface CookedDish {
  recipeId: string | null;
  name: string;
  actualIngredients?: CookingRecipeIngredient[];
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

export type CookingPlanStatus = "Planned" | "In progress" | "Cooked" | "Skipped";

export interface CookingPlanIngredient {
  id: string;
  productId: string;
  productName: string;
  inventoryItemId?: string | null;
  inventoryMeasureId?: string | null;
  measureNote?: string;
  unitPriceOverride?: boolean;
  quantity: number;
  unit: string;
  unitPrice: number | null;
}

export interface CookingPlan {
  id: string;
  name: string;
  recipeId?: string | null;
  date: string;
  status: CookingPlanStatus;
  ingredients: CookingPlanIngredient[];
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
  externalLink?: string;
}

export interface CredentialRecord {
  id: string;
  kind?: "bank-account";
  provider: string;
  category: string;
  website: string;
  username: string;
  password: string;
  recoveryInfo: string;
  notes: string;
  tags: string[];
  additionalFields: PersonalRecordField[];
  accountHolder?: string;
  accountType?: string;
  accountNumber?: string;
  routingCode?: string;
  branch?: string;
  customerService?: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountHolder: string;
  accountType: string;
  accountNumber: string;
  routingCode: string;
  branch: string;
  website: string;
  customerService: string;
  notes: string;
  currentBalance?: number | null;
  balanceAsOfDate?: string | null;
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
  favoritePages?: Page[];
  preferences?: TrackerPreferences;
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
  studentProfiles?: StudentProfile[];
  educationPlans?: StudentEducationPlan[];
  vehicles?: Vehicle[];
  vehicleJourneys?: VehicleJourney[];
  vehicleMaintenance?: VehicleMaintenance[];
  electricityReadings?: ElectricityReading[];
  subscriptions?: SubscriptionAccount[];
  devotionalEntries?: DevotionalEntry[];
  dailyBibleReadings?: DailyBibleReading[];
  dailyPrayerLogs?: DailyPrayerLog[];
  devotionalResources?: DevotionalResource[];
  prayerRequests?: PrayerRequest[];
  cookingRecipes?: CookingRecipe[];
  cookingLogs?: CookingLog[];
  cookingPlans?: CookingPlan[];
  issueRecords?: IssueRecord[];
  personalEducation?: PersonalEducationRecord[];
  professionalQualifications?: ProfessionalQualification[];
  workExperiences?: WorkExperience[];
  professionalSkills?: ProfessionalSkill[];
  familyMembers?: FamilyMember[];
  archivedRecords?: ArchivedRecord[];
  personalRecords?: PersonalRecord[];
  documents?: DocumentAttachment[];
  promptRecords?: PromptRecord[];
  mindfulHabits?: MindfulHabit[];
  mindfulnessLogs?: MindfulnessLog[];
  morningExerciseLogs?: MorningExerciseLog[];
  morningExerciseActivities?: string[];
  bankAccounts?: BankAccount[];
  credentialRecords?: CredentialRecord[];
  credentialVault?: EncryptedCredentialVault;
}

export type ArchiveSnapshot = Partial<Omit<TrackerData, "version" | "favoritePages" | "preferences" | "archivedRecords" | "credentialVault" | "morningExerciseActivities">>;

export const DASHBOARD_WIDGETS = [
  "shopping", "reminders", "personalDocuments", "stocks", "assets", "learning", "training",
  "devotional", "cooking", "issues", "career", "family", "schools", "vehicles", "electricity",
  "mindfulness", "prompts", "subscriptions", "documents",
] as const;
export type DashboardWidget = (typeof DASHBOARD_WIDGETS)[number];
export type MenuSortOrder = "current" | "ascending";

export interface ActivityChecklistItem {
  id: string;
  name: string;
  links?: ActivityChecklistLink[];
  appLink?: {
    page?: Page;
    url?: string;
    label: string;
  };
}

export interface ActivityChecklistLink {
  id: string;
  url: string;
  label: string;
}

export interface ActivityChecklistSession {
  id: string;
  name: string;
  items: ActivityChecklistItem[];
}

export const DEFAULT_ACTIVITY_SESSIONS: ActivityChecklistSession[] = [
  { id: "morning", name: "Morning", items: [] },
  { id: "afternoon", name: "Afternoon", items: [] },
  { id: "evening", name: "Evening", items: [] },
  { id: "night", name: "Night", items: [] },
];

export interface TrackerPreferences {
  currency: Currency;
  darkMode: boolean;
  fontSize: FontSize;
  fontStyle: FontStyle;
  fontFamily: FontFamily;
  accentColor: AccentColor;
  darkTheme: DarkTheme;
  visualTheme: VisualTheme;
  dashboardWidgets: DashboardWidget[];
  showScreenDescriptions: boolean;
  groupMenus: boolean;
  menuSortOrder: MenuSortOrder;
  activitySessions?: ActivityChecklistSession[];
  activityCompletedItemIds?: string[];
  assetManagerVisibleTypes?: AssetManagerVisibleType[];
}

export const DEFAULT_TRACKER_PREFERENCES: TrackerPreferences = {
  currency: "INR",
  darkMode: false,
  fontSize: "medium",
  fontStyle: "modern",
  fontFamily: "inter",
  accentColor: "green",
  darkTheme: "forest",
  visualTheme: "sage",
  dashboardWidgets: ["shopping", "reminders", "personalDocuments"],
  showScreenDescriptions: true,
  groupMenus: true,
  menuSortOrder: "current",
  activitySessions: DEFAULT_ACTIVITY_SESSIONS.map((session) => ({ ...session, items: [] })),
};

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
export const VISUAL_THEMES = ["sage", "cloud", "sand", "pink"] as const;
export type VisualTheme = (typeof VISUAL_THEMES)[number];
export type FontSize = "extra-small" | "small" | "medium" | "large" | "extra-large" | "xx-large";
export type FontStyle = "modern" | "editorial" | "rounded";
export const FONT_FAMILIES = ["system", "inter", "arial", "roboto", "segoe", "georgia", "times", "trebuchet", "verdana", "tahoma", "courier"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];
