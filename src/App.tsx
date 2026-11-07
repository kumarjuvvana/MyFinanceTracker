import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Archive, ArrowDownToLine, ArrowLeftRight, Award, Bell, BarChart3, BookOpen, Briefcase, CalendarDays, Car, Check, CheckCircle2,
  ChevronRight, ClipboardList, Clock3, Database, Download,
  Copy, Eye, EyeOff, ExternalLink, FileDown, FileJson2, FileText, Filter, GraduationCap, KeyRound, LayoutDashboard, Leaf, ListChecks, LockKeyhole, Mail, MapPin, Menu, Palette, Pencil, PlayCircle,
  ImagePlus, LoaderCircle, Moon, Plus, Search, Settings2, ShoppingBag, ShoppingBasket, ShoppingCart, Sparkles, ListTree,
  RefreshCw, Sun, Trash2, TrendingUp, Upload, Wallet, Wrench, X, Zap, Heart, CookingPot, Utensils, UsersRound, HardDrive,
} from "lucide-react";
import { Badge, Button, Card, DateInput, EmptyState, ExternalLinkInput, Field, Input, LinkifiedText, Modal, Select } from "./components/ui";
import { GlobalSearchPage } from "./components/GlobalSearchPage";
import { createId, exportCsv, formatCurrency as formatMoney, isSafeExternalLink, monthKey, normalizeTrackerData, STORAGE_KEY, today, validateData } from "./lib/data";
import { checkSession, loadSharedData, saveSharedData, signIn, signOut, validateAccessPassword } from "./lib/dataApi";
import { deleteDocumentFile, uploadDocumentFile } from "./lib/documentApi";
import { DOCUMENT_FILE_TYPES, getDocumentFileType, MAX_DOCUMENT_FILE_BYTES } from "./lib/documentFiles";
import { executeDatabaseSql, loadDatabaseCatalog, loadDatabaseRows, reviewDatabaseSql, type DatabaseCatalog, type DatabaseRows, type SqlExecutionResult, type SqlReview } from "./lib/databaseApi";
import { loadCloudUsage, loadDeploymentUsage, type CloudUsage, type DeploymentUsage } from "./lib/usageApi";
import { createCredentialVault, decryptCredentialVaultWithKey, unlockCredentialVault, updateCredentialVault, type UnlockedCredentialVault } from "./lib/credentialVault";
import { ACCENT_COLORS, ASSET_TYPES, CATEGORIES, CURRENCIES, DARK_THEMES, EDUCATION_FEE_TYPES, EDUCATION_LEVELS, FONT_FAMILIES, ITEM_UNITS, REMINDER_CATEGORIES, VISUAL_THEMES, type AccentColor, type ArchivedRecord, type ArchiveSnapshot, type AssetRecord, type AssetType, type Category, type CookingLog, type CookingRecipe, type CookedDish, type CredentialRecord, type Currency, type DarkTheme, type DevotionalEntry, type DevotionalResource, type DocumentAttachment, type EducationExam, type EducationFeeType, type EducationLevel, type EducationPayment, type EducationRecord, type EducationStatus, type EducationSubject, type ElectricityReading, type EncryptedCredentialVault, type FamilyMember, type FamilyRelationship, type FontFamily, type FontSize, type FontStyle, type IssueArea, type IssueKind, type IssuePriority, type IssueRecord, type IssueStatus, type LearningLevel, type LearningRecord, type LearningStatus, type MindfulHabit, type MindfulnessEmotion, type MindfulnessLog, type Page, type PersonalEducationRecord, type PersonalRecord, type PersonalRecordField, type PersonalRecordType, type PrayerRequest, type PrayerRequestStatus, type ProfessionalQualification, type ProfessionalSkill, type Product, type PromptRecord, type PromptType, type Purchase, type Reminder, type ShoppingItem, type ShoppingTrip, type StockExchange, type StockQuoteSnapshot, type Store, type SubscriptionAccount, type SubscriptionBillingType, type SubscriptionCategory, type SubscriptionTransaction, type SubscriptionTransactionType, type TrackedStock, type TrackerData, type TrainingDeliveryMode, type TrainingSession, type Vehicle, type VehicleJourney, type VehicleMaintenance, type VehicleMaintenanceType, type VisualTheme, type WorkExperience } from "./types";

const PREFERENCES_KEY = "daybook-shopping-preferences";
const FONT_FAMILY_LABELS: Record<FontFamily, string> = {
  system: "System UI",
  inter: "Inter",
  arial: "Arial",
  roboto: "Roboto",
  segoe: "Segoe UI",
  georgia: "Georgia",
  times: "Times New Roman",
  trebuchet: "Trebuchet MS",
  verdana: "Verdana",
  tahoma: "Tahoma",
  courier: "Courier New",
};
type DashboardWidget = "shopping" | "reminders" | "personalDocuments" | "stocks" | "assets" | "learning" | "training" | "devotional" | "cooking" | "issues" | "career" | "family" | "schools" | "vehicles" | "electricity" | "mindfulness" | "prompts" | "subscriptions" | "documents";
const DEFAULT_DASHBOARD_WIDGETS: DashboardWidget[] = ["shopping", "reminders", "personalDocuments"];
const DASHBOARD_WIDGET_OPTIONS: { id: DashboardWidget; label: string; description: string }[] = [
  { id: "shopping", label: "Shopping", description: "Spending, shopping list, and trips" },
  { id: "reminders", label: "Notes & reminders", description: "Upcoming and overdue reminders" },
  { id: "personalDocuments", label: "Personal documents", description: "Upcoming and expired document dates" },
  { id: "stocks", label: "Stocks", description: "Tracked stocks and quantities" },
  { id: "assets", label: "Asset manager", description: "Your saved assets and valuations" },
  { id: "learning", label: "Learning", description: "Learning topics and progress" },
  { id: "training", label: "Training & classes", description: "Recent dated classes and lessons" },
  { id: "mindfulness", label: "Mind & habits", description: "Recent reflections and saved habits" },
  { id: "prompts", label: "AI Prompts", description: "Your saved prompt library" },
  { id: "subscriptions", label: "Subscriptions & bills", description: "Services and recent billing activity" },
  { id: "documents", label: "Documents", description: "Recently uploaded document records" },
  { id: "devotional", label: "Devotional", description: "Recent devotional entries and prayer requests" },
  { id: "cooking", label: "Cooking", description: "Recently logged dishes and cooking lessons" },
  { id: "issues", label: "Issues & maintenance", description: "Open issues, repairs, and tasks" },
  { id: "career", label: "Education & career", description: "Qualifications, experience, and skills" },
  { id: "family", label: "Family", description: "Family directory highlights" },
  { id: "schools", label: "Schools & Colleges", description: "Recent student education records" },
  { id: "vehicles", label: "Vehicles", description: "Vehicles and recent maintenance" },
  { id: "electricity", label: "Electricity", description: "Recent meter readings and unpaid bills" },
];
function stockIdentityKey(stock: Pick<TrackedStock, "symbol" | "exchange" | "broker">) {
  return `${stock.exchange}:${stock.symbol.trim().toLocaleUpperCase()}:${stock.broker.trim().toLocaleLowerCase()}`;
}
const CurrencyContext = createContext<Currency>("INR");
function useCurrencyFormatter() {
  const currency = useContext(CurrencyContext);
  return (amount: number) => formatMoney(amount, currency);
}
type NavigationGroup = "Overview" | "Shopping" | "Finance" | "Personal growth" | "Cooking" | "Home & family" | "Data & tools";
type NavigationItem = { name: Page; icon: typeof LayoutDashboard; group: NavigationGroup };
type MenuSortOrder = "current" | "ascending";
const NAVIGATION_GROUP_ORDER: NavigationGroup[] = ["Overview", "Shopping", "Finance", "Personal growth", "Cooking", "Home & family", "Data & tools"];
const navigation: NavigationItem[] = [
  { name: "Dashboard", icon: LayoutDashboard, group: "Overview" },
  { name: "Global search", icon: Search, group: "Overview" },
  { name: "Shopping list", icon: ListChecks, group: "Shopping" },
  { name: "Shopping trips", icon: ShoppingBag, group: "Shopping" },
  { name: "Purchase history", icon: Clock3, group: "Shopping" },
  { name: "Price history", icon: ArrowLeftRight, group: "Shopping" },
  { name: "Reports", icon: BarChart3, group: "Shopping" },
  { name: "Notes & reminders", icon: Bell, group: "Shopping" },
  { name: "Master data", icon: Database, group: "Shopping" },
  { name: "Stocks", icon: TrendingUp, group: "Finance" },
  { name: "Asset manager", icon: Wallet, group: "Finance" },
  { name: "Learning", icon: BookOpen, group: "Personal growth" },
  { name: "Mind & habits", icon: Heart, group: "Personal growth" },
  { name: "AI Prompts", icon: Sparkles, group: "Personal growth" },
  { name: "Training & classes", icon: CalendarDays, group: "Personal growth" },
  { name: "Devotional", icon: Heart, group: "Personal growth" },
  { name: "Cooking", icon: CookingPot, group: "Cooking" },
  { name: "Issues & maintenance", icon: Wrench, group: "Home & family" },
  { name: "Education & career", icon: Briefcase, group: "Home & family" },
  { name: "Family", icon: UsersRound, group: "Home & family" },
  { name: "Schools & Colleges", icon: GraduationCap, group: "Home & family" },
  { name: "Vehicles", icon: Car, group: "Home & family" },
  { name: "Electricity", icon: Zap, group: "Home & family" },
  { name: "Subscriptions & bills", icon: CalendarDays, group: "Finance" },
  { name: "Personal documents", icon: FileText, group: "Data & tools" },
  { name: "Documents", icon: FileDown, group: "Data & tools" },
  { name: "Database manager", icon: Database, group: "Data & tools" },
  { name: "Hosting & storage", icon: HardDrive, group: "Data & tools" },
  { name: "Archive", icon: Archive, group: "Data & tools" },
  { name: "Account credentials", icon: KeyRound, group: "Data & tools" },
  { name: "R&D / Test Connectors", icon: Mail, group: "Data & tools" },
];
function orderedNavigation(items: NavigationItem[], order: MenuSortOrder) {
  return order === "ascending" ? [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })) : items;
}
function readAppRoute() {
  const params = new URLSearchParams(window.location.search);
  const requestedPage = params.get("page") as Page | null;
  const knownPages = new Set<Page>([...navigation.map((entry) => entry.name), "Data management"]);
  return {
    page: requestedPage && knownPages.has(requestedPage) ? requestedPage : "Dashboard" as Page,
    query: params.get("q") ?? "",
    selectedKey: params.get("record"),
  };
}
const categoryColors: Record<Category, string> = {
  Vegetables: "#6d9873", Groceries: "#8a7db3", Fruits: "#d19a50",
  Household: "#6688a0", "Personal Care": "#bd7b8d", Others: "#829080",
};
const defaultItem = (): Omit<ShoppingItem, "id"> => ({
  name: "", quantity: 1, unit: "pcs", category: "Groceries", estimatedPrice: 0, purchased: false,
});
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const copyLabel = (value: string, maxLength: number) => `${value.slice(0, Math.max(0, maxLength - 7))} (copy)`;
const marketStateLabel = (state: string) => {
  const normalized = state.trim().toUpperCase();
  const labels: Record<string, string> = {
    REGULAR: "Open",
    PRE: "Pre-market",
    PREPRE: "Pre-market",
    POST: "After-hours",
    POSTPOST: "After-hours",
    CLOSED: "Closed",
    PROVIDER_QUOTE: "Provider quote",
    MANUAL: "Manual price",
    UNKNOWN: "Status unavailable",
    STATUS_UNAVAILABLE: "Status unavailable",
  };
  return labels[normalized] ?? (normalized ? normalized.replace(/_/g, " ").toLocaleLowerCase().replace(/^./, (letter) => letter.toLocaleUpperCase()) : "Status unavailable");
};
const monthYearLabel = (date: string) => /^\d{4}-\d{2}$/.test(date)
  ? new Date(`${date}-01T12:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" })
  : date ? dateLabel(date) : "";
function isHttpsLink(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
const dateAfterDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>;
}

function SpendingChart({ purchases }: { purchases: Purchase[] }) {
  const formatCurrency = useCurrencyFormatter();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { key, label: date.toLocaleDateString(undefined, { weekday: "short" }), total: purchases.filter((purchase) => purchase.date === key).reduce((sum, purchase) => sum + purchase.price, 0) };
  });
  const max = Math.max(1, ...days.map((day) => day.total));
  return <div className="bar-chart" aria-label="Spending by day for the last seven days">{days.map((day, index) =>
    <div className="bar-group" key={day.key} title={`${day.label}: ${formatCurrency(day.total)}`}>
      <div className="bar-column"><div className={`bar ${index === 6 ? "current" : ""}`} style={{ height: `${Math.max(4, (day.total / max) * 100)}%` }} /></div>
      <span className="bar-label">{day.label}</span>
    </div>)}</div>;
}

function CategoryBreakdown({ purchases }: { purchases: Purchase[] }) {
  const formatCurrency = useCurrencyFormatter();
  const totals = CATEGORIES.map((category) => ({ category, total: purchases.filter((purchase) => purchase.category === category).reduce((sum, purchase) => sum + purchase.price, 0) }));
  const max = Math.max(1, ...totals.map((entry) => entry.total));
  const active = totals.filter((entry) => entry.total > 0);
  if (!active.length) return <EmptyState icon={<BarChart3 size={18} />} title="Nothing to break down yet" description="Your category spending will show up here after your first purchase." />;
  return <div className="category-list">{active.sort((a, b) => b.total - a.total).map(({ category, total }) =>
    <div className="category-line" key={category}><span className="category-name">{category}</span><div className="progress-track"><div className="progress-fill" style={{ width: `${(total / max) * 100}%`, background: categoryColors[category] }} /></div><span className="category-amount">{formatCurrency(total)}</span></div>)}</div>;
}

function RecentPurchases({ purchases, onViewAll }: { purchases: Purchase[]; onViewAll: () => void }) {
  const formatCurrency = useCurrencyFormatter();
  return <Card><div className="card-head"><div><h2 className="section-title">Recent purchases</h2><p className="section-description">A little look at your latest outings</p></div><button className="text-link" onClick={onViewAll}>View all <ChevronRight size={12} style={{ verticalAlign: "middle" }} /></button></div>
    {purchases.length ? <div className="recent-list">{purchases.slice(0, 5).map((purchase) =>
      <div className="recent-row" key={purchase.id}><div className="item-dot"><ShoppingBasket size={15} /></div><div className="recent-info"><div className="recent-name">{purchase.itemName}</div><div className="recent-meta">{purchase.store} · {dateLabel(purchase.date)}</div></div><div className="recent-price">{formatCurrency(purchase.price)}</div></div>)}</div>
      : <EmptyState icon={<ShoppingBasket size={18} />} title="No purchases yet" description="Once you pick up an item, it will appear here." />}</Card>;
}

interface DashboardEntry {
  title: string;
  detail: string;
}

function DashboardModuleCard({ title, page, entries, emptyMessage, onPage }: {
  title: string;
  page: Page;
  entries: DashboardEntry[];
  emptyMessage: string;
  onPage: (page: Page) => void;
}) {
  return <Card className="dashboard-module-card">
    <div className="card-head"><div><h2 className="section-title">{title}</h2><p className="section-description">{entries.length ? "Recent records" : emptyMessage}</p></div><button className="text-link" type="button" onClick={() => onPage(page)}>View <ChevronRight size={12} /></button></div>
    {entries.length ? <div className="dashboard-module-list">{entries.slice(0, 4).map((entry, index) => <div className="dashboard-module-entry" key={`${entry.title}-${index}`}><div className="recent-name">{entry.title}</div>{entry.detail && <div className="recent-meta">{entry.detail}</div>}</div>)}</div> : <p className="dashboard-module-empty">{emptyMessage}</p>}
  </Card>;
}

function Dashboard({ data, widgets, onPage }: { data: TrackerData; widgets: DashboardWidget[]; onPage: (page: Page) => void }) {
  const formatCurrency = useCurrencyFormatter();
  const currentMonth = monthKey(today());
  const daily = data.purchases.filter((purchase) => purchase.date === today()).reduce((sum, purchase) => sum + purchase.price, 0);
  const monthlyPurchases = data.purchases.filter((purchase) => monthKey(purchase.date) === currentMonth);
  const monthly = monthlyPurchases.reduce((sum, purchase) => sum + purchase.price, 0);
  const pending = data.items.filter((item) => !item.purchased);
  const pendingValue = pending.reduce((sum, item) => sum + item.estimatedPrice * item.quantity, 0);
  const tripCount = data.trips.filter((trip) => monthKey(trip.date) === currentMonth).length;
  const reminders = (data.reminders ?? []).filter((reminder) => !reminder.completed && reminder.date <= dateAfterDays(7)).sort((a, b) => a.date.localeCompare(b.date));
  const documentDue = (data.personalRecords ?? []).filter((record) => record.dueDate &&
    (daysUntil(record.dueDate) < 0 || daysUntil(record.dueDate) <= record.reminderDays))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const stats = [
    { label: "Spent today", value: formatCurrency(daily), note: "Across all your little errands", icon: Wallet, tone: "green" },
    { label: "Spent this month", value: formatCurrency(monthly), note: `${monthlyPurchases.length} items picked up`, icon: TrendingUp, tone: "peach" },
    { label: "Still on your list", value: String(pending.length), note: `About ${formatCurrency(pendingValue)} planned`, icon: ShoppingCart, tone: "blue" },
    { label: "Shopping trips", value: String(tripCount), note: "This month so far", icon: ShoppingBag, tone: "purple" },
  ];
  const moduleCards: Record<Exclude<DashboardWidget, "shopping" | "reminders" | "personalDocuments">, { title: string; page: Page; emptyMessage: string; entries: DashboardEntry[] }> = {
    stocks: {
      title: "Stocks", page: "Stocks", emptyMessage: "No stocks tracked yet.",
      entries: (data.stocks ?? []).slice(0, 4).map((stock) => ({ title: `${stock.symbol} · ${stock.name}`, detail: `${stock.exchange}${stock.quantity ? ` · ${stock.quantity} shares` : ""}` })),
    },
    assets: {
      title: "Asset manager", page: "Asset manager", emptyMessage: "No assets recorded yet.",
      entries: (data.assets ?? []).slice(0, 4).map((asset) => ({ title: asset.name, detail: `${asset.type}${asset.currentValue !== null ? ` · ${formatCurrency(asset.currentValue)}` : ""}` })),
    },
    learning: {
      title: "Learning", page: "Learning", emptyMessage: "No learning topics recorded yet.",
      entries: (data.learningRecords ?? []).slice(0, 4).map((record) => ({ title: record.title, detail: [record.topic, record.status].filter(Boolean).join(" · ") })),
    },
    training: {
      title: "Training & classes", page: "Training & classes", emptyMessage: "No classes or study sessions recorded yet.",
      entries: [...(data.trainingSessions ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map((session) => ({ title: session.courseName, detail: [dateLabel(session.date), session.topic, session.mode].filter(Boolean).join(" · ") })),
    },
    mindfulness: {
      title: "Mind & habits", page: "Mind & habits", emptyMessage: "No reflections or habits recorded yet.",
      entries: [
        ...[...(data.mindfulnessLogs ?? [])].sort((a, b) => b.date.localeCompare(a.date)).map((log) => ({ title: `${log.emotion} reflection`, detail: [dateLabel(log.date), `Intensity ${log.intensity}/5`, log.completedHabitIds.length ? `${log.completedHabitIds.length} habits completed` : ""].filter(Boolean).join(" · "), date: log.date })),
        ...(data.mindfulHabits ?? []).map((habit) => ({ title: habit.title, detail: habit.description ? `Habit · ${habit.description}` : "Saved habit", date: "" })),
      ].slice(0, 4),
    },
    prompts: {
      title: "AI Prompts", page: "AI Prompts", emptyMessage: "No prompts saved yet.",
      entries: (data.promptRecords ?? []).slice(0, 4).map((prompt) => ({ title: prompt.title, detail: [prompt.category, prompt.tool, prompt.type].filter(Boolean).join(" · ") })),
    },
    subscriptions: {
      title: "Subscriptions & bills", page: "Subscriptions & bills", emptyMessage: "No services or bills recorded yet.",
      entries: [...(data.subscriptions ?? [])].sort((a, b) => {
        const latestDate = (account: SubscriptionAccount) => account.transactions.reduce((latest, transaction) => transaction.transactionDate > latest ? transaction.transactionDate : latest, "");
        return latestDate(b).localeCompare(latestDate(a));
      }).slice(0, 4).map((account) => {
        const latest = [...account.transactions].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))[0];
        return {
          title: account.name,
          detail: latest
            ? [account.provider, account.category, latest.dueDate ? `Due ${dateLabel(latest.dueDate)}` : dateLabel(latest.transactionDate), latest.amount !== null ? formatMoney(latest.amount, account.currency) : "", latest.paid ? "Paid" : "Unpaid"].filter(Boolean).join(" · ")
            : [account.provider, account.category, "No billing activity"].filter(Boolean).join(" · "),
        };
      }),
    },
    documents: {
      title: "Documents", page: "Documents", emptyMessage: "No documents uploaded yet.",
      entries: [...(data.documents ?? [])].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).slice(0, 4).map((document) => ({ title: document.title, detail: [document.personName, document.fileName].filter(Boolean).join(" · ") })),
    },
    devotional: {
      title: "Devotional", page: "Devotional", emptyMessage: "No devotional entries or prayer requests recorded yet.",
      entries: [
        ...(data.devotionalEntries ?? []).map((entry) => ({ title: entry.scriptureReference, detail: [dateLabel(entry.date), entry.takeaway].filter(Boolean).join(" · "), date: entry.date })),
        ...(data.prayerRequests ?? []).filter((entry) => entry.status === "Ongoing").map((entry) => ({ title: entry.title, detail: `Prayer request · ${entry.status}`, date: entry.dateAdded })),
      ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4),
    },
    cooking: {
      title: "Cooking", page: "Cooking", emptyMessage: "No cooking logs recorded yet.",
      entries: [...(data.cookingLogs ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map((entry) => ({ title: entry.dishes.map((dish) => dish.name).join(", "), detail: [dateLabel(entry.date), entry.occasion, entry.learning].filter(Boolean).join(" · ") })),
    },
    issues: {
      title: "Issues & maintenance", page: "Issues & maintenance", emptyMessage: "No issues or maintenance records yet.",
      entries: [...(data.issueRecords ?? [])].filter((entry) => entry.status !== "Resolved" && entry.status !== "Closed").sort((a, b) => b.dateReported.localeCompare(a.dateReported)).slice(0, 4).map((entry) => ({ title: entry.title, detail: `${entry.area === "Other" ? entry.customArea : entry.area} · ${entry.status} · ${entry.priority}` })),
    },
    career: {
      title: "Education & career", page: "Education & career", emptyMessage: "No career or professional records yet.",
      entries: [
        ...(data.professionalQualifications ?? []).map((entry) => ({ title: entry.name, detail: entry.issuer ? `Qualification · ${entry.issuer}` : "Qualification" })),
        ...(data.workExperiences ?? []).map((entry) => ({ title: `${entry.jobTitle} · ${entry.company}`, detail: entry.current ? "Current role" : "Work experience" })),
        ...(data.professionalSkills ?? []).map((entry) => ({ title: entry.name, detail: `${entry.category} · ${entry.proficiency}` })),
        ...(data.personalEducation ?? []).map((entry) => ({ title: entry.qualification, detail: `Education · ${entry.institution}` })),
      ].slice(0, 4),
    },
    family: {
      title: "Family", page: "Family", emptyMessage: "No family members added yet.",
      entries: (data.familyMembers ?? []).slice(0, 4).map((member) => ({ title: member.name, detail: [member.relationship === "Other" ? member.relationshipDetail : member.relationship, member.currentResidence].filter(Boolean).join(" · ") })),
    },
    schools: {
      title: "Schools & Colleges", page: "Schools & Colleges", emptyMessage: "No school or college records yet.",
      entries: [...(data.educationRecords ?? [])].sort((a, b) => b.academicYear.localeCompare(a.academicYear)).slice(0, 4).map((record) => ({ title: `${record.studentName} · ${record.institution}`, detail: [record.gradeCourse || record.level, record.academicYear, record.status].filter(Boolean).join(" · ") })),
    },
    vehicles: {
      title: "Vehicles", page: "Vehicles", emptyMessage: "No vehicles recorded yet.",
      entries: (data.vehicles ?? []).slice(0, 4).map((vehicle) => {
        const latestMaintenance = (data.vehicleMaintenance ?? []).filter((entry) => entry.vehicleId === vehicle.id).sort((a, b) => b.date.localeCompare(a.date))[0];
        return { title: vehicle.name, detail: latestMaintenance ? `Last ${latestMaintenance.type.toLocaleLowerCase()} · ${dateLabel(latestMaintenance.date)}` : [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") };
      }),
    },
    electricity: {
      title: "Electricity", page: "Electricity", emptyMessage: "No electricity readings recorded yet.",
      entries: [...(data.electricityReadings ?? [])].sort((a, b) => b.readingDate.localeCompare(a.readingDate)).slice(0, 4).map((entry) => ({ title: `${entry.meterName} · ${entry.meterReading.toLocaleString()} kWh`, detail: [entry.location, dateLabel(entry.readingDate), entry.paid ? "Paid" : entry.billAmount !== null ? `Unpaid · ${formatCurrency(entry.billAmount)}` : "Bill not recorded"].filter(Boolean).join(" · ") })),
    },
  };
  return <><PageHeading eyebrow="Your little corner of calm" title="Good things, in check." subtitle="A personal snapshot of the screens you choose." action={widgets.includes("shopping") ? <Button onClick={() => onPage("Shopping list")}><Plus size={15} /> Add to list</Button> : undefined} />
    {widgets.includes("shopping") && <>
      <div className="stat-grid">{stats.map(({ label, value, note, icon: Icon, tone }) => <Card className="stat-card" key={label}><div className="stat-top"><span>{label}</span><span className={`stat-icon icon-${tone}`}><Icon size={16} /></span></div><p className="stat-value">{value}</p><div className="stat-foot">{note}</div></Card>)}</div>
      <div className="section-grid"><Card><div className="card-head"><div><h2 className="section-title">Your spending, lately</h2><p className="section-description">The last seven days, at a glance</p></div><Badge tone="green"><TrendingUp size={11} /> This week</Badge></div><div className="spend-summary"><strong>{formatCurrency(data.purchases.filter((purchase) => {
        const start = new Date(); start.setDate(start.getDate() - 6); return purchase.date >= start.toISOString().slice(0, 10);
      }).reduce((sum, purchase) => sum + purchase.price, 0))}</strong><span>in the last 7 days</span></div><SpendingChart purchases={data.purchases} /></Card>
        <RecentPurchases purchases={[...data.purchases].sort((a, b) => b.date.localeCompare(a.date))} onViewAll={() => onPage("Purchase history")} /></div>
      <div className="section-grid"><Card><div className="card-head"><div><h2 className="section-title">A few things to pick up</h2><p className="section-description">Your next trip is already taking shape</p></div><button className="text-link" onClick={() => onPage("Shopping list")}>See the list <ChevronRight size={12} style={{ verticalAlign: "middle" }} /></button></div>
        {pending.slice(0, 4).length ? <div className="recent-list">{pending.slice(0, 4).map((item) => <div className="recent-row" key={item.id}><div className="item-dot"><Leaf size={15} /></div><div className="recent-info"><div className="recent-name">{item.name}</div><div className="recent-meta">{item.quantity} {item.unit} · {item.category}</div></div><div className="recent-price">{formatCurrency(item.estimatedPrice * item.quantity)}</div></div>)}</div> : <EmptyState icon={<CheckCircle2 size={18} />} title="All caught up!" description="Your shopping list is clear. Enjoy the moment." />}</Card>
        <Card><div className="card-head"><div><h2 className="section-title">Where it goes</h2><p className="section-description">This month's spending by category</p></div><button className="text-link" onClick={() => onPage("Reports")}>Full report <ChevronRight size={12} style={{ verticalAlign: "middle" }} /></button></div><CategoryBreakdown purchases={monthlyPurchases} /></Card></div>
    </>}
    {widgets.includes("reminders") && <Card className="dashboard-reminders"><div className="card-head"><div><h2 className="section-title">Notes & reminders</h2><p className="section-description">Due now or coming up in the next 7 days</p></div><button className="text-link" onClick={() => onPage("Notes & reminders")}>See all <ChevronRight size={12} /></button></div>{reminders.length ? <div className="reminder-list">{reminders.slice(0, 4).map((reminder) => <div className="reminder-row" key={reminder.id}><Bell size={15} /><div className="recent-info"><div className="recent-name">{reminder.title}</div><div className="recent-meta">{reminder.category || "General"} · <LinkifiedText>{reminder.details || "No extra details"}</LinkifiedText></div></div><Badge tone={reminder.date < today() ? "amber" : "green"}>{reminder.date < today() ? "Overdue" : reminder.date === today() ? "Today" : dateLabel(reminder.date)}</Badge></div>)}</div> : <p className="dashboard-module-empty">No upcoming reminders.</p>}</Card>}
    {widgets.includes("personalDocuments") && <Card className="dashboard-reminders"><div className="card-head"><div><h2 className="section-title">Document & policy dates</h2><p className="section-description">Expired or approaching the reminder date you set</p></div><button className="text-link" onClick={() => onPage("Personal documents")}>Manage records <ChevronRight size={12} /></button></div>{documentDue.length ? <div className="reminder-list">{documentDue.slice(0, 5).map((record) => {
      const remaining = daysUntil(record.dueDate);
      return <div className="reminder-row" key={record.id}><FileText size={15} /><div className="recent-info"><div className="recent-name">{record.title}</div><div className="recent-meta">{record.type} · Due {dateLabel(record.dueDate)}</div></div><Badge tone="amber">{remaining < 0 ? "Expired" : remaining === 0 ? "Today" : `${remaining} days`}</Badge></div>;
    })}</div> : <p className="dashboard-module-empty">No documents or policy dates need attention.</p>}</Card>}
    <div className="dashboard-module-grid">{DASHBOARD_WIDGET_OPTIONS.filter((option): option is typeof option & { id: Exclude<DashboardWidget, "shopping" | "reminders" | "personalDocuments"> } =>
      widgets.includes(option.id) && option.id !== "shopping" && option.id !== "reminders" && option.id !== "personalDocuments")
      .map(({ id }) => {
        const module = moduleCards[id];
        return <DashboardModuleCard key={id} title={module.title} page={module.page} entries={module.entries} emptyMessage={module.emptyMessage} onPage={onPage} />;
      })}</div>
  </>;
}

function ItemModal({ initial, products, onClose, onSave }: { initial?: ShoppingItem; products: Product[]; onClose: () => void; onSave: (item: Omit<ShoppingItem, "id">) => void }) {
  const currency = useContext(CurrencyContext);
  const [form, setForm] = useState(initial ? { name: initial.name, quantity: initial.quantity, unit: initial.unit, category: initial.category, estimatedPrice: initial.estimatedPrice, purchased: initial.purchased } : defaultItem());
  const [productId, setProductId] = useState("");
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.unit.trim()) { setError("Please enter an item name and unit."); return; }
    if (!Number.isFinite(form.quantity) || form.quantity <= 0 || !Number.isFinite(form.estimatedPrice) || form.estimatedPrice < 0) { setError("Quantity must be above zero and price cannot be negative."); return; }
    onSave({ ...form, name: form.name.trim(), unit: form.unit.trim() });
  }
  return <Modal title={initial ? "Edit item" : "Add to your list"} onClose={onClose}><form onSubmit={submit}><div className="form-grid">
    {!initial && products.length > 0 && <Field className="full" label="Start from product master data"><Select value={productId} onChange={(event) => {
      const product = products.find((entry) => entry.id === event.target.value);
      setProductId(event.target.value);
      if (product) setForm((current) => ({ ...current, name: product.name, category: product.category, unit: product.unit, estimatedPrice: product.estimatedPrice }));
    }}><option value="">Enter a new item</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.unit}</option>)}</Select></Field>}
    <Field className="full" label="What do you need?"><Input autoFocus placeholder="e.g. A bunch of fresh basil" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
    <Field label="Quantity"><Input type="number" min="0.01" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></Field>
    <Field label="Unit"><Input list="common-item-units" placeholder="pcs, kg, L..." value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /><datalist id="common-item-units">{ITEM_UNITS.map((unit) => <option key={unit} value={unit} />)}</datalist></Field>
    <Field label="Category"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</Select></Field>
    <Field label={`Price per ${form.unit || "unit"} (${currency})`}><Input type="number" min="0" step="0.01" value={form.estimatedPrice} onChange={(e) => setForm({ ...form, estimatedPrice: Number(e.target.value) })} /></Field>
  </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }}>{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add item"}</Button></div></form></Modal>;
}

function ShoppingList({ data, onToggle, onAdd, onEdit, onCopy, onDelete }: { data: TrackerData; onToggle: (item: ShoppingItem) => void; onAdd: () => void; onEdit: (item: ShoppingItem) => void; onCopy: (item: ShoppingItem) => void; onDelete: (item: ShoppingItem) => void }) {
  const formatCurrency = useCurrencyFormatter();
  const [filter, setFilter] = useState("All items");
  const [search, setSearch] = useState("");
  const items = data.items.filter((item) => (filter === "All items" || (filter === "To buy" ? !item.purchased : item.purchased)) && item.name.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeading eyebrow="Plan a little ahead" title="Shopping list" subtitle={`${data.items.filter((item) => !item.purchased).length} things waiting patiently for their turn.`} action={<Button onClick={onAdd}><Plus size={15} /> Add an item</Button>} />
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search items" placeholder="Find something..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select aria-label="Filter list" style={{ width: 145 }} value={filter} onChange={(e) => setFilter(e.target.value)}><option>All items</option><option>To buy</option><option>Picked up</option></Select><Badge>{items.length} {items.length === 1 ? "item" : "items"}</Badge></div>
    <Card className="table-card"><table className="data-table"><thead><tr><th>Item</th><th>Category</th><th>Quantity</th><th>Est. total</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td data-label="Item"><div style={{ display: "flex", alignItems: "center", gap: 10 }}><button className={`check-button ${item.purchased ? "checked" : ""}`} aria-label={item.purchased ? `Mark ${item.name} as not purchased` : `Mark ${item.name} as purchased`} onClick={() => onToggle(item)}>{item.purchased && <Check size={12} />}</button><div><div className="table-primary">{item.name}</div></div></div></td><td data-label="Category"><Badge>{item.category}</Badge></td><td data-label="Quantity">{item.quantity} {item.unit}</td><td data-label="Est. total" className="table-total">{formatCurrency(item.estimatedPrice * item.quantity)}<div className="table-secondary">{formatCurrency(item.estimatedPrice)} / {item.unit}</div></td><td data-label="Status"><Badge tone={item.purchased ? "green" : "amber"}>{item.purchased ? "Picked up" : "To buy"}</Badge></td><td data-label="Actions"><div className="table-actions"><button className="icon-button" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}><Pencil size={14} /></button><button className="icon-button" aria-label={`Copy ${item.name}`} onClick={() => onCopy(item)}><Copy size={14} /></button><button className="icon-button" aria-label={`Archive ${item.name}`} onClick={() => onDelete(item)}><Archive size={14} /></button></div></td></tr>)}</tbody></table>
      {items.length === 0 && <EmptyState icon={<ClipboardList size={18} />} title={search ? "No items found" : "A fresh start"} description={search ? "Try another search or clear the filter." : "Add a few things you need and they will be right here."} />}</Card>
  </>;
}

function TripModal({ data, onClose, onSave }: { data: TrackerData; onClose: () => void; onSave: (trip: Omit<ShoppingTrip, "id" | "purchaseIds">, itemIds: string[]) => void }) {
  const formatCurrency = useCurrencyFormatter();
  const [date, setDate] = useState(today());
  const [store, setStore] = useState("");
  const [customStore, setCustomStore] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const pending = data.items.filter((item) => !item.purchased);
  function submit(event: FormEvent) {
    event.preventDefault();
    const storeName = store === "__custom" ? customStore : store;
    if (!storeName.trim()) { setError("Please add the store name for this trip."); return; }
    onSave({ date, store: storeName.trim(), notes: notes.trim() }, selected);
  }
  return <Modal title="Plan a shopping trip" onClose={onClose} wide><form onSubmit={submit}><div className="form-grid">
    <Field label="Date"><DateInput value={date} onValueChange={setDate} required /></Field>
    <Field label="Store"><Select autoFocus value={store} onChange={(e) => setStore(e.target.value)}><option value="">Choose a saved store</option>{(data.stores ?? []).map((entry) => <option key={entry.id} value={entry.name}>{entry.location ? `${entry.name} — ${entry.location}` : entry.name}</option>)}<option value="__custom">Other (enter manually)</option></Select>{store === "__custom" && <Input autoFocus placeholder="Where are you headed?" value={customStore} onChange={(e) => setCustomStore(e.target.value)} />}</Field>
    <Field className="full" label="A note for later"><Input placeholder="Anything to remember?" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    <div className="field-wrap full"><span className="field-label">Items to pick up</span>{pending.length ? <div className="recent-list">{pending.map((item) => <label className="recent-row" key={item.id} style={{ cursor: "pointer" }}><input type="checkbox" checked={selected.includes(item.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} /><div className="recent-info"><div className="recent-name">{item.name}</div><div className="recent-meta">{item.quantity} {item.unit} · {item.category}</div></div><span className="recent-price">{formatCurrency(item.estimatedPrice * item.quantity)}</span></label>)}</div> : <p className="section-description">Your list is empty for now. Add items first and they'll be ready to choose here.</p>}</div>
  </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }}>{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit"><ShoppingBag size={14} /> Save trip</Button></div></form></Modal>;
}

function ShoppingTrips({ data, onAdd, onSave, onCopy, onDelete }: { data: TrackerData; onAdd: () => void; onSave: (trip: ShoppingTrip) => void; onCopy: (trip: ShoppingTrip) => void; onDelete: (trip: ShoppingTrip) => void }) {
  const formatCurrency = useCurrencyFormatter();
  const [editing, setEditing] = useState<ShoppingTrip | null>(null);
  const trips = [...data.trips].sort((a, b) => b.date.localeCompare(a.date));
  return <><PageHeading eyebrow="Make a little plan" title="Shopping trips" subtitle="Your errands, saved in one easy place." action={<Button onClick={onAdd}><Plus size={15} /> Plan a trip</Button>} />
    {trips.length ? <div className="trip-grid">{trips.map((trip) => {
      const purchases = trip.purchaseIds.map((id) => data.purchases.find((purchase) => purchase.id === id)).filter((purchase): purchase is Purchase => Boolean(purchase));
      const total = purchases.reduce((sum, purchase) => sum + purchase.price, 0);
      return <Card className="trip-card" key={trip.id}><div className="trip-card-top"><div><div className="trip-store">{trip.store}</div><div className="trip-date"><CalendarDays size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />{dateLabel(trip.date)}</div></div><div className="trip-total">{formatCurrency(total)}</div><button className="icon-button" aria-label={`Edit trip to ${trip.store}`} onClick={() => setEditing(trip)}><Pencil size={14} /></button><button className="icon-button" aria-label={`Copy trip to ${trip.store} without purchases`} title="Copy trip without its purchases" onClick={() => onCopy(trip)}><Copy size={14} /></button><button className="icon-button" aria-label={`Archive trip to ${trip.store}`} onClick={() => onDelete(trip)}><Archive size={14} /></button></div><p className="trip-note"><LinkifiedText>{trip.notes || "A little shopping, all in one place."}</LinkifiedText></p><div className="trip-items">{purchases.length ? purchases.map((purchase) => purchase.itemName).join(" · ") : "No items recorded"}</div></Card>;
    })}</div> : <Card><EmptyState icon={<ShoppingBag size={18} />} title="No trips planned just yet" description="Create a trip, choose a store and add items from your shopping list." /></Card>}
    {editing && <TripEditor key={editing.id} initial={editing} onClose={() => setEditing(null)} onSave={(trip) => { onSave(trip); setEditing(null); }} />}
  </>;
}

function TripEditor({ initial, onClose, onSave }: { initial: ShoppingTrip; onClose: () => void; onSave: (trip: ShoppingTrip) => void }) {
  const [date, setDate] = useState(initial.date);
  const [store, setStore] = useState(initial.store);
  const [notes, setNotes] = useState(initial.notes);
  return <Modal title={`Edit shopping trip · ${initial.store}`} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave({ ...initial, date, store: store.trim(), notes: notes.trim() }); }}><div className="form-grid">
    <Field label="Date"><DateInput required value={date} onValueChange={setDate} /></Field>
    <Field label="Store"><Input required maxLength={120} value={store} onChange={(event) => setStore(event.target.value)} /></Field>
    <Field className="full" label="Notes"><textarea className="field textarea" rows={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
  </div><div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save changes</Button></div></form></Modal>;
}

function PurchaseEditor({ initial, onClose, onSave }: { initial: Purchase; onClose: () => void; onSave: (purchase: Omit<Purchase, "id">) => void }) {
  const [form, setForm] = useState({
    itemId: initial.itemId, itemName: initial.itemName, category: initial.category, quantity: initial.quantity,
    unit: initial.unit, price: initial.price, date: initial.date, store: initial.store,
  });
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.itemName.trim() || !form.unit.trim() || !form.store.trim() || !form.date ||
      !Number.isFinite(form.quantity) || form.quantity <= 0 || !Number.isFinite(form.price) || form.price < 0) {
      setError("Enter an item, store, date, positive quantity, and non-negative price.");
      return;
    }
    onSave({ ...form, itemName: form.itemName.trim(), unit: form.unit.trim(), store: form.store.trim() });
  }
  return <Modal title={`Edit purchase · ${initial.itemName}`} onClose={onClose}><form onSubmit={submit}><div className="form-grid">
    <Field className="full" label="Item"><Input required maxLength={120} value={form.itemName} onChange={(event) => setForm({ ...form, itemName: event.target.value })} /></Field>
    <Field label="Category"><Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as Category })}>{CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</Select></Field>
    <Field label="Quantity"><Input required type="number" min="0.01" step="any" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} /></Field>
    <Field label="Unit"><Input required maxLength={40} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></Field>
    <Field label="Paid"><Input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} /></Field>
    <Field label="Date"><DateInput required value={form.date} onValueChange={(date) => setForm({ ...form, date })} /></Field>
    <Field className="full" label="Store"><Input required maxLength={120} value={form.store} onChange={(event) => setForm({ ...form, store: event.target.value })} /></Field>
  </div>{error && <div className="alert alert-error" role="alert">{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">Save changes</Button></div></form></Modal>;
}

function PurchaseHistory({ data, onSave, onCopy, onDelete }: { data: TrackerData; onSave: (purchase: Purchase) => void; onCopy: (purchase: Purchase) => void; onDelete: (purchase: Purchase) => void }) {
  const formatCurrency = useCurrencyFormatter();
  const [search, setSearch] = useState("");
  const [store, setStore] = useState("All stores");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<Purchase | null>(null);
  const stores = [...new Set(data.purchases.map((purchase) => purchase.store))].sort();
  const purchases = [...data.purchases].filter((purchase) => (!search || purchase.itemName.toLowerCase().includes(search.toLowerCase())) && (store === "All stores" || purchase.store === store) && (!from || purchase.date >= from) && (!to || purchase.date <= to)).sort((a, b) => b.date.localeCompare(a.date));
  const total = purchases.reduce((sum, purchase) => sum + purchase.price, 0);
  return <><PageHeading eyebrow="A record of the good stuff" title="Purchase history" subtitle="Everything you've brought home, in one place." />
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input placeholder="Search items..." aria-label="Search purchases" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select aria-label="Filter by store" style={{ width: 165 }} value={store} onChange={(e) => setStore(e.target.value)}><option>All stores</option>{stores.map((name) => <option key={name}>{name}</option>)}</Select><DateInput className="filter-date" aria-label="From date" value={from} onValueChange={setFrom} /><DateInput className="filter-date" aria-label="To date" value={to} onValueChange={setTo} /></div>
    <Card className="table-card"><div className="history-summary"><span className="section-description" style={{ margin: 0 }}>{purchases.length} {purchases.length === 1 ? "purchase" : "purchases"} found</span><strong>Total · {formatCurrency(total)}</strong></div><table className="data-table"><thead><tr><th>Date</th><th>Item</th><th>Store</th><th>Category</th><th>Quantity</th><th>Paid</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id}><td data-label="Date">{dateLabel(purchase.date)}</td><td data-label="Item"><div className="table-primary">{purchase.itemName}</div></td><td data-label="Store">{purchase.store}</td><td data-label="Category"><Badge>{purchase.category}</Badge></td><td data-label="Quantity">{purchase.quantity} {purchase.unit}</td><td data-label="Paid" className="table-total">{formatCurrency(purchase.price)}</td><td data-label="Actions"><div className="table-actions"><button className="icon-button" aria-label={`Edit purchase ${purchase.itemName}`} onClick={() => setEditing(purchase)}><Pencil size={14} /></button><button className="icon-button" aria-label={`Copy purchase ${purchase.itemName}`} onClick={() => onCopy(purchase)}><Copy size={14} /></button><button className="icon-button" aria-label={`Archive purchase ${purchase.itemName}`} onClick={() => onDelete(purchase)}><Archive size={14} /></button></div></td></tr>)}</tbody></table>{purchases.length === 0 && <EmptyState icon={<Search size={18} />} title="No purchases match" description="Try adjusting the dates, store or item search." />}</Card>
    {editing && <PurchaseEditor key={editing.id} initial={editing} onClose={() => setEditing(null)} onSave={(purchase) => { onSave({ ...purchase, id: editing.id, ...(editing.tripId ? { tripId: editing.tripId } : {}) }); setEditing(null); }} />}
  </>;
}

function PriceHistory({ data }: { data: TrackerData }) {
  const formatCurrency = useCurrencyFormatter();
  const [item, setItem] = useState("All items");
  const names = [...new Set(data.purchases.map((purchase) => purchase.itemName))].sort();
  const purchases = [...data.purchases].filter((purchase) => item === "All items" || purchase.itemName === item).sort((a, b) => a.itemName.localeCompare(b.itemName) || a.date.localeCompare(b.date));
  return <><PageHeading eyebrow="A little perspective" title="Item price history" subtitle="See how the things you buy have changed over time." />
    <div className="toolbar"><div style={{ display: "flex", alignItems: "center", gap: 8, color: "#818980", fontSize: 11 }}><Filter size={14} /> Showing prices for</div><Select aria-label="Filter price history by item" style={{ width: 220 }} value={item} onChange={(e) => setItem(e.target.value)}><option>All items</option>{names.map((name) => <option key={name}>{name}</option>)}</Select><Badge>{purchases.length} records</Badge></div>
    <Card className="table-card"><table className="data-table"><thead><tr><th>Item</th><th>Date</th><th>Store</th><th>Quantity</th><th>Price paid</th><th>Unit price</th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id}><td data-label="Item"><div className="table-primary">{purchase.itemName}</div><div className="table-secondary">{purchase.category}</div></td><td data-label="Date">{dateLabel(purchase.date)}</td><td data-label="Store">{purchase.store}</td><td data-label="Quantity">{purchase.quantity} {purchase.unit}</td><td data-label="Price paid" className="table-total">{formatCurrency(purchase.price)}</td><td data-label="Unit price">{formatCurrency(purchase.price / purchase.quantity)} <span className="table-secondary">/ {purchase.unit}</span></td></tr>)}</tbody></table>{purchases.length === 0 && <EmptyState icon={<ArrowLeftRight size={18} />} title="No price history yet" description="Record a few purchases to see their price history here." />}</Card>
  </>;
}

function Reports({ data }: { data: TrackerData }) {
  const formatCurrency = useCurrencyFormatter();
  const currency = useContext(CurrencyContext);
  const current = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const purchases = data.purchases.filter((purchase) => monthKey(purchase.date) === key);
    return { key, label: date.toLocaleDateString(undefined, { month: "short" }), total: purchases.reduce((sum, purchase) => sum + purchase.price, 0), purchases };
  });
  const max = Math.max(1, ...months.map((month) => month.total));
  const allMonths = [...new Set(data.purchases.map((purchase) => monthKey(purchase.date)))].sort().reverse();
  return <><PageHeading eyebrow="The bigger picture" title="Your reports" subtitle="A gentle look at where your shopping budget goes." />
    <div className="report-grid"><Card><div className="card-head"><div><h2 className="section-title">Monthly spending</h2><p className="section-description">Your last six months</p></div><Badge tone="green"><BarChart3 size={11} /> {currency}</Badge></div><div className="report-bars">{months.map((month) => <div className="report-bar-item" key={month.key} title={`${month.label}: ${formatCurrency(month.total)}`}><span className="report-bar-value">{month.total ? formatCurrency(month.total) : "—"}</span><div className="report-bar" style={{ height: `${Math.max(3, month.total / max * 100)}%`, opacity: month.key === monthKey(today()) ? 1 : .65 }} /><span className="report-bar-label">{month.label}</span></div>)}</div></Card>
      <Card><div className="card-head"><div><h2 className="section-title">Spending by category</h2><p className="section-description">This month, so far</p></div></div><CategoryBreakdown purchases={data.purchases.filter((purchase) => monthKey(purchase.date) === monthKey(today()))} /></Card></div>
    <Card style={{ marginTop: 16 }}><div className="card-head"><div><h2 className="section-title">Monthly summary</h2><p className="section-description">Every month you've recorded a purchase</p></div></div>{allMonths.length ? <div className="recent-list">{allMonths.map((key) => { const entries = data.purchases.filter((purchase) => monthKey(purchase.date) === key); const total = entries.reduce((sum, purchase) => sum + purchase.price, 0); const date = new Date(`${key}-01T12:00:00`); return <div className="recent-row" key={key}><div className="item-dot"><CalendarDays size={15} /></div><div className="recent-info"><div className="recent-name">{date.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div><div className="recent-meta">{entries.length} purchases · {new Set(entries.map((purchase) => purchase.store)).size} stores</div></div><div className="recent-price">{formatCurrency(total)}</div></div>; })}</div> : <EmptyState icon={<BarChart3 size={18} />} title="No data to report yet" description="Your monthly summaries will appear once you start tracking purchases." />}</Card>
  </>;
}

function ReminderCard({ reminder, categories, onSave, onDelete, onToggle }: {
  reminder: Reminder;
  categories: string[];
  onSave: (reminder: Omit<Reminder, "id">, id?: string) => void;
  onDelete: (id: string) => void;
  onToggle: (reminder: Reminder) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(reminder.title);
  const [date, setDate] = useState(reminder.date);
  const [category, setCategory] = useState(reminder.category || "General");
  const [details, setDetails] = useState(reminder.details);
  const [error, setError] = useState("");

  function startEditing() {
    setTitle(reminder.title);
    setDate(reminder.date);
    setCategory(reminder.category || "General");
    setDetails(reminder.details);
    setError("");
    setEditing(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !date || !category.trim()) {
      setError("Enter a title, date, and category.");
      return;
    }
    onSave({ title: title.trim(), date, category: category.trim(), details: details.trim(), completed: reminder.completed }, reminder.id);
    setEditing(false);
  }

  if (editing) return <Card className="reminder-card reminder-card-editing">
    <form className="reminder-inline-form" onSubmit={submit}>
      <Field label="Title"><Input autoFocus maxLength={120} required value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field label="Date"><DateInput required value={date} onValueChange={setDate} /></Field>
      <Field className="full" label="Category"><div className="reminder-category-grid" role="group" aria-label="Choose reminder category">{categories.map((entry) => <button key={entry} type="button" className={`category-choice ${category === entry ? "selected" : ""}`} aria-pressed={category === entry} onClick={() => setCategory(entry)}>{entry}</button>)}</div></Field>
      <Field className="full" label="Details"><textarea className="field textarea" rows={3} maxLength={1000} value={details} onChange={(event) => setDetails(event.target.value)} /></Field>
      {error && <div className="alert alert-error full" role="alert">{error}</div>}
      <div className="reminder-form-actions full"><Button type="submit"><Check size={14} />Save changes</Button><Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button></div>
    </form>
  </Card>;

  return <Card className={`reminder-card ${reminder.completed ? "completed" : ""}`}>
    <button className={`check-button ${reminder.completed ? "checked" : ""}`} aria-label={reminder.completed ? `Mark ${reminder.title} as incomplete` : `Mark ${reminder.title} as complete`} onClick={() => onToggle(reminder)}>{reminder.completed && <Check size={12} />}</button>
    <div className="recent-info"><div className="recent-name">{reminder.title}</div><div className="recent-meta">{dateLabel(reminder.date)}{reminder.details && <> · <LinkifiedText>{reminder.details}</LinkifiedText></>}</div></div>
    <Badge className="reminder-category-badge">{reminder.category || "General"}</Badge>
    <Badge className="reminder-status-badge" tone={reminder.completed ? "neutral" : reminder.date < today() ? "amber" : reminder.date === today() ? "green" : "blue"}>{reminder.completed ? "Done" : reminder.date < today() ? "Overdue" : reminder.date === today() ? "Today" : "Upcoming"}</Badge>
    <div className="table-actions"><button className="icon-button" aria-label={`Edit ${reminder.title}`} onClick={startEditing}><Pencil size={14} /></button><button className="icon-button" aria-label={`Copy ${reminder.title}`} onClick={() => { const { id, ...copy } = reminder; void id; onSave(copy); }}><Copy size={14} /></button><button className="icon-button" aria-label={`Archive ${reminder.title}`} onClick={() => { if (window.confirm(`Move "${reminder.title}" to the archive?`)) onDelete(reminder.id); }}><Archive size={14} /></button></div>
  </Card>;
}

function ReminderPage({ reminders, categories: savedCategories, onSave, onDelete, onToggle }: { reminders: Reminder[]; categories: string[]; onSave: (reminder: Omit<Reminder, "id">, id?: string) => void; onDelete: (id: string) => void; onToggle: (reminder: Reminder) => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState("General");
  const [details, setDetails] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [statusFilter, setStatusFilter] = useState("All reminders");
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !date || !category.trim()) { setError("Enter a reminder title, date, and category."); return; }
    onSave({ title: title.trim(), date, category: category.trim(), details: details.trim(), completed: false });
    setTitle(""); setDate(today()); setCategory("General"); setDetails(""); setError("");
  }
  const categories = [...new Set([...REMINDER_CATEGORIES, ...savedCategories, ...reminders.map((reminder) => reminder.category?.trim() || "General")])]
    .sort((a, b) => a.localeCompare(b));
  const query = search.trim().toLocaleLowerCase();
  const visible = reminders
    .filter((reminder) => categoryFilter === "All categories" || (reminder.category || "General") === categoryFilter)
    .filter((reminder) => statusFilter === "All reminders" || (statusFilter === "Completed" ? reminder.completed : !reminder.completed))
    .filter((reminder) => [reminder.title, reminder.category || "General", reminder.details, reminder.date, reminder.completed ? "completed done" : "pending upcoming"]
      .some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((a, b) => Number(a.completed) - Number(b.completed) || a.date.localeCompare(b.date));
  return <><PageHeading eyebrow="Keep a note of it" title="Notes & reminders" subtitle="Search and group reminders by category. Edit any record directly where it appears in the list." />
    <Card className="reminder-form-card"><h2 className="section-title">Add a note or reminder</h2><form className="form-grid reminder-form" onSubmit={submit}>
      <Field label="Title"><Input autoFocus maxLength={120} required placeholder="e.g. Pick up a prescription" value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field label="Date"><DateInput required value={date} onValueChange={setDate} /></Field>
      <Field className="full" label="Category"><div className="reminder-category-grid" role="group" aria-label="Choose reminder category">{categories.map((entry) => <button key={entry} type="button" className={`category-choice ${category === entry ? "selected" : ""}`} aria-pressed={category === entry} onClick={() => setCategory(entry)}>{entry}</button>)}</div></Field>
      <Field className="full" label="Details (optional)"><textarea className="field textarea" rows={3} maxLength={1000} placeholder="Add any useful details..." value={details} onChange={(event) => setDetails(event.target.value)} /></Field>
      {error && <div className="alert alert-error full" role="alert">{error}</div>}
      <div className="reminder-form-actions full"><Button type="submit"><Plus size={14} />Add reminder</Button></div>
    </form></Card>
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search reminders" placeholder="Search title, category, date, details..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select aria-label="Filter reminders by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All reminders</option><option>Pending</option><option>Completed</option></Select><Badge>{visible.length} {visible.length === 1 ? "reminder" : "reminders"}</Badge></div>
    <div className="reminder-group-picker" role="group" aria-label="Filter reminders by category">{["All categories", ...categories].map((entry) => <button key={entry} type="button" className={`category-choice ${categoryFilter === entry ? "selected" : ""}`} aria-pressed={categoryFilter === entry} onClick={() => setCategoryFilter(entry)}>{entry}{entry === "All categories" && <span>{reminders.length}</span>}</button>)}</div>
    <div className="reminder-page-list">{visible.length ? visible.map((reminder) => <ReminderCard key={reminder.id} reminder={reminder} categories={categories} onSave={onSave} onDelete={onDelete} onToggle={onToggle} />) : <Card><EmptyState icon={<Bell size={18} />} title={reminders.length ? "No matching reminders" : "No notes or reminders yet"} description={reminders.length ? "Try another search or category filter." : "Add a dated reminder and it will appear here and on your dashboard when due."} /></Card>}</div>
  </>;
}

function MasterData({ stores, products, reminders, reminderCategories, onAddStore, onSaveStore, onDeleteStore, onAddProduct, onSaveProduct, onDeleteProduct, onAddReminderCategory, onRenameReminderCategory, onDeleteReminderCategory }: { stores: Store[]; products: Product[]; reminders: Reminder[]; reminderCategories: string[]; onAddStore: (store: Omit<Store, "id">) => void; onSaveStore: (store: Omit<Store, "id">, id: string) => void; onDeleteStore: (id: string) => void; onAddProduct: (product: Omit<Product, "id">) => void; onSaveProduct: (product: Omit<Product, "id">, id: string) => void; onDeleteProduct: (id: string) => void; onAddReminderCategory: (category: string) => void; onRenameReminderCategory: (oldCategory: string, newCategory: string) => void; onDeleteReminderCategory: (category: string) => void }) {
  const currency = useContext(CurrencyContext);
  const [storeName, setStoreName] = useState("");
  const [location, setLocation] = useState("");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState<Category>("Groceries");
  const [unit, setUnit] = useState("pcs");
  const [price, setPrice] = useState(0);
  const [reminderCategoryName, setReminderCategoryName] = useState("");
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  function addStore(event: FormEvent) {
    event.preventDefault();
    if (!storeName.trim()) { setError("Enter a store name."); return; }
    if (stores.some((store) => store.id !== editingStore?.id && store.name.toLowerCase() === storeName.trim().toLowerCase())) { setError("That store is already in your master data."); return; }
    const saved = { name: storeName.trim(), location: location.trim() };
    if (editingStore) onSaveStore(saved, editingStore.id); else onAddStore(saved);
    setEditingStore(null); setStoreName(""); setLocation(""); setError("");
  }
  function addProduct(event: FormEvent) {
    event.preventDefault();
    if (!productName.trim() || !unit.trim() || !Number.isFinite(price) || price < 0) { setError("Enter a product name, unit, and a non-negative unit price."); return; }
    if (products.some((product) => product.id !== editingProduct?.id && product.name.toLowerCase() === productName.trim().toLowerCase())) { setError("That product is already in your master data."); return; }
    const saved = { name: productName.trim(), category, unit: unit.trim(), estimatedPrice: price };
    if (editingProduct) onSaveProduct(saved, editingProduct.id); else onAddProduct(saved);
    setEditingProduct(null); setProductName(""); setUnit("pcs"); setPrice(0); setError("");
  }
  function addReminderCategory(event: FormEvent) {
    event.preventDefault();
    const name = reminderCategoryName.trim();
    if (!name) { setError("Enter a reminder category name."); return; }
    if (REMINDER_CATEGORIES.some((entry) => entry.toLocaleLowerCase() === name.toLocaleLowerCase()) ||
      reminderCategories.some((entry) => entry.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError("That reminder category already exists.");
      return;
    }
    onAddReminderCategory(name);
    setReminderCategoryName("");
    setError("");
  }
  return <><PageHeading eyebrow="Reusable shopping details" title="Master data" subtitle="Save and maintain reusable products, stores and reminder categories." />
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    <div className="master-grid">
      <Card>
        <div className="card-head"><div><h2 className="section-title">Product master</h2><p className="section-description">Reusable names, units and per-unit price estimates</p></div><ShoppingBasket size={16} /></div>
        <form className="form-grid master-form" onSubmit={addProduct}>
          <Field className="full" label="Product name"><Input required maxLength={100} placeholder="e.g. Basmati rice" value={productName} onChange={(event) => setProductName(event.target.value)} /></Field>
          <Field label="Category"><Select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</Select></Field>
          <Field label="Unit"><Input list="master-item-units" required value={unit} onChange={(event) => setUnit(event.target.value)} /><datalist id="master-item-units">{ITEM_UNITS.map((entry) => <option key={entry} value={entry} />)}</datalist></Field>
          <Field className="full" label={`Price per ${unit || "unit"} (${currency})`}><Input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></Field>
          <div className="full"><Button type="submit">{editingProduct ? <><Check size={14} />Save product</> : <><Plus size={14} />Add product</>}</Button>{editingProduct && <Button type="button" variant="outline" style={{ marginLeft: 8 }} onClick={() => { setEditingProduct(null); setProductName(""); setUnit("pcs"); setPrice(0); }}>Cancel</Button>}</div>
        </form>
        <div className="master-entry-list">{products.length ? products.map((product) => <div className="master-entry" key={product.id}><div className="recent-info"><div className="recent-name">{product.name}</div><div className="recent-meta">{product.category} · {formatMoney(product.estimatedPrice, currency)} per {product.unit}</div></div><button className="icon-button" aria-label={`Edit ${product.name}`} onClick={() => { setEditingProduct(product); setProductName(product.name); setCategory(product.category); setUnit(product.unit); setPrice(product.estimatedPrice); }}><Pencil size={14} /></button><button className="icon-button" aria-label={`Copy ${product.name}`} title="Create a copy" onClick={() => onAddProduct({ name: `${product.name} (copy)`, category: product.category, unit: product.unit, estimatedPrice: product.estimatedPrice })}><Copy size={14} /></button><button className="icon-button" aria-label={`Archive ${product.name}`} onClick={() => { if (window.confirm(`Move "${product.name}" to the archive?`)) onDeleteProduct(product.id); }}><Archive size={14} /></button></div>) : <p className="section-description">No saved products yet.</p>}</div>
      </Card>
      <Card>
        <div className="card-head"><div><h2 className="section-title">Store master</h2><p className="section-description">Save store names and optional addresses or locations</p></div><Database size={16} /></div>
        <form className="form-grid master-form" onSubmit={addStore}>
          <Field className="full" label="Store name"><Input required maxLength={100} placeholder="e.g. Green Basket" value={storeName} onChange={(event) => setStoreName(event.target.value)} /></Field>
          <Field className="full" label="Address / location (optional)"><Input maxLength={200} placeholder="Street, neighborhood, or a note to identify it" value={location} onChange={(event) => setLocation(event.target.value)} /></Field>
          <div className="full"><Button type="submit">{editingStore ? <><Check size={14} />Save store</> : <><Plus size={14} />Add store</>}</Button>{editingStore && <Button type="button" variant="outline" style={{ marginLeft: 8 }} onClick={() => { setEditingStore(null); setStoreName(""); setLocation(""); }}>Cancel</Button>}</div>
        </form>
        <div className="master-entry-list">{stores.length ? stores.map((store) => <div className="master-entry" key={store.id}><div className="recent-info"><div className="recent-name">{store.name}</div><div className="recent-meta">{store.location || "No location added"}</div></div><button className="icon-button" aria-label={`Edit ${store.name}`} onClick={() => { setEditingStore(store); setStoreName(store.name); setLocation(store.location); }}><Pencil size={14} /></button><button className="icon-button" aria-label={`Copy ${store.name}`} title="Create a copy" onClick={() => onAddStore({ name: `${store.name} (copy)`, location: store.location })}><Copy size={14} /></button><button className="icon-button" aria-label={`Archive ${store.name}`} onClick={() => { if (window.confirm(`Move "${store.name}" to the archive?`)) onDeleteStore(store.id); }}><Archive size={14} /></button></div>) : <p className="section-description">No saved stores yet.</p>}</div>
      </Card>
      <Card><div className="card-head"><div><h2 className="section-title">Reminder categories</h2><p className="section-description">Create reusable groups for Notes & reminders</p></div><Bell size={16} /></div><form className="master-form reminder-category-master-form" onSubmit={addReminderCategory}><Field label="New category"><Input required maxLength={80} placeholder="e.g. Travel, Family" value={reminderCategoryName} onChange={(event) => setReminderCategoryName(event.target.value)} /></Field><Button type="submit"><Plus size={14} />Add category</Button></form><div className="master-entry-list">{reminderCategories.length ? reminderCategories.map((entry) => { const uses = reminders.filter((reminder) => (reminder.category || "General").toLocaleLowerCase() === entry.toLocaleLowerCase()).length; return <div className="master-entry" key={entry}><div className="recent-info"><div className="recent-name">{entry}</div><div className="recent-meta">{uses} {uses === 1 ? "reminder" : "reminders"}</div></div><button className="icon-button" aria-label={`Edit ${entry} reminder category`} onClick={() => { const renamed = window.prompt(`Rename the "${entry}" category`, entry)?.trim(); if (renamed && renamed !== entry) onRenameReminderCategory(entry, renamed); }}><Pencil size={14} /></button><button className="icon-button" aria-label={`Archive ${entry} reminder category`} title={uses ? "Reassign reminders before archiving" : "Move to archive"} disabled={uses > 0} onClick={() => { if (window.confirm(`Move the "${entry}" reminder category to the archive?`)) onDeleteReminderCategory(entry); }}><Archive size={14} /></button></div>; }) : <p className="section-description">No custom categories yet. Built-in categories are always available.</p>}</div></Card>
    </div>
  </>;
}

function ArchivePage({ records, onRestore, onCopy, onDelete }: { records: ArchivedRecord[]; onRestore: (id: string) => void; onCopy: (id: string) => void; onDelete: (id: string) => void }) {
  const sortedRecords = [...records].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
  return <><PageHeading eyebrow="Recover or permanently remove" title="Archive" subtitle="Deleted records are kept here until you restore them or permanently delete them. The encrypted credential vault is not included." />
    {sortedRecords.length ? <div className="reminder-page-list">{sortedRecords.map((record) => {
      const contents = Object.entries(record.snapshot).flatMap(([collection, rows]) =>
        Array.isArray(rows) && rows.length ? [`${rows.length} ${collection}`] : []);
      const count = Object.values(record.snapshot).reduce((total, rows) => total + (Array.isArray(rows) ? rows.length : 0), 0);
      const hasDocuments = (record.snapshot.documents?.length ?? 0) > 0;
      return <Card key={record.id}><div className="card-head"><div><h2 className="section-title">{record.label}</h2><p className="section-description">Archived {new Date(record.archivedAt).toLocaleString()}{contents.length ? ` · ${contents.join(", ")}` : ""}</p></div><Badge>{count} {count === 1 ? "record" : "records"}</Badge></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button onClick={() => onRestore(record.id)}><ArrowDownToLine size={14} />Restore</Button>{!hasDocuments && <Button variant="outline" onClick={() => onCopy(record.id)}><Copy size={14} />Restore a copy</Button>}<Button variant="outline" onClick={() => { if (window.confirm(`Permanently delete "${record.label}" from the archive? This cannot be undone.`)) onDelete(record.id); }}><Trash2 size={14} />Delete permanently</Button></div></Card>;
    })}</div> : <Card><EmptyState icon={<Archive size={18} />} title="The archive is empty" description="When you archive a record from any supported screen, it will be available here." /></Card>}
  </>;
}

function withArchivedRecord(previous: TrackerData, label: string, snapshot: ArchiveSnapshot): TrackerData {
  const archivedRecord: ArchivedRecord = {
    id: createId(),
    label,
    archivedAt: new Date().toISOString(),
    snapshot,
  };
  return { ...previous, archivedRecords: [archivedRecord, ...(previous.archivedRecords ?? [])] };
}

function mergeArchivedRows<T extends { id: string }>(current: T[] | undefined, archived: T[] | undefined): T[] {
  const merged = [...(current ?? [])];
  for (const record of archived ?? []) {
    const existing = merged.findIndex((entry) => entry.id === record.id);
    if (existing < 0) merged.push(record);
    else merged[existing] = record;
  }
  return merged;
}

function mergeArchivedSubscriptions(current: SubscriptionAccount[] | undefined, archived: SubscriptionAccount[] | undefined): SubscriptionAccount[] {
  const merged = [...(current ?? [])];
  for (const account of archived ?? []) {
    const existing = merged.findIndex((entry) => entry.id === account.id);
    if (existing < 0) merged.push(account);
    else {
      const active = merged[existing];
      merged[existing] = {
        ...active,
        transactions: mergeArchivedRows(active.transactions, account.transactions),
      };
    }
  }
  return merged;
}

function restoreEducationRecords(current: EducationRecord[] | undefined, archived: EducationRecord[] | undefined): EducationRecord[] {
  const restored = [...(current ?? [])];
  for (const record of archived ?? []) {
    const index = restored.findIndex((entry) => entry.id === record.id);
    if (index < 0) restored.push(record);
    else {
      const active = restored[index];
      restored[index] = {
        ...active,
        subjects: mergeArchivedRows(active.subjects, record.subjects),
        exams: mergeArchivedRows(active.exams, record.exams),
        payments: mergeArchivedRows(active.payments, record.payments),
      };
    }
  }
  return restored;
}

function restoreShoppingTrips(current: ShoppingTrip[] | undefined, archived: ShoppingTrip[] | undefined): ShoppingTrip[] {
  const restored = [...(current ?? [])];
  for (const trip of archived ?? []) {
    const index = restored.findIndex((entry) => entry.id === trip.id);
    if (index < 0) restored.push(trip);
    else {
      const active = restored[index];
      restored[index] = {
        ...active,
        purchaseIds: [...new Set([...active.purchaseIds, ...trip.purchaseIds])],
      };
    }
  }
  return restored;
}

function cloneArchiveSnapshot(snapshot: ArchiveSnapshot): ArchiveSnapshot {
      const ids = new Map<string, string>();
      function cloneAndRekey(value: unknown): unknown {
        if (Array.isArray(value)) return value.map(cloneAndRekey);
        if (typeof value !== "object" || value === null) return value;
        const cloned: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value)) {
          if (key === "id" && typeof entry === "string") {
            const newId = ids.get(entry) ?? createId();
            ids.set(entry, newId);
            cloned[key] = newId;
          } else {
            cloned[key] = cloneAndRekey(entry);
          }
        }
        return cloned;
      }
      function remapReferences(value: unknown): unknown {
        if (Array.isArray(value)) return value.map(remapReferences);
        if (typeof value !== "object" || value === null) return value;
        const cloned: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value)) {
          if (typeof entry === "string" && ["itemId", "tripId", "stockId", "vehicleId", "recipeId"].includes(key)) {
            cloned[key] = ids.get(entry) ?? entry;
          } else if (key === "purchaseIds" && Array.isArray(entry)) {
            cloned[key] = entry.map((id) => typeof id === "string" ? ids.get(id) ?? id : id);
          } else {
            cloned[key] = remapReferences(entry);
          }
        }
        return cloned;
      }
      return remapReferences(cloneAndRekey(snapshot)) as ArchiveSnapshot;
    }

function mergeArchiveSnapshot(previous: TrackerData, snapshot: ArchiveSnapshot): TrackerData {
  return {
        ...previous,
        items: mergeArchivedRows(previous.items, snapshot.items),
        purchases: mergeArchivedRows(previous.purchases, snapshot.purchases),
        trips: restoreShoppingTrips(previous.trips, snapshot.trips),
        stores: mergeArchivedRows(previous.stores, snapshot.stores),
        products: mergeArchivedRows(previous.products, snapshot.products),
        reminders: mergeArchivedRows(previous.reminders, snapshot.reminders),
        reminderCategories: [...new Set([...(previous.reminderCategories ?? []), ...(snapshot.reminderCategories ?? [])])],
        brokers: [...new Set([...(previous.brokers ?? []), ...(snapshot.brokers ?? [])])],
        stocks: mergeArchivedRows(previous.stocks, snapshot.stocks),
        stockQuotes: mergeArchivedRows(previous.stockQuotes, snapshot.stockQuotes),
        assets: mergeArchivedRows(previous.assets, snapshot.assets),
        learningRecords: mergeArchivedRows(previous.learningRecords, snapshot.learningRecords),
        trainingSessions: mergeArchivedRows(previous.trainingSessions, snapshot.trainingSessions),
        educationRecords: restoreEducationRecords(previous.educationRecords, snapshot.educationRecords),
        vehicles: mergeArchivedRows(previous.vehicles, snapshot.vehicles),
        vehicleJourneys: mergeArchivedRows(previous.vehicleJourneys, snapshot.vehicleJourneys),
        vehicleMaintenance: mergeArchivedRows(previous.vehicleMaintenance, snapshot.vehicleMaintenance),
        electricityReadings: mergeArchivedRows(previous.electricityReadings, snapshot.electricityReadings),
        subscriptions: mergeArchivedSubscriptions(previous.subscriptions, snapshot.subscriptions),
        devotionalEntries: mergeArchivedRows(previous.devotionalEntries, snapshot.devotionalEntries),
        devotionalResources: mergeArchivedRows(previous.devotionalResources, snapshot.devotionalResources),
        prayerRequests: mergeArchivedRows(previous.prayerRequests, snapshot.prayerRequests),
        cookingRecipes: mergeArchivedRows(previous.cookingRecipes, snapshot.cookingRecipes),
        cookingLogs: mergeArchivedRows(previous.cookingLogs, snapshot.cookingLogs),
        issueRecords: mergeArchivedRows(previous.issueRecords, snapshot.issueRecords),
        personalEducation: mergeArchivedRows(previous.personalEducation, snapshot.personalEducation),
        professionalQualifications: mergeArchivedRows(previous.professionalQualifications, snapshot.professionalQualifications),
        workExperiences: mergeArchivedRows(previous.workExperiences, snapshot.workExperiences),
        professionalSkills: mergeArchivedRows(previous.professionalSkills, snapshot.professionalSkills),
        familyMembers: mergeArchivedRows(previous.familyMembers, snapshot.familyMembers),
        personalRecords: mergeArchivedRows(previous.personalRecords, snapshot.personalRecords),
        documents: mergeArchivedRows(previous.documents, snapshot.documents),
        promptRecords: mergeArchivedRows(previous.promptRecords, snapshot.promptRecords),
        mindfulHabits: mergeArchivedRows(previous.mindfulHabits, snapshot.mindfulHabits),
        mindfulnessLogs: mergeArchivedRows(previous.mindfulnessLogs, snapshot.mindfulnessLogs),
  };
}

type StockImportDraft = {
  id: string;
  symbol: string;
  name: string;
  exchange: StockExchange;
  broker: string;
  averageBuyPrice: string;
  quantity: string;
};

const STOCK_IMPORT_LABELS = new Set([
  "ACCOUNT", "AMOUNT", "AVG", "AVERAGE", "BALANCE", "BSE", "BUY", "CHANGE", "CLOSE", "COST", "CURRENT",
  "DESCRIPTION", "EQUITY", "HIGH", "HOLDING", "HOLDINGS", "INVESTED", "INVESTMENT", "LOW", "LTP", "MARKET",
  "NAME", "NSE", "OPEN", "OVERALL", "PERCENT", "PORTFOLIO", "PRICE", "QTY", "QUANTITY", "SECURITY", "SHARES",
  "SCRIP", "STOCK", "STOCKS", "SYMBOL", "TOTAL", "VALUE",
]);

function parseStockImportText(text: string): StockImportDraft[] {
  const rows: StockImportDraft[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const tokens = line.match(/\b[A-Za-z0-9][A-Za-z0-9&._-]{1,14}\b/g) ?? [];
    const symbolToken = tokens.find((token) => {
      const letters = token.match(/[A-Za-z]/g) ?? [];
      const uppercaseLetters = token.match(/[A-Z]/g) ?? [];
      return letters.length >= 2 && uppercaseLetters.length / letters.length >= 0.65 &&
        !STOCK_IMPORT_LABELS.has(token.toUpperCase());
    });
    if (!symbolToken) continue;
    const symbol = symbolToken.replace(/[.,]+$/, "").toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9.&_-]{0,29}$/.test(symbol) || STOCK_IMPORT_LABELS.has(symbol)) continue;
    const quantityMatch = line.match(/\b(?:qty|quantity|shares?)\s*[:=-]?\s*([\d,]+)/i);
    const priceMatch = line.match(/\b(?:avg\.?\s*(?:(?:buy|average)\s*)?(?:price|cost)|average(?:\s+buy)?(?:\s+(?:price|cost))?|buy\s+price)\s*[:=₹\s]*([\d,]+(?:\.\d+)?)/i);
    const rowValues = [...line.slice(line.indexOf(symbolToken) + symbolToken.length).matchAll(/\d[\d,]*(?:\.\d+)?%?/g)]
      .slice(0, 2)
      .map((match) => Number(match[0].replace(/[,%]/g, "")));
    if (!quantityMatch && !priceMatch &&
      (!rowValues.length || rowValues.some((value) => !Number.isFinite(value) || value > 1_000_000) ||
        (rowValues.length === 1 && symbol.length < 3))) continue;
    const exchange = /\bBSE\b/i.test(line) ? "BSE" : "NSE";
    const key = `${exchange}:${symbol}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      id: createId(),
      symbol,
      name: symbol,
      exchange,
      broker: "",
      averageBuyPrice: priceMatch ? priceMatch[1].replace(/,/g, "") : "",
      quantity: quantityMatch ? quantityMatch[1].replace(/,/g, "") : "",
    });
    if (rows.length >= 100) break;
  }
  return rows;
}

function parseStockImportTsv(tsv: string, imageWidth: number): StockImportDraft[] {
  const words = tsv.split(/\r?\n/).slice(1).flatMap((line) => {
    const columns = line.split("\t");
    if (columns.length < 12 || columns[0] !== "5" || !columns[11].trim()) return [];
    const [block, paragraph, lineNumber] = columns.slice(2, 5);
    const left = Number(columns[6]);
    const top = Number(columns[7]);
    const width = Number(columns[8]);
    const confidence = Number(columns[10]);
    if (![left, top, width, confidence].every(Number.isFinite)) return [];
    return [{
      key: `${block}:${paragraph}:${lineNumber}`,
      text: columns[11].trim(),
      left,
      top,
      center: left + width / 2,
      confidence,
    }];
  });
  if (!words.length) return [];

  const headerLines = new Map<string, typeof words>();
  for (const word of words) {
    if (!headerLines.has(word.key)) headerLines.set(word.key, []);
    headerLines.get(word.key)!.push(word);
  }
  const columnHeader = [...headerLines.values()].find((line) =>
    line.some((word) => /^(?:QU|QUY|QTY|QUAN|QUANT|QUANTY|QUANTITY)$/i.test(word.text.replace(/[^A-Z]/gi, ""))) &&
    line.some((word) => /^(?:AVG|AWG|AVER|AVGP|AWGP|AVERAGE)/i.test(word.text.replace(/[^A-Z]/gi, ""))));
  const quantityHeader = columnHeader?.find((word) => /^(?:QU|QUY|QTY|QUAN|QUANT|QUANTY|QUANTITY)$/i.test(word.text.replace(/[^A-Z]/gi, "")));
  const averageHeader = columnHeader?.find((word) => /^(?:AVG|AWG|AVER|AVGP|AWGP|AVERAGE)/i.test(word.text.replace(/[^A-Z]/gi, "")));
  const quantityCenter = quantityHeader?.center ?? imageWidth * 0.265;
  const averageCenter = averageHeader?.center ?? Math.max(quantityCenter + imageWidth * 0.035, imageWidth * 0.3);
  const columnBoundary = (quantityCenter + averageCenter) / 2;
  const tickerBoundary = quantityCenter - imageWidth * 0.07;
  const tableTop = columnHeader ? Math.max(...columnHeader.map((word) => word.top)) : 0;
  const rowsByLine = new Map<string, typeof words>();
  for (const word of words) {
    if (word.top <= tableTop) continue;
    if (!rowsByLine.has(word.key)) rowsByLine.set(word.key, []);
    rowsByLine.get(word.key)!.push(word);
  }

  const rows: StockImportDraft[] = [];
  const seen = new Set<string>();
  for (const line of rowsByLine.values()) {
    const symbolWord = line.find((word) => {
      if (word.left >= tickerBoundary || word.confidence < 15) return false;
      const letters = word.text.match(/[A-Za-z]/g) ?? [];
      const uppercaseLetters = word.text.match(/[A-Z]/g) ?? [];
      const symbol = word.text.toUpperCase();
      return letters.length >= 2 && uppercaseLetters.length / letters.length >= 0.65 &&
        /^[A-Z0-9][A-Z0-9&._-]{1,14}$/.test(symbol) && !STOCK_IMPORT_LABELS.has(symbol);
    });
    if (!symbolWord) continue;

    const quantity = line
      .filter((word) => word.center < columnBoundary && word.center > tickerBoundary && word.confidence >= 15)
      .map((word) => parseStockImportNumber(word.text, true))
      .find((value): value is string => value !== "");
    const averageBuyPrice = line
      .filter((word) => word.center >= columnBoundary && word.center < averageCenter + imageWidth * 0.06 && word.confidence >= 15)
      .map((word) => parseStockImportNumber(word.text, false))
      .find((value): value is string => value !== "");
    if (!quantity && !averageBuyPrice) continue;

    const symbol = symbolWord.text.toUpperCase();
    const key = `${symbol}:${symbolWord.top}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: createId(),
      symbol,
      name: symbol,
      exchange: line.some((word) => /\bBSE\b/i.test(word.text)) ? "BSE" : "NSE",
      broker: "",
      averageBuyPrice: averageBuyPrice ?? "",
      quantity: quantity ?? "",
    });
    if (rows.length >= 100) break;
  }
  return rows;
}

function parseStockImportNumber(text: string, integerOnly: boolean): string {
  const ocrText = integerOnly ? text.replace(/%/g, "5") : text;
  const normalized = ocrText.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return "";
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > 100_000_000 || integerOnly && !Number.isInteger(value)) return "";
  return normalized;
}

function StockWorkspace({ stocks, brokers, quotes, onSaveStock, onDeleteStock, onAddBroker, onRenameBroker, onDeleteBroker, onSaveQuote }: {
  stocks: TrackedStock[];
  brokers: string[];
  quotes: StockQuoteSnapshot[];
  onSaveStock: (stock: Omit<TrackedStock, "id">, id?: string) => void;
  onDeleteStock: (id: string) => void;
  onAddBroker: (name: string) => void;
  onRenameBroker: (oldName: string, newName: string) => void;
  onDeleteBroker: (name: string) => void;
  onSaveQuote: (quote: Omit<StockQuoteSnapshot, "id">) => void;
}) {
  const [brokerName, setBrokerName] = useState("");
  const [editingBroker, setEditingBroker] = useState<{ original: string; value: string } | null>(null);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [exchange, setExchange] = useState<StockExchange>("NSE");
  const [broker, setBroker] = useState("");
  const [averageBuyPrice, setAverageBuyPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshErrors, setRefreshErrors] = useState<string[]>([]);
  const [manualQuoteDraft, setManualQuoteDraft] = useState<{ stockId: string; price: string } | null>(null);
  const [manualQuoteError, setManualQuoteError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importFileName, setImportFileName] = useState("");
  const [importText, setImportText] = useState("");
  const [importRows, setImportRows] = useState<StockImportDraft[]>([]);
  const [importError, setImportError] = useState("");
  const [importBroker, setImportBroker] = useState("");
  const [importBrokerDraft, setImportBrokerDraft] = useState("");
  const [addingImportBroker, setAddingImportBroker] = useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const [stockBrokerFilter, setStockBrokerFilter] = useState("all");
  const [stockExchangeFilter, setStockExchangeFilter] = useState("all");
  const [stockHoldingFilter, setStockHoldingFilter] = useState("all");
  const [stockQuoteFilter, setStockQuoteFilter] = useState("all");
  const [stockSortBy, setStockSortBy] = useState<"symbol" | "name" | "broker" | "price" | "quantity" | "value" | "profitLoss">("symbol");
  const [stockSortOrder, setStockSortOrder] = useState<"asc" | "desc">("asc");
  const [stockGroupBy, setStockGroupBy] = useState<"none" | "broker" | "exchange">("none");
  const [collapsedStockGroups, setCollapsedStockGroups] = useState<Set<string>>(() => new Set());
  const importInputRef = useRef<HTMLInputElement>(null);

  const latestQuotes = new Map<string, StockQuoteSnapshot>();
  for (const quote of quotes) {
    const previous = latestQuotes.get(quote.stockId);
    if (!previous || Date.parse(quote.timestamp) > Date.parse(previous.timestamp)) latestQuotes.set(quote.stockId, quote);
  }
  const sortedHistory = (stockId: string) => quotes.filter((quote) => quote.stockId === stockId).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const portfolioPositions = stocks.flatMap((stock) => {
    const latest = latestQuotes.get(stock.id);
    const averageBuyPrice = stock.averageBuyPrice ?? null;
    const quantity = stock.quantity ?? 0;
    if (!latest || latest.currency !== "INR" || averageBuyPrice === null || averageBuyPrice <= 0 || quantity <= 0) return [];
    const invested = averageBuyPrice * quantity;
    const currentValue = latest.price * quantity;
    return [{ invested, currentValue, profitLoss: currentValue - invested }];
  });
  const portfolioTotals = portfolioPositions.reduce((totals, position) => ({
    invested: totals.invested + position.invested,
    currentValue: totals.currentValue + position.currentValue,
    profitLoss: totals.profitLoss + position.profitLoss,
  }), { invested: 0, currentValue: 0, profitLoss: 0 });

  function resetStockForm() {
    setSymbol(""); setName(""); setExchange("NSE"); setBroker(""); setAverageBuyPrice(""); setQuantity(""); setEditingId(null);
  }
  function editStock(stock: TrackedStock) {
    setEditingId(stock.id); setSymbol(stock.symbol); setName(stock.name); setExchange(stock.exchange); setBroker(stock.broker);
    setAverageBuyPrice(stock.averageBuyPrice == null ? "" : String(stock.averageBuyPrice));
    setQuantity(stock.quantity ? String(stock.quantity) : "");
    setError(""); setNotice("");
  }
  function copyStock(stock: TrackedStock) {
    setEditingId(null);
    setSymbol(stock.symbol);
    setName(copyLabel(stock.name, 100));
    setExchange(stock.exchange);
    setBroker(stock.broker);
    setAverageBuyPrice(stock.averageBuyPrice == null ? "" : String(stock.averageBuyPrice));
    setQuantity(stock.quantity ? String(stock.quantity) : "");
    setError(`Choose a different broker before saving; ${stock.symbol} on ${stock.exchange} is already tracked with ${stock.broker || "no broker"}.`);
    setNotice("");
  }
  function submitStock(event: FormEvent) {
    event.preventDefault();
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9.&_-]{0,29}$/.test(normalizedSymbol) || !name.trim()) {
      setError("Enter a stock code using letters or numbers and a display name."); return;
    }
    if (stocks.some((stock) => stock.id !== editingId && stockIdentityKey(stock) === stockIdentityKey({ symbol: normalizedSymbol, exchange, broker }))) {
      setError(`That ${exchange} stock code is already on your list with this broker.`); return;
    }
    const parsedAverageBuyPrice = averageBuyPrice.trim() ? Number(averageBuyPrice) : null;
    const parsedQuantity = quantity.trim() ? Number(quantity) : 0;
    if ((parsedAverageBuyPrice !== null && (!Number.isFinite(parsedAverageBuyPrice) || parsedAverageBuyPrice <= 0)) ||
      !Number.isInteger(parsedQuantity) || parsedQuantity < 0 ||
      ((parsedAverageBuyPrice !== null) !== (parsedQuantity > 0))) {
      setError("Enter both a positive average buy price and a whole-number share quantity, or leave both empty."); return;
    }
    onSaveStock({ symbol: normalizedSymbol, name: name.trim(), exchange, broker, averageBuyPrice: parsedAverageBuyPrice, quantity: parsedQuantity }, editingId ?? undefined);
    resetStockForm(); setError(""); setNotice(editingId ? "Stock details updated." : "Stock added to your watchlist.");
  }
  function submitBroker(event: FormEvent) {
    event.preventDefault();
    const normalized = brokerName.trim();
    if (!normalized) { setError("Enter a broker name."); return; }
    if (brokers.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) {
      setError("That broker name already exists."); return;
    }
    onAddBroker(normalized); setBrokerName(""); setError(""); setNotice("Broker added.");
  }
  function submitBrokerRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingBroker) return;
    const renamed = editingBroker.value.trim();
    if (!renamed || renamed.length > 80 ||
      brokers.some((entry) => entry.toLocaleLowerCase() === renamed.toLocaleLowerCase() && entry !== editingBroker.original)) {
      setError("Choose a non-empty broker name (up to 80 characters) that is not already in use.");
      return;
    }
    if (renamed !== editingBroker.original) onRenameBroker(editingBroker.original, renamed);
    setEditingBroker(null);
    setError("");
    setNotice("Broker name updated.");
  }
  function updateImportRow(id: string, updates: Partial<StockImportDraft>) {
    setImportRows((rows) => rows.map((row) => row.id === id ? { ...row, ...updates } : row));
  }
  function addImportBroker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const newBroker = importBrokerDraft.trim();
    if (!newBroker || newBroker.length > 60) {
      setImportError("Enter a broker name up to 60 characters.");
      return;
    }
    const existing = brokers.find((entry) => entry.toLocaleLowerCase() === newBroker.toLocaleLowerCase());
    if (existing) {
      setImportBroker(existing);
      setImportRows((rows) => rows.map((row) => ({ ...row, broker: existing })));
    } else {
      onAddBroker(newBroker);
      setImportBroker(newBroker);
      setImportRows((rows) => rows.map((row) => ({ ...row, broker: newBroker })));
    }
    setImportBrokerDraft("");
    setAddingImportBroker(false);
    setImportError("");
  }
  async function recognizeStockScreenshot(file: File) {
    setError("");
    setNotice("");
    setImportError("");
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file to import stock details.");
      return;
    }
    if (file.size > MAX_DOCUMENT_FILE_BYTES) {
      setError("Choose an image no larger than 10 MB.");
      return;
    }
    setImportBusy(true);
    setImportProgress(0);
    setImportFileName(file.name);
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file);
      const scale = Math.min(3.5, 3000 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Image processing is unavailable in this browser.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      bitmap = undefined;

      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < pixels.data.length; index += 4) {
        const gray = 0.299 * pixels.data[index] + 0.587 * pixels.data[index + 1] + 0.114 * pixels.data[index + 2];
        const contrast = Math.max(0, Math.min(255, (255 - gray - 128) * 1.8 + 128));
        pixels.data[index] = contrast;
        pixels.data[index + 1] = contrast;
        pixels.data[index + 2] = contrast;
      }
      context.putImageData(pixels, 0, 0);

      const { createWorker, PSM } = await import("tesseract.js");
      const worker = await createWorker("eng", undefined, {
        logger: (message) => {
          if (message.status === "recognizing text") setImportProgress(Math.round(message.progress * 100));
        },
      });
      let text: string;
      let tsv: string;
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
          user_defined_dpi: "300",
          preserve_interword_spaces: "1",
        });
        const { data } = await worker.recognize(canvas, {}, { text: true, tsv: true });
        text = data.text;
        tsv = data.tsv ?? "";
      } finally {
        await worker.terminate();
      }
      const parsedRows = parseStockImportTsv(tsv, canvas.width);
      if (!parsedRows.length) parsedRows.push(...parseStockImportText(text));
      if (importBroker) parsedRows.forEach((row) => { row.broker = importBroker; });
      setImportText(text);
      setImportRows(parsedRows);
      setImportOpen(true);
      if (!parsedRows.length) setImportError("No reliable stock rows were recognized. Try a higher-resolution screenshot focused on the holdings table, or add rows manually.");
    } catch (caught) {
      setError(`Could not read the image. ${caught instanceof Error ? caught.message : "Try a clearer screenshot."}`);
    } finally {
      bitmap?.close();
      setImportBusy(false);
      setImportProgress(0);
    }
  }
  function commitImportedStocks() {
    const errors: string[] = [];
    const imported: Omit<TrackedStock, "id">[] = [];
    const seen = new Set(stocks.map(stockIdentityKey));
    for (const [index, row] of importRows.entries()) {
      const symbol = row.symbol.trim().toUpperCase();
      const exchange = row.exchange;
      const label = `Row ${index + 1}`;
      if (!/^[A-Z0-9][A-Z0-9.&_-]{0,29}$/.test(symbol) || STOCK_IMPORT_LABELS.has(symbol) || !row.name.trim()) {
        errors.push(`${label}: enter a valid stock code and name.`);
        continue;
      }
      const stockKey = stockIdentityKey({ exchange, symbol, broker: row.broker });
      if (seen.has(stockKey)) {
        errors.push(`${label}: ${symbol} on ${exchange} is already tracked or duplicated in this import for this broker.`);
        continue;
      }
      if (row.broker && !brokers.includes(row.broker)) {
        errors.push(`${label}: choose a broker from the list.`);
        continue;
      }
      const averageBuyPrice = row.averageBuyPrice.trim() ? Number(row.averageBuyPrice) : null;
      const quantity = row.quantity.trim() ? Number(row.quantity) : 0;
      if ((averageBuyPrice !== null && (!Number.isFinite(averageBuyPrice) || averageBuyPrice <= 0)) ||
        !Number.isInteger(quantity) || quantity < 0 ||
        ((averageBuyPrice !== null) !== (quantity > 0))) {
        errors.push(`${label}: enter both a positive average price and whole-number quantity, or leave both empty.`);
        continue;
      }
      seen.add(stockKey);
      imported.push({ symbol, name: row.name.trim(), exchange, broker: row.broker, averageBuyPrice, quantity });
    }
    if (errors.length || !imported.length) {
      setImportError(errors.length ? errors.join(" ") : "Add at least one stock row before importing.");
      return;
    }
    imported.forEach((stock) => onSaveStock(stock));
    setImportOpen(false);
    setImportRows([]);
    setImportText("");
    setImportError("");
    setNotice(`Imported ${imported.length} ${imported.length === 1 ? "stock" : "stocks"}.`);
  }
  async function fetchStockQuote(stock: TrackedStock): Promise<Omit<StockQuoteSnapshot, "id" | "stockId">> {
    const params = new URLSearchParams({ symbol: stock.symbol, exchange: stock.exchange });
    const response = await fetch(`/api/stock-price?${params.toString()}`);
    const payload: unknown = await response.json();
    const providerError = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "The quote response was invalid.";
    if (!response.ok || typeof payload !== "object" || payload === null ||
      !("price" in payload) || typeof payload.price !== "number" || !Number.isFinite(payload.price) ||
      !("currency" in payload) || typeof payload.currency !== "string" ||
      !("timestamp" in payload) || typeof payload.timestamp !== "string" || Number.isNaN(Date.parse(payload.timestamp)) ||
      !("marketState" in payload) || typeof payload.marketState !== "string" ||
      !("previousClose" in payload) || (payload.previousClose !== null &&
        (typeof payload.previousClose !== "number" || !Number.isFinite(payload.previousClose)))) {
      throw new Error(providerError);
    }
    return {
      price: payload.price,
      currency: payload.currency,
      timestamp: payload.timestamp,
      marketState: payload.marketState,
      previousClose: payload.previousClose,
    };
  }
  async function refreshStocks(selectedStocks: TrackedStock[] = stocks) {
    if (!selectedStocks.length) { setError("Add at least one stock before refreshing prices."); return; }
    setBusy(true); setError(""); setNotice(""); setRefreshErrors([]);
    let updated = 0;
    const failures: string[] = [];
    for (const stock of selectedStocks) {
      try {
        onSaveQuote({ stockId: stock.id, ...await fetchStockQuote(stock) });
        updated++;
      } catch (caught) {
        failures.push(`${stock.symbol} (${stock.exchange}): ${caught instanceof Error ? caught.message : "Could not load quote."}`);
        setManualQuoteDraft((current) => current ?? { stockId: stock.id, price: "" });
      }
    }
    setBusy(false);
    setRefreshErrors(failures);
    setNotice(updated ? `Saved ${updated} new price ${updated === 1 ? "snapshot" : "snapshots"}.` : "");
    if (!updated && failures.length === 0) setError("No quotes were returned.");
  }
  async function refreshStock(stock: TrackedStock) {
    await refreshStocks([stock]);
  }
  function saveManualQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manualQuoteDraft) return;
    const stock = stocks.find((entry) => entry.id === manualQuoteDraft.stockId);
    const price = Number(manualQuoteDraft.price);
    if (!stock || !Number.isFinite(price) || price <= 0) {
      setManualQuoteError("Enter a valid price greater than zero.");
      return;
    }
    onSaveQuote({
      stockId: stock.id,
      price,
      currency: "INR",
      timestamp: new Date().toISOString(),
      marketState: "MANUAL",
      previousClose: null,
    });
    setManualQuoteDraft(null);
    setManualQuoteError("");
    setNotice(`Saved your manual price for ${stock.symbol}.`);
    setRefreshErrors((failures) => failures.filter((failure) => !failure.startsWith(`${stock.symbol} (${stock.exchange}):`)));
  }
  function formatQuote(price: number, currency: string) {
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(price); }
    catch { return `${currency} ${price.toFixed(2)}`; }
  }
  const filteredStocks = stocks.filter((stock) => {
    const latest = latestQuotes.get(stock.id);
    const search = stockSearch.trim().toLocaleLowerCase();
    return (!search || [stock.symbol, stock.name, stock.exchange, stock.broker].some((value) => value.toLocaleLowerCase().includes(search))) &&
      (stockBrokerFilter === "all" || (stockBrokerFilter === "unassigned" ? !stock.broker : stock.broker === stockBrokerFilter)) &&
      (stockExchangeFilter === "all" || stock.exchange === stockExchangeFilter) &&
      (stockHoldingFilter === "all" || (stockHoldingFilter === "holdings" ? (stock.quantity ?? 0) > 0 : (stock.quantity ?? 0) === 0)) &&
      (stockQuoteFilter === "all" || (stockQuoteFilter === "priced" ? Boolean(latest) : !latest));
  }).sort((a, b) => {
    const aQuote = latestQuotes.get(a.id);
    const bQuote = latestQuotes.get(b.id);
    const aValue = aQuote && a.quantity ? aQuote.price * a.quantity : null;
    const bValue = bQuote && b.quantity ? bQuote.price * b.quantity : null;
    const aProfitLoss = aValue !== null && a.averageBuyPrice ? aValue - a.averageBuyPrice * (a.quantity ?? 0) : null;
    const bProfitLoss = bValue !== null && b.averageBuyPrice ? bValue - b.averageBuyPrice * (b.quantity ?? 0) : null;
    const numericValues: Partial<Record<typeof stockSortBy, [number | null, number | null]>> = {
      price: [aQuote?.price ?? null, bQuote?.price ?? null],
      quantity: [a.quantity ?? 0, b.quantity ?? 0],
      value: [aValue, bValue],
      profitLoss: [aProfitLoss, bProfitLoss],
    };
    const pair = numericValues[stockSortBy];
    if (pair) {
      if (pair[0] === null) return pair[1] === null ? a.symbol.localeCompare(b.symbol) : 1;
      if (pair[1] === null) return -1;
      const difference = pair[0] - pair[1];
      return difference === 0 ? a.symbol.localeCompare(b.symbol) : difference * (stockSortOrder === "asc" ? 1 : -1);
    }
    const aText = stockSortBy === "name" ? a.name : stockSortBy === "broker" ? a.broker || "No broker" : a.symbol;
    const bText = stockSortBy === "name" ? b.name : stockSortBy === "broker" ? b.broker || "No broker" : b.symbol;
    const comparison = aText.localeCompare(bText, undefined, { sensitivity: "base" });
    return (comparison || a.symbol.localeCompare(b.symbol)) * (stockSortOrder === "asc" ? 1 : -1);
  });
  const stockGroups = (() => {
    const groups = new Map<string, { key: string; label: string; stocks: TrackedStock[] }>();
    for (const stock of filteredStocks) {
      const label = stockGroupBy === "broker" ? stock.broker || "No broker"
        : stockGroupBy === "exchange" ? stock.exchange : "";
      const key = stockGroupBy === "none" ? "all-stocks" : `${stockGroupBy}:${label}`;
      const group = groups.get(key) ?? { key, label: stockGroupBy === "none" ? "All stocks" : label, stocks: [] };
      group.stocks.push(stock);
      groups.set(key, group);
    }
    return stockGroupBy === "none" ? [...groups.values()] : [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
  })();
  const activeStockFilters = stockSearch.trim() || stockBrokerFilter !== "all" || stockExchangeFilter !== "all" ||
    stockHoldingFilter !== "all" || stockQuoteFilter !== "all";

  return <><PageHeading eyebrow="Market watch" title="Stocks" subtitle="Track NSE and BSE codes, organize them by broker, and save refreshed price snapshots." action={<div className="stock-heading-actions"><input ref={importInputRef} className="sr-only" type="file" accept="image/*" aria-label="Choose stock screenshot" onChange={(event) => { const file = event.target.files?.[0]; if (file) void recognizeStockScreenshot(file); event.currentTarget.value = ""; }} /><Button variant="outline" onClick={() => importInputRef.current?.click()} disabled={importBusy}>{importBusy ? <LoaderCircle size={14} className="spin" /> : <ImagePlus size={14} />}{importBusy ? `Reading ${importProgress}%` : "Import screenshot"}</Button><Button onClick={() => refreshStocks()} disabled={busy || stocks.length === 0}><RefreshCw size={14} className={busy ? "spin" : ""} />{busy ? "Refreshing..." : "Refresh prices"}</Button></div>} />
    <div className="alert stock-source-note"><TrendingUp size={15} /><span>Quotes are requested from Yahoo Finance through the app’s server endpoint. This free public source is unofficial and may delay, limit, or temporarily fail to provide prices. Initial prices copied from the supplied portfolio screenshot are marked “SCREENSHOT SEED”; refresh to request current quotes. All snapshots are saved only in this browser.</span></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    {refreshErrors.length > 0 && <div className="alert alert-error stock-errors" role="alert"><div><strong>Some prices could not be refreshed:</strong><ul>{refreshErrors.map((failure) => <li key={failure}>{failure}</li>)}</ul></div></div>}
    {portfolioPositions.length > 0 && <Card className="portfolio-summary"><div className="portfolio-total"><span>Invested value</span><strong>{formatQuote(portfolioTotals.invested, "INR")}</strong></div><div className="portfolio-total"><span>Current value</span><strong>{formatQuote(portfolioTotals.currentValue, "INR")}</strong></div><div className={`portfolio-total ${portfolioTotals.profitLoss >= 0 ? "positive" : "negative"}`}><span>Unrealized P/L</span><strong>{portfolioTotals.profitLoss >= 0 ? "+" : ""}{formatQuote(portfolioTotals.profitLoss, "INR")}</strong><small>{portfolioTotals.invested ? `${portfolioTotals.profitLoss >= 0 ? "+" : ""}${(portfolioTotals.profitLoss / portfolioTotals.invested * 100).toFixed(2)}%` : ""}</small></div><div className="portfolio-coverage">{portfolioPositions.length} of {stocks.length} positions with average price, quantity, and an INR quote</div></Card>}
    <div className="stock-admin-grid">
      <Card><div className="card-head"><div><h2 className="section-title">Broker names</h2><p className="section-description">Labels for grouping your saved stocks only; no broker account is connected.</p></div></div>
        <form className="broker-form" onSubmit={submitBroker}><Field label="Add a broker"><Input maxLength={60} placeholder="e.g. Zerodha" value={brokerName} onChange={(event) => setBrokerName(event.target.value)} /></Field><Button type="submit"><Plus size={14} />Add broker</Button></form>
        <div className="stock-broker-list">{brokers.length ? brokers.map((entry) => <div className="master-entry" key={entry}>
          {editingBroker?.original === entry
            ? <form className="stock-broker-edit" onSubmit={submitBrokerRename}>
              <Input aria-label={`Broker name for ${entry}`} autoFocus required maxLength={80} value={editingBroker.value} onChange={(event) => setEditingBroker({ ...editingBroker, value: event.target.value })} />
              <button className="icon-button" type="submit" aria-label={`Save broker name ${editingBroker.value}`} title="Save"><Check size={14} /></button>
              <button className="icon-button" type="button" aria-label="Cancel broker name edit" title="Cancel" onClick={() => { setEditingBroker(null); setError(""); }}><X size={14} /></button>
            </form>
            : <><div className="recent-info"><div className="recent-name">{entry}</div><div className="recent-meta">{stocks.filter((stock) => stock.broker === entry).length} tracked stocks</div></div><button className="icon-button" aria-label={`Rename ${entry}`} onClick={() => { setEditingBroker({ original: entry, value: entry }); setError(""); setNotice(""); }}><Pencil size={14} /></button><button className="icon-button" aria-label={`Archive ${entry}`} onClick={() => { if (window.confirm(`Move "${entry}" to the archive? Its tracked stocks will remain and become unassigned.`)) onDeleteBroker(entry); }}><Archive size={14} /></button></>}
        </div>) : <p className="section-description">Add broker names to organize your watchlist.</p>}</div>
      </Card>
      <Card><div className="card-head"><div><h2 className="section-title">{editingId ? "Edit tracked stock" : "Add a stock"}</h2><p className="section-description">Use the exchange-listed code (without .NS or .BO).</p></div></div>
      <form className="form-grid stock-form" onSubmit={submitStock}><Field label="Stock code"><Input maxLength={30} placeholder="e.g. RELIANCE" value={symbol} onChange={(event) => { setSymbol(event.target.value); setError(""); }} /></Field><Field label="Exchange"><Select value={exchange} onChange={(event) => setExchange(event.target.value as StockExchange)}><option value="NSE">NSE</option><option value="BSE">BSE</option></Select></Field><Field className="full" label="Display name"><Input maxLength={100} placeholder="e.g. Reliance Industries" value={name} onChange={(event) => setName(event.target.value)} /></Field><Field className="full" label="Broker label (optional)"><Select value={broker} onChange={(event) => setBroker(event.target.value)}><option value="">No broker</option>{brokers.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</Select></Field><Field label="Average buy price per share (INR)"><Input type="number" min="0.01" step="0.01" placeholder="Optional" value={averageBuyPrice} onChange={(event) => setAverageBuyPrice(event.target.value)} /></Field><Field label="Shares owned"><Input type="number" min="0" step="1" placeholder="Optional" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></Field><div className="full stock-form-actions"><Button type="submit"><Plus size={14} />{editingId ? "Save stock" : "Add stock"}</Button>{editingId && <Button type="button" variant="outline" onClick={resetStockForm}>Cancel</Button>}</div></form>
      </Card>
    </div>
    <Card className="stock-table-card"><div className="card-head"><div><h2 className="section-title">Tracked stocks</h2><p className="section-description">Showing {filteredStocks.length} of {stocks.length} {stocks.length === 1 ? "stock" : "stocks"} · Refresh all to add timestamped prices</p></div><Button variant="outline" onClick={() => refreshStocks()} disabled={busy || stocks.length === 0}><RefreshCw size={14} className={busy ? "spin" : ""} />Refresh all</Button></div>
      <div className="stock-view-controls">
        <label className="stock-search-control"><Search size={14} /><Input aria-label="Search stocks" placeholder="Search code, name, or broker" value={stockSearch} onChange={(event) => setStockSearch(event.target.value)} /></label>
        <Field label="Exchange"><Select value={stockExchangeFilter} onChange={(event) => setStockExchangeFilter(event.target.value)}><option value="all">All exchanges</option><option value="NSE">NSE</option><option value="BSE">BSE</option></Select></Field>
        <Field label="Broker"><Select value={stockBrokerFilter} onChange={(event) => setStockBrokerFilter(event.target.value)}><option value="all">All brokers</option><option value="unassigned">No broker</option>{brokers.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</Select></Field>
        <Field label="Position"><Select value={stockHoldingFilter} onChange={(event) => setStockHoldingFilter(event.target.value)}><option value="all">All stocks</option><option value="holdings">Holdings</option><option value="watchlist">Watchlist only</option></Select></Field>
        <Field label="Quote"><Select value={stockQuoteFilter} onChange={(event) => setStockQuoteFilter(event.target.value)}><option value="all">Any price status</option><option value="priced">Has a price</option><option value="unpriced">No price yet</option></Select></Field>
        <Field label="Sort by"><Select value={stockSortBy} onChange={(event) => setStockSortBy(event.target.value as typeof stockSortBy)}><option value="symbol">Stock code</option><option value="name">Name</option><option value="broker">Broker</option><option value="price">Latest price</option><option value="quantity">Shares owned</option><option value="value">Holding value</option><option value="profitLoss">Profit / loss</option></Select></Field>
        <Field label="Order"><Select value={stockSortOrder} onChange={(event) => setStockSortOrder(event.target.value as typeof stockSortOrder)}><option value="asc">Ascending</option><option value="desc">Descending</option></Select></Field>
        <Field label="Group by"><Select value={stockGroupBy} onChange={(event) => { setStockGroupBy(event.target.value as typeof stockGroupBy); setCollapsedStockGroups(new Set()); }}><option value="none">No grouping</option><option value="broker">Broker</option><option value="exchange">Exchange</option></Select></Field>
        {activeStockFilters && <Button className="stock-clear-filters" type="button" variant="outline" size="sm" onClick={() => { setStockSearch(""); setStockBrokerFilter("all"); setStockExchangeFilter("all"); setStockHoldingFilter("all"); setStockQuoteFilter("all"); }}>Clear filters</Button>}
      </div>
      {stocks.length ? filteredStocks.length ? <div className="stock-list">{stockGroups.map((group) => {
        const collapsed = collapsedStockGroups.has(group.key);
        return <div className={`stock-group ${stockGroupBy === "none" ? "stock-group-ungrouped" : ""}`} key={group.key}>
          {stockGroupBy !== "none" && <button className="stock-group-heading" type="button" aria-expanded={!collapsed} onClick={() => setCollapsedStockGroups((current) => {
            const next = new Set(current);
            if (next.has(group.key)) next.delete(group.key); else next.add(group.key);
            return next;
          })}><ChevronRight size={15} className={`stock-group-chevron ${collapsed ? "" : "expanded"}`} /><strong>{group.label}</strong><span>{group.stocks.length} {group.stocks.length === 1 ? "stock" : "stocks"}</span></button>}
          {!collapsed && <div className={`stock-group-children ${stockGroupBy !== "none" ? "stock-group-tree" : ""}`}>{group.stocks.map((stock) => {
        const latest = latestQuotes.get(stock.id);
        const history = sortedHistory(stock.id);
        return <div className="stock-row" key={stock.id}>
          <div className="stock-summary">
            <div className="stock-identity"><span className="stock-code">{stock.symbol}</span><span className="stock-exchange">{stock.exchange}</span><span className="stock-name">{stock.name}</span></div>
            <div className="stock-current">
              <strong>{latest ? formatQuote(latest.price, latest.currency) : "—"}</strong>
              <small>{latest ? `${new Date(latest.timestamp).toLocaleString()} · ${marketStateLabel(latest.marketState)}` : "No price yet — refresh"}</small>
              {manualQuoteDraft?.stockId === stock.id
                ? <form className="stock-manual-quote" onSubmit={saveManualQuote}>
                  <Field label={`Latest price for ${stock.symbol} (INR)`}><Input autoFocus required type="number" min="0.01" step="0.01" value={manualQuoteDraft.price} onChange={(event) => { setManualQuoteDraft({ ...manualQuoteDraft, price: event.target.value }); setManualQuoteError(""); }} /></Field>
                  {manualQuoteError && <span className="stock-manual-quote-error" role="alert">{manualQuoteError}</span>}
                  <div className="stock-manual-quote-actions"><Button type="submit" size="sm"><Check size={13} />Save price</Button><Button type="button" size="sm" variant="outline" onClick={() => { setManualQuoteDraft(null); setManualQuoteError(""); }}>Cancel</Button></div>
                </form>
                : <button className="stock-manual-quote-trigger" type="button" onClick={() => { setManualQuoteDraft({ stockId: stock.id, price: "" }); setManualQuoteError(""); }}><Pencil size={11} />Enter price</button>}
            </div>
            <div className="stock-position">
              <span>{stock.averageBuyPrice && stock.quantity ? `${formatQuote(stock.averageBuyPrice, "INR")} avg · ${stock.quantity} shares` : "Add avg price & shares"}</span>
              {latest && stock.averageBuyPrice && stock.quantity ? latest.currency === "INR" ? <>
                <strong className={(latest.price - stock.averageBuyPrice) * stock.quantity >= 0 ? "positive" : "negative"}>{formatQuote(latest.price * stock.quantity, "INR")} value</strong>
                <small className={(latest.price - stock.averageBuyPrice) * stock.quantity >= 0 ? "positive" : "negative"}>{(latest.price - stock.averageBuyPrice) * stock.quantity >= 0 ? "+" : ""}{formatQuote((latest.price - stock.averageBuyPrice) * stock.quantity, "INR")} ({((latest.price - stock.averageBuyPrice) / stock.averageBuyPrice * 100).toFixed(2)}%)</small>
              </> : <small>P/L needs an INR quote</small> : null}
            </div>
            <div className="stock-broker">{stock.broker || "No broker"}</div>
            <div className="table-actions">
              <button className="icon-button" aria-label={`Refresh ${stock.symbol}`} disabled={busy} onClick={() => refreshStock(stock)}><RefreshCw size={14} /></button>
              <button className="icon-button" aria-label={`Edit ${stock.symbol}`} onClick={() => editStock(stock)}><Pencil size={14} /></button>
              <button className="icon-button" aria-label={`Copy ${stock.symbol} as a new stock`} onClick={() => copyStock(stock)}><Copy size={14} /></button>
              <button className="icon-button" aria-label={`Archive ${stock.symbol}`} onClick={() => { if (window.confirm(`Move ${stock.symbol} and its saved price history to the archive?`)) onDeleteStock(stock.id); }}><Archive size={14} /></button>
            </div>
          </div>
          <details className="stock-history">
            <summary>Price history ({history.length} snapshots)</summary>
            {history.length ? history.map((quote) => <div className="stock-history-row" key={quote.id}><span>{new Date(quote.timestamp).toLocaleString()}</span><strong>{formatQuote(quote.price, quote.currency)}</strong><span>{marketStateLabel(quote.marketState)}</span>{quote.previousClose !== null && <small>Previous close {formatQuote(quote.previousClose, quote.currency)}</small>}</div>) : <p className="section-description">Refresh this stock to save its first price snapshot.</p>}
          </details>
        </div>;
      })}</div>}
        </div>;
      })}</div> : <EmptyState icon={<Filter size={18} />} title="No stocks match these filters" description="Try changing your search or filters to see more stocks." /> : <EmptyState icon={<TrendingUp size={18} />} title="No stocks tracked yet" description="Add an NSE or BSE code above, then refresh it to save its current price." />}
    </Card>
    {importOpen && <Modal title="Review stock screenshot" onClose={() => { if (!importBusy) { setImportOpen(false); setImportError(""); } }} wide>
      <p className="section-description stock-import-intro">OCR reads the ticker, quantity, and average price from their table columns. It runs in this browser; check and correct the results before saving. Choose one broker for all rows, or override it per stock. Current quotes can be fetched after import. {importFileName && <strong>{importFileName}</strong>}</p>
      <Field className="full" label="Recognized text (editable)"><textarea className="field textarea" rows={4} value={importText} onChange={(event) => setImportText(event.target.value)} /></Field>
      <div className="stock-import-tools"><Button type="button" variant="outline" onClick={() => { const rows = parseStockImportText(importText); setImportRows(rows.map((row) => ({ ...row, broker: importBroker }))); setImportError(""); }}>Parse text again</Button><Button type="button" variant="outline" onClick={() => { setImportRows((rows) => [...rows, { id: createId(), symbol: "", name: "", exchange: "NSE", broker: importBroker, averageBuyPrice: "", quantity: "" }]); setImportError(""); }}><Plus size={14} />Add row</Button></div>
      <div className="stock-import-bulk-broker">
        <Field label="Broker for all imported stocks"><Select value={importBroker} onChange={(event) => { const selectedBroker = event.target.value; setImportBroker(selectedBroker); setImportRows((rows) => rows.map((row) => ({ ...row, broker: selectedBroker }))); }}><option value="">No broker</option>{brokers.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</Select></Field>
        <span className="section-description">Applies to every row. You can still change individual rows below.</span>
        {addingImportBroker
          ? <form className="stock-import-broker-add" onSubmit={addImportBroker}><Input autoFocus maxLength={60} aria-label="New broker name" placeholder="New broker name" value={importBrokerDraft} onChange={(event) => setImportBrokerDraft(event.target.value)} /><Button type="submit"><Plus size={14} />Add and apply</Button><Button type="button" variant="outline" onClick={() => { setAddingImportBroker(false); setImportBrokerDraft(""); }}>Cancel</Button></form>
          : <Button type="button" variant="outline" onClick={() => setAddingImportBroker(true)}><Plus size={14} />Add a broker</Button>}
      </div>
      {importBusy && <div className="alert"><LoaderCircle size={14} className="spin" />Reading screenshot… {importProgress}%</div>}
      {importRows.length > 0 && <div className="stock-import-list">{importRows.map((row, index) => <div className="stock-import-row" key={row.id}>
        <div className="stock-import-row-head"><strong>Stock {index + 1}</strong><button className="icon-button" type="button" aria-label={`Remove stock row ${index + 1}`} onClick={() => setImportRows((rows) => rows.filter((entry) => entry.id !== row.id))}><X size={14} /></button></div>
        <Field label="Stock code"><Input maxLength={30} value={row.symbol} onChange={(event) => updateImportRow(row.id, { symbol: event.target.value })} /></Field>
        <Field label="Display name"><Input maxLength={100} value={row.name} onChange={(event) => updateImportRow(row.id, { name: event.target.value })} /></Field>
        <Field label="Exchange"><Select value={row.exchange} onChange={(event) => updateImportRow(row.id, { exchange: event.target.value as StockExchange })}><option value="NSE">NSE</option><option value="BSE">BSE</option></Select></Field>
        <Field label="Broker"><Select value={row.broker} onChange={(event) => updateImportRow(row.id, { broker: event.target.value })}><option value="">No broker</option>{brokers.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</Select></Field>
        <Field label="Average buy price (INR)"><Input type="number" min="0.01" step="0.01" value={row.averageBuyPrice} onChange={(event) => updateImportRow(row.id, { averageBuyPrice: event.target.value })} /></Field>
        <Field label="Shares owned"><Input type="number" min="0" step="1" value={row.quantity} onChange={(event) => updateImportRow(row.id, { quantity: event.target.value })} /></Field>
      </div>)}</div>}
      {importError && <div className="alert alert-error stock-import-error" role="alert">{importError}</div>}
      <div className="modal-actions"><Button type="button" variant="outline" onClick={() => { setImportOpen(false); setImportError(""); }}>Cancel</Button><Button type="button" onClick={commitImportedStocks} disabled={importBusy || !importRows.length}>Import {importRows.length} {importRows.length === 1 ? "stock" : "stocks"}</Button></div>
    </Modal>}
  </>;
}

const emptyAsset = (): Omit<AssetRecord, "id"> => ({
  name: "",
  type: "Other",
  institution: "",
  reference: "",
  link: "",
  currency: "INR",
  investedValue: null,
  currentValue: null,
  quantity: null,
  interestRate: null,
  startDate: "",
  maturityDate: "",
  location: "",
  notes: "",
  tags: [],
});

function AssetModal({ initial, onClose, onSave }: {
  initial: AssetRecord | null;
  onClose: () => void;
  onSave: (asset: Omit<AssetRecord, "id">) => void;
}) {
  const [asset, setAsset] = useState<Omit<AssetRecord, "id">>(initial
    ? { ...initial, tags: [...initial.tags] }
    : emptyAsset());
  const [tagsText, setTagsText] = useState(initial?.tags.join(", ") ?? "");
  const [investedValue, setInvestedValue] = useState(initial?.investedValue == null ? "" : String(initial.investedValue));
  const [currentValue, setCurrentValue] = useState(initial?.currentValue == null ? "" : String(initial.currentValue));
  const [quantity, setQuantity] = useState(initial?.quantity == null ? "" : String(initial.quantity));
  const [interestRate, setInterestRate] = useState(initial?.interestRate == null ? "" : String(initial.interestRate));
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!asset.name.trim()) {
      setError("Enter an asset name.");
      return;
    }
    if (asset.link) {
      try {
        if (new URL(asset.link).protocol !== "https:") throw new Error();
      } catch {
        setError("Enter a valid HTTPS link, or leave it blank.");
        return;
      }
    }
    const parsedInvested = parseOptionalNumber(investedValue);
    const parsedCurrent = parseOptionalNumber(currentValue);
    const parsedQuantity = parseOptionalNumber(quantity);
    const parsedInterest = parseOptionalNumber(interestRate);
    if ([investedValue, currentValue, quantity, interestRate].some((value) => value.trim() !== "") &&
      [parsedInvested, parsedCurrent, parsedQuantity, parsedInterest].some((value, index) =>
        [investedValue, currentValue, quantity, interestRate][index].trim() !== "" && value === null)) {
      setError("Enter valid numeric values, or leave optional fields blank.");
      return;
    }
    if (parsedInvested !== null && parsedInvested < 0 || parsedCurrent !== null && parsedCurrent < 0 ||
      parsedQuantity !== null && parsedQuantity < 0 || parsedInterest !== null && (parsedInterest < 0 || parsedInterest > 100)) {
      setError("Amounts and quantities must be non-negative; the interest rate must be between 0 and 100.");
      return;
    }
    onSave({
      ...asset,
      name: asset.name.trim(),
      investedValue: parsedInvested,
      currentValue: parsedCurrent,
      quantity: parsedQuantity,
      interestRate: parsedInterest,
      institution: asset.institution.trim(),
      reference: asset.reference.trim(),
      link: asset.link.trim(),
      location: asset.location.trim(),
      notes: asset.notes.trim(),
      tags: [...new Set(tagsText.split(",").map((tag) => tag.trim()).filter(Boolean))],
    });
  }

  function parseOptionalNumber(value: string): number | null {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function numericInput(label: string, value: string, onChange: (value: string) => void, options: { max?: number; step?: string; placeholder?: string } = {}) {
    return <Field label={label}><Input type="number" min="0" max={options.max} step={options.step ?? "0.01"} placeholder={options.placeholder ?? "Optional"} value={value} onChange={(event) => onChange(event.target.value)} /></Field>;
  }

  const isLoan = asset.type === "Loan";
  return <Modal title={initial ? "Edit asset" : "Add asset"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field className="full" label="Asset name (required)"><Input autoFocus required maxLength={120} placeholder="e.g. Retirement fund, home loan, family home" value={asset.name} onChange={(event) => setAsset((current) => ({ ...current, name: event.target.value }))} /></Field>
      <Field label="Asset type (required)"><Select required value={asset.type} onChange={(event) => setAsset((current) => ({ ...current, type: event.target.value as AssetType }))}>{ASSET_TYPES.map((type) => <option key={type}>{type}</option>)}</Select></Field>
      <Field label="Currency"><Select value={asset.currency} onChange={(event) => setAsset((current) => ({ ...current, currency: event.target.value as Currency }))}>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</Select></Field>
      <Field label="Institution / provider"><Input maxLength={120} placeholder="Optional" value={asset.institution} onChange={(event) => setAsset((current) => ({ ...current, institution: event.target.value }))} /></Field>
      <Field label="Account / reference"><Input maxLength={120} placeholder="Optional (avoid sensitive numbers)" value={asset.reference} onChange={(event) => setAsset((current) => ({ ...current, reference: event.target.value }))} /></Field>
      {numericInput(isLoan ? "Original loan amount" : "Invested / purchase amount", investedValue, setInvestedValue)}
      {numericInput(isLoan ? "Outstanding balance" : "Current value", currentValue, setCurrentValue)}
      {numericInput("Units / quantity", quantity, setQuantity, { step: "any" })}
      {numericInput("Interest / coupon rate (%)", interestRate, setInterestRate, { max: 100, step: "0.01" })}
      <Field label={isLoan ? "Start / disbursal date" : "Purchase / start date"}><DateInput value={asset.startDate} onValueChange={(startDate) => setAsset((current) => ({ ...current, startDate }))} /></Field>
      <Field label="Maturity / renewal date"><DateInput value={asset.maturityDate} onValueChange={(maturityDate) => setAsset((current) => ({ ...current, maturityDate }))} /></Field>
      <Field className="full" label="Property location / asset description"><Input maxLength={250} placeholder="Optional" value={asset.location} onChange={(event) => setAsset((current) => ({ ...current, location: event.target.value }))} /></Field>
      <Field className="full" label="Account / document link"><ExternalLinkInput maxLength={2000} placeholder="Optional HTTPS link" value={asset.link} onChange={(event) => setAsset((current) => ({ ...current, link: event.target.value }))} /></Field>
      <Field className="full" label="Tags (comma-separated)"><Input maxLength={500} placeholder="long-term, family, investment" value={tagsText} onChange={(event) => setTagsText(event.target.value)} /></Field>
      <Field className="full" label="Notes"><textarea className="field textarea" rows={3} maxLength={3000} placeholder="Optional details, terms, or reminders" value={asset.notes} onChange={(event) => setAsset((current) => ({ ...current, notes: event.target.value }))} /></Field>
    </div>
    <p className="section-description" style={{ marginTop: 12 }}>Only name and type are required. Leave unknown values blank; the asset manager does not fetch or verify valuations.</p>
    {error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
    <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add asset"}</Button></div></form>
  </Modal>;
}

function AssetManager({ assets, onSave, onDelete }: {
  assets: AssetRecord[];
  onSave: (asset: Omit<AssetRecord, "id">, id?: string) => void;
  onDelete: (asset: AssetRecord) => void;
}) {
  const [editor, setEditor] = useState<AssetRecord | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");
  const query = search.trim().toLocaleLowerCase();
  const visible = assets.filter((asset) =>
    (typeFilter === "All types" || asset.type === typeFilter) &&
    [asset.name, asset.type, asset.institution, asset.reference, asset.location, asset.notes, ...asset.tags]
      .some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const totals = new Map<Currency, { assets: number; liabilities: number }>();
  for (const asset of assets) {
    if (asset.currentValue === null) continue;
    const total = totals.get(asset.currency) ?? { assets: 0, liabilities: 0 };
    if (asset.type === "Loan") total.liabilities += asset.currentValue;
    else total.assets += asset.currentValue;
    totals.set(asset.currency, total);
  }

  function formatAmount(amount: number, currency: Currency) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  }

  function removeAsset(asset: AssetRecord) {
    if (window.confirm(`Move "${asset.name}" to the archive?`)) onDelete(asset);
  }

  return <>
    <PageHeading eyebrow="Your financial overview" title="Asset manager" subtitle="Organize investments, property, deposits, and loans in one place." action={<Button onClick={() => setEditor(null)}><Plus size={15} /> Add asset</Button>} />
    <div className="alert"><Wallet size={15} style={{ flex: "none", marginTop: 1 }} /><span>Track mutual funds, stocks, loans, real estate, bonds, digital gold, cash/deposits, and other assets. Only asset name and type are required; values and other details are optional and manually entered. Loans are counted as liabilities. Stock entries here are summaries—avoid duplicating amounts already represented in the detailed Stocks portfolio. These details are readable in the private GitHub repository and persist in its history; do not enter full account numbers or other secrets.</span></div>
    {totals.size > 0 && <div className="asset-total-list">{[...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, total]) => <Card className="asset-total-card" key={currency}><div><span>Assets · {currency}</span><strong>{formatAmount(total.assets, currency)}</strong></div><div><span>Loans · {currency}</span><strong>{formatAmount(total.liabilities, currency)}</strong></div><div><span>Net · {currency}</span><strong>{formatAmount(total.assets - total.liabilities, currency)}</strong></div></Card>)}</div>}
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search assets" placeholder="Search name, provider, reference, tags..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select aria-label="Filter asset type" style={{ width: 175 }} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All types</option>{ASSET_TYPES.map((type) => <option key={type}>{type}</option>)}</Select><Badge>{visible.length} {visible.length === 1 ? "record" : "records"}</Badge></div>
    <div className="asset-list">{visible.map((asset) => {
      const isLoan = asset.type === "Loan";
      const performance = asset.investedValue !== null && asset.currentValue !== null
        ? asset.currentValue - asset.investedValue
        : null;
      return <Card className="asset-card" key={asset.id}>
        <div className="asset-card-head"><div className="asset-card-title"><div className="asset-icon"><Wallet size={17} /></div><div><h2>{asset.name}</h2><p>{asset.type}{asset.institution ? ` · ${asset.institution}` : ""}</p></div></div><div className="table-actions"><button className="icon-button" aria-label={`Edit ${asset.name}`} onClick={() => setEditor(asset)}><Pencil size={14} /></button><button className="icon-button" aria-label={`Copy ${asset.name}`} onClick={() => { const { id, ...copy } = asset; void id; onSave({ ...copy, name: `${asset.name} (copy)` }); }}><Copy size={14} /></button><button className="icon-button" aria-label={`Archive ${asset.name}`} onClick={() => removeAsset(asset)}><Archive size={14} /></button></div></div>
        <div className="asset-details">
          {asset.investedValue !== null && <div><span>{isLoan ? "Original amount" : "Invested / purchase amount"}</span><strong>{formatAmount(asset.investedValue, asset.currency)}</strong></div>}
          {asset.currentValue !== null && <div><span>{isLoan ? "Outstanding balance" : "Current value"}</span><strong>{formatAmount(asset.currentValue, asset.currency)}</strong></div>}
          {asset.quantity !== null && <div><span>Units / quantity</span><strong>{asset.quantity.toLocaleString()}</strong></div>}
          {asset.interestRate !== null && <div><span>Interest / coupon</span><strong>{asset.interestRate}%</strong></div>}
          {asset.reference && <div><span>Account / reference</span><strong>{asset.reference}</strong></div>}
          {asset.startDate && <div><span>{isLoan ? "Start date" : "Purchase / start date"}</span><strong>{dateLabel(asset.startDate)}</strong></div>}
          {asset.maturityDate && <div><span>Maturity / renewal</span><strong>{dateLabel(asset.maturityDate)}</strong></div>}
          {performance !== null && !isLoan && <div><span>Change since invested</span><strong className={performance >= 0 ? "positive" : "negative"}>{performance >= 0 ? "+" : ""}{formatAmount(performance, asset.currency)}</strong></div>}
          {asset.location && <div><span>Location / description</span><strong>{asset.location}</strong></div>}
        </div>
        {asset.link && <a className="personal-document-link" href={asset.link} target="_blank" rel="noopener noreferrer">Open account / document link</a>}
        {asset.tags.length > 0 && <div className="credential-tags">{asset.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>}
        {asset.notes && <p className="personal-record-notes"><LinkifiedText>{asset.notes}</LinkifiedText></p>}
      </Card>;
    })}</div>
    {!visible.length && <Card><EmptyState icon={<Wallet size={18} />} title={assets.length ? "No matching assets" : "No assets recorded yet"} description={assets.length ? "Try a different search or type." : "Add an asset with its name and type; all other details can be added later."} /></Card>}
    {editor !== undefined && <AssetModal key={editor?.id ?? "new-asset"} initial={editor} onClose={() => setEditor(undefined)} onSave={(asset) => { onSave(asset, editor?.id); setEditor(undefined); }} />}
  </>;
}

function educationTotalDue(record: Pick<EducationRecord, "annualFee" | "admissionFee" | "schoolVanFee" | "otherFee">) {
  const amounts = [record.annualFee, record.admissionFee ?? null, record.schoolVanFee ?? null, record.otherFee ?? null]
    .filter((amount): amount is number => amount !== null);
  return amounts.length ? amounts.reduce((total, amount) => total + amount, 0) : null;
}

function educationTotalPaid(record: Pick<EducationRecord, "paidFee" | "payments">) {
  return (record.paidFee ?? 0) + (record.payments ?? []).reduce((total, payment) => total + payment.amount, 0);
}

function inferPaymentFeeType(period: string): EducationFeeType {
  const normalized = period.toLocaleLowerCase();
  if (/\badmission\b|\bapplication\b|\benrollment\b/.test(normalized)) return "Admission";
  if (/\bvan\b|\bbus\b|\btransport\b/.test(normalized)) return "School van / transport";
  if (/\bother\b|\bmisc(?:ellaneous)?\b/.test(normalized)) return "Other";
  return "Tuition";
}

const emptyEducationRecord = (): Omit<EducationRecord, "id"> => ({
  studentName: "",
  institution: "",
  level: "Primary (Grades 1–5)",
  gradeCourse: "",
  academicYear: "",
  status: "Current",
  boardUniversity: "",
  startDate: "",
  endDate: "",
  annualFee: null,
  admissionFee: null,
  schoolVanFee: null,
  otherFee: null,
  paidFee: null,
  currency: "INR",
  contactName: "",
  contact: "",
  link: "",
  notes: "",
});

function EducationRecordModal({ initial, copyMode = false, onClose, onSave }: {
  initial: EducationRecord | null;
  copyMode?: boolean;
  onClose: () => void;
  onSave: (record: Omit<EducationRecord, "id">) => void;
}) {
  const [record, setRecord] = useState<Omit<EducationRecord, "id">>(initial ?? emptyEducationRecord());
  const [annualFee, setAnnualFee] = useState(initial?.annualFee == null ? "" : String(initial.annualFee));
  const [admissionFee, setAdmissionFee] = useState(initial?.admissionFee == null ? "" : String(initial.admissionFee));
  const [schoolVanFee, setSchoolVanFee] = useState(initial?.schoolVanFee == null ? "" : String(initial.schoolVanFee));
  const [otherFee, setOtherFee] = useState(initial?.otherFee == null ? "" : String(initial.otherFee));
  const [paidFee, setPaidFee] = useState(initial?.paidFee == null ? "" : String(initial.paidFee));
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record.studentName.trim() || !record.institution.trim()) {
      setError("Enter the student's name and school or college name.");
      return;
    }
    if (record.link) {
      try {
        if (new URL(record.link).protocol !== "https:") throw new Error();
      } catch {
        setError("Enter a valid HTTPS link, or leave it blank.");
        return;
      }
    }
    const parseFee = (value: string): number | null => {
      if (!value.trim()) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    };
    const parsedAnnualFee = parseFee(annualFee);
    const parsedAdmissionFee = parseFee(admissionFee);
    const parsedSchoolVanFee = parseFee(schoolVanFee);
    const parsedOtherFee = parseFee(otherFee);
    const parsedPaidFee = parseFee(paidFee);
    const feeInputs = [annualFee, admissionFee, schoolVanFee, otherFee, paidFee];
    const parsedFeeInputs = [parsedAnnualFee, parsedAdmissionFee, parsedSchoolVanFee, parsedOtherFee, parsedPaidFee];
    if (feeInputs.some((value, index) => value.trim() !== "" && parsedFeeInputs[index] === null)) {
      setError("Fees must be valid non-negative amounts, or left blank.");
      return;
    }
    const proposedTotalDue = [parsedAnnualFee, parsedAdmissionFee, parsedSchoolVanFee, parsedOtherFee]
      .filter((amount): amount is number => amount !== null)
      .reduce((total, amount) => total + amount, 0);
    const hasFeeAmounts = [annualFee, admissionFee, schoolVanFee, otherFee].some((value) => value.trim() !== "");
    const proposedPaid = (parsedPaidFee ?? 0) +
      (initial?.payments ?? []).reduce((total, payment) => total + payment.amount, 0);
    const previousDue = initial ? educationTotalDue(initial) : null;
    const feeTotalChanged = previousDue !== (hasFeeAmounts ? proposedTotalDue : null);
    const legacyPaidChanged = parsedPaidFee !== (initial?.paidFee ?? null);
    if ((!initial || feeTotalChanged || legacyPaidChanged) &&
      (hasFeeAmounts ? proposedPaid > proposedTotalDue + 0.005 : proposedPaid > 0)) {
      setError(`Total fees must cover the ${new Intl.NumberFormat(undefined, { style: "currency", currency: record.currency }).format(proposedPaid)} already recorded as paid.`);
      return;
    }
    if (record.startDate && record.endDate && record.endDate < record.startDate) {
      setError("The end date cannot be before the start date.");
      return;
    }
    onSave({
      ...record,
      studentName: record.studentName.trim(),
      institution: record.institution.trim(),
      gradeCourse: record.gradeCourse.trim(),
      academicYear: record.academicYear.trim(),
      boardUniversity: record.boardUniversity.trim(),
      annualFee: parsedAnnualFee,
      admissionFee: parsedAdmissionFee,
      schoolVanFee: parsedSchoolVanFee,
      otherFee: parsedOtherFee,
      paidFee: parsedPaidFee,
      contactName: record.contactName.trim(),
      contact: record.contact.trim(),
      link: record.link.trim(),
      notes: record.notes.trim(),
    });
  }

  return <Modal title={copyMode ? "Copy education record" : initial ? "Edit education record" : "Add education record"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field label="Student name (required)"><Input autoFocus required maxLength={120} value={record.studentName} onChange={(event) => setRecord((current) => ({ ...current, studentName: event.target.value }))} /></Field>
      <Field label="School / college (required)"><Input required maxLength={160} placeholder="Institution name" value={record.institution} onChange={(event) => setRecord((current) => ({ ...current, institution: event.target.value }))} /></Field>
      <Field label="Education level"><Select value={record.level} onChange={(event) => setRecord((current) => ({ ...current, level: event.target.value as EducationLevel }))}>{EDUCATION_LEVELS.map((level) => <option key={level}>{level}</option>)}</Select></Field>
      <Field label="Status"><Select value={record.status} onChange={(event) => setRecord((current) => ({ ...current, status: event.target.value as EducationStatus }))}><option>Current</option><option>Completed</option><option>On hold</option></Select></Field>
      <Field label="Grade / class / course"><Input maxLength={120} placeholder="e.g. Grade 3, Class 10, B.Sc. Computer Science" value={record.gradeCourse} onChange={(event) => setRecord((current) => ({ ...current, gradeCourse: event.target.value }))} /></Field>
      <Field label="Academic year"><Input maxLength={40} placeholder="e.g. 2026–2027" value={record.academicYear} onChange={(event) => setRecord((current) => ({ ...current, academicYear: event.target.value }))} /></Field>
      <Field label="Board / university"><Input maxLength={120} placeholder="Optional" value={record.boardUniversity} onChange={(event) => setRecord((current) => ({ ...current, boardUniversity: event.target.value }))} /></Field>
      <Field label="Currency"><Select value={record.currency} onChange={(event) => setRecord((current) => ({ ...current, currency: event.target.value as Currency }))}>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</Select></Field>
      <Field label="Start date"><DateInput value={record.startDate} onValueChange={(startDate) => setRecord((current) => ({ ...current, startDate }))} /></Field>
      <Field label="End / completion date"><DateInput value={record.endDate} onValueChange={(endDate) => setRecord((current) => ({ ...current, endDate }))} /></Field>
      <Field label="Annual tuition"><Input type="number" min="0" step="0.01" placeholder="Optional; tuition only" value={annualFee} onChange={(event) => setAnnualFee(event.target.value)} /></Field>
      <Field label="Admission fee"><Input type="number" min="0" step="0.01" placeholder="Optional one-time charge" value={admissionFee} onChange={(event) => setAdmissionFee(event.target.value)} /></Field>
      <Field label="School van / transport fee (year total)"><Input type="number" min="0" step="0.01" placeholder="Optional" value={schoolVanFee} onChange={(event) => setSchoolVanFee(event.target.value)} /></Field>
      <Field label="Other fees"><Input type="number" min="0" step="0.01" placeholder="Optional" value={otherFee} onChange={(event) => setOtherFee(event.target.value)} /></Field>
      <Field label="Previously paid fee (legacy)"><Input type="number" min="0" step="0.01" placeholder="Optional; avoid duplicate entries" value={paidFee} onChange={(event) => setPaidFee(event.target.value)} /></Field>
      <Field label="School contact name"><Input maxLength={120} placeholder="Optional" value={record.contactName} onChange={(event) => setRecord((current) => ({ ...current, contactName: event.target.value }))} /></Field>
      <Field label="Contact details"><Input maxLength={160} placeholder="Optional phone or email" value={record.contact} onChange={(event) => setRecord((current) => ({ ...current, contact: event.target.value }))} /></Field>
      <Field className="full" label="Portal / document link"><ExternalLinkInput maxLength={2000} placeholder="Optional HTTPS link" value={record.link} onChange={(event) => setRecord((current) => ({ ...current, link: event.target.value }))} /></Field>
      <Field className="full" label="Notes"><textarea className="field textarea" rows={3} maxLength={3000} placeholder="Optional academic notes, achievements, or reminders" value={record.notes} onChange={(event) => setRecord((current) => ({ ...current, notes: event.target.value }))} /></Field>
    </div>
    <p className="section-description" style={{ marginTop: 12 }}>Enter tuition, admission, school van / transport, and other charges separately. For older records whose tuition amount included admission or transport, adjust it to tuition-only before adding separate charges. Payments are checked against combined fees. Only student name and school/college are required.</p>
    {error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
    <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{copyMode ? "Save as new record" : initial ? "Save changes" : "Add record"}</Button></div></form>
  </Modal>;
}

function EducationSubjectModal({ initial, onClose, onSave }: {
  initial: EducationSubject | null;
  onClose: () => void;
  onSave: (subject: Omit<EducationSubject, "id">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [credits, setCredits] = useState(initial?.credits == null ? "" : String(initial.credits));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedCredits = credits.trim() ? Number(credits) : null;
    if (!name.trim()) { setError("Enter a subject or course name."); return; }
    if (credits.trim() && (parsedCredits === null || !Number.isFinite(parsedCredits) || parsedCredits < 0)) {
      setError("Credits must be a non-negative number, or left blank."); return;
    }
    onSave({ name: name.trim(), code: code.trim(), credits: parsedCredits, notes: notes.trim() });
  }

  return <Modal title={initial ? "Edit subject / course" : "Add subject / course"} onClose={onClose}><form onSubmit={submit}><div className="form-grid">
    <Field className="full" label="Subject / course (required)"><Input autoFocus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></Field>
    <Field label="Code"><Input maxLength={40} placeholder="Optional" value={code} onChange={(event) => setCode(event.target.value)} /></Field>
    <Field label="Credits (college)"><Input type="number" min="0" step="any" placeholder="Optional" value={credits} onChange={(event) => setCredits(event.target.value)} /></Field>
    <Field className="full" label="Notes"><Input maxLength={500} placeholder="Optional" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
  </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save subject" : "Add subject"}</Button></div></form></Modal>;
}

function EducationExamModal({ initial, subjects, onClose, onSave }: {
  initial: EducationExam | null;
  subjects: EducationSubject[];
  onClose: () => void;
  onSave: (exam: Omit<EducationExam, "id">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [assessmentType, setAssessmentType] = useState(initial?.assessmentType ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [marksObtained, setMarksObtained] = useState(initial?.marksObtained == null ? "" : String(initial.marksObtained));
  const [maximumMarks, setMaximumMarks] = useState(initial?.maximumMarks == null ? "" : String(initial.maximumMarks));
  const [grade, setGrade] = useState(initial?.grade ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const marks = marksObtained.trim() ? Number(marksObtained) : null;
    const maximum = maximumMarks.trim() ? Number(maximumMarks) : null;
    if (!name.trim() || !assessmentType.trim()) {
      setError("Enter an assessment name and type."); return;
    }
    if ((marksObtained.trim() && (marks === null || !Number.isFinite(marks) || marks < 0)) ||
      (maximumMarks.trim() && (maximum === null || !Number.isFinite(maximum) || maximum <= 0)) ||
      ((marks === null) !== (maximum === null)) || (marks !== null && maximum !== null && marks > maximum)) {
      setError("Enter both valid marks and a maximum score (marks cannot exceed the maximum), or leave both blank and enter a grade."); return;
    }
    if (marks === null && !grade.trim()) {
      setError("Enter marks with a maximum score, or provide a grade / GPA."); return;
    }
    onSave({ name: name.trim(), assessmentType: assessmentType.trim(), subject: subject.trim(), date, marksObtained: marks, maximumMarks: maximum, grade: grade.trim(), notes: notes.trim() });
  }

  return <Modal title={initial ? "Edit exam / assessment" : "Add exam / assessment"} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid">
    <Field label="Exam / assessment name"><Input autoFocus required maxLength={120} placeholder="e.g. Mathematics Midterm" value={name} onChange={(event) => setName(event.target.value)} /></Field>
    <Field label="Assessment type"><Input required maxLength={80} list="education-assessment-types" placeholder="e.g. Term exam, semester, lab" value={assessmentType} onChange={(event) => setAssessmentType(event.target.value)} /><datalist id="education-assessment-types">{["Unit test", "Assignment", "Quiz", "Practical", "Laboratory", "Midterm", "Term exam", "Semester exam", "Final exam", "Viva", "Project", "Other"].map((type) => <option key={type} value={type} />)}</datalist></Field>
    <Field label="Subject / course"><Input maxLength={120} list="education-subjects" placeholder="Optional" value={subject} onChange={(event) => setSubject(event.target.value)} /><datalist id="education-subjects">{subjects.map((entry) => <option key={entry.id} value={entry.name} />)}</datalist></Field>
    <Field label="Exam date"><DateInput value={date} onValueChange={setDate} /></Field>
    <Field label="Marks obtained"><Input type="number" min="0" step="any" placeholder="Optional" value={marksObtained} onChange={(event) => setMarksObtained(event.target.value)} /></Field>
    <Field label="Maximum marks"><Input type="number" min="0.01" step="any" placeholder="Optional" value={maximumMarks} onChange={(event) => setMaximumMarks(event.target.value)} /></Field>
    <Field label="Grade / GPA"><Input maxLength={40} placeholder="Optional (e.g. A, 3.8 GPA, Pass)" value={grade} onChange={(event) => setGrade(event.target.value)} /></Field>
    <Field className="full" label="Notes"><Input maxLength={1000} placeholder="Optional feedback or result notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
  </div><p className="section-description" style={{ marginTop: 12 }}>Record numeric marks with a maximum, or use grade/GPA for college grading systems.</p>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save result" : "Add result"}</Button></div></form></Modal>;
}

function EducationPaymentModal({ initial, currency, maxAmount, onClose, onSave }: {
  initial: EducationPayment | null;
  currency: Currency;
  maxAmount: number | null;
  onClose: () => void;
  onSave: (payment: Omit<EducationPayment, "id">) => void;
}) {
  const [feeType, setFeeType] = useState<EducationFeeType>(initial?.feeType ?? inferPaymentFeeType(initial?.period ?? ""));
  const [period, setPeriod] = useState(initial?.period ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial?.date ?? today());
  const [method, setMethod] = useState(initial?.method ?? "Bank transfer");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const paid = Number(amount);
    if (!period.trim() || !date || !Number.isFinite(paid) || paid <= 0) {
      setError("Enter a term/period, payment date, and amount greater than zero."); return;
    }
    if (maxAmount === null && paid > (initial?.amount ?? 0) + 0.005) {
      setError("Enter the tuition, admission, van / transport, or other fee charges on the education record before recording this payment.");
      return;
    }
    if (maxAmount !== null && paid > maxAmount + 0.005 && paid > (initial?.amount ?? 0) + 0.005) {
      setError(`This payment would exceed the remaining total fees of ${new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Math.max(0, maxAmount))}.`);
      return;
    }
    onSave({ feeType, period: period.trim(), amount: paid, date, method, reference: reference.trim(), notes: notes.trim() });
  }

  return <Modal title={initial ? "Edit fee payment" : "Record fee payment"} onClose={onClose}><form onSubmit={submit}><div className="form-grid">
    <Field label="Fee type"><Select value={feeType} onChange={(event) => setFeeType(event.target.value as EducationFeeType)}>{EDUCATION_FEE_TYPES.map((type) => <option key={type}>{type}</option>)}</Select></Field>
    <Field className="full" label="Term / installment (required)"><Input autoFocus required maxLength={100} placeholder="e.g. Term 1, Semester 2, Admission fee" value={period} onChange={(event) => setPeriod(event.target.value)} /></Field>
    <Field label={`Amount paid (${currency})`}><Input required type="number" min="0.01" max={maxAmount === null ? undefined : Math.max(maxAmount, initial?.amount ?? 0)} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
    <Field label="Payment date"><DateInput required value={date} onValueChange={setDate} /></Field>
    <Field label="Payment method"><Select value={method} onChange={(event) => setMethod(event.target.value)}><option>Bank transfer</option><option>UPI</option><option>Card</option><option>Cash</option><option>Cheque</option><option>Online portal</option><option>Other</option></Select></Field>
    <Field label="Receipt / reference"><Input maxLength={120} placeholder="Optional" value={reference} onChange={(event) => setReference(event.target.value)} /></Field>
    <Field className="full" label="Notes"><Input maxLength={500} placeholder="Optional payment notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
  </div>{maxAmount === null ? <div className="alert" style={{ marginTop: 12 }} role="status">Add the tuition, admission, school van / transport, or other fee charges to this education record before recording a payment.</div> : <div className={`alert${maxAmount <= 0 && !initial ? " alert-error" : ""}`} style={{ marginTop: 12 }} role="status">{maxAmount <= 0 && !initial ? "No balance is available. Review the fee charges and existing payments before adding another payment." : `Remaining fees available for payment: ${new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Math.max(0, maxAmount))}. Admission and van payments count toward the same total due.`}</div>}{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!initial && (maxAmount === null || maxAmount <= 0)} title={!initial && (maxAmount === null || maxAmount <= 0) ? "Set fee charges and a positive remaining balance first" : undefined}>{initial ? "Save payment" : "Add payment"}</Button></div></form></Modal>;
}

function EducationRecordCard({ record, onEdit, onCopy, onDelete, onUpdate }: {
  record: EducationRecord;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onUpdate: (record: EducationRecord) => void;
}) {
  const [editor, setEditor] = useState<
    | { kind: "subject"; initial: EducationSubject | null }
    | { kind: "exam"; initial: EducationExam | null }
    | { kind: "payment"; initial: EducationPayment | null }
    | null
  >(null);
  const [expanded, setExpanded] = useState(false);
  const subjects = record.subjects ?? [];
  const exams = record.exams ?? [];
  const payments = record.payments ?? [];
  const loggedPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalPaid = educationTotalPaid(record);
  const totalDue = educationTotalDue(record);
  const balance = totalDue === null ? null : Math.max(0, totalDue - totalPaid);
  const remainingOwing = totalDue === null ? null : totalDue - totalPaid;

  function formatAmount(amount: number) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: record.currency, maximumFractionDigits: 2 }).format(amount);
  }

  function removeSubject(subject: EducationSubject) {
    if (window.confirm(`Move ${subject.name} to the archive?`)) {
      onUpdate({ ...record, subjects: subjects.filter((entry) => entry.id !== subject.id) });
    }
  }

  function removeExam(exam: EducationExam) {
    if (window.confirm(`Move the ${exam.name} result to the archive?`)) {
      onUpdate({ ...record, exams: exams.filter((entry) => entry.id !== exam.id) });
    }
  }

  function removePayment(payment: EducationPayment) {
    if (window.confirm(`Move the ${payment.period} payment of ${formatAmount(payment.amount)} to the archive?`)) {
      onUpdate({ ...record, payments: payments.filter((entry) => entry.id !== payment.id) });
    }
  }

  return <Card className={`education-card${expanded ? " expanded" : ""}`}>
    <div className="education-card-head">
      <div className="education-card-title"><div className="education-icon"><GraduationCap size={17} /></div><div><h2>{record.studentName}</h2><p>{[record.institution, record.gradeCourse, record.academicYear, record.level].filter(Boolean).join(" · ")}</p></div></div>
      <div className="education-card-actions">
        <button className="education-toggle" aria-expanded={expanded} aria-controls={`education-details-${record.id}`} onClick={() => setExpanded((value) => !value)}><ChevronRight size={14} /><span>{expanded ? "Hide" : "Show"}</span><span className="sr-only">details for {record.studentName} {record.academicYear}</span></button>
        <Badge tone={record.status === "Current" ? "green" : "neutral"}>{record.status}</Badge>
        <button className="icon-button" aria-label={`Edit ${record.studentName} education record`} onClick={onEdit}><Pencil size={14} /></button>
        <button className="icon-button" aria-label={`Copy ${record.studentName} education record without its subjects, assessments, or payments`} title="Copy as a new record without subjects, assessments, or payment history" onClick={onCopy}><Copy size={14} /></button>
        <button className="icon-button" aria-label={`Archive ${record.studentName} education record`} onClick={onDelete}><Archive size={14} /></button>
      </div>
    </div>
    <div className="education-expanded" id={`education-details-${record.id}`} hidden={!expanded}>
    <div className="education-details">
      <div><span>Education level</span><strong>{record.level}</strong></div>
      {record.boardUniversity && <div><span>Board / university</span><strong>{record.boardUniversity}</strong></div>}
      {record.startDate && <div><span>Start date</span><strong>{dateLabel(record.startDate)}</strong></div>}
      {record.endDate && <div><span>End / completion</span><strong>{dateLabel(record.endDate)}</strong></div>}
      {record.annualFee !== null && <div><span>Annual tuition</span><strong>{formatAmount(record.annualFee)}</strong></div>}
      {record.admissionFee != null && <div><span>Admission fee</span><strong>{formatAmount(record.admissionFee)}</strong></div>}
      {record.schoolVanFee != null && <div><span>School van / transport (year total)</span><strong>{formatAmount(record.schoolVanFee)}</strong></div>}
      {record.otherFee != null && <div><span>Other fees</span><strong>{formatAmount(record.otherFee)}</strong></div>}
      {totalDue !== null && <div><span>Total fees due</span><strong>{formatAmount(totalDue)}</strong></div>}
      {record.paidFee !== null && <div><span>Previously recorded paid fee</span><strong>{formatAmount(record.paidFee)}</strong></div>}
      {payments.length > 0 && <div><span>Logged payments (all fee types)</span><strong>{formatAmount(loggedPaid)}</strong></div>}
      {totalPaid > 0 && <div><span>Total paid (legacy + logged)</span><strong>{formatAmount(totalPaid)}</strong></div>}
      {(totalDue !== null || totalPaid > 0) && <div><span>{remainingOwing !== null && remainingOwing < 0 ? "Overpaid (total fees)" : "Remaining total fees"}</span><strong>{totalDue === null ? "Add fee amounts to calculate" : formatAmount(Math.abs(remainingOwing ?? balance ?? 0))}</strong></div>}
      {record.contactName && <div><span>School contact</span><strong>{record.contactName}</strong></div>}
      {record.contact && <div><span>Contact details</span><strong>{record.contact}</strong></div>}
    </div>
    <section className="education-section">
      <div className="education-section-head"><div><h3><BookOpen size={14} />Subjects / courses</h3><p>{subjects.length} recorded</p></div><Button size="sm" variant="outline" onClick={() => setEditor({ kind: "subject", initial: null })}><Plus size={12} />Add subject</Button></div>
      {subjects.length ? <div className="education-entry-list">{subjects.map((subject) => <div className="education-entry" key={subject.id}><div><strong>{subject.name}</strong><span><LinkifiedText>{[subject.code, subject.credits !== null ? `${subject.credits} credits` : "", subject.notes].filter(Boolean).join(" · ")}</LinkifiedText></span></div><div className="table-actions"><button className="icon-button" aria-label={`Edit ${subject.name}`} onClick={() => setEditor({ kind: "subject", initial: subject })}><Pencil size={13} /></button><button className="icon-button" aria-label={`Copy ${subject.name}`} onClick={() => onUpdate({ ...record, subjects: [{ ...subject, id: createId() }, ...subjects] })}><Copy size={13} /></button><button className="icon-button" aria-label={`Archive ${subject.name}`} onClick={() => removeSubject(subject)}><Archive size={13} /></button></div></div>)}</div> : <p className="education-empty">Add subjects for this class, term, or course.</p>}
    </section>
    <section className="education-section">
      <div className="education-section-head"><div><h3><ClipboardList size={14} />Exams & results</h3><p>{exams.length} recorded</p></div><Button size="sm" variant="outline" onClick={() => setEditor({ kind: "exam", initial: null })}><Plus size={12} />Add exam</Button></div>
      {exams.length ? <div className="education-entry-list">{[...exams].sort((a, b) => b.date.localeCompare(a.date)).map((exam) => <div className="education-entry" key={exam.id}><div><strong>{exam.name}</strong><span>{[exam.assessmentType, exam.subject, exam.date ? dateLabel(exam.date) : ""].filter(Boolean).join(" · ")}</span><small><LinkifiedText>{[exam.marksObtained !== null && exam.maximumMarks !== null ? `${exam.marksObtained} / ${exam.maximumMarks}${exam.maximumMarks ? ` (${(exam.marksObtained / exam.maximumMarks * 100).toFixed(1)}%)` : ""}` : "", exam.grade ? `Grade / GPA: ${exam.grade}` : "", exam.notes].filter(Boolean).join(" · ")}</LinkifiedText></small></div><div className="table-actions"><button className="icon-button" aria-label={`Edit ${exam.name}`} onClick={() => setEditor({ kind: "exam", initial: exam })}><Pencil size={13} /></button><button className="icon-button" aria-label={`Copy ${exam.name}`} onClick={() => onUpdate({ ...record, exams: [{ ...exam, id: createId() }, ...exams] })}><Copy size={13} /></button><button className="icon-button" aria-label={`Archive ${exam.name}`} onClick={() => removeExam(exam)}><Archive size={13} /></button></div></div>)}</div> : <p className="education-empty">Track school assessments or college exams, grades, GPA, and marks.</p>}
    </section>
    <section className="education-section">
      <div className="education-section-head"><div><h3><Wallet size={14} />Fee payments</h3><p>{payments.length} logged · {formatAmount(loggedPaid)} paid across all fee types</p></div><Button size="sm" variant="outline" onClick={() => setEditor({ kind: "payment", initial: null })}><Plus size={12} />Record payment</Button></div>
      {payments.length ? <div className="education-entry-list">{[...payments].sort((a, b) => b.date.localeCompare(a.date)).map((payment) => <div className="education-entry" key={payment.id}><div><strong>{payment.feeType ?? inferPaymentFeeType(payment.period)} · {payment.period} · {formatAmount(payment.amount)}</strong><span>{dateLabel(payment.date)} · {payment.method}{payment.reference ? ` · Ref: ${payment.reference}` : ""}</span>{payment.notes && <small><LinkifiedText>{payment.notes}</LinkifiedText></small>}</div><div className="table-actions"><button className="icon-button" aria-label={`Edit ${payment.period} payment`} onClick={() => setEditor({ kind: "payment", initial: payment })}><Pencil size={13} /></button><button className="icon-button" aria-label={`Copy ${payment.period} payment`} onClick={() => onUpdate({ ...record, payments: [{ ...payment, id: createId() }, ...payments] })}><Copy size={13} /></button><button className="icon-button" aria-label={`Archive ${payment.period} payment`} onClick={() => removePayment(payment)}><Archive size={13} /></button></div></div>)}</div> : <p className="education-empty">Record tuition installments, admission charges, school van fees, or other payments.</p>}
    </section>
    {record.link && <a className="personal-document-link" href={record.link} target="_blank" rel="noopener noreferrer">Open portal / document link</a>}
    {record.notes && <p className="personal-record-notes"><LinkifiedText>{record.notes}</LinkifiedText></p>}
    </div>
    {editor?.kind === "subject" && <EducationSubjectModal key={editor.initial?.id ?? "new-subject"} initial={editor.initial} onClose={() => setEditor(null)} onSave={(subject) => {
      const current = editor.initial;
      onUpdate({ ...record, subjects: current ? subjects.map((entry) => entry.id === current.id ? { ...subject, id: current.id } : entry) : [{ ...subject, id: createId() }, ...subjects] });
      setEditor(null);
    }} />}
    {editor?.kind === "exam" && <EducationExamModal key={editor.initial?.id ?? "new-exam"} initial={editor.initial} subjects={subjects} onClose={() => setEditor(null)} onSave={(exam) => {
      const current = editor.initial;
      onUpdate({ ...record, exams: current ? exams.map((entry) => entry.id === current.id ? { ...exam, id: current.id } : entry) : [{ ...exam, id: createId() }, ...exams] });
      setEditor(null);
    }} />}
    {editor?.kind === "payment" && <EducationPaymentModal key={editor.initial?.id ?? "new-payment"} initial={editor.initial} currency={record.currency} maxAmount={totalDue === null ? null : Math.max(0, totalDue - (totalPaid - (editor.initial?.amount ?? 0)))} onClose={() => setEditor(null)} onSave={(payment) => {
      const current = editor.initial;
      onUpdate({ ...record, payments: current ? payments.map((entry) => entry.id === current.id ? { ...payment, id: current.id } : entry) : [{ ...payment, id: createId() }, ...payments] });
      setEditor(null);
    }} />}
  </Card>;
}

function EducationRecordsPage({ records, onSave, onDelete }: {
  records: EducationRecord[];
  onSave: (record: Omit<EducationRecord, "id">, id?: string) => void;
  onDelete: (record: EducationRecord) => void;
}) {
  const [editor, setEditor] = useState<{
    record: EducationRecord | null;
    mode: "new" | "edit" | "copy";
  } | null>(null);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("All levels");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [selectedStudent, setSelectedStudent] = useState("All students");
  const [sortBy, setSortBy] = useState("student-year");
  const students = [...new Set(records.map((record) => record.studentName.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const query = search.trim().toLocaleLowerCase();
  function academicYearValue(value: string) {
    const year = value.match(/\b(?:19|20|21)\d{2}\b/);
    return year ? Number(year[0]) : null;
  }

  function compareAcademicYears(a: EducationRecord, b: EducationRecord, direction: "ascending" | "descending") {
    const yearA = academicYearValue(a.academicYear);
    const yearB = academicYearValue(b.academicYear);
    if (yearA === null && yearB !== null) return 1;
    if (yearA !== null && yearB === null) return -1;
    if (yearA !== null && yearB !== null && yearA !== yearB) {
      return direction === "descending" ? yearB - yearA : yearA - yearB;
    }
    return direction === "descending"
      ? b.academicYear.localeCompare(a.academicYear, undefined, { numeric: true })
      : a.academicYear.localeCompare(b.academicYear, undefined, { numeric: true });
  }

  function latestPaymentDate(record: EducationRecord) {
    return (record.payments ?? []).reduce((latest, payment) => payment.date > latest ? payment.date : latest, "");
  }

  function totalFeesPaid(record: EducationRecord) {
    return educationTotalPaid(record);
  }

  function compareEducationRecords(a: EducationRecord, b: EducationRecord) {
    let comparison = 0;
    if (sortBy === "academic-newest") comparison = compareAcademicYears(a, b, "descending");
    else if (sortBy === "academic-oldest") comparison = compareAcademicYears(a, b, "ascending");
    else if (sortBy === "payment-recent") comparison = latestPaymentDate(b).localeCompare(latestPaymentDate(a));
    else if (sortBy === "paid-highest") {
      comparison = a.currency.localeCompare(b.currency) || totalFeesPaid(b) - totalFeesPaid(a);
    }
    else if (sortBy === "balance-highest") {
      const dueA = educationTotalDue(a);
      const dueB = educationTotalDue(b);
      const balanceA = dueA === null ? null : Math.max(0, dueA - totalFeesPaid(a));
      const balanceB = dueB === null ? null : Math.max(0, dueB - totalFeesPaid(b));
      comparison = balanceA === null ? (balanceB === null ? 0 : 1)
        : balanceB === null ? -1
          : a.currency.localeCompare(b.currency) || balanceB - balanceA;
    } else if (sortBy === "institution") comparison = a.institution.localeCompare(b.institution);

    if (comparison) return comparison;
    if (sortBy === "student-year") {
      comparison = a.studentName.localeCompare(b.studentName) || compareAcademicYears(a, b, "descending");
    } else if (sortBy !== "academic-newest" && sortBy !== "academic-oldest") {
      comparison = a.studentName.localeCompare(b.studentName) || compareAcademicYears(a, b, "descending");
    }
    return comparison || a.institution.localeCompare(b.institution) || a.id.localeCompare(b.id);
  }

  const visible = records.filter((record) =>
    (selectedStudent === "All students" || record.studentName.trim() === selectedStudent) &&
    (levelFilter === "All levels" || record.level === levelFilter) &&
    (statusFilter === "All statuses" || record.status === statusFilter) &&
    [record.studentName, record.institution, record.level, record.gradeCourse,
      record.academicYear, record.boardUniversity, record.contactName, record.contact, record.notes,
      ...(record.subjects ?? []).flatMap((subject) => [subject.name, subject.code, subject.notes]),
      ...(record.exams ?? []).flatMap((exam) => [exam.name, exam.assessmentType, exam.subject, exam.grade, exam.notes]),
      ...(record.payments ?? []).flatMap((payment) => [payment.feeType ?? "", payment.period, payment.method, payment.reference, payment.notes])]
      .some((value) => value.toLocaleLowerCase().includes(query)))
    .sort(compareEducationRecords);

  function deleteRecord(record: EducationRecord) {
    if (window.confirm(`Move the ${record.academicYear || record.level} record for ${record.studentName} at ${record.institution} to the archive?`)) onDelete(record);
  }

  function updateRecord(record: EducationRecord) {
    const { id, ...updated } = record;
    onSave(updated, id);
  }

  function copyRecord(record: EducationRecord) {
    setEditor({
      mode: "copy",
      record: {
        ...record,
        id: createId(),
        paidFee: null,
        subjects: [],
        exams: [],
        payments: [],
      },
    });
  }

  return <>
    <PageHeading eyebrow="Growing and learning" title="Schools & Colleges" subtitle="Select a student to review their academic years, subjects, results, and term payments." action={<Button onClick={() => setEditor({ record: null, mode: "new" })}><Plus size={15} /> Add record</Button>} />
    <div className="alert"><GraduationCap size={15} style={{ flex: "none", marginTop: 1 }} /><span>Each record represents one academic year at a school, college, or university. Add flexible terms, quarters, semesters, or installments as separate payments; assessment types and grading systems can vary by institution. Records are readable in the private GitHub repository by collaborators and remain in its history; avoid storing student ID numbers or sensitive health information.</span></div>
    <div className="toolbar"><Select aria-label="Select student" style={{ width: 210 }} value={selectedStudent} onChange={(event) => setSelectedStudent(event.target.value)}><option>All students</option>{students.map((student) => <option key={student}>{student}</option>)}</Select><div className="search-wrap"><Search size={15} /><Input aria-label="Search education records" placeholder="Search student, subject, exam, payment..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select aria-label="Filter education level" style={{ width: 205 }} value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}><option>All levels</option>{EDUCATION_LEVELS.map((level) => <option key={level}>{level}</option>)}</Select><Select aria-label="Filter education status" style={{ width: 140 }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Current</option><option>Completed</option><option>On hold</option></Select><Select aria-label="Sort education records" style={{ width: 200 }} value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="student-year">Student, newest year</option><option value="academic-newest">Academic year (newest)</option><option value="academic-oldest">Academic year (oldest)</option><option value="payment-recent">Recent payment</option><option value="paid-highest">Fees paid (highest)</option><option value="balance-highest">Fee balance (highest)</option><option value="institution">Institution (A–Z)</option></Select><Badge>{visible.length} {visible.length === 1 ? "year" : "years"}</Badge></div>
    <div className="education-list">{visible.map((record) => <EducationRecordCard key={record.id} record={record} onEdit={() => setEditor({ record, mode: "edit" })} onCopy={() => copyRecord(record)} onDelete={() => deleteRecord(record)} onUpdate={updateRecord} />)}</div>
    {!visible.length && <Card><EmptyState icon={<GraduationCap size={18} />} title={records.length ? "No matching records" : "No education records yet"} description={records.length ? "Try another search or filter." : "Add a school or college record to start an education timeline."} /></Card>}
    {editor && <EducationRecordModal key={`${editor.mode}-${editor.record?.id ?? "new-education-record"}`} initial={editor.record} copyMode={editor.mode === "copy"} onClose={() => setEditor(null)} onSave={(record) => { onSave(record, editor.mode === "edit" ? editor.record?.id : undefined); setEditor(null); }} />}
  </>;
}

const emptyLearningRecord = (): Omit<LearningRecord, "id"> => ({
  title: "",
  topic: "",
  level: "Beginner",
  status: "Not started",
  provider: "",
  resourceLink: "",
  aiLink: "",
  startedDate: "",
  completedDate: "",
  notes: "",
});

function LearningRecordModal({ initial, onClose, onSave }: {
  initial: LearningRecord | null;
  onClose: () => void;
  onSave: (record: Omit<LearningRecord, "id">) => void;
}) {
  const [record, setRecord] = useState<Omit<LearningRecord, "id">>(initial ?? emptyLearningRecord());
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record.title.trim()) {
      setError("Enter a learning topic or skill.");
      return;
    }
    for (const [label, value] of [["Learning resource link", record.resourceLink], ["AI tool / resource link", record.aiLink]]) {
      if (!value) continue;
      try {
        if (new URL(value).protocol !== "https:") throw new Error();
      } catch {
        setError(`${label} must be a valid HTTPS link, or left blank.`);
        return;
      }
    }
    if (record.startedDate && record.completedDate && record.completedDate < record.startedDate) {
      setError("The completion date cannot be before the start date.");
      return;
    }
    onSave({
      ...record,
      title: record.title.trim(),
      topic: record.topic.trim(),
      provider: record.provider.trim(),
      resourceLink: record.resourceLink.trim(),
      aiLink: record.aiLink.trim(),
      notes: record.notes.trim(),
    });
  }

  return <Modal title={initial ? "Edit learning record" : "Add learning record"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field className="full" label="What are you learning? (required)"><Input autoFocus required maxLength={140} placeholder="e.g. .NET programming, finance, public speaking" value={record.title} onChange={(event) => setRecord((current) => ({ ...current, title: event.target.value }))} /></Field>
      <Field label="Topic / category"><Input maxLength={100} placeholder="e.g. Programming, Design" value={record.topic} onChange={(event) => setRecord((current) => ({ ...current, topic: event.target.value }))} /></Field>
      <Field label="Learning level"><Select value={record.level} onChange={(event) => setRecord((current) => ({ ...current, level: event.target.value as LearningLevel }))}><option>Beginner</option><option>Basic</option><option>Intermediate</option><option>Advanced</option><option>Expert</option></Select></Field>
      <Field label="Status"><Select value={record.status} onChange={(event) => setRecord((current) => ({ ...current, status: event.target.value as LearningStatus }))}><option>Not started</option><option>In progress</option><option>Completed</option></Select></Field>
      <Field label="Course / source"><Input maxLength={120} placeholder="e.g. provider, book, mentor" value={record.provider} onChange={(event) => setRecord((current) => ({ ...current, provider: event.target.value }))} /></Field>
      <Field label="Start date"><DateInput value={record.startedDate} onValueChange={(startedDate) => setRecord((current) => ({ ...current, startedDate }))} /></Field>
      <Field label="Completion date"><DateInput value={record.completedDate} onValueChange={(completedDate) => setRecord((current) => ({ ...current, completedDate }))} /></Field>
      <Field className="full" label="Course / learning resource link"><ExternalLinkInput maxLength={2000} placeholder="Optional HTTPS link" value={record.resourceLink} onChange={(event) => setRecord((current) => ({ ...current, resourceLink: event.target.value }))} /></Field>
      <Field className="full" label="AI tool / resource link"><ExternalLinkInput maxLength={2000} placeholder="Optional HTTPS link to an AI tutor, tool, or learning resource" value={record.aiLink} onChange={(event) => setRecord((current) => ({ ...current, aiLink: event.target.value }))} /></Field>
      <Field className="full" label="Notes / next steps"><textarea className="field textarea" rows={3} maxLength={3000} placeholder="Key ideas, practice tasks, or what to learn next" value={record.notes} onChange={(event) => setRecord((current) => ({ ...current, notes: event.target.value }))} /></Field>
    </div>
    {error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
    <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add learning record"}</Button></div></form>
  </Modal>;
}

function LearningPage({ records, onSave, onDelete }: {
  records: LearningRecord[];
  onSave: (record: Omit<LearningRecord, "id">, id?: string) => void;
  onDelete: (record: LearningRecord) => void;
}) {
  const [editor, setEditor] = useState<LearningRecord | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("All levels");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const query = search.trim().toLocaleLowerCase();
  const visible = records
    .filter((record) => (levelFilter === "All levels" || record.level === levelFilter) &&
      (statusFilter === "All statuses" || record.status === statusFilter) &&
      [record.title, record.topic, record.provider, record.notes].some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((a, b) => a.status.localeCompare(b.status) || a.title.localeCompare(b.title));

  function deleteRecord(record: LearningRecord) {
    if (window.confirm(`Move "${record.title}" to the archive?`)) onDelete(record);
  }

  return <>
    <PageHeading eyebrow="Keep growing" title="Learning" subtitle="Capture what you are learning, track your progress from beginner to advanced, and keep useful resources close." action={<Button onClick={() => setEditor(null)}><Plus size={15} /> Add learning</Button>} />
    <div className="alert"><BookOpen size={15} style={{ flex: "none", marginTop: 1 }} /><span>Save skills, courses, progress, notes, and learning links. AI resource links are optional; add a trusted AI tutor or tool that supports your learning.</span></div>
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search learning records" placeholder="Search title, topic, source, notes..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select aria-label="Filter learning level" style={{ width: 165 }} value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}><option>All levels</option>{(["Beginner", "Basic", "Intermediate", "Advanced", "Expert"] as const).map((level) => <option key={level}>{level}</option>)}</Select><Select aria-label="Filter learning status" style={{ width: 165 }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Not started</option><option>In progress</option><option>Completed</option></Select><Badge>{visible.length} {visible.length === 1 ? "topic" : "topics"}</Badge></div>
    <div className="learning-list">{visible.map((record) => <Card className="learning-card" key={record.id}>
      <div className="learning-card-head"><div className="learning-icon"><BookOpen size={17} /></div><div className="learning-card-title"><h2>{record.title}</h2><p>{[record.topic, record.provider].filter(Boolean).join(" · ") || "Personal learning"}</p></div><div className="learning-card-actions"><Badge tone={record.status === "Completed" ? "green" : "neutral"}>{record.status}</Badge><button className="icon-button" aria-label={`Edit ${record.title}`} onClick={() => setEditor(record)}><Pencil size={14} /></button><button className="icon-button" aria-label={`Copy ${record.title}`} onClick={() => { const { id, ...copy } = record; void id; onSave({ ...copy, title: `${record.title} (copy)` }); }}><Copy size={14} /></button><button className="icon-button" aria-label={`Archive ${record.title}`} onClick={() => deleteRecord(record)}><Archive size={14} /></button></div></div>
      <div className="learning-card-meta"><Badge>{record.level}</Badge>{record.startedDate && <span>Started {dateLabel(record.startedDate)}</span>}{record.completedDate && <span>Completed {dateLabel(record.completedDate)}</span>}</div>
      {(record.resourceLink || record.aiLink) && <div className="learning-links">{record.resourceLink && <a className="personal-document-link" href={record.resourceLink} target="_blank" rel="noopener noreferrer">Open learning resource</a>}{record.aiLink && <a className="personal-document-link" href={record.aiLink} target="_blank" rel="noopener noreferrer">Open AI resource</a>}</div>}
      {record.notes && <p className="learning-notes"><LinkifiedText>{record.notes}</LinkifiedText></p>}
    </Card>)}</div>
    {!visible.length && <Card><EmptyState icon={<BookOpen size={18} />} title={records.length ? "No matching learning records" : "No learning records yet"} description={records.length ? "Try another search or filter." : "Add a skill or course you are learning to start your progress log."} /></Card>}
    {editor !== undefined && <LearningRecordModal key={editor?.id ?? "new-learning-record"} initial={editor} onClose={() => setEditor(undefined)} onSave={(record) => { onSave(record, editor?.id); setEditor(undefined); }} />}
  </>;
}

function emptyPromptRecord(): Omit<PromptRecord, "id"> {
  return { title: "", description: "", prompt: "", tool: "", type: "", category: "" };
}

function PromptRecordModal({ initial, onClose, onSave }: {
  initial: PromptRecord | null;
  onClose: () => void;
  onSave: (record: Omit<PromptRecord, "id">) => void;
}) {
  const [record, setRecord] = useState<Omit<PromptRecord, "id">>(initial ?? emptyPromptRecord());
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record.title.trim() || !record.prompt.trim()) {
      setError("Enter a title and prompt text.");
      return;
    }
    onSave({
      ...record,
      title: record.title.trim(),
      description: record.description.trim(),
      prompt: record.prompt.trim(),
      tool: record.tool.trim(),
      category: record.category.trim(),
    });
  }

  return <Modal title={initial ? "Edit AI prompt" : "Add AI prompt"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field className="full" label="Title (required)"><Input autoFocus required maxLength={120} placeholder="e.g. Review a pull request" value={record.title} onChange={(event) => setRecord((current) => ({ ...current, title: event.target.value }))} /></Field>
      <Field className="full" label="Description / when to use it"><textarea className="field textarea" rows={2} maxLength={2000} placeholder="Describe the goal, context, intended audience, or when this prompt is useful." value={record.description} onChange={(event) => setRecord((current) => ({ ...current, description: event.target.value }))} /></Field>
      <Field label="AI tool / platform"><Input maxLength={120} placeholder="e.g. ChatGPT, Copilot, Claude" value={record.tool} onChange={(event) => setRecord((current) => ({ ...current, tool: event.target.value }))} /></Field>
      <Field label="Prompt type"><Select value={record.type} onChange={(event) => setRecord((current) => ({ ...current, type: event.target.value as PromptType | "" }))}><option value="">Not specified</option><option>System</option><option>Developer</option><option>User</option><option>Task</option><option>Other</option></Select></Field>
      <Field className="full" label="Category"><Input maxLength={80} placeholder="e.g. DevOps, Coding, Writing, Research" value={record.category} onChange={(event) => setRecord((current) => ({ ...current, category: event.target.value }))} /></Field>
      <Field className="full" label="Prompt text (required)"><textarea className="field textarea prompt-editor" rows={12} required maxLength={20000} placeholder="Write the reusable prompt here. You can include placeholders such as [project name] or [paste code here]." value={record.prompt} onChange={(event) => setRecord((current) => ({ ...current, prompt: event.target.value }))} /></Field>
    </div>
    {error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
    <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add prompt"}</Button></div></form>
  </Modal>;
}

function PromptManagerPage({ records, onSave, onDelete, onCopy }: {
  records: PromptRecord[];
  onSave: (record: Omit<PromptRecord, "id">, id?: string) => void;
  onDelete: (record: PromptRecord) => void;
  onCopy: (record: PromptRecord) => void;
}) {
  const [editor, setEditor] = useState<PromptRecord | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [typeFilter, setTypeFilter] = useState("All types");
  const categories = [...new Set(records.map((record) => record.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const query = search.trim().toLocaleLowerCase();
  const visible = records
    .filter((record) => categoryFilter === "All categories" || record.category === categoryFilter)
    .filter((record) => typeFilter === "All types" || record.type === typeFilter)
    .filter((record) => [record.title, record.description, record.prompt, record.tool, record.category, record.type]
      .some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((a, b) => a.title.localeCompare(b.title));

  function deleteRecord(record: PromptRecord) {
    if (window.confirm(`Move "${record.title}" to the archive?`)) onDelete(record);
  }

  return <>
    <PageHeading eyebrow="Reusable AI instructions" title="AI Prompts" subtitle="Keep frequently used prompts organized, searchable, and ready to copy into the AI tool you use." action={<Button onClick={() => setEditor(null)}><Plus size={15} /> Add prompt</Button>} />
    <div className="alert"><Sparkles size={15} style={{ flex: "none", marginTop: 1 }} /><span>Prompts are saved with your shared Daybook data. Copy places only the prompt text on your clipboard; customize placeholders before running it.</span></div>
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search AI prompts" placeholder="Search title, prompt, description, tool..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select aria-label="Filter prompt category" style={{ width: 165 }} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</Select><Select aria-label="Filter prompt type" style={{ width: 150 }} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All types</option><option>System</option><option>Developer</option><option>User</option><option>Task</option><option>Other</option></Select><Badge>{visible.length} {visible.length === 1 ? "prompt" : "prompts"}</Badge></div>
    <div className="prompt-list">{visible.map((record) => <Card className="prompt-card" key={record.id}>
      <div className="prompt-card-head"><div className="prompt-card-title"><div className="prompt-icon"><Sparkles size={17} /></div><div><h2>{record.title}</h2><p>{[record.category, record.tool].filter(Boolean).join(" · ") || "Reusable prompt"}</p></div></div><div className="prompt-card-actions"><Button size="sm" variant="outline" onClick={() => onCopy(record)}><Copy size={13} />Copy prompt</Button><button className="icon-button" aria-label={`Edit ${record.title}`} onClick={() => setEditor(record)}><Pencil size={14} /></button><button className="icon-button" aria-label={`Duplicate ${record.title}`} onClick={() => onSave({ ...record, title: `${record.title.slice(0, 113)} (copy)` })}><Copy size={14} /></button><button className="icon-button" aria-label={`Archive ${record.title}`} onClick={() => deleteRecord(record)}><Archive size={14} /></button></div></div>
      {(record.type || record.tool || record.category) && <div className="prompt-meta">{record.type && <Badge>{record.type}</Badge>}{record.category && <Badge tone="neutral">{record.category}</Badge>}{record.tool && <span>For {record.tool}</span>}</div>}
      {record.description && <p className="prompt-description">{record.description}</p>}
      <pre className="prompt-body">{record.prompt}</pre>
    </Card>)}</div>
    {!visible.length && <Card><EmptyState icon={<Sparkles size={18} />} title={records.length ? "No matching prompts" : "No saved prompts yet"} description={records.length ? "Try another search or filter." : "Add a reusable prompt and copy it whenever you need it."} /></Card>}
    {editor !== undefined && <PromptRecordModal key={editor?.id ?? "new-ai-prompt"} initial={editor} onClose={() => setEditor(undefined)} onSave={(record) => { onSave(record, editor?.id); setEditor(undefined); }} />}
  </>;
}

function emptyMindfulHabit(): Omit<MindfulHabit, "id"> {
  return { title: "", description: "" };
}

function MindfulHabitModal({ initial, onClose, onSave }: {
  initial: MindfulHabit | null;
  onClose: () => void;
  onSave: (habit: Omit<MindfulHabit, "id">) => void;
}) {
  const [habit, setHabit] = useState<Omit<MindfulHabit, "id">>(initial ?? emptyMindfulHabit());
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!habit.title.trim()) {
      setError("Enter a habit name.");
      return;
    }
    onSave({ title: habit.title.trim(), description: habit.description.trim() });
  }

  return <Modal title={initial ? "Edit positive habit" : "Add positive habit"} onClose={onClose}>
    <form onSubmit={submit}><div className="form-grid">
      <Field className="full" label="Habit (required)"><Input autoFocus required maxLength={120} placeholder="e.g. Pause before replying when upset" value={habit.title} onChange={(event) => setHabit((current) => ({ ...current, title: event.target.value }))} /></Field>
      <Field className="full" label="What does this look like for you?"><textarea className="field textarea" rows={3} maxLength={1000} placeholder="Optional reminder or description" value={habit.description} onChange={(event) => setHabit((current) => ({ ...current, description: event.target.value }))} /></Field>
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
      <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add habit"}</Button></div>
    </form>
  </Modal>;
}

function MindfulnessLogModal({ initial, habits, onClose, onSave }: {
  initial: MindfulnessLog | null;
  habits: MindfulHabit[];
  onClose: () => void;
  onSave: (log: Omit<MindfulnessLog, "id">) => void;
}) {
  const [log, setLog] = useState<Omit<MindfulnessLog, "id">>(initial ?? {
    date: today(),
    emotion: "Calm",
    intensity: 3,
    trigger: "",
    response: "",
    positiveAction: "",
    reflection: "",
    completedHabitIds: [],
  });
  const [error, setError] = useState("");
  const hiddenCompletedHabits = initial?.completedHabitIds.filter((id) => !habits.some((habit) => habit.id === id)) ?? [];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!log.date || !log.emotion) {
      setError("Choose a date and emotion.");
      return;
    }
    onSave({
      ...log,
      trigger: log.trigger.trim(),
      response: log.response.trim(),
      positiveAction: log.positiveAction.trim(),
      reflection: log.reflection.trim(),
      completedHabitIds: [...new Set([...hiddenCompletedHabits, ...log.completedHabitIds])],
    });
  }

  function toggleHabit(id: string) {
    setLog((current) => ({
      ...current,
      completedHabitIds: current.completedHabitIds.includes(id)
        ? current.completedHabitIds.filter((entry) => entry !== id)
        : [...current.completedHabitIds, id],
    }));
  }

  return <Modal title={initial ? "Edit reflection" : "Add reflection"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field label="Date"><DateInput required value={log.date} onValueChange={(date) => setLog((current) => ({ ...current, date }))} /></Field>
      <Field label="Emotion"><Select value={log.emotion} onChange={(event) => setLog((current) => ({ ...current, emotion: event.target.value as MindfulnessEmotion }))}><option>Anger</option><option>Frustration</option><option>Stress</option><option>Calm</option><option>Love / kindness</option><option>Gratitude</option><option>Other</option></Select></Field>
      <Field label="Intensity (1–5)"><Select value={log.intensity} onChange={(event) => setLog((current) => ({ ...current, intensity: Number(event.target.value) }))}>{[1, 2, 3, 4, 5].map((level) => <option value={level} key={level}>{level}{level === 1 ? " · gentle" : level === 5 ? " · very strong" : ""}</option>)}</Select></Field>
      <Field className="full" label="What was happening?"><textarea className="field textarea" rows={2} maxLength={1000} placeholder="Optional trigger or situation" value={log.trigger} onChange={(event) => setLog((current) => ({ ...current, trigger: event.target.value }))} /></Field>
      <Field className="full" label="How did you respond?"><textarea className="field textarea" rows={2} maxLength={2000} placeholder="Notice what you did without judging yourself." value={log.response} onChange={(event) => setLog((current) => ({ ...current, response: event.target.value }))} /></Field>
      <Field className="full" label="Positive action / kindness"><textarea className="field textarea" rows={2} maxLength={2000} placeholder="A pause, a kind word, gratitude, or another helpful choice" value={log.positiveAction} onChange={(event) => setLog((current) => ({ ...current, positiveAction: event.target.value }))} /></Field>
      <Field className="full" label="Reflection / what might help next time?"><textarea className="field textarea" rows={3} maxLength={3000} placeholder="Optional notes to help you learn from the moment" value={log.reflection} onChange={(event) => setLog((current) => ({ ...current, reflection: event.target.value }))} /></Field>
      {habits.length > 0 && <fieldset className="mindful-habit-checklist full"><legend>Positive habits practiced</legend><div>{habits.map((habit) => <label key={habit.id}><input type="checkbox" checked={log.completedHabitIds.includes(habit.id)} onChange={() => toggleHabit(habit.id)} /><span><strong>{habit.title}</strong>{habit.description && <small>{habit.description}</small>}</span></label>)}</div></fieldset>}
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
      <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save reflection" : "Save reflection"}</Button></div>
    </form>
  </Modal>;
}

function MindfulnessPage({ habits, logs, onSaveHabit, onArchiveHabit, onSaveLog, onArchiveLog }: {
  habits: MindfulHabit[];
  logs: MindfulnessLog[];
  onSaveHabit: (habit: Omit<MindfulHabit, "id">, id?: string) => void;
  onArchiveHabit: (habit: MindfulHabit) => void;
  onSaveLog: (log: Omit<MindfulnessLog, "id">, id?: string) => void;
  onArchiveLog: (log: MindfulnessLog) => void;
}) {
  const [habitEditor, setHabitEditor] = useState<MindfulHabit | null | undefined>(undefined);
  const [logEditor, setLogEditor] = useState<MindfulnessLog | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [emotionFilter, setEmotionFilter] = useState("All emotions");
  const query = search.trim().toLocaleLowerCase();
  const visibleLogs = [...logs]
    .filter((log) => emotionFilter === "All emotions" || log.emotion === emotionFilter)
    .filter((log) => [log.date, log.emotion, log.trigger, log.response, log.positiveAction, log.reflection]
      .some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const since = new Date(`${today()}T00:00:00`);
  since.setDate(since.getDate() - 6);
  const sinceDate = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")}`;
  const recentLogs = logs.filter((log) => log.date >= sinceDate && log.date <= today());
  const recentDays = new Set(recentLogs.map((log) => log.date)).size;
  const recentHabitPractices = new Set(recentLogs.flatMap((log) => log.completedHabitIds.map((id) => `${log.date}:${id}`))).size;
  const habitNames = new Map(habits.map((habit) => [habit.id, habit.title]));

  function archiveHabit(habit: MindfulHabit) {
    if (window.confirm(`Move "${habit.title}" to the archive? Past reflections will remain unchanged.`)) onArchiveHabit(habit);
  }

  function archiveLog(log: MindfulnessLog) {
    if (window.confirm(`Move the ${log.date} reflection to the archive?`)) onArchiveLog(log);
  }

  return <>
    <PageHeading eyebrow="Practice with patience" title="Mind & habits" subtitle="Notice emotional patterns, reflect on responses, and recognize small actions that build patience, kindness, love, and gratitude." action={<Button onClick={() => setLogEditor(null)}><Plus size={15} /> Add reflection</Button>} />
    <div className="alert"><Heart size={15} style={{ flex: "none", marginTop: 1 }} /><span>A gentle personal journal, not a medical assessment. Progress is about noticing and practicing, not being perfect. These notes are saved in your shared Daybook data.</span></div>
    <div className="mindful-summary"><Card><span>Days reflected · last 7 days</span><strong>{recentDays} / 7</strong></Card><Card><span>Habit practices · last 7 days</span><strong>{recentHabitPractices}</strong></Card><Card><span>Positive habits</span><strong>{habits.length}</strong></Card></div>
    <Card className="mindful-habits-card"><div className="card-head"><div><h2 className="section-title">Positive habits</h2><p className="section-description">Choose small, repeatable actions that matter to you.</p></div><Button size="sm" variant="outline" onClick={() => setHabitEditor(null)}><Plus size={14} /> Add habit</Button></div>
      {habits.length ? <div className="mindful-habit-list">{habits.map((habit) => <div className="mindful-habit-row" key={habit.id}><div><strong>{habit.title}</strong>{habit.description && <p>{habit.description}</p>}</div><div className="table-actions"><button className="icon-button" aria-label={`Edit ${habit.title}`} onClick={() => setHabitEditor(habit)}><Pencil size={14} /></button><button className="icon-button" aria-label={`Duplicate ${habit.title}`} onClick={() => onSaveHabit({ ...habit, title: `${habit.title.slice(0, 113)} (copy)` })}><Copy size={14} /></button><button className="icon-button" aria-label={`Archive ${habit.title}`} onClick={() => archiveHabit(habit)}><Archive size={14} /></button></div></div>)}</div> : <p className="mindful-empty-habits">Add a habit such as “Pause and take three breaths” or “Show appreciation to someone.”</p>}
    </Card>
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search reflections" placeholder="Search date, emotion, situation, response..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select aria-label="Filter reflections by emotion" style={{ width: 170 }} value={emotionFilter} onChange={(event) => setEmotionFilter(event.target.value)}><option>All emotions</option><option>Anger</option><option>Frustration</option><option>Stress</option><option>Calm</option><option>Love / kindness</option><option>Gratitude</option><option>Other</option></Select><Badge>{visibleLogs.length} {visibleLogs.length === 1 ? "reflection" : "reflections"}</Badge></div>
    <div className="mindful-log-list">{visibleLogs.map((log) => <Card className="mindful-log-card" key={log.id}>
      <div className="mindful-log-head"><div><h2>{dateLabel(log.date)}</h2><div className="mindful-log-badges"><Badge tone={log.emotion === "Anger" || log.emotion === "Frustration" || log.emotion === "Stress" ? "amber" : "green"}>{log.emotion}</Badge><Badge>Intensity {log.intensity}/5</Badge></div></div><div className="table-actions"><button className="icon-button" aria-label={`Edit reflection for ${log.date}`} onClick={() => setLogEditor(log)}><Pencil size={14} /></button><button className="icon-button" aria-label={`Copy reflection for ${log.date}`} onClick={() => onSaveLog({ ...log, date: today() })}><Copy size={14} /></button><button className="icon-button" aria-label={`Archive reflection for ${log.date}`} onClick={() => archiveLog(log)}><Archive size={14} /></button></div></div>
      {log.trigger && <div className="mindful-log-section"><span>Situation</span><p>{log.trigger}</p></div>}
      {log.response && <div className="mindful-log-section"><span>Response</span><p>{log.response}</p></div>}
      {log.positiveAction && <div className="mindful-log-section mindful-positive"><span>Positive action</span><p>{log.positiveAction}</p></div>}
      {log.reflection && <div className="mindful-log-section"><span>Reflection</span><p>{log.reflection}</p></div>}
      {log.completedHabitIds.length > 0 && <div className="mindful-practiced"><strong>Habits practiced</strong>{log.completedHabitIds.map((id) => <Badge key={id}>{habitNames.get(id) ?? "Past habit"}</Badge>)}</div>}
    </Card>)}</div>
    {!visibleLogs.length && <Card><EmptyState icon={<Heart size={18} />} title={logs.length ? "No matching reflections" : "No reflections yet"} description={logs.length ? "Try another search or emotion." : "Add a reflection when you want to note a feeling, a response, or a positive moment."} /></Card>}
    {habitEditor !== undefined && <MindfulHabitModal key={habitEditor?.id ?? "new-mindful-habit"} initial={habitEditor} onClose={() => setHabitEditor(undefined)} onSave={(habit) => { onSaveHabit(habit, habitEditor?.id); setHabitEditor(undefined); }} />}
    {logEditor !== undefined && <MindfulnessLogModal key={logEditor?.id ?? "new-mindfulness-log"} initial={logEditor} habits={habits} onClose={() => setLogEditor(undefined)} onSave={(log) => { onSaveLog(log, logEditor?.id); setLogEditor(undefined); }} />}
  </>;
}

function formatDatabaseValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const FREE_DATABASE_LIMIT_BYTES = 500_000_000;
const FREE_STORAGE_LIMIT_BYTES = 1_000_000_000;

function formatCapacity(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1000;
    unitIndex += 1;
  } while (value >= 1000 && unitIndex < units.length - 1);
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function CapacityCard({ title, usedBytes, limitBytes, detail }: {
  title: string;
  usedBytes: number;
  limitBytes: number;
  detail?: string;
}) {
  const remainingBytes = Math.max(0, limitBytes - usedBytes);
  const percentage = Math.min(100, usedBytes / limitBytes * 100);
  return <Card className="capacity-card">
    <h2 className="section-title">{title}</h2>
    <div className="capacity-values"><div><span>Used</span><strong>{formatCapacity(usedBytes)}</strong></div><div><span>Free-plan reference limit</span><strong>{formatCapacity(limitBytes)}</strong></div></div>
    <div className="capacity-track" role="progressbar" aria-label={`${title} used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentage)}><div style={{ width: `${percentage}%` }} /></div>
    <div className="capacity-remaining"><span>{usedBytes > limitBytes ? "Over reference limit" : "Remaining"}</span><strong>{usedBytes > limitBytes ? formatCapacity(usedBytes - limitBytes) : formatCapacity(remainingBytes)}</strong></div>
    {detail && <p className="capacity-detail">{detail}</p>}
  </Card>;
}

function HostingStoragePage() {
  const [cloudUsage, setCloudUsage] = useState<CloudUsage | null>(null);
  const [deploymentUsage, setDeploymentUsage] = useState<DeploymentUsage | null>(null);
  const [cloudError, setCloudError] = useState("");
  const [deploymentError, setDeploymentError] = useState("");
  const [loading, setLoading] = useState(false);

  async function refreshUsage() {
    setLoading(true);
    setCloudError("");
    setDeploymentError("");
    setCloudUsage(null);
    setDeploymentUsage(null);
    const [cloudResult, deploymentResult] = await Promise.allSettled([
      loadCloudUsage(),
      loadDeploymentUsage(),
    ]);
    if (cloudResult.status === "fulfilled") setCloudUsage(cloudResult.value);
    else setCloudError(cloudResult.reason instanceof Error ? cloudResult.reason.message : "Could not measure Supabase usage.");
    if (deploymentResult.status === "fulfilled") setDeploymentUsage(deploymentResult.value);
    else setDeploymentError(deploymentResult.reason instanceof Error ? deploymentResult.reason.message : "Could not read the deployment output report.");
    setLoading(false);
  }

  useEffect(() => {
    void refreshUsage();
  }, []);

  function measuredTime(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  return <>
    <PageHeading eyebrow="Infrastructure overview" title="Hosting & storage" subtitle="Review measured Supabase usage and the size of this Vercel deployment build." action={<Button variant="outline" onClick={() => void refreshUsage()} disabled={loading}><RefreshCw size={14} />{loading ? "Measuring..." : "Refresh usage"}</Button>} />
    <div className="alert"><HardDrive size={15} style={{ flex: "none", marginTop: 1 }} /><span>Supabase usage is measured from the connected project. Quotas shown are Free-plan reference limits, not live billing data. Vercel reports this build’s output size; account-wide hosting usage and remaining quota are not available from this metric.</span></div>
    {cloudError && <div className="alert alert-error" role="alert">{cloudError}</div>}
    {deploymentError && <div className="alert alert-warning" role="status">{deploymentError}</div>}
    {loading && !cloudUsage && !deploymentUsage && <Card><p className="section-description">Measuring project usage...</p></Card>}
    <div className="hosting-usage-grid">
      {cloudUsage && <>
        <CapacityCard title="Supabase database" usedBytes={cloudUsage.databaseBytes} limitBytes={FREE_DATABASE_LIMIT_BYTES} detail="Total PostgreSQL database size, including tables, indexes, and system data." />
        <CapacityCard title="Supabase Storage" usedBytes={cloudUsage.storageBytes} limitBytes={FREE_STORAGE_LIMIT_BYTES} detail={`${cloudUsage.storageObjects.toLocaleString()} stored object(s), across all buckets in this project.`} />
      </>}
      {deploymentUsage && <Card className="capacity-card hosting-output-card">
        <h2 className="section-title">Vercel deployment output</h2>
        <div className="deployment-size">{formatCapacity(deploymentUsage.deploymentOutputBytes)}</div>
        <p className="capacity-detail">Generated files for this build · {deploymentUsage.fileCount.toLocaleString()} file(s)</p>
        <p className="capacity-detail">This is not cumulative Vercel project storage and does not indicate remaining account quota.</p>
      </Card>}
    </div>
    {cloudUsage && <p className="usage-measured-at">Supabase measured {measuredTime(cloudUsage.measuredAt)}.</p>}
    {deploymentUsage && <p className="usage-measured-at">Build output measured {measuredTime(deploymentUsage.measuredAt)}.</p>}
  </>;
}

function DatabaseManagerPage() {
  const [catalog, setCatalog] = useState<DatabaseCatalog | null>(null);
  const [rows, setRows] = useState<DatabaseRows | null>(null);
  const [selectedTable, setSelectedTable] = useState("");
  const [view, setView] = useState<"tables" | "routines" | "triggers" | "sql">("tables");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sqlStatement, setSqlStatement] = useState("");
  const [sqlReview, setSqlReview] = useState<SqlReview | null>(null);
  const [sqlReviewedText, setSqlReviewedText] = useState("");
  const [sqlConfirmation, setSqlConfirmation] = useState("");
  const [sqlWriteAcknowledged, setSqlWriteAcknowledged] = useState(false);
  const [sqlResult, setSqlResult] = useState<SqlExecutionResult | null>(null);

  async function refreshCatalog() {
    setLoading(true);
    setError("");
    try {
      const next = await loadDatabaseCatalog();
      setCatalog(next);
      if (!selectedTable && next.tables.length) setSelectedTable(next.tables[0].name);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load database objects.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshRows(table: string, offset = 0) {
    setBusy(true);
    setError("");
    try {
      setRows(await loadDatabaseRows(table, offset));
      setSelectedTable(table);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load table records.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewSql() {
    setBusy(true);
    setError("");
    setNotice("");
    setSqlResult(null);
    try {
      const review = await reviewDatabaseSql(sqlStatement);
      setSqlReview(review);
      setSqlReviewedText(sqlStatement);
      setSqlConfirmation("");
      setSqlWriteAcknowledged(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The SQL statement could not be reviewed.");
    } finally {
      setBusy(false);
    }
  }

  async function executeReviewedSql() {
    if (!sqlReview) return;
    if (sqlReview.requiresConfirmation &&
      (!sqlWriteAcknowledged || sqlConfirmation !== sqlReview.confirmationPhrase)) {
      setError(`Acknowledge the warning and type "${sqlReview.confirmationPhrase}" to continue.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await executeDatabaseSql(
        sqlReviewedText,
        sqlReview.requiresConfirmation ? sqlConfirmation : "",
        sqlReview.statementHash,
      );
      setSqlResult(result);
      setSqlReview(null);
      setSqlReviewedText("");
      setSqlConfirmation("");
      setSqlWriteAcknowledged(false);
      setNotice(result.command === "select"
        ? `SELECT completed. ${result.rowCount} row(s) returned.`
        : `${result.command.toUpperCase()} committed. ${result.rowCount} row(s) affected. This change is permanent.`);
      if (result.command !== "select") {
        setRows(null);
        await refreshCatalog();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "SQL execution failed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refreshCatalog();
  }, []);

  useEffect(() => {
    if (selectedTable && view === "tables" && !rows) void refreshRows(selectedTable);
  }, [selectedTable, view, rows]);

  return <>
    <PageHeading eyebrow="Database tools" title="Database manager" subtitle="Inspect database objects and run reviewed SQL against eligible public tables." action={<Button variant="outline" onClick={() => { setRows(null); void refreshCatalog(); }} disabled={loading || busy}><RefreshCw size={14} />Refresh</Button>} />
    <div className="alert alert-warning"><Database size={15} style={{ flex: "none", marginTop: 1 }} /><span>SQL console accepts one SELECT, INSERT, UPDATE, or DELETE statement. DDL, transactions, protected core tables, functions, subqueries, multi-statement scripts, and unbounded SELECTs are blocked. Every write needs a typed confirmation; writes are permanent, bypass the archive, and database triggers or foreign-key cascades may affect linked data. The confirmation helps prevent mistakes; it is not separate authorization. Anyone with the shared Daybook password can use this screen.</span></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    <div className="database-tabs" role="tablist" aria-label="Database tools">
      {(["tables", "routines", "triggers", "sql"] as const).map((tab) => <Button key={tab} variant={view === tab ? "primary" : "outline"} role="tab" aria-selected={view === tab} onClick={() => setView(tab)}>{tab === "tables" ? "Tables & rows" : tab === "routines" ? "Functions & procedures" : tab === "triggers" ? "Triggers" : "SQL console"}</Button>)}
    </div>
    {loading && !catalog ? <Card><p className="section-description">Loading database objects...</p></Card> : catalog && view === "tables" && <>
      <Card className="database-browser"><div className="database-table-select"><Field label="Public table"><Select value={selectedTable} onChange={(event) => { setRows(null); setSelectedTable(event.target.value); }}>{catalog.tables.map((table) => <option value={table.name} key={table.name}>{table.name} · ~{table.estimated_rows} rows · {table.column_count} columns</option>)}</Select></Field><Badge>{catalog.tables.length} tables</Badge></div>
        {rows && <><div className="database-column-list"><strong>Columns</strong>{rows.columns.map((column) => <Badge key={column.column_name}>{column.column_name} · {column.data_type}{rows.primaryKey.includes(column.column_name) ? " · PK" : ""}</Badge>)}</div>
          <div className="database-row-list">{rows.rows.map((row, index) => {
            const key = Object.fromEntries(rows.primaryKey.map((column) => [column, row[column]]));
            const keyLabel = rows.primaryKey.map((column) => `${column}=${formatDatabaseValue(row[column])}`).join(", ");
            return <article className="database-row" key={JSON.stringify(key) || index}><div className="database-row-head"><strong>{keyLabel || `Row ${rows.offset + index + 1}`}</strong></div><div className="database-fields">{rows.columns.map((column) => <div key={column.column_name}><span>{column.column_name}</span><pre>{formatDatabaseValue(row[column.column_name])}</pre></div>)}</div></article>;
          })}{!rows.rows.length && <EmptyState icon={<Database size={18} />} title="No rows in this table" description="This table is currently empty." />}</div>
          <div className="database-pagination"><span>Rows {rows.offset + 1}–{rows.offset + rows.rows.length}</span><div><Button variant="outline" size="sm" disabled={busy || rows.offset === 0} onClick={() => void refreshRows(rows.table, Math.max(0, rows.offset - 50))}>Previous</Button><Button variant="outline" size="sm" disabled={busy || !rows.hasMore} onClick={() => void refreshRows(rows.table, rows.offset + 50)}>Next</Button></div></div>
        </>}
      </Card>
    </>}
    {catalog && view === "sql" && <Card className="database-sql-console">
      <Field label="SQL statement"><textarea className="field textarea database-sql-editor" rows={9} maxLength={16000} spellCheck={false} value={sqlStatement} onChange={(event) => setSqlStatement(event.target.value)} placeholder={"SELECT * FROM public.your_table LIMIT 50;\n\nOnly one statement is accepted."} /></Field>
      <p className="section-description">Qualify table names with <code>public.</code>. SELECT runs in a read-only transaction and requires LIMIT 1–100. UPDATE and DELETE require a WHERE clause. INSERT is limited to 100 VALUES rows. Use the review step to inspect the exact statement before execution.</p>
      <div className="database-sql-actions"><Button type="button" disabled={busy || !sqlStatement.trim()} onClick={() => void reviewSql()}>{busy ? "Reviewing..." : "Review statement"}</Button></div>
      {sqlResult && <div className="database-sql-result">
        <div className="database-sql-result-head"><h2 className="section-title">Last result</h2><Badge tone={sqlResult.command === "select" ? "blue" : "amber"}>{sqlResult.command.toUpperCase()} · {sqlResult.rowCount} row(s)</Badge></div>
        {sqlResult.fields.length > 0 && <div className="database-sql-result-table"><table><thead><tr>{sqlResult.fields.map((field) => <th key={field}>{field}</th>)}</tr></thead><tbody>{sqlResult.rows.map((row, index) => <tr key={index}>{sqlResult.fields.map((field) => <td key={field}><pre>{formatDatabaseValue(row[field])}</pre></td>)}</tr>)}</tbody></table>{!sqlResult.rows.length && <p className="section-description">The query returned no rows.</p>}</div>}
      </div>}
    </Card>}
    {catalog && view === "routines" && <div className="database-object-list">{catalog.routines.map((routine) => <Card className="database-object" key={routine.id}><div className="card-head"><div><h2 className="section-title">{routine.name}</h2><p className="section-description">{routine.kind}{routine.arguments ? ` · ${routine.arguments}` : ""}</p></div><Badge>Read only</Badge></div><pre>{routine.definition}</pre></Card>)}{!catalog.routines.length && <Card><EmptyState icon={<Database size={18} />} title="No public functions or procedures" description="No routines were found in the public schema." /></Card>}</div>}
    {catalog && view === "triggers" && <div className="database-object-list">{catalog.triggers.map((trigger) => <Card className="database-object" key={`${trigger.table_name}:${trigger.name}`}><div className="card-head"><div><h2 className="section-title">{trigger.name}</h2><p className="section-description">Table: {trigger.table_name}</p></div><Badge>Read only</Badge></div><pre>{trigger.definition}</pre></Card>)}{!catalog.triggers.length && <Card><EmptyState icon={<Database size={18} />} title="No public triggers" description="No non-internal triggers were found in the public schema." /></Card>}</div>}
    {sqlReview && <Modal title={`Review ${sqlReview.command.toUpperCase()} statement`} onClose={() => { if (!busy) { setSqlReview(null); setSqlReviewedText(""); } }} wide>
      <div className="alert alert-warning"><Database size={15} style={{ flex: "none", marginTop: 1 }} /><span>{sqlReview.requiresConfirmation
        ? `This write will be committed permanently. It cannot be undone here and bypasses the Daybook archive. Existing triggers and foreign-key rules may also change related data.`
        : "This SELECT will run without changing rows. It is limited to 100 results and cannot call database functions."}</span></div>
      <p className="section-description">Command: <strong>{sqlReview.command.toUpperCase()}</strong>{sqlReview.tables.length ? ` · Public table(s): ${sqlReview.tables.join(", ")}` : ""}</p>
      <pre className="database-sql-preview">{sqlReviewedText.trim()}</pre>
      {sqlReview.requiresConfirmation && <>
        <label className="database-sql-acknowledge"><input type="checkbox" checked={sqlWriteAcknowledged} onChange={(event) => setSqlWriteAcknowledged(event.target.checked)} /><span>I reviewed this exact SQL and understand that the change may be permanent and may affect linked data.</span></label>
        <Field label={`Type ${sqlReview.confirmationPhrase} to confirm`}><Input autoComplete="off" value={sqlConfirmation} onChange={(event) => setSqlConfirmation(event.target.value)} /></Field>
      </>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="modal-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => { setSqlReview(null); setSqlReviewedText(""); }}>Cancel</Button><Button type="button" variant={sqlReview.requiresConfirmation ? "danger" : "primary"} disabled={busy || (sqlReview.requiresConfirmation && (!sqlWriteAcknowledged || sqlConfirmation !== sqlReview.confirmationPhrase))} onClick={() => void executeReviewedSql()}>{busy ? "Executing..." : `Execute ${sqlReview.command.toUpperCase()}`}</Button></div>
    </Modal>}
  </>;
}

const TRAINING_DELIVERY_MODES: TrainingDeliveryMode[] = ["In-person class", "Online class", "Virtual class", "Self-study"];

function TrainingSessionModal({ initial, onClose, onSave }: {
  initial: TrainingSession | null;
  onClose: () => void;
  onSave: (session: Omit<TrainingSession, "id">) => void;
}) {
  const [courseName, setCourseName] = useState(initial?.courseName ?? "");
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [mode, setMode] = useState<TrainingDeliveryMode>(initial?.mode ?? "In-person class");
  const [date, setDate] = useState(initial?.date ?? today());
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [instructor, setInstructor] = useState(initial?.instructor ?? "");
  const [learned, setLearned] = useState(initial?.learned ?? "");
  const [resourceLink, setResourceLink] = useState(initial?.resourceLink ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!courseName.trim() || !date || !learned.trim()) {
      setError("Enter a course or class name, date, and what you learned.");
      return;
    }
    if (startTime && endTime && endTime < startTime) {
      setError("The end time cannot be earlier than the start time.");
      return;
    }
    if (resourceLink && !isHttpsLink(resourceLink)) {
      setError("Enter a valid HTTPS resource link, or leave it blank.");
      return;
    }
    onSave({
      courseName: courseName.trim(),
      institution: institution.trim(),
      mode,
      date,
      startTime,
      endTime,
      topic: topic.trim(),
      instructor: instructor.trim(),
      learned: learned.trim(),
      resourceLink: resourceLink.trim(),
      notes: notes.trim(),
    });
  }

  return <Modal title={initial ? "Edit class or learning session" : "Log a class or learning session"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field className="full" label="Course / class name (required)"><Input autoFocus required maxLength={140} placeholder="e.g. DevOps Engineer training" value={courseName} onChange={(event) => setCourseName(event.target.value)} /></Field>
      <Field label="Training format"><Select value={mode} onChange={(event) => setMode(event.target.value as TrainingDeliveryMode)}>{TRAINING_DELIVERY_MODES.map((entry) => <option key={entry}>{entry}</option>)}</Select></Field>
      <Field label="Training institute / platform"><Input maxLength={140} placeholder="Institute, online platform, or self-study" value={institution} onChange={(event) => setInstitution(event.target.value)} /></Field>
      <Field label="Class / learning date"><DateInput required value={date} onValueChange={setDate} /></Field>
      <Field label="Instructor / mentor"><Input maxLength={120} placeholder="Optional" value={instructor} onChange={(event) => setInstructor(event.target.value)} /></Field>
      <Field label="Start time"><Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></Field>
      <Field label="End time"><Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></Field>
      <Field className="full" label="Class topic"><Input maxLength={180} placeholder="e.g. Docker images and containers" value={topic} onChange={(event) => setTopic(event.target.value)} /></Field>
      <Field className="full" label="What did you learn? (required)"><textarea className="field textarea" rows={4} required maxLength={5000} placeholder="Capture the key concepts, commands, exercises, or takeaways from this date..." value={learned} onChange={(event) => setLearned(event.target.value)} /></Field>
      <Field className="full" label="Class materials / resource link"><ExternalLinkInput maxLength={2000} placeholder="Optional HTTPS link to class notes, slides, or recording" value={resourceLink} onChange={(event) => setResourceLink(event.target.value)} /></Field>
      <Field className="full" label="Additional notes"><textarea className="field textarea" rows={2} maxLength={2000} placeholder="Questions to revisit, homework, or next steps" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
    </div>
    {error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
    <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Save session"}</Button></div></form>
  </Modal>;
}

function TrainingClassesPage({ sessions, onSave, onDelete }: {
  sessions: TrainingSession[];
  onSave: (session: Omit<TrainingSession, "id">, id?: string) => void;
  onDelete: (session: TrainingSession) => void;
}) {
  const [editor, setEditor] = useState<TrainingSession | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("All formats");
  const query = search.trim().toLocaleLowerCase();
  const visible = sessions
    .filter((session) => modeFilter === "All formats" || session.mode === modeFilter)
    .filter((session) => [
      session.courseName, session.institution, session.mode, session.date, session.topic,
      session.instructor, session.learned, session.notes,
    ].some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));

  return <>
    <PageHeading eyebrow="Build your skills" title="Training & classes" subtitle="Keep a dated journal of institute classes, online or virtual training, and self-study sessions." action={<Button onClick={() => setEditor(null)}><Plus size={15} /> Log a session</Button>} />
    <div className="alert"><BookOpen size={15} style={{ flex: "none", marginTop: 1 }} /><span>This log is separate from daily Learning. Add one entry for each class or study date to track the subject, format, materials, and what you learned.</span></div>
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search training sessions" placeholder="Search course, date, topic, learning..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select aria-label="Filter training format" style={{ width: 180 }} value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}><option>All formats</option>{TRAINING_DELIVERY_MODES.map((entry) => <option key={entry}>{entry}</option>)}</Select><Badge>{visible.length} {visible.length === 1 ? "session" : "sessions"}</Badge></div>
    {visible.length ? <div className="training-session-list">{visible.map((session) => <Card className="training-session-card" key={session.id}>
      <div className="training-session-head"><div className="training-session-title"><div className="training-session-icon"><BookOpen size={16} /></div><div><h2>{session.courseName}</h2><p>{[session.institution, session.topic].filter(Boolean).join(" · ") || "Class session"}</p></div></div><div className="table-actions"><Badge>{session.mode}</Badge><button className="icon-button" aria-label={`Edit ${session.courseName} session on ${session.date}`} onClick={() => setEditor(session)}><Pencil size={14} /></button><button className="icon-button" aria-label={`Copy ${session.courseName} session on ${session.date}`} onClick={() => { const { id, ...copy } = session; void id; onSave(copy); }}><Copy size={14} /></button><button className="icon-button" aria-label={`Archive ${session.courseName} session on ${session.date}`} onClick={() => onDelete(session)}><Archive size={14} /></button></div></div>
      <div className="training-session-meta"><span>{dateLabel(session.date)}{session.startTime ? ` · ${session.startTime}${session.endTime ? `–${session.endTime}` : ""}` : ""}</span>{session.instructor && <span>Instructor: {session.instructor}</span>}</div>
      <div className="training-session-learning"><strong>What I learned</strong><p><LinkifiedText>{session.learned}</LinkifiedText></p></div>
      {session.notes && <p className="training-session-notes"><LinkifiedText>{session.notes}</LinkifiedText></p>}
      {session.resourceLink && <a className="personal-document-link" href={session.resourceLink} target="_blank" rel="noopener noreferrer">Open class materials</a>}
    </Card>)}</div> : <Card><EmptyState icon={<BookOpen size={18} />} title={sessions.length ? "No matching sessions" : "No class sessions yet"} description={sessions.length ? "Try another search or format filter." : "Log a dated training class or study session to start your learning journal."} /></Card>}
    {editor !== undefined && <TrainingSessionModal key={editor?.id ?? "new-training-session"} initial={editor} onClose={() => setEditor(undefined)} onSave={(session) => { onSave(session, editor?.id); setEditor(undefined); }} />}
  </>;
}

function VehicleModal({ initial, onClose, onSave }: {
  initial: Vehicle | null;
  onClose: () => void;
  onSave: (vehicle: Omit<Vehicle, "id">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [make, setMake] = useState(initial?.make ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [year, setYear] = useState(initial?.year == null ? "" : String(initial.year));
  const [registration, setRegistration] = useState(initial?.registration ?? "");
  const [fuelType, setFuelType] = useState(initial?.fuelType ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedYear = year.trim() ? Number(year) : null;
    if (!name.trim()) { setError("Enter a name for this vehicle."); return; }
    if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 1886 || parsedYear > new Date().getFullYear() + 1)) {
      setError("Enter a valid model year."); return;
    }
    onSave({ name: name.trim(), make: make.trim(), model: model.trim(), year: parsedYear, registration: registration.trim(), fuelType: fuelType.trim(), notes: notes.trim() });
  }

  return <Modal title={initial ? "Edit vehicle" : "Add a vehicle"} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid">
    <Field className="full" label="Vehicle name"><Input autoFocus required maxLength={100} placeholder="e.g. Family car" value={name} onChange={(event) => setName(event.target.value)} /></Field>
    <Field label="Make"><Input maxLength={80} placeholder="e.g. Honda" value={make} onChange={(event) => setMake(event.target.value)} /></Field>
    <Field label="Model"><Input maxLength={80} placeholder="e.g. City" value={model} onChange={(event) => setModel(event.target.value)} /></Field>
    <Field label="Year"><Input type="number" min="1886" max={new Date().getFullYear() + 1} step="1" placeholder="Optional" value={year} onChange={(event) => setYear(event.target.value)} /></Field>
    <Field label="Registration number"><Input maxLength={30} placeholder="Optional" value={registration} onChange={(event) => setRegistration(event.target.value)} /></Field>
    <Field label="Fuel type"><Input maxLength={40} placeholder="Petrol, diesel, EV..." value={fuelType} onChange={(event) => setFuelType(event.target.value)} /></Field>
    <Field className="full" label="Notes"><Input maxLength={1000} placeholder="Anything to remember about this vehicle" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
  </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }}>{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save vehicle" : "Add vehicle"}</Button></div></form></Modal>;
}

function VehicleJourneyModal({ vehicle, initial, onClose, onSave }: {
  vehicle: Vehicle;
  initial: VehicleJourney | null;
  onClose: () => void;
  onSave: (journey: Omit<VehicleJourney, "id" | "vehicleId">) => void;
}) {
  const [date, setDate] = useState(initial?.date ?? today());
  const [startLocation, setStartLocation] = useState(initial?.startLocation ?? "");
  const [endLocation, setEndLocation] = useState(initial?.endLocation ?? "");
  const [odometerStart, setOdometerStart] = useState(initial?.odometerStart == null ? "" : String(initial.odometerStart));
  const [odometerEnd, setOdometerEnd] = useState(initial?.odometerEnd == null ? "" : String(initial.odometerEnd));
  const [purpose, setPurpose] = useState(initial?.purpose ?? "");
  const [cost, setCost] = useState(initial?.cost == null ? "0" : String(initial.cost));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const start = odometerStart.trim() ? Number(odometerStart) : null;
    const end = odometerEnd.trim() ? Number(odometerEnd) : null;
    const parsedCost = Number(cost);
    if (!date || (!startLocation.trim() && !endLocation.trim() && !purpose.trim())) {
      setError("Enter the date and at least a location or the purpose of travel."); return;
    }
    if ((start !== null && (!Number.isFinite(start) || start < 0)) ||
      (end !== null && (!Number.isFinite(end) || end < 0)) ||
      (start !== null && end !== null && end < start)) {
      setError("Odometer readings must be non-negative, and the ending reading cannot be lower than the starting reading."); return;
    }
    if (!Number.isFinite(parsedCost) || parsedCost < 0) { setError("Travel costs cannot be negative."); return; }
    onSave({ date, startLocation: startLocation.trim(), endLocation: endLocation.trim(), odometerStart: start, odometerEnd: end, purpose: purpose.trim(), cost: parsedCost, notes: notes.trim() });
  }

  return <Modal title={`${initial ? "Edit" : "Log"} travel · ${vehicle.name}`} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid">
    <Field label="Travel date"><DateInput autoFocus required value={date} onValueChange={setDate} /></Field>
    <Field label="Purpose"><Input maxLength={120} placeholder="Commute, appointment..." value={purpose} onChange={(event) => setPurpose(event.target.value)} /></Field>
    <Field label="From"><Input maxLength={120} placeholder="Starting location" value={startLocation} onChange={(event) => setStartLocation(event.target.value)} /></Field>
    <Field label="To"><Input maxLength={120} placeholder="Destination" value={endLocation} onChange={(event) => setEndLocation(event.target.value)} /></Field>
    <Field label="Odometer at start (km)"><Input type="number" min="0" step="any" placeholder="Optional" value={odometerStart} onChange={(event) => setOdometerStart(event.target.value)} /></Field>
    <Field label="Odometer at end (km)"><Input type="number" min="0" step="any" placeholder="Optional" value={odometerEnd} onChange={(event) => setOdometerEnd(event.target.value)} /></Field>
    <Field label="Travel cost"><Input type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} /></Field>
    <Field className="full" label="Notes"><Input maxLength={1000} placeholder="Optional notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
  </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }}>{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save travel log" : "Add travel log"}</Button></div></form></Modal>;
}

function VehicleMaintenanceModal({ vehicle, initial, onClose, onSave }: {
  vehicle: Vehicle;
  initial: VehicleMaintenance | null;
  onClose: () => void;
  onSave: (entry: Omit<VehicleMaintenance, "id" | "vehicleId">) => void;
}) {
  const [date, setDate] = useState(initial?.date ?? today());
  const [odometer, setOdometer] = useState(initial?.odometer == null ? "" : String(initial.odometer));
  const [type, setType] = useState<VehicleMaintenanceType>(initial?.type ?? "Service");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [provider, setProvider] = useState(initial?.provider ?? "");
  const [cost, setCost] = useState(initial?.cost == null ? "0" : String(initial.cost));
  const [nextDueDate, setNextDueDate] = useState(initial?.nextDueDate ?? "");
  const [nextDueOdometer, setNextDueOdometer] = useState(initial?.nextDueOdometer == null ? "" : String(initial.nextDueOdometer));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedOdometer = odometer.trim() ? Number(odometer) : null;
    const parsedNextDueOdometer = nextDueOdometer.trim() ? Number(nextDueOdometer) : null;
    const parsedCost = Number(cost);
    if (!date || !description.trim()) { setError("Enter the date and describe the service or repair."); return; }
    if ((parsedOdometer !== null && (!Number.isFinite(parsedOdometer) || parsedOdometer < 0)) ||
      (parsedNextDueOdometer !== null && (!Number.isFinite(parsedNextDueOdometer) || parsedNextDueOdometer < 0))) {
      setError("Odometer readings must be zero or greater."); return;
    }
    if (!Number.isFinite(parsedCost) || parsedCost < 0) { setError("Service costs cannot be negative."); return; }
    onSave({ date, odometer: parsedOdometer, type, description: description.trim(), provider: provider.trim(), cost: parsedCost, nextDueDate, nextDueOdometer: parsedNextDueOdometer, notes: notes.trim() });
  }

  return <Modal title={`${initial ? "Edit" : "Log"} service or repair · ${vehicle.name}`} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid">
    <Field label="Date"><DateInput autoFocus required value={date} onValueChange={setDate} /></Field>
    <Field label="Type"><Select value={type} onChange={(event) => setType(event.target.value as VehicleMaintenanceType)}><option value="Service">Service</option><option value="Repair">Repair</option></Select></Field>
    <Field className="full" label="Work performed"><Input maxLength={160} required placeholder="e.g. Oil change, brake replacement" value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
    <Field label="Odometer (km)"><Input type="number" min="0" step="any" placeholder="Optional" value={odometer} onChange={(event) => setOdometer(event.target.value)} /></Field>
    <Field label="Cost"><Input type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} /></Field>
    <Field label="Service provider"><Input maxLength={120} placeholder="Garage or service center" value={provider} onChange={(event) => setProvider(event.target.value)} /></Field>
    <Field label="Next due date"><DateInput value={nextDueDate} onValueChange={setNextDueDate} /></Field>
    <Field label="Next due odometer (km)"><Input type="number" min="0" step="any" placeholder="Optional" value={nextDueOdometer} onChange={(event) => setNextDueOdometer(event.target.value)} /></Field>
    <Field className="full" label="Notes"><Input maxLength={1000} placeholder="Parts, warranty, or other details" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
  </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }}>{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save record" : "Add record"}</Button></div></form></Modal>;
}

function VehicleManagement({ vehicles, journeys, maintenance, onSaveVehicle, onCopyVehicle, onDeleteVehicle, onSaveJourney, onDeleteJourney, onSaveMaintenance, onDeleteMaintenance }: {
  vehicles: Vehicle[];
  journeys: VehicleJourney[];
  maintenance: VehicleMaintenance[];
  onSaveVehicle: (vehicle: Omit<Vehicle, "id">, id?: string) => void;
  onCopyVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (vehicle: Vehicle) => void;
  onSaveJourney: (journey: Omit<VehicleJourney, "id" | "vehicleId">, vehicleId: string, id?: string) => void;
  onDeleteJourney: (journey: VehicleJourney) => void;
  onSaveMaintenance: (entry: Omit<VehicleMaintenance, "id" | "vehicleId">, vehicleId: string, id?: string) => void;
  onDeleteMaintenance: (entry: VehicleMaintenance) => void;
}) {
  const formatCurrency = useCurrencyFormatter();
  const [vehicleEditor, setVehicleEditor] = useState<{ initial: Vehicle | null } | null>(null);
  const [journeyEditor, setJourneyEditor] = useState<{ vehicle: Vehicle; initial: VehicleJourney | null } | null>(null);
  const [maintenanceEditor, setMaintenanceEditor] = useState<{ vehicle: Vehicle; initial: VehicleMaintenance | null } | null>(null);

  return <><PageHeading eyebrow="On the road" title="Vehicle management" subtitle="Keep vehicle details, travel logs, and service and repair history together." action={<Button onClick={() => setVehicleEditor({ initial: null })}><Plus size={15} /> Add a vehicle</Button>} />
    <div className="alert"><Car size={15} style={{ flex: "none", marginTop: 1 }} /><span>Travel, service and repair records are saved with your shared Daybook data and sync to your other devices.</span></div>
    {!vehicles.length ? <Card><EmptyState icon={<Car size={18} />} title="No vehicles yet" description="Add a vehicle to start recording journeys, services and repairs." /></Card> :
      <div className="vehicle-list">{vehicles.map((vehicle) => {
        const vehicleJourneys = journeys.filter((journey) => journey.vehicleId === vehicle.id).sort((a, b) => b.date.localeCompare(a.date));
        const vehicleMaintenance = maintenance.filter((entry) => entry.vehicleId === vehicle.id).sort((a, b) => b.date.localeCompare(a.date));
        const recordedDistance = vehicleJourneys.reduce((total, journey) => total +
          (journey.odometerStart !== null && journey.odometerEnd !== null ? journey.odometerEnd - journey.odometerStart : 0), 0);
        const maintenanceCost = vehicleMaintenance.reduce((total, entry) => total + entry.cost, 0);
        const travelCost = vehicleJourneys.reduce((total, journey) => total + journey.cost, 0);
        return <Card className="vehicle-card" key={vehicle.id}>
          <div className="vehicle-card-head"><div className="vehicle-heading"><div className="vehicle-icon"><Car size={18} /></div><div><h2 className="section-title">{vehicle.name}</h2><p className="section-description">{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle"}{vehicle.registration ? ` · ${vehicle.registration}` : ""}{vehicle.fuelType ? ` · ${vehicle.fuelType}` : ""}</p></div></div>
            <div className="table-actions"><button className="icon-button" aria-label={`Edit ${vehicle.name}`} onClick={() => setVehicleEditor({ initial: vehicle })}><Pencil size={14} /></button>            <button className="icon-button" aria-label={`Copy ${vehicle.name} without its logs`} title="Copy vehicle details without travel or service history" onClick={() => onCopyVehicle(vehicle)}><Copy size={14} /></button><button className="icon-button" aria-label={`Archive ${vehicle.name}`} onClick={() => onDeleteVehicle(vehicle)}><Archive size={14} /></button></div></div>
          {vehicle.notes && <p className="vehicle-notes"><LinkifiedText>{vehicle.notes}</LinkifiedText></p>}
          <div className="vehicle-stats"><div><span>Travel logs</span><strong>{vehicleJourneys.length}</strong></div><div><span>Recorded distance</span><strong>{recordedDistance.toLocaleString()} km</strong></div><div><span>Travel costs</span><strong>{formatCurrency(travelCost)}</strong></div><div><span>Service & repair cost</span><strong>{formatCurrency(maintenanceCost)}</strong></div></div>
          <section className="vehicle-section"><div className="vehicle-section-head"><div><h3><span><MapPin size={14} /></span>Travel log</h3><p>{vehicleJourneys.length} recorded {vehicleJourneys.length === 1 ? "journey" : "journeys"}</p></div><Button variant="outline" onClick={() => setJourneyEditor({ vehicle, initial: null })}><Plus size={13} /> Log travel</Button></div>
            {vehicleJourneys.length ? <div className="vehicle-record-list">{vehicleJourneys.map((journey) => {
              const distance = journey.odometerStart !== null && journey.odometerEnd !== null ? journey.odometerEnd - journey.odometerStart : null;
              return <div className="vehicle-record" key={journey.id}><div className="vehicle-record-main"><strong>{journey.startLocation || "Start"} → {journey.endLocation || "Destination"}</strong><span>{dateLabel(journey.date)}{journey.purpose ? ` · ${journey.purpose}` : ""}</span><small><LinkifiedText>{[distance === null ? "Distance not recorded" : `${distance.toLocaleString()} km`, journey.cost ? formatCurrency(journey.cost) : "", journey.notes].filter(Boolean).join(" · ")}</LinkifiedText></small></div><div className="table-actions"><button className="icon-button" aria-label="Edit travel log" onClick={() => setJourneyEditor({ vehicle, initial: journey })}><Pencil size={13} /></button><button className="icon-button" aria-label="Copy travel log" onClick={() => { const { id, vehicleId, ...copy } = journey; void id; onSaveJourney(copy, vehicleId); }}><Copy size={13} /></button><button className="icon-button" aria-label="Archive travel log" onClick={() => onDeleteJourney(journey)}><Archive size={13} /></button></div></div>;
            })}</div> : <p className="vehicle-empty">No travel logs yet.</p>}
          </section>
          <section className="vehicle-section"><div className="vehicle-section-head"><div><h3><span><Wrench size={14} /></span>Services & repairs</h3><p>{vehicleMaintenance.length} records · {formatCurrency(maintenanceCost)} total</p></div><Button variant="outline" onClick={() => setMaintenanceEditor({ vehicle, initial: null })}><Plus size={13} /> Add record</Button></div>
            {vehicleMaintenance.length ? <div className="vehicle-record-list">{vehicleMaintenance.map((entry) => <div className="vehicle-record" key={entry.id}><div className="vehicle-record-main"><strong>{entry.description} <Badge tone={entry.type === "Service" ? "green" : "amber"}>{entry.type}</Badge></strong><span>{dateLabel(entry.date)}{entry.odometer !== null ? ` · ${entry.odometer.toLocaleString()} km` : ""}{entry.provider ? ` · ${entry.provider}` : ""} · {formatCurrency(entry.cost)}</span><small><LinkifiedText>{[entry.nextDueDate ? `Next due ${dateLabel(entry.nextDueDate)}` : "", entry.nextDueOdometer !== null ? `${entry.nextDueOdometer.toLocaleString()} km` : "", entry.notes].filter(Boolean).join(" · ") || "No follow-up details"}</LinkifiedText></small></div><div className="table-actions"><button className="icon-button" aria-label="Edit service or repair record" onClick={() => setMaintenanceEditor({ vehicle, initial: entry })}><Pencil size={13} /></button><button className="icon-button" aria-label="Copy service or repair record" onClick={() => { const { id, vehicleId, ...copy } = entry; void id; onSaveMaintenance(copy, vehicleId); }}><Copy size={13} /></button><button className="icon-button" aria-label="Archive service or repair record" onClick={() => onDeleteMaintenance(entry)}><Archive size={13} /></button></div></div>)}</div> : <p className="vehicle-empty">No service or repair records yet.</p>}
          </section>
        </Card>;
      })}</div>}
    {vehicleEditor && <VehicleModal key={vehicleEditor.initial?.id ?? "new-vehicle"} initial={vehicleEditor.initial} onClose={() => setVehicleEditor(null)} onSave={(vehicle) => { onSaveVehicle(vehicle, vehicleEditor.initial?.id); setVehicleEditor(null); }} />}
    {journeyEditor && <VehicleJourneyModal key={journeyEditor.initial?.id ?? `new-journey-${journeyEditor.vehicle.id}`} vehicle={journeyEditor.vehicle} initial={journeyEditor.initial} onClose={() => setJourneyEditor(null)} onSave={(journey) => { onSaveJourney(journey, journeyEditor.vehicle.id, journeyEditor.initial?.id); setJourneyEditor(null); }} />}
    {maintenanceEditor && <VehicleMaintenanceModal key={maintenanceEditor.initial?.id ?? `new-maintenance-${maintenanceEditor.vehicle.id}`} vehicle={maintenanceEditor.vehicle} initial={maintenanceEditor.initial} onClose={() => setMaintenanceEditor(null)} onSave={(entry) => { onSaveMaintenance(entry, maintenanceEditor.vehicle.id, maintenanceEditor.initial?.id); setMaintenanceEditor(null); }} />}
  </>;
}

function ElectricityReadingModal({ initial, copyMode = false, readings, onClose, onSave }: {
  initial: ElectricityReading | null;
  copyMode?: boolean;
  readings: ElectricityReading[];
  onClose: () => void;
  onSave: (reading: Omit<ElectricityReading, "id">) => void;
}) {
  const [meterName, setMeterName] = useState(initial?.meterName ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [readingDate, setReadingDate] = useState(initial?.readingDate ?? today());
  const [meterReading, setMeterReading] = useState(initial ? String(initial.meterReading) : "");
  const [periodStart, setPeriodStart] = useState(initial?.periodStart ?? "");
  const [periodEnd, setPeriodEnd] = useState(initial?.periodEnd ?? "");
  const [ratePerUnit, setRatePerUnit] = useState(initial?.ratePerUnit == null ? "" : String(initial.ratePerUnit));
  const [billAmount, setBillAmount] = useState(initial?.billAmount == null ? "" : String(initial.billAmount));
  const [paid, setPaid] = useState(initial?.paid ?? false);
  const [paidDate, setPaidDate] = useState(initial?.paidDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const meterValue = Number(meterReading);
    const rateValue = ratePerUnit.trim() ? Number(ratePerUnit) : null;
    const billValue = billAmount.trim() ? Number(billAmount) : null;
    if (!meterName.trim() || !readingDate || meterReading.trim() === "" ||
      !Number.isFinite(meterValue) || meterValue < 0) {
      setError("Enter a meter name, reading date, and a non-negative meter reading.");
      return;
    }
    if (periodStart && periodEnd && periodEnd < periodStart) {
      setError("The billing period end must be on or after its start.");
      return;
    }
    if ((rateValue !== null && (!Number.isFinite(rateValue) || rateValue < 0)) ||
      (billValue !== null && (!Number.isFinite(billValue) || billValue < 0))) {
      setError("Rate per unit and bill amount must be zero or greater.");
      return;
    }
    if (paid && !paidDate) {
      setError("Enter the payment date for a paid bill.");
      return;
    }

    const normalizedName = meterName.trim().toLocaleLowerCase();
    const normalizedLocation = location.trim().toLocaleLowerCase();
    const sameMeter = readings.filter((entry) => entry.id !== initial?.id &&
      entry.meterName.trim().toLocaleLowerCase() === normalizedName &&
      entry.location.trim().toLocaleLowerCase() === normalizedLocation);
    if (sameMeter.some((entry) => entry.readingDate === readingDate)) {
      setError("This meter already has a reading for that date.");
      return;
    }
    const previous = sameMeter.filter((entry) => entry.readingDate < readingDate)
      .sort((a, b) => b.readingDate.localeCompare(a.readingDate))[0];
    const next = sameMeter.filter((entry) => entry.readingDate > readingDate)
      .sort((a, b) => a.readingDate.localeCompare(b.readingDate))[0];
    if (previous && meterValue < previous.meterReading) {
      setError(`Reading cannot be lower than the previous reading (${previous.meterReading}).`);
      return;
    }
    if (next && meterValue > next.meterReading) {
      setError(`Reading cannot be higher than the next reading (${next.meterReading}).`);
      return;
    }

    onSave({
      meterName: meterName.trim(),
      location: location.trim(),
      readingDate,
      meterReading: meterValue,
      periodStart,
      periodEnd,
      ratePerUnit: rateValue,
      billAmount: billValue,
      paid,
      paidDate: paid ? paidDate : "",
      notes: notes.trim(),
    });
  }

  return <Modal title={copyMode ? "Copy electricity reading" : initial ? "Edit electricity reading" : "Add electricity reading"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field label="Meter name"><Input autoFocus required maxLength={100} list="electricity-meter-names" placeholder="e.g. Main meter" value={meterName} onChange={(event) => setMeterName(event.target.value)} /><datalist id="electricity-meter-names">{[...new Set(readings.map((entry) => entry.meterName))].map((name) => <option key={name} value={name} />)}</datalist></Field>
      <Field label="Location"><Input maxLength={120} placeholder="Home, rental, or building" value={location} onChange={(event) => setLocation(event.target.value)} /></Field>
      <Field label="Reading date"><DateInput required value={readingDate} onValueChange={setReadingDate} /></Field>
      <Field label="Cumulative meter reading (kWh)"><Input type="number" min="0" step="any" required value={meterReading} onChange={(event) => setMeterReading(event.target.value)} /></Field>
      <Field label="Billing period start"><DateInput value={periodStart} onValueChange={setPeriodStart} /></Field>
      <Field label="Billing period end"><DateInput value={periodEnd} onValueChange={setPeriodEnd} /></Field>
      <Field label="Rate per unit"><Input type="number" min="0" step="any" placeholder="Optional" value={ratePerUnit} onChange={(event) => setRatePerUnit(event.target.value)} /></Field>
      <Field label="Bill amount"><Input type="number" min="0" step="0.01" placeholder="Optional" value={billAmount} onChange={(event) => setBillAmount(event.target.value)} /></Field>
      <Field label="Payment status"><Select value={paid ? "paid" : "unpaid"} onChange={(event) => {
        const isPaid = event.target.value === "paid";
        setPaid(isPaid);
        if (isPaid && !paidDate) setPaidDate(today());
        if (!isPaid) setPaidDate("");
      }}><option value="unpaid">Unpaid</option><option value="paid">Paid</option></Select></Field>
      <Field label="Payment date"><DateInput disabled={!paid} required={paid} value={paidDate} onValueChange={setPaidDate} /></Field>
      <Field className="full" label="Notes"><Input maxLength={1000} placeholder="Optional details" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
      <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add reading"}</Button></div>
    </form>
  </Modal>;
}

function ElectricityPage({ readings, onSave, onDelete }: {
  readings: ElectricityReading[];
  onSave: (reading: Omit<ElectricityReading, "id">, id?: string) => void;
  onDelete: (reading: ElectricityReading) => void;
}) {
  const formatCurrency = useCurrencyFormatter();
  const [editor, setEditor] = useState<ElectricityReading | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All bills");
  const query = search.trim().toLocaleLowerCase();
  const visible = readings.filter((entry) =>
    (!query || [entry.meterName, entry.location, entry.notes].some((value) => value.toLocaleLowerCase().includes(query))) &&
    (statusFilter === "All bills" || (statusFilter === "Paid" ? entry.paid : !entry.paid)));
  const meterKey = (entry: ElectricityReading) =>
    `${entry.meterName.trim().toLocaleLowerCase()}\u0000${entry.location.trim().toLocaleLowerCase()}`;
  const grouped = new Map<string, ElectricityReading[]>();
  for (const entry of visible) grouped.set(meterKey(entry), [...(grouped.get(meterKey(entry)) ?? []), entry]);

  function deleteReading(reading: ElectricityReading) {
    if (window.confirm(`Move the ${dateLabel(reading.readingDate)} reading for ${reading.meterName} to the archive?`)) onDelete(reading);
  }

  return <>
    <PageHeading eyebrow="Home utilities" title="Electricity readings" subtitle="Track multiple meters, compare usage between readings, and keep bills and payment dates together." action={<Button onClick={() => setEditor(null)}><Plus size={15} /> Add reading</Button>} />
    <div className="electricity-summary">
      <Card><span>Meters</span><strong>{new Set(readings.map(meterKey)).size}</strong></Card>
      <Card><span>Readings</span><strong>{readings.length}</strong></Card>
      <Card><span>Unpaid bills</span><strong>{formatCurrency(readings.filter((entry) => !entry.paid).reduce((sum, entry) => sum + (entry.billAmount ?? 0), 0))}</strong></Card>
    </div>
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search electricity meters" placeholder="Search meter, location, notes..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select aria-label="Filter electricity bills" style={{ width: 150 }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All bills</option><option>Unpaid</option><option>Paid</option></Select><Badge>{visible.length} {visible.length === 1 ? "reading" : "readings"}</Badge></div>
    {grouped.size ? <div className="electricity-list">{[...grouped.entries()].sort((a, b) => a[1][0].meterName.localeCompare(b[1][0].meterName)).map(([key, entries]) => {
      const sorted = [...entries].sort((a, b) => a.readingDate.localeCompare(b.readingDate));
      const allForMeter = readings.filter((entry) => meterKey(entry) === key).sort((a, b) => a.readingDate.localeCompare(b.readingDate));
      const latest = allForMeter[allForMeter.length - 1];
      return <Card className="electricity-card" key={key}>
        <div className="vehicle-card-head"><div className="vehicle-heading"><div className="electricity-icon"><Zap size={17} /></div><div><h2 className="section-title">{latest.meterName}</h2><p className="section-description">{latest.location || "Location not specified"}</p></div></div><div className="electricity-meter-latest"><span>Latest reading</span><strong>{latest.meterReading.toLocaleString()} kWh</strong></div></div>
        <div className="electricity-record-list">{[...sorted].reverse().map((entry) => {
          const index = allForMeter.findIndex((candidate) => candidate.id === entry.id);
          const previous = index > 0 ? allForMeter[index - 1] : null;
          const used = previous ? entry.meterReading - previous.meterReading : null;
          const period = [entry.periodStart ? dateLabel(entry.periodStart) : "", entry.periodEnd ? dateLabel(entry.periodEnd) : ""].filter(Boolean).join(" – ");
          return <div className="electricity-record" key={entry.id}>
            <div className="electricity-record-main">
              <strong>{dateLabel(entry.readingDate)} <Badge tone={entry.paid ? "green" : "amber"}>{entry.paid ? "Paid" : "Unpaid"}</Badge></strong>
              <span>{entry.meterReading.toLocaleString()} kWh{used !== null ? ` · ${used.toLocaleString()} kWh used since previous reading` : " · First recorded reading"}{entry.billAmount !== null ? ` · Bill ${formatCurrency(entry.billAmount)}` : ""}</span>
              <small><LinkifiedText>{[period ? `Period ${period}` : "", entry.ratePerUnit !== null ? `${formatCurrency(entry.ratePerUnit)} / unit` : "", entry.paidDate ? `Paid ${dateLabel(entry.paidDate)}` : "", entry.notes].filter(Boolean).join(" · ") || "No billing details"}</LinkifiedText></small>
            </div>
            <div className="table-actions"><button className="icon-button" aria-label={`Edit ${entry.meterName} reading on ${entry.readingDate}`} onClick={() => setEditor(entry)}><Pencil size={13} /></button><button className="icon-button" aria-label={`Copy ${entry.meterName} reading on ${entry.readingDate}`} title="Copy as a new reading; choose a different date" onClick={() => setEditor({ ...entry, id: "" })}><Copy size={13} /></button><button className="icon-button" aria-label={`Archive ${entry.meterName} reading on ${entry.readingDate}`} onClick={() => deleteReading(entry)}><Archive size={13} /></button></div>
          </div>;
        })}</div>
      </Card>;
    })}</div> : <Card><EmptyState icon={<Zap size={18} />} title={readings.length ? "No matching electricity readings" : "No electricity readings yet"} description={readings.length ? "Try another search or bill filter." : "Add a meter reading to start tracking usage and bills."} /></Card>}
    {editor !== undefined && <ElectricityReadingModal key={editor?.id ?? "new-electricity-reading"} initial={editor} copyMode={editor?.id === ""} readings={readings} onClose={() => setEditor(undefined)} onSave={(reading) => { onSave(reading, editor?.id || undefined); setEditor(undefined); }} />}
  </>;
}

function SubscriptionAccountModal({ initial, onClose, onSave }: {
  initial: SubscriptionAccount | null;
  onClose: () => void;
  onSave: (account: Omit<SubscriptionAccount, "id" | "transactions">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<SubscriptionCategory>(initial?.category ?? "Other");
  const [provider, setProvider] = useState(initial?.provider ?? "");
  const [billingType, setBillingType] = useState<SubscriptionBillingType>(initial?.billingType ?? "Recurring");
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "INR");
  const [accountReference, setAccountReference] = useState(initial?.accountReference ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), category, provider: provider.trim(), billingType, currency, accountReference: accountReference.trim(), notes: notes.trim() });
  }

  return <Modal title={initial ? "Edit service" : "Add subscription or bill"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field label="Name"><Input autoFocus required maxLength={120} placeholder="e.g. Home electricity or Netflix" value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Category"><Select value={category} onChange={(event) => setCategory(event.target.value as SubscriptionCategory)}>{(["Mobile", "Electricity", "Gas", "Internet", "Streaming", "Tickets", "Other"] as SubscriptionCategory[]).map((value) => <option key={value}>{value}</option>)}</Select></Field>
      <Field label="Provider"><Input maxLength={120} placeholder="Optional company or provider" value={provider} onChange={(event) => setProvider(event.target.value)} /></Field>
      <Field label="Billing type"><Select value={billingType} onChange={(event) => setBillingType(event.target.value as SubscriptionBillingType)}>{(["Prepaid", "Postpaid", "Recurring", "One-time"] as SubscriptionBillingType[]).map((value) => <option key={value}>{value}</option>)}</Select></Field>
      <Field label="Currency"><Select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>{CURRENCIES.map((value) => <option key={value}>{value}</option>)}</Select></Field>
      <Field label="Account, phone, or booking reference"><Input maxLength={160} placeholder="Optional reference" value={accountReference} onChange={(event) => setAccountReference(event.target.value)} /></Field>
      <Field className="full" label="Notes"><Input maxLength={2000} placeholder="Optional account details" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
    </div><div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add service"}</Button></div></form>
  </Modal>;
}

function SubscriptionTransactionModal({ initial, currency, onClose, onSave }: {
  initial: SubscriptionTransaction | null;
  currency: Currency;
  onClose: () => void;
  onSave: (transaction: Omit<SubscriptionTransaction, "id">) => void;
}) {
  const [type, setType] = useState<SubscriptionTransactionType>(initial?.type ?? "Other");
  const [transactionDate, setTransactionDate] = useState(initial?.transactionDate ?? today());
  const [periodStart, setPeriodStart] = useState(initial?.periodStart ?? "");
  const [periodEnd, setPeriodEnd] = useState(initial?.periodEnd ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [amount, setAmount] = useState(initial?.amount == null ? "" : String(initial.amount));
  const [paid, setPaid] = useState(initial?.paid ?? false);
  const [paymentDate, setPaymentDate] = useState(initial?.paymentDate ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const amountValue = amount.trim() ? Number(amount) : null;
    if (!transactionDate) {
      setError("Enter the booking, bill, or transaction date.");
      return;
    }
    if (periodStart && periodEnd && periodEnd < periodStart) {
      setError("The period end must be on or after the period start.");
      return;
    }
    if (amountValue !== null && (!Number.isFinite(amountValue) || amountValue < 0)) {
      setError("Amount must be zero or greater.");
      return;
    }
    if (paid && !paymentDate) {
      setError("Enter the payment date for a paid transaction.");
      return;
    }
    onSave({ type, transactionDate, periodStart, periodEnd, dueDate, amount: amountValue, paid, paymentDate: paid ? paymentDate : "", reference: reference.trim(), notes: notes.trim() });
  }

  return <Modal title={initial ? "Edit transaction" : "Add transaction"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field label="Transaction type"><Select value={type} onChange={(event) => setType(event.target.value as SubscriptionTransactionType)}>{(["Recharge", "Bill", "Booking", "Renewal", "Other"] as SubscriptionTransactionType[]).map((value) => <option key={value}>{value}</option>)}</Select></Field>
      <Field label="Booking, bill, or transaction date"><DateInput required value={transactionDate} onValueChange={setTransactionDate} /></Field>
      <Field label="Coverage or service starts"><DateInput value={periodStart} onValueChange={setPeriodStart} /></Field>
      <Field label="Coverage or service ends / renews"><DateInput value={periodEnd} onValueChange={setPeriodEnd} /></Field>
      <Field label="Due or reminder date"><DateInput value={dueDate} onValueChange={setDueDate} /></Field>
      <Field label={`Amount (${currency})`}><Input inputMode="decimal" placeholder="Optional" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
      <Field label="Payment status"><Select value={paid ? "paid" : "pending"} onChange={(event) => {
        const isPaid = event.target.value === "paid";
        setPaid(isPaid);
        if (isPaid && !paymentDate) setPaymentDate(today());
        if (!isPaid) setPaymentDate("");
      }}><option value="pending">Pending</option><option value="paid">Paid</option></Select></Field>
      <Field label="Payment date"><DateInput disabled={!paid} required={paid} value={paymentDate} onValueChange={setPaymentDate} /></Field>
      <Field label="Receipt or booking reference"><Input maxLength={160} placeholder="Optional reference" value={reference} onChange={(event) => setReference(event.target.value)} /></Field>
      <Field className="full" label="Notes"><Input maxLength={2000} placeholder="Optional details" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
      <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add transaction"}</Button></div>
    </form>
  </Modal>;
}

function SubscriptionsPage({ accounts, onSaveAccount, onArchiveAccount, onSaveTransaction, onArchiveTransaction }: {
  accounts: SubscriptionAccount[];
  onSaveAccount: (account: Omit<SubscriptionAccount, "id" | "transactions">, id?: string) => void;
  onArchiveAccount: (account: SubscriptionAccount) => void;
  onSaveTransaction: (accountId: string, transaction: Omit<SubscriptionTransaction, "id">, id?: string) => void;
  onArchiveTransaction: (accountId: string, transaction: SubscriptionTransaction) => void;
}) {
  const [accountEditor, setAccountEditor] = useState<SubscriptionAccount | null | undefined>(undefined);
  const [transactionEditor, setTransactionEditor] = useState<{ account: SubscriptionAccount; transaction: SubscriptionTransaction | null } | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [statusFilter, setStatusFilter] = useState("All records");
  const query = search.trim().toLocaleLowerCase();
  const currentDate = today();
  const upcomingDate = dateAfterDays(30);
  const transactions = accounts.flatMap((account) => account.transactions.map((transaction) => ({ account, transaction })));
  const pending = transactions.filter(({ transaction }) => !transaction.paid);
  const overdue = pending.filter(({ transaction }) => transaction.dueDate && transaction.dueDate < currentDate);
  const dueSoon = pending.filter(({ transaction }) => transaction.dueDate && transaction.dueDate >= currentDate && transaction.dueDate <= upcomingDate);
  const visible = accounts.filter((account) => {
    const matchesText = !query || [account.name, account.category, account.provider, account.accountReference, account.notes,
      ...account.transactions.flatMap((entry) => [entry.type, entry.reference, entry.notes])]
      .some((value) => value.toLocaleLowerCase().includes(query));
    const matchesCategory = categoryFilter === "All categories" || account.category === categoryFilter;
    const matchesStatus = statusFilter === "All records" || account.transactions.some((entry) => {
      if (statusFilter === "Paid") return entry.paid;
      if (statusFilter === "Pending") return !entry.paid;
      if (statusFilter === "Overdue") return !entry.paid && Boolean(entry.dueDate) && entry.dueDate < currentDate;
      return !entry.paid && Boolean(entry.dueDate) && entry.dueDate >= currentDate && entry.dueDate <= upcomingDate;
    });
    return matchesText && matchesCategory && matchesStatus;
  }).sort((a, b) => a.name.localeCompare(b.name));

  function archiveAccount(account: SubscriptionAccount) {
    if (window.confirm(`Move "${account.name}" and its transaction history to the archive?`)) onArchiveAccount(account);
  }
  function archiveTransaction(account: SubscriptionAccount, transaction: SubscriptionTransaction) {
    if (window.confirm(`Move this ${transaction.type.toLocaleLowerCase()} dated ${dateLabel(transaction.transactionDate)} for "${account.name}" to the archive?`)) onArchiveTransaction(account.id, transaction);
  }

  return <>
    <PageHeading eyebrow="Recurring services & payments" title="Subscriptions & bills" subtitle="Keep mobile recharges, household bills, memberships, bookings, and renewals together with their dates and payment history." action={<Button onClick={() => setAccountEditor(null)}><Plus size={15} /> Add service</Button>} />
    <div className="electricity-summary">
      <Card><span>Services</span><strong>{accounts.length}</strong></Card>
      <Card><span>Pending transactions</span><strong>{pending.length}</strong></Card>
      <Card><span>Overdue</span><strong>{overdue.length}</strong></Card>
      <Card><span>Due in 30 days</span><strong>{dueSoon.length}</strong></Card>
    </div>
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search subscriptions and bills" placeholder="Search service, provider, or reference..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select aria-label="Filter by service category" style={{ width: 160 }} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>All categories</option>{(["Mobile", "Electricity", "Gas", "Internet", "Streaming", "Tickets", "Other"] as SubscriptionCategory[]).map((value) => <option key={value}>{value}</option>)}</Select><Select aria-label="Filter by payment status" style={{ width: 150 }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All records</option><option>Pending</option><option>Overdue</option><option>Due soon</option><option>Paid</option></Select><Badge>{visible.length} {visible.length === 1 ? "service" : "services"}</Badge></div>
    {visible.length ? <div className="electricity-list">{visible.map((account) => {
      const sorted = [...account.transactions].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
      const nextDue = account.transactions.filter((entry) => !entry.paid && entry.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
      return <Card className="electricity-card" key={account.id}>
        <div className="vehicle-card-head"><div className="vehicle-heading"><div className="electricity-icon"><CalendarDays size={17} /></div><div><h2 className="section-title">{account.name}</h2><p className="section-description">{[account.category, account.provider, account.billingType, account.accountReference].filter(Boolean).join(" · ")}</p></div></div>        <div className="table-actions"><Button variant="outline" onClick={() => setTransactionEditor({ account, transaction: null })}><Plus size={13} /> Transaction</Button><button className="icon-button" aria-label={`Edit ${account.name}`} onClick={() => setAccountEditor(account)}><Pencil size={13} /></button><button className="icon-button" aria-label={`Copy ${account.name} as a new service`} title="Copy service without transaction history" onClick={() => onSaveAccount({ name: copyLabel(account.name, 120), category: account.category, provider: account.provider, billingType: account.billingType, currency: account.currency, accountReference: account.accountReference, notes: account.notes })}><Copy size={13} /></button><button className="icon-button" aria-label={`Archive ${account.name}`} onClick={() => archiveAccount(account)}><Archive size={13} /></button></div></div>
        <div className="electricity-meter-latest"><span>{nextDue ? `${nextDue.dueDate < currentDate ? "Overdue since" : "Next due"} · ${dateLabel(nextDue.dueDate)}` : "Next due"}{account.notes ? ` · ${account.notes}` : ""}</span></div>
        {sorted.length ? <div className="electricity-record-list">{sorted.map((entry) => {
          const period = [entry.periodStart ? dateLabel(entry.periodStart) : "", entry.periodEnd ? dateLabel(entry.periodEnd) : ""].filter(Boolean).join(" – ");
          const isOverdue = !entry.paid && Boolean(entry.dueDate) && entry.dueDate < currentDate;
          return <div className="electricity-record" key={entry.id}>
            <div className="electricity-record-main">
              <strong>{entry.type} · {dateLabel(entry.transactionDate)} <Badge tone={entry.paid ? "green" : isOverdue ? "amber" : "blue"}>{entry.paid ? "Paid" : isOverdue ? "Overdue" : "Pending"}</Badge></strong>
              <span>{entry.amount !== null ? formatMoney(entry.amount, account.currency) : "Amount not recorded"}{entry.dueDate ? ` · Due ${dateLabel(entry.dueDate)}` : ""}{period ? ` · Period ${period}` : ""}</span>
              <small><LinkifiedText>{[entry.paymentDate ? `Paid ${dateLabel(entry.paymentDate)}` : "", entry.reference, entry.notes].filter(Boolean).join(" · ") || "No additional details"}</LinkifiedText></small></div>
            <div className="table-actions"><button className="icon-button" aria-label={`Edit ${entry.type} for ${account.name}`} onClick={() => setTransactionEditor({ account, transaction: entry })}><Pencil size={13} /></button><button className="icon-button" aria-label={`Copy ${entry.type} for ${account.name}`} onClick={() => { const { id, ...copy } = entry; void id; onSaveTransaction(account.id, copy); }}><Copy size={13} /></button><button className="icon-button" aria-label={`Archive ${entry.type} for ${account.name}`} onClick={() => archiveTransaction(account, entry)}><Archive size={13} /></button></div>
          </div>;
        })}</div> : <p className="vehicle-empty">No transactions recorded yet.</p>}
      </Card>;
    })}</div> : <Card><EmptyState icon={<CalendarDays size={18} />} title={accounts.length ? "No matching services or bills" : "No subscriptions or bills yet"} description={accounts.length ? "Try another search or filter." : "Add a service first, then record its bills, recharges, bookings, and renewal dates."} /></Card>}
    {accountEditor !== undefined && <SubscriptionAccountModal key={accountEditor?.id ?? "new-subscription"} initial={accountEditor} onClose={() => setAccountEditor(undefined)} onSave={(account) => { onSaveAccount(account, accountEditor?.id); setAccountEditor(undefined); }} />}
    {transactionEditor && <SubscriptionTransactionModal key={transactionEditor.transaction?.id ?? `new-transaction-${transactionEditor.account.id}`} initial={transactionEditor.transaction} currency={transactionEditor.account.currency} onClose={() => setTransactionEditor(null)} onSave={(transaction) => { onSaveTransaction(transactionEditor.account.id, transaction, transactionEditor.transaction?.id); setTransactionEditor(null); }} />}
  </>;
}

function DevotionalEntryModal({ initial, onClose, onSave }: {
  initial: DevotionalEntry | null;
  onClose: () => void;
  onSave: (entry: Omit<DevotionalEntry, "id">) => void;
}) {
  const [date, setDate] = useState(initial?.date ?? today());
  const [scriptureReference, setScriptureReference] = useState(initial?.scriptureReference ?? "");
  const [takeaway, setTakeaway] = useState(initial?.takeaway ?? "");
  const [reflection, setReflection] = useState(initial?.reflection ?? "");
  const [prayerNotes, setPrayerNotes] = useState(initial?.prayerNotes ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!date || !scriptureReference.trim()) {
      setError("Enter a date and a Bible passage reference.");
      return;
    }
    onSave({ date, scriptureReference: scriptureReference.trim(), takeaway: takeaway.trim(), reflection: reflection.trim(), prayerNotes: prayerNotes.trim() });
  }

  return <Modal title={initial ? "Edit devotional entry" : "Add devotional entry"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field label="Date"><DateInput autoFocus required value={date} onValueChange={setDate} /></Field>
      <Field label="Bible passage reference"><Input required maxLength={120} placeholder="e.g. Psalm 23:1–6" value={scriptureReference} onChange={(event) => setScriptureReference(event.target.value)} /></Field>
      <Field className="full" label="Message or takeaway"><textarea className="field textarea" rows={2} maxLength={2000} placeholder="What stood out in this passage?" value={takeaway} onChange={(event) => setTakeaway(event.target.value)} /></Field>
      <Field className="full" label="Personal reflection"><textarea className="field textarea" rows={3} maxLength={4000} placeholder="Record your thoughts, questions, or how you want to apply it." value={reflection} onChange={(event) => setReflection(event.target.value)} /></Field>
      <Field className="full" label="Prayer notes"><textarea className="field textarea" rows={2} maxLength={2000} placeholder="Optional prayer inspired by this reading" value={prayerNotes} onChange={(event) => setPrayerNotes(event.target.value)} /></Field>
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
      <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add entry"}</Button></div>
    </form>
  </Modal>;
}

function PrayerRequestModal({ initial, onClose, onSave }: {
  initial: PrayerRequest | null;
  onClose: () => void;
  onSave: (request: Omit<PrayerRequest, "id">) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [details, setDetails] = useState(initial?.details ?? "");
  const [dateAdded, setDateAdded] = useState(initial?.dateAdded ?? today());
  const [status, setStatus] = useState<PrayerRequestStatus>(initial?.status ?? "Ongoing");
  const [answeredDate, setAnsweredDate] = useState(initial?.answeredDate ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !dateAdded) {
      setError("Enter a prayer request and the date you added it.");
      return;
    }
    if (status === "Answered" && !answeredDate) {
      setError("Enter the date this prayer was answered.");
      return;
    }
    if (status === "Answered" && answeredDate < dateAdded) {
      setError("The answered date cannot be before the request date.");
      return;
    }
    onSave({ title: title.trim(), details: details.trim(), dateAdded, status, answeredDate: status === "Answered" ? answeredDate : "" });
  }

  return <Modal title={initial ? "Edit prayer request" : "Add prayer request"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field className="full" label="Prayer request"><Input autoFocus required maxLength={160} placeholder="A short title for this prayer" value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field label="Date added"><DateInput required value={dateAdded} onValueChange={setDateAdded} /></Field>
      <Field label="Status"><Select value={status} onChange={(event) => {
        const nextStatus = event.target.value as PrayerRequestStatus;
        setStatus(nextStatus);
        if (nextStatus === "Answered" && !answeredDate) setAnsweredDate(today());
        if (nextStatus === "Ongoing") setAnsweredDate("");
      }}><option>Ongoing</option><option>Answered</option></Select></Field>
      {status === "Answered" && <Field label="Answered date"><DateInput required value={answeredDate} onValueChange={setAnsweredDate} /></Field>}
      <Field className="full" label="Details"><textarea className="field textarea" rows={3} maxLength={3000} placeholder="Optional context or updates" value={details} onChange={(event) => setDetails(event.target.value)} /></Field>
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
      <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add request"}</Button></div>
    </form>
  </Modal>;
}

function DevotionalResourceModal({ initial, onClose, onSave }: {
  initial: DevotionalResource | null;
  onClose: () => void;
  onSave: (resource: Omit<DevotionalResource, "id">) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [source, setSource] = useState(initial?.source ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedLink = link.trim();
    try {
      if (new URL(normalizedLink).protocol !== "https:") throw new Error();
    } catch {
      setError("Enter a valid HTTPS link.");
      return;
    }
    if (!title.trim()) {
      setError("Enter a title for this resource.");
      return;
    }
    onSave({ title: title.trim(), link: normalizedLink, description: description.trim(), source: source.trim() });
  }

  return <Modal title={initial ? "Edit devotional resource" : "Add devotional resource"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field className="full" label="Title"><Input autoFocus required maxLength={160} placeholder="Song, sermon, video, audio, Scripture study..." value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field className="full" label="Link (HTTPS)"><Input type="url" required maxLength={2048} placeholder="https://..." value={link} onChange={(event) => setLink(event.target.value)} /></Field>
      <Field className="full" label="Description"><textarea className="field textarea" rows={3} maxLength={2000} placeholder="What is this resource or why did you save it?" value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      <Field label="Source (optional)"><Input maxLength={120} placeholder="Church, artist, channel, website..." value={source} onChange={(event) => setSource(event.target.value)} /></Field>
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
      <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Save resource"}</Button></div>
    </form>
  </Modal>;
}

function DevotionalPage({ entries, resources, requests, onSaveEntry, onDeleteEntry, onSaveResource, onDeleteResource, onSaveRequest, onDeleteRequest }: {
  entries: DevotionalEntry[];
  resources: DevotionalResource[];
  requests: PrayerRequest[];
  onSaveEntry: (entry: Omit<DevotionalEntry, "id">, id?: string) => void;
  onDeleteEntry: (entry: DevotionalEntry) => void;
  onSaveResource: (resource: Omit<DevotionalResource, "id">, id?: string) => void;
  onDeleteResource: (resource: DevotionalResource) => void;
  onSaveRequest: (request: Omit<PrayerRequest, "id">, id?: string) => void;
  onDeleteRequest: (request: PrayerRequest) => void;
}) {
  const [entryEditor, setEntryEditor] = useState<DevotionalEntry | null | undefined>(undefined);
  const [resourceEditor, setResourceEditor] = useState<DevotionalResource | null | undefined>(undefined);
  const [requestEditor, setRequestEditor] = useState<PrayerRequest | null | undefined>(undefined);
  const [requestFilter, setRequestFilter] = useState("Ongoing");
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const visibleEntries = [...entries].filter((entry) =>
    !query || [entry.scriptureReference, entry.takeaway, entry.reflection, entry.prayerNotes].some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const visibleRequests = [...requests].filter((request) =>
    (requestFilter === "All requests" || request.status === requestFilter) &&
    (!query || [request.title, request.details].some((value) => value.toLocaleLowerCase().includes(query))))
    .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
  const visibleResources = [...resources].filter((resource) =>
    !query || [resource.title, resource.link, resource.description, resource.source].some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((a, b) => a.title.localeCompare(b.title));
  const ongoingCount = requests.filter((request) => request.status === "Ongoing").length;
  const answeredCount = requests.filter((request) => request.status === "Answered").length;

  function confirmDeleteEntry(entry: DevotionalEntry) {
    if (window.confirm(`Move the devotional entry for ${entry.scriptureReference} to the archive?`)) onDeleteEntry(entry);
  }
  function confirmDeleteRequest(request: PrayerRequest) {
    if (window.confirm(`Move the prayer request "${request.title}" to the archive?`)) onDeleteRequest(request);
  }
  function confirmDeleteResource(resource: DevotionalResource) {
    if (window.confirm(`Move "${resource.title}" to the archive?`)) onDeleteResource(resource);
  }

  return <>
    <PageHeading eyebrow="Christian faith" title="Devotional" subtitle="Keep Scripture reflections and prayer requests together in your personal faith journal." action={<Button onClick={() => setEntryEditor(null)}><Plus size={15} /> Add Bible reflection</Button>} />
    <div className="alert"><BookOpen size={15} style={{ flex: "none", marginTop: 1 }} /><span>Record Bible references and your own reflections, not full copyrighted passage text. Devotional notes and prayer requests are private shared Daybook data.</span></div>
    <div className="devotional-summary">
      <Card><span>Bible reflections</span><strong>{entries.length}</strong></Card>
      <Card><span>Ongoing prayers</span><strong>{ongoingCount}</strong></Card>
      <Card><span>Answered prayers</span><strong>{answeredCount}</strong></Card>
    </div>
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search devotional journal" placeholder="Search Scripture, reflections, prayers, resources..." value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
    <div className="devotional-columns">
      <section className="devotional-section"><div className="devotional-section-head"><div><h2><BookOpen size={15} /> Bible reflections</h2><p>{visibleEntries.length} {visibleEntries.length === 1 ? "entry" : "entries"}</p></div><Button variant="outline" onClick={() => setEntryEditor(null)}><Plus size={13} /> Add entry</Button></div>
        {visibleEntries.length ? <div className="devotional-list">{visibleEntries.map((entry) => <Card className="devotional-card" key={entry.id}>
          <div className="devotional-card-head"><div><span className="devotional-date">{dateLabel(entry.date)}</span><h3>{entry.scriptureReference}</h3></div><div className="table-actions"><button className="icon-button" aria-label={`Edit ${entry.scriptureReference}`} onClick={() => setEntryEditor(entry)}><Pencil size={13} /></button><button className="icon-button" aria-label={`Copy ${entry.scriptureReference}`} onClick={() => { const { id, ...copy } = entry; void id; onSaveEntry(copy); }}><Copy size={13} /></button><button className="icon-button" aria-label={`Archive ${entry.scriptureReference}`} onClick={() => confirmDeleteEntry(entry)}><Archive size={13} /></button></div></div>
          {entry.takeaway && <p><strong>Message:</strong> <LinkifiedText>{entry.takeaway}</LinkifiedText></p>}{entry.reflection && <p><strong>Reflection:</strong> <LinkifiedText>{entry.reflection}</LinkifiedText></p>}{entry.prayerNotes && <p><strong>Prayer:</strong> <LinkifiedText>{entry.prayerNotes}</LinkifiedText></p>}
        </Card>)}</div> : <Card><EmptyState icon={<BookOpen size={18} />} title={entries.length ? "No matching reflections" : "No Bible reflections yet"} description={entries.length ? "Try another search." : "Save a Scripture reference and your thoughts about it."} /></Card>}
      </section>
      <section className="devotional-section"><div className="devotional-section-head"><div><h2><Heart size={15} /> Prayer requests</h2><p>{ongoingCount} ongoing · {answeredCount} answered</p></div><Button variant="outline" onClick={() => setRequestEditor(null)}><Plus size={13} /> Add request</Button></div>
        <Select aria-label="Filter prayer requests" value={requestFilter} onChange={(event) => setRequestFilter(event.target.value)}><option>Ongoing</option><option>Answered</option><option>All requests</option></Select>
        {visibleRequests.length ? <div className="devotional-list">{visibleRequests.map((request) => <Card className="devotional-card" key={request.id}>
          <div className="devotional-card-head"><div><Badge tone={request.status === "Answered" ? "green" : "amber"}>{request.status}</Badge><h3>{request.title}</h3><span className="devotional-date">Added {dateLabel(request.dateAdded)}{request.answeredDate ? ` · Answered ${dateLabel(request.answeredDate)}` : ""}</span></div><div className="table-actions"><button className="icon-button" aria-label={`Edit prayer request: ${request.title}`} onClick={() => setRequestEditor(request)}><Pencil size={13} /></button><button className="icon-button" aria-label={`Copy prayer request: ${request.title}`} onClick={() => { const { id, ...copy } = request; void id; onSaveRequest(copy); }}><Copy size={13} /></button><button className="icon-button" aria-label={`Archive prayer request: ${request.title}`} onClick={() => confirmDeleteRequest(request)}><Archive size={13} /></button></div></div>
          {request.details && <p><LinkifiedText>{request.details}</LinkifiedText></p>}
          <Button size="sm" variant="outline" onClick={() => onSaveRequest({
            ...request,
            status: request.status === "Ongoing" ? "Answered" : "Ongoing",
            answeredDate: request.status === "Ongoing" ? (today() < request.dateAdded ? request.dateAdded : today()) : "",
          }, request.id)}>{request.status === "Ongoing" ? "Mark answered" : "Reopen request"}</Button>
        </Card>)}</div> : <Card><EmptyState icon={<Heart size={18} />} title={requests.length ? "No matching prayer requests" : "No prayer requests yet"} description={requests.length ? "Try another search or status filter." : "Add a request to keep it in your prayer list."} /></Card>}
      </section>
    </div>
    <section className="devotional-resource-section"><div className="devotional-section-head"><div><h2><PlayCircle size={15} /> Music, media & other resources</h2><p>{visibleResources.length} {visibleResources.length === 1 ? "resource" : "resources"} · audio, video, songs, sermons, Scripture study, and more</p></div><Button variant="outline" onClick={() => setResourceEditor(null)}><Plus size={13} /> Add resource</Button></div>
      {visibleResources.length ? <div className="devotional-resource-list">{visibleResources.map((resource) => <Card className="devotional-resource-card" key={resource.id}>
        <div className="devotional-card-head"><div><h3>{resource.title}</h3>{resource.source && <span className="devotional-date">Source: {resource.source}</span>}</div><div className="table-actions"><button className="icon-button" aria-label={`Edit ${resource.title}`} onClick={() => setResourceEditor(resource)}><Pencil size={13} /></button><button className="icon-button" aria-label={`Copy ${resource.title}`} onClick={() => onSaveResource({ ...resource, title: `${resource.title.slice(0, 153)} (copy)` })}><Copy size={13} /></button><button className="icon-button" aria-label={`Archive ${resource.title}`} onClick={() => confirmDeleteResource(resource)}><Archive size={13} /></button></div></div>
        {resource.description && <p><LinkifiedText>{resource.description}</LinkifiedText></p>}
        <a className="devotional-resource-link" href={resource.link} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> Open resource in new tab</a>
      </Card>)}</div> : <Card><EmptyState icon={<PlayCircle size={18} />} title={resources.length ? "No matching resources" : "No saved resources yet"} description={resources.length ? "Try another search." : "Save a link to a song, video, sermon, audio, or any other faith resource."} /></Card>}
    </section>
    {entryEditor !== undefined && <DevotionalEntryModal key={entryEditor?.id ?? "new-devotional"} initial={entryEditor} onClose={() => setEntryEditor(undefined)} onSave={(entry) => { onSaveEntry(entry, entryEditor?.id); setEntryEditor(undefined); }} />}
    {resourceEditor !== undefined && <DevotionalResourceModal key={resourceEditor?.id ?? "new-devotional-resource"} initial={resourceEditor} onClose={() => setResourceEditor(undefined)} onSave={(resource) => { onSaveResource(resource, resourceEditor?.id); setResourceEditor(undefined); }} />}
    {requestEditor !== undefined && <PrayerRequestModal key={requestEditor?.id ?? "new-prayer-request"} initial={requestEditor} onClose={() => setRequestEditor(undefined)} onSave={(request) => { onSaveRequest(request, requestEditor?.id); setRequestEditor(undefined); }} />}
  </>;
}

function CookingRecipeModal({ initial, onClose, onSave }: {
  initial: CookingRecipe | null;
  onClose: () => void;
  onSave: (recipe: Omit<CookingRecipe, "id">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [dishType, setDishType] = useState(initial?.dishType ?? "");
  const [cuisine, setCuisine] = useState(initial?.cuisine ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [ingredients, setIngredients] = useState(initial?.ingredients ?? "");
  const [steps, setSteps] = useState(initial?.steps ?? "");
  const [servings, setServings] = useState(initial?.servings?.toString() ?? "");
  const [prepMinutes, setPrepMinutes] = useState(initial?.prepMinutes?.toString() ?? "");
  const [cookMinutes, setCookMinutes] = useState(initial?.cookMinutes?.toString() ?? "");
  const [nutritionNotes, setNutritionNotes] = useState(initial?.nutritionNotes ?? "");
  const [healthNotes, setHealthNotes] = useState(initial?.healthNotes ?? "");
  const [dietaryTags, setDietaryTags] = useState(initial?.dietaryTags.join(", ") ?? "");
  const [allergens, setAllergens] = useState(initial?.allergens.join(", ") ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function optionalInteger(value: string) {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedType = dishType.trim();
    const parsedServings = optionalInteger(servings);
    const parsedPrep = optionalInteger(prepMinutes);
    const parsedCook = optionalInteger(cookMinutes);
    if (!normalizedName || !normalizedType) {
      setError("Enter a recipe or item name and its type.");
      return;
    }
    if ((servings && (parsedServings === null || parsedServings < 1)) ||
      (prepMinutes && (parsedPrep === null || parsedPrep < 0)) ||
      (cookMinutes && (parsedCook === null || parsedCook < 0))) {
      setError("Servings must be a positive whole number; preparation and cooking times must be zero or more whole minutes.");
      return;
    }
    onSave({
      name: normalizedName,
      dishType: normalizedType,
      cuisine: cuisine.trim(),
      country: country.trim(),
      ingredients: ingredients.trim(),
      steps: steps.trim(),
      servings: parsedServings,
      prepMinutes: parsedPrep,
      cookMinutes: parsedCook,
      nutritionNotes: nutritionNotes.trim(),
      healthNotes: healthNotes.trim(),
      dietaryTags: dietaryTags.split(",").map((tag) => tag.trim()).filter(Boolean),
      allergens: allergens.split(",").map((allergen) => allergen.trim()).filter(Boolean),
      notes: notes.trim(),
    });
  }

  return <Modal title={initial ? "Edit recipe or prepared item" : "Add recipe or prepared item"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field label="Name"><Input autoFocus required maxLength={120} placeholder="e.g. Spinach curry or mango juice" value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Type"><Input required maxLength={80} placeholder="Curry, drink, juice, snack..." value={dishType} onChange={(event) => setDishType(event.target.value)} /></Field>
      <Field label="Cuisine"><Input maxLength={80} placeholder="e.g. Andhra, Mediterranean" value={cuisine} onChange={(event) => setCuisine(event.target.value)} /></Field>
      <Field label="Country / origin"><Input maxLength={80} placeholder="e.g. India" value={country} onChange={(event) => setCountry(event.target.value)} /></Field>
      <Field className="full" label="Ingredients and quantities"><textarea className="field textarea" rows={4} maxLength={5000} placeholder={"One ingredient per line, with quantities"} value={ingredients} onChange={(event) => setIngredients(event.target.value)} /></Field>
      <Field className="full" label="Preparation steps"><textarea className="field textarea" rows={4} maxLength={8000} placeholder={"Add each cooking step on a new line"} value={steps} onChange={(event) => setSteps(event.target.value)} /></Field>
      <Field label="Servings"><Input type="number" min="1" step="1" value={servings} onChange={(event) => setServings(event.target.value)} /></Field>
      <Field label="Preparation time (minutes)"><Input type="number" min="0" step="1" value={prepMinutes} onChange={(event) => setPrepMinutes(event.target.value)} /></Field>
      <Field label="Cooking time (minutes)"><Input type="number" min="0" step="1" value={cookMinutes} onChange={(event) => setCookMinutes(event.target.value)} /></Field>
      <Field label="Dietary tags (comma-separated)"><Input maxLength={300} placeholder="Vegetarian, dairy-free" value={dietaryTags} onChange={(event) => setDietaryTags(event.target.value)} /></Field>
      <Field label="Allergens (comma-separated)"><Input maxLength={300} placeholder="Peanuts, milk" value={allergens} onChange={(event) => setAllergens(event.target.value)} /></Field>
      <Field className="full" label="Nutrition / vitamins (your notes)"><textarea className="field textarea" rows={2} maxLength={2000} placeholder="Optional notes or estimates you entered" value={nutritionNotes} onChange={(event) => setNutritionNotes(event.target.value)} /></Field>
      <Field className="full" label="Health benefits (your notes)"><textarea className="field textarea" rows={2} maxLength={2000} placeholder="Personal notes only; not medical or nutrition advice" value={healthNotes} onChange={(event) => setHealthNotes(event.target.value)} /></Field>
      <Field className="full" label="Variations and other notes"><textarea className="field textarea" rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
      <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add to recipe book"}</Button></div>
    </form>
  </Modal>;
}

function CookingLogModal({ initial, recipes, onClose, onSave }: {
  initial: CookingLog | null;
  recipes: CookingRecipe[];
  onClose: () => void;
  onSave: (log: Omit<CookingLog, "id">) => void;
}) {
  const [date, setDate] = useState(initial?.date ?? today());
  const [occasion, setOccasion] = useState(initial?.occasion ?? "");
  const [dishes, setDishes] = useState<CookedDish[]>(initial?.dishes ?? []);
  const [recipeId, setRecipeId] = useState("");
  const [customDish, setCustomDish] = useState("");
  const [rating, setRating] = useState(initial?.rating?.toString() ?? "");
  const [learning, setLearning] = useState(initial?.learning ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function addRecipe() {
    const recipe = recipes.find((entry) => entry.id === recipeId);
    if (!recipe) return;
    setDishes((current) => [...current, { recipeId: recipe.id, name: recipe.name }]);
    setRecipeId("");
  }

  function addCustomDish() {
    const name = customDish.trim();
    if (!name) return;
    setDishes((current) => [...current, { recipeId: null, name }]);
    setCustomDish("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!date) {
      setError("Choose the date for this cooking log.");
      return;
    }
    if (!dishes.length) {
      setError("Add at least one prepared dish, drink, or other item.");
      return;
    }
    const parsedRating = rating ? Number(rating) : null;
    if (parsedRating !== null && (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5)) {
      setError("Choose a rating from 1 to 5.");
      return;
    }
    onSave({ date, occasion: occasion.trim(), dishes, rating: parsedRating, learning: learning.trim(), notes: notes.trim() });
  }

  return <Modal title={initial ? "Edit daily cooking log" : "Add daily cooking log"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field label="Date"><DateInput autoFocus required value={date} onValueChange={setDate} /></Field>
      <Field label="Meal / occasion"><Input maxLength={100} placeholder="Breakfast, lunch, snack, family dinner..." value={occasion} onChange={(event) => setOccasion(event.target.value)} /></Field>
      <Field className="full" label="Add from your recipe book">{recipes.length ? <div className="cooking-add-dish"><Select aria-label="Choose a saved recipe" value={recipeId} onChange={(event) => setRecipeId(event.target.value)}><option value="">Choose a recipe or prepared item</option>{recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name} · {recipe.dishType}</option>)}</Select><Button type="button" variant="outline" disabled={!recipeId} onClick={addRecipe}><Plus size={13} /> Add</Button></div> : <span className="section-description">Add a recipe first, or enter a one-off prepared item below.</span>}</Field>
      <Field className="full" label="Add a one-off dish, drink, or prepared item"><div className="cooking-add-dish"><Input maxLength={120} placeholder="e.g. Fresh lime juice" value={customDish} onChange={(event) => setCustomDish(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomDish(); } }} /><Button type="button" variant="outline" disabled={!customDish.trim()} onClick={addCustomDish}><Plus size={13} /> Add item</Button></div></Field>
      {dishes.length > 0 && <div className="full cooking-selected-dishes"><strong>Prepared today</strong>{dishes.map((dish, index) => <div key={`${dish.recipeId ?? "custom"}-${index}`}><span>{dish.name}</span><button className="icon-button" type="button" aria-label={`Remove ${dish.name}`} onClick={() => setDishes((current) => current.filter((_, dishIndex) => dishIndex !== index))}><X size={13} /></button></div>)}</div>}
      <Field label="How did it turn out?"><Select value={rating} onChange={(event) => setRating(event.target.value)}><option value="">Not rated</option><option value="1">1 · Needs practice</option><option value="2">2 · Fair</option><option value="3">3 · Good</option><option value="4">4 · Very good</option><option value="5">5 · Excellent</option></Select></Field>
      <Field className="full" label="What I learned"><textarea className="field textarea" rows={3} maxLength={3000} placeholder="What worked, what you would change, or a new technique to remember" value={learning} onChange={(event) => setLearning(event.target.value)} /></Field>
      <Field className="full" label="Daily notes"><textarea className="field textarea" rows={2} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
      <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Save daily log"}</Button></div>
    </form>
  </Modal>;
}

function CookingPage({ recipes, logs, onSaveRecipe, onDeleteRecipe, onSaveLog, onDeleteLog }: {
  recipes: CookingRecipe[];
  logs: CookingLog[];
  onSaveRecipe: (recipe: Omit<CookingRecipe, "id">, id?: string) => void;
  onDeleteRecipe: (recipe: CookingRecipe) => void;
  onSaveLog: (log: Omit<CookingLog, "id">, id?: string) => void;
  onDeleteLog: (log: CookingLog) => void;
}) {
  const [recipeEditor, setRecipeEditor] = useState<CookingRecipe | null | undefined>(undefined);
  const [logEditor, setLogEditor] = useState<CookingLog | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase();
  const visibleRecipes = [...recipes].filter((recipe) =>
    !query || [recipe.name, recipe.dishType, recipe.cuisine, recipe.country, recipe.ingredients, recipe.notes].some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const visibleLogs = [...logs].filter((log) =>
    !query || [log.occasion, log.learning, log.notes, ...log.dishes.map((dish) => dish.name)].some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((a, b) => b.date.localeCompare(a.date));
  const todayCount = logs.filter((log) => log.date === today()).length;

  return <>
    <PageHeading eyebrow="Kitchen journal" title="Cooking" subtitle="Keep your recipes and prepared items together, then record what you make and learn each day." action={<Button onClick={() => setRecipeEditor(null)}><Plus size={15} /> Add recipe / item</Button>} />
    <div className="cooking-summary">
      <Card><span>Saved recipes and items</span><strong>{recipes.length}</strong></Card>
      <Card><span>Daily cooking logs</span><strong>{logs.length}</strong></Card>
      <Card><span>Logs today</span><strong>{todayCount}</strong></Card>
    </div>
    <div className="alert"><Utensils size={15} style={{ flex: "none", marginTop: 1 }} /><span>Nutrition, vitamin, and health-benefit fields are your own notes, not verified nutritional data or medical advice.</span></div>
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search cooking recipes and logs" placeholder="Search recipes, ingredients, cuisine, or journal..." value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
    <div className="cooking-columns">
      <section className="cooking-section"><div className="devotional-section-head"><div><h2><CookingPot size={15} /> Recipe book</h2><p>{visibleRecipes.length} {visibleRecipes.length === 1 ? "item" : "items"}</p></div><Button variant="outline" onClick={() => setRecipeEditor(null)}><Plus size={13} /> Add</Button></div>
        {visibleRecipes.length ? <div className="cooking-list">{visibleRecipes.map((recipe) => <Card className="cooking-card" key={recipe.id}>
          <div className="devotional-card-head"><div><div className="cooking-tags"><Badge>{recipe.dishType}</Badge>{recipe.dietaryTags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div><h3>{recipe.name}</h3><span className="devotional-date">{[recipe.cuisine, recipe.country, recipe.servings ? `${recipe.servings} servings` : "", recipe.prepMinutes !== null ? `${recipe.prepMinutes} min prep` : "", recipe.cookMinutes !== null ? `${recipe.cookMinutes} min cook` : ""].filter(Boolean).join(" · ") || "No cuisine or timing details"}</span></div><div className="table-actions"><button className="icon-button" aria-label={`Edit ${recipe.name}`} onClick={() => setRecipeEditor(recipe)}><Pencil size={13} /></button><button className="icon-button" aria-label={`Copy ${recipe.name}`} onClick={() => { const { id, ...copy } = recipe; void id; onSaveRecipe(copy); }}><Copy size={13} /></button><button className="icon-button" aria-label={`Archive ${recipe.name}`} onClick={() => { if (window.confirm(`Move "${recipe.name}" to the archive? Existing daily logs will retain the prepared-item name.`)) onDeleteRecipe(recipe); }}><Archive size={13} /></button></div></div>
          {recipe.ingredients && <p><strong>Ingredients:</strong> <LinkifiedText>{recipe.ingredients}</LinkifiedText></p>}{recipe.steps && <p><strong>Steps:</strong> <LinkifiedText>{recipe.steps}</LinkifiedText></p>}{recipe.allergens.length > 0 && <p><strong>Allergens:</strong> {recipe.allergens.join(", ")}</p>}{recipe.nutritionNotes && <p><strong>Nutrition / vitamins:</strong> <LinkifiedText>{recipe.nutritionNotes}</LinkifiedText></p>}{recipe.healthNotes && <p><strong>Health notes:</strong> <LinkifiedText>{recipe.healthNotes}</LinkifiedText></p>}{recipe.notes && <p><strong>Notes:</strong> <LinkifiedText>{recipe.notes}</LinkifiedText></p>}
        </Card>)}</div> : <Card><EmptyState icon={<CookingPot size={18} />} title={recipes.length ? "No matching recipes or items" : "Your recipe book is empty"} description={recipes.length ? "Try another search." : "Save a curry, other dish, juice, or drink to get started."} /></Card>}
      </section>
      <section className="cooking-section"><div className="devotional-section-head"><div><h2><Utensils size={15} /> Daily cooking log</h2><p>{visibleLogs.length} {visibleLogs.length === 1 ? "day" : "days"} recorded</p></div><Button variant="outline" onClick={() => setLogEditor(null)}><Plus size={13} /> Log today</Button></div>
        {visibleLogs.length ? <div className="cooking-list">{visibleLogs.map((log) => <Card className="cooking-card" key={log.id}>
          <div className="devotional-card-head"><div><span className="devotional-date">{dateLabel(log.date)}{log.occasion ? ` · ${log.occasion}` : ""}</span><h3>{log.dishes.map((dish) => dish.name).join(", ")}</h3></div><div className="table-actions"><button className="icon-button" aria-label={`Edit cooking log for ${log.date}`} onClick={() => setLogEditor(log)}><Pencil size={13} /></button><button className="icon-button" aria-label={`Copy cooking log for ${log.date}`} onClick={() => { const { id, ...copy } = log; void id; onSaveLog(copy); }}><Copy size={13} /></button><button className="icon-button" aria-label={`Archive cooking log for ${log.date}`} onClick={() => { if (window.confirm(`Move the cooking log for ${dateLabel(log.date)} to the archive?`)) onDeleteLog(log); }}><Archive size={13} /></button></div></div>
          {log.rating !== null && <Badge tone={log.rating >= 4 ? "green" : log.rating <= 2 ? "amber" : undefined}>Rating {log.rating}/5</Badge>}{log.learning && <p><strong>What I learned:</strong> <LinkifiedText>{log.learning}</LinkifiedText></p>}{log.notes && <p><strong>Notes:</strong> <LinkifiedText>{log.notes}</LinkifiedText></p>}
        </Card>)}</div> : <Card><EmptyState icon={<Utensils size={18} />} title={logs.length ? "No matching daily logs" : "No cooking days logged yet"} description={logs.length ? "Try another search." : "Record prepared dishes, drinks, what you learned, and how it turned out."} /></Card>}
      </section>
    </div>
    {recipeEditor !== undefined && <CookingRecipeModal key={recipeEditor?.id ?? "new-cooking-recipe"} initial={recipeEditor} onClose={() => setRecipeEditor(undefined)} onSave={(recipe) => { onSaveRecipe(recipe, recipeEditor?.id); setRecipeEditor(undefined); }} />}
    {logEditor !== undefined && <CookingLogModal key={logEditor?.id ?? "new-cooking-log"} initial={logEditor} recipes={recipes} onClose={() => setLogEditor(undefined)} onSave={(log) => { onSaveLog(log, logEditor?.id); setLogEditor(undefined); }} />}
  </>;
}

function IssueRecordModal({ initial, onClose, onSave }: {
  initial: IssueRecord | null;
  onClose: () => void;
  onSave: (record: Omit<IssueRecord, "id">) => void;
}) {
  const currency = useContext(CurrencyContext);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [area, setArea] = useState<IssueArea>(initial?.area ?? "Personal");
  const [customArea, setCustomArea] = useState(initial?.customArea ?? "");
  const [kind, setKind] = useState<IssueKind>(initial?.kind ?? "Issue");
  const [status, setStatus] = useState<IssueStatus>(initial?.status ?? "Open");
  const [priority, setPriority] = useState<IssuePriority>(initial?.priority ?? "Medium");
  const [dateReported, setDateReported] = useState(initial?.dateReported ?? today());
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [assetName, setAssetName] = useState(initial?.assetName ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo ?? "");
  const [provider, setProvider] = useState(initial?.provider ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [updates, setUpdates] = useState(initial?.updates ?? "");
  const [estimatedCost, setEstimatedCost] = useState(initial?.estimatedCost?.toString() ?? "");
  const [actualCost, setActualCost] = useState(initial?.actualCost?.toString() ?? "");
  const [error, setError] = useState("");

  function parseCost(value: string) {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle || !dateReported) {
      setError("Enter a title and the date the issue was reported or identified.");
      return;
    }
    if (area === "Other" && !customArea.trim()) {
      setError("Describe the area when you select Other.");
      return;
    }
    const parsedEstimate = parseCost(estimatedCost);
    const parsedActual = parseCost(actualCost);
    if ((estimatedCost.trim() && parsedEstimate === null) || (actualCost.trim() && parsedActual === null)) {
      setError("Costs must be valid amounts greater than or equal to zero.");
      return;
    }
    onSave({
      title: normalizedTitle,
      area,
      customArea: customArea.trim(),
      kind,
      status,
      priority,
      dateReported,
      dueDate,
      assetName: assetName.trim(),
      location: location.trim(),
      assignedTo: assignedTo.trim(),
      provider: provider.trim(),
      description: description.trim(),
      updates: updates.trim(),
      estimatedCost: parsedEstimate,
      actualCost: parsedActual,
    });
  }

  return <Modal title={initial ? "Edit issue or repair" : "Add issue or repair"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field className="full" label="Title"><Input autoFocus required maxLength={160} placeholder="e.g. Leaking kitchen tap, laptop issue, or project follow-up" value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field label="Area"><Select value={area} onChange={(event) => setArea(event.target.value as IssueArea)}><option>Personal</option><option>Professional</option><option>Home</option><option>Vehicle</option><option>Other</option></Select></Field>
      {area === "Other" && <Field label="Describe the area"><Input required maxLength={80} placeholder="e.g. Community, travel" value={customArea} onChange={(event) => setCustomArea(event.target.value)} /></Field>}
      <Field label="Record type"><Select value={kind} onChange={(event) => setKind(event.target.value as IssueKind)}><option>Issue</option><option>Repair</option><option>Maintenance</option><option>Task</option></Select></Field>
      <Field label="Priority"><Select value={priority} onChange={(event) => setPriority(event.target.value as IssuePriority)}><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></Select></Field>
      <Field label="Status"><Select value={status} onChange={(event) => setStatus(event.target.value as IssueStatus)}><option>Open</option><option>In progress</option><option>Waiting</option><option>Resolved</option><option>Closed</option></Select></Field>
      <Field label="Date reported / identified"><DateInput required value={dateReported} onValueChange={setDateReported} /></Field>
      <Field label="Due date (optional)"><DateInput value={dueDate} onValueChange={setDueDate} /></Field>
      <Field label="Vehicle, appliance, room, or project"><Input maxLength={120} placeholder="e.g. Honda City, washing machine, kitchen" value={assetName} onChange={(event) => setAssetName(event.target.value)} /></Field>
      <Field label="Location"><Input maxLength={160} placeholder="Address, room, office, or remote" value={location} onChange={(event) => setLocation(event.target.value)} /></Field>
      <Field label="Assigned to"><Input maxLength={120} placeholder="Person responsible" value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} /></Field>
      <Field label="Repair provider / contact"><Input maxLength={120} placeholder="Mechanic, electrician, service center..." value={provider} onChange={(event) => setProvider(event.target.value)} /></Field>
      <Field label={`Estimated cost (${currency})`}><Input type="number" min="0" step="0.01" value={estimatedCost} onChange={(event) => setEstimatedCost(event.target.value)} /></Field>
      <Field label={`Actual cost (${currency})`}><Input type="number" min="0" step="0.01" value={actualCost} onChange={(event) => setActualCost(event.target.value)} /></Field>
      <Field className="full" label="Description"><textarea className="field textarea" rows={3} maxLength={4000} placeholder="Describe the problem, task, or work needed" value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      <Field className="full" label="Updates / resolution notes"><textarea className="field textarea" rows={3} maxLength={4000} placeholder="Record progress, work performed, parts used, or how it was resolved" value={updates} onChange={(event) => setUpdates(event.target.value)} /></Field>
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
      <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add record"}</Button></div>
    </form>
  </Modal>;
}

function IssuesMaintenancePage({ records, onSave, onDelete }: {
  records: IssueRecord[];
  onSave: (record: Omit<IssueRecord, "id">, id?: string) => void;
  onDelete: (record: IssueRecord) => void;
}) {
  const [editor, setEditor] = useState<IssueRecord | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("All areas");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const formatCurrency = useCurrencyFormatter();
  const query = search.trim().toLocaleLowerCase();
  const activeCount = records.filter((record) => record.status !== "Resolved" && record.status !== "Closed").length;
  const urgentCount = records.filter((record) => record.priority === "Urgent" && record.status !== "Resolved" && record.status !== "Closed").length;
  const maintenanceCount = records.filter((record) => record.kind === "Repair" || record.kind === "Maintenance").length;
  const visibleRecords = [...records].filter((record) =>
    (areaFilter === "All areas" || record.area === areaFilter) &&
    (statusFilter === "All statuses" || record.status === statusFilter) &&
    (!query || [
      record.title, record.area, record.customArea, record.kind, record.assetName, record.location,
      record.assignedTo, record.provider, record.description, record.updates,
    ].some((value) => value.toLocaleLowerCase().includes(query))))
    .sort((a, b) => {
      const aOpen = a.status === "Resolved" || a.status === "Closed" ? 1 : 0;
      const bOpen = b.status === "Resolved" || b.status === "Closed" ? 1 : 0;
      return aOpen - bOpen || (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") || b.dateReported.localeCompare(a.dateReported);
    });

  function deleteRecord(record: IssueRecord) {
    if (window.confirm(`Move "${record.title}" to the archive?`)) onDelete(record);
  }

  return <>
    <PageHeading eyebrow="Life admin" title="Issues & maintenance" subtitle="Keep personal and work issues, household fixes, vehicle repairs, and other tasks in one place." action={<Button onClick={() => setEditor(null)}><Plus size={15} /> Add issue / repair</Button>} />
    <div className="issues-summary">
      <Card><span>Total records</span><strong>{records.length}</strong></Card>
      <Card><span>Open / in progress</span><strong>{activeCount}</strong></Card>
      <Card><span>Urgent and unresolved</span><strong>{urgentCount}</strong></Card>
      <Card><span>Repairs / maintenance</span><strong>{maintenanceCount}</strong></Card>
    </div>
    <div className="issues-toolbar">
      <div className="search-wrap"><Search size={15} /><Input aria-label="Search issues and repairs" placeholder="Search title, asset, provider, or notes..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <Select aria-label="Filter by area" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}><option>All areas</option><option>Personal</option><option>Professional</option><option>Home</option><option>Vehicle</option><option>Other</option></Select>
      <Select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Open</option><option>In progress</option><option>Waiting</option><option>Resolved</option><option>Closed</option></Select>
    </div>
    {visibleRecords.length ? <div className="issues-list">{visibleRecords.map((record) => {
      const resolved = record.status === "Resolved" || record.status === "Closed";
      const overdue = Boolean(record.dueDate && record.dueDate < today() && !resolved);
      return <Card className="issue-card" key={record.id}>
        <div className="issue-card-head">
          <div className="issue-card-title"><div className="issue-badges"><Badge>{record.area === "Other" ? record.customArea : record.area}</Badge><Badge tone={record.kind === "Repair" || record.kind === "Maintenance" ? "blue" : "neutral"}>{record.kind}</Badge><Badge tone={record.priority === "Urgent" || record.priority === "High" ? "amber" : "neutral"}>{record.priority} priority</Badge></div><h2>{record.title}</h2></div>
          <div className="table-actions"><button className="icon-button" aria-label={`Edit ${record.title}`} onClick={() => setEditor(record)}><Pencil size={13} /></button><button className="icon-button" aria-label={`Copy ${record.title}`} onClick={() => { const { id, ...copy } = record; void id; onSave(copy); }}><Copy size={13} /></button><button className="icon-button" aria-label={`Archive ${record.title}`} onClick={() => deleteRecord(record)}><Archive size={13} /></button></div>
        </div>
        <div className="issue-card-meta">
          <span>Reported {dateLabel(record.dateReported)}</span>
          {record.dueDate && <span className={overdue ? "issue-overdue" : ""}>{overdue ? "Overdue · " : "Due · "}{dateLabel(record.dueDate)}</span>}
          {record.assetName && <span>{record.assetName}</span>}
          {record.location && <span>{record.location}</span>}
        </div>
        <div className="issue-card-controls"><Select aria-label={`Status for ${record.title}`} value={record.status} onChange={(event) => onSave({ ...record, status: event.target.value as IssueStatus }, record.id)}><option>Open</option><option>In progress</option><option>Waiting</option><option>Resolved</option><option>Closed</option></Select>
          {(record.assignedTo || record.provider) && <span>{[record.assignedTo ? `Assigned: ${record.assignedTo}` : "", record.provider ? `Provider: ${record.provider}` : ""].filter(Boolean).join(" · ")}</span>}
          {(record.estimatedCost !== null || record.actualCost !== null) && <span>{record.estimatedCost !== null ? `Estimate ${formatCurrency(record.estimatedCost)}` : ""}{record.estimatedCost !== null && record.actualCost !== null ? " · " : ""}{record.actualCost !== null ? `Actual ${formatCurrency(record.actualCost)}` : ""}</span>}
        </div>
        {record.description && <p><strong>Details:</strong> <LinkifiedText>{record.description}</LinkifiedText></p>}
        {record.updates && <p><strong>Updates:</strong> <LinkifiedText>{record.updates}</LinkifiedText></p>}
      </Card>;
    })}</div> : <Card><EmptyState icon={<Wrench size={18} />} title={records.length ? "No matching records" : "Nothing to track yet"} description={records.length ? "Try changing the search or filters." : "Add a personal or work issue, household repair, vehicle service, or any task you want to follow."} /></Card>}
    {editor !== undefined && <IssueRecordModal key={editor?.id ?? "new-issue-record"} initial={editor} onClose={() => setEditor(undefined)} onSave={(record) => { onSave(record, editor?.id); setEditor(undefined); }} />}
  </>;
}

function PersonalEducationModal({ initial, onClose, onSave }: {
  initial: PersonalEducationRecord | null;
  onClose: () => void;
  onSave: (record: Omit<PersonalEducationRecord, "id">) => void;
}) {
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [qualification, setQualification] = useState(initial?.qualification ?? "");
  const [fieldOfStudy, setFieldOfStudy] = useState(initial?.fieldOfStudy ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [status, setStatus] = useState<PersonalEducationRecord["status"]>(initial?.status ?? "Completed");
  const [grade, setGrade] = useState(initial?.grade ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!institution.trim() || !qualification.trim()) {
      setError("Enter the institution and qualification.");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError("The end date cannot be before the start date.");
      return;
    }
    if (link && !isHttpsLink(link)) {
      setError("Use a complete HTTPS link.");
      return;
    }
    onSave({ institution: institution.trim(), qualification: qualification.trim(), fieldOfStudy: fieldOfStudy.trim(), location: location.trim(), startDate, endDate, status, grade: grade.trim(), link: link.trim(), notes: notes.trim() });
  }

  return <Modal title={initial ? "Edit education" : "Add education"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field label="Institution"><Input autoFocus required maxLength={160} value={institution} onChange={(event) => setInstitution(event.target.value)} /></Field>
      <Field label="Degree / qualification"><Input required maxLength={140} placeholder="e.g. Bachelor of Commerce" value={qualification} onChange={(event) => setQualification(event.target.value)} /></Field>
      <Field label="Field of study"><Input maxLength={120} value={fieldOfStudy} onChange={(event) => setFieldOfStudy(event.target.value)} /></Field>
      <Field label="Location"><Input maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} /></Field>
      <Field label="Start date"><Input type="month" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field>
      <Field label="End date"><Input type="month" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field>
      <Field label="Status"><Select value={status} onChange={(event) => setStatus(event.target.value as PersonalEducationRecord["status"])}><option>Completed</option><option>In progress</option><option>On hold</option></Select></Field>
      <Field label="Grade / result"><Input maxLength={80} placeholder="Optional" value={grade} onChange={(event) => setGrade(event.target.value)} /></Field>
      <Field className="full" label="Certificate / institution link (HTTPS)"><ExternalLinkInput maxLength={500} placeholder="https://" value={link} onChange={(event) => setLink(event.target.value)} /></Field>
      <Field className="full" label="Notes"><textarea className="field textarea" rows={3} maxLength={3000} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add education"}</Button></div></form>
  </Modal>;
}

function ProfessionalQualificationModal({ initial, onClose, onSave }: {
  initial: ProfessionalQualification | null;
  onClose: () => void;
  onSave: (record: Omit<ProfessionalQualification, "id">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [issuer, setIssuer] = useState(initial?.issuer ?? "");
  const [credentialId, setCredentialId] = useState(initial?.credentialId ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a qualification or certificate name.");
      return;
    }
    if (issueDate && expiryDate && expiryDate < issueDate) {
      setError("The expiry date cannot be before the issue date.");
      return;
    }
    if (link && !isHttpsLink(link)) {
      setError("Use a complete HTTPS link.");
      return;
    }
    onSave({ name: name.trim(), issuer: issuer.trim(), credentialId: credentialId.trim(), issueDate, expiryDate, link: link.trim(), notes: notes.trim() });
  }

  return <Modal title={initial ? "Edit qualification" : "Add qualification"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field className="full" label="Qualification / certificate"><Input autoFocus required maxLength={160} placeholder="e.g. Project Management Professional" value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Issuing organization"><Input maxLength={160} value={issuer} onChange={(event) => setIssuer(event.target.value)} /></Field>
      <Field label="Credential ID (optional)"><Input maxLength={120} value={credentialId} onChange={(event) => setCredentialId(event.target.value)} /></Field>
      <Field label="Issue date"><DateInput value={issueDate} onValueChange={setIssueDate} /></Field>
      <Field label="Expiry date (optional)"><DateInput value={expiryDate} onValueChange={setExpiryDate} /></Field>
      <Field className="full" label="Credential / verification link (HTTPS)"><ExternalLinkInput maxLength={500} placeholder="https://" value={link} onChange={(event) => setLink(event.target.value)} /></Field>
      <Field className="full" label="Notes"><textarea className="field textarea" rows={3} maxLength={3000} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add qualification"}</Button></div></form>
  </Modal>;
}

function WorkExperienceModal({ initial, onClose, onSave }: {
  initial: WorkExperience | null;
  onClose: () => void;
  onSave: (record: Omit<WorkExperience, "id">) => void;
}) {
  const [company, setCompany] = useState(initial?.company ?? "");
  const [jobTitle, setJobTitle] = useState(initial?.jobTitle ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [employmentType, setEmploymentType] = useState(initial?.employmentType ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [current, setCurrent] = useState(initial?.current ?? false);
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [skills, setSkills] = useState(initial?.skills ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!company.trim() || !jobTitle.trim()) {
      setError("Enter the company and job title.");
      return;
    }
    if (!current && startDate && endDate && endDate < startDate) {
      setError("The end date cannot be before the start date.");
      return;
    }
    onSave({ company: company.trim(), jobTitle: jobTitle.trim(), location: location.trim(), employmentType: employmentType.trim(), startDate, endDate: current ? "" : endDate, current, summary: summary.trim(), skills: skills.trim() });
  }

  return <Modal title={initial ? "Edit work experience" : "Add work experience"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field label="Company / organization"><Input autoFocus required maxLength={160} value={company} onChange={(event) => setCompany(event.target.value)} /></Field>
      <Field label="Job title"><Input required maxLength={140} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} /></Field>
      <Field label="Location"><Input maxLength={120} placeholder="City, country, or remote" value={location} onChange={(event) => setLocation(event.target.value)} /></Field>
      <Field label="Employment type"><Input maxLength={80} placeholder="Full-time, contract, freelance..." value={employmentType} onChange={(event) => setEmploymentType(event.target.value)} /></Field>
      <Field label="Start date"><Input type="month" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field>
      {!current && <Field label="End date"><Input type="month" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field>}
      <Field label="Current role"><Select value={current ? "yes" : "no"} onChange={(event) => setCurrent(event.target.value === "yes")}><option value="no">No</option><option value="yes">Yes</option></Select></Field>
      <Field className="full" label="Role summary and achievements"><textarea className="field textarea" rows={4} maxLength={5000} placeholder="Responsibilities, projects, and accomplishments" value={summary} onChange={(event) => setSummary(event.target.value)} /></Field>
      <Field className="full" label="Skills used (comma-separated)"><Input maxLength={1000} value={skills} onChange={(event) => setSkills(event.target.value)} /></Field>
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add experience"}</Button></div></form>
  </Modal>;
}

function ProfessionalSkillModal({ initial, onClose, onSave }: {
  initial: ProfessionalSkill | null;
  onClose: () => void;
  onSave: (record: Omit<ProfessionalSkill, "id">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [proficiency, setProficiency] = useState<ProfessionalSkill["proficiency"]>(initial?.proficiency ?? "Intermediate");
  const [yearsExperience, setYearsExperience] = useState(initial?.yearsExperience?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter a skill or language.");
      return;
    }
    const years = yearsExperience.trim() ? Number(yearsExperience) : null;
    if (years !== null && (!Number.isFinite(years) || years < 0)) {
      setError("Years of experience must be zero or more.");
      return;
    }
    onSave({ name: name.trim(), category: category.trim(), proficiency, yearsExperience: years, notes: notes.trim() });
  }

  return <Modal title={initial ? "Edit skill" : "Add skill"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field label="Skill / language"><Input autoFocus required maxLength={120} placeholder="e.g. TypeScript, stakeholder management, Telugu" value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Category"><Input maxLength={80} placeholder="Technical, leadership, language..." value={category} onChange={(event) => setCategory(event.target.value)} /></Field>
      <Field label="Proficiency"><Select value={proficiency} onChange={(event) => setProficiency(event.target.value as ProfessionalSkill["proficiency"])}><option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Expert</option></Select></Field>
      <Field label="Years of experience"><Input type="number" min="0" step="0.5" value={yearsExperience} onChange={(event) => setYearsExperience(event.target.value)} /></Field>
      <Field className="full" label="Notes"><textarea className="field textarea" rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add skill"}</Button></div></form>
  </Modal>;
}

function CareerSection({ title, description, icon, action, children }: {
  title: string;
  description: string;
  icon: ReactNode;
  action: ReactNode;
  children: ReactNode;
}) {
  return <section className="career-section"><div className="career-section-head"><div><h2>{icon}{title}</h2><p>{description}</p></div>{action}</div>{children}</section>;
}

function CareerEntry({ title, subtitle, details, description, link, onEdit, onCopy, onDelete }: {
  title: string;
  subtitle: string;
  details: string[];
  description?: string;
  link?: string;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  return <Card className="career-card"><div className="career-card-head"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div><div className="table-actions"><button className="icon-button" aria-label={`Edit ${title}`} onClick={onEdit}><Pencil size={13} /></button><button className="icon-button" aria-label={`Copy ${title}`} onClick={onCopy}><Copy size={13} /></button><button className="icon-button" aria-label={`Archive ${title}`} onClick={onDelete}><Archive size={13} /></button></div></div>
    {details.filter(Boolean).length > 0 && <div className="career-card-details">{details.filter(Boolean).map((detail, index) => <span key={`${index}-${detail}`}>{detail}</span>)}</div>}
    {description && <p className="career-card-description"><LinkifiedText>{description}</LinkifiedText></p>}
    {link && <a className="career-card-link" href={link} target="_blank" rel="noopener noreferrer">Open link</a>}
  </Card>;
}

function EducationCareerPage({ education, qualifications, experience, skills, onSaveEducation, onDeleteEducation, onSaveQualification, onDeleteQualification, onSaveExperience, onDeleteExperience, onSaveSkill, onDeleteSkill }: {
  education: PersonalEducationRecord[];
  qualifications: ProfessionalQualification[];
  experience: WorkExperience[];
  skills: ProfessionalSkill[];
  onSaveEducation: (record: Omit<PersonalEducationRecord, "id">, id?: string) => void;
  onDeleteEducation: (record: PersonalEducationRecord) => void;
  onSaveQualification: (record: Omit<ProfessionalQualification, "id">, id?: string) => void;
  onDeleteQualification: (record: ProfessionalQualification) => void;
  onSaveExperience: (record: Omit<WorkExperience, "id">, id?: string) => void;
  onDeleteExperience: (record: WorkExperience) => void;
  onSaveSkill: (record: Omit<ProfessionalSkill, "id">, id?: string) => void;
  onDeleteSkill: (record: ProfessionalSkill) => void;
}) {
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{ type: "education"; record: PersonalEducationRecord | null } | { type: "qualification"; record: ProfessionalQualification | null } | { type: "experience"; record: WorkExperience | null } | { type: "skill"; record: ProfessionalSkill | null } | null>(null);
  const query = search.trim().toLocaleLowerCase();
  const matches = (...values: string[]) => !query || values.some((value) => value.toLocaleLowerCase().includes(query));
  const filteredEducation = [...education].filter((entry) => matches(entry.institution, entry.qualification, entry.fieldOfStudy, entry.location, entry.grade, entry.notes)).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const filteredQualifications = [...qualifications].filter((entry) => matches(entry.name, entry.issuer, entry.credentialId, entry.notes)).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const filteredExperience = [...experience].filter((entry) => matches(entry.company, entry.jobTitle, entry.location, entry.employmentType, entry.summary, entry.skills)).sort((a, b) => Number(b.current) - Number(a.current) || b.startDate.localeCompare(a.startDate));
  const filteredSkills = [...skills].filter((entry) => matches(entry.name, entry.category, entry.proficiency, entry.notes)).sort((a, b) => a.name.localeCompare(b.name));
  const totalItems = education.length + qualifications.length + experience.length + skills.length;

  function confirmDelete(label: string, remove: () => void) {
    if (window.confirm(`Move "${label}" to the archive?`)) remove();
  }

  return <>
    <PageHeading eyebrow="Personal profile" title="Education & career" subtitle="Keep your education, credentials, work history, and professional skills together in one private profile." />
    <div className="career-summary">
      <Card><span>Education</span><strong>{education.length}</strong></Card><Card><span>Qualifications</span><strong>{qualifications.length}</strong></Card><Card><span>Work roles</span><strong>{experience.length}</strong></Card><Card><span>Skills</span><strong>{skills.length}</strong></Card>
    </div>
    <div className="alert"><Briefcase size={15} style={{ flex: "none", marginTop: 1 }} /><span>This is your own career profile, separate from the Schools & Colleges records and Learning goals. Profile details are stored as shared Daybook data and included in JSON backups.</span></div>
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search education and career profile" placeholder="Search schools, qualifications, employers, or skills..." value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
    {totalItems === 0 && !query ? <Card><EmptyState icon={<Briefcase size={18} />} title="Start your professional profile" description="Add your education, qualifications, work history, and professional skills below." /></Card> : null}
    <div className="career-sections">
      <CareerSection title="Education history" description={`${filteredEducation.length} ${filteredEducation.length === 1 ? "record" : "records"}`} icon={<GraduationCap size={16} />} action={<Button variant="outline" onClick={() => setEditor({ type: "education", record: null })}><Plus size={13} /> Add education</Button>}>
        {filteredEducation.length ? <div className="career-list">{filteredEducation.map((entry) => <CareerEntry key={entry.id} title={entry.qualification} subtitle={entry.institution} details={[entry.fieldOfStudy, entry.location, [monthYearLabel(entry.startDate), entry.status === "In progress" ? "Present" : monthYearLabel(entry.endDate)].filter(Boolean).join(" – "), entry.grade, entry.status].filter(Boolean)} description={entry.notes} link={entry.link} onEdit={() => setEditor({ type: "education", record: entry })} onCopy={() => { const { id, ...copy } = entry; void id; onSaveEducation(copy); }} onDelete={() => confirmDelete(entry.qualification, () => onDeleteEducation(entry))} />)}</div> : <Card><EmptyState icon={<GraduationCap size={18} />} title={education.length ? "No matching education" : "No education added"} description={education.length ? "Try another search." : "Add colleges, degrees, diplomas, or other education."} /></Card>}
      </CareerSection>
      <CareerSection title="Qualifications & certificates" description={`${filteredQualifications.length} ${filteredQualifications.length === 1 ? "record" : "records"}`} icon={<Award size={16} />} action={<Button variant="outline" onClick={() => setEditor({ type: "qualification", record: null })}><Plus size={13} /> Add qualification</Button>}>
        {filteredQualifications.length ? <div className="career-list">{filteredQualifications.map((entry) => <CareerEntry key={entry.id} title={entry.name} subtitle={entry.issuer} details={[entry.credentialId ? `Credential ID: ${entry.credentialId}` : "", entry.issueDate ? `Issued ${dateLabel(entry.issueDate)}` : "", entry.expiryDate ? `Expires ${dateLabel(entry.expiryDate)}` : ""]} description={entry.notes} link={entry.link} onEdit={() => setEditor({ type: "qualification", record: entry })} onCopy={() => { const { id, ...copy } = entry; void id; onSaveQualification(copy); }} onDelete={() => confirmDelete(entry.name, () => onDeleteQualification(entry))} />)}</div> : <Card><EmptyState icon={<Award size={18} />} title={qualifications.length ? "No matching qualifications" : "No qualifications added"} description={qualifications.length ? "Try another search." : "Add professional certificates, licenses, and credentials."} /></Card>}
      </CareerSection>
      <CareerSection title="Work history" description={`${filteredExperience.length} ${filteredExperience.length === 1 ? "role" : "roles"}`} icon={<Briefcase size={16} />} action={<Button variant="outline" onClick={() => setEditor({ type: "experience", record: null })}><Plus size={13} /> Add work</Button>}>
        {filteredExperience.length ? <div className="career-list">{filteredExperience.map((entry) => <CareerEntry key={entry.id} title={entry.jobTitle} subtitle={`${entry.company}${entry.location ? ` · ${entry.location}` : ""}`} details={[entry.employmentType, [monthYearLabel(entry.startDate), entry.current ? "Present" : monthYearLabel(entry.endDate)].filter(Boolean).join(" – "), entry.current ? "Current role" : ""].filter(Boolean)} description={[entry.summary, entry.skills ? `Skills: ${entry.skills}` : ""].filter(Boolean).join("\n")} onEdit={() => setEditor({ type: "experience", record: entry })} onCopy={() => { const { id, ...copy } = entry; void id; onSaveExperience(copy); }} onDelete={() => confirmDelete(`${entry.jobTitle} at ${entry.company}`, () => onDeleteExperience(entry))} />)}</div> : <Card><EmptyState icon={<Briefcase size={18} />} title={experience.length ? "No matching work history" : "No work history added"} description={experience.length ? "Try another search." : "Record employers, roles, dates, achievements, and skills used."} /></Card>}
      </CareerSection>
      <CareerSection title="Skills & languages" description={`${filteredSkills.length} ${filteredSkills.length === 1 ? "skill" : "skills"}`} icon={<Sparkles size={16} />} action={<Button variant="outline" onClick={() => setEditor({ type: "skill", record: null })}><Plus size={13} /> Add skill</Button>}>
        {filteredSkills.length ? <div className="career-list">{filteredSkills.map((entry) => <CareerEntry key={entry.id} title={entry.name} subtitle={entry.category} details={[entry.proficiency, entry.yearsExperience !== null ? `${entry.yearsExperience} years` : ""]} description={entry.notes} onEdit={() => setEditor({ type: "skill", record: entry })} onCopy={() => { const { id, ...copy } = entry; void id; onSaveSkill(copy); }} onDelete={() => confirmDelete(entry.name, () => onDeleteSkill(entry))} />)}</div> : <Card><EmptyState icon={<Sparkles size={18} />} title={skills.length ? "No matching skills" : "No skills added"} description={skills.length ? "Try another search." : "Track technical, professional, and language skills with proficiency."} /></Card>}
      </CareerSection>
    </div>
    {editor?.type === "education" && <PersonalEducationModal key={editor.record?.id ?? "new-personal-education"} initial={editor.record} onClose={() => setEditor(null)} onSave={(record) => { onSaveEducation(record, editor.record?.id); setEditor(null); }} />}
    {editor?.type === "qualification" && <ProfessionalQualificationModal key={editor.record?.id ?? "new-professional-qualification"} initial={editor.record} onClose={() => setEditor(null)} onSave={(record) => { onSaveQualification(record, editor.record?.id); setEditor(null); }} />}
    {editor?.type === "experience" && <WorkExperienceModal key={editor.record?.id ?? "new-work-experience"} initial={editor.record} onClose={() => setEditor(null)} onSave={(record) => { onSaveExperience(record, editor.record?.id); setEditor(null); }} />}
    {editor?.type === "skill" && <ProfessionalSkillModal key={editor.record?.id ?? "new-professional-skill"} initial={editor.record} onClose={() => setEditor(null)} onSave={(record) => { onSaveSkill(record, editor.record?.id); setEditor(null); }} />}
  </>;
}

function FamilyMemberModal({ initial, onClose, onSave }: {
  initial: FamilyMember | null;
  onClose: () => void;
  onSave: (member: Omit<FamilyMember, "id">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [relationship, setRelationship] = useState<FamilyRelationship>(initial?.relationship ?? "Spouse");
  const [relationshipDetail, setRelationshipDetail] = useState(initial?.relationshipDetail ?? "");
  const [birthYear, setBirthYear] = useState(initial?.birthYear?.toString() ?? "");
  const [birthPlace, setBirthPlace] = useState(initial?.birthPlace ?? "");
  const [currentResidence, setCurrentResidence] = useState(initial?.currentResidence ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [education, setEducation] = useState(initial?.education ?? "");
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [occupation, setOccupation] = useState(initial?.occupation ?? "");
  const [organization, setOrganization] = useState(initial?.organization ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter the family member's name.");
      return;
    }
    if (relationship === "Other" && !relationshipDetail.trim()) {
      setError("Describe the relationship when you select Other.");
      return;
    }
    const parsedBirthYear = birthYear.trim() ? Number(birthYear) : null;
    if (parsedBirthYear !== null && (!Number.isInteger(parsedBirthYear) || parsedBirthYear < 1800 || parsedBirthYear > new Date().getFullYear())) {
      setError(`Enter a birth year from 1800 to ${new Date().getFullYear()}, or leave it blank.`);
      return;
    }
    onSave({
      name: name.trim(),
      relationship,
      relationshipDetail: relationshipDetail.trim(),
      birthYear: parsedBirthYear,
      birthPlace: birthPlace.trim(),
      currentResidence: currentResidence.trim(),
      phone: phone.trim(),
      email: email.trim(),
      education: education.trim(),
      institution: institution.trim(),
      occupation: occupation.trim(),
      organization: organization.trim(),
      notes: notes.trim(),
    });
  }

  return <Modal title={initial ? "Edit family member" : "Add family member"} onClose={onClose} wide>
    <form onSubmit={submit}><div className="form-grid">
      <Field label="Name"><Input autoFocus required maxLength={140} placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="Relationship to you"><Select value={relationship} onChange={(event) => setRelationship(event.target.value as FamilyRelationship)}><option>Self</option><option>Spouse</option><option>Child</option><option>Parent</option><option>Sibling</option><option>Grandparent</option><option>Grandchild</option><option>Aunt / Uncle</option><option>Cousin</option><option>In-law</option><option>Other</option></Select></Field>
      <Field className="full" label={relationship === "Other" ? "Describe relationship" : "Relationship details (optional)"}><Input maxLength={120} required={relationship === "Other"} placeholder="e.g. Maternal aunt, nephew" value={relationshipDetail} onChange={(event) => setRelationshipDetail(event.target.value)} /></Field>
      <Field label="Birth year (optional)"><Input type="number" min="1800" max={new Date().getFullYear()} step="1" value={birthYear} onChange={(event) => setBirthYear(event.target.value)} /></Field>
      <Field label="Place of birth (optional)"><Input maxLength={160} placeholder="City, region, country" value={birthPlace} onChange={(event) => setBirthPlace(event.target.value)} /></Field>
      <Field className="full" label="Current residence (optional)"><Input maxLength={200} placeholder="City, region, country (avoid a street address)" value={currentResidence} onChange={(event) => setCurrentResidence(event.target.value)} /></Field>
      <Field label="Phone (optional)"><Input type="tel" maxLength={40} autoComplete="off" value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
      <Field label="Email (optional)"><Input type="email" maxLength={254} autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
      <Field label="Education / qualification (optional)"><Input maxLength={160} placeholder="Highest or current education" value={education} onChange={(event) => setEducation(event.target.value)} /></Field>
      <Field label="School / institution (optional)"><Input maxLength={160} value={institution} onChange={(event) => setInstitution(event.target.value)} /></Field>
      <Field label="Occupation (optional)"><Input maxLength={140} placeholder="Current profession or role" value={occupation} onChange={(event) => setOccupation(event.target.value)} /></Field>
      <Field label="Employer / organization (optional)"><Input maxLength={160} value={organization} onChange={(event) => setOrganization(event.target.value)} /></Field>
      <Field className="full" label="Other notes (optional)"><textarea className="field textarea" rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Add family member"}</Button></div></form>
  </Modal>;
}

function FamilyPage({ members, onSave, onDelete }: {
  members: FamilyMember[];
  onSave: (member: Omit<FamilyMember, "id">, id?: string) => void;
  onDelete: (member: FamilyMember) => void;
}) {
  const [editor, setEditor] = useState<FamilyMember | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [relationshipFilter, setRelationshipFilter] = useState("All relationships");
  const query = search.trim().toLocaleLowerCase();
  const childrenCount = members.filter((member) => member.relationship === "Child").length;
  const relativesCount = members.filter((member) => !["Self", "Spouse", "Child"].includes(member.relationship)).length;
  const visibleMembers = [...members].filter((member) =>
    (relationshipFilter === "All relationships" || member.relationship === relationshipFilter) &&
    (!query || [
      member.name, member.relationship, member.relationshipDetail, member.birthPlace, member.currentResidence,
      member.education, member.institution, member.occupation, member.organization, member.notes,
    ].some((value) => value.toLocaleLowerCase().includes(query))))
    .sort((a, b) => a.name.localeCompare(b.name));

  function confirmDelete(member: FamilyMember) {
    if (window.confirm(`Move "${member.name}" to the archive?`)) onDelete(member);
  }

  return <>
    <PageHeading eyebrow="Family directory" title="Family" subtitle="Keep a simple directory for your household and relatives, with family relationships, places, education, and work details." action={<Button onClick={() => setEditor(null)}><Plus size={15} /> Add family member</Button>} />
    <div className="family-summary">
      <Card><span>Family members</span><strong>{members.length}</strong></Card>
      <Card><span>Children</span><strong>{childrenCount}</strong></Card>
      <Card><span>Other relatives</span><strong>{relativesCount}</strong></Card>
    </div>
    <div className="alert"><UsersRound size={15} style={{ flex: "none", marginTop: 1 }} /><span>Birth year, birthplace, residence, phone, and email are optional. Family information is shared Daybook data visible to people with access; get consent before adding another adult’s contact details and avoid sensitive information.</span></div>
    <div className="family-toolbar">
      <div className="search-wrap"><Search size={15} /><Input aria-label="Search family members" placeholder="Search name, relationship, place, education, or work..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      <Select aria-label="Filter family members by relationship" value={relationshipFilter} onChange={(event) => setRelationshipFilter(event.target.value)}>
        <option>All relationships</option><option>Self</option><option>Spouse</option><option>Child</option><option>Parent</option><option>Sibling</option><option>Grandparent</option><option>Grandchild</option><option>Aunt / Uncle</option><option>Cousin</option><option>In-law</option><option>Other</option>
      </Select>
    </div>
    {visibleMembers.length ? <div className="family-list">{visibleMembers.map((member) => <Card className="family-card" key={member.id}>
      <div className="family-card-head"><div className="family-card-title"><div className="family-avatar"><UsersRound size={17} /></div><div><h2>{member.name}</h2><p>{member.relationship}{member.relationshipDetail ? ` · ${member.relationshipDetail}` : ""}{member.birthYear ? ` · Born ${member.birthYear}` : ""}</p></div></div><div className="table-actions"><button className="icon-button" aria-label={`Edit ${member.name}`} onClick={() => setEditor(member)}><Pencil size={13} /></button><button className="icon-button" aria-label={`Copy ${member.name}`} onClick={() => { const { id, ...copy } = member; void id; onSave(copy); }}><Copy size={13} /></button><button className="icon-button" aria-label={`Archive ${member.name}`} onClick={() => confirmDelete(member)}><Archive size={13} /></button></div></div>
      <div className="family-details">{member.birthPlace && <div><span>Place of birth</span><strong>{member.birthPlace}</strong></div>}{member.currentResidence && <div><span>Current residence</span><strong>{member.currentResidence}</strong></div>}{member.education && <div><span>Education</span><strong>{member.education}{member.institution ? ` · ${member.institution}` : ""}</strong></div>}{member.occupation && <div><span>Occupation</span><strong>{member.occupation}{member.organization ? ` · ${member.organization}` : ""}</strong></div>}</div>
      {(member.phone || member.email) && <div className="family-contact">{member.phone && <span>Phone: {member.phone}</span>}{member.email && <a href={`mailto:${member.email}`}>Email: {member.email}</a>}</div>}
      {member.notes && <p className="family-notes"><LinkifiedText>{member.notes}</LinkifiedText></p>}
    </Card>)}</div> : <Card><EmptyState icon={<UsersRound size={18} />} title={members.length ? "No matching family members" : "Your family directory is empty"} description={members.length ? "Try another search or relationship filter." : "Add yourself, your spouse, children, and other relatives to start the family directory."} /></Card>}
    {editor !== undefined && <FamilyMemberModal key={editor?.id ?? "new-family-member"} initial={editor} onClose={() => setEditor(undefined)} onSave={(member) => { onSave(member, editor?.id); setEditor(undefined); }} />}
  </>;
}

function PersonalRecordModal({ initial, onClose, onSave }: {
  initial: PersonalRecord | null;
  onClose: () => void;
  onSave: (record: Omit<PersonalRecord, "id">) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<PersonalRecordType>(initial?.type ?? "Identity");
  const [holder, setHolder] = useState(initial?.holder ?? "");
  const [recordNumber, setRecordNumber] = useState(initial?.recordNumber ?? "");
  const [issuer, setIssuer] = useState(initial?.issuer ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [documentLink, setDocumentLink] = useState(initial?.documentLink ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [reminderDays, setReminderDays] = useState(initial?.reminderDays ?? 30);
  const [additionalFields, setAdditionalFields] = useState<PersonalRecordField[]>(initial?.additionalFields ?? []);
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const link = documentLink.trim();
    if (!title.trim()) { setError("Enter a title for this record."); return; }
    if (link) {
      try {
        const url = new URL(link);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
      } catch {
        setError("Enter a valid shared link starting with https://.");
        return;
      }
    }
    onSave({
      title: title.trim(),
      type,
      holder: holder.trim(),
      recordNumber: recordNumber.trim(),
      issuer: issuer.trim(),
      issueDate,
      dueDate,
      documentLink: link,
      notes: notes.trim(),
      reminderDays,
      additionalFields: additionalFields
        .map((field) => ({ label: field.label.trim(), value: field.value.trim() }))
        .filter((field) => field.label || field.value),
    });
  }

  return <Modal title={initial ? "Edit personal record" : "Add a personal record"} onClose={onClose} wide><form onSubmit={submit}><div className="form-grid">
    <Field className="full" label="Record title"><Input autoFocus required maxLength={120} placeholder="e.g. Aadhaar card, health insurance" value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
    <Field label="Type"><Select value={type} onChange={(event) => setType(event.target.value as PersonalRecordType)}><option>Identity</option><option>Insurance</option><option>License</option><option>Certificate</option><option>Other</option></Select></Field>
    <Field label="Name on record"><Input maxLength={120} placeholder="Optional" value={holder} onChange={(event) => setHolder(event.target.value)} /></Field>
    <Field label="Document / policy number"><Input maxLength={120} autoComplete="off" placeholder="Store only if needed" value={recordNumber} onChange={(event) => setRecordNumber(event.target.value)} /></Field>
    <Field label="Issued by / provider"><Input maxLength={120} placeholder="Authority or insurer" value={issuer} onChange={(event) => setIssuer(event.target.value)} /></Field>
    <Field label="Issue date"><DateInput value={issueDate} onValueChange={setIssueDate} /></Field>
    <Field label="Expiry / renewal date"><DateInput value={dueDate} onValueChange={setDueDate} /></Field>
    <Field label="Remind me"><Select value={reminderDays} onChange={(event) => setReminderDays(Number(event.target.value))}><option value={0}>On the due date</option><option value={7}>7 days before</option><option value={30}>30 days before</option><option value={60}>60 days before</option><option value={90}>90 days before</option></Select></Field>
    <Field className="full" label="Shared document link"><ExternalLinkInput maxLength={2000} placeholder="https://... (use a private link with appropriate sharing access)" value={documentLink} onChange={(event) => setDocumentLink(event.target.value)} /></Field>
    <Field className="full" label="Notes"><textarea className="field textarea" rows={3} maxLength={3000} placeholder="Additional information, renewal instructions, contacts..." value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
    <div className="personal-fields full"><div className="personal-fields-head"><div><span className="field-label">Additional details</span><p className="section-description">Add any extra label and value for this record.</p></div><Button type="button" variant="outline" onClick={() => setAdditionalFields((fields) => [...fields, { label: "", value: "" }])}><Plus size={13} />Add field</Button></div>
      {additionalFields.map((field, index) => <div className="personal-field-row" key={index}><Input aria-label={`Additional field ${index + 1} name`} maxLength={80} placeholder="Field name" value={field.label} onChange={(event) => setAdditionalFields((fields) => fields.map((entry, fieldIndex) => fieldIndex === index ? { ...entry, label: event.target.value } : entry))} /><Input aria-label={`Additional field ${index + 1} value`} maxLength={500} placeholder="Value" value={field.value} onChange={(event) => setAdditionalFields((fields) => fields.map((entry, fieldIndex) => fieldIndex === index ? { ...entry, value: event.target.value } : entry))} /><button type="button" className="icon-button" aria-label="Remove additional field" onClick={() => setAdditionalFields((fields) => fields.filter((_, fieldIndex) => fieldIndex !== index))}><Trash2 size={14} /></button></div>)}
    </div>
  </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }}>{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save changes" : "Save record"}</Button></div></form></Modal>;
}

function daysUntil(date: string): number {
  const due = new Date(`${date}T00:00:00`);
  const now = new Date(`${today()}T00:00:00`);
  return Math.round((due.getTime() - now.getTime()) / 86400000);
}

function PersonalRecordsPage({ records, onSave, onDelete }: {
  records: PersonalRecord[];
  onSave: (record: Omit<PersonalRecord, "id">, id?: string) => void;
  onDelete: (record: PersonalRecord) => void;
}) {
  const [editor, setEditor] = useState<{ initial: PersonalRecord | null } | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All records");
  const visibleRecords = records
    .filter((record) => typeFilter === "All records" || record.type === typeFilter)
    .filter((record) => `${record.title} ${record.holder} ${record.recordNumber} ${record.issuer} ${record.notes}`
      .toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (!a.dueDate) return b.dueDate ? 1 : a.title.localeCompare(b.title);
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  const expiredCount = records.filter((record) => record.dueDate && daysUntil(record.dueDate) < 0).length;
  const dueSoonCount = records.filter((record) => record.dueDate && daysUntil(record.dueDate) >= 0 &&
    daysUntil(record.dueDate) <= record.reminderDays).length;

  function dueLabel(record: PersonalRecord): { text: string; tone: "amber" | "green" | "neutral" } {
    if (!record.dueDate) return { text: "No due date", tone: "neutral" };
    const remaining = daysUntil(record.dueDate);
    if (remaining < 0) return { text: `Expired ${dateLabel(record.dueDate)}`, tone: "amber" };
    if (remaining === 0) return { text: "Due today", tone: "amber" };
    if (remaining <= record.reminderDays) return { text: `Due in ${remaining} days`, tone: "amber" };
    return { text: `Due ${dateLabel(record.dueDate)}`, tone: "green" };
  }

  return <><PageHeading eyebrow="Important information" title="Personal documents" subtitle="Keep frequently needed IDs, policies, dates and secure document links together." action={<Button onClick={() => setEditor({ initial: null })}><Plus size={15} /> Add record</Button>} />
    <div className="alert"><FileText size={15} style={{ flex: "none", marginTop: 1 }} /><span>These record details are stored in Supabase as readable text. Anyone with the Daybook password or Supabase service-role access can read them. Use the separate Documents screen to upload files to private storage; uploaded files are not end-to-end encrypted.</span></div>
    {(expiredCount > 0 || dueSoonCount > 0) && <div className="personal-due-summary" role="status"><Bell size={16} /><span>{expiredCount > 0 ? `${expiredCount} expired` : ""}{expiredCount > 0 && dueSoonCount > 0 ? " · " : ""}{dueSoonCount > 0 ? `${dueSoonCount} due soon` : ""}. Review the dates below.</span></div>}
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search personal records" placeholder="Search title, holder, number..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select aria-label="Filter personal records" style={{ width: 165 }} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All records</option><option>Identity</option><option>Insurance</option><option>License</option><option>Certificate</option><option>Other</option></Select><Badge>{visibleRecords.length} {visibleRecords.length === 1 ? "record" : "records"}</Badge></div>
    <div className="personal-record-list">{visibleRecords.map((record) => {
      const due = dueLabel(record);
      return <Card className="personal-record-card" key={record.id}>
        <div className="personal-record-head"><div className="personal-record-title"><div className="personal-record-icon"><FileText size={17} /></div><div><h2>{record.title}</h2><p>{record.type}{record.holder ? ` · ${record.holder}` : ""}{record.issuer ? ` · ${record.issuer}` : ""}</p></div></div><div className="personal-record-actions"><Badge tone={due.tone}>{due.text}</Badge><button className="icon-button" aria-label={`Edit ${record.title}`} onClick={() => setEditor({ initial: record })}><Pencil size={14} /></button><button className="icon-button" aria-label={`Copy ${record.title}`} onClick={() => { const { id, ...copy } = record; void id; onSave(copy); }}><Copy size={14} /></button><button className="icon-button" aria-label={`Archive ${record.title}`} onClick={() => onDelete(record)}><Archive size={14} /></button></div></div>
        <div className="personal-record-details">
          {record.recordNumber && <div><span>Document / policy number</span><strong>{record.recordNumber}</strong></div>}
          {record.issueDate && <div><span>Issue date</span><strong>{dateLabel(record.issueDate)}</strong></div>}
          {record.dueDate && <div><span>Expiry / renewal</span><strong>{dateLabel(record.dueDate)}</strong></div>}
          {record.additionalFields.map((field, index) => field.label || field.value ? <div key={index}><span>{field.label || "Additional detail"}</span><strong>{field.value || "—"}</strong></div> : null)}
        </div>
        {record.notes && <p className="personal-record-notes"><LinkifiedText>{record.notes}</LinkifiedText></p>}
        {record.documentLink && <a className="personal-document-link" href={record.documentLink} target="_blank" rel="noopener noreferrer"><FileText size={14} /> Open shared document link</a>}
      </Card>;
    })}</div>
    {!visibleRecords.length && <Card><EmptyState icon={<FileText size={18} />} title={records.length ? "No matching records" : "No personal records yet"} description={records.length ? "Try another search or record type." : "Add a record for an ID, insurance policy, license or other frequently needed information."} /></Card>}
    {editor && <PersonalRecordModal key={editor.initial?.id ?? "new-personal-record"} initial={editor.initial} onClose={() => setEditor(null)} onSave={(record) => { onSave(record, editor.initial?.id); setEditor(null); }} />}
  </>;
}

type DocumentDetails = Pick<DocumentAttachment, "title" | "personName" | "notes"> & { externalLink: string };

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes <= 0) return "0 B";
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentModal({ initial, onClose, onSave }: {
  initial: DocumentAttachment | null;
  onClose: () => void;
  onSave: (details: DocumentDetails, file: File | undefined, id?: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [personName, setPersonName] = useState(initial?.personName ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [externalLink, setExternalLink] = useState(initial?.externalLink ?? "");
  const [file, setFile] = useState<File | undefined>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const accept = Object.keys(DOCUMENT_FILE_TYPES).join(",");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Enter a document name.");
      return;
    }
    if (externalLink.trim() && (externalLink.trim().length > 2048 || !isSafeExternalLink(externalLink.trim()))) {
      setError("Enter a valid HTTPS link to the document.");
      return;
    }
    if (file && !getDocumentFileType(file.name)) {
      setError("Choose a PDF, image, text, spreadsheet, presentation, or Word document.");
      return;
    }
    if (file && file.size > MAX_DOCUMENT_FILE_BYTES) {
      setError("Choose a file no larger than 10 MB.");
      return;
    }
    if (file && file.size > 5 * 1024 * 1024 &&
      !window.confirm(`${file.name} is ${formatFileSize(file.size)}. Upload this large file to private Supabase Storage? Each file is limited to 10 MB.`)) {
      setError("Upload cancelled. Choose a smaller file or confirm the large-file upload.");
      return;
    }
    setBusy(true);
    try {
      await onSave({ title: title.trim(), personName: personName.trim(), notes: notes.trim(), externalLink: externalLink.trim() }, file, initial?.id);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The document could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return <Modal title={initial ? "Edit document details" : "Add a document"} onClose={onClose} wide>
    <form onSubmit={(event) => void submit(event)}><div className="form-grid">
      <Field className="full" label="Document name"><Input autoFocus required maxLength={120} placeholder="e.g. Aadhaar card, PAN card" value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
      <Field className="full" label="Belongs to (person's name)"><Input maxLength={120} placeholder="Optional" value={personName} onChange={(event) => setPersonName(event.target.value)} /></Field>
      <Field className="full" label={initial?.storagePath ? "Replace uploaded file (optional)" : "Attach a file (optional)"}><input className="field document-file-input" type="file" accept={accept} onChange={(event) => setFile(event.currentTarget.files?.[0])} /><span className="section-description">{initial?.storagePath ? `The current file (${initial.fileName}) is kept unless you choose a replacement or remove it from the document row.` : "Files are stored privately in Supabase Storage. Maximum 10 MB per file."}</span></Field>
      {initial?.storagePath && !file && <div className="alert full"><FileText size={14} /> The existing uploaded file will be kept when you save these details. Choose a file above to replace it, or use Remove uploaded file on the document row to delete it.</div>}
      <Field className="full" label="External document link (optional)"><ExternalLinkInput maxLength={2048} placeholder="https://…" value={externalLink} onChange={(event) => setExternalLink(event.target.value)} /><span className="section-description">Use a direct HTTPS link. You can add a link, upload a file, or include both.</span></Field>
      <Field className="full" label="Notes (optional)"><textarea className="field textarea" rows={3} maxLength={2000} placeholder="Optional notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
    </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving to Supabase..." : initial ? "Save details" : "Save document"}</Button></div></form>
  </Modal>;
}

function DocumentViewer({ document, onClose }: { document: DocumentAttachment; onClose: () => void }) {
  const source = `/api/documents?path=${encodeURIComponent(document.storagePath)}`;
  const isImage = document.contentType.startsWith("image/");
  return <Modal title={document.title} onClose={onClose} wide><div className="document-viewer">
    {isImage ? <img src={source} alt={document.title} /> : <iframe title={document.title} src={source} />}
  </div></Modal>;
}

function DocumentManager({ documents, archivedDocumentCount, totalStoredBytes, onSave, onCopy, onArchive, onRemoveFile }: {
  documents: DocumentAttachment[];
  archivedDocumentCount: number;
  totalStoredBytes: number;
  onSave: (details: DocumentDetails, file: File | undefined, id?: string) => Promise<void>;
  onCopy: (document: DocumentAttachment) => void;
  onArchive: (document: DocumentAttachment) => void;
  onRemoveFile: (document: DocumentAttachment) => void;
}) {
  const [editor, setEditor] = useState<{ initial: DocumentAttachment | null } | null>(null);
  const [viewer, setViewer] = useState<DocumentAttachment | null>(null);
  const [search, setSearch] = useState("");
  const percentUsed = totalStoredBytes / (1024 * 1024 * 1024) * 100;
  const visible = documents.filter((document) =>
    `${document.title} ${document.personName} ${document.fileName} ${document.externalLink ?? ""} ${document.notes}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

  return <><PageHeading eyebrow="Private file storage" title="Documents" subtitle="Keep important household documents together using private uploads, external links, or both." action={<Button onClick={() => setEditor({ initial: null })}><Plus size={15} /> Add document</Button>} />
    <div className="alert"><LockKeyhole size={15} style={{ flex: "none", marginTop: 1 }} /><span>Uploaded files are stored in a private Supabase Storage bucket and document records are saved to Supabase before the form closes. A record can also be saved without a file, then edited later to upload one. External HTTPS links are stored as document details and open in a new tab. Anyone with the shared Daybook password can access uploaded files. Files are protected by access controls, not end-to-end encrypted.</span></div>
    <Card className="document-storage-summary"><div className="card-head"><div><h2 className="section-title">Storage overview</h2><p className="section-description">1 GB Supabase Free-plan file storage; each document can be up to 10 MB.</p></div><Database size={16} /></div><div className="document-storage-stats"><span>{documents.length} active {documents.length === 1 ? "document" : "documents"}</span><span>{archivedDocumentCount} archived</span><strong>{formatFileSize(totalStoredBytes)} tracked ({percentUsed.toFixed(1)}% of 1 GB)</strong></div><div className="document-storage-track" role="progressbar" aria-valuenow={Math.min(100, percentUsed)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(100, percentUsed)}%` }} /></div>{percentUsed >= 75 && <p className={`document-storage-warning${percentUsed >= 90 ? " near-limit" : ""}`} role="status">{percentUsed >= 90 ? "Document storage is nearly full. Download and permanently remove files you no longer need." : "Document storage is getting full. This estimate includes Daybook files only, not other files in the Supabase project."}</p>}</Card>
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search documents" placeholder="Search name, person, file, notes..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Badge>{visible.length} {visible.length === 1 ? "document" : "documents"}</Badge></div>
    {visible.length ? <div className="document-list">{visible.map((document) => {
      const hasFile = Boolean(document.storagePath);
      const canPreview = hasFile && (document.contentType === "application/pdf" || document.contentType.startsWith("image/"));
      const downloadUrl = hasFile
        ? `/api/documents?path=${encodeURIComponent(document.storagePath)}&download=1&name=${encodeURIComponent(document.fileName)}`
        : "";
      return <Card className="document-card" key={document.id}><div className="document-card-main"><div className="document-icon"><FileText size={18} /></div><div className="document-card-info"><h2>{document.title}</h2><p>{document.personName ? `For ${document.personName} · ` : ""}{hasFile ? `${document.fileName} · ${formatFileSize(document.sizeBytes)}` : document.externalLink ? "External link" : "No file attached"}</p>{document.notes && <div className="document-notes"><LinkifiedText>{document.notes}</LinkifiedText></div>}<small>Added {dateLabel(document.uploadedAt.slice(0, 10))}</small></div></div><div className="document-card-actions">
        {canPreview && <Button variant="outline" onClick={() => setViewer(document)}><Eye size={14} />View</Button>}
        {hasFile && <a className="button button-outline document-download" href={downloadUrl} target="_blank" rel="noopener noreferrer"><Download size={14} />Download</a>}
        {document.externalLink && <a className="button button-outline document-download" href={document.externalLink} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />Open link</a>}
        {hasFile && <button className="icon-button" aria-label={`Remove uploaded file from ${document.title}`} title="Remove uploaded file" onClick={() => onRemoveFile(document)}><Trash2 size={14} /></button>}
        <button className="icon-button" aria-label={`Edit ${document.title}`} onClick={() => setEditor({ initial: document })}><Pencil size={14} /></button>
        <button className="icon-button" aria-label={`Copy record for ${document.title}`} title="Create a record without copying the uploaded file" onClick={() => onCopy(document)}><Copy size={14} /></button>
        <button className="icon-button" aria-label={`Archive ${document.title}`} onClick={() => onArchive(document)}><Archive size={14} /></button>
      </div></Card>;
    })}</div> : <Card><EmptyState icon={<FileDown size={18} />} title={documents.length ? "No matching documents" : "No documents uploaded yet"} description={documents.length ? "Try another search." : "Add a document record now and attach a file later if you prefer."} /></Card>}
    {editor && <DocumentModal key={editor.initial?.id ?? "new-document"} initial={editor.initial} onClose={() => setEditor(null)} onSave={onSave} />}
    {viewer && <DocumentViewer document={viewer} onClose={() => setViewer(null)} />}
  </>;
}

const emptyCredential = (): Omit<CredentialRecord, "id"> => ({
  provider: "",
  category: "Other",
  website: "",
  username: "",
  password: "",
  recoveryInfo: "",
  notes: "",
  tags: [],
  additionalFields: [],
});

function CredentialModal({ initial, onClose, onSave }: {
  initial: CredentialRecord | null;
  onClose: () => void;
  onSave: (record: Omit<CredentialRecord, "id">) => Promise<void>;
}) {
  const [record, setRecord] = useState<Omit<CredentialRecord, "id">>(initial
    ? { ...initial, additionalFields: [...initial.additionalFields], tags: [...initial.tags] }
    : emptyCredential());
  const [tagsText, setTagsText] = useState(initial?.tags.join(", ") ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function loadExample() {
    setRecord({
      ...emptyCredential(),
      provider: "Email provider",
      category: "Email",
      website: "https://accounts.example.com/",
      username: "name@example.com",
      recoveryInfo: "Example recovery email or phone",
      notes: "Fictional example. Replace with your own details before saving.",
      tags: ["personal", "example"],
      additionalFields: [{ label: "Account type", value: "Personal" }],
    });
    setTagsText("personal, example");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (record.website) {
      try {
        if (new URL(record.website).protocol !== "https:") throw new Error();
      } catch {
        setError("Enter a valid HTTPS sign-in link, or leave it blank.");
        return;
      }
    }
    setSaving(true);
    try {
      await onSave({
        ...record,
        provider: record.provider.trim(),
        website: record.website.trim(),
        tags: [...new Set(tagsText.split(",").map((tag) => tag.trim()).filter(Boolean))],
        additionalFields: record.additionalFields.filter((field) => field.label.trim() || field.value.trim())
          .map((field) => ({ label: field.label.trim(), value: field.value.trim() })),
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The credential could not be encrypted and saved.");
    } finally {
      setSaving(false);
    }
  }

  return <Modal title={initial ? "Edit account" : "Add account"} onClose={onClose} wide>
    <form onSubmit={(event) => void submit(event)}>
      {!initial && <div style={{ marginBottom: 14 }}><Button type="button" variant="outline" size="sm" onClick={loadExample}>Load fictional example</Button><span className="section-description" style={{ marginLeft: 9 }}>Nothing is saved until you submit.</span></div>}
      <div className="form-grid">
        <Field label="Provider / account name"><Input required maxLength={120} autoComplete="off" placeholder="Example: Email provider" value={record.provider} onChange={(event) => setRecord((current) => ({ ...current, provider: event.target.value }))} /></Field>
        <Field label="Category"><Select value={record.category} onChange={(event) => setRecord((current) => ({ ...current, category: event.target.value }))}><option>Email</option><option>Financial</option><option>Shopping</option><option>Social</option><option>Work</option><option>Other</option></Select></Field>
        <Field className="full" label="Sign-in page"><ExternalLinkInput maxLength={2000} autoComplete="url" placeholder="https://accounts.example.com/" value={record.website} onChange={(event) => setRecord((current) => ({ ...current, website: event.target.value }))} /></Field>
        <Field label="Username / email"><Input maxLength={300} autoComplete="off" value={record.username} onChange={(event) => setRecord((current) => ({ ...current, username: event.target.value }))} /></Field>
        <div className="field-wrap"><label className="field-label" htmlFor="credential-password">Password</label><div className="credential-secret-field"><Input id="credential-password" aria-label="Account password" type={showPassword ? "text" : "password"} maxLength={2000} autoComplete="new-password" value={record.password} onChange={(event) => setRecord((current) => ({ ...current, password: event.target.value }))} /><button className="icon-button" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></div>
        <Field className="full" label="Recovery information"><Input maxLength={500} autoComplete="off" placeholder="Optional recovery contact or instructions" value={record.recoveryInfo} onChange={(event) => setRecord((current) => ({ ...current, recoveryInfo: event.target.value }))} /></Field>
        <Field className="full" label="Tags (comma-separated)"><Input maxLength={500} placeholder="personal, family, work" value={tagsText} onChange={(event) => setTagsText(event.target.value)} /></Field>
        <Field className="full" label="Additional notes"><textarea className="field textarea" rows={3} maxLength={3000} value={record.notes} onChange={(event) => setRecord((current) => ({ ...current, notes: event.target.value }))} /></Field>
        <div className="personal-fields full"><div className="personal-fields-head"><div><span className="field-label">Custom fields</span><p className="section-description">Searchable once the vault is unlocked.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setRecord((current) => ({ ...current, additionalFields: [...current.additionalFields, { label: "", value: "" }] }))}><Plus size={13} />Add field</Button></div>
          {record.additionalFields.map((field, index) => <div className="personal-field-row" key={index}><Input aria-label={`Custom field ${index + 1} name`} maxLength={80} placeholder="Field name" value={field.label} onChange={(event) => setRecord((current) => ({ ...current, additionalFields: current.additionalFields.map((entry, fieldIndex) => fieldIndex === index ? { ...entry, label: event.target.value } : entry) }))} /><Input aria-label={`Custom field ${index + 1} value`} maxLength={500} placeholder="Value" value={field.value} onChange={(event) => setRecord((current) => ({ ...current, additionalFields: current.additionalFields.map((entry, fieldIndex) => fieldIndex === index ? { ...entry, value: event.target.value } : entry) }))} /><button type="button" className="icon-button" aria-label="Remove custom field" onClick={() => setRecord((current) => ({ ...current, additionalFields: current.additionalFields.filter((_, fieldIndex) => fieldIndex !== index) }))}><Trash2 size={14} /></button></div>)}
        </div>
      </div>
      {error && <div className="alert alert-error" style={{ marginTop: 13 }} role="alert">{error}</div>}
      <div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Encrypting..." : initial ? "Encrypt and save" : "Encrypt and add"}</Button></div>
    </form>
  </Modal>;
}

function CredentialVaultPage({ vault, onSave, onDelete }: {
  vault?: EncryptedCredentialVault;
  onSave: (vault: EncryptedCredentialVault) => void;
  onDelete: () => void;
}) {
  const [unlocked, setUnlocked] = useState<UnlockedCredentialVault | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [search, setSearch] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<CredentialRecord | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastSavedCiphertext = useRef(vault?.ciphertext ?? "");

  useEffect(() => {
    if (!vault || !unlocked || vault.ciphertext === lastSavedCiphertext.current) return;
    let active = true;
    void decryptCredentialVaultWithKey(vault, unlocked.key).then((records) => {
      if (!active) return;
      lastSavedCiphertext.current = vault.ciphertext;
      setUnlocked((current) => current ? { ...current, records } : current);
      setError("");
    }).catch((caught: unknown) => {
      if (!active) return;
      setUnlocked(null);
      setError(caught instanceof Error ? `Vault was locked because its shared data changed: ${caught.message}` : "Vault was locked because its shared data changed. Unlock it again.");
    });
    return () => { active = false; };
  }, [vault?.ciphertext, unlocked?.key]);

  async function createVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 12) {
      setError("Use a vault passphrase of at least 12 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The vault passphrases do not match.");
      return;
    }
    setBusy(true);
    try {
      const created = await createCredentialVault(password);
      lastSavedCiphertext.current = created.vault.ciphertext;
      setUnlocked({ key: created.key, records: [] });
      setPassword("");
      setConfirmPassword("");
      onSave(created.vault);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the encrypted vault.");
    } finally {
      setBusy(false);
    }
  }

  async function openVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vault) return;
    setError("");
    setBusy(true);
    try {
      const opened = await unlockCredentialVault(vault, password);
      lastSavedCiphertext.current = vault.ciphertext;
      setUnlocked(opened);
      setPassword("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not unlock the credential vault.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRecords(records: CredentialRecord[]) {
    if (!vault || !unlocked) throw new Error("Unlock the credential vault before saving.");
    const encrypted = await updateCredentialVault(records, unlocked.key, vault);
    lastSavedCiphertext.current = encrypted.ciphertext;
    setUnlocked({ ...unlocked, records });
    onSave(encrypted);
  }

  function lockVault() {
    setUnlocked(null);
    setPassword("");
    setConfirmPassword("");
    setSearch("");
    setVisiblePasswords(new Set());
    setEditor(undefined);
  }

  if (!unlocked) return <>
    <PageHeading eyebrow="Private account vault" title="Account credentials" subtitle="Keep sign-in details together, encrypted before they enter shared storage." />
    <div className="alert"><LockKeyhole size={15} style={{ flex: "none", marginTop: 1 }} /><span>The vault encrypts account details in this browser with AES-256-GCM and your separate passphrase. GitHub and backup files receive ciphertext, not readable credentials. This protects stored files, not a compromised browser, device, or deployed app; the app can handle details while unlocked. Use a unique passphrase and keep a safe backup: if you forget it, the data cannot be recovered. A browser vault is not a replacement for a dedicated password manager; do not store bank PINs, one-time codes, or recovery codes here.</span></div>
    <Card className="credential-lock-card">
      <div className="credential-lock-icon"><KeyRound size={20} /></div>
      <h2>{vault ? "Unlock your account vault" : "Create your account vault"}</h2>
      <p>{vault ? "Use the same vault passphrase on each device. It is separate from your Daybook access password." : "Choose a unique passphrase of at least 12 characters. It is never sent to the server."}</p>
      <form className="credential-lock-form" onSubmit={(event) => void (vault ? openVault(event) : createVault(event))}>
        <Field label="Vault passphrase"><Input type="password" autoComplete={vault ? "current-password" : "new-password"} maxLength={256} required value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
        {!vault && <Field label="Confirm vault passphrase"><Input type="password" autoComplete="new-password" maxLength={256} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></Field>}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <Button type="submit" disabled={busy}>{busy ? "Working..." : vault ? "Unlock vault" : "Create encrypted vault"}</Button>
        {vault && <Button type="button" variant="danger" disabled={busy} onClick={() => {
          if (!window.confirm("Remove the encrypted credential vault from current shared data? Other Daybook records will remain. Older encrypted copies remain in Git history.")) return;
          onDelete();
          setError("");
        }}>Delete encrypted vault</Button>}
      </form>
    </Card>
  </>;

  const query = search.trim().toLocaleLowerCase();
  const records = unlocked.records.filter((record) => [
    record.provider, record.category, record.website, record.username, record.recoveryInfo,
    record.notes, ...record.tags, ...record.additionalFields.flatMap((field) => [field.label, field.value]),
  ].some((value) => value.toLocaleLowerCase().includes(query)));

  return <>
    <PageHeading eyebrow="Private account vault" title="Account credentials" subtitle="Search and manage your encrypted account details." action={<div className="credential-page-actions"><Button onClick={() => setEditor(null)}><Plus size={15} /> Add account</Button><Button variant="outline" onClick={lockVault}><LockKeyhole size={14} /> Lock vault</Button></div>} />
    <div className="alert"><LockKeyhole size={15} style={{ flex: "none", marginTop: 1 }} /><span>Encrypted with your separate vault passphrase before syncing. Search covers provider, category, sign-in link, username, recovery info, tags, notes and custom fields, but never passwords. Lock the vault when finished. Do not store bank PINs, one-time codes, or recovery codes.</span></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search account credentials" placeholder="Search provider, username, tags, notes..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Badge>{records.length} {records.length === 1 ? "account" : "accounts"}</Badge></div>
    <div className="credential-list">{records.map((record) => <Card className="credential-card" key={record.id}>
      <div className="credential-card-head"><div className="credential-card-title"><div className="credential-icon"><KeyRound size={17} /></div><div><h2>{record.provider}</h2><p>{record.category}{record.username ? ` · ${record.username}` : ""}</p></div></div><div className="personal-record-actions"><button className="icon-button" aria-label={`Edit ${record.provider}`} onClick={() => setEditor(record)}><Pencil size={14} /></button><button className="icon-button" aria-label={`Duplicate ${record.provider} credential`} title="Duplicate encrypted credential" onClick={() => { if (window.confirm(`Create a second encrypted copy of the ${record.provider} credential?`)) void saveRecords([{ ...record, id: createId(), provider: copyLabel(record.provider, 120), tags: [...record.tags], additionalFields: record.additionalFields.map((field) => ({ ...field })) }, ...unlocked.records]).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not duplicate the credential.")); }}><Copy size={14} /></button><button className="icon-button" aria-label={`Delete ${record.provider}`} onClick={() => { if (window.confirm(`Delete the ${record.provider} account from the vault?`)) void saveRecords(unlocked.records.filter((entry) => entry.id !== record.id)).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not update the vault.")); }}><Trash2 size={14} /></button></div></div>
      {record.website && <a className="personal-document-link" href={record.website} target="_blank" rel="noopener noreferrer">{record.website}</a>}
      {record.password && <div className="credential-password-row"><span>Password</span><code>{visiblePasswords.has(record.id) ? record.password : "••••••••••••"}</code><button className="icon-button" type="button" aria-label={visiblePasswords.has(record.id) ? `Hide ${record.provider} password` : `Show ${record.provider} password`} onClick={() => setVisiblePasswords((visible) => { const next = new Set(visible); if (next.has(record.id)) next.delete(record.id); else next.add(record.id); return next; })}>{visiblePasswords.has(record.id) ? <EyeOff size={14} /> : <Eye size={14} />}</button></div>}
      {record.recoveryInfo && <p className="credential-secondary"><strong>Recovery:</strong> {record.recoveryInfo}</p>}
      {record.additionalFields.map((field, index) => field.label || field.value ? <p className="credential-secondary" key={index}><strong>{field.label || "Additional detail"}:</strong> {field.value}</p> : null)}
      {record.tags.length > 0 && <div className="credential-tags">{record.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>}
      {record.notes && <p className="personal-record-notes"><LinkifiedText>{record.notes}</LinkifiedText></p>}
    </Card>)}</div>
    {!records.length && <Card><EmptyState icon={<KeyRound size={18} />} title={unlocked.records.length ? "No matching accounts" : "No accounts in the vault"} description={unlocked.records.length ? "Try another search." : "Add an account or load the fictional example from the add form to see the available fields."} /></Card>}
    {editor !== undefined && <CredentialModal key={editor?.id ?? "new-credential"} initial={editor} onClose={() => setEditor(undefined)} onSave={async (record) => {
      const saved: CredentialRecord = { ...record, id: editor?.id ?? createId() };
      const next = editor
        ? unlocked.records.map((entry) => entry.id === editor.id ? saved : entry)
        : [saved, ...unlocked.records];
      await saveRecords(next);
    }} />}
  </>;
}

function DataManagement({ data, currency, darkMode, fontSize, fontStyle, fontFamily, accentColor, darkTheme, visualTheme, dashboardWidgets, groupMenus, menuSortOrder, syncStatus, syncMessage, refreshing, onCurrencyChange, onToggleDarkMode, onFontSizeChange, onFontStyleChange, onFontFamilyChange, onAccentChange, onDarkThemeChange, onVisualThemeChange, onToggleDashboardWidget, onGroupMenusChange, onMenuSortOrderChange, onImport, onClear, onExport, onSaveNow, onRefresh, onSignOut }: { data: TrackerData; currency: Currency; darkMode: boolean; fontSize: FontSize; fontStyle: FontStyle; fontFamily: FontFamily; accentColor: AccentColor; darkTheme: DarkTheme; visualTheme: VisualTheme; dashboardWidgets: DashboardWidget[]; groupMenus: boolean; menuSortOrder: MenuSortOrder; syncStatus: "saved" | "saving" | "error"; syncMessage: string; refreshing: boolean; onCurrencyChange: (currency: Currency) => void; onToggleDarkMode: () => void; onFontSizeChange: (size: FontSize) => void; onFontStyleChange: (style: FontStyle) => void; onFontFamilyChange: (family: FontFamily) => void; onAccentChange: (color: AccentColor) => void; onDarkThemeChange: (theme: DarkTheme) => void; onVisualThemeChange: (theme: VisualTheme) => void; onToggleDashboardWidget: (widget: DashboardWidget) => void; onGroupMenusChange: (groupMenus: boolean) => void; onMenuSortOrderChange: (order: MenuSortOrder) => void; onImport: (file: File) => void; onClear: () => void; onExport: () => void; onSaveNow: () => void; onRefresh: () => void; onSignOut: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <><PageHeading eyebrow="Your data, your way" title="Data management" subtitle="Your records sync through Supabase and can be backed up or moved whenever you like." />
    <div className="alert"><Sparkles size={15} style={{ flex: "none", marginTop: 1 }} /><span>Daybook records sync to Supabase. Account credentials are encrypted separately; other records remain readable to people with the Daybook password or Supabase service-role access. Sign in with your Daybook access password on each device. Display preferences stay in this browser.</span></div>
    <Card className="settings-card theme-picker-card">
      <div className="card-head"><div><h2 className="section-title">Choose your look</h2><p className="section-description">Preview a visual style across every page. Your choice is saved on this browser.</p></div><Palette size={18} /></div>
      <div className="theme-picker" role="group" aria-label="Visual theme">
        {VISUAL_THEMES.map((theme) => <button key={theme} type="button" className={`theme-option ${visualTheme === theme ? "selected" : ""}`} aria-pressed={visualTheme === theme} onClick={() => onVisualThemeChange(theme)}>
          <span className={`theme-preview theme-preview-${theme}`} aria-hidden="true"><span className="theme-preview-rail" /><span className="theme-preview-content"><i /><i /><i /></span><span className="theme-preview-accent" /></span>
          <span className="theme-option-label">{theme === "sage" ? "Sage studio" : theme === "cloud" ? "Cloud canvas" : "Warm sand"}</span>
          <span className="theme-option-description">{theme === "sage" ? "Fresh, balanced greens" : theme === "cloud" ? "Cool, crisp neutrals" : "Soft, warm neutrals"}</span>
          {visualTheme === theme && <Check size={15} className="theme-option-check" aria-label="Selected" />}
        </button>)}
      </div>
    </Card>
    <Card className="settings-card"><div className="card-head"><div><h2 className="section-title">Navigation menu</h2><p className="section-description">Reduce sidebar clutter by grouping screens. Choose the menu order used within groups, or across the flat menu.</p></div><ListTree size={17} /></div><div className="settings-grid navigation-settings-grid"><label className="dashboard-widget-option"><input type="checkbox" checked={groupMenus} onChange={(event) => onGroupMenusChange(event.target.checked)} /><span><strong>Group menus by category</strong><small>{groupMenus ? "Groups start collapsed; the active section opens automatically." : "Show every screen in one flat list."}</small></span></label><Field label="Menu order"><Select value={menuSortOrder} onChange={(event) => onMenuSortOrderChange(event.target.value as MenuSortOrder)}><option value="current">Current order</option><option value="ascending">Ascending (A–Z)</option></Select></Field></div></Card>
    <Card className="dashboard-widget-settings"><div className="card-head"><div><h2 className="section-title">Choose dashboard cards</h2><p className="section-description">Select the screens you want to see on your Dashboard. These choices are saved in this browser.</p></div><LayoutDashboard size={17} /></div><div className="dashboard-widget-options">{DASHBOARD_WIDGET_OPTIONS.map((option) => <label className="dashboard-widget-option" key={option.id}><input type="checkbox" checked={dashboardWidgets.includes(option.id)} onChange={() => onToggleDashboardWidget(option.id)} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>)}</div></Card>
    <div className="settings-grid"><Card className="settings-card"><div className="settings-icon"><Settings2 size={17} /></div><h3>Appearance & currency</h3><p>Choose a font family, font style and size, accent color, dark background theme and display currency. Currency formatting does not convert amounts.</p><Field label="Currency"><Select value={currency} onChange={(event) => onCurrencyChange(event.target.value as Currency)}>{CURRENCIES.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field><Field label="Font family"><Select value={fontFamily} onChange={(event) => onFontFamilyChange(event.target.value as FontFamily)}>{FONT_FAMILIES.map((option) => <option key={option} value={option}>{FONT_FAMILY_LABELS[option]}</option>)}</Select></Field><Field label="Font style"><Select value={fontStyle} onChange={(event) => onFontStyleChange(event.target.value as FontStyle)}><option value="modern">Modern</option><option value="editorial">Editorial</option><option value="rounded">Rounded</option></Select></Field><Field label="Font size"><Select value={fontSize} onChange={(event) => onFontSizeChange(event.target.value as FontSize)}><option value="extra-small">Extra small (82%)</option><option value="small">Small (92%)</option><option value="medium">Default (100%)</option><option value="large">Large (108%)</option><option value="extra-large">Extra large (116%)</option><option value="xx-large">Maximum (124%)</option></Select></Field><Field label="Accent color"><Select value={accentColor} onChange={(event) => onAccentChange(event.target.value as AccentColor)}>{ACCENT_COLORS.map((option) => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}</Select></Field><Field label="Dark mode background"><Select value={darkTheme} onChange={(event) => onDarkThemeChange(event.target.value as DarkTheme)}>{DARK_THEMES.map((option) => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}</Select></Field><Button className="preference-toggle" variant="outline" onClick={onToggleDarkMode}>{darkMode ? <Sun size={14} /> : <Moon size={14} />}{darkMode ? "Switch to light mode" : "Switch to dark mode"}</Button></Card>
      <Card className="settings-card"><div className="settings-icon"><Database size={17} /></div><h3>Supabase sync</h3><p>Changes save automatically. Other devices check for updates when opened and every two minutes while the app is active.</p><p role="status">{syncStatus === "saving" ? "Saving shared data…" : syncStatus === "error" ? syncMessage || "Not synced. Check your connection." : syncMessage || "All changes saved."}</p><div className="connector-actions"><Button variant="outline" onClick={onSaveNow} disabled={syncStatus === "saving"}><Download size={14} />Save now</Button><Button variant="outline" onClick={onRefresh} disabled={syncStatus === "saving" || refreshing}><RefreshCw size={14} className={refreshing ? "spin" : ""} />{refreshing ? "Refreshing…" : "Refresh"}</Button></div><Button variant="outline" onClick={onSignOut}>Sign out</Button></Card>
      <Card className="settings-card"><div className="settings-icon"><FileJson2 size={17} /></div><h3>Download a backup</h3><p>Save your shopping data, product and store master data, and reminders as versioned JSON.</p><Button variant="outline" onClick={onExport}><Download size={14} /> Download JSON backup</Button></Card>
      <Card className="settings-card"><div className="settings-icon"><FileDown size={17} /></div><h3>Export for spreadsheets</h3><p>Take your purchase history with you in an Excel-friendly CSV file.</p><Button variant="outline" onClick={() => {
        const blob = new Blob([exportCsv(data.purchases)], { type: "text/csv;charset=utf-8" });
        downloadBlob(blob, `daybook-purchases-${today()}.csv`);
      }}><ArrowDownToLine size={14} /> Export purchases CSV</Button></Card>
      <Card className="settings-card"><div className="settings-icon"><Upload size={17} /></div><h3>Restore a backup</h3><p>Import a Daybook JSON backup. Your current data will be replaced after validation.</p><input ref={inputRef} className="sr-only" type="file" accept=".json,application/json" aria-label="Choose a JSON backup" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.currentTarget.value = ""; }} /><Button variant="outline" onClick={() => inputRef.current?.click()}><Upload size={14} /> Choose JSON file</Button></Card>
      <Card className="settings-card danger-card"><div className="settings-icon"><Trash2 size={17} /></div><h3>Clear all data</h3><p>Remove your shopping list, trips and purchase history from this browser. This cannot be undone.</p><Button variant="danger" onClick={onClear}><Trash2 size={14} /> Clear my data</Button></Card></div>
    <Card style={{ marginTop: 16 }}><div className="card-head"><div><h2 className="section-title">At a glance</h2><p className="section-description">What's saved in shared data right now</p></div><Database size={16} color="#829080" /></div><div className="stat-grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}><div><div className="stat-foot">Shopping list items</div><div className="table-primary" style={{ fontSize: 18, marginTop: 5 }}>{data.items.length}</div></div><div><div className="stat-foot">Purchases recorded</div><div className="table-primary" style={{ fontSize: 18, marginTop: 5 }}>{data.purchases.length}</div></div><div><div className="stat-foot">Shopping trips</div><div className="table-primary" style={{ fontSize: 18, marginTop: 5 }}>{data.trips.length}</div></div><div><div className="stat-foot">Saved products</div><div className="table-primary" style={{ fontSize: 18, marginTop: 5 }}>{(data.products ?? []).length}</div></div><div><div className="stat-foot">Saved stores</div><div className="table-primary" style={{ fontSize: 18, marginTop: 5 }}>{(data.stores ?? []).length}</div></div><div><div className="stat-foot">Notes & reminders</div><div className="table-primary" style={{ fontSize: 18, marginTop: 5 }}>{(data.reminders ?? []).length}</div></div><div><div className="stat-foot">Tracked stocks</div><div className="table-primary" style={{ fontSize: 18, marginTop: 5 }}>{(data.stocks ?? []).length}</div></div><div><div className="stat-foot">Saved stock prices</div><div className="table-primary" style={{ fontSize: 18, marginTop: 5 }}>{(data.stockQuotes ?? []).length}</div></div></div></Card>
  </>;
}

let googleIdentityLoading: Promise<void> | null = null;
function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (!googleIdentityLoading) {
    googleIdentityLoading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => window.google?.accounts.oauth2
        ? resolve()
        : reject(new Error("Google sign-in loaded without the authorization client."));
      script.onerror = () => reject(new Error("Google sign-in could not be loaded. Check your connection and try again."));
      document.head.appendChild(script);
    }).catch((caught: unknown) => {
      googleIdentityLoading = null;
      throw caught;
    });
  }
  return googleIdentityLoading;
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeSubject(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

type GmailSession = { email: string; accessToken: string };

function GmailAuthorization({ onSignIn }: { onSignIn: (session: GmailSession) => void }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const [googleReady, setGoogleReady] = useState(Boolean(window.google?.accounts.oauth2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(clientId ? "" : "Google OAuth is not configured. Set VITE_GOOGLE_CLIENT_ID in .env.local for local development and in Vercel Environment Variables for the deployed app.");

  useEffect(() => {
    if (!clientId || googleReady) return;
    let active = true;
    loadGoogleIdentity().then(() => {
      if (active) setGoogleReady(true);
    }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : "Could not load Google sign-in.");
    });
    return () => { active = false; };
  }, [clientId, googleReady]);

  function signIn() {
    setError("");
    if (!clientId) {
      setError("Google OAuth is not configured. Add VITE_GOOGLE_CLIENT_ID to your local environment and Vercel project settings.");
      return;
    }
    if (!window.google?.accounts.oauth2) {
      setError("Google sign-in is still loading. Please try again in a moment.");
      return;
    }
    setBusy(true);
    try {
      window.google?.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email https://www.googleapis.com/auth/gmail.send",
        callback: async (response) => {
          if (response.error) {
            setBusy(false);
            setError(response.error_description || `Google authorization failed: ${response.error}`);
            return;
          }
          if (!response.access_token) {
            setBusy(false);
            setError("Google did not return an access token. Please try connecting again.");
            return;
          }
          try {
            const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
              headers: { Authorization: `Bearer ${response.access_token}` },
            });
            if (!profileResponse.ok) {
              throw new Error(`Could not read the signed-in Google account (${profileResponse.status}).`);
            }
            const profile: unknown = await profileResponse.json();
            if (typeof profile !== "object" || profile === null || !("email" in profile) ||
              typeof profile.email !== "string" || !("email_verified" in profile) || profile.email_verified !== true) {
              throw new Error("Google did not provide a verified email address for this account.");
            }
            onSignIn({ email: profile.email, accessToken: response.access_token });
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not finish Google sign-in.");
          } finally {
            setBusy(false);
          }
        },
        error_callback: (response) => {
          setBusy(false);
          setError(response.message || `Google sign-in failed: ${response.type}`);
        },
      }).requestAccessToken({ prompt: "consent select_account" });
    } catch (caught) {
      setBusy(false);
      setError(caught instanceof Error ? caught.message : "Could not start Google sign-in.");
    }
  }

  return <div className="gmail-authorization">
    <Button type="button" disabled={busy || !clientId || !googleReady} onClick={signIn}>{busy ? "Connecting..." : !clientId ? "Google OAuth setup required" : googleReady ? "Connect Gmail" : "Loading Google sign-in..."}</Button>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
  </div>;
}

function TestConnectors() {
  const [session, setSession] = useState<GmailSession | null>(null);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("Daybook test reminder");
  const [content, setContent] = useState("This is a test email from your Daybook shopping tracker.");
  const [accessPassword, setAccessPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordValid, setPasswordValid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function testAccessPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordError("");
    setPasswordValid(false);
    try {
      await validateAccessPassword(accessPassword);
      setPasswordValid(true);
    } catch (caught) {
      setPasswordError(caught instanceof Error ? caught.message : "Could not validate the Daybook access password.");
    } finally {
      setAccessPassword("");
      setPasswordBusy(false);
    }
  }

  async function sendTestEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!session) {
      setError("Connect Gmail before sending a test email.");
      return;
    }
    if (/[\r\n]/.test(subject) || /[\r\n]/.test(recipient)) {
      setError("The recipient and subject must each be a single line.");
      return;
    }
    setBusy(true);
    try {
      const message = [
        `To: ${recipient.trim()}`,
        `Subject: ${encodeSubject(subject.trim())}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "",
        content,
      ].join("\r\n");
      const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encodeBase64Url(message) }),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Gmail could not send the email (${response.status}). ${detail || response.statusText}`);
      }
      setNotice(`Test email sent to ${recipient.trim()}. Check your inbox.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The test email could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return <><PageHeading eyebrow="Experiment safely" title="R&D / Test Connectors" subtitle="Test the Daybook password or try Gmail email delivery." />
    <Card className="connector-card"><div className="card-head"><div><h2 className="section-title">Daybook access password test</h2><p className="section-description">Verify the Vercel password setting without signing out or loading data again.</p></div><Badge tone="neutral">No data access</Badge></div>
      <form className="connector-form" onSubmit={(event) => void testAccessPassword(event)}>
        <Field className="full" label="Daybook access password"><Input type="password" autoComplete="current-password" maxLength={256} required value={accessPassword} onChange={(event) => { setAccessPassword(event.target.value); setPasswordValid(false); setPasswordError(""); }} /></Field>
        {passwordError && <div className="alert alert-error full" role="alert">{passwordError}</div>}
        {passwordValid && <div className="alert alert-success full" role="status">Password matches the value configured in Vercel. No new session was created and no Daybook data was accessed.</div>}
        <div className="full"><Button type="submit" disabled={passwordBusy}>{passwordBusy ? "Checking..." : "Validate password"}</Button></div>
      </form>
    </Card>
    <Card className="connector-card"><div className="card-head"><div><h2 className="section-title">Gmail test reminder</h2><p className="section-description">Connect Gmail only when you want to send a test email.</p></div><Badge tone={session ? "green" : "neutral"}>{session ? `Connected: ${session.email}` : "Not connected"}</Badge></div>
      <div className="alert"><Mail size={15} style={{ flex: "none", marginTop: 1 }} /><span>Gmail authorization is optional and requested only here. The access token stays in memory and is discarded when you leave this page or reload. The email is sent from the Google account you authorize.</span></div>
      {!session && <GmailAuthorization onSignIn={(connected) => { setSession(connected); setRecipient(connected.email); setError(""); setNotice(""); }} />}
      {session && <Button type="button" variant="outline" onClick={() => { setSession(null); setNotice(""); setError(""); }}>Disconnect Gmail</Button>}
      {session && <form className="connector-form" onSubmit={sendTestEmail}>
        <Field label="Send to"><Input type="email" autoComplete="email" required placeholder="you@example.com" value={recipient} onChange={(event) => setRecipient(event.target.value)} /></Field>
        <Field label="Subject"><Input required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} /></Field>
        <Field className="full" label="Email content"><textarea className="field textarea" required rows={6} maxLength={10000} value={content} onChange={(event) => setContent(event.target.value)} /></Field>
        {error && <div className="alert alert-error full" role="alert">{error}</div>}
        {notice && <div className="alert alert-success full" role="status">{notice}</div>}
        <div className="full"><Button type="submit" disabled={busy}>{busy ? "Sending..." : "Send test reminder email"}</Button></div>
      </form>}
    </Card>
  </>;
}

function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.some((currency) => currency === value);
}
function isFontSize(value: unknown): value is FontSize {
  return value === "extra-small" || value === "small" || value === "medium" ||
    value === "large" || value === "extra-large" || value === "xx-large";
}
function isFontStyle(value: unknown): value is FontStyle {
  return value === "modern" || value === "editorial" || value === "rounded";
}
function isFontFamily(value: unknown): value is FontFamily {
  return FONT_FAMILIES.some((family) => family === value);
}
function isAccentColor(value: unknown): value is AccentColor {
  return ACCENT_COLORS.some((color) => color === value);
}
function isDarkTheme(value: unknown): value is DarkTheme {
  return DARK_THEMES.some((theme) => theme === value);
}
function isVisualTheme(value: unknown): value is VisualTheme {
  return VISUAL_THEMES.some((theme) => theme === value);
}
function isDashboardWidget(value: unknown): value is DashboardWidget {
  return DASHBOARD_WIDGET_OPTIONS.some((option) => option.id === value);
}
function isDashboardWidgetList(value: unknown): value is DashboardWidget[] {
  return Array.isArray(value) && value.every(isDashboardWidget);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function emptyTrackerData(): TrackerData {
  return {
    version: 1,
    items: [],
    purchases: [],
    trips: [],
    stores: [],
    products: [],
    reminders: [],
    brokers: [],
    stocks: [],
    stockQuotes: [],
    stockSeedVersion: 3,
    vehicles: [],
    vehicleJourneys: [],
    vehicleMaintenance: [],
    subscriptions: [],
    devotionalResources: [],
    learningRecords: [],
    trainingSessions: [],
    personalRecords: [],
    assets: [],
    promptRecords: [],
    mindfulHabits: [],
    mindfulnessLogs: [],
    educationRecords: [],
    cookingRecipes: [],
    cookingLogs: [],
    issueRecords: [],
    personalEducation: [],
    professionalQualifications: [],
    workExperiences: [],
    professionalSkills: [],
    familyMembers: [],
    documents: [],
    archivedRecords: [],
  };
}

function readLegacyBrowserData(): TrackerData | null {
  let saved = localStorage.getItem(STORAGE_KEY);
  if (saved === null) {
    const accountKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((key): key is string => key !== null && key.startsWith(`${STORAGE_KEY}:`));
    if (accountKeys.length > 1) {
      throw new Error("Multiple older account backups were found in this browser. Download the backup you want to migrate and restore it after connecting.");
    }
    if (accountKeys.length === 1) saved = localStorage.getItem(accountKeys[0]);
  }
  if (saved === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    throw new Error("The older browser data is not valid JSON. Download or repair a backup before migrating.");
  }
  if (!validateData(parsed)) {
    throw new Error("The older browser data is invalid or uses an unsupported version. Import a valid JSON backup instead.");
  }
  return normalizeTrackerData(parsed);
}

export default function App() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [page, setPage] = useState<Page>(() => readAppRoute().page);
  const [globalSearchQuery, setGlobalSearchQuery] = useState(() => readAppRoute().query);
  const [selectedSearchResultKey, setSelectedSearchResultKey] = useState<string | null>(() => readAppRoute().selectedKey);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [accessPassword, setAccessPassword] = useState("");
  const [authTestMode, setAuthTestMode] = useState(false);
  const [authTestPassword, setAuthTestPassword] = useState("");
  const [authTestLoading, setAuthTestLoading] = useState(false);
  const [authTestError, setAuthTestError] = useState("");
  const [authTestPassed, setAuthTestPassed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [revision, setRevision] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"saved" | "saving" | "error">("saved");
  const [syncMessage, setSyncMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [currency, setCurrency] = useState<Currency>("INR");
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("medium");
  const [fontStyle, setFontStyle] = useState<FontStyle>("modern");
  const [fontFamily, setFontFamily] = useState<FontFamily>("inter");
  const [accentColor, setAccentColor] = useState<AccentColor>("green");
  const [darkTheme, setDarkTheme] = useState<DarkTheme>("forest");
  const [visualTheme, setVisualTheme] = useState<VisualTheme>("sage");
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>(DEFAULT_DASHBOARD_WIDGETS);
  const [groupMenus, setGroupMenus] = useState(true);
  const [menuSortOrder, setMenuSortOrder] = useState<MenuSortOrder>("current");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [modal, setModal] = useState<"add" | "trip" | null>(null);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [collapsedNavGroups, setCollapsedNavGroups] = useState<Set<NavigationGroup>>(() => new Set(NAVIGATION_GROUP_ORDER.filter((group) => group !== "Overview")));
  const latestDataRef = useRef(data);
  const revisionRef = useRef(revision);
  const authenticatedRef = useRef(authenticated);
  const syncStatusRef = useRef(syncStatus);
  const skipNextSave = useRef(false);
  const saveQueue = useRef<Promise<string | null>>(Promise.resolve(null));
  const saveTimer = useRef<number | null>(null);
  const refreshInProgress = useRef(false);

  latestDataRef.current = data;
  revisionRef.current = revision;
  authenticatedRef.current = authenticated;
  syncStatusRef.current = syncStatus;

  useEffect(() => {
    function syncRouteFromLocation() {
      const route = readAppRoute();
      setPage(route.page);
      setGlobalSearchQuery(route.query);
      setSelectedSearchResultKey(route.selectedKey);
      setMobileMenu(false);
    }
    window.addEventListener("popstate", syncRouteFromLocation);
    return () => window.removeEventListener("popstate", syncRouteFromLocation);
  }, []);

  function queueSave(snapshot: TrackerData): Promise<string | null> {
    setSyncStatus("saving");
    setSyncMessage("");
    const save = saveQueue.current.then(async () => {
      if (!authenticatedRef.current) throw new Error("Sign in to Daybook before saving.");
      const nextRevision = await saveSharedData(snapshot, revisionRef.current);
      revisionRef.current = nextRevision;
      setRevision(nextRevision);
      if (latestDataRef.current === snapshot) {
        setSyncStatus("saved");
        setSyncMessage("All changes saved to Supabase.");
      }
      return null;
    }).catch((caught: unknown) => {
      const message = caught instanceof Error ? caught.message : "Your changes could not be saved.";
      setSyncStatus("error");
      setSyncMessage(message);
      setError(message);
      return message;
    });
    saveQueue.current = save;
    return save;
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PREFERENCES_KEY);
      if (saved !== null) {
        const parsed: unknown = JSON.parse(saved);
        if (typeof parsed !== "object" || parsed === null || !("currency" in parsed) ||
          !isCurrency(parsed.currency) || !("darkMode" in parsed) || typeof parsed.darkMode !== "boolean" ||
          ("fontSize" in parsed && !isFontSize(parsed.fontSize)) ||
          ("fontStyle" in parsed && !isFontStyle(parsed.fontStyle)) ||
          ("fontFamily" in parsed && !isFontFamily(parsed.fontFamily)) ||
          ("accentColor" in parsed && !isAccentColor(parsed.accentColor)) ||
          ("darkTheme" in parsed && !isDarkTheme(parsed.darkTheme)) ||
          ("visualTheme" in parsed && !isVisualTheme(parsed.visualTheme)) ||
          ("dashboardWidgets" in parsed && !isDashboardWidgetList(parsed.dashboardWidgets)) ||
          ("groupMenus" in parsed && typeof parsed.groupMenus !== "boolean") ||
          ("menuSortOrder" in parsed && parsed.menuSortOrder !== "current" && parsed.menuSortOrder !== "ascending")) {
          throw new Error("Saved preferences are invalid. Default appearance and currency settings will be used.");
        }
        setCurrency(parsed.currency);
        setDarkMode(parsed.darkMode);
        if ("fontSize" in parsed && isFontSize(parsed.fontSize)) setFontSize(parsed.fontSize);
        if ("fontStyle" in parsed && isFontStyle(parsed.fontStyle)) setFontStyle(parsed.fontStyle);
        if ("fontFamily" in parsed && isFontFamily(parsed.fontFamily)) setFontFamily(parsed.fontFamily);
        if ("accentColor" in parsed && isAccentColor(parsed.accentColor)) setAccentColor(parsed.accentColor);
        if ("darkTheme" in parsed && isDarkTheme(parsed.darkTheme)) setDarkTheme(parsed.darkTheme);
        if ("visualTheme" in parsed && isVisualTheme(parsed.visualTheme)) setVisualTheme(parsed.visualTheme);
        if ("dashboardWidgets" in parsed && isDashboardWidgetList(parsed.dashboardWidgets)) setDashboardWidgets([...new Set(parsed.dashboardWidgets)]);
        if ("groupMenus" in parsed && typeof parsed.groupMenus === "boolean") setGroupMenus(parsed.groupMenus);
        if ("menuSortOrder" in parsed && (parsed.menuSortOrder === "current" || parsed.menuSortOrder === "ascending")) setMenuSortOrder(parsed.menuSortOrder);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read saved preferences from this browser.");
    } finally {
      setPreferencesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ currency, darkMode, fontSize, fontStyle, fontFamily, accentColor, darkTheme, visualTheme, dashboardWidgets, groupMenus, menuSortOrder }));
    } catch {
      setError("Your preferences could not be saved in this browser.");
    }
  }, [currency, darkMode, fontSize, fontStyle, fontFamily, accentColor, darkTheme, visualTheme, dashboardWidgets, groupMenus, menuSortOrder, preferencesReady]);

  useEffect(() => {
    const activeGroup = navigation.find((entry) => entry.name === page)?.group;
    if (activeGroup) setCollapsedNavGroups((current) => current.has(activeGroup)
      ? new Set([...current].filter((group) => group !== activeGroup))
      : current);
  }, [page]);

  useEffect(() => {
    if (!data || !authenticated || setupRequired) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setSyncStatus("saving");
    setSyncMessage("Changes waiting to save to Supabase.");
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      queueSave(data);
    }, 700);
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [data, authenticated, setupRequired]);

  async function loadDataFromServer() {
    setDataLoading(true);
    setError("");
    try {
      const saved = await loadSharedData();
      if (!validateData(saved.data)) throw new Error("Shared Daybook data is invalid or uses an unsupported version. Restore a valid JSON backup.");
      setData(normalizeTrackerData(saved.data));
      setRevision(saved.revision);
      revisionRef.current = saved.revision;
      skipNextSave.current = saved.initialized;
      setSetupRequired(!saved.initialized);
      setSyncStatus("saved");
      setSyncMessage(saved.initialized ? "Connected to Supabase cloud storage." : "Choose how to initialize shared data.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load shared Daybook data.");
      throw caught;
    } finally {
      setDataLoading(false);
    }
  }

  async function initializeSharedData(importThisDevice: boolean) {
    if (!data || !authenticated) return;
    setDataLoading(true);
    setError("");
    try {
      const legacy = importThisDevice ? readLegacyBrowserData() : null;
      const initialData = legacy ?? (importThisDevice ? emptyTrackerData() : data);
      const nextRevision = await saveSharedData(initialData, null);
      revisionRef.current = nextRevision;
      setRevision(nextRevision);
      skipNextSave.current = true;
      setData(initialData);
      setSetupRequired(false);
      setSyncStatus("saved");
      setSyncMessage("All changes saved to Supabase.");
      setNotice(legacy ? "Your browser data has been saved to Supabase." : "Your seed data is now stored in Supabase.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not initialize shared Daybook data.");
    } finally {
      setDataLoading(false);
    }
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setError("");
    try {
      await signIn(accessPassword);
      setAuthenticated(true);
      authenticatedRef.current = true;
      setAccessPassword("");
      await loadDataFromServer();
    } catch (caught) {
      setAuthenticated(false);
      authenticatedRef.current = false;
      setError(caught instanceof Error ? caught.message : "Could not sign in to Daybook.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleTestAccessPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthTestLoading(true);
    setAuthTestError("");
    setAuthTestPassed(false);
    try {
      await validateAccessPassword(authTestPassword);
      setAuthTestPassed(true);
    } catch (caught) {
      setAuthTestError(caught instanceof Error ? caught.message : "Could not validate the Daybook access password.");
    } finally {
      setAuthTestPassword("");
      setAuthTestLoading(false);
    }
  }

  async function handleSignOut() {
    if (syncStatusRef.current !== "saved" && !window.confirm("There may be changes that have not synced. Sign out anyway?")) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    try {
      await signOut();
      authenticatedRef.current = false;
      setAuthenticated(false);
      setData(null);
      setSetupRequired(false);
      setSyncStatus("saved");
      setSyncMessage("");
      setError("");
      setNotice("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign out.");
    }
  }

  async function saveNow() {
    const currentData = latestDataRef.current;
    if (!currentData) return;
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    queueSave(currentData);
  }

  async function refreshSharedData(manual = true) {
    if (!authenticatedRef.current || refreshInProgress.current) return;
    const discardLocalChanges = manual && syncStatusRef.current !== "saved";
    if (discardLocalChanges &&
      !window.confirm("There may be changes that have not synced. Replace them with the latest shared data?")) return;
    if (manual && saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    refreshInProgress.current = true;
    if (manual) setRefreshing(true);
    try {
      if (manual) await saveQueue.current;
      const saved = await loadSharedData();
      if (!validateData(saved.data)) throw new Error("Shared Daybook data is invalid or uses an unsupported version. Restore a valid JSON backup.");
      if (saved.revision !== revisionRef.current || discardLocalChanges) {
        if (!manual && syncStatusRef.current !== "saved") return;
        skipNextSave.current = true;
        revisionRef.current = saved.revision;
        setRevision(saved.revision);
        setData(normalizeTrackerData(saved.data));
        setSetupRequired(!saved.initialized);
        setSyncStatus("saved");
        setSyncMessage("Updated from Supabase.");
        if (manual) setNotice("Latest shared data loaded.");
      } else if (manual) {
        setNotice("This device already has the latest shared data.");
      }
      if (manual) setError("");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not refresh shared Daybook data.";
      setError(message);
      if (manual) {
        setSyncStatus("error");
        setSyncMessage(message);
      }
    } finally {
      refreshInProgress.current = false;
      if (manual) setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        if (await checkSession()) {
          setAuthenticated(true);
          authenticatedRef.current = true;
          await loadDataFromServer();
        }
      } catch (caught) {
        if (active) {
          setAuthenticated(false);
          authenticatedRef.current = false;
          setError(caught instanceof Error ? caught.message : "Could not restore the Daybook session.");
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authenticated || !data || setupRequired) return;
    const refresh = () => {
      if (syncStatusRef.current === "saved") void refreshSharedData(false);
    };
    const interval = window.setInterval(refresh, 120000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [authenticated, data, setupRequired, syncStatus]);

  useEffect(() => {
    if (syncStatus === "saved") return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [syncStatus]);

  const titleDate = useMemo(() => new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }), []);
  function update(mutator: (previous: TrackerData) => TrackerData) {
    setData((previous) => previous ? mutator(previous) : previous);
    setNotice("");
  }
  async function persistUpdate(mutator: (previous: TrackerData) => TrackerData): Promise<void> {
    const previous = latestDataRef.current;
    if (!previous || !authenticatedRef.current) throw new Error("Sign in to Daybook before saving documents.");
    const next = mutator(previous);
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const saveError = await queueSave(next);
    if (saveError) throw new Error(saveError);
    latestDataRef.current = next;
    skipNextSave.current = true;
    setData(next);
    setSyncStatus("saved");
    setSyncMessage("Document details saved to Supabase.");
    setNotice("");
  }
  function restoreArchivedRecord(id: string) {
    update((previous) => {
      const archived = (previous.archivedRecords ?? []).find((entry) => entry.id === id);
      if (!archived) return previous;
      return {
        ...mergeArchiveSnapshot(previous, archived.snapshot),
        archivedRecords: (previous.archivedRecords ?? []).filter((entry) => entry.id !== id),
      };
    });
  }
  function copyArchivedRecord(id: string) {
    update((previous) => {
      const archived = (previous.archivedRecords ?? []).find((entry) => entry.id === id);
      if (!archived) return previous;
      return mergeArchiveSnapshot(previous, cloneArchiveSnapshot(archived.snapshot));
    });
  }
  async function permanentlyDeleteArchivedRecord(id: string) {
    const archived = data?.archivedRecords?.find((entry) => entry.id === id);
    if (!archived) return;
    const archivedPaths = (archived.snapshot.documents ?? []).map((document) => document.storagePath).filter(Boolean);
    const referencedPaths = new Set([
      ...(data?.documents ?? []).map((document) => document.storagePath).filter(Boolean),
      ...(data?.archivedRecords ?? []).filter((entry) => entry.id !== id)
        .flatMap((entry) => entry.snapshot.documents ?? []).map((document) => document.storagePath).filter(Boolean),
    ]);
    try {
      for (const path of new Set(archivedPaths.filter((entry) => !referencedPaths.has(entry)))) {
        await deleteDocumentFile(path);
      }
    } catch (caught) {
      setError(caught instanceof Error ? `The archived document was not permanently deleted: ${caught.message}` : "The archived document file could not be deleted.");
      return;
    }
    update((previous) => ({
      ...previous,
      archivedRecords: (previous.archivedRecords ?? []).filter((entry) => entry.id !== id),
    }));
  }
  function addItem(item: Omit<ShoppingItem, "id">) {
    update((previous) => ({ ...previous, items: [{ ...item, id: createId() }, ...previous.items] }));
    setModal(null);
  }
  function editItem(item: Omit<ShoppingItem, "id">) {
    if (!editing) return;
    const id = editing.id;
    update((previous) => ({ ...previous, items: previous.items.map((entry) => entry.id === id ? { ...entry, ...item } : entry) }));
    setEditing(null);
  }
  function copyItem(item: ShoppingItem) {
    update((previous) => ({ ...previous, items: [{ ...item, id: createId(), name: `${item.name} (copy)`, purchased: false }, ...previous.items] }));
  }
  function togglePurchased(item: ShoppingItem) {
    update((previous) => {
      if (!item.purchased) {
        const purchase: Purchase = { id: createId(), itemId: item.id, itemName: item.name, category: item.category, quantity: item.quantity, unit: item.unit, price: item.estimatedPrice * item.quantity, date: today(), store: "Quick purchase" };
        return { ...previous, items: previous.items.map((entry) => entry.id === item.id ? { ...entry, purchased: true } : entry), purchases: [purchase, ...previous.purchases] };
      }
      const remove = previous.purchases.filter((purchase) => purchase.itemId === item.id && !purchase.tripId).sort((a, b) => b.date.localeCompare(a.date))[0];
      return {
        ...previous,
        items: previous.items.map((entry) => entry.id === item.id ? { ...entry, purchased: false } : entry),
        purchases: remove ? previous.purchases.filter((purchase) => purchase.id !== remove.id) : previous.purchases,
        trips: remove ? previous.trips.map((trip) => ({ ...trip, purchaseIds: trip.purchaseIds.filter((id) => id !== remove.id) })) : previous.trips,
      };
    });
  }
  function deleteItem(item: ShoppingItem) {
    if (!window.confirm(`Move "${item.name}" to the archive? Purchase history will be kept.`)) return;
    update((previous) => ({
      ...withArchivedRecord(previous, item.name, { items: [item] }),
      items: previous.items.filter((entry) => entry.id !== item.id),
    }));
  }
  function saveTrip(trip: Omit<ShoppingTrip, "id" | "purchaseIds">, itemIds: string[]) {
    update((previous) => {
      const tripId = createId();
      const selectedItems = previous.items.filter((item) => itemIds.includes(item.id) && !item.purchased);
      const newPurchases = selectedItems.map((item) => ({ id: createId(), itemId: item.id, itemName: item.name, category: item.category, quantity: item.quantity, unit: item.unit, price: item.estimatedPrice * item.quantity, date: trip.date, store: trip.store, tripId }));
      const newTrip: ShoppingTrip = { ...trip, id: tripId, purchaseIds: newPurchases.map((purchase) => purchase.id) };
      return { ...previous, items: previous.items.map((item) => selectedItems.some((selected) => selected.id === item.id) ? { ...item, purchased: true } : item), purchases: [...newPurchases, ...previous.purchases], trips: [newTrip, ...previous.trips] };
    });
    setModal(null);
  }
  function copyTrip(trip: ShoppingTrip) {
    update((previous) => ({
      ...previous,
      trips: [{ ...trip, id: createId(), purchaseIds: [] }, ...previous.trips],
    }));
  }
  function saveTripEdits(trip: ShoppingTrip) {
    update((previous) => ({
      ...previous,
      trips: previous.trips.map((entry) => entry.id === trip.id ? trip : entry),
      purchases: previous.purchases.map((purchase) => purchase.tripId === trip.id
        ? { ...purchase, date: trip.date, store: trip.store }
        : purchase),
    }));
  }
  function archiveTrip(trip: ShoppingTrip) {
    if (!window.confirm(`Move the shopping trip to ${trip.store} and its purchases to the archive?`)) return;
    update((previous) => {
      const purchases = previous.purchases.filter((purchase) => trip.purchaseIds.includes(purchase.id));
      const selectedItemIds = new Set(purchases.map((purchase) => purchase.itemId));
      return {
        ...withArchivedRecord(previous, `Shopping trip · ${trip.store} · ${trip.date}`, {
          trips: [trip],
          purchases,
          items: previous.items.filter((item) => selectedItemIds.has(item.id)),
        }),
        trips: previous.trips.filter((entry) => entry.id !== trip.id),
        purchases: previous.purchases.filter((purchase) => !trip.purchaseIds.includes(purchase.id)),
        items: previous.items.map((item) => selectedItemIds.has(item.id) ? { ...item, purchased: false } : item),
      };
    });
  }
  function savePurchase(purchase: Purchase) {
    update((previous) => ({
      ...previous,
      purchases: (previous.purchases ?? []).map((entry) => entry.id === purchase.id ? purchase : entry),
    }));
  }
  function copyPurchase(purchase: Purchase) {
    const standalonePurchase = { ...purchase, id: createId() };
    delete standalonePurchase.tripId;
    update((previous) => ({ ...previous, purchases: [standalonePurchase, ...previous.purchases] }));
  }
  function archivePurchase(purchase: Purchase) {
    if (!window.confirm(`Move the purchase of "${purchase.itemName}" to the archive?`)) return;
    update((previous) => {
      const linkedTrip = purchase.tripId ? previous.trips.find((trip) => trip.id === purchase.tripId) : undefined;
      const snapshot: ArchiveSnapshot = {
        purchases: [purchase],
        ...(linkedTrip ? { trips: [{ ...linkedTrip, purchaseIds: [purchase.id] }] } : {}),
      };
      return {
        ...withArchivedRecord(previous, `Purchase: ${purchase.itemName}`, snapshot),
        purchases: previous.purchases.filter((entry) => entry.id !== purchase.id),
        trips: linkedTrip
          ? previous.trips.map((trip) => trip.id === linkedTrip.id
            ? { ...trip, purchaseIds: trip.purchaseIds.filter((id) => id !== purchase.id) }
            : trip)
          : previous.trips,
      };
    });
  }
  function saveReminder(reminder: Omit<Reminder, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      reminderCategories: previous.reminderCategories ?? [],
      reminders: id
        ? (previous.reminders ?? []).map((entry) => entry.id === id ? { ...entry, ...reminder } : entry)
        : [{ ...reminder, id: createId() }, ...(previous.reminders ?? [])],
    }));
  }
  function deleteReminder(id: string) {
    update((previous) => {
      const reminder = (previous.reminders ?? []).find((entry) => entry.id === id);
      if (!reminder) return previous;
      return {
        ...withArchivedRecord(previous, reminder.title, { reminders: [reminder] }),
        reminders: (previous.reminders ?? []).filter((entry) => entry.id !== id),
      };
    });
  }
  function toggleReminder(reminder: Reminder) {
    update((previous) => ({ ...previous, reminders: (previous.reminders ?? []).map((entry) => entry.id === reminder.id ? { ...entry, completed: !entry.completed } : entry) }));
  }
  function addStore(store: Omit<Store, "id">) {
    update((previous) => ({ ...previous, stores: [...(previous.stores ?? []), { ...store, id: createId() }] }));
  }
  function saveStore(store: Omit<Store, "id">, id: string) {
    update((previous) => ({ ...previous, stores: (previous.stores ?? []).map((entry) => entry.id === id ? { ...store, id } : entry) }));
  }
  function addProduct(product: Omit<Product, "id">) {
    update((previous) => ({ ...previous, products: [...(previous.products ?? []), { ...product, id: createId() }] }));
  }
  function saveProduct(product: Omit<Product, "id">, id: string) {
    update((previous) => ({ ...previous, products: (previous.products ?? []).map((entry) => entry.id === id ? { ...product, id } : entry) }));
  }
  function addReminderCategory(category: string) {
    update((previous) => ({ ...previous, reminderCategories: [...(previous.reminderCategories ?? []), category] }));
  }
  function renameReminderCategory(oldCategory: string, newCategory: string) {
    if (!newCategory || newCategory.length > 80 || REMINDER_CATEGORIES.some((entry) => entry.toLocaleLowerCase() === newCategory.toLocaleLowerCase()) ||
      data?.reminderCategories?.some((entry) => entry.toLocaleLowerCase() === newCategory.toLocaleLowerCase() && entry !== oldCategory)) {
      setError("Choose a non-empty category name that is not already in use.");
      return;
    }
    update((previous) => ({
      ...previous,
      reminderCategories: (previous.reminderCategories ?? []).map((entry) => entry === oldCategory ? newCategory : entry),
      reminders: (previous.reminders ?? []).map((reminder) =>
        (reminder.category || "General").toLocaleLowerCase() === oldCategory.toLocaleLowerCase()
          ? { ...reminder, category: newCategory }
          : reminder),
    }));
  }
  function deleteReminderCategory(category: string) {
    update((previous) => ({
      ...withArchivedRecord(previous, `Reminder category: ${category}`, { reminderCategories: [category] }),
      reminderCategories: (previous.reminderCategories ?? []).filter((entry) => entry !== category),
    }));
  }
  function addBroker(name: string) {
    update((previous) => ({ ...previous, brokers: [...(previous.brokers ?? []), name] }));
  }
  function renameBroker(oldName: string, newName: string) {
    if (!newName || newName.length > 80 || (data?.brokers ?? []).some((entry) => entry.toLocaleLowerCase() === newName.toLocaleLowerCase() && entry !== oldName)) {
      setError("Choose a non-empty broker name that is not already in use.");
      return;
    }
    update((previous) => ({
      ...previous,
      brokers: (previous.brokers ?? []).map((entry) => entry === oldName ? newName : entry),
      stocks: (previous.stocks ?? []).map((stock) => stock.broker === oldName ? { ...stock, broker: newName } : stock),
    }));
  }
  function deleteBroker(name: string) {
    update((previous) => {
      const affectedStocks = (previous.stocks ?? []).filter((stock) => stock.broker === name);
      return {
      ...withArchivedRecord(previous, `Broker: ${name}`, { brokers: [name], stocks: affectedStocks }),
      brokers: (previous.brokers ?? []).filter((entry) => entry !== name),
      stocks: (previous.stocks ?? []).map((stock) => stock.broker === name ? { ...stock, broker: "" } : stock),
    };});
  }
  function saveStock(stock: Omit<TrackedStock, "id">, id?: string) {
    update((previous) => {
      if (!id) return { ...previous, stocks: [...(previous.stocks ?? []), { ...stock, id: createId() }] };
      const current = (previous.stocks ?? []).find((entry) => entry.id === id);
      const identityChanged = current && (current.symbol !== stock.symbol || current.exchange !== stock.exchange);
      return {
        ...previous,
        stocks: (previous.stocks ?? []).map((entry) => entry.id === id ? { ...stock, id } : entry),
        stockQuotes: identityChanged
          ? (previous.stockQuotes ?? []).filter((quote) => quote.stockId !== id)
          : previous.stockQuotes ?? [],
      };
    });
  }
  function deleteStock(id: string) {
    update((previous) => {
      const stock = (previous.stocks ?? []).find((entry) => entry.id === id);
      const quotes = (previous.stockQuotes ?? []).filter((quote) => quote.stockId === id);
      if (!stock) return previous;
      return {
      ...withArchivedRecord(previous, `Stock: ${stock.symbol}`, { stocks: [stock], stockQuotes: quotes }),
      stocks: (previous.stocks ?? []).filter((stock) => stock.id !== id),
      stockQuotes: (previous.stockQuotes ?? []).filter((quote) => quote.stockId !== id),
    };});
  }
  function saveStockQuote(quote: Omit<StockQuoteSnapshot, "id">) {
    update((previous) => ({
      ...previous,
      stockQuotes: [{ ...quote, id: createId() }, ...(previous.stockQuotes ?? [])],
    }));
  }
  function saveAsset(asset: Omit<AssetRecord, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      assets: id
        ? (previous.assets ?? []).map((entry) => entry.id === id ? { ...asset, id } : entry)
        : [{ ...asset, id: createId() }, ...(previous.assets ?? [])],
    }));
  }
  function deleteAsset(asset: AssetRecord) {
    update((previous) => ({
      ...withArchivedRecord(previous, asset.name, { assets: [asset] }),
      assets: (previous.assets ?? []).filter((entry) => entry.id !== asset.id),
    }));
  }
  function saveEducationRecord(record: Omit<EducationRecord, "id">, id?: string) {
    update((previous) => {
      if (!id) return { ...previous, educationRecords: [{ ...record, id: createId() }, ...(previous.educationRecords ?? [])] };
      const current = (previous.educationRecords ?? []).find((entry) => entry.id === id);
      if (!current) return previous;
      const removedSubjects = (current.subjects ?? []).filter((entry) => !(record.subjects ?? []).some((updated) => updated.id === entry.id));
      const removedExams = (current.exams ?? []).filter((entry) => !(record.exams ?? []).some((updated) => updated.id === entry.id));
      const removedPayments = (current.payments ?? []).filter((entry) => !(record.payments ?? []).some((updated) => updated.id === entry.id));
      const next = removedSubjects.length || removedExams.length || removedPayments.length
        ? withArchivedRecord(previous, `${current.studentName} education details`, {
          educationRecords: [{ ...current, subjects: removedSubjects, exams: removedExams, payments: removedPayments }],
        })
        : previous;
      return {
        ...next,
        educationRecords: (previous.educationRecords ?? []).map((entry) => entry.id === id ? { ...record, id } : entry),
      };
    });
  }
  function deleteEducationRecord(record: EducationRecord) {
    update((previous) => ({
      ...withArchivedRecord(previous, record.studentName, { educationRecords: [record] }),
      educationRecords: (previous.educationRecords ?? []).filter((entry) => entry.id !== record.id),
    }));
  }
  function saveLearningRecord(record: Omit<LearningRecord, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      learningRecords: id
        ? (previous.learningRecords ?? []).map((entry) => entry.id === id ? { ...record, id } : entry)
        : [{ ...record, id: createId() }, ...(previous.learningRecords ?? [])],
    }));
  }
  function deleteLearningRecord(record: LearningRecord) {
    if (!window.confirm(`Move "${record.title}" to the archive?`)) return;
    update((previous) => ({
      ...withArchivedRecord(previous, record.title, { learningRecords: [record] }),
      learningRecords: (previous.learningRecords ?? []).filter((entry) => entry.id !== record.id),
    }));
  }
  function savePromptRecord(record: Omit<PromptRecord, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      promptRecords: id
        ? (previous.promptRecords ?? []).map((entry) => entry.id === id ? { ...record, id } : entry)
        : [{ ...record, id: createId() }, ...(previous.promptRecords ?? [])],
    }));
  }
  function deletePromptRecord(record: PromptRecord) {
    update((previous) => ({
      ...withArchivedRecord(previous, `AI prompt: ${record.title}`, { promptRecords: [record] }),
      promptRecords: (previous.promptRecords ?? []).filter((entry) => entry.id !== record.id),
    }));
  }
  function saveMindfulHabit(habit: Omit<MindfulHabit, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      mindfulHabits: id
        ? (previous.mindfulHabits ?? []).map((entry) => entry.id === id ? { ...habit, id } : entry)
        : [{ ...habit, id: createId() }, ...(previous.mindfulHabits ?? [])],
    }));
  }
  function archiveMindfulHabit(habit: MindfulHabit) {
    update((previous) => ({
      ...withArchivedRecord(previous, `Positive habit: ${habit.title}`, { mindfulHabits: [habit] }),
      mindfulHabits: (previous.mindfulHabits ?? []).filter((entry) => entry.id !== habit.id),
    }));
  }
  function saveMindfulnessLog(log: Omit<MindfulnessLog, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      mindfulnessLogs: id
        ? (previous.mindfulnessLogs ?? []).map((entry) => entry.id === id ? { ...log, id } : entry)
        : [{ ...log, id: createId() }, ...(previous.mindfulnessLogs ?? [])],
    }));
  }
  function archiveMindfulnessLog(log: MindfulnessLog) {
    update((previous) => ({
      ...withArchivedRecord(previous, `Mind & habits reflection · ${log.date}`, { mindfulnessLogs: [log] }),
      mindfulnessLogs: (previous.mindfulnessLogs ?? []).filter((entry) => entry.id !== log.id),
    }));
  }
  async function copyPromptToClipboard(record: PromptRecord) {
    try {
      await navigator.clipboard.writeText(record.prompt);
      setError("");
      setNotice(`Copied "${record.title}" to the clipboard.`);
    } catch (caught) {
      setError(caught instanceof Error ? `Could not copy the prompt: ${caught.message}` : "Could not copy the prompt. Check clipboard permissions and try again.");
    }
  }
  function saveTrainingSession(session: Omit<TrainingSession, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      trainingSessions: id
        ? (previous.trainingSessions ?? []).map((entry) => entry.id === id ? { ...session, id } : entry)
        : [{ ...session, id: createId() }, ...(previous.trainingSessions ?? [])],
    }));
  }
  function deleteTrainingSession(session: TrainingSession) {
    if (!window.confirm(`Move the ${session.date} session for "${session.courseName}" to the archive?`)) return;
    update((previous) => ({
      ...withArchivedRecord(previous, `${session.courseName} · ${session.date}`, { trainingSessions: [session] }),
      trainingSessions: (previous.trainingSessions ?? []).filter((entry) => entry.id !== session.id),
    }));
  }
  function saveVehicle(vehicle: Omit<Vehicle, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      vehicles: id
        ? (previous.vehicles ?? []).map((entry) => entry.id === id ? { ...vehicle, id } : entry)
        : [{ ...vehicle, id: createId() }, ...(previous.vehicles ?? [])],
    }));
  }
  function copyVehicle(vehicle: Vehicle) {
    update((previous) => {
      return {
        ...previous,
        vehicles: [{ ...vehicle, id: createId(), name: copyLabel(vehicle.name, 100) }, ...(previous.vehicles ?? [])],
      };
    });
  }
  function deleteVehicle(vehicle: Vehicle) {
    if (!window.confirm(`Move ${vehicle.name} and all its travel, service and repair records to the archive?`)) return;
    update((previous) => ({
      ...withArchivedRecord(previous, vehicle.name, {
        vehicles: [vehicle],
        vehicleJourneys: (previous.vehicleJourneys ?? []).filter((entry) => entry.vehicleId === vehicle.id),
        vehicleMaintenance: (previous.vehicleMaintenance ?? []).filter((entry) => entry.vehicleId === vehicle.id),
      }),
      vehicles: (previous.vehicles ?? []).filter((entry) => entry.id !== vehicle.id),
      vehicleJourneys: (previous.vehicleJourneys ?? []).filter((entry) => entry.vehicleId !== vehicle.id),
      vehicleMaintenance: (previous.vehicleMaintenance ?? []).filter((entry) => entry.vehicleId !== vehicle.id),
    }));
  }
  function saveVehicleJourney(journey: Omit<VehicleJourney, "id" | "vehicleId">, vehicleId: string, id?: string) {
    update((previous) => ({
      ...previous,
      vehicleJourneys: id
        ? (previous.vehicleJourneys ?? []).map((entry) => entry.id === id ? { ...journey, vehicleId, id } : entry)
        : [{ ...journey, vehicleId, id: createId() }, ...(previous.vehicleJourneys ?? [])],
    }));
  }
  function deleteVehicleJourney(journey: VehicleJourney) {
    if (!window.confirm("Move this travel log to the archive?")) return;
    update((previous) => ({
      ...withArchivedRecord(previous, `Travel log · ${journey.date}`, { vehicleJourneys: [journey] }),
      vehicleJourneys: (previous.vehicleJourneys ?? []).filter((entry) => entry.id !== journey.id),
    }));
  }
  function saveVehicleMaintenance(entry: Omit<VehicleMaintenance, "id" | "vehicleId">, vehicleId: string, id?: string) {
    update((previous) => ({
      ...previous,
      vehicleMaintenance: id
        ? (previous.vehicleMaintenance ?? []).map((record) => record.id === id ? { ...entry, vehicleId, id } : record)
        : [{ ...entry, vehicleId, id: createId() }, ...(previous.vehicleMaintenance ?? [])],
    }));
  }
  function deleteVehicleMaintenance(entry: VehicleMaintenance) {
    if (!window.confirm(`Move this ${entry.type.toLowerCase()} record to the archive?`)) return;
    update((previous) => ({
      ...withArchivedRecord(previous, `${entry.type} · ${entry.date}`, { vehicleMaintenance: [entry] }),
      vehicleMaintenance: (previous.vehicleMaintenance ?? []).filter((record) => record.id !== entry.id),
    }));
  }
  function saveElectricityReading(reading: Omit<ElectricityReading, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      electricityReadings: id
        ? (previous.electricityReadings ?? []).map((entry) => entry.id === id ? { ...reading, id } : entry)
        : [{ ...reading, id: createId() }, ...(previous.electricityReadings ?? [])],
    }));
  }
  function deleteElectricityReading(reading: ElectricityReading) {
    update((previous) => ({
      ...withArchivedRecord(previous, `Electricity reading · ${reading.readingDate}`, { electricityReadings: [reading] }),
      electricityReadings: (previous.electricityReadings ?? []).filter((entry) => entry.id !== reading.id),
    }));
  }
  function saveSubscriptionAccount(account: Omit<SubscriptionAccount, "id" | "transactions">, id?: string) {
    update((previous) => ({
      ...previous,
      subscriptions: id
        ? (previous.subscriptions ?? []).map((entry) => entry.id === id ? { ...entry, ...account } : entry)
        : [{ ...account, id: createId(), transactions: [] }, ...(previous.subscriptions ?? [])],
    }));
  }
  function archiveSubscriptionAccount(account: SubscriptionAccount) {
    update((previous) => ({
      ...withArchivedRecord(previous, `Subscription or bill · ${account.name}`, { subscriptions: [account] }),
      subscriptions: (previous.subscriptions ?? []).filter((entry) => entry.id !== account.id),
    }));
  }
  function saveSubscriptionTransaction(accountId: string, transaction: Omit<SubscriptionTransaction, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      subscriptions: (previous.subscriptions ?? []).map((account) => account.id !== accountId ? account : {
        ...account,
        transactions: id
          ? account.transactions.map((entry) => entry.id === id ? { ...transaction, id } : entry)
          : [{ ...transaction, id: createId() }, ...account.transactions],
      }),
    }));
  }
  function archiveSubscriptionTransaction(accountId: string, transaction: SubscriptionTransaction) {
    update((previous) => {
      const account = (previous.subscriptions ?? []).find((entry) => entry.id === accountId);
      if (!account) return previous;
      return {
        ...withArchivedRecord(previous, `${account.name} · ${transaction.type} · ${transaction.transactionDate}`, {
          subscriptions: [{ ...account, transactions: [transaction] }],
        }),
        subscriptions: (previous.subscriptions ?? []).map((entry) => entry.id === accountId
          ? { ...entry, transactions: entry.transactions.filter((item) => item.id !== transaction.id) }
          : entry),
      };
    });
  }
  function saveDevotionalEntry(entry: Omit<DevotionalEntry, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      devotionalEntries: id
        ? (previous.devotionalEntries ?? []).map((current) => current.id === id ? { ...entry, id } : current)
        : [{ ...entry, id: createId() }, ...(previous.devotionalEntries ?? [])],
    }));
  }
  function deleteDevotionalEntry(entry: DevotionalEntry) {
    update((previous) => ({
      ...withArchivedRecord(previous, `Devotional entry · ${entry.date}`, { devotionalEntries: [entry] }),
      devotionalEntries: (previous.devotionalEntries ?? []).filter((current) => current.id !== entry.id),
    }));
  }
  function saveDevotionalResource(resource: Omit<DevotionalResource, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      devotionalResources: id
        ? (previous.devotionalResources ?? []).map((current) => current.id === id ? { ...resource, id } : current)
        : [{ ...resource, id: createId() }, ...(previous.devotionalResources ?? [])],
    }));
  }
  function deleteDevotionalResource(resource: DevotionalResource) {
    update((previous) => ({
      ...withArchivedRecord(previous, `Devotional resource: ${resource.title}`, { devotionalResources: [resource] }),
      devotionalResources: (previous.devotionalResources ?? []).filter((current) => current.id !== resource.id),
    }));
  }
  function savePrayerRequest(request: Omit<PrayerRequest, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      prayerRequests: id
        ? (previous.prayerRequests ?? []).map((current) => current.id === id ? { ...request, id } : current)
        : [{ ...request, id: createId() }, ...(previous.prayerRequests ?? [])],
    }));
  }
  function deletePrayerRequest(request: PrayerRequest) {
    update((previous) => ({
      ...withArchivedRecord(previous, `Prayer request: ${request.title}`, { prayerRequests: [request] }),
      prayerRequests: (previous.prayerRequests ?? []).filter((current) => current.id !== request.id),
    }));
  }
  function saveCookingRecipe(recipe: Omit<CookingRecipe, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      cookingRecipes: id
        ? (previous.cookingRecipes ?? []).map((current) => current.id === id ? { ...recipe, id } : current)
        : [{ ...recipe, id: createId() }, ...(previous.cookingRecipes ?? [])],
    }));
  }
  function deleteCookingRecipe(recipe: CookingRecipe) {
    update((previous) => ({
      ...withArchivedRecord(previous, `Recipe: ${recipe.name}`, { cookingRecipes: [recipe] }),
      cookingRecipes: (previous.cookingRecipes ?? []).filter((current) => current.id !== recipe.id),
    }));
  }
  function saveCookingLog(log: Omit<CookingLog, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      cookingLogs: id
        ? (previous.cookingLogs ?? []).map((current) => current.id === id ? { ...log, id } : current)
        : [{ ...log, id: createId() }, ...(previous.cookingLogs ?? [])],
    }));
  }
  function deleteCookingLog(log: CookingLog) {
    update((previous) => ({
      ...withArchivedRecord(previous, `Cooking log · ${log.date}`, { cookingLogs: [log] }),
      cookingLogs: (previous.cookingLogs ?? []).filter((current) => current.id !== log.id),
    }));
  }
  function saveIssueRecord(record: Omit<IssueRecord, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      issueRecords: id
        ? (previous.issueRecords ?? []).map((current) => current.id === id ? { ...record, id } : current)
        : [{ ...record, id: createId() }, ...(previous.issueRecords ?? [])],
    }));
  }
  function deleteIssueRecord(record: IssueRecord) {
    update((previous) => ({
      ...withArchivedRecord(previous, record.title, { issueRecords: [record] }),
      issueRecords: (previous.issueRecords ?? []).filter((current) => current.id !== record.id),
    }));
  }
  function savePersonalEducation(record: Omit<PersonalEducationRecord, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      personalEducation: id
        ? (previous.personalEducation ?? []).map((current) => current.id === id ? { ...record, id } : current)
        : [{ ...record, id: createId() }, ...(previous.personalEducation ?? [])],
    }));
  }
  function deletePersonalEducation(record: PersonalEducationRecord) {
    update((previous) => ({
      ...withArchivedRecord(previous, record.qualification, { personalEducation: [record] }),
      personalEducation: (previous.personalEducation ?? []).filter((current) => current.id !== record.id),
    }));
  }
  function saveProfessionalQualification(record: Omit<ProfessionalQualification, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      professionalQualifications: id
        ? (previous.professionalQualifications ?? []).map((current) => current.id === id ? { ...record, id } : current)
        : [{ ...record, id: createId() }, ...(previous.professionalQualifications ?? [])],
    }));
  }
  function deleteProfessionalQualification(record: ProfessionalQualification) {
    update((previous) => ({
      ...withArchivedRecord(previous, record.name, { professionalQualifications: [record] }),
      professionalQualifications: (previous.professionalQualifications ?? []).filter((current) => current.id !== record.id),
    }));
  }
  function saveWorkExperience(record: Omit<WorkExperience, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      workExperiences: id
        ? (previous.workExperiences ?? []).map((current) => current.id === id ? { ...record, id } : current)
        : [{ ...record, id: createId() }, ...(previous.workExperiences ?? [])],
    }));
  }
  function deleteWorkExperience(record: WorkExperience) {
    update((previous) => ({
      ...withArchivedRecord(previous, `${record.jobTitle} · ${record.company}`, { workExperiences: [record] }),
      workExperiences: (previous.workExperiences ?? []).filter((current) => current.id !== record.id),
    }));
  }
  function saveProfessionalSkill(record: Omit<ProfessionalSkill, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      professionalSkills: id
        ? (previous.professionalSkills ?? []).map((current) => current.id === id ? { ...record, id } : current)
        : [{ ...record, id: createId() }, ...(previous.professionalSkills ?? [])],
    }));
  }
  function deleteProfessionalSkill(record: ProfessionalSkill) {
    update((previous) => ({
      ...withArchivedRecord(previous, record.name, { professionalSkills: [record] }),
      professionalSkills: (previous.professionalSkills ?? []).filter((current) => current.id !== record.id),
    }));
  }
  function saveFamilyMember(member: Omit<FamilyMember, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      familyMembers: id
        ? (previous.familyMembers ?? []).map((current) => current.id === id ? { ...member, id } : current)
        : [{ ...member, id: createId() }, ...(previous.familyMembers ?? [])],
    }));
  }
  function deleteFamilyMember(member: FamilyMember) {
    update((previous) => ({
      ...withArchivedRecord(previous, member.name, { familyMembers: [member] }),
      familyMembers: (previous.familyMembers ?? []).filter((current) => current.id !== member.id),
    }));
  }
  function savePersonalRecord(record: Omit<PersonalRecord, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      personalRecords: id
        ? (previous.personalRecords ?? []).map((entry) => entry.id === id ? { ...record, id } : entry)
        : [{ ...record, id: createId() }, ...(previous.personalRecords ?? [])],
    }));
  }
  function deletePersonalRecord(record: PersonalRecord) {
    if (!window.confirm(`Move "${record.title}" to the archive?`)) return;
    update((previous) => ({
      ...withArchivedRecord(previous, record.title, { personalRecords: [record] }),
      personalRecords: (previous.personalRecords ?? []).filter((entry) => entry.id !== record.id),
    }));
  }
  async function saveDocument(details: DocumentDetails, file: File | undefined, id?: string): Promise<void> {
    let uploadedPath = "";
    try {
      if (id) {
        const uploaded = file ? await uploadDocumentFile(file) : null;
        uploadedPath = uploaded?.storagePath ?? "";
        const existingDocument = (latestDataRef.current?.documents ?? []).find((document) => document.id === id);
        await persistUpdate((previous) => ({
          ...previous,
          documents: (previous.documents ?? []).map((document) => document.id === id
            ? {
              ...document,
              ...details,
              ...(file && uploaded ? {
                fileName: file.name,
                contentType: uploaded.contentType,
                sizeBytes: file.size,
                storagePath: uploaded.storagePath,
              } : {}),
            }
            : document),
        }));
        const oldPath = existingDocument?.storagePath;
        const oldPathStillUsed = oldPath && oldPath !== uploadedPath && [
          ...(latestDataRef.current?.documents ?? []).filter((document) => document.id !== id).map((document) => document.storagePath),
          ...(latestDataRef.current?.archivedRecords ?? []).flatMap((record) => record.snapshot.documents ?? []).map((document) => document.storagePath),
        ].includes(oldPath);
        if (oldPath && oldPath !== uploadedPath && !oldPathStillUsed) {
          try {
            await deleteDocumentFile(oldPath);
          } catch (caught) {
            const message = caught instanceof Error ? caught.message : "The previous file could not be removed from storage.";
            setError(`The new file was saved, but the previous uploaded file could not be deleted. ${message}`);
          }
        }
        return;
      }
      const uploaded = file ? await uploadDocumentFile(file) : null;
      uploadedPath = uploaded?.storagePath ?? "";
      const document: DocumentAttachment = {
        ...details,
        id: createId(),
        fileName: file?.name ?? "",
        contentType: uploaded?.contentType ?? "",
        sizeBytes: file?.size ?? 0,
        storagePath: uploadedPath,
        uploadedAt: new Date().toISOString(),
      };
      await persistUpdate((previous) => ({ ...previous, documents: [document, ...(previous.documents ?? [])] }));
    } catch (caught) {
      if (uploadedPath) {
        try {
          await deleteDocumentFile(uploadedPath);
        } catch (cleanupError) {
          const saveMessage = caught instanceof Error ? caught.message : "The document record could not be saved.";
          const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : "The uploaded file could not be removed.";
          throw new Error(`${saveMessage} Cleanup also failed: ${cleanupMessage}`);
        }
      }
      throw caught;
    }
  }
  async function archiveDocument(document: DocumentAttachment) {
    if (!window.confirm(`Move "${document.title}" to the archive? Its file will remain stored until you permanently delete the archived record.`)) return;
    try {
      await persistUpdate((previous) => ({
        ...withArchivedRecord(previous, document.title, { documents: [document] }),
        documents: (previous.documents ?? []).filter((entry) => entry.id !== document.id),
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The document could not be archived.");
    }
  }
  async function removeDocumentFile(document: DocumentAttachment) {
    const path = document.storagePath;
    if (!path) return;
    const otherReferences = [
      ...(data?.documents ?? []).filter((entry) => entry.id !== document.id).map((entry) => entry.storagePath),
      ...(data?.archivedRecords ?? []).flatMap((entry) => entry.snapshot.documents ?? []).map((entry) => entry.storagePath),
    ].filter(Boolean);
    const fileIsShared = otherReferences.includes(path);
    if (!window.confirm(fileIsShared
      ? `Remove the uploaded file from "${document.title}"? Other active or archived records still use this file, so it will remain stored.`
      : `Permanently delete the uploaded file for "${document.title}" from private storage? The document record will remain.`)) return;
    try {
      await persistUpdate((previous) => ({
        ...previous,
        documents: (previous.documents ?? []).map((entry) => entry.id === document.id
          ? { ...entry, fileName: "", contentType: "", sizeBytes: 0, storagePath: "" }
          : entry),
      }));
      if (!fileIsShared) {
        try {
          await deleteDocumentFile(path);
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : "The file could not be removed from storage.";
          try {
            await persistUpdate((previous) => ({
              ...previous,
              documents: (previous.documents ?? []).map((entry) => entry.id === document.id
                ? { ...entry, fileName: document.fileName, contentType: document.contentType, sizeBytes: document.sizeBytes, storagePath: path }
                : entry),
            }));
            setError(`The uploaded file could not be deleted, so the document attachment was restored. ${message}`);
          } catch (restoreError) {
            const restoreMessage = restoreError instanceof Error ? restoreError.message : "The document attachment could not be restored.";
            setError(`The uploaded file could not be deleted. Restoring its document record also failed: ${restoreMessage}`);
          }
          return;
        }
      }
      setNotice(fileIsShared
        ? "The file was removed from this document. It remains stored because another active or archived record uses it."
        : "The uploaded file was deleted. The document record was kept.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The document attachment could not be removed.");
    }
  }
  async function copyDocument(document: DocumentAttachment) {
    try {
      await persistUpdate((previous) => ({
        ...previous,
        documents: [{
          ...document,
          id: createId(),
          title: copyLabel(document.title, 160),
          fileName: "",
          contentType: "",
          sizeBytes: 0,
          storagePath: "",
          uploadedAt: new Date().toISOString(),
        }, ...(previous.documents ?? [])],
      }));
      setNotice(`Copied "${document.title}" without copying its uploaded file.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The document record could not be copied.");
    }
  }
  async function importBackup(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!validateData(parsed)) throw new Error("This file is not a valid Daybook backup (version 1). Your current data has not been changed.");
      setData(normalizeTrackerData(parsed));
      setError("");
      setNotice("Backup loaded. Saving to Supabase. Uploaded file attachments are not included in JSON backups.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't read that backup file. Your current data has not been changed.");
    }
  }
  function exportBackup() {
    if (!data) return;
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `daybook-backup-${today()}.json`);
    setNotice("Your backup is ready to save.");
  }
  function clearData() {
    if (!data) return;
    if (!window.confirm("Clear all active Daybook records? They will be moved to the Archive first. The encrypted credential vault is excluded from archive and will be permanently cleared.")) return;
    const { version, archivedRecords, credentialVault, stockSeedVersion, ...snapshot } = data;
    void version;
    void credentialVault;
    void stockSeedVersion;
    const archive: ArchivedRecord = {
      id: createId(),
      label: "All records before clear",
      archivedAt: new Date().toISOString(),
      snapshot,
    };
    setData({ ...emptyTrackerData(), archivedRecords: [archive, ...(archivedRecords ?? [])] });
    setError("");
    setNotice("Data cleared. Saving the empty data file to shared storage…");
  }
  function changePage(next: Page) {
    setPage(next);
    setSelectedSearchResultKey(null);
    setMobileMenu(false);
    const params = new URLSearchParams({ page: next });
    if (next === "Global search" && globalSearchQuery.trim()) params.set("q", globalSearchQuery.trim());
    window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function selectSearchResult(key: string | null) {
    setPage("Global search");
    setSelectedSearchResultKey(key);
    const params = new URLSearchParams({ page: "Global search" });
    if (globalSearchQuery.trim()) params.set("q", globalSearchQuery.trim());
    if (key) params.set("record", key);
    window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
  }
  function updateGlobalSearchQuery(query: string) {
    setGlobalSearchQuery(query);
    setSelectedSearchResultKey(null);
    const params = new URLSearchParams({ page: "Global search" });
    if (query.trim()) params.set("q", query.trim());
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  }

  if (authLoading) return <div className="loading"><div><div className="loading-mark"><ShoppingBasket size={17} /></div>Checking your Daybook session...</div></div>;
  if (!authenticated) return <div className={`app-shell font-${fontSize} font-style-${fontStyle} accent-${accentColor}`}><main className="main-area"><div className="main-content">{authTestMode ? <><PageHeading eyebrow="Temporary verification" title="Test access password" subtitle="Check the configured Daybook password without opening or changing shared data." /><Card className="connector-card"><form className="connector-form" onSubmit={(event) => void handleTestAccessPassword(event)}><Field className="full" label="Daybook access password"><Input type="password" autoComplete="current-password" maxLength={256} required value={authTestPassword} onChange={(event) => { setAuthTestPassword(event.target.value); setAuthTestPassed(false); setAuthTestError(""); }} /></Field>{authTestError && <div className="alert alert-error full" role="alert">{authTestError}</div>}{authTestPassed && <div className="alert alert-success full" role="status">Password matches the value configured in Vercel. No session was created and no Daybook data was accessed.</div>}<div className="full"><Button type="submit" disabled={authTestLoading}>{authTestLoading ? "Checking..." : "Validate password"}</Button></div></form><p className="section-description" style={{ marginTop: 16 }}>This checks the server-side DATA_ACCESS_PASSWORD setting. It does not create a sign-in session or make a database request.</p><Button variant="outline" style={{ marginTop: 14 }} onClick={() => { setAuthTestMode(false); setAuthTestPassed(false); setAuthTestError(""); setAuthTestPassword(""); }}>Back to sign in</Button></Card></> : <><PageHeading eyebrow="Your data, wherever you go" title="Open your Daybook" subtitle="Enter your Daybook access password to securely load your shared records." /><Card className="connector-card"><form className="connector-form" onSubmit={(event) => void handleSignIn(event)}><Field className="full" label="Daybook access password"><Input type="password" autoComplete="current-password" maxLength={256} required value={accessPassword} onChange={(event) => setAccessPassword(event.target.value)} /></Field>{error && <div className="alert alert-error full" role="alert">{error}</div>}<div className="full"><Button type="submit" disabled={authLoading}>{authLoading ? "Signing in..." : "Open Daybook"}</Button></div></form><p className="section-description" style={{ marginTop: 16 }}>This password is configured by the site owner in Vercel. No Google account or external sign-in is needed.</p><Button variant="outline" style={{ marginTop: 14 }} onClick={() => { setAuthTestMode(true); setError(""); }}>Test access password configuration</Button></Card></>}</div></main></div>;
  if (dataLoading && !data) return <div className="loading"><div><div className="loading-mark"><ShoppingBasket size={17} /></div>Loading your shared Daybook data...</div></div>;
  if (setupRequired && data) return <div className={`app-shell font-${fontSize} font-style-${fontStyle} accent-${accentColor}`}><main className="main-area"><div className="main-content"><PageHeading eyebrow="One-time setup" title="Choose your starting data" subtitle="No shared data file exists yet. The initial data structure is versioned in the Git repository." />{error && <div className="alert alert-error" role="alert">{error}</div>}<Card className="connector-card"><h2 className="section-title">Move existing data from this device</h2><p className="section-description">Copy this browser’s older Daybook records to the shared GitHub data file. The old browser copy will not be deleted. If there are no older records on this device, the Git seed file will be used.</p><Button onClick={() => void initializeSharedData(true)} disabled={dataLoading}><Upload size={14} />{dataLoading ? "Saving shared data..." : "Use data from this device"}</Button></Card><Card className="connector-card" style={{ marginTop: 16 }}><h2 className="section-title">Start with the Git seed file</h2><p className="section-description">Use the blank Daybook data file tracked in Git, then share it with your other devices.</p><Button variant="outline" onClick={() => void initializeSharedData(false)} disabled={dataLoading}><Plus size={14} />Use Git seed data</Button></Card></div></main></div>;
  if (!data) return <div className="loading"><div><div className="loading-mark"><ShoppingBasket size={17} /></div>Getting your daybook ready...</div></div>;
  const archivedDocuments = (data.archivedRecords ?? []).flatMap((record) => record.snapshot.documents ?? []);
  const allDocuments = [...(data.documents ?? []), ...archivedDocuments];
  const menuGroups = (() => {
    if (!groupMenus) return [{ group: null, entries: orderedNavigation(navigation, menuSortOrder) }];
    const groups = menuSortOrder === "ascending"
      ? [...NAVIGATION_GROUP_ORDER].sort((a, b) => a.localeCompare(b))
      : NAVIGATION_GROUP_ORDER;
    return groups.map((group) => ({
      group,
      entries: orderedNavigation(navigation.filter((entry) => entry.group === group), menuSortOrder),
    }));
  })();
  const pageContent: Record<Page, ReactNode> = {
    Dashboard: <Dashboard data={data} widgets={dashboardWidgets} onPage={changePage} />,
    "Global search": <GlobalSearchPage data={data} query={globalSearchQuery} selectedKey={selectedSearchResultKey} onQueryChange={updateGlobalSearchQuery} onSelect={selectSearchResult} onGoToPage={changePage} />,
    "Shopping list": <ShoppingList data={data} onToggle={togglePurchased} onAdd={() => setModal("add")} onEdit={setEditing} onCopy={copyItem} onDelete={deleteItem} />,
    "Shopping trips": <ShoppingTrips data={data} onAdd={() => setModal("trip")} onSave={saveTripEdits} onCopy={copyTrip} onDelete={archiveTrip} />,
    "Purchase history": <PurchaseHistory data={data} onSave={savePurchase} onCopy={copyPurchase} onDelete={archivePurchase} />,
    "Price history": <PriceHistory data={data} />,
    Reports: <Reports data={data} />,
    "Notes & reminders": <ReminderPage reminders={data.reminders ?? []} categories={data.reminderCategories ?? []} onSave={saveReminder} onDelete={deleteReminder} onToggle={toggleReminder} />,
    "Master data": <MasterData stores={data.stores ?? []} products={data.products ?? []} reminders={data.reminders ?? []} reminderCategories={data.reminderCategories ?? []} onAddStore={addStore} onSaveStore={saveStore} onDeleteStore={(id) => update((previous) => {
      const store = (previous.stores ?? []).find((entry) => entry.id === id);
      if (!store) return previous;
      return { ...withArchivedRecord(previous, `Store: ${store.name}`, { stores: [store] }), stores: (previous.stores ?? []).filter((entry) => entry.id !== id) };
    })} onAddProduct={addProduct} onSaveProduct={saveProduct} onDeleteProduct={(id) => update((previous) => {
      const product = (previous.products ?? []).find((entry) => entry.id === id);
      if (!product) return previous;
      return { ...withArchivedRecord(previous, `Product: ${product.name}`, { products: [product] }), products: (previous.products ?? []).filter((entry) => entry.id !== id) };
    })} onAddReminderCategory={addReminderCategory} onRenameReminderCategory={renameReminderCategory} onDeleteReminderCategory={deleteReminderCategory} />,
    Stocks: <StockWorkspace stocks={data.stocks ?? []} brokers={data.brokers ?? []} quotes={data.stockQuotes ?? []} onSaveStock={saveStock} onDeleteStock={deleteStock} onAddBroker={addBroker} onRenameBroker={renameBroker} onDeleteBroker={deleteBroker} onSaveQuote={saveStockQuote} />,
    "Asset manager": <AssetManager assets={data.assets ?? []} onSave={saveAsset} onDelete={deleteAsset} />,
    "Learning": <LearningPage records={data.learningRecords ?? []} onSave={saveLearningRecord} onDelete={deleteLearningRecord} />,
    "Mind & habits": <MindfulnessPage habits={data.mindfulHabits ?? []} logs={data.mindfulnessLogs ?? []} onSaveHabit={saveMindfulHabit} onArchiveHabit={archiveMindfulHabit} onSaveLog={saveMindfulnessLog} onArchiveLog={archiveMindfulnessLog} />,
    "AI Prompts": <PromptManagerPage records={data.promptRecords ?? []} onSave={savePromptRecord} onDelete={deletePromptRecord} onCopy={(record) => void copyPromptToClipboard(record)} />,
    "Training & classes": <TrainingClassesPage sessions={data.trainingSessions ?? []} onSave={saveTrainingSession} onDelete={deleteTrainingSession} />,
    Devotional: <DevotionalPage entries={data.devotionalEntries ?? []} resources={data.devotionalResources ?? []} requests={data.prayerRequests ?? []} onSaveEntry={saveDevotionalEntry} onDeleteEntry={deleteDevotionalEntry} onSaveResource={saveDevotionalResource} onDeleteResource={deleteDevotionalResource} onSaveRequest={savePrayerRequest} onDeleteRequest={deletePrayerRequest} />,
    Cooking: <CookingPage recipes={data.cookingRecipes ?? []} logs={data.cookingLogs ?? []} onSaveRecipe={saveCookingRecipe} onDeleteRecipe={deleteCookingRecipe} onSaveLog={saveCookingLog} onDeleteLog={deleteCookingLog} />,
    "Issues & maintenance": <IssuesMaintenancePage records={data.issueRecords ?? []} onSave={saveIssueRecord} onDelete={deleteIssueRecord} />,
    "Education & career": <EducationCareerPage education={data.personalEducation ?? []} qualifications={data.professionalQualifications ?? []} experience={data.workExperiences ?? []} skills={data.professionalSkills ?? []} onSaveEducation={savePersonalEducation} onDeleteEducation={deletePersonalEducation} onSaveQualification={saveProfessionalQualification} onDeleteQualification={deleteProfessionalQualification} onSaveExperience={saveWorkExperience} onDeleteExperience={deleteWorkExperience} onSaveSkill={saveProfessionalSkill} onDeleteSkill={deleteProfessionalSkill} />,
    Family: <FamilyPage members={data.familyMembers ?? []} onSave={saveFamilyMember} onDelete={deleteFamilyMember} />,
    "Schools & Colleges": <EducationRecordsPage records={data.educationRecords ?? []} onSave={saveEducationRecord} onDelete={deleteEducationRecord} />,
    Vehicles: <VehicleManagement vehicles={data.vehicles ?? []} journeys={data.vehicleJourneys ?? []} maintenance={data.vehicleMaintenance ?? []} onSaveVehicle={saveVehicle} onCopyVehicle={copyVehicle} onDeleteVehicle={deleteVehicle} onSaveJourney={saveVehicleJourney} onDeleteJourney={deleteVehicleJourney} onSaveMaintenance={saveVehicleMaintenance} onDeleteMaintenance={deleteVehicleMaintenance} />,
    Electricity: <ElectricityPage readings={data.electricityReadings ?? []} onSave={saveElectricityReading} onDelete={deleteElectricityReading} />,
    "Subscriptions & bills": <SubscriptionsPage accounts={data.subscriptions ?? []} onSaveAccount={saveSubscriptionAccount} onArchiveAccount={archiveSubscriptionAccount} onSaveTransaction={saveSubscriptionTransaction} onArchiveTransaction={archiveSubscriptionTransaction} />,
    "Personal documents": <PersonalRecordsPage records={data.personalRecords ?? []} onSave={savePersonalRecord} onDelete={deletePersonalRecord} />,
    Documents: <DocumentManager documents={data.documents ?? []} archivedDocumentCount={archivedDocuments.length} totalStoredBytes={[...new Map(allDocuments.map((document) => [document.storagePath, document])).values()].reduce((total, document) => total + document.sizeBytes, 0)} onSave={saveDocument} onCopy={copyDocument} onArchive={archiveDocument} onRemoveFile={removeDocumentFile} />,
    "Database manager": <DatabaseManagerPage />,
    "Hosting & storage": <HostingStoragePage />,
    Archive: <ArchivePage records={data.archivedRecords ?? []} onRestore={restoreArchivedRecord} onCopy={copyArchivedRecord} onDelete={permanentlyDeleteArchivedRecord} />,
    "Account credentials": <CredentialVaultPage vault={data.credentialVault} onSave={(credentialVault) => update((previous) => ({ ...previous, credentialVault }))} onDelete={() => update((previous) => ({ ...previous, credentialVault: undefined }))} />,
    "Data management": <DataManagement data={data} currency={currency} darkMode={darkMode} fontSize={fontSize} fontStyle={fontStyle} fontFamily={fontFamily} accentColor={accentColor} darkTheme={darkTheme} visualTheme={visualTheme} dashboardWidgets={dashboardWidgets} groupMenus={groupMenus} menuSortOrder={menuSortOrder} syncStatus={syncStatus} syncMessage={syncMessage} refreshing={refreshing} onCurrencyChange={setCurrency} onToggleDarkMode={() => setDarkMode((enabled) => !enabled)} onFontSizeChange={setFontSize} onFontStyleChange={setFontStyle} onFontFamilyChange={setFontFamily} onAccentChange={setAccentColor} onDarkThemeChange={setDarkTheme} onVisualThemeChange={setVisualTheme} onToggleDashboardWidget={(widget) => setDashboardWidgets((current) => current.includes(widget) ? current.filter((entry) => entry !== widget) : [...current, widget])} onGroupMenusChange={setGroupMenus} onMenuSortOrderChange={setMenuSortOrder} onImport={importBackup} onClear={clearData} onExport={exportBackup} onSaveNow={() => void saveNow()} onRefresh={() => void refreshSharedData()} onSignOut={() => void handleSignOut()} />,
    "R&D / Test Connectors": <TestConnectors />,
  };
  return <CurrencyContext.Provider value={currency}><div className={`app-shell ${darkMode ? "dark" : ""} font-${fontSize} font-style-${fontStyle} font-family-${fontFamily} accent-${accentColor} theme-${darkTheme} style-${visualTheme}`}>
    {mobileMenu && <button aria-label="Close menu" onClick={() => setMobileMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 9, background: "#18211b55", border: 0 }} />}
    <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}><div className="brand"><div className="brand-mark"><ShoppingBasket size={19} /></div><div><div className="brand-name">daybook<span>.</span></div><div className="brand-caption">your shopping companion</div></div></div>
      <div className="nav-label">YOUR SPACE</div><nav className={`nav-list ${groupMenus ? "nav-list-grouped" : ""}`} aria-label="Main navigation">{menuGroups.map(({ group, entries }) => {
        const collapsed = group !== null && collapsedNavGroups.has(group);
        return <div className="nav-section" key={group ?? "all"}>
          {group && <button className="nav-section-heading" type="button" aria-expanded={!collapsed} onClick={() => setCollapsedNavGroups((current) => {
            const next = new Set(current);
            if (next.has(group)) next.delete(group); else next.add(group);
            return next;
          })}><ChevronRight size={13} className={`nav-section-chevron ${collapsed ? "" : "expanded"}`} /><span>{group}</span><small>{entries.length}</small></button>}
          {!collapsed && entries.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${page === name ? "active" : ""}`} onClick={() => changePage(name)}><Icon size={16} strokeWidth={1.8} />{name}</button>)}
        </div>;
      })}</nav>
      <div className="sidebar-bottom"><div className="nav-label">PREFERENCES</div><button className={`nav-item ${page === "Data management" ? "active" : ""}`} onClick={() => changePage("Data management")}><Settings2 size={16} strokeWidth={1.8} />Data management</button><div className="side-note"><strong>A little more mindful.</strong>Your everyday shopping, gently organized in one place.</div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileMenu(true)}><Menu size={19} /></button><span className="topbar-date">{titleDate}</span></div><div className="topbar-right"><button className="theme-toggle navigation-toggle" type="button" aria-pressed={groupMenus} aria-label={groupMenus ? "Switch to flat menu" : "Switch to grouped menu"} title={groupMenus ? "Switch to flat menu" : "Switch to grouped menu"} onClick={() => setGroupMenus((enabled) => !enabled)}><ListTree size={15} /><span>{groupMenus ? "Grouped" : "Flat menu"}</span></button><button className="theme-toggle global-search-topbar" type="button" onClick={() => changePage("Global search")}><Search size={15} /><span>Search</span></button><button className="theme-toggle" type="button" aria-pressed={darkMode} onClick={() => setDarkMode((enabled) => !enabled)}>{darkMode ? <Sun size={15} /> : <Moon size={15} />}<span>{darkMode ? "Light mode" : "Dark mode"}</span></button><button className="text-link" type="button" onClick={() => void handleSignOut()}>Sign out</button></div></header>
      <div className="main-content">{error && <div className="alert alert-error" role="alert"><X size={15} style={{ flex: "none", marginTop: 1 }} /><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={() => setError("")}><X size={14} /></button></div>}{notice && <div className="alert alert-success" role="status"><CheckCircle2 size={15} /><span>{notice}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={14} /></button></div>}{pageContent[page]}</div>
    </main>
    <nav className="mobile-nav" aria-label="Mobile navigation">{navigation.filter(({ name }) => ["Dashboard", "Shopping list", "Shopping trips", "Purchase history"].includes(name)).map(({ name, icon: Icon }) => <button key={name} className={page === name ? "active" : ""} onClick={() => changePage(name)}><Icon size={17} /><span>{name === "Shopping list" ? "List" : name === "Shopping trips" ? "Trips" : name === "Purchase history" ? "History" : name}</span></button>)}</nav>
    {modal === "add" && <ItemModal products={data.products ?? []} onClose={() => setModal(null)} onSave={addItem} />}
    {editing && <ItemModal initial={editing} products={data.products ?? []} onClose={() => setEditing(null)} onSave={editItem} />}
    {modal === "trip" && <TripModal data={data} onClose={() => setModal(null)} onSave={saveTrip} />}
  </div></CurrencyContext.Provider>;
}
