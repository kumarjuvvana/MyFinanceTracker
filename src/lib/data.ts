import { ACCENT_COLORS, ASSET_MANAGER_VISIBLE_TYPES, ASSET_TYPES, CATEGORIES, CURRENCIES, DASHBOARD_WIDGETS, DARK_THEMES, EDUCATION_EXPENSE_TYPES, EDUCATION_FEE_TYPES, EDUCATION_LEVELS, EXERCISE_DAYPARTS, EXERCISE_INTENSITIES, FAVORITABLE_PAGES, FONT_FAMILIES, MORNING_EXERCISE_OPTIONS, REMINDER_CATEGORIES, VISUAL_THEMES, DEFAULT_TRACKER_PREFERENCES, type AssetRecord, type BankAccount, type Category, type CookingLog, type CookingPlan, type CookingRecipe, type CredentialRecord, type Currency, type DailyBibleReading, type DailyPrayerLog, type DevotionalEntry, type DevotionalResource, type DevotionalSong, type DocumentAttachment, type EducationFeeType, type EducationRecord, type ElectricityReading, type ExerciseDaypart, type ExerciseIntensity, type FamilyMember, type IssueRecord, type LearningRecord, type MindfulHabit, type MindfulnessLog, type MorningExerciseLog, type Page, type PersonalEducationRecord, type PersonalRecord, type PrayerRequest, type ProfessionalQualification, type ProfessionalSkill, type Product, type PromptRecord, type Purchase, type Reminder, type SavedReportSection, type StockQuoteSnapshot, type Store, type StudentEducationPlan, type StudentProfile, type SubscriptionAccount, type TrackerData, type TrackedStock, type TrainingSession, type Vehicle, type VehicleJourney, type VehicleMaintenance, type WorkExperience } from "../types.js";
import { DESIGN_THEMES } from "../types.js";
import { DOCUMENT_FILE_TYPES, isDocumentFileAttachment, isDocumentStoragePath, MAX_DOCUMENT_ATTACHMENTS, MAX_DOCUMENT_FILE_BYTES } from "./documentFiles.js";

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
    promptRecords: [],
    mindfulHabits: [],
    mindfulnessLogs: [],
    bankAccounts: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidSavedReportViews(value: unknown): boolean {
  const sections: SavedReportSection[] = ["shopping", "finance", "assets", "subscriptions", "forecasts"];
  return Array.isArray(value) && value.length <= 20 && value.every((view) =>
    isRecord(view) &&
    typeof view.id === "string" && view.id.trim().length > 0 && view.id.length <= 80 &&
    typeof view.name === "string" && view.name.trim().length > 0 && view.name.length <= 80 &&
    typeof view.section === "string" && sections.includes(view.section as SavedReportSection) &&
    typeof view.createdAt === "string" && !Number.isNaN(Date.parse(view.createdAt)) &&
    isRecord(view.filters) && Object.keys(view.filters).length <= 16 &&
    Object.entries(view.filters).every(([key, filter]) =>
      key.length > 0 && key.length <= 80 && typeof filter === "string" && filter.length <= 160)) &&
    new Set(value.map((view) => isRecord(view) ? view.id : null)).size === value.length;
}

function isValidForecastSavingsGoal(value: unknown): boolean {
  return isRecord(value) &&
    typeof value.name === "string" && value.name.trim().length > 0 && value.name.length <= 80 &&
    typeof value.targetAmount === "number" && Number.isFinite(value.targetAmount) && value.targetAmount > 0 &&
    typeof value.currentAmount === "number" && Number.isFinite(value.currentAmount) && value.currentAmount >= 0 &&
    typeof value.monthlyContribution === "number" && Number.isFinite(value.monthlyContribution) && value.monthlyContribution >= 0 &&
    typeof value.currency === "string" && CURRENCIES.includes(value.currency as Currency);
}

function validateImportedBankTransactions(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length > 10000) return false;
  const messageIds: string[] = [];
  for (const transaction of value) {
    if (!isRecord(transaction) ||
      typeof transaction.gmailMessageId !== "string" || transaction.gmailMessageId.length === 0 ||
      transaction.gmailMessageId.length > 256 ||
      typeof transaction.transactionDate !== "string" || Number.isNaN(Date.parse(transaction.transactionDate)) ||
      (transaction.direction !== "debit" && transaction.direction !== "credit") ||
      typeof transaction.amount !== "number" || !Number.isFinite(transaction.amount) || transaction.amount <= 0 ||
      typeof transaction.description !== "string" || transaction.description.length > 300 ||
      typeof transaction.importedAt !== "string" || Number.isNaN(Date.parse(transaction.importedAt))) return false;
    messageIds.push(transaction.gmailMessageId);
  }
  return new Set(messageIds).size === messageIds.length;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isEducationRecord(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id ||
    typeof value.studentName !== "string" || !value.studentName.trim() ||
    (value.studentProfileId !== undefined && typeof value.studentProfileId !== "string") ||
    typeof value.institution !== "string" || !value.institution.trim() ||
    typeof value.level !== "string" || !EDUCATION_LEVELS.some((level) => level === value.level) ||
    typeof value.gradeCourse !== "string" || typeof value.academicYear !== "string" ||
    (value.section !== undefined && typeof value.section !== "string") ||
    (value.rollNumber !== undefined && typeof value.rollNumber !== "string") ||
    (value.status !== "Current" && value.status !== "Completed" && value.status !== "On hold") ||
    typeof value.boardUniversity !== "string" ||
    typeof value.startDate !== "string" || (value.startDate !== "" && Number.isNaN(Date.parse(value.startDate))) ||
    typeof value.endDate !== "string" || (value.endDate !== "" && Number.isNaN(Date.parse(value.endDate))) ||
    !(value.annualFee === null || isNonNegativeNumber(value.annualFee)) ||
    !(value.admissionFee === undefined || value.admissionFee === null || isNonNegativeNumber(value.admissionFee)) ||
    !(value.schoolVanFee === undefined || value.schoolVanFee === null || isNonNegativeNumber(value.schoolVanFee)) ||
    !(value.otherFee === undefined || value.otherFee === null || isNonNegativeNumber(value.otherFee)) ||
    !(value.paidFee === null || isNonNegativeNumber(value.paidFee)) ||
    typeof value.currency !== "string" || !CURRENCIES.some((currency) => currency === value.currency) ||
    typeof value.contactName !== "string" || typeof value.contact !== "string" ||
    typeof value.link !== "string" || !isSafeExternalLink(value.link) ||
    typeof value.notes !== "string") return false;
  if (value.idCardImageStoragePath !== undefined &&
    (typeof value.idCardImageStoragePath !== "string" ||
      value.idCardImageStoragePath !== "" && !isDocumentStoragePath(value.idCardImageStoragePath))) return false;

  const charges = value.feeCharges === undefined ? [] : value.feeCharges;
  if (!Array.isArray(charges) || !charges.every((charge) =>
    isRecord(charge) && typeof charge.id === "string" && Boolean(charge.id) &&
    EDUCATION_FEE_TYPES.some((feeType) => feeType === charge.feeType) &&
    typeof charge.description === "string" && Boolean(charge.description.trim()) &&
    typeof charge.period === "string" && typeof charge.amount === "number" && Number.isFinite(charge.amount) && charge.amount > 0 &&
    typeof charge.dueDate === "string" && (charge.dueDate === "" || !Number.isNaN(Date.parse(charge.dueDate))) &&
    typeof charge.notes === "string")) return false;

  if (value.subjects !== undefined && (!Array.isArray(value.subjects) || !value.subjects.every((subject) =>
    isRecord(subject) && typeof subject.id === "string" && Boolean(subject.id) &&
    typeof subject.name === "string" && Boolean(subject.name.trim()) && typeof subject.code === "string" &&
    (subject.credits === null || isNonNegativeNumber(subject.credits)) && typeof subject.notes === "string"))) return false;

  if (value.exams !== undefined && (!Array.isArray(value.exams) || !value.exams.every((exam) => {
    if (!isRecord(exam) || typeof exam.id !== "string" || !exam.id ||
      typeof exam.name !== "string" || !exam.name.trim() ||
      typeof exam.assessmentType !== "string" || !exam.assessmentType.trim() ||
      typeof exam.subject !== "string" || typeof exam.date !== "string" ||
      (exam.subjectId !== undefined && (typeof exam.subjectId !== "string" || !Array.isArray(value.subjects) ||
        !value.subjects.some((subject) => isRecord(subject) && subject.id === exam.subjectId))) ||
      (exam.date !== "" && Number.isNaN(Date.parse(exam.date))) ||
      !(exam.marksObtained === null || isNonNegativeNumber(exam.marksObtained)) ||
      !(exam.maximumMarks === null || (typeof exam.maximumMarks === "number" && Number.isFinite(exam.maximumMarks) && exam.maximumMarks > 0)) ||
      ((exam.marksObtained === null) !== (exam.maximumMarks === null)) ||
      (exam.marksObtained !== null && exam.maximumMarks !== null && exam.marksObtained > exam.maximumMarks) ||
      typeof exam.grade !== "string" || typeof exam.notes !== "string" ||
      (exam.resultStatus !== undefined && exam.resultStatus !== "Scored" && exam.resultStatus !== "Absent" && exam.resultStatus !== "Not assessed") ||
      (exam.teacherRemark !== undefined && typeof exam.teacherRemark !== "string")) return false;
    if (exam.resultStatus === "Absent" || exam.resultStatus === "Not assessed") {
      return exam.marksObtained === null && exam.maximumMarks === null;
    }
    return exam.marksObtained !== null || Boolean(exam.grade.trim());
  }))) return false;

  if (value.payments !== undefined && (!Array.isArray(value.payments) || !value.payments.every((payment) => {
    if (!isRecord(payment) || typeof payment.id !== "string" || !payment.id ||
      typeof payment.period !== "string" || !payment.period.trim() ||
      typeof payment.amount !== "number" || !Number.isFinite(payment.amount) || payment.amount <= 0 ||
      typeof payment.date !== "string" || Number.isNaN(Date.parse(payment.date)) ||
      typeof payment.method !== "string" || typeof payment.reference !== "string" || typeof payment.notes !== "string" ||
      (payment.feeType !== undefined && !EDUCATION_FEE_TYPES.some((feeType) => feeType === payment.feeType))) return false;
    if (payment.allocations === undefined) return true;
    return Array.isArray(payment.allocations) && payment.allocations.every((allocation) =>
      isRecord(allocation) && typeof allocation.chargeId === "string" && Boolean(allocation.chargeId) &&
      typeof allocation.amount === "number" && Number.isFinite(allocation.amount) && allocation.amount > 0 &&
      charges.some((charge) => isRecord(charge) && charge.id === allocation.chargeId)) &&
      Math.abs(payment.allocations.reduce<number>((sum, allocation) => sum + (isRecord(allocation) && typeof allocation.amount === "number" ? allocation.amount : 0), 0) - payment.amount) < 0.005;
  }))) return false;

  if (value.educationExpenses !== undefined && (!Array.isArray(value.educationExpenses) || !value.educationExpenses.every((expense) =>
    isRecord(expense) && typeof expense.id === "string" && Boolean(expense.id) &&
    EDUCATION_EXPENSE_TYPES.some((type) => type === expense.type) &&
    typeof expense.description === "string" && Boolean(expense.description.trim()) &&
    typeof expense.amount === "number" && Number.isFinite(expense.amount) && expense.amount > 0 &&
    typeof expense.date === "string" && !Number.isNaN(Date.parse(expense.date)) &&
    typeof expense.vendor === "string" && typeof expense.method === "string" &&
    typeof expense.reference === "string" && typeof expense.notes === "string"))) return false;

  if (value.reportSummary !== undefined) {
    const summary = value.reportSummary;
    if (!isRecord(summary) ||
      !(summary.totalMarksObtained === null || isNonNegativeNumber(summary.totalMarksObtained)) ||
      !(summary.totalMaximumMarks === null || (typeof summary.totalMaximumMarks === "number" && Number.isFinite(summary.totalMaximumMarks) && summary.totalMaximumMarks > 0)) ||
      (summary.totalMarksObtained !== null && summary.totalMaximumMarks !== null && summary.totalMarksObtained > summary.totalMaximumMarks) ||
      !(summary.percentage === null || (typeof summary.percentage === "number" && Number.isFinite(summary.percentage) && summary.percentage >= 0 && summary.percentage <= 100)) ||
      typeof summary.grade !== "string" || typeof summary.rank !== "string" ||
      typeof summary.result !== "string" || typeof summary.teacherRemark !== "string") return false;
  }

  if (value.monthlyAttendance !== undefined && (!Array.isArray(value.monthlyAttendance) || !value.monthlyAttendance.every((attendance) =>
    isRecord(attendance) && typeof attendance.id === "string" && Boolean(attendance.id) &&
    typeof attendance.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(attendance.month) &&
    Number.isInteger(attendance.workingDays) && Number(attendance.workingDays) >= 0 &&
    Number.isInteger(attendance.daysPresent) && Number(attendance.daysPresent) >= 0 && Number(attendance.daysPresent) <= Number(attendance.workingDays) &&
    typeof attendance.notes === "string"))) return false;

  if (value.dailyAttendance !== undefined && (!Array.isArray(value.dailyAttendance) || !value.dailyAttendance.every((attendance) =>
    isRecord(attendance) && typeof attendance.id === "string" && Boolean(attendance.id) &&
    typeof attendance.date === "string" && !Number.isNaN(Date.parse(attendance.date)) &&
    (attendance.status === "Present" || attendance.status === "Absent" || attendance.status === "Leave" || attendance.status === "Late" || attendance.status === "Other") &&
    typeof attendance.notes === "string"))) return false;

  if (value.schoolHolidays !== undefined && (!Array.isArray(value.schoolHolidays) || !value.schoolHolidays.every((holiday) =>
    isRecord(holiday) && typeof holiday.id === "string" && Boolean(holiday.id) &&
    typeof holiday.name === "string" && Boolean(holiday.name.trim()) &&
    (holiday.type === "Single-day" || holiday.type === "Seasonal") &&
    typeof holiday.startDate === "string" && !Number.isNaN(Date.parse(holiday.startDate)) &&
    typeof holiday.endDate === "string" && !Number.isNaN(Date.parse(holiday.endDate)) &&
    holiday.endDate >= holiday.startDate && (holiday.type !== "Single-day" || holiday.startDate === holiday.endDate) &&
    typeof holiday.notes === "string"))) return false;

  if (value.awards !== undefined && (!Array.isArray(value.awards) || !value.awards.every((award) =>
    isRecord(award) && typeof award.id === "string" && Boolean(award.id) &&
    (award.type === "Award" || award.type === "Certificate") &&
    typeof award.name === "string" && Boolean(award.name.trim()) &&
    typeof award.issuer === "string" &&
    typeof award.date === "string" && !Number.isNaN(Date.parse(award.date)) &&
    typeof award.details === "string"))) return false;

  if (value.studentLeaves !== undefined && (!Array.isArray(value.studentLeaves) || !value.studentLeaves.every((leave) =>
    isRecord(leave) && typeof leave.id === "string" && Boolean(leave.id) &&
    typeof leave.date === "string" && !Number.isNaN(Date.parse(leave.date)) &&
    typeof leave.reason === "string" && Boolean(leave.reason.trim())))) return false;

  return true;
}

function inferLegacyEducationFeeType(period: string): EducationFeeType {
  const normalized = period.toLocaleLowerCase();
  if (/\badmission\b|\bapplication\b|\benrollment\b/.test(normalized)) return "Admission";
  if (/\bvan\b|\bbus\b|\btransport\b/.test(normalized)) return "School van / transport";
  if (/\bother\b|\bmisc(?:ellaneous)?\b/.test(normalized)) return "Other";
  return "Tuition";
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORIES.some((category) => category === value);
}

function isValidActivitySessions(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const sessionIds = new Set<string>();
  for (const session of value) {
    if (!isRecord(session) || typeof session.id !== "string" || !session.id.trim() ||
      typeof session.name !== "string" || !session.name.trim() || !Array.isArray(session.items) ||
      sessionIds.has(session.id)) return false;
    sessionIds.add(session.id);
    for (const item of session.items) {
      if (!isRecord(item) || typeof item.id !== "string" || !item.id.trim() ||
        typeof item.name !== "string" || !item.name.trim()) return false;
      if (item.links !== undefined && (!Array.isArray(item.links) || item.links.length > 20 ||
        !item.links.every((link) => isRecord(link) &&
          typeof link.id === "string" && Boolean(link.id.trim()) &&
          typeof link.label === "string" && Boolean(link.label.trim()) && link.label.length <= 80 &&
          typeof link.url === "string" && link.url.trim().length > 0 && isSafeActivityLink(link.url)))) return false;
      if (item.appLink !== undefined) {
        if (!isRecord(item.appLink) ||
          typeof item.appLink.label !== "string" || !item.appLink.label.trim() ||
          item.appLink.label.length > 80 ||
          !(typeof item.appLink.url === "string" && item.appLink.url.trim().length > 0 && isSafeActivityLink(item.appLink.url) ||
            typeof item.appLink.page === "string" &&
            (item.appLink.page === "Dashboard" || item.appLink.page === "Favorites" ||
              FAVORITABLE_PAGES.includes(item.appLink.page as Page)))) return false;
      }
    }
  }
  return true;
}

export function validateData(value: unknown): value is TrackerData {
  if (!isRecord(value) || value.version !== STORAGE_VERSION) return false;
  if (!Array.isArray(value.items) || !Array.isArray(value.purchases) || !Array.isArray(value.trips)) return false;
  const favoritePagesOk = value.favoritePages === undefined || (Array.isArray(value.favoritePages) &&
    value.favoritePages.every((page) => typeof page === "string" && FAVORITABLE_PAGES.includes(page as (typeof FAVORITABLE_PAGES)[number])) &&
    new Set(value.favoritePages).size === value.favoritePages.length);
  if (!favoritePagesOk) return false;
  const preferencesOk = value.preferences === undefined || (() => {
    const preferences = value.preferences;
    return isRecord(preferences) &&
      CURRENCIES.includes(preferences.currency as Currency) &&
      typeof preferences.darkMode === "boolean" &&
      ["extra-small", "small", "medium", "large", "extra-large", "xx-large"].includes(String(preferences.fontSize)) &&
      ["modern", "editorial", "rounded"].includes(String(preferences.fontStyle)) &&
      FONT_FAMILIES.includes(preferences.fontFamily as (typeof FONT_FAMILIES)[number]) &&
      ACCENT_COLORS.includes(preferences.accentColor as (typeof ACCENT_COLORS)[number]) &&
      DARK_THEMES.includes(preferences.darkTheme as (typeof DARK_THEMES)[number]) &&
      VISUAL_THEMES.includes(preferences.visualTheme as (typeof VISUAL_THEMES)[number]) &&
      (preferences.designTheme === undefined || DESIGN_THEMES.includes(preferences.designTheme as (typeof DESIGN_THEMES)[number])) &&
      Array.isArray(preferences.dashboardWidgets) &&
      preferences.dashboardWidgets.every((widget) => DASHBOARD_WIDGETS.includes(widget as (typeof DASHBOARD_WIDGETS)[number])) &&
      new Set(preferences.dashboardWidgets).size === preferences.dashboardWidgets.length &&
      typeof preferences.showScreenDescriptions === "boolean" &&
      typeof preferences.groupMenus === "boolean" &&
      (preferences.menuSortOrder === "current" || preferences.menuSortOrder === "ascending") &&
      (preferences.monthlyShoppingBudget === undefined ||
        (typeof preferences.monthlyShoppingBudget === "number" &&
          Number.isFinite(preferences.monthlyShoppingBudget) &&
          preferences.monthlyShoppingBudget >= 0)) &&
      (preferences.savedReportViews === undefined || isValidSavedReportViews(preferences.savedReportViews)) &&
      (preferences.savedScreenViews === undefined || (isRecord(preferences.savedScreenViews) &&
        Object.entries(preferences.savedScreenViews).length <= 60 &&
        Object.entries(preferences.savedScreenViews).every(([screen, settings]) =>
          /^[a-z0-9-]{1,80}$/.test(screen) && isRecord(settings) &&
          Object.entries(settings).length <= 40 &&
          Object.entries(settings).every(([key, setting]) =>
            /^[a-zA-Z0-9-]{1,80}$/.test(key) && typeof setting === "string" && setting.length <= 2048)))) &&
      (preferences.forecastSavingsGoal === undefined || isValidForecastSavingsGoal(preferences.forecastSavingsGoal)) &&
      (preferences.activitySessions === undefined || isValidActivitySessions(preferences.activitySessions)) &&
      (preferences.activityCompletedItemIds === undefined || (Array.isArray(preferences.activityCompletedItemIds) &&
        preferences.activityCompletedItemIds.every((id) => typeof id === "string" && id.trim().length > 0) &&
        new Set(preferences.activityCompletedItemIds).size === preferences.activityCompletedItemIds.length)) &&
      (preferences.assetManagerVisibleTypes === undefined || (Array.isArray(preferences.assetManagerVisibleTypes) &&
        preferences.assetManagerVisibleTypes.every((type) => ASSET_MANAGER_VISIBLE_TYPES.includes(type as (typeof ASSET_MANAGER_VISIBLE_TYPES)[number])) &&
        new Set(preferences.assetManagerVisibleTypes).size === preferences.assetManagerVisibleTypes.length)) &&
      (preferences.assetManagerHiddenItems === undefined || (isRecord(preferences.assetManagerHiddenItems) &&
        Object.entries(preferences.assetManagerHiddenItems).every(([type, ids]) =>
          ASSET_MANAGER_VISIBLE_TYPES.includes(type as (typeof ASSET_MANAGER_VISIBLE_TYPES)[number]) &&
          Array.isArray(ids) && ids.every((id) => typeof id === "string" && id.trim().length > 0) &&
          new Set(ids).size === ids.length)));
  })();
  if (!preferencesOk) return false;
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
  const reminderCategoriesOk = value.reminderCategories === undefined ||
    (Array.isArray(value.reminderCategories) && value.reminderCategories.every((category) =>
      typeof category === "string" && category.trim().length > 0 && category.trim().length <= 80) &&
      new Set((value.reminderCategories as string[]).map((category) => category.trim().toLocaleLowerCase())).size === value.reminderCategories.length);
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
      (stock.latestQuote === undefined || (isRecord(stock.latestQuote) &&
        typeof stock.latestQuote.price === "number" && Number.isFinite(stock.latestQuote.price) && stock.latestQuote.price >= 0 &&
        typeof stock.latestQuote.currency === "string" && /^[A-Z]{3}$/.test(stock.latestQuote.currency) &&
        typeof stock.latestQuote.timestamp === "string" && !Number.isNaN(Date.parse(stock.latestQuote.timestamp)) &&
        typeof stock.latestQuote.marketState === "string" &&
        (stock.latestQuote.previousClose === null || (typeof stock.latestQuote.previousClose === "number" &&
          Number.isFinite(stock.latestQuote.previousClose) && stock.latestQuote.previousClose >= 0)))) &&
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
    (asset.valuationDate === undefined || (typeof asset.valuationDate === "string" &&
      (asset.valuationDate === "" || !Number.isNaN(Date.parse(asset.valuationDate))))) &&
    (asset.valuationUpdatedAt === undefined || (typeof asset.valuationUpdatedAt === "string" &&
      !Number.isNaN(Date.parse(asset.valuationUpdatedAt)))) &&
    (asset.latestNav === undefined || (typeof asset.latestNav === "number" &&
      Number.isFinite(asset.latestNav) && asset.latestNav > 0)) &&
    (asset.latestNavDate === undefined || (typeof asset.latestNavDate === "string" &&
      (asset.latestNavDate === "" || !Number.isNaN(Date.parse(asset.latestNavDate))))) &&
    (asset.navHistory === undefined || (Array.isArray(asset.navHistory) && asset.navHistory.every((snapshot) =>
      isRecord(snapshot) && typeof snapshot.id === "string" && snapshot.id.length > 0 &&
      typeof snapshot.nav === "number" && Number.isFinite(snapshot.nav) && snapshot.nav > 0 &&
      typeof snapshot.date === "string" && !Number.isNaN(Date.parse(snapshot.date)) &&
      typeof snapshot.fetchedAt === "string" && !Number.isNaN(Date.parse(snapshot.fetchedAt))) &&
      new Set(asset.navHistory.map((snapshot) => snapshot.id)).size === asset.navHistory.length)) &&
    (asset.installmentsPaid === undefined || asset.installmentsPaid === null ||
      (typeof asset.installmentsPaid === "number" && Number.isInteger(asset.installmentsPaid) && asset.installmentsPaid >= 0)) &&
    (asset.withdrawnValue === undefined || asset.withdrawnValue === null ||
      (typeof asset.withdrawnValue === "number" && Number.isFinite(asset.withdrawnValue) && asset.withdrawnValue >= 0)) &&
    (asset.chargesValue === undefined || asset.chargesValue === null ||
      (typeof asset.chargesValue === "number" && Number.isFinite(asset.chargesValue) && asset.chargesValue >= 0)) &&
    (asset.npsTier === undefined || asset.npsTier === "Tier I" || asset.npsTier === "Tier II") &&
    (asset.lastWithdrawalDate === undefined || (typeof asset.lastWithdrawalDate === "string" &&
      (asset.lastWithdrawalDate === "" || !Number.isNaN(Date.parse(asset.lastWithdrawalDate))))) &&
    (asset.npsSchemes === undefined || (Array.isArray(asset.npsSchemes) && asset.npsSchemes.every((scheme) =>
      isRecord(scheme) && typeof scheme.schemeName === "string" && scheme.schemeName.trim().length > 0 &&
      (scheme.allocationPercent === null || (typeof scheme.allocationPercent === "number" &&
        Number.isFinite(scheme.allocationPercent) && scheme.allocationPercent >= 0 && scheme.allocationPercent <= 100)) &&
      (scheme.units === null || (typeof scheme.units === "number" && Number.isFinite(scheme.units) && scheme.units >= 0)) &&
      (scheme.nav === null || (typeof scheme.nav === "number" && Number.isFinite(scheme.nav) && scheme.nav >= 0)) &&
      (scheme.currentValue === null || (typeof scheme.currentValue === "number" &&
        Number.isFinite(scheme.currentValue) && scheme.currentValue >= 0)) &&
      (scheme.schemeId === undefined || (typeof scheme.schemeId === "string" && /^SM\d{6}$/.test(scheme.schemeId))) &&
      (scheme.navDate === undefined || (typeof scheme.navDate === "string" &&
        (scheme.navDate === "" || !Number.isNaN(Date.parse(scheme.navDate))))) &&
      (scheme.navHistory === undefined || (Array.isArray(scheme.navHistory) && scheme.navHistory.every((snapshot) =>
        isRecord(snapshot) && typeof snapshot.id === "string" && snapshot.id.length > 0 &&
        typeof snapshot.schemeId === "string" && /^SM\d{6}$/.test(snapshot.schemeId) &&
        typeof snapshot.nav === "number" && Number.isFinite(snapshot.nav) && snapshot.nav > 0 &&
        typeof snapshot.date === "string" && !Number.isNaN(Date.parse(snapshot.date)) &&
        typeof snapshot.fetchedAt === "string" && !Number.isNaN(Date.parse(snapshot.fetchedAt))) &&
        new Set(scheme.navHistory.map((snapshot) => snapshot.id)).size === scheme.navHistory.length))))) &&
    (asset.sanctionedAmount === undefined || asset.sanctionedAmount === null ||
      (typeof asset.sanctionedAmount === "number" && Number.isFinite(asset.sanctionedAmount) && asset.sanctionedAmount >= 0)) &&
    (asset.principalOutstanding === undefined || asset.principalOutstanding === null ||
      (typeof asset.principalOutstanding === "number" && Number.isFinite(asset.principalOutstanding) && asset.principalOutstanding >= 0)) &&
    (asset.interestPaidToDate === undefined || asset.interestPaidToDate === null ||
      (typeof asset.interestPaidToDate === "number" && Number.isFinite(asset.interestPaidToDate) && asset.interestPaidToDate >= 0)) &&
    (asset.loanTenureMonths === undefined || asset.loanTenureMonths === null ||
      (typeof asset.loanTenureMonths === "number" && Number.isInteger(asset.loanTenureMonths) && asset.loanTenureMonths >= 0)) &&
    (asset.remainingTenureMonths === undefined || asset.remainingTenureMonths === null ||
      (typeof asset.remainingTenureMonths === "number" && Number.isInteger(asset.remainingTenureMonths) && asset.remainingTenureMonths >= 0)) &&
    (asset.emiAmount === undefined || asset.emiAmount === null ||
      (typeof asset.emiAmount === "number" && Number.isFinite(asset.emiAmount) && asset.emiAmount >= 0)) &&
    (asset.interestRateType === undefined || asset.interestRateType === "Fixed" ||
      asset.interestRateType === "Floating" || asset.interestRateType === "Mixed" ||
      asset.interestRateType === "Unknown") &&
    (asset.lastStatementDate === undefined || (typeof asset.lastStatementDate === "string" &&
      (asset.lastStatementDate === "" || !Number.isNaN(Date.parse(asset.lastStatementDate))))) &&
    (asset.firstEmiDate === undefined || (typeof asset.firstEmiDate === "string" &&
      (asset.firstEmiDate === "" || !Number.isNaN(Date.parse(asset.firstEmiDate))))) &&
    (asset.lenderLoanType === undefined || typeof asset.lenderLoanType === "string") &&
    (asset.maturityAmount === undefined || asset.maturityAmount === null ||
      (typeof asset.maturityAmount === "number" && Number.isFinite(asset.maturityAmount) && asset.maturityAmount >= 0)) &&
    (asset.depositTerm === undefined || typeof asset.depositTerm === "string") &&
    (asset.depositScheme === undefined || typeof asset.depositScheme === "string") &&
    (asset.maturityInstruction === undefined || typeof asset.maturityInstruction === "string") &&
    (asset.bondScheme === undefined || typeof asset.bondScheme === "string" && asset.bondScheme.length <= 160) &&
    (asset.bondInterestPaymentFrequency === undefined || asset.bondInterestPaymentFrequency === "Monthly" ||
      asset.bondInterestPaymentFrequency === "Quarterly" || asset.bondInterestPaymentFrequency === "Semi-annual" ||
      asset.bondInterestPaymentFrequency === "Annual" || asset.bondInterestPaymentFrequency === "At maturity" ||
      asset.bondInterestPaymentFrequency === "Other" || asset.bondInterestPaymentFrequency === "Unknown") &&
    (asset.bondCouponResetDates === undefined || typeof asset.bondCouponResetDates === "string" && asset.bondCouponResetDates.length <= 200) &&
    (asset.insuranceType === undefined || asset.insuranceType === "Term life" || asset.insuranceType === "Endowment" ||
      asset.insuranceType === "ULIP" || asset.insuranceType === "Whole life" || asset.insuranceType === "Other") &&
    (asset.insuranceSumAssured === undefined || asset.insuranceSumAssured === null ||
      (typeof asset.insuranceSumAssured === "number" && Number.isFinite(asset.insuranceSumAssured) && asset.insuranceSumAssured >= 0)) &&
    (asset.insurancePremium === undefined || asset.insurancePremium === null ||
      (typeof asset.insurancePremium === "number" && Number.isFinite(asset.insurancePremium) && asset.insurancePremium >= 0)) &&
    (asset.insurancePremiumFrequency === undefined || asset.insurancePremiumFrequency === "Monthly" ||
      asset.insurancePremiumFrequency === "Quarterly" || asset.insurancePremiumFrequency === "Half-yearly" ||
      asset.insurancePremiumFrequency === "Annual" || asset.insurancePremiumFrequency === "Single premium" ||
      asset.insurancePremiumFrequency === "Other" || asset.insurancePremiumFrequency === "Unknown") &&
    typeof asset.location === "string" && typeof asset.notes === "string" &&
    Array.isArray(asset.tags) && asset.tags.every((tag) => typeof tag === "string")));
  const educationRecordsOk = value.educationRecords === undefined || (Array.isArray(value.educationRecords) && value.educationRecords.every((entry) =>
    isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
    (entry.studentProfileId === undefined || typeof entry.studentProfileId === "string") &&
    typeof entry.studentName === "string" && entry.studentName.trim().length > 0 &&
    typeof entry.institution === "string" && entry.institution.trim().length > 0 &&
    typeof entry.level === "string" && EDUCATION_LEVELS.some((level) => level === entry.level) &&
    typeof entry.gradeCourse === "string" && typeof entry.academicYear === "string" &&
    (entry.section === undefined || typeof entry.section === "string") &&
    (entry.rollNumber === undefined || typeof entry.rollNumber === "string") &&
    (entry.status === "Current" || entry.status === "Completed" || entry.status === "On hold") &&
    typeof entry.boardUniversity === "string" &&
    typeof entry.startDate === "string" && (entry.startDate === "" || !Number.isNaN(Date.parse(entry.startDate))) &&
    typeof entry.endDate === "string" && (entry.endDate === "" || !Number.isNaN(Date.parse(entry.endDate))) &&
    (entry.annualFee === null || (typeof entry.annualFee === "number" && Number.isFinite(entry.annualFee) && entry.annualFee >= 0)) &&
    (entry.admissionFee === undefined || entry.admissionFee === null || (typeof entry.admissionFee === "number" && Number.isFinite(entry.admissionFee) && entry.admissionFee >= 0)) &&
    (entry.schoolVanFee === undefined || entry.schoolVanFee === null || (typeof entry.schoolVanFee === "number" && Number.isFinite(entry.schoolVanFee) && entry.schoolVanFee >= 0)) &&
    (entry.otherFee === undefined || entry.otherFee === null || (typeof entry.otherFee === "number" && Number.isFinite(entry.otherFee) && entry.otherFee >= 0)) &&
    (entry.paidFee === null || (typeof entry.paidFee === "number" && Number.isFinite(entry.paidFee) && entry.paidFee >= 0)) &&
    typeof entry.currency === "string" && CURRENCIES.some((currency) => currency === entry.currency) &&
    typeof entry.contactName === "string" && typeof entry.contact === "string" &&
    typeof entry.link === "string" && isSafeExternalLink(entry.link) &&
    typeof entry.notes === "string" &&
    (entry.idCardImageStoragePath === undefined ||
      typeof entry.idCardImageStoragePath === "string" &&
      (entry.idCardImageStoragePath === "" || isDocumentStoragePath(entry.idCardImageStoragePath))) &&
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
      (exam.subjectId === undefined || (typeof exam.subjectId === "string" && exam.subjectId.length > 0 &&
        Array.isArray(entry.subjects) && entry.subjects.some((subject) => isRecord(subject) && subject.id === exam.subjectId))) &&
      typeof exam.date === "string" && (exam.date === "" || !Number.isNaN(Date.parse(exam.date))) &&
      (exam.marksObtained === null || (typeof exam.marksObtained === "number" && Number.isFinite(exam.marksObtained) && exam.marksObtained >= 0)) &&
      (exam.maximumMarks === null || (typeof exam.maximumMarks === "number" && Number.isFinite(exam.maximumMarks) && exam.maximumMarks > 0)) &&
      ((exam.marksObtained === null) === (exam.maximumMarks === null)) &&
      (exam.marksObtained === null || exam.maximumMarks === null || exam.marksObtained <= exam.maximumMarks) &&
      typeof exam.grade === "string" &&
      (exam.resultStatus === undefined || exam.resultStatus === "Scored" || exam.resultStatus === "Absent" || exam.resultStatus === "Not assessed") &&
      (exam.teacherRemark === undefined || typeof exam.teacherRemark === "string") &&
      (exam.resultStatus === "Absent" || exam.resultStatus === "Not assessed"
        ? exam.marksObtained === null && exam.maximumMarks === null
        : exam.marksObtained !== null || exam.grade.trim().length > 0) &&
      typeof exam.notes === "string"))) &&
    (entry.payments === undefined || (Array.isArray(entry.payments) && entry.payments.every((payment) =>
      isRecord(payment) && typeof payment.id === "string" && payment.id.length > 0 &&
      typeof payment.period === "string" && payment.period.trim().length > 0 &&
      typeof payment.amount === "number" && Number.isFinite(payment.amount) && payment.amount > 0 &&
      typeof payment.date === "string" && !Number.isNaN(Date.parse(payment.date)) &&
      typeof payment.method === "string" && typeof payment.reference === "string" &&
      (payment.feeType === undefined || EDUCATION_FEE_TYPES.some((feeType) => feeType === payment.feeType)) &&
      typeof payment.notes === "string" &&
      (payment.allocations === undefined || (Array.isArray(payment.allocations) && payment.allocations.every((allocation) =>
        isRecord(allocation) && typeof allocation.chargeId === "string" && allocation.chargeId.length > 0 &&
        typeof allocation.amount === "number" && Number.isFinite(allocation.amount) && allocation.amount > 0 &&
        Array.isArray(entry.feeCharges) && entry.feeCharges.some((charge) => isRecord(charge) && charge.id === allocation.chargeId)) &&
        Math.abs(payment.allocations.reduce((sum, allocation) => sum + allocation.amount, 0) - payment.amount) < 0.005)))) &&
    (entry.reportSummary === undefined || (isRecord(entry.reportSummary) &&
      (entry.reportSummary.totalMarksObtained === null || (typeof entry.reportSummary.totalMarksObtained === "number" && Number.isFinite(entry.reportSummary.totalMarksObtained) && entry.reportSummary.totalMarksObtained >= 0)) &&
      (entry.reportSummary.totalMaximumMarks === null || (typeof entry.reportSummary.totalMaximumMarks === "number" && Number.isFinite(entry.reportSummary.totalMaximumMarks) && entry.reportSummary.totalMaximumMarks > 0)) &&
      (entry.reportSummary.totalMarksObtained === null || entry.reportSummary.totalMaximumMarks === null || entry.reportSummary.totalMarksObtained <= entry.reportSummary.totalMaximumMarks) &&
      (entry.reportSummary.percentage === null || (typeof entry.reportSummary.percentage === "number" && Number.isFinite(entry.reportSummary.percentage) && entry.reportSummary.percentage >= 0 && entry.reportSummary.percentage <= 100)) &&
      typeof entry.reportSummary.grade === "string" && typeof entry.reportSummary.rank === "string" &&
      typeof entry.reportSummary.result === "string" && typeof entry.reportSummary.teacherRemark === "string")) &&
    (entry.monthlyAttendance === undefined || (Array.isArray(entry.monthlyAttendance) && entry.monthlyAttendance.every((attendance) =>
      isRecord(attendance) && typeof attendance.id === "string" && attendance.id.length > 0 &&
      typeof attendance.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(attendance.month) &&
      typeof attendance.workingDays === "number" && Number.isInteger(attendance.workingDays) && attendance.workingDays >= 0 &&
      typeof attendance.daysPresent === "number" && Number.isInteger(attendance.daysPresent) && attendance.daysPresent >= 0 && attendance.daysPresent <= attendance.workingDays &&
      typeof attendance.notes === "string"))) &&
    (entry.dailyAttendance === undefined || (Array.isArray(entry.dailyAttendance) && entry.dailyAttendance.every((attendance) =>
      isRecord(attendance) && typeof attendance.id === "string" && attendance.id.length > 0 &&
      typeof attendance.date === "string" && !Number.isNaN(Date.parse(attendance.date)) &&
      (attendance.status === "Present" || attendance.status === "Absent" || attendance.status === "Leave" || attendance.status === "Late" || attendance.status === "Other") &&
      typeof attendance.notes === "string"))) &&
    (entry.feeCharges === undefined || (Array.isArray(entry.feeCharges) && entry.feeCharges.every((charge) =>
      isRecord(charge) && typeof charge.id === "string" && charge.id.length > 0 &&
      EDUCATION_FEE_TYPES.some((feeType) => feeType === charge.feeType) &&
      typeof charge.description === "string" && charge.description.trim().length > 0 &&
      typeof charge.period === "string" && typeof charge.amount === "number" && Number.isFinite(charge.amount) && charge.amount > 0 &&
      typeof charge.dueDate === "string" && (charge.dueDate === "" || !Number.isNaN(Date.parse(charge.dueDate))) &&
      typeof charge.notes === "string"))))));
  const educationRecordDetailsOk = value.educationRecords === undefined ||
    (Array.isArray(value.educationRecords) && value.educationRecords.every(isEducationRecord));
  const studentProfilesOk = value.studentProfiles === undefined || (Array.isArray(value.studentProfiles) && value.studentProfiles.every((profile) =>
    isRecord(profile) && typeof profile.id === "string" && profile.id.length > 0 &&
    typeof profile.name === "string" && profile.name.trim().length > 0 && profile.name.length <= 120 &&
    typeof profile.dateOfBirth === "string" && (profile.dateOfBirth === "" || !Number.isNaN(Date.parse(profile.dateOfBirth))) &&
    typeof profile.fatherName === "string" && typeof profile.motherName === "string" &&
    typeof profile.bloodGroup === "string" && typeof profile.contactNumber === "string" &&
    typeof profile.address === "string" && typeof profile.photoStoragePath === "string" &&
    (profile.photoStoragePath === "" || isDocumentStoragePath(profile.photoStoragePath)) &&
    (profile.notes === undefined || typeof profile.notes === "string" && profile.notes.length <= 20000) &&
    (profile.educationPlanFilters === undefined || (isRecord(profile.educationPlanFilters) &&
      Array.isArray(profile.educationPlanFilters.academicYears) &&
      profile.educationPlanFilters.academicYears.every((year) => typeof year === "string" && year.length <= 40) &&
      Array.isArray(profile.educationPlanFilters.feeTypes) &&
      profile.educationPlanFilters.feeTypes.every((feeType) => typeof feeType === "string" && feeType.length <= 80) &&
      Array.isArray(profile.educationPlanFilters.knownAcademicYears) &&
      profile.educationPlanFilters.knownAcademicYears.every((year) => typeof year === "string" && year.length <= 40) &&
      Array.isArray(profile.educationPlanFilters.knownFeeTypes) &&
      profile.educationPlanFilters.knownFeeTypes.every((feeType) => typeof feeType === "string" && feeType.length <= 80))) &&
    Array.isArray(profile.interests) && profile.interests.every((interest) =>
      typeof interest === "string" && interest.trim().length > 0 && interest.length <= 80)));
  const educationPlansOk = value.educationPlans === undefined || (Array.isArray(value.educationPlans) && value.educationPlans.every((plan) =>
    isRecord(plan) && typeof plan.id === "string" && plan.id.length > 0 &&
    typeof plan.studentProfileId === "string" && plan.studentProfileId.length > 0 &&
    typeof plan.level === "string" && EDUCATION_LEVELS.some((level) => level === plan.level) &&
    typeof plan.institution === "string" && plan.institution.trim().length > 0 && plan.institution.length <= 160 &&
    typeof plan.gradeCourse === "string" && plan.gradeCourse.trim().length > 0 && plan.gradeCourse.length <= 120 &&
    typeof plan.academicYear === "string" && plan.academicYear.trim().length > 0 && plan.academicYear.length <= 40 &&
    typeof plan.startDate === "string" && (plan.startDate === "" || !Number.isNaN(Date.parse(plan.startDate))) &&
    typeof plan.endDate === "string" && (plan.endDate === "" || !Number.isNaN(Date.parse(plan.endDate))) &&
    (!plan.startDate || !plan.endDate || plan.endDate >= plan.startDate) &&
    typeof plan.currency === "string" && CURRENCIES.some((currency) => currency === plan.currency) &&
    typeof plan.notes === "string" && plan.notes.length <= 5000 && Array.isArray(plan.costs) && plan.costs.every((cost) =>
      isRecord(cost) && typeof cost.id === "string" && cost.id.length > 0 &&
      typeof cost.category === "string" && cost.category.trim().length > 0 && cost.category.length <= 80 &&
      typeof cost.description === "string" && cost.description.length <= 200 &&
      typeof cost.amount === "number" && Number.isFinite(cost.amount) && cost.amount > 0)));
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
  const trainingSessionsOk = value.trainingSessions === undefined || (Array.isArray(value.trainingSessions) && value.trainingSessions.every((entry) =>
    isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
    typeof entry.courseName === "string" && entry.courseName.trim().length > 0 &&
    typeof entry.institution === "string" &&
    (entry.mode === "In-person class" || entry.mode === "Online class" || entry.mode === "Virtual class" || entry.mode === "Self-study") &&
    typeof entry.date === "string" && !Number.isNaN(Date.parse(entry.date)) &&
    typeof entry.startTime === "string" && (entry.startTime === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.startTime)) &&
    typeof entry.endTime === "string" && (entry.endTime === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.endTime)) &&
    (!entry.startTime || !entry.endTime || entry.endTime >= entry.startTime) &&
    typeof entry.topic === "string" && typeof entry.instructor === "string" &&
    typeof entry.learned === "string" && entry.learned.trim().length > 0 &&
    typeof entry.resourceLink === "string" && isSafeExternalLink(entry.resourceLink) &&
    typeof entry.notes === "string"));
  const vehiclesOk = value.vehicles === undefined || (Array.isArray(value.vehicles) && value.vehicles.every((vehicle) =>
    isRecord(vehicle) && typeof vehicle.id === "string" && typeof vehicle.name === "string" &&
    typeof vehicle.make === "string" && typeof vehicle.model === "string" &&
    (vehicle.year === null || (typeof vehicle.year === "number" && Number.isInteger(vehicle.year) && vehicle.year >= 1886)) &&
    typeof vehicle.registration === "string" && typeof vehicle.fuelType === "string" && typeof vehicle.notes === "string" &&
    (vehicle.purchaseValue === undefined || vehicle.purchaseValue === null ||
      (typeof vehicle.purchaseValue === "number" && Number.isFinite(vehicle.purchaseValue) && vehicle.purchaseValue >= 0)) &&
    (vehicle.currentValue === undefined || vehicle.currentValue === null ||
      (typeof vehicle.currentValue === "number" && Number.isFinite(vehicle.currentValue) && vehicle.currentValue >= 0)) &&
    (vehicle.valuationDate === undefined || typeof vehicle.valuationDate === "string" &&
      (vehicle.valuationDate === "" || !Number.isNaN(Date.parse(vehicle.valuationDate)))) &&
    (vehicle.valuationHistory === undefined || Array.isArray(vehicle.valuationHistory) &&
      vehicle.valuationHistory.every((valuation) => isRecord(valuation) &&
        typeof valuation.id === "string" && valuation.id.length > 0 &&
        typeof valuation.date === "string" && !Number.isNaN(Date.parse(valuation.date)) &&
        (valuation.purchaseValue === null || (typeof valuation.purchaseValue === "number" &&
          Number.isFinite(valuation.purchaseValue) && valuation.purchaseValue >= 0)) &&
        typeof valuation.currentValue === "number" && Number.isFinite(valuation.currentValue) && valuation.currentValue >= 0 &&
        typeof valuation.notes === "string"))));
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
  const electricityReadingsOk = value.electricityReadings === undefined ||
    (Array.isArray(value.electricityReadings) && value.electricityReadings.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.meterName === "string" && entry.meterName.trim().length > 0 &&
      typeof entry.location === "string" &&
      typeof entry.readingDate === "string" && !Number.isNaN(Date.parse(entry.readingDate)) &&
      typeof entry.meterReading === "number" && Number.isFinite(entry.meterReading) && entry.meterReading >= 0 &&
      typeof entry.periodStart === "string" && (entry.periodStart === "" || !Number.isNaN(Date.parse(entry.periodStart))) &&
      typeof entry.periodEnd === "string" && (entry.periodEnd === "" || !Number.isNaN(Date.parse(entry.periodEnd))) &&
      (!entry.periodStart || !entry.periodEnd || entry.periodEnd >= entry.periodStart) &&
      (entry.ratePerUnit === null || (typeof entry.ratePerUnit === "number" && Number.isFinite(entry.ratePerUnit) && entry.ratePerUnit >= 0)) &&
      (entry.billAmount === null || (typeof entry.billAmount === "number" && Number.isFinite(entry.billAmount) && entry.billAmount >= 0)) &&
      typeof entry.paid === "boolean" &&
      typeof entry.paidDate === "string" && (entry.paidDate === "" || !Number.isNaN(Date.parse(entry.paidDate))) &&
      (!entry.paid || entry.paidDate !== "") &&
      typeof entry.notes === "string"));
  const subscriptionsOk = value.subscriptions === undefined ||
    (Array.isArray(value.subscriptions) && value.subscriptions.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.name === "string" && entry.name.trim().length > 0 && entry.name.length <= 120 &&
      (entry.category === "Mobile" || entry.category === "Electricity" || entry.category === "Gas" ||
        entry.category === "Internet" || entry.category === "Streaming" || entry.category === "Tickets" || entry.category === "Other") &&
      typeof entry.provider === "string" && entry.provider.length <= 120 &&
      (entry.billingType === "Prepaid" || entry.billingType === "Postpaid" ||
        entry.billingType === "Recurring" || entry.billingType === "One-time") &&
      CURRENCIES.some((currency) => currency === entry.currency) &&
      typeof entry.accountReference === "string" && entry.accountReference.length <= 160 &&
      typeof entry.notes === "string" && entry.notes.length <= 5000 &&
      Array.isArray(entry.transactions) && entry.transactions.every((transaction) =>
        isRecord(transaction) && typeof transaction.id === "string" && transaction.id.length > 0 &&
        (transaction.type === "Recharge" || transaction.type === "Bill" || transaction.type === "Booking" ||
          transaction.type === "Renewal" || transaction.type === "Other") &&
        typeof transaction.transactionDate === "string" && !Number.isNaN(Date.parse(transaction.transactionDate)) &&
        typeof transaction.periodStart === "string" && (transaction.periodStart === "" || !Number.isNaN(Date.parse(transaction.periodStart))) &&
        typeof transaction.periodEnd === "string" && (transaction.periodEnd === "" || !Number.isNaN(Date.parse(transaction.periodEnd))) &&
        (!transaction.periodStart || !transaction.periodEnd || transaction.periodEnd >= transaction.periodStart) &&
        typeof transaction.dueDate === "string" && (transaction.dueDate === "" || !Number.isNaN(Date.parse(transaction.dueDate))) &&
        (transaction.amount === null || (typeof transaction.amount === "number" && Number.isFinite(transaction.amount) && transaction.amount >= 0)) &&
        typeof transaction.paid === "boolean" &&
        typeof transaction.paymentDate === "string" && (transaction.paymentDate === "" || !Number.isNaN(Date.parse(transaction.paymentDate))) &&
        (!transaction.paid || transaction.paymentDate !== "") &&
        typeof transaction.reference === "string" && transaction.reference.length <= 160 &&
        typeof transaction.notes === "string" && transaction.notes.length <= 5000)));
  const devotionalEntriesOk = value.devotionalEntries === undefined ||
    (Array.isArray(value.devotionalEntries) && value.devotionalEntries.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.date === "string" && !Number.isNaN(Date.parse(entry.date)) &&
      typeof entry.scriptureReference === "string" && entry.scriptureReference.trim().length > 0 &&
      typeof entry.takeaway === "string" && typeof entry.reflection === "string" &&
      typeof entry.prayerNotes === "string"));
  const dailyBibleReadingsOk = value.dailyBibleReadings === undefined ||
    (Array.isArray(value.dailyBibleReadings) && value.dailyBibleReadings.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.date === "string" && !Number.isNaN(Date.parse(entry.date)) &&
      (entry.fromTestament === "Old Testament" || entry.fromTestament === "New Testament") &&
      typeof entry.fromBook === "string" && entry.fromBook.trim().length > 0 && entry.fromBook.length <= 100 &&
      typeof entry.fromChapterName === "string" && entry.fromChapterName.length <= 100 &&
      typeof entry.fromChapterNumber === "number" && Number.isInteger(entry.fromChapterNumber) && entry.fromChapterNumber > 0 &&
      typeof entry.fromVerseNumber === "number" && Number.isInteger(entry.fromVerseNumber) && entry.fromVerseNumber > 0 &&
      (entry.toTestament === "Old Testament" || entry.toTestament === "New Testament") &&
      typeof entry.toBook === "string" && entry.toBook.trim().length > 0 && entry.toBook.length <= 100 &&
      typeof entry.toChapterName === "string" && entry.toChapterName.length <= 100 &&
      typeof entry.toChapterNumber === "number" && Number.isInteger(entry.toChapterNumber) && entry.toChapterNumber > 0 &&
      typeof entry.toVerseNumber === "number" && Number.isInteger(entry.toVerseNumber) && entry.toVerseNumber > 0 &&
      (entry.people === undefined || typeof entry.people === "string" && entry.people.length <= 1000) &&
      typeof entry.notes === "string" && entry.notes.length <= 5000));
  const dailyPrayerLogsOk = value.dailyPrayerLogs === undefined ||
    (Array.isArray(value.dailyPrayerLogs) && value.dailyPrayerLogs.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.date === "string" && !Number.isNaN(Date.parse(entry.date)) &&
      (entry.period === "Morning" || entry.period === "Afternoon" || entry.period === "Evening" || entry.period === "Night") &&
      (entry.prayerType === "Praise & worship" || entry.prayerType === "Thanksgiving" || entry.prayerType === "Confession" ||
        entry.prayerType === "Personal request" || entry.prayerType === "Intercession" || entry.prayerType === "Guidance" || entry.prayerType === "Other") &&
      typeof entry.prayerNotes === "string" && entry.prayerNotes.trim().length > 0 && entry.prayerNotes.length <= 5000 &&
      (entry.time === undefined || typeof entry.time === "string" && (entry.time === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time)))));
  const devotionalResourcesOk = value.devotionalResources === undefined ||
    (Array.isArray(value.devotionalResources) && value.devotionalResources.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.title === "string" && entry.title.trim().length > 0 && entry.title.length <= 160 &&
      (entry.dateAdded === undefined || typeof entry.dateAdded === "string" && !Number.isNaN(Date.parse(entry.dateAdded))) &&
      typeof entry.link === "string" && entry.link.length <= 2048 && isSafeExternalLink(entry.link) && entry.link.length > 0 &&
      typeof entry.description === "string" && entry.description.length <= 5000 &&
      typeof entry.source === "string" && entry.source.length <= 120));
  const devotionalSongsOk = value.devotionalSongs === undefined ||
    (Array.isArray(value.devotionalSongs) && value.devotionalSongs.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.title === "string" && entry.title.trim().length > 0 && entry.title.length <= 160 &&
      typeof entry.date === "string" && !Number.isNaN(Date.parse(entry.date)) &&
      (entry.language === undefined || typeof entry.language === "string" && entry.language.length <= 60) &&
      (entry.bibleReference === undefined || typeof entry.bibleReference === "string" && entry.bibleReference.length <= 160) &&
      (entry.author === undefined || typeof entry.author === "string" && entry.author.length <= 160) &&
      (entry.lyrics === undefined || typeof entry.lyrics === "string" && entry.lyrics.length <= 50000) &&
      (entry.link === undefined || typeof entry.link === "string" && entry.link.length <= 2048 && isSafeExternalLink(entry.link))));
  const prayerRequestsOk = value.prayerRequests === undefined ||
    (Array.isArray(value.prayerRequests) && value.prayerRequests.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.title === "string" && entry.title.trim().length > 0 &&
      typeof entry.details === "string" &&
      typeof entry.dateAdded === "string" && !Number.isNaN(Date.parse(entry.dateAdded)) &&
      (entry.status === "Ongoing" || entry.status === "Answered") &&
      typeof entry.answeredDate === "string" &&
      (entry.answeredDate === "" || !Number.isNaN(Date.parse(entry.answeredDate))) &&
      (!entry.answeredDate || Date.parse(entry.answeredDate) >= Date.parse(entry.dateAdded)) &&
      ((entry.status === "Answered") === (entry.answeredDate !== ""))));
  const cookingRecipesOk = value.cookingRecipes === undefined ||
    (Array.isArray(value.cookingRecipes) && value.cookingRecipes.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.name === "string" && entry.name.trim().length > 0 &&
      typeof entry.dishType === "string" && entry.dishType.trim().length > 0 &&
      typeof entry.cuisine === "string" && typeof entry.country === "string" &&
      typeof entry.ingredients === "string" && typeof entry.steps === "string" &&
      (entry.servings === null || (typeof entry.servings === "number" && Number.isInteger(entry.servings) && entry.servings > 0)) &&
      (entry.prepMinutes === null || (typeof entry.prepMinutes === "number" && Number.isInteger(entry.prepMinutes) && entry.prepMinutes >= 0)) &&
      (entry.cookMinutes === null || (typeof entry.cookMinutes === "number" && Number.isInteger(entry.cookMinutes) && entry.cookMinutes >= 0)) &&
      typeof entry.nutritionNotes === "string" && typeof entry.healthNotes === "string" &&
      Array.isArray(entry.dietaryTags) && entry.dietaryTags.every((tag) => typeof tag === "string") &&
      Array.isArray(entry.allergens) && entry.allergens.every((allergen) => typeof allergen === "string") &&
      typeof entry.notes === "string" &&
      (entry.inventoryIngredients === undefined || (Array.isArray(entry.inventoryIngredients) &&
        entry.inventoryIngredients.every((ingredient) =>
          isRecord(ingredient) && typeof ingredient.id === "string" && ingredient.id.length > 0 &&
          (ingredient.inventoryItemId === null || typeof ingredient.inventoryItemId === "string") &&
          (ingredient.inventoryMeasureId === null || typeof ingredient.inventoryMeasureId === "string") &&
          typeof ingredient.name === "string" && ingredient.name.trim().length > 0 &&
          (ingredient.quantity === null || (typeof ingredient.quantity === "number" && Number.isFinite(ingredient.quantity) && ingredient.quantity > 0)) &&
          typeof ingredient.unit === "string" &&
          (ingredient.unitPrice === null || (typeof ingredient.unitPrice === "number" && Number.isFinite(ingredient.unitPrice) && ingredient.unitPrice >= 0)) &&
          (ingredient.measureNote === undefined || typeof ingredient.measureNote === "string" && ingredient.measureNote.length <= 1000) &&
          (ingredient.unitPriceOverride === undefined || typeof ingredient.unitPriceOverride === "boolean"))))));
  const cookingLogsOk = value.cookingLogs === undefined ||
    (Array.isArray(value.cookingLogs) && value.cookingLogs.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.date === "string" && !Number.isNaN(Date.parse(entry.date)) &&
      typeof entry.occasion === "string" &&
      Array.isArray(entry.dishes) && entry.dishes.length > 0 && entry.dishes.every((dish) =>
        isRecord(dish) && (dish.recipeId === null || typeof dish.recipeId === "string") &&
        typeof dish.name === "string" && dish.name.trim().length > 0 &&
        (dish.actualIngredients === undefined || Array.isArray(dish.actualIngredients) &&
          dish.actualIngredients.length <= 200 && dish.actualIngredients.every((ingredient) =>
            isRecord(ingredient) && typeof ingredient.id === "string" && ingredient.id.length > 0 &&
            (ingredient.inventoryItemId === null || typeof ingredient.inventoryItemId === "string") &&
            (ingredient.inventoryMeasureId === null || typeof ingredient.inventoryMeasureId === "string") &&
            typeof ingredient.name === "string" && ingredient.name.trim().length > 0 &&
            (ingredient.quantity === null || typeof ingredient.quantity === "number" &&
              Number.isFinite(ingredient.quantity) && ingredient.quantity > 0) &&
            typeof ingredient.unit === "string" &&
            (ingredient.unitPrice === null || typeof ingredient.unitPrice === "number" &&
              Number.isFinite(ingredient.unitPrice) && ingredient.unitPrice >= 0) &&
            (ingredient.measureNote === undefined || typeof ingredient.measureNote === "string" && ingredient.measureNote.length <= 1000) &&
            (ingredient.unitPriceOverride === undefined || typeof ingredient.unitPriceOverride === "boolean")))) &&
      (entry.rating === null || (typeof entry.rating === "number" && Number.isInteger(entry.rating) && entry.rating >= 1 && entry.rating <= 5)) &&
      typeof entry.learning === "string" && typeof entry.notes === "string"));
  const cookingPlansOk = value.cookingPlans === undefined ||
    (Array.isArray(value.cookingPlans) && value.cookingPlans.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.name === "string" && entry.name.trim().length > 0 && entry.name.length <= 160 &&
      (entry.recipeId === undefined || entry.recipeId === null || typeof entry.recipeId === "string") &&
      typeof entry.date === "string" && !Number.isNaN(Date.parse(entry.date)) &&
      (entry.status === "Planned" || entry.status === "In progress" || entry.status === "Cooked" || entry.status === "Skipped") &&
      Array.isArray(entry.ingredients) && entry.ingredients.every((ingredient) =>
        isRecord(ingredient) && typeof ingredient.id === "string" && ingredient.id.length > 0 &&
        typeof ingredient.productId === "string" && ingredient.productId.length > 0 &&
        typeof ingredient.productName === "string" && ingredient.productName.trim().length > 0 &&
        (ingredient.inventoryItemId === undefined || ingredient.inventoryItemId === null || typeof ingredient.inventoryItemId === "string") &&
        (ingredient.inventoryMeasureId === undefined || ingredient.inventoryMeasureId === null || typeof ingredient.inventoryMeasureId === "string") &&
        (ingredient.unitPriceOverride === undefined || typeof ingredient.unitPriceOverride === "boolean") &&
        typeof ingredient.quantity === "number" && Number.isFinite(ingredient.quantity) && ingredient.quantity > 0 &&
        typeof ingredient.unit === "string" && ingredient.unit.length > 0 &&
        (ingredient.unitPrice === null || typeof ingredient.unitPrice === "number" && Number.isFinite(ingredient.unitPrice) && ingredient.unitPrice >= 0) &&
        (ingredient.measureNote === undefined || typeof ingredient.measureNote === "string" && ingredient.measureNote.length <= 1000)) &&
      typeof entry.notes === "string"));
  const issueRecordsOk = value.issueRecords === undefined ||
    (Array.isArray(value.issueRecords) && value.issueRecords.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.title === "string" && entry.title.trim().length > 0 &&
      (entry.area === "Personal" || entry.area === "Professional" || entry.area === "Home" || entry.area === "Vehicle" || entry.area === "Other") &&
      typeof entry.customArea === "string" &&
      (entry.kind === "Issue" || entry.kind === "Repair" || entry.kind === "Maintenance" || entry.kind === "Task") &&
      (entry.status === "Open" || entry.status === "In progress" || entry.status === "Waiting" || entry.status === "Resolved" || entry.status === "Closed") &&
      (entry.priority === "Low" || entry.priority === "Medium" || entry.priority === "High" || entry.priority === "Urgent") &&
      typeof entry.dateReported === "string" && !Number.isNaN(Date.parse(entry.dateReported)) &&
      typeof entry.dueDate === "string" && (entry.dueDate === "" || !Number.isNaN(Date.parse(entry.dueDate))) &&
      typeof entry.assetName === "string" && typeof entry.location === "string" &&
      typeof entry.assignedTo === "string" && typeof entry.provider === "string" &&
      typeof entry.description === "string" && typeof entry.updates === "string" &&
      (entry.estimatedCost === null || (typeof entry.estimatedCost === "number" && Number.isFinite(entry.estimatedCost) && entry.estimatedCost >= 0)) &&
      (entry.actualCost === null || (typeof entry.actualCost === "number" && Number.isFinite(entry.actualCost) && entry.actualCost >= 0))));
  const personalEducationOk = value.personalEducation === undefined ||
    (Array.isArray(value.personalEducation) && value.personalEducation.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.institution === "string" && entry.institution.trim().length > 0 &&
      typeof entry.qualification === "string" && entry.qualification.trim().length > 0 &&
      typeof entry.fieldOfStudy === "string" && typeof entry.location === "string" &&
      typeof entry.startDate === "string" && (entry.startDate === "" || !Number.isNaN(Date.parse(entry.startDate))) &&
      typeof entry.endDate === "string" && (entry.endDate === "" || !Number.isNaN(Date.parse(entry.endDate))) &&
      (!entry.startDate || !entry.endDate || entry.endDate >= entry.startDate) &&
      (entry.status === "Completed" || entry.status === "In progress" || entry.status === "On hold") &&
      typeof entry.grade === "string" && typeof entry.link === "string" && isSafeExternalLink(entry.link) &&
      typeof entry.notes === "string"));
  const professionalQualificationsOk = value.professionalQualifications === undefined ||
    (Array.isArray(value.professionalQualifications) && value.professionalQualifications.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.name === "string" && entry.name.trim().length > 0 &&
      typeof entry.issuer === "string" && typeof entry.credentialId === "string" &&
      typeof entry.issueDate === "string" && (entry.issueDate === "" || !Number.isNaN(Date.parse(entry.issueDate))) &&
      typeof entry.expiryDate === "string" && (entry.expiryDate === "" || !Number.isNaN(Date.parse(entry.expiryDate))) &&
      (!entry.issueDate || !entry.expiryDate || entry.expiryDate >= entry.issueDate) &&
      typeof entry.link === "string" && isSafeExternalLink(entry.link) && typeof entry.notes === "string"));
  const workExperiencesOk = value.workExperiences === undefined ||
    (Array.isArray(value.workExperiences) && value.workExperiences.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.company === "string" && entry.company.trim().length > 0 &&
      typeof entry.jobTitle === "string" && entry.jobTitle.trim().length > 0 &&
      typeof entry.location === "string" && typeof entry.employmentType === "string" &&
      typeof entry.startDate === "string" && (entry.startDate === "" || !Number.isNaN(Date.parse(entry.startDate))) &&
      typeof entry.endDate === "string" && (entry.endDate === "" || !Number.isNaN(Date.parse(entry.endDate))) &&
      typeof entry.current === "boolean" && (!entry.current || entry.endDate === "") &&
      (!entry.startDate || !entry.endDate || entry.endDate >= entry.startDate) &&
      typeof entry.summary === "string" && typeof entry.skills === "string"));
  const professionalSkillsOk = value.professionalSkills === undefined ||
    (Array.isArray(value.professionalSkills) && value.professionalSkills.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.name === "string" && entry.name.trim().length > 0 &&
      typeof entry.category === "string" &&
      (entry.proficiency === "Beginner" || entry.proficiency === "Intermediate" || entry.proficiency === "Advanced" || entry.proficiency === "Expert") &&
      (entry.yearsExperience === null || (typeof entry.yearsExperience === "number" && Number.isFinite(entry.yearsExperience) && entry.yearsExperience >= 0)) &&
      typeof entry.notes === "string"));
  const familyMembersOk = value.familyMembers === undefined ||
    (Array.isArray(value.familyMembers) && value.familyMembers.every((entry) =>
      isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.name === "string" && entry.name.trim().length > 0 &&
      (entry.relationship === "Self" || entry.relationship === "Spouse" || entry.relationship === "Child" ||
        entry.relationship === "Parent" || entry.relationship === "Sibling" || entry.relationship === "Grandparent" ||
        entry.relationship === "Grandchild" || entry.relationship === "Aunt / Uncle" || entry.relationship === "Cousin" ||
        entry.relationship === "In-law" || entry.relationship === "Other") &&
      typeof entry.relationshipDetail === "string" &&
      (entry.relationship !== "Other" || entry.relationshipDetail.trim().length > 0) &&
      (entry.birthYear === null || (typeof entry.birthYear === "number" && Number.isInteger(entry.birthYear) && entry.birthYear >= 1800 && entry.birthYear <= new Date().getFullYear())) &&
      typeof entry.birthPlace === "string" && typeof entry.currentResidence === "string" &&
      typeof entry.phone === "string" && typeof entry.email === "string" &&
      typeof entry.education === "string" && typeof entry.institution === "string" &&
      typeof entry.occupation === "string" && typeof entry.organization === "string" &&
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
  const documentsOk = value.documents === undefined || (Array.isArray(value.documents) && value.documents.every((entry) =>
    isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
    typeof entry.title === "string" && entry.title.trim().length > 0 && entry.title.length <= 120 &&
    typeof entry.personName === "string" && entry.personName.length <= 120 &&
    typeof entry.notes === "string" && entry.notes.length <= 5000 &&
    typeof entry.fileName === "string" && entry.fileName.length <= 255 &&
    typeof entry.contentType === "string" && (entry.contentType === "" || Object.values(DOCUMENT_FILE_TYPES).some((type) => type === entry.contentType)) &&
    typeof entry.sizeBytes === "number" && Number.isInteger(entry.sizeBytes) && entry.sizeBytes >= 0 && entry.sizeBytes <= MAX_DOCUMENT_FILE_BYTES &&
    typeof entry.storagePath === "string" && (entry.storagePath === "" || isDocumentStoragePath(entry.storagePath)) &&
    (entry.attachments === undefined || Array.isArray(entry.attachments) && entry.attachments.length <= MAX_DOCUMENT_ATTACHMENTS &&
      entry.attachments.every(isDocumentFileAttachment)) &&
    typeof entry.uploadedAt === "string" && !Number.isNaN(Date.parse(entry.uploadedAt)) &&
    (entry.externalLink === undefined || (typeof entry.externalLink === "string" && entry.externalLink.length <= 2048 && isSafeExternalLink(entry.externalLink))) &&
    ((entry.storagePath !== "" && entry.fileName.length > 0 && entry.contentType !== "" && entry.sizeBytes > 0) ||
      (entry.storagePath === "" && entry.fileName === "" && entry.contentType === "" && entry.sizeBytes === 0))));
  const promptRecordsOk = value.promptRecords === undefined || (Array.isArray(value.promptRecords) && value.promptRecords.every((entry) =>
    isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
    typeof entry.title === "string" && entry.title.trim().length > 0 && entry.title.length <= 120 &&
    typeof entry.description === "string" && entry.description.length <= 5000 &&
    typeof entry.prompt === "string" && entry.prompt.trim().length > 0 && entry.prompt.length <= 20000 &&
    typeof entry.tool === "string" && entry.tool.length <= 120 &&
    (entry.type === "" || entry.type === "System" || entry.type === "Developer" || entry.type === "User" || entry.type === "Task" || entry.type === "Other") &&
    typeof entry.category === "string" && entry.category.length <= 80));
  const mindfulHabitsOk = value.mindfulHabits === undefined || (Array.isArray(value.mindfulHabits) && value.mindfulHabits.every((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id ||
      typeof entry.title !== "string" || !entry.title.trim() || entry.title.length > 120 ||
      typeof entry.description !== "string" || entry.description.length > 5000) return false;
    const completedDatesOk = entry.completedDates === undefined || (Array.isArray(entry.completedDates) &&
      entry.completedDates.every((date) => typeof date === "string" && !Number.isNaN(Date.parse(date))) &&
      new Set(entry.completedDates).size === entry.completedDates.length);
    return completedDatesOk &&
      (entry.startDate === undefined || entry.startDate === "" ||
        (typeof entry.startDate === "string" && !Number.isNaN(Date.parse(entry.startDate)))) &&
      (entry.targetDays === undefined || entry.targetDays === null ||
        (typeof entry.targetDays === "number" && Number.isInteger(entry.targetDays) && entry.targetDays >= 1 && entry.targetDays <= 3650));
  }));
  const mindfulnessLogsOk = value.mindfulnessLogs === undefined || (Array.isArray(value.mindfulnessLogs) && value.mindfulnessLogs.every((entry) =>
    isRecord(entry) && typeof entry.id === "string" && entry.id.length > 0 &&
    typeof entry.date === "string" && !Number.isNaN(Date.parse(entry.date)) &&
    (entry.emotion === "Anger" || entry.emotion === "Frustration" || entry.emotion === "Stress" || entry.emotion === "Calm" ||
      entry.emotion === "Love / kindness" || entry.emotion === "Gratitude" || entry.emotion === "Other") &&
    typeof entry.intensity === "number" && Number.isInteger(entry.intensity) && entry.intensity >= 1 && entry.intensity <= 5 &&
    typeof entry.trigger === "string" && entry.trigger.length <= 5000 &&
    typeof entry.response === "string" && entry.response.length <= 5000 &&
    typeof entry.positiveAction === "string" && entry.positiveAction.length <= 5000 &&
    typeof entry.reflection === "string" && entry.reflection.length <= 5000 &&
    Array.isArray(entry.completedHabitIds) && entry.completedHabitIds.every((id) => typeof id === "string")));
  const morningExerciseLogsOk = value.morningExerciseLogs === undefined || (Array.isArray(value.morningExerciseLogs) &&
    value.morningExerciseLogs.every((entry) => isRecord(entry) &&
      typeof entry.id === "string" && entry.id.length > 0 &&
      typeof entry.date === "string" && !Number.isNaN(Date.parse(entry.date)) &&
      (entry.daypart === undefined || EXERCISE_DAYPARTS.includes(entry.daypart as ExerciseDaypart)) &&
      (entry.time === undefined || typeof entry.time === "string" && (entry.time === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time))) &&
      typeof entry.activity === "string" && entry.activity.trim().length > 0 && entry.activity.length <= 120 &&
      (entry.durationMinutes === undefined || entry.durationMinutes === null || (typeof entry.durationMinutes === "number" &&
        Number.isInteger(entry.durationMinutes) && entry.durationMinutes >= 1 && entry.durationMinutes <= 1440)) &&
      (entry.count === undefined || entry.count === null || (typeof entry.count === "number" &&
        Number.isInteger(entry.count) && entry.count >= 1 && entry.count <= 1000000)) &&
      ((entry.durationMinutes !== undefined && entry.durationMinutes !== null) || (entry.count !== undefined && entry.count !== null)) &&
      EXERCISE_INTENSITIES.includes(entry.intensity as ExerciseIntensity) &&
      typeof entry.notes === "string" && entry.notes.length <= 5000));
  const morningExerciseActivitiesOk = value.morningExerciseActivities === undefined ||
    (Array.isArray(value.morningExerciseActivities) && value.morningExerciseActivities.length <= 200 &&
      value.morningExerciseActivities.every((activity) =>
        typeof activity === "string" && activity.trim().length > 0 && activity.length <= 120) &&
      new Set(value.morningExerciseActivities.map((activity) => activity.trim().toLocaleLowerCase())).size === value.morningExerciseActivities.length);
  const bankAccountsOk = value.bankAccounts === undefined || (Array.isArray(value.bankAccounts) && value.bankAccounts.every((account) =>
    isRecord(account) && typeof account.id === "string" && account.id.length > 0 &&
    typeof account.bankName === "string" && account.bankName.trim().length > 0 && account.bankName.length <= 120 &&
    typeof account.accountHolder === "string" && account.accountHolder.trim().length > 0 && account.accountHolder.length <= 160 &&
    typeof account.accountType === "string" && account.accountType.trim().length > 0 && account.accountType.length <= 80 &&
    typeof account.accountNumber === "string" && account.accountNumber.trim().length > 0 && account.accountNumber.length <= 100 &&
    typeof account.routingCode === "string" && account.routingCode.length <= 80 &&
    typeof account.branch === "string" && account.branch.length <= 160 &&
    typeof account.website === "string" && account.website.length <= 2000 && isSafeExternalLink(account.website) &&
    typeof account.customerService === "string" && account.customerService.length <= 500 &&
    typeof account.notes === "string" && account.notes.length <= 3000 &&
    (account.currentBalance === undefined || account.currentBalance === null ||
      (typeof account.currentBalance === "number" && Number.isFinite(account.currentBalance))) &&
    (account.balanceAsOfDate === undefined || account.balanceAsOfDate === null ||
      (typeof account.balanceAsOfDate === "string" &&
        (account.balanceAsOfDate === "" || !Number.isNaN(Date.parse(account.balanceAsOfDate))))) &&
    validateImportedBankTransactions(account.importedTransactions)));
  const credentialRecordsOk = value.credentialRecords === undefined || (Array.isArray(value.credentialRecords) && value.credentialRecords.every((record) =>
    isRecord(record) && typeof record.id === "string" && record.id.length > 0 &&
    (record.kind === undefined || record.kind === "bank-account") &&
    typeof record.provider === "string" && record.provider.trim().length > 0 && record.provider.length <= 120 &&
    typeof record.category === "string" && record.category.length <= 80 &&
    typeof record.website === "string" && record.website.length <= 2000 && isSafeExternalLink(record.website) &&
    typeof record.username === "string" && record.username.length <= 300 &&
    typeof record.password === "string" && record.password.length <= 2000 &&
    typeof record.recoveryInfo === "string" && record.recoveryInfo.length <= 500 &&
    typeof record.notes === "string" && record.notes.length <= 5000 &&
    Array.isArray(record.tags) && record.tags.length <= 100 &&
    record.tags.every((tag) => typeof tag === "string" && tag.length <= 80) &&
    Array.isArray(record.additionalFields) && record.additionalFields.length <= 100 &&
    record.additionalFields.every((field) => isRecord(field) &&
      typeof field.label === "string" && field.label.length <= 80 &&
      typeof field.value === "string" && field.value.length <= 500) &&
    (record.accountHolder === undefined || typeof record.accountHolder === "string") &&
    (record.accountType === undefined || typeof record.accountType === "string") &&
    (record.accountNumber === undefined || typeof record.accountNumber === "string") &&
    (record.routingCode === undefined || typeof record.routingCode === "string") &&
    (record.branch === undefined || typeof record.branch === "string") &&
    (record.customerService === undefined || typeof record.customerService === "string")));
  const archiveCollections = [
    "items", "purchases", "trips", "stores", "products", "reminders", "reminderCategories",
    "brokers", "stocks", "stockQuotes", "assets", "learningRecords", "trainingSessions", "educationRecords",
    "vehicles", "vehicleJourneys", "vehicleMaintenance", "electricityReadings", "subscriptions",
    "devotionalEntries", "dailyBibleReadings", "dailyPrayerLogs", "devotionalResources", "devotionalSongs", "prayerRequests", "cookingRecipes", "cookingLogs", "cookingPlans", "issueRecords",
    "personalEducation", "professionalQualifications", "workExperiences", "professionalSkills",
    "familyMembers", "educationPlans", "personalRecords", "documents", "promptRecords", "mindfulHabits", "mindfulnessLogs",
    "morningExerciseLogs", "bankAccounts", "credentialRecords",
  ];
  const archivedRecordsOk = value.archivedRecords === undefined ||
    (Array.isArray(value.archivedRecords) && value.archivedRecords.every((entry) => {
      if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id ||
        typeof entry.label !== "string" || !entry.label.trim() || entry.label.length > 200 ||
        typeof entry.archivedAt !== "string" || Number.isNaN(Date.parse(entry.archivedAt)) ||
        !isRecord(entry.snapshot)) return false;
      const collectionsOk = Object.entries(entry.snapshot).every(([key, records]) =>
        archiveCollections.includes(key) && Array.isArray(records) &&
        records.every((record) => isRecord(record) || typeof record === "string"));
      return collectionsOk && validateData({ ...value, ...entry.snapshot, archivedRecords: [] });
    }));
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
  if (!itemOk || !purchaseOk || !tripOk || !storesOk || !productsOk || !remindersOk || !reminderCategoriesOk ||
    !brokersOk || !stocksOk || !stockQuotesOk || !stockSeedVersionOk ||
    !assetsOk || !educationRecordsOk || !educationRecordDetailsOk || !studentProfilesOk || !educationPlansOk || !learningRecordsOk || !trainingSessionsOk ||
    !vehiclesOk || !vehicleJourneysOk || !vehicleMaintenanceOk || !electricityReadingsOk || !subscriptionsOk ||
    !devotionalEntriesOk || !dailyBibleReadingsOk || !dailyPrayerLogsOk || !devotionalResourcesOk || !devotionalSongsOk || !prayerRequestsOk || !cookingRecipesOk || !cookingLogsOk || !cookingPlansOk || !issueRecordsOk ||
    !personalEducationOk || !professionalQualificationsOk || !workExperiencesOk || !professionalSkillsOk || !familyMembersOk || !personalRecordsOk || !documentsOk || !promptRecordsOk || !mindfulHabitsOk || !mindfulnessLogsOk || !morningExerciseLogsOk || !morningExerciseActivitiesOk ||
    !archivedRecordsOk || !bankAccountsOk || !credentialRecordsOk ||
    !credentialVaultOk) return false;
  if (Array.isArray(value.stores) && new Set((value.stores as Store[]).map((store) => store.id)).size !== value.stores.length) return false;
  if (Array.isArray(value.bankAccounts) &&
    new Set((value.bankAccounts as BankAccount[]).map((account) => account.id)).size !== value.bankAccounts.length) return false;
  if (Array.isArray(value.credentialRecords) &&
    new Set((value.credentialRecords as CredentialRecord[]).map((record) => record.id)).size !== value.credentialRecords.length) return false;
  if (Array.isArray(value.products) && new Set((value.products as Product[]).map((product) => product.id)).size !== value.products.length) return false;
  if (Array.isArray(value.reminders) && new Set((value.reminders as Reminder[]).map((reminder) => reminder.id)).size !== value.reminders.length) return false;
  if (Array.isArray(value.stocks) && new Set((value.stocks as TrackedStock[]).map((stock) => stock.id)).size !== value.stocks.length) return false;
  if (Array.isArray(value.assets) && new Set((value.assets as AssetRecord[]).map((asset) => asset.id)).size !== value.assets.length) return false;
  if (Array.isArray(value.educationRecords) && new Set((value.educationRecords as EducationRecord[]).map((entry) => entry.id)).size !== value.educationRecords.length) return false;
  if (Array.isArray(value.studentProfiles) &&
    new Set((value.studentProfiles as StudentProfile[]).map((profile) => profile.id)).size !== value.studentProfiles.length) return false;
  if (Array.isArray(value.educationPlans) &&
    new Set((value.educationPlans as StudentEducationPlan[]).map((plan) => plan.id)).size !== value.educationPlans.length) return false;
  if (Array.isArray(value.cookingPlans) &&
    (new Set((value.cookingPlans as CookingPlan[]).map((plan) => plan.id)).size !== value.cookingPlans.length ||
      new Set((value.cookingPlans as CookingPlan[]).flatMap((plan) => plan.ingredients.map((ingredient) => ingredient.id))).size !==
        (value.cookingPlans as CookingPlan[]).reduce((count, plan) => count + plan.ingredients.length, 0))) return false;
  if (Array.isArray(value.educationPlans)) {
    const profileIds = new Set((Array.isArray(value.studentProfiles) ? value.studentProfiles : [])
      .filter(isRecord)
      .map((profile) => profile.id)
      .filter((id): id is string => typeof id === "string"));
    const planCosts = (value.educationPlans as StudentEducationPlan[]).flatMap((plan) => plan.costs);
    if ((value.educationPlans as StudentEducationPlan[]).some((plan) => !profileIds.has(plan.studentProfileId)) ||
      new Set(planCosts.map((cost) => cost.id)).size !== planCosts.length) return false;
  }
  if (Array.isArray(value.learningRecords) && new Set((value.learningRecords as LearningRecord[]).map((entry) => entry.id)).size !== value.learningRecords.length) return false;
  if (Array.isArray(value.trainingSessions) && new Set((value.trainingSessions as TrainingSession[]).map((entry) => entry.id)).size !== value.trainingSessions.length) return false;
  if (Array.isArray(value.educationRecords)) {
    for (const record of value.educationRecords as EducationRecord[]) {
      if (new Set((record.subjects ?? []).map((subject) => subject.id)).size !== (record.subjects ?? []).length ||
        new Set((record.exams ?? []).map((exam) => exam.id)).size !== (record.exams ?? []).length ||
        new Set((record.payments ?? []).map((payment) => payment.id)).size !== (record.payments ?? []).length ||
        new Set((record.educationExpenses ?? []).map((expense) => expense.id)).size !== (record.educationExpenses ?? []).length) return false;
    }
  }
  if (Array.isArray(value.stockQuotes) && new Set((value.stockQuotes as StockQuoteSnapshot[]).map((quote) => quote.id)).size !== value.stockQuotes.length) return false;
  if (Array.isArray(value.vehicles) && new Set((value.vehicles as Vehicle[]).map((vehicle) => vehicle.id)).size !== value.vehicles.length) return false;
  if (Array.isArray(value.vehicles) && (value.vehicles as Vehicle[]).some((vehicle) =>
    vehicle.valuationHistory && new Set(vehicle.valuationHistory.map((entry) => entry.id)).size !== vehicle.valuationHistory.length)) return false;
  if (Array.isArray(value.vehicleJourneys) && new Set((value.vehicleJourneys as VehicleJourney[]).map((journey) => journey.id)).size !== value.vehicleJourneys.length) return false;
  if (Array.isArray(value.vehicleMaintenance) && new Set((value.vehicleMaintenance as VehicleMaintenance[]).map((entry) => entry.id)).size !== value.vehicleMaintenance.length) return false;
  if (Array.isArray(value.electricityReadings) &&
    new Set((value.electricityReadings as { id: string }[]).map((entry) => entry.id)).size !== value.electricityReadings.length) return false;
  if (Array.isArray(value.subscriptions)) {
    const subscriptions = value.subscriptions as SubscriptionAccount[];
    if (new Set(subscriptions.map((entry) => entry.id)).size !== subscriptions.length ||
      subscriptions.some((entry) => new Set(entry.transactions.map((transaction) => transaction.id)).size !== entry.transactions.length)) return false;
  }
  if (Array.isArray(value.electricityReadings)) {
    const readings = value.electricityReadings as ElectricityReading[];
    const readingKeys = readings.map((entry) =>
      `${entry.meterName.trim().toLocaleLowerCase()}\u0000${entry.location.trim().toLocaleLowerCase()}\u0000${entry.readingDate}`);
    if (new Set(readingKeys).size !== readingKeys.length) return false;
    const byMeter = new Map<string, typeof readings>();
    for (const entry of readings) {
      const key = `${entry.meterName.trim().toLocaleLowerCase()}\u0000${entry.location.trim().toLocaleLowerCase()}`;
      byMeter.set(key, [...(byMeter.get(key) ?? []), entry]);
    }
    for (const meterReadings of byMeter.values()) {
      const sorted = [...meterReadings].sort((a, b) => a.readingDate.localeCompare(b.readingDate));
      if (sorted.some((entry, index) => index > 0 && entry.meterReading < sorted[index - 1].meterReading)) return false;
    }
  }
  if (Array.isArray(value.devotionalEntries) &&
    new Set((value.devotionalEntries as DevotionalEntry[]).map((entry) => entry.id)).size !== value.devotionalEntries.length) return false;
  if (Array.isArray(value.dailyBibleReadings) &&
    new Set((value.dailyBibleReadings as DailyBibleReading[]).map((entry) => entry.id)).size !== value.dailyBibleReadings.length) return false;
  if (Array.isArray(value.dailyPrayerLogs) &&
    new Set((value.dailyPrayerLogs as DailyPrayerLog[]).map((entry) => entry.id)).size !== value.dailyPrayerLogs.length) return false;
  if (Array.isArray(value.devotionalResources) &&
    new Set((value.devotionalResources as DevotionalResource[]).map((entry) => entry.id)).size !== value.devotionalResources.length) return false;
  if (Array.isArray(value.devotionalSongs) &&
    new Set((value.devotionalSongs as DevotionalSong[]).map((entry) => entry.id)).size !== value.devotionalSongs.length) return false;
  if (Array.isArray(value.prayerRequests) &&
    new Set((value.prayerRequests as PrayerRequest[]).map((entry) => entry.id)).size !== value.prayerRequests.length) return false;
  if (Array.isArray(value.cookingRecipes) &&
    new Set((value.cookingRecipes as CookingRecipe[]).map((entry) => entry.id)).size !== value.cookingRecipes.length) return false;
  if (Array.isArray(value.cookingLogs) &&
    new Set((value.cookingLogs as CookingLog[]).map((entry) => entry.id)).size !== value.cookingLogs.length) return false;
  if (Array.isArray(value.issueRecords) &&
    new Set((value.issueRecords as IssueRecord[]).map((entry) => entry.id)).size !== value.issueRecords.length) return false;
  if (Array.isArray(value.personalEducation) &&
    new Set((value.personalEducation as PersonalEducationRecord[]).map((entry) => entry.id)).size !== value.personalEducation.length) return false;
  if (Array.isArray(value.professionalQualifications) &&
    new Set((value.professionalQualifications as ProfessionalQualification[]).map((entry) => entry.id)).size !== value.professionalQualifications.length) return false;
  if (Array.isArray(value.workExperiences) &&
    new Set((value.workExperiences as WorkExperience[]).map((entry) => entry.id)).size !== value.workExperiences.length) return false;
  if (Array.isArray(value.professionalSkills) &&
    new Set((value.professionalSkills as ProfessionalSkill[]).map((entry) => entry.id)).size !== value.professionalSkills.length) return false;
  if (Array.isArray(value.familyMembers) &&
    new Set((value.familyMembers as FamilyMember[]).map((entry) => entry.id)).size !== value.familyMembers.length) return false;
  if (Array.isArray(value.personalRecords) && new Set((value.personalRecords as PersonalRecord[]).map((entry) => entry.id)).size !== value.personalRecords.length) return false;
  if (Array.isArray(value.documents) && new Set((value.documents as DocumentAttachment[]).map((entry) => entry.id)).size !== value.documents.length) return false;
  if (Array.isArray(value.promptRecords) && new Set((value.promptRecords as PromptRecord[]).map((entry) => entry.id)).size !== value.promptRecords.length) return false;
  if (Array.isArray(value.mindfulHabits) && new Set((value.mindfulHabits as MindfulHabit[]).map((entry) => entry.id)).size !== value.mindfulHabits.length) return false;
  if (Array.isArray(value.mindfulnessLogs) && new Set((value.mindfulnessLogs as MindfulnessLog[]).map((entry) => entry.id)).size !== value.mindfulnessLogs.length) return false;
  if (Array.isArray(value.morningExerciseLogs) &&
    new Set((value.morningExerciseLogs as MorningExerciseLog[]).map((entry) => entry.id)).size !== value.morningExerciseLogs.length) return false;
  if (Array.isArray(value.brokers) && new Set((value.brokers as string[]).map((broker) => broker.toLowerCase())).size !== value.brokers.length) return false;
  if (Array.isArray(value.stocks)) {
    const stocks = value.stocks as TrackedStock[];
    if (new Set(stocks.map((stock) =>
      `${stock.exchange}:${stock.symbol.trim().toLocaleUpperCase()}:${stock.broker.trim().toLocaleLowerCase()}`)).size !== stocks.length) return false;
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
    favoritePages: data.favoritePages
      ? [...new Set(data.favoritePages.map((page) => page === "Reports" ? "Reports & Analytics" : page))]
      : data.favoritePages,
    preferences: {
      ...DEFAULT_TRACKER_PREFERENCES,
      ...data.preferences,
      dashboardWidgets: data.preferences?.dashboardWidgets ?? [...DEFAULT_TRACKER_PREFERENCES.dashboardWidgets],
      activitySessions: data.preferences?.activitySessions ?? DEFAULT_TRACKER_PREFERENCES.activitySessions?.map((session) => ({ ...session, items: [] })),
    },
    stores: data.stores ?? [],
    products: data.products ?? [],
    reminders: (data.reminders ?? []).map((reminder) => ({
      ...reminder,
      category: reminder.category?.trim() || "General",
    })),
    reminderCategories: [...new Set([
      ...(data.reminderCategories ?? []),
      ...(data.reminders ?? []).map((reminder) => reminder.category?.trim() || "General")
        .filter((category) => !REMINDER_CATEGORIES.some((builtIn) => builtIn.toLocaleLowerCase() === category.toLocaleLowerCase())),
    ])],
    brokers: data.brokers ?? [],
    stocks,
    stockQuotes,
    stockSeedVersion: STOCK_SEED_VERSION,
    assets: data.assets ?? [],
    learningRecords: data.learningRecords ?? [],
    trainingSessions: data.trainingSessions ?? [],
    educationRecords: (data.educationRecords ?? []).map((record) => ({
      ...record,
      admissionFee: record.admissionFee ?? null,
      schoolVanFee: record.schoolVanFee ?? null,
      otherFee: record.otherFee ?? null,
      subjects: record.subjects ?? [],
      exams: record.exams ?? [],
      schoolHolidays: record.schoolHolidays ?? [],
      awards: record.awards ?? [],
      studentLeaves: record.studentLeaves ?? [],
      payments: (record.payments ?? []).map((payment) => ({
        ...payment,
        feeType: payment.feeType ?? inferLegacyEducationFeeType(payment.period),
      })),
    })),
    studentProfiles: (data.studentProfiles ?? []).map((profile) => ({ ...profile, notes: profile.notes ?? "" })),
    educationPlans: data.educationPlans ?? [],
    vehicles: data.vehicles ?? [],
    vehicleJourneys: data.vehicleJourneys ?? [],
    vehicleMaintenance: data.vehicleMaintenance ?? [],
    electricityReadings: data.electricityReadings ?? [],
    subscriptions: data.subscriptions ?? [],
    devotionalEntries: data.devotionalEntries ?? [],
    dailyBibleReadings: (data.dailyBibleReadings ?? []).map((reading) => ({ ...reading, people: reading.people ?? "" })),
    dailyPrayerLogs: (data.dailyPrayerLogs ?? []).map((log) => ({ ...log, time: log.time ?? "" })),
    devotionalResources: data.devotionalResources ?? [],
    devotionalSongs: data.devotionalSongs ?? [],
    prayerRequests: data.prayerRequests ?? [],
    cookingRecipes: data.cookingRecipes ?? [],
    cookingLogs: data.cookingLogs ?? [],
    cookingPlans: data.cookingPlans ?? [],
    issueRecords: data.issueRecords ?? [],
    personalEducation: data.personalEducation ?? [],
    professionalQualifications: data.professionalQualifications ?? [],
    workExperiences: data.workExperiences ?? [],
    professionalSkills: data.professionalSkills ?? [],
    familyMembers: data.familyMembers ?? [],
    archivedRecords: data.archivedRecords ?? [],
    personalRecords: (data.personalRecords ?? []).map((record) => ({
      ...record,
      additionalFields: record.additionalFields ?? [],
    })),
    documents: data.documents ?? [],
    promptRecords: data.promptRecords ?? [],
    mindfulHabits: data.mindfulHabits ?? [],
    mindfulnessLogs: data.mindfulnessLogs ?? [],
    morningExerciseLogs: (data.morningExerciseLogs ?? []).map((log) => ({
      ...log,
      daypart: log.daypart ?? "Morning",
      time: log.time ?? "",
      durationMinutes: log.durationMinutes ?? null,
      count: log.count ?? null,
    })),
    morningExerciseActivities: [...new Map((data.morningExerciseActivities ?? MORNING_EXERCISE_OPTIONS)
      .map((activity) => activity.trim()).filter(Boolean)
      .map((activity) => [activity.toLocaleLowerCase(), activity])).values()],
    bankAccounts: data.bankAccounts ?? [],
    credentialRecords: data.credentialRecords ?? [],
  };
}

export function isSafeExternalLink(value: string): boolean {
  if (!value.trim()) return true;
  return isSafeActivityLink(value);
}

export function isSafeActivityLink(value: string): boolean {
  const link = value.trim();
  if (!link || link.length > 2048) return false;
  if (/^[a-zA-Z]:[\\/]/.test(link) || /^\\\\[^\\]+\\[^\\]+/.test(link) || /^\/\/[^/]+\/[^/]+/.test(link)) {
    return true;
  }
  try {
    const url = new URL(link);
    if (url.username || url.password) return false;
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "ftp:") return Boolean(url.hostname);
    return url.protocol === "file:" && !url.search && !url.hash && (url.hostname === "" || Boolean(url.pathname));
  } catch {
    return false;
  }
}

export function activityLinkHref(value: string): string {
  const link = value.trim();
  if (/^[a-zA-Z]:[\\/]/.test(link)) {
    return `file:///${link.replace(/\\/g, "/").split("/").map((part, index) =>
      index === 0 ? part : encodeURIComponent(part)).join("/")}`;
  }
  if (/^\\\\[^\\]+\\[^\\]+/.test(link)) {
    const [server, ...parts] = link.slice(2).split("\\");
    return `file://${server}/${parts.map(encodeURIComponent).join("/")}`;
  }
  if (/^\/\/[^/]+\/[^/]+/.test(link)) {
    const [server, ...parts] = link.slice(2).split("/");
    return `file://${server}/${parts.map(encodeURIComponent).join("/")}`;
  }
  return link;
}

export function formatCurrency(amount: number, currency: Currency = "INR"): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function exportCsv(purchases: Purchase[]): string {
  const quote = (value: string | number) => {
    const text = String(value);
    const safeText = typeof value === "string" && /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  };
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

export function exportCsvRows<T extends object>(records: readonly T[]): string {
  const columns = [...new Set(records.flatMap((record) => Object.keys(record)))];
  if (!columns.length) return "";
  const quote = (value: unknown) => {
    const text = value === null || value === undefined
      ? ""
      : typeof value === "string"
        ? value
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    const safeText = typeof value === "string" && /^[\s\u0000-\u001f]*[=+\-@]/.test(text)
      ? `'${text}`
      : text;
    return `"${safeText.replace(/"/g, '""')}"`;
  };
  return [
    columns.map(quote).join(","),
    ...records.map((record) => columns.map((column) => quote(Reflect.get(record, column))).join(",")),
  ].join("\r\n");
}
