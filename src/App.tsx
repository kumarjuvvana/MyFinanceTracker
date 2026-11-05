import { createContext, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownToLine, ArrowLeftRight, Bell, BarChart3, BookOpen, CalendarDays, Car, Check, CheckCircle2,
  ChevronRight, ClipboardList, Clock3, Database, Download,
  Copy, Eye, EyeOff, FileDown, FileJson2, FileText, Filter, GraduationCap, KeyRound, LayoutDashboard, Leaf, ListChecks, LockKeyhole, Mail, MapPin, Menu, Palette, Pencil,
  Moon, Plus, Search, Settings2, ShoppingBag, ShoppingBasket, ShoppingCart, Sparkles,
  RefreshCw, Sun, Trash2, TrendingUp, Upload, Wallet, Wrench, X,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select } from "./components/ui";
import { createId, exportCsv, formatCurrency as formatMoney, monthKey, normalizeTrackerData, STORAGE_KEY, today, validateData } from "./lib/data";
import { checkSession, loadSharedData, saveSharedData, signIn, signOut, validateAccessPassword } from "./lib/dataApi";
import { createCredentialVault, decryptCredentialVaultWithKey, unlockCredentialVault, updateCredentialVault, type UnlockedCredentialVault } from "./lib/credentialVault";
import { ACCENT_COLORS, ASSET_TYPES, CATEGORIES, CURRENCIES, DARK_THEMES, EDUCATION_FEE_TYPES, EDUCATION_LEVELS, ITEM_UNITS, REMINDER_CATEGORIES, VISUAL_THEMES, type AccentColor, type AssetRecord, type AssetType, type Category, type CredentialRecord, type Currency, type DarkTheme, type EducationExam, type EducationFeeType, type EducationLevel, type EducationPayment, type EducationRecord, type EducationStatus, type EducationSubject, type EncryptedCredentialVault, type FontSize, type FontStyle, type LearningLevel, type LearningRecord, type LearningStatus, type Page, type PersonalRecord, type PersonalRecordField, type PersonalRecordType, type Product, type Purchase, type Reminder, type ShoppingItem, type ShoppingTrip, type StockExchange, type StockQuoteSnapshot, type Store, type TrackedStock, type TrackerData, type Vehicle, type VehicleJourney, type VehicleMaintenance, type VehicleMaintenanceType, type VisualTheme } from "./types";

const PREFERENCES_KEY = "daybook-shopping-preferences";
const CurrencyContext = createContext<Currency>("INR");
function useCurrencyFormatter() {
  const currency = useContext(CurrencyContext);
  return (amount: number) => formatMoney(amount, currency);
}
const navigation: { name: Page; icon: typeof LayoutDashboard }[] = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Shopping list", icon: ListChecks },
  { name: "Shopping trips", icon: ShoppingBag },
  { name: "Purchase history", icon: Clock3 },
  { name: "Price history", icon: ArrowLeftRight },
  { name: "Reports", icon: BarChart3 },
  { name: "Notes & reminders", icon: Bell },
  { name: "Master data", icon: Database },
  { name: "Stocks", icon: TrendingUp },
  { name: "Asset manager", icon: Wallet },
  { name: "Learning", icon: BookOpen },
  { name: "School & college records", icon: GraduationCap },
  { name: "Vehicles", icon: Car },
  { name: "Personal documents", icon: FileText },
  { name: "Account credentials", icon: KeyRound },
  { name: "R&D / Test Connectors", icon: Mail },
];
const categoryColors: Record<Category, string> = {
  Vegetables: "#6d9873", Groceries: "#8a7db3", Fruits: "#d19a50",
  Household: "#6688a0", "Personal Care": "#bd7b8d", Others: "#829080",
};
const defaultItem = (): Omit<ShoppingItem, "id"> => ({
  name: "", quantity: 1, unit: "pcs", category: "Groceries", estimatedPrice: 0, purchased: false,
});
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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

function Dashboard({ data, onPage }: { data: TrackerData; onPage: (page: Page) => void }) {
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
  return <><PageHeading eyebrow="Your little corner of calm" title="Good things, in check." subtitle="A clearer picture of your everyday shopping." action={<Button onClick={() => onPage("Shopping list")}><Plus size={15} /> Add to list</Button>} />
    <div className="stat-grid">{stats.map(({ label, value, note, icon: Icon, tone }) => <Card className="stat-card" key={label}><div className="stat-top"><span>{label}</span><span className={`stat-icon icon-${tone}`}><Icon size={16} /></span></div><p className="stat-value">{value}</p><div className="stat-foot">{note}</div></Card>)}</div>
    {reminders.length > 0 && <Card className="dashboard-reminders"><div className="card-head"><div><h2 className="section-title">Notes & reminders</h2><p className="section-description">Due now or coming up in the next 7 days</p></div><button className="text-link" onClick={() => onPage("Notes & reminders")}>See all <ChevronRight size={12} /></button></div><div className="reminder-list">{reminders.slice(0, 4).map((reminder) => <div className="reminder-row" key={reminder.id}><Bell size={15} /><div className="recent-info"><div className="recent-name">{reminder.title}</div><div className="recent-meta">{[reminder.category || "General", reminder.details || "No extra details"].filter(Boolean).join(" · ")}</div></div><Badge tone={reminder.date < today() ? "amber" : "green"}>{reminder.date < today() ? "Overdue" : reminder.date === today() ? "Today" : dateLabel(reminder.date)}</Badge></div>)}</div></Card>}
    {documentDue.length > 0 && <Card className="dashboard-reminders"><div className="card-head"><div><h2 className="section-title">Document & policy dates</h2><p className="section-description">Expired or approaching the reminder date you set</p></div><button className="text-link" onClick={() => onPage("Personal documents")}>Manage records <ChevronRight size={12} /></button></div><div className="reminder-list">{documentDue.slice(0, 5).map((record) => {
      const remaining = daysUntil(record.dueDate);
      return <div className="reminder-row" key={record.id}><FileText size={15} /><div className="recent-info"><div className="recent-name">{record.title}</div><div className="recent-meta">{record.type} · Due {dateLabel(record.dueDate)}</div></div><Badge tone="amber">{remaining < 0 ? "Expired" : remaining === 0 ? "Today" : `${remaining} days`}</Badge></div>;
    })}</div></Card>}
    <div className="section-grid"><Card><div className="card-head"><div><h2 className="section-title">Your spending, lately</h2><p className="section-description">The last seven days, at a glance</p></div><Badge tone="green"><TrendingUp size={11} /> This week</Badge></div><div className="spend-summary"><strong>{formatCurrency(data.purchases.filter((purchase) => {
      const start = new Date(); start.setDate(start.getDate() - 6); return purchase.date >= start.toISOString().slice(0, 10);
    }).reduce((sum, purchase) => sum + purchase.price, 0))}</strong><span>in the last 7 days</span></div><SpendingChart purchases={data.purchases} /></Card>
      <RecentPurchases purchases={[...data.purchases].sort((a, b) => b.date.localeCompare(a.date))} onViewAll={() => onPage("Purchase history")} /></div>
    <div className="section-grid"><Card><div className="card-head"><div><h2 className="section-title">A few things to pick up</h2><p className="section-description">Your next trip is already taking shape</p></div><button className="text-link" onClick={() => onPage("Shopping list")}>See the list <ChevronRight size={12} style={{ verticalAlign: "middle" }} /></button></div>
      {pending.slice(0, 4).length ? <div className="recent-list">{pending.slice(0, 4).map((item) => <div className="recent-row" key={item.id}><div className="item-dot"><Leaf size={15} /></div><div className="recent-info"><div className="recent-name">{item.name}</div><div className="recent-meta">{item.quantity} {item.unit} · {item.category}</div></div><div className="recent-price">{formatCurrency(item.estimatedPrice * item.quantity)}</div></div>)}</div> : <EmptyState icon={<CheckCircle2 size={18} />} title="All caught up!" description="Your shopping list is clear. Enjoy the moment." />}</Card>
      <Card><div className="card-head"><div><h2 className="section-title">Where it goes</h2><p className="section-description">This month's spending by category</p></div><button className="text-link" onClick={() => onPage("Reports")}>Full report <ChevronRight size={12} style={{ verticalAlign: "middle" }} /></button></div><CategoryBreakdown purchases={monthlyPurchases} /></Card></div>
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

function ShoppingList({ data, onToggle, onAdd, onEdit, onDelete }: { data: TrackerData; onToggle: (item: ShoppingItem) => void; onAdd: () => void; onEdit: (item: ShoppingItem) => void; onDelete: (item: ShoppingItem) => void }) {
  const formatCurrency = useCurrencyFormatter();
  const [filter, setFilter] = useState("All items");
  const [search, setSearch] = useState("");
  const items = data.items.filter((item) => (filter === "All items" || (filter === "To buy" ? !item.purchased : item.purchased)) && item.name.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeading eyebrow="Plan a little ahead" title="Shopping list" subtitle={`${data.items.filter((item) => !item.purchased).length} things waiting patiently for their turn.`} action={<Button onClick={onAdd}><Plus size={15} /> Add an item</Button>} />
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search items" placeholder="Find something..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select aria-label="Filter list" style={{ width: 145 }} value={filter} onChange={(e) => setFilter(e.target.value)}><option>All items</option><option>To buy</option><option>Picked up</option></Select><Badge>{items.length} {items.length === 1 ? "item" : "items"}</Badge></div>
    <Card className="table-card"><table className="data-table"><thead><tr><th>Item</th><th>Category</th><th>Quantity</th><th>Est. total</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td data-label="Item"><div style={{ display: "flex", alignItems: "center", gap: 10 }}><button className={`check-button ${item.purchased ? "checked" : ""}`} aria-label={item.purchased ? `Mark ${item.name} as not purchased` : `Mark ${item.name} as purchased`} onClick={() => onToggle(item)}>{item.purchased && <Check size={12} />}</button><div><div className="table-primary">{item.name}</div></div></div></td><td data-label="Category"><Badge>{item.category}</Badge></td><td data-label="Quantity">{item.quantity} {item.unit}</td><td data-label="Est. total" className="table-total">{formatCurrency(item.estimatedPrice * item.quantity)}<div className="table-secondary">{formatCurrency(item.estimatedPrice)} / {item.unit}</div></td><td data-label="Status"><Badge tone={item.purchased ? "green" : "amber"}>{item.purchased ? "Picked up" : "To buy"}</Badge></td><td data-label="Actions"><div className="table-actions"><button className="icon-button" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}><Pencil size={14} /></button><button className="icon-button" aria-label={`Delete ${item.name}`} onClick={() => onDelete(item)}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table>
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
    <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
    <Field label="Store"><Select autoFocus value={store} onChange={(e) => setStore(e.target.value)}><option value="">Choose a saved store</option>{(data.stores ?? []).map((entry) => <option key={entry.id} value={entry.name}>{entry.location ? `${entry.name} — ${entry.location}` : entry.name}</option>)}<option value="__custom">Other (enter manually)</option></Select>{store === "__custom" && <Input autoFocus placeholder="Where are you headed?" value={customStore} onChange={(e) => setCustomStore(e.target.value)} />}</Field>
    <Field className="full" label="A note for later"><Input placeholder="Anything to remember?" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    <div className="field-wrap full"><span className="field-label">Items to pick up</span>{pending.length ? <div className="recent-list">{pending.map((item) => <label className="recent-row" key={item.id} style={{ cursor: "pointer" }}><input type="checkbox" checked={selected.includes(item.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} /><div className="recent-info"><div className="recent-name">{item.name}</div><div className="recent-meta">{item.quantity} {item.unit} · {item.category}</div></div><span className="recent-price">{formatCurrency(item.estimatedPrice * item.quantity)}</span></label>)}</div> : <p className="section-description">Your list is empty for now. Add items first and they'll be ready to choose here.</p>}</div>
  </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }}>{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit"><ShoppingBag size={14} /> Save trip</Button></div></form></Modal>;
}

function ShoppingTrips({ data, onAdd }: { data: TrackerData; onAdd: () => void }) {
  const formatCurrency = useCurrencyFormatter();
  const trips = [...data.trips].sort((a, b) => b.date.localeCompare(a.date));
  return <><PageHeading eyebrow="Make a little plan" title="Shopping trips" subtitle="Your errands, saved in one easy place." action={<Button onClick={onAdd}><Plus size={15} /> Plan a trip</Button>} />
    {trips.length ? <div className="trip-grid">{trips.map((trip) => {
      const purchases = trip.purchaseIds.map((id) => data.purchases.find((purchase) => purchase.id === id)).filter((purchase): purchase is Purchase => Boolean(purchase));
      const total = purchases.reduce((sum, purchase) => sum + purchase.price, 0);
      return <Card className="trip-card" key={trip.id}><div className="trip-card-top"><div><div className="trip-store">{trip.store}</div><div className="trip-date"><CalendarDays size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />{dateLabel(trip.date)}</div></div><div className="trip-total">{formatCurrency(total)}</div></div><p className="trip-note">{trip.notes || "A little shopping, all in one place."}</p><div className="trip-items">{purchases.length ? purchases.map((purchase) => purchase.itemName).join(" · ") : "No items recorded"}</div></Card>;
    })}</div> : <Card><EmptyState icon={<ShoppingBag size={18} />} title="No trips planned just yet" description="Create a trip, choose a store and add items from your shopping list." /></Card>}
  </>;
}

function PurchaseHistory({ data }: { data: TrackerData }) {
  const formatCurrency = useCurrencyFormatter();
  const [search, setSearch] = useState("");
  const [store, setStore] = useState("All stores");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const stores = [...new Set(data.purchases.map((purchase) => purchase.store))].sort();
  const purchases = [...data.purchases].filter((purchase) => (!search || purchase.itemName.toLowerCase().includes(search.toLowerCase())) && (store === "All stores" || purchase.store === store) && (!from || purchase.date >= from) && (!to || purchase.date <= to)).sort((a, b) => b.date.localeCompare(a.date));
  const total = purchases.reduce((sum, purchase) => sum + purchase.price, 0);
  return <><PageHeading eyebrow="A record of the good stuff" title="Purchase history" subtitle="Everything you've brought home, in one place." />
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input placeholder="Search items..." aria-label="Search purchases" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select aria-label="Filter by store" style={{ width: 165 }} value={store} onChange={(e) => setStore(e.target.value)}><option>All stores</option>{stores.map((name) => <option key={name}>{name}</option>)}</Select><Input className="filter-date" aria-label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><Input className="filter-date" aria-label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
    <Card className="table-card"><div className="history-summary"><span className="section-description" style={{ margin: 0 }}>{purchases.length} {purchases.length === 1 ? "purchase" : "purchases"} found</span><strong>Total · {formatCurrency(total)}</strong></div><table className="data-table"><thead><tr><th>Date</th><th>Item</th><th>Store</th><th>Category</th><th>Quantity</th><th>Paid</th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id}><td data-label="Date">{dateLabel(purchase.date)}</td><td data-label="Item"><div className="table-primary">{purchase.itemName}</div></td><td data-label="Store">{purchase.store}</td><td data-label="Category"><Badge>{purchase.category}</Badge></td><td data-label="Quantity">{purchase.quantity} {purchase.unit}</td><td data-label="Paid" className="table-total">{formatCurrency(purchase.price)}</td></tr>)}</tbody></table>{purchases.length === 0 && <EmptyState icon={<Search size={18} />} title="No purchases match" description="Try adjusting the dates, store or item search." />}</Card>
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
      <Field label="Date"><Input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></Field>
      <Field className="full" label="Category"><div className="reminder-category-grid" role="group" aria-label="Choose reminder category">{categories.map((entry) => <button key={entry} type="button" className={`category-choice ${category === entry ? "selected" : ""}`} aria-pressed={category === entry} onClick={() => setCategory(entry)}>{entry}</button>)}</div></Field>
      <Field className="full" label="Details"><textarea className="field textarea" rows={3} maxLength={1000} value={details} onChange={(event) => setDetails(event.target.value)} /></Field>
      {error && <div className="alert alert-error full" role="alert">{error}</div>}
      <div className="reminder-form-actions full"><Button type="submit"><Check size={14} />Save changes</Button><Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button></div>
    </form>
  </Card>;

  return <Card className={`reminder-card ${reminder.completed ? "completed" : ""}`}>
    <button className={`check-button ${reminder.completed ? "checked" : ""}`} aria-label={reminder.completed ? `Mark ${reminder.title} as incomplete` : `Mark ${reminder.title} as complete`} onClick={() => onToggle(reminder)}>{reminder.completed && <Check size={12} />}</button>
    <div className="recent-info"><div className="recent-name">{reminder.title}</div><div className="recent-meta">{dateLabel(reminder.date)}{reminder.details ? ` · ${reminder.details}` : ""}</div></div>
    <Badge className="reminder-category-badge">{reminder.category || "General"}</Badge>
    <Badge className="reminder-status-badge" tone={reminder.completed ? "neutral" : reminder.date < today() ? "amber" : reminder.date === today() ? "green" : "blue"}>{reminder.completed ? "Done" : reminder.date < today() ? "Overdue" : reminder.date === today() ? "Today" : "Upcoming"}</Badge>
    <div className="table-actions"><button className="icon-button" aria-label={`Edit ${reminder.title}`} onClick={startEditing}><Pencil size={14} /></button><button className="icon-button" aria-label={`Delete ${reminder.title}`} onClick={() => { if (window.confirm(`Delete "${reminder.title}"?`)) onDelete(reminder.id); }}><Trash2 size={14} /></button></div>
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
      <Field label="Date"><Input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></Field>
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

function MasterData({ stores, products, reminders, reminderCategories, onAddStore, onDeleteStore, onAddProduct, onDeleteProduct, onAddReminderCategory, onDeleteReminderCategory }: { stores: Store[]; products: Product[]; reminders: Reminder[]; reminderCategories: string[]; onAddStore: (store: Omit<Store, "id">) => void; onDeleteStore: (id: string) => void; onAddProduct: (product: Omit<Product, "id">) => void; onDeleteProduct: (id: string) => void; onAddReminderCategory: (category: string) => void; onDeleteReminderCategory: (category: string) => void }) {
  const currency = useContext(CurrencyContext);
  const [storeName, setStoreName] = useState("");
  const [location, setLocation] = useState("");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState<Category>("Groceries");
  const [unit, setUnit] = useState("pcs");
  const [price, setPrice] = useState(0);
  const [reminderCategoryName, setReminderCategoryName] = useState("");
  const [error, setError] = useState("");
  function addStore(event: FormEvent) {
    event.preventDefault();
    if (!storeName.trim()) { setError("Enter a store name."); return; }
    if (stores.some((store) => store.name.toLowerCase() === storeName.trim().toLowerCase())) { setError("That store is already in your master data."); return; }
    onAddStore({ name: storeName.trim(), location: location.trim() }); setStoreName(""); setLocation(""); setError("");
  }
  function addProduct(event: FormEvent) {
    event.preventDefault();
    if (!productName.trim() || !unit.trim() || !Number.isFinite(price) || price < 0) { setError("Enter a product name, unit, and a non-negative unit price."); return; }
    if (products.some((product) => product.name.toLowerCase() === productName.trim().toLowerCase())) { setError("That product is already in your master data."); return; }
    onAddProduct({ name: productName.trim(), category, unit: unit.trim(), estimatedPrice: price });
    setProductName(""); setUnit("pcs"); setPrice(0); setError("");
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
  return <><PageHeading eyebrow="Reusable shopping details" title="Master data" subtitle="Save your common products and stores, including plain-text store locations." />
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    <div className="master-grid"><Card><div className="card-head"><div><h2 className="section-title">Product master</h2><p className="section-description">Reusable names, units and per-unit price estimates</p></div><ShoppingBasket size={16} /></div><form className="form-grid master-form" onSubmit={addProduct}><Field className="full" label="Product name"><Input required maxLength={100} placeholder="e.g. Basmati rice" value={productName} onChange={(event) => setProductName(event.target.value)} /></Field><Field label="Category"><Select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{CATEGORIES.map((entry) => <option key={entry}>{entry}</option>)}</Select></Field><Field label="Unit"><Input list="master-item-units" required value={unit} onChange={(event) => setUnit(event.target.value)} /><datalist id="master-item-units">{ITEM_UNITS.map((entry) => <option key={entry} value={entry} />)}</datalist></Field><Field className="full" label={`Price per ${unit || "unit"} (${currency})`}><Input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></Field><div className="full"><Button type="submit"><Plus size={14} />Add product</Button></div></form><div className="master-entry-list">{products.length ? products.map((product) => <div className="master-entry" key={product.id}><div className="recent-info"><div className="recent-name">{product.name}</div><div className="recent-meta">{product.category} · {formatMoney(product.estimatedPrice, currency)} per {product.unit}</div></div><button className="icon-button" aria-label={`Delete ${product.name}`} onClick={() => { if (window.confirm(`Delete "${product.name}" from product master data? Existing shopping list entries will be kept.`)) onDeleteProduct(product.id); }}><Trash2 size={14} /></button></div>) : <p className="section-description">No saved products yet.</p>}</div></Card>
      <Card><div className="card-head"><div><h2 className="section-title">Store master</h2><p className="section-description">Save store names and optional addresses or locations</p></div><Database size={16} /></div><form className="form-grid master-form" onSubmit={addStore}><Field className="full" label="Store name"><Input required maxLength={100} placeholder="e.g. Green Basket" value={storeName} onChange={(event) => setStoreName(event.target.value)} /></Field><Field className="full" label="Address / location (optional)"><Input maxLength={200} placeholder="Street, neighborhood, or a note to identify it" value={location} onChange={(event) => setLocation(event.target.value)} /></Field><div className="full"><Button type="submit"><Plus size={14} />Add store</Button></div></form><div className="master-entry-list">{stores.length ? stores.map((store) => <div className="master-entry" key={store.id}><div className="recent-info"><div className="recent-name">{store.name}</div><div className="recent-meta">{store.location || "No location added"}</div></div><button className="icon-button" aria-label={`Delete ${store.name}`} onClick={() => { if (window.confirm(`Delete "${store.name}"? Previously recorded trip history will be kept.`)) onDeleteStore(store.id); }}><Trash2 size={14} /></button></div>) : <p className="section-description">No saved stores yet.</p>}</div></Card>
      <Card><div className="card-head"><div><h2 className="section-title">Reminder categories</h2><p className="section-description">Create reusable groups for Notes & reminders</p></div><Bell size={16} /></div><form className="master-form reminder-category-master-form" onSubmit={addReminderCategory}><Field label="New category"><Input required maxLength={80} placeholder="e.g. Travel, Family" value={reminderCategoryName} onChange={(event) => setReminderCategoryName(event.target.value)} /></Field><Button type="submit"><Plus size={14} />Add category</Button></form><div className="master-entry-list">{reminderCategories.length ? reminderCategories.map((entry) => { const uses = reminders.filter((reminder) => (reminder.category || "General").toLocaleLowerCase() === entry.toLocaleLowerCase()).length; return <div className="master-entry" key={entry}><div className="recent-info"><div className="recent-name">{entry}</div><div className="recent-meta">{uses} {uses === 1 ? "reminder" : "reminders"}</div></div><button className="icon-button" aria-label={`Delete ${entry} reminder category`} title={uses ? "Category is used by reminders" : "Delete category"} disabled={uses > 0} onClick={() => { if (window.confirm(`Delete the "${entry}" reminder category?`)) onDeleteReminderCategory(entry); }}><Trash2 size={14} /></button></div>; }) : <p className="section-description">No custom categories yet. Built-in categories are always available.</p>}</div></Card></div>
  </>;
}

function StockWorkspace({ stocks, brokers, quotes, onSaveStock, onDeleteStock, onAddBroker, onDeleteBroker, onSaveQuote }: {
  stocks: TrackedStock[];
  brokers: string[];
  quotes: StockQuoteSnapshot[];
  onSaveStock: (stock: Omit<TrackedStock, "id">, id?: string) => void;
  onDeleteStock: (id: string) => void;
  onAddBroker: (name: string) => void;
  onDeleteBroker: (name: string) => void;
  onSaveQuote: (quote: Omit<StockQuoteSnapshot, "id">) => void;
}) {
  const [brokerName, setBrokerName] = useState("");
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
  function submitStock(event: FormEvent) {
    event.preventDefault();
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9.&_-]{0,29}$/.test(normalizedSymbol) || !name.trim()) {
      setError("Enter a stock code using letters or numbers and a display name."); return;
    }
    if (stocks.some((stock) => stock.id !== editingId && stock.symbol === normalizedSymbol && stock.exchange === exchange)) {
      setError(`That ${exchange} stock code is already on your list.`); return;
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
  function formatQuote(price: number, currency: string) {
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(price); }
    catch { return `${currency} ${price.toFixed(2)}`; }
  }

  return <><PageHeading eyebrow="Market watch" title="Stocks" subtitle="Track NSE and BSE codes, organize them by broker, and save refreshed price snapshots." action={<Button onClick={() => refreshStocks()} disabled={busy || stocks.length === 0}><RefreshCw size={14} className={busy ? "spin" : ""} />{busy ? "Refreshing..." : "Refresh prices"}</Button>} />
    <div className="alert stock-source-note"><TrendingUp size={15} /><span>Quotes are requested from Yahoo Finance through the app’s server endpoint. This free public source is unofficial and may delay, limit, or temporarily fail to provide prices. Initial prices copied from the supplied portfolio screenshot are marked “SCREENSHOT SEED”; refresh to request current quotes. All snapshots are saved only in this browser.</span></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    {refreshErrors.length > 0 && <div className="alert alert-error stock-errors" role="alert"><div><strong>Some prices could not be refreshed:</strong><ul>{refreshErrors.map((failure) => <li key={failure}>{failure}</li>)}</ul></div></div>}
    {portfolioPositions.length > 0 && <Card className="portfolio-summary"><div className="portfolio-total"><span>Invested value</span><strong>{formatQuote(portfolioTotals.invested, "INR")}</strong></div><div className="portfolio-total"><span>Current value</span><strong>{formatQuote(portfolioTotals.currentValue, "INR")}</strong></div><div className={`portfolio-total ${portfolioTotals.profitLoss >= 0 ? "positive" : "negative"}`}><span>Unrealized P/L</span><strong>{portfolioTotals.profitLoss >= 0 ? "+" : ""}{formatQuote(portfolioTotals.profitLoss, "INR")}</strong><small>{portfolioTotals.invested ? `${portfolioTotals.profitLoss >= 0 ? "+" : ""}${(portfolioTotals.profitLoss / portfolioTotals.invested * 100).toFixed(2)}%` : ""}</small></div><div className="portfolio-coverage">{portfolioPositions.length} of {stocks.length} positions with average price, quantity, and an INR quote</div></Card>}
    <div className="stock-admin-grid">
      <Card><div className="card-head"><div><h2 className="section-title">Broker names</h2><p className="section-description">Labels for grouping your saved stocks only; no broker account is connected.</p></div></div>
        <form className="broker-form" onSubmit={submitBroker}><Field label="Add a broker"><Input maxLength={60} placeholder="e.g. Zerodha" value={brokerName} onChange={(event) => setBrokerName(event.target.value)} /></Field><Button type="submit"><Plus size={14} />Add broker</Button></form>
        <div className="stock-broker-list">{brokers.length ? brokers.map((entry) => <div className="master-entry" key={entry}><div className="recent-info"><div className="recent-name">{entry}</div><div className="recent-meta">{stocks.filter((stock) => stock.broker === entry).length} tracked stocks</div></div><button className="icon-button" aria-label={`Delete ${entry}`} onClick={() => { if (window.confirm(`Remove "${entry}"? Tracked stocks will remain and be unassigned.`)) onDeleteBroker(entry); }}><Trash2 size={14} /></button></div>) : <p className="section-description">Add broker names to organize your watchlist.</p>}</div>
      </Card>
      <Card><div className="card-head"><div><h2 className="section-title">{editingId ? "Edit tracked stock" : "Add a stock"}</h2><p className="section-description">Use the exchange-listed code (without .NS or .BO).</p></div></div>
        <form className="form-grid stock-form" onSubmit={submitStock}><Field label="Stock code"><Input maxLength={30} placeholder="e.g. RELIANCE" value={symbol} onChange={(event) => setSymbol(event.target.value)} /></Field><Field label="Exchange"><Select value={exchange} onChange={(event) => setExchange(event.target.value as StockExchange)}><option value="NSE">NSE</option><option value="BSE">BSE</option></Select></Field><Field className="full" label="Display name"><Input maxLength={100} placeholder="e.g. Reliance Industries" value={name} onChange={(event) => setName(event.target.value)} /></Field><Field className="full" label="Broker label (optional)"><Select value={broker} onChange={(event) => setBroker(event.target.value)}><option value="">No broker</option>{brokers.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</Select></Field><Field label="Average buy price per share (INR)"><Input type="number" min="0.01" step="0.01" placeholder="Optional" value={averageBuyPrice} onChange={(event) => setAverageBuyPrice(event.target.value)} /></Field><Field label="Shares owned"><Input type="number" min="0" step="1" placeholder="Optional" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></Field><div className="full stock-form-actions"><Button type="submit"><Plus size={14} />{editingId ? "Save stock" : "Add stock"}</Button>{editingId && <Button type="button" variant="outline" onClick={resetStockForm}>Cancel</Button>}</div></form>
      </Card>
    </div>
    <Card className="stock-table-card"><div className="card-head"><div><h2 className="section-title">Tracked stocks</h2><p className="section-description">{stocks.length} {stocks.length === 1 ? "stock" : "stocks"} · Refresh all to add timestamped prices</p></div><Button variant="outline" onClick={() => refreshStocks()} disabled={busy || stocks.length === 0}><RefreshCw size={14} className={busy ? "spin" : ""} />Refresh all</Button></div>
      {stocks.length ? <div className="stock-list">{stocks.map((stock) => {
        const latest = latestQuotes.get(stock.id);
        const history = sortedHistory(stock.id);
        return <div className="stock-row" key={stock.id}>
          <div className="stock-summary">
            <div className="stock-identity"><span className="stock-code">{stock.symbol}</span><span className="stock-exchange">{stock.exchange}</span><span className="stock-name">{stock.name}</span></div>
            <div className="stock-current"><strong>{latest ? formatQuote(latest.price, latest.currency) : "—"}</strong><small>{latest ? `${new Date(latest.timestamp).toLocaleString()} · ${latest.marketState}` : "No price yet — refresh"}</small></div>
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
              <button className="icon-button" aria-label={`Delete ${stock.symbol}`} onClick={() => { if (window.confirm(`Delete ${stock.symbol} and its saved price history?`)) onDeleteStock(stock.id); }}><Trash2 size={14} /></button>
            </div>
          </div>
          <details className="stock-history">
            <summary>Price history ({history.length} snapshots)</summary>
            {history.length ? history.map((quote) => <div className="stock-history-row" key={quote.id}><span>{new Date(quote.timestamp).toLocaleString()}</span><strong>{formatQuote(quote.price, quote.currency)}</strong><span>{quote.marketState}</span>{quote.previousClose !== null && <small>Previous close {formatQuote(quote.previousClose, quote.currency)}</small>}</div>) : <p className="section-description">Refresh this stock to save its first price snapshot.</p>}
          </details>
        </div>;
      })}</div> : <EmptyState icon={<TrendingUp size={18} />} title="No stocks tracked yet" description="Add an NSE or BSE code above, then refresh it to save its current price." />}
    </Card>
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
      <Field label={isLoan ? "Start / disbursal date" : "Purchase / start date"}><Input type="date" value={asset.startDate} onChange={(event) => setAsset((current) => ({ ...current, startDate: event.target.value }))} /></Field>
      <Field label="Maturity / renewal date"><Input type="date" value={asset.maturityDate} onChange={(event) => setAsset((current) => ({ ...current, maturityDate: event.target.value }))} /></Field>
      <Field className="full" label="Property location / asset description"><Input maxLength={250} placeholder="Optional" value={asset.location} onChange={(event) => setAsset((current) => ({ ...current, location: event.target.value }))} /></Field>
      <Field className="full" label="Account / document link"><Input type="url" maxLength={2000} placeholder="Optional HTTPS link" value={asset.link} onChange={(event) => setAsset((current) => ({ ...current, link: event.target.value }))} /></Field>
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
    if (window.confirm(`Delete "${asset.name}" from the asset manager?`)) onDelete(asset);
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
        <div className="asset-card-head"><div className="asset-card-title"><div className="asset-icon"><Wallet size={17} /></div><div><h2>{asset.name}</h2><p>{asset.type}{asset.institution ? ` · ${asset.institution}` : ""}</p></div></div><div className="table-actions"><button className="icon-button" aria-label={`Edit ${asset.name}`} onClick={() => setEditor(asset)}><Pencil size={14} /></button><button className="icon-button" aria-label={`Delete ${asset.name}`} onClick={() => removeAsset(asset)}><Trash2 size={14} /></button></div></div>
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
        {asset.notes && <p className="personal-record-notes">{asset.notes}</p>}
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
      <Field label="Start date"><Input type="date" value={record.startDate} onChange={(event) => setRecord((current) => ({ ...current, startDate: event.target.value }))} /></Field>
      <Field label="End / completion date"><Input type="date" value={record.endDate} onChange={(event) => setRecord((current) => ({ ...current, endDate: event.target.value }))} /></Field>
      <Field label="Annual tuition"><Input type="number" min="0" step="0.01" placeholder="Optional; tuition only" value={annualFee} onChange={(event) => setAnnualFee(event.target.value)} /></Field>
      <Field label="Admission fee"><Input type="number" min="0" step="0.01" placeholder="Optional one-time charge" value={admissionFee} onChange={(event) => setAdmissionFee(event.target.value)} /></Field>
      <Field label="School van / transport fee (year total)"><Input type="number" min="0" step="0.01" placeholder="Optional" value={schoolVanFee} onChange={(event) => setSchoolVanFee(event.target.value)} /></Field>
      <Field label="Other fees"><Input type="number" min="0" step="0.01" placeholder="Optional" value={otherFee} onChange={(event) => setOtherFee(event.target.value)} /></Field>
      <Field label="Previously paid fee (legacy)"><Input type="number" min="0" step="0.01" placeholder="Optional; avoid duplicate entries" value={paidFee} onChange={(event) => setPaidFee(event.target.value)} /></Field>
      <Field label="School contact name"><Input maxLength={120} placeholder="Optional" value={record.contactName} onChange={(event) => setRecord((current) => ({ ...current, contactName: event.target.value }))} /></Field>
      <Field label="Contact details"><Input maxLength={160} placeholder="Optional phone or email" value={record.contact} onChange={(event) => setRecord((current) => ({ ...current, contact: event.target.value }))} /></Field>
      <Field className="full" label="Portal / document link"><Input type="url" maxLength={2000} placeholder="Optional HTTPS link" value={record.link} onChange={(event) => setRecord((current) => ({ ...current, link: event.target.value }))} /></Field>
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
    <Field label="Exam date"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
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
    <Field label="Payment date"><Input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
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
    if (window.confirm(`Remove ${subject.name} from ${record.academicYear || record.gradeCourse || "this academic year"}?`)) {
      onUpdate({ ...record, subjects: subjects.filter((entry) => entry.id !== subject.id) });
    }
  }

  function removeExam(exam: EducationExam) {
    if (window.confirm(`Delete the ${exam.name} result?`)) {
      onUpdate({ ...record, exams: exams.filter((entry) => entry.id !== exam.id) });
    }
  }

  function removePayment(payment: EducationPayment) {
    if (window.confirm(`Delete the ${payment.period} payment of ${formatAmount(payment.amount)}?`)) {
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
        <button className="icon-button" aria-label={`Copy ${record.studentName} education record`} title="Copy as a new record" onClick={onCopy}><Copy size={14} /></button>
        <button className="icon-button" aria-label={`Delete ${record.studentName} education record`} onClick={onDelete}><Trash2 size={14} /></button>
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
      {subjects.length ? <div className="education-entry-list">{subjects.map((subject) => <div className="education-entry" key={subject.id}><div><strong>{subject.name}</strong><span>{[subject.code, subject.credits !== null ? `${subject.credits} credits` : "", subject.notes].filter(Boolean).join(" · ")}</span></div><div className="table-actions"><button className="icon-button" aria-label={`Edit ${subject.name}`} onClick={() => setEditor({ kind: "subject", initial: subject })}><Pencil size={13} /></button><button className="icon-button" aria-label={`Remove ${subject.name}`} onClick={() => removeSubject(subject)}><Trash2 size={13} /></button></div></div>)}</div> : <p className="education-empty">Add subjects for this class, term, or course.</p>}
    </section>
    <section className="education-section">
      <div className="education-section-head"><div><h3><ClipboardList size={14} />Exams & results</h3><p>{exams.length} recorded</p></div><Button size="sm" variant="outline" onClick={() => setEditor({ kind: "exam", initial: null })}><Plus size={12} />Add exam</Button></div>
      {exams.length ? <div className="education-entry-list">{[...exams].sort((a, b) => b.date.localeCompare(a.date)).map((exam) => <div className="education-entry" key={exam.id}><div><strong>{exam.name}</strong><span>{[exam.assessmentType, exam.subject, exam.date ? dateLabel(exam.date) : ""].filter(Boolean).join(" · ")}</span><small>{exam.marksObtained !== null && exam.maximumMarks !== null ? `${exam.marksObtained} / ${exam.maximumMarks}${exam.maximumMarks ? ` (${(exam.marksObtained / exam.maximumMarks * 100).toFixed(1)}%)` : ""}` : ""}{exam.grade ? `${exam.marksObtained !== null ? " · " : ""}Grade / GPA: ${exam.grade}` : ""}{exam.notes ? `${exam.marksObtained !== null || exam.grade ? " · " : ""}${exam.notes}` : ""}</small></div><div className="table-actions"><button className="icon-button" aria-label={`Edit ${exam.name}`} onClick={() => setEditor({ kind: "exam", initial: exam })}><Pencil size={13} /></button><button className="icon-button" aria-label={`Delete ${exam.name}`} onClick={() => removeExam(exam)}><Trash2 size={13} /></button></div></div>)}</div> : <p className="education-empty">Track school assessments or college exams, grades, GPA, and marks.</p>}
    </section>
    <section className="education-section">
      <div className="education-section-head"><div><h3><Wallet size={14} />Fee payments</h3><p>{payments.length} logged · {formatAmount(loggedPaid)} paid across all fee types</p></div><Button size="sm" variant="outline" onClick={() => setEditor({ kind: "payment", initial: null })}><Plus size={12} />Record payment</Button></div>
      {payments.length ? <div className="education-entry-list">{[...payments].sort((a, b) => b.date.localeCompare(a.date)).map((payment) => <div className="education-entry" key={payment.id}><div><strong>{payment.feeType ?? inferPaymentFeeType(payment.period)} · {payment.period} · {formatAmount(payment.amount)}</strong><span>{dateLabel(payment.date)} · {payment.method}{payment.reference ? ` · Ref: ${payment.reference}` : ""}</span>{payment.notes && <small>{payment.notes}</small>}</div><div className="table-actions"><button className="icon-button" aria-label={`Edit ${payment.period} payment`} onClick={() => setEditor({ kind: "payment", initial: payment })}><Pencil size={13} /></button><button className="icon-button" aria-label={`Delete ${payment.period} payment`} onClick={() => removePayment(payment)}><Trash2 size={13} /></button></div></div>)}</div> : <p className="education-empty">Record tuition installments, admission charges, school van fees, or other payments.</p>}
    </section>
    {record.link && <a className="personal-document-link" href={record.link} target="_blank" rel="noopener noreferrer">Open portal / document link</a>}
    {record.notes && <p className="personal-record-notes">{record.notes}</p>}
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
    if (window.confirm(`Delete the ${record.academicYear || record.level} record for ${record.studentName} at ${record.institution}?`)) onDelete(record);
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
        subjects: (record.subjects ?? []).map((subject) => ({ ...subject, id: createId() })),
        exams: (record.exams ?? []).map((exam) => ({ ...exam, id: createId() })),
        payments: (record.payments ?? []).map((payment) => ({ ...payment, id: createId() })),
      },
    });
  }

  return <>
    <PageHeading eyebrow="Growing and learning" title="School & college records" subtitle="Select a student to review their academic years, subjects, results, and term payments." action={<Button onClick={() => setEditor({ record: null, mode: "new" })}><Plus size={15} /> Add record</Button>} />
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
      <Field label="Start date"><Input type="date" value={record.startedDate} onChange={(event) => setRecord((current) => ({ ...current, startedDate: event.target.value }))} /></Field>
      <Field label="Completion date"><Input type="date" value={record.completedDate} onChange={(event) => setRecord((current) => ({ ...current, completedDate: event.target.value }))} /></Field>
      <Field className="full" label="Course / learning resource link"><Input type="url" maxLength={2000} placeholder="Optional HTTPS link" value={record.resourceLink} onChange={(event) => setRecord((current) => ({ ...current, resourceLink: event.target.value }))} /></Field>
      <Field className="full" label="AI tool / resource link"><Input type="url" maxLength={2000} placeholder="Optional HTTPS link to an AI tutor, tool, or learning resource" value={record.aiLink} onChange={(event) => setRecord((current) => ({ ...current, aiLink: event.target.value }))} /></Field>
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
    if (window.confirm(`Delete "${record.title}" from your learning records?`)) onDelete(record);
  }

  return <>
    <PageHeading eyebrow="Keep growing" title="Learning" subtitle="Capture what you are learning, track your progress from beginner to advanced, and keep useful resources close." action={<Button onClick={() => setEditor(null)}><Plus size={15} /> Add learning</Button>} />
    <div className="alert"><BookOpen size={15} style={{ flex: "none", marginTop: 1 }} /><span>Save skills, courses, progress, notes, and learning links. AI resource links are optional; add a trusted AI tutor or tool that supports your learning.</span></div>
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search learning records" placeholder="Search title, topic, source, notes..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select aria-label="Filter learning level" style={{ width: 165 }} value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}><option>All levels</option>{(["Beginner", "Basic", "Intermediate", "Advanced", "Expert"] as const).map((level) => <option key={level}>{level}</option>)}</Select><Select aria-label="Filter learning status" style={{ width: 165 }} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Not started</option><option>In progress</option><option>Completed</option></Select><Badge>{visible.length} {visible.length === 1 ? "topic" : "topics"}</Badge></div>
    <div className="learning-list">{visible.map((record) => <Card className="learning-card" key={record.id}>
      <div className="learning-card-head"><div className="learning-icon"><BookOpen size={17} /></div><div className="learning-card-title"><h2>{record.title}</h2><p>{[record.topic, record.provider].filter(Boolean).join(" · ") || "Personal learning"}</p></div><div className="learning-card-actions"><Badge tone={record.status === "Completed" ? "green" : "neutral"}>{record.status}</Badge><button className="icon-button" aria-label={`Edit ${record.title}`} onClick={() => setEditor(record)}><Pencil size={14} /></button><button className="icon-button" aria-label={`Delete ${record.title}`} onClick={() => deleteRecord(record)}><Trash2 size={14} /></button></div></div>
      <div className="learning-card-meta"><Badge>{record.level}</Badge>{record.startedDate && <span>Started {dateLabel(record.startedDate)}</span>}{record.completedDate && <span>Completed {dateLabel(record.completedDate)}</span>}</div>
      {(record.resourceLink || record.aiLink) && <div className="learning-links">{record.resourceLink && <a className="personal-document-link" href={record.resourceLink} target="_blank" rel="noopener noreferrer">Open learning resource</a>}{record.aiLink && <a className="personal-document-link" href={record.aiLink} target="_blank" rel="noopener noreferrer">Open AI resource</a>}</div>}
      {record.notes && <p className="learning-notes">{record.notes}</p>}
    </Card>)}</div>
    {!visible.length && <Card><EmptyState icon={<BookOpen size={18} />} title={records.length ? "No matching learning records" : "No learning records yet"} description={records.length ? "Try another search or filter." : "Add a skill or course you are learning to start your progress log."} /></Card>}
    {editor !== undefined && <LearningRecordModal key={editor?.id ?? "new-learning-record"} initial={editor} onClose={() => setEditor(undefined)} onSave={(record) => { onSave(record, editor?.id); setEditor(undefined); }} />}
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
    <Field label="Travel date"><Input autoFocus type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></Field>
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
    <Field label="Date"><Input autoFocus type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></Field>
    <Field label="Type"><Select value={type} onChange={(event) => setType(event.target.value as VehicleMaintenanceType)}><option value="Service">Service</option><option value="Repair">Repair</option></Select></Field>
    <Field className="full" label="Work performed"><Input maxLength={160} required placeholder="e.g. Oil change, brake replacement" value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
    <Field label="Odometer (km)"><Input type="number" min="0" step="any" placeholder="Optional" value={odometer} onChange={(event) => setOdometer(event.target.value)} /></Field>
    <Field label="Cost"><Input type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} /></Field>
    <Field label="Service provider"><Input maxLength={120} placeholder="Garage or service center" value={provider} onChange={(event) => setProvider(event.target.value)} /></Field>
    <Field label="Next due date"><Input type="date" value={nextDueDate} onChange={(event) => setNextDueDate(event.target.value)} /></Field>
    <Field label="Next due odometer (km)"><Input type="number" min="0" step="any" placeholder="Optional" value={nextDueOdometer} onChange={(event) => setNextDueOdometer(event.target.value)} /></Field>
    <Field className="full" label="Notes"><Input maxLength={1000} placeholder="Parts, warranty, or other details" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
  </div>{error && <div className="alert alert-error" style={{ marginTop: 13 }}>{error}</div>}<div className="modal-actions"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? "Save record" : "Add record"}</Button></div></form></Modal>;
}

function VehicleManagement({ vehicles, journeys, maintenance, onSaveVehicle, onDeleteVehicle, onSaveJourney, onDeleteJourney, onSaveMaintenance, onDeleteMaintenance }: {
  vehicles: Vehicle[];
  journeys: VehicleJourney[];
  maintenance: VehicleMaintenance[];
  onSaveVehicle: (vehicle: Omit<Vehicle, "id">, id?: string) => void;
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
            <div className="table-actions"><button className="icon-button" aria-label={`Edit ${vehicle.name}`} onClick={() => setVehicleEditor({ initial: vehicle })}><Pencil size={14} /></button><button className="icon-button" aria-label={`Delete ${vehicle.name}`} onClick={() => onDeleteVehicle(vehicle)}><Trash2 size={14} /></button></div></div>
          {vehicle.notes && <p className="vehicle-notes">{vehicle.notes}</p>}
          <div className="vehicle-stats"><div><span>Travel logs</span><strong>{vehicleJourneys.length}</strong></div><div><span>Recorded distance</span><strong>{recordedDistance.toLocaleString()} km</strong></div><div><span>Travel costs</span><strong>{formatCurrency(travelCost)}</strong></div><div><span>Service & repair cost</span><strong>{formatCurrency(maintenanceCost)}</strong></div></div>
          <section className="vehicle-section"><div className="vehicle-section-head"><div><h3><span><MapPin size={14} /></span>Travel log</h3><p>{vehicleJourneys.length} recorded {vehicleJourneys.length === 1 ? "journey" : "journeys"}</p></div><Button variant="outline" onClick={() => setJourneyEditor({ vehicle, initial: null })}><Plus size={13} /> Log travel</Button></div>
            {vehicleJourneys.length ? <div className="vehicle-record-list">{vehicleJourneys.map((journey) => {
              const distance = journey.odometerStart !== null && journey.odometerEnd !== null ? journey.odometerEnd - journey.odometerStart : null;
              return <div className="vehicle-record" key={journey.id}><div className="vehicle-record-main"><strong>{journey.startLocation || "Start"} → {journey.endLocation || "Destination"}</strong><span>{dateLabel(journey.date)}{journey.purpose ? ` · ${journey.purpose}` : ""}</span><small>{distance === null ? "Distance not recorded" : `${distance.toLocaleString()} km`}{journey.cost ? ` · ${formatCurrency(journey.cost)}` : ""}{journey.notes ? ` · ${journey.notes}` : ""}</small></div><div className="table-actions"><button className="icon-button" aria-label="Edit travel log" onClick={() => setJourneyEditor({ vehicle, initial: journey })}><Pencil size={13} /></button><button className="icon-button" aria-label="Delete travel log" onClick={() => onDeleteJourney(journey)}><Trash2 size={13} /></button></div></div>;
            })}</div> : <p className="vehicle-empty">No travel logs yet.</p>}
          </section>
          <section className="vehicle-section"><div className="vehicle-section-head"><div><h3><span><Wrench size={14} /></span>Services & repairs</h3><p>{vehicleMaintenance.length} records · {formatCurrency(maintenanceCost)} total</p></div><Button variant="outline" onClick={() => setMaintenanceEditor({ vehicle, initial: null })}><Plus size={13} /> Add record</Button></div>
            {vehicleMaintenance.length ? <div className="vehicle-record-list">{vehicleMaintenance.map((entry) => <div className="vehicle-record" key={entry.id}><div className="vehicle-record-main"><strong>{entry.description} <Badge tone={entry.type === "Service" ? "green" : "amber"}>{entry.type}</Badge></strong><span>{dateLabel(entry.date)}{entry.odometer !== null ? ` · ${entry.odometer.toLocaleString()} km` : ""}{entry.provider ? ` · ${entry.provider}` : ""} · {formatCurrency(entry.cost)}</span><small>{[entry.nextDueDate ? `Next due ${dateLabel(entry.nextDueDate)}` : "", entry.nextDueOdometer !== null ? `${entry.nextDueOdometer.toLocaleString()} km` : "", entry.notes].filter(Boolean).join(" · ") || "No follow-up details"}</small></div><div className="table-actions"><button className="icon-button" aria-label="Edit service or repair record" onClick={() => setMaintenanceEditor({ vehicle, initial: entry })}><Pencil size={13} /></button><button className="icon-button" aria-label="Delete service or repair record" onClick={() => onDeleteMaintenance(entry)}><Trash2 size={13} /></button></div></div>)}</div> : <p className="vehicle-empty">No service or repair records yet.</p>}
          </section>
        </Card>;
      })}</div>}
    {vehicleEditor && <VehicleModal key={vehicleEditor.initial?.id ?? "new-vehicle"} initial={vehicleEditor.initial} onClose={() => setVehicleEditor(null)} onSave={(vehicle) => { onSaveVehicle(vehicle, vehicleEditor.initial?.id); setVehicleEditor(null); }} />}
    {journeyEditor && <VehicleJourneyModal key={journeyEditor.initial?.id ?? `new-journey-${journeyEditor.vehicle.id}`} vehicle={journeyEditor.vehicle} initial={journeyEditor.initial} onClose={() => setJourneyEditor(null)} onSave={(journey) => { onSaveJourney(journey, journeyEditor.vehicle.id, journeyEditor.initial?.id); setJourneyEditor(null); }} />}
    {maintenanceEditor && <VehicleMaintenanceModal key={maintenanceEditor.initial?.id ?? `new-maintenance-${maintenanceEditor.vehicle.id}`} vehicle={maintenanceEditor.vehicle} initial={maintenanceEditor.initial} onClose={() => setMaintenanceEditor(null)} onSave={(entry) => { onSaveMaintenance(entry, maintenanceEditor.vehicle.id, maintenanceEditor.initial?.id); setMaintenanceEditor(null); }} />}
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
    <Field label="Issue date"><Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></Field>
    <Field label="Expiry / renewal date"><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field>
    <Field label="Remind me"><Select value={reminderDays} onChange={(event) => setReminderDays(Number(event.target.value))}><option value={0}>On the due date</option><option value={7}>7 days before</option><option value={30}>30 days before</option><option value={60}>60 days before</option><option value={90}>90 days before</option></Select></Field>
    <Field className="full" label="Shared document link"><Input type="url" maxLength={2000} placeholder="https://... (use a private link with appropriate sharing access)" value={documentLink} onChange={(event) => setDocumentLink(event.target.value)} /></Field>
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
    <div className="alert"><FileText size={15} style={{ flex: "none", marginTop: 1 }} /><span>These details are stored as readable text in the private GitHub repository. People with repository access can read them, and prior values remain in Git history after edits or deletion. Add a link to a securely shared document instead of uploading scans here; only use links with access controls you trust.</span></div>
    {(expiredCount > 0 || dueSoonCount > 0) && <div className="personal-due-summary" role="status"><Bell size={16} /><span>{expiredCount > 0 ? `${expiredCount} expired` : ""}{expiredCount > 0 && dueSoonCount > 0 ? " · " : ""}{dueSoonCount > 0 ? `${dueSoonCount} due soon` : ""}. Review the dates below.</span></div>}
    <div className="toolbar"><div className="search-wrap"><Search size={15} /><Input aria-label="Search personal records" placeholder="Search title, holder, number..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select aria-label="Filter personal records" style={{ width: 165 }} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All records</option><option>Identity</option><option>Insurance</option><option>License</option><option>Certificate</option><option>Other</option></Select><Badge>{visibleRecords.length} {visibleRecords.length === 1 ? "record" : "records"}</Badge></div>
    <div className="personal-record-list">{visibleRecords.map((record) => {
      const due = dueLabel(record);
      return <Card className="personal-record-card" key={record.id}>
        <div className="personal-record-head"><div className="personal-record-title"><div className="personal-record-icon"><FileText size={17} /></div><div><h2>{record.title}</h2><p>{record.type}{record.holder ? ` · ${record.holder}` : ""}{record.issuer ? ` · ${record.issuer}` : ""}</p></div></div><div className="personal-record-actions"><Badge tone={due.tone}>{due.text}</Badge><button className="icon-button" aria-label={`Edit ${record.title}`} onClick={() => setEditor({ initial: record })}><Pencil size={14} /></button><button className="icon-button" aria-label={`Delete ${record.title}`} onClick={() => onDelete(record)}><Trash2 size={14} /></button></div></div>
        <div className="personal-record-details">
          {record.recordNumber && <div><span>Document / policy number</span><strong>{record.recordNumber}</strong></div>}
          {record.issueDate && <div><span>Issue date</span><strong>{dateLabel(record.issueDate)}</strong></div>}
          {record.dueDate && <div><span>Expiry / renewal</span><strong>{dateLabel(record.dueDate)}</strong></div>}
          {record.additionalFields.map((field, index) => field.label || field.value ? <div key={index}><span>{field.label || "Additional detail"}</span><strong>{field.value || "—"}</strong></div> : null)}
        </div>
        {record.notes && <p className="personal-record-notes">{record.notes}</p>}
        {record.documentLink && <a className="personal-document-link" href={record.documentLink} target="_blank" rel="noopener noreferrer"><FileText size={14} /> Open shared document link</a>}
      </Card>;
    })}</div>
    {!visibleRecords.length && <Card><EmptyState icon={<FileText size={18} />} title={records.length ? "No matching records" : "No personal records yet"} description={records.length ? "Try another search or record type." : "Add a record for an ID, insurance policy, license or other frequently needed information."} /></Card>}
    {editor && <PersonalRecordModal key={editor.initial?.id ?? "new-personal-record"} initial={editor.initial} onClose={() => setEditor(null)} onSave={(record) => { onSave(record, editor.initial?.id); setEditor(null); }} />}
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
        <Field className="full" label="Sign-in page"><Input type="url" maxLength={2000} autoComplete="url" placeholder="https://accounts.example.com/" value={record.website} onChange={(event) => setRecord((current) => ({ ...current, website: event.target.value }))} /></Field>
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
      <div className="credential-card-head"><div className="credential-card-title"><div className="credential-icon"><KeyRound size={17} /></div><div><h2>{record.provider}</h2><p>{record.category}{record.username ? ` · ${record.username}` : ""}</p></div></div><div className="personal-record-actions"><button className="icon-button" aria-label={`Edit ${record.provider}`} onClick={() => setEditor(record)}><Pencil size={14} /></button><button className="icon-button" aria-label={`Delete ${record.provider}`} onClick={() => { if (window.confirm(`Delete the ${record.provider} account from the vault?`)) void saveRecords(unlocked.records.filter((entry) => entry.id !== record.id)).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not update the vault.")); }}><Trash2 size={14} /></button></div></div>
      {record.website && <a className="personal-document-link" href={record.website} target="_blank" rel="noopener noreferrer">{record.website}</a>}
      {record.password && <div className="credential-password-row"><span>Password</span><code>{visiblePasswords.has(record.id) ? record.password : "••••••••••••"}</code><button className="icon-button" type="button" aria-label={visiblePasswords.has(record.id) ? `Hide ${record.provider} password` : `Show ${record.provider} password`} onClick={() => setVisiblePasswords((visible) => { const next = new Set(visible); if (next.has(record.id)) next.delete(record.id); else next.add(record.id); return next; })}>{visiblePasswords.has(record.id) ? <EyeOff size={14} /> : <Eye size={14} />}</button></div>}
      {record.recoveryInfo && <p className="credential-secondary"><strong>Recovery:</strong> {record.recoveryInfo}</p>}
      {record.additionalFields.map((field, index) => field.label || field.value ? <p className="credential-secondary" key={index}><strong>{field.label || "Additional detail"}:</strong> {field.value}</p> : null)}
      {record.tags.length > 0 && <div className="credential-tags">{record.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div>}
      {record.notes && <p className="personal-record-notes">{record.notes}</p>}
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

function DataManagement({ data, currency, darkMode, fontSize, fontStyle, accentColor, darkTheme, visualTheme, syncStatus, syncMessage, refreshing, onCurrencyChange, onToggleDarkMode, onFontSizeChange, onFontStyleChange, onAccentChange, onDarkThemeChange, onVisualThemeChange, onImport, onClear, onExport, onSaveNow, onRefresh, onSignOut }: { data: TrackerData; currency: Currency; darkMode: boolean; fontSize: FontSize; fontStyle: FontStyle; accentColor: AccentColor; darkTheme: DarkTheme; visualTheme: VisualTheme; syncStatus: "saved" | "saving" | "error"; syncMessage: string; refreshing: boolean; onCurrencyChange: (currency: Currency) => void; onToggleDarkMode: () => void; onFontSizeChange: (size: FontSize) => void; onFontStyleChange: (style: FontStyle) => void; onAccentChange: (color: AccentColor) => void; onDarkThemeChange: (theme: DarkTheme) => void; onVisualThemeChange: (theme: VisualTheme) => void; onImport: (file: File) => void; onClear: () => void; onExport: () => void; onSaveNow: () => void; onRefresh: () => void; onSignOut: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <><PageHeading eyebrow="Your data, your way" title="Data management" subtitle="Your records sync through the private GitHub repository and can be backed up or moved whenever you like." />
    <div className="alert"><Sparkles size={15} style={{ flex: "none", marginTop: 1 }} /><span>Daybook records sync to the private GitHub repository. Account credentials are encrypted separately; other records remain readable to repository collaborators and prior values remain in Git history. Sign in with your Daybook access password on each device. Display preferences stay in this browser.</span></div>
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
    <div className="settings-grid"><Card className="settings-card"><div className="settings-icon"><Settings2 size={17} /></div><h3>Appearance & currency</h3><p>Choose your font style and size, accent color, dark background theme and display currency. Currency formatting does not convert amounts.</p><Field label="Currency"><Select value={currency} onChange={(event) => onCurrencyChange(event.target.value as Currency)}>{CURRENCIES.map((option) => <option key={option} value={option}>{option}</option>)}</Select></Field><Field label="Font style"><Select value={fontStyle} onChange={(event) => onFontStyleChange(event.target.value as FontStyle)}><option value="modern">Modern sans</option><option value="editorial">Editorial serif</option><option value="rounded">Friendly rounded</option></Select></Field><Field label="Font size"><Select value={fontSize} onChange={(event) => onFontSizeChange(event.target.value as FontSize)}><option value="small">Small</option><option value="medium">Default</option><option value="large">Large</option></Select></Field><Field label="Accent color"><Select value={accentColor} onChange={(event) => onAccentChange(event.target.value as AccentColor)}>{ACCENT_COLORS.map((option) => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}</Select></Field><Field label="Dark mode background"><Select value={darkTheme} onChange={(event) => onDarkThemeChange(event.target.value as DarkTheme)}>{DARK_THEMES.map((option) => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}</Select></Field><Button className="preference-toggle" variant="outline" onClick={onToggleDarkMode}>{darkMode ? <Sun size={14} /> : <Moon size={14} />}{darkMode ? "Switch to light mode" : "Switch to dark mode"}</Button></Card>
      <Card className="settings-card"><div className="settings-icon"><Database size={17} /></div><h3>GitHub sync</h3><p>Changes save automatically. Other devices check for updates when opened and every two minutes while the app is active.</p><p role="status">{syncStatus === "saving" ? "Saving shared data…" : syncStatus === "error" ? syncMessage || "Not synced. Check your connection." : syncMessage || "All changes saved."}</p><div className="connector-actions"><Button variant="outline" onClick={onSaveNow} disabled={syncStatus === "saving"}><Download size={14} />Save now</Button><Button variant="outline" onClick={onRefresh} disabled={syncStatus === "saving" || refreshing}><RefreshCw size={14} className={refreshing ? "spin" : ""} />{refreshing ? "Refreshing…" : "Refresh"}</Button></div><Button variant="outline" onClick={onSignOut}>Sign out</Button></Card>
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
  return value === "small" || value === "medium" || value === "large";
}
function isFontStyle(value: unknown): value is FontStyle {
  return value === "modern" || value === "editorial" || value === "rounded";
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
    learningRecords: [],
    personalRecords: [],
    assets: [],
    educationRecords: [],
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
  const [page, setPage] = useState<Page>("Dashboard");
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
  const [accentColor, setAccentColor] = useState<AccentColor>("green");
  const [darkTheme, setDarkTheme] = useState<DarkTheme>("forest");
  const [visualTheme, setVisualTheme] = useState<VisualTheme>("sage");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [modal, setModal] = useState<"add" | "trip" | null>(null);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const latestDataRef = useRef(data);
  const revisionRef = useRef(revision);
  const authenticatedRef = useRef(authenticated);
  const syncStatusRef = useRef(syncStatus);
  const skipNextSave = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveTimer = useRef<number | null>(null);
  const refreshInProgress = useRef(false);

  latestDataRef.current = data;
  revisionRef.current = revision;
  authenticatedRef.current = authenticated;
  syncStatusRef.current = syncStatus;

  function queueSave(snapshot: TrackerData) {
    setSyncStatus("saving");
    setSyncMessage("");
    const save = saveQueue.current.catch(() => undefined).then(async () => {
      if (!authenticatedRef.current) throw new Error("Sign in to Daybook before saving.");
      const nextRevision = await saveSharedData(snapshot, revisionRef.current);
      revisionRef.current = nextRevision;
      setRevision(nextRevision);
      if (latestDataRef.current === snapshot) {
        setSyncStatus("saved");
        setSyncMessage("All changes saved to Supabase.");
      }
    }).catch((caught: unknown) => {
      const message = caught instanceof Error ? caught.message : "Your changes could not be saved.";
      setSyncStatus("error");
      setSyncMessage(message);
      setError(message);
    });
    saveQueue.current = save;
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
          ("accentColor" in parsed && !isAccentColor(parsed.accentColor)) ||
          ("darkTheme" in parsed && !isDarkTheme(parsed.darkTheme)) ||
          ("visualTheme" in parsed && !isVisualTheme(parsed.visualTheme))) {
          throw new Error("Saved preferences are invalid. Default appearance and currency settings will be used.");
        }
        setCurrency(parsed.currency);
        setDarkMode(parsed.darkMode);
        if ("fontSize" in parsed && isFontSize(parsed.fontSize)) setFontSize(parsed.fontSize);
        if ("fontStyle" in parsed && isFontStyle(parsed.fontStyle)) setFontStyle(parsed.fontStyle);
        if ("accentColor" in parsed && isAccentColor(parsed.accentColor)) setAccentColor(parsed.accentColor);
        if ("darkTheme" in parsed && isDarkTheme(parsed.darkTheme)) setDarkTheme(parsed.darkTheme);
        if ("visualTheme" in parsed && isVisualTheme(parsed.visualTheme)) setVisualTheme(parsed.visualTheme);
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
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ currency, darkMode, fontSize, fontStyle, accentColor, darkTheme, visualTheme }));
    } catch {
      setError("Your preferences could not be saved in this browser.");
    }
  }, [currency, darkMode, fontSize, fontStyle, accentColor, darkTheme, visualTheme, preferencesReady]);

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
    if (!window.confirm(`Delete "${item.name}" from your shopping list? Purchase history will be kept.`)) return;
    update((previous) => ({ ...previous, items: previous.items.filter((entry) => entry.id !== item.id) }));
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
  function saveReminder(reminder: Omit<Reminder, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      reminderCategories: previous.reminderCategories ?? [],
      reminders: id
        ? (previous.reminders ?? []).map((entry) => entry.id === id ? { ...entry, ...reminder } : entry)
        : [{ ...reminder, id: createId() }, ...(previous.reminders ?? [])],
    }));
  }
  function toggleReminder(reminder: Reminder) {
    update((previous) => ({ ...previous, reminders: (previous.reminders ?? []).map((entry) => entry.id === reminder.id ? { ...entry, completed: !entry.completed } : entry) }));
  }
  function addStore(store: Omit<Store, "id">) {
    update((previous) => ({ ...previous, stores: [...(previous.stores ?? []), { ...store, id: createId() }] }));
  }
  function addProduct(product: Omit<Product, "id">) {
    update((previous) => ({ ...previous, products: [...(previous.products ?? []), { ...product, id: createId() }] }));
  }
  function addReminderCategory(category: string) {
    update((previous) => ({ ...previous, reminderCategories: [...(previous.reminderCategories ?? []), category] }));
  }
  function deleteReminderCategory(category: string) {
    update((previous) => ({
      ...previous,
      reminderCategories: (previous.reminderCategories ?? []).filter((entry) => entry !== category),
    }));
  }
  function addBroker(name: string) {
    update((previous) => ({ ...previous, brokers: [...(previous.brokers ?? []), name] }));
  }
  function deleteBroker(name: string) {
    update((previous) => ({
      ...previous,
      brokers: (previous.brokers ?? []).filter((entry) => entry !== name),
      stocks: (previous.stocks ?? []).map((stock) => stock.broker === name ? { ...stock, broker: "" } : stock),
    }));
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
    update((previous) => ({
      ...previous,
      stocks: (previous.stocks ?? []).filter((stock) => stock.id !== id),
      stockQuotes: (previous.stockQuotes ?? []).filter((quote) => quote.stockId !== id),
    }));
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
      ...previous,
      assets: (previous.assets ?? []).filter((entry) => entry.id !== asset.id),
    }));
  }
  function saveEducationRecord(record: Omit<EducationRecord, "id">, id?: string) {
    update((previous) => ({
      ...previous,
      educationRecords: id
        ? (previous.educationRecords ?? []).map((entry) => entry.id === id ? { ...record, id } : entry)
        : [{ ...record, id: createId() }, ...(previous.educationRecords ?? [])],
    }));
  }
  function deleteEducationRecord(record: EducationRecord) {
    update((previous) => ({
      ...previous,
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
    if (!window.confirm(`Delete "${record.title}" from your learning records? This cannot be undone.`)) return;
    update((previous) => ({
      ...previous,
      learningRecords: (previous.learningRecords ?? []).filter((entry) => entry.id !== record.id),
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
  function deleteVehicle(vehicle: Vehicle) {
    if (!window.confirm(`Delete ${vehicle.name} and all its travel, service and repair records? This cannot be undone.`)) return;
    update((previous) => ({
      ...previous,
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
    if (!window.confirm("Delete this travel log?")) return;
    update((previous) => ({
      ...previous,
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
    if (!window.confirm(`Delete this ${entry.type.toLowerCase()} record?`)) return;
    update((previous) => ({
      ...previous,
      vehicleMaintenance: (previous.vehicleMaintenance ?? []).filter((record) => record.id !== entry.id),
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
    if (!window.confirm(`Delete "${record.title}" from your personal records? This cannot be undone.`)) return;
    update((previous) => ({
      ...previous,
      personalRecords: (previous.personalRecords ?? []).filter((entry) => entry.id !== record.id),
    }));
  }
  async function importBackup(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!validateData(parsed)) throw new Error("This file is not a valid Daybook backup (version 1). Your current data has not been changed.");
      setData(normalizeTrackerData(parsed));
      setError("");
      setNotice("Backup loaded. Saving it to the private GitHub repository…");
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
    if (!window.confirm("Clear all shopping, stock, asset, learning, education, vehicle, personal document and encrypted credential data from shared storage? This cannot be undone.")) return;
    setData(emptyTrackerData());
    setError("");
    setNotice("Data cleared. Saving the empty data file to shared storage…");
  }
  function changePage(next: Page) {
    setPage(next);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (authLoading) return <div className="loading"><div><div className="loading-mark"><ShoppingBasket size={17} /></div>Checking your Daybook session...</div></div>;
  if (!authenticated) return <div className={`app-shell font-${fontSize} font-style-${fontStyle} accent-${accentColor}`}><main className="main-area"><div className="main-content">{authTestMode ? <><PageHeading eyebrow="Temporary verification" title="Test access password" subtitle="Check the configured Daybook password without opening or changing shared data." /><Card className="connector-card"><form className="connector-form" onSubmit={(event) => void handleTestAccessPassword(event)}><Field className="full" label="Daybook access password"><Input type="password" autoComplete="current-password" maxLength={256} required value={authTestPassword} onChange={(event) => { setAuthTestPassword(event.target.value); setAuthTestPassed(false); setAuthTestError(""); }} /></Field>{authTestError && <div className="alert alert-error full" role="alert">{authTestError}</div>}{authTestPassed && <div className="alert alert-success full" role="status">Password matches the value configured in Vercel. No session was created and no Daybook data was accessed.</div>}<div className="full"><Button type="submit" disabled={authTestLoading}>{authTestLoading ? "Checking..." : "Validate password"}</Button></div></form><p className="section-description" style={{ marginTop: 16 }}>This checks the server-side DATA_ACCESS_PASSWORD setting. It does not create a sign-in session or make a database request.</p><Button variant="outline" style={{ marginTop: 14 }} onClick={() => { setAuthTestMode(false); setAuthTestPassed(false); setAuthTestError(""); setAuthTestPassword(""); }}>Back to sign in</Button></Card></> : <><PageHeading eyebrow="Your data, wherever you go" title="Open your Daybook" subtitle="Enter your Daybook access password to securely load your shared records." /><Card className="connector-card"><form className="connector-form" onSubmit={(event) => void handleSignIn(event)}><Field className="full" label="Daybook access password"><Input type="password" autoComplete="current-password" maxLength={256} required value={accessPassword} onChange={(event) => setAccessPassword(event.target.value)} /></Field>{error && <div className="alert alert-error full" role="alert">{error}</div>}<div className="full"><Button type="submit" disabled={authLoading}>{authLoading ? "Signing in..." : "Open Daybook"}</Button></div></form><p className="section-description" style={{ marginTop: 16 }}>This password is configured by the site owner in Vercel. No Google account or external sign-in is needed.</p><Button variant="outline" style={{ marginTop: 14 }} onClick={() => { setAuthTestMode(true); setError(""); }}>Test access password configuration</Button></Card></>}</div></main></div>;
  if (dataLoading && !data) return <div className="loading"><div><div className="loading-mark"><ShoppingBasket size={17} /></div>Loading your shared Daybook data...</div></div>;
  if (setupRequired && data) return <div className={`app-shell font-${fontSize} font-style-${fontStyle} accent-${accentColor}`}><main className="main-area"><div className="main-content"><PageHeading eyebrow="One-time setup" title="Choose your starting data" subtitle="No shared data file exists yet. The initial data structure is versioned in the Git repository." />{error && <div className="alert alert-error" role="alert">{error}</div>}<Card className="connector-card"><h2 className="section-title">Move existing data from this device</h2><p className="section-description">Copy this browser’s older Daybook records to the shared GitHub data file. The old browser copy will not be deleted. If there are no older records on this device, the Git seed file will be used.</p><Button onClick={() => void initializeSharedData(true)} disabled={dataLoading}><Upload size={14} />{dataLoading ? "Saving shared data..." : "Use data from this device"}</Button></Card><Card className="connector-card" style={{ marginTop: 16 }}><h2 className="section-title">Start with the Git seed file</h2><p className="section-description">Use the blank Daybook data file tracked in Git, then share it with your other devices.</p><Button variant="outline" onClick={() => void initializeSharedData(false)} disabled={dataLoading}><Plus size={14} />Use Git seed data</Button></Card></div></main></div>;
  if (!data) return <div className="loading"><div><div className="loading-mark"><ShoppingBasket size={17} /></div>Getting your daybook ready...</div></div>;
  const pageContent: Record<Page, ReactNode> = {
    Dashboard: <Dashboard data={data} onPage={changePage} />,
    "Shopping list": <ShoppingList data={data} onToggle={togglePurchased} onAdd={() => setModal("add")} onEdit={setEditing} onDelete={deleteItem} />,
    "Shopping trips": <ShoppingTrips data={data} onAdd={() => setModal("trip")} />,
    "Purchase history": <PurchaseHistory data={data} />,
    "Price history": <PriceHistory data={data} />,
    Reports: <Reports data={data} />,
    "Notes & reminders": <ReminderPage reminders={data.reminders ?? []} categories={data.reminderCategories ?? []} onSave={saveReminder} onDelete={(id) => update((previous) => ({ ...previous, reminders: (previous.reminders ?? []).filter((entry) => entry.id !== id) }))} onToggle={toggleReminder} />,
    "Master data": <MasterData stores={data.stores ?? []} products={data.products ?? []} reminders={data.reminders ?? []} reminderCategories={data.reminderCategories ?? []} onAddStore={addStore} onDeleteStore={(id) => update((previous) => ({ ...previous, stores: (previous.stores ?? []).filter((entry) => entry.id !== id) }))} onAddProduct={addProduct} onDeleteProduct={(id) => update((previous) => ({ ...previous, products: (previous.products ?? []).filter((entry) => entry.id !== id) }))} onAddReminderCategory={addReminderCategory} onDeleteReminderCategory={deleteReminderCategory} />,
    Stocks: <StockWorkspace stocks={data.stocks ?? []} brokers={data.brokers ?? []} quotes={data.stockQuotes ?? []} onSaveStock={saveStock} onDeleteStock={deleteStock} onAddBroker={addBroker} onDeleteBroker={deleteBroker} onSaveQuote={saveStockQuote} />,
    "Asset manager": <AssetManager assets={data.assets ?? []} onSave={saveAsset} onDelete={deleteAsset} />,
    "Learning": <LearningPage records={data.learningRecords ?? []} onSave={saveLearningRecord} onDelete={deleteLearningRecord} />,
    "School & college records": <EducationRecordsPage records={data.educationRecords ?? []} onSave={saveEducationRecord} onDelete={deleteEducationRecord} />,
    Vehicles: <VehicleManagement vehicles={data.vehicles ?? []} journeys={data.vehicleJourneys ?? []} maintenance={data.vehicleMaintenance ?? []} onSaveVehicle={saveVehicle} onDeleteVehicle={deleteVehicle} onSaveJourney={saveVehicleJourney} onDeleteJourney={deleteVehicleJourney} onSaveMaintenance={saveVehicleMaintenance} onDeleteMaintenance={deleteVehicleMaintenance} />,
    "Personal documents": <PersonalRecordsPage records={data.personalRecords ?? []} onSave={savePersonalRecord} onDelete={deletePersonalRecord} />,
    "Account credentials": <CredentialVaultPage vault={data.credentialVault} onSave={(credentialVault) => update((previous) => ({ ...previous, credentialVault }))} onDelete={() => update((previous) => ({ ...previous, credentialVault: undefined }))} />,
    "Data management": <DataManagement data={data} currency={currency} darkMode={darkMode} fontSize={fontSize} fontStyle={fontStyle} accentColor={accentColor} darkTheme={darkTheme} visualTheme={visualTheme} syncStatus={syncStatus} syncMessage={syncMessage} refreshing={refreshing} onCurrencyChange={setCurrency} onToggleDarkMode={() => setDarkMode((enabled) => !enabled)} onFontSizeChange={setFontSize} onFontStyleChange={setFontStyle} onAccentChange={setAccentColor} onDarkThemeChange={setDarkTheme} onVisualThemeChange={setVisualTheme} onImport={importBackup} onClear={clearData} onExport={exportBackup} onSaveNow={() => void saveNow()} onRefresh={() => void refreshSharedData()} onSignOut={() => void handleSignOut()} />,
    "R&D / Test Connectors": <TestConnectors />,
  };
  return <CurrencyContext.Provider value={currency}><div className={`app-shell ${darkMode ? "dark" : ""} font-${fontSize} font-style-${fontStyle} accent-${accentColor} theme-${darkTheme} style-${visualTheme}`}>
    {mobileMenu && <button aria-label="Close menu" onClick={() => setMobileMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 9, background: "#18211b55", border: 0 }} />}
    <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}><div className="brand"><div className="brand-mark"><ShoppingBasket size={19} /></div><div><div className="brand-name">daybook<span>.</span></div><div className="brand-caption">your shopping companion</div></div></div>
      <div className="nav-label">YOUR SPACE</div><nav className="nav-list" aria-label="Main navigation">{navigation.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${page === name ? "active" : ""}`} onClick={() => changePage(name)}><Icon size={16} strokeWidth={1.8} />{name}</button>)}</nav>
      <div className="sidebar-bottom"><div className="nav-label">PREFERENCES</div><button className={`nav-item ${page === "Data management" ? "active" : ""}`} onClick={() => changePage("Data management")}><Settings2 size={16} strokeWidth={1.8} />Data management</button><div className="side-note"><strong>A little more mindful.</strong>Your everyday shopping, gently organized in one place.</div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileMenu(true)}><Menu size={19} /></button><span className="topbar-date">{titleDate}</span></div><div className="topbar-right"><button className="theme-toggle" type="button" aria-pressed={darkMode} onClick={() => setDarkMode((enabled) => !enabled)}>{darkMode ? <Sun size={15} /> : <Moon size={15} />}<span>{darkMode ? "Light mode" : "Dark mode"}</span></button><button className="text-link" type="button" onClick={() => void handleSignOut()}>Sign out</button></div></header>
      <div className="main-content">{error && <div className="alert alert-error" role="alert"><X size={15} style={{ flex: "none", marginTop: 1 }} /><span>{error}</span><button className="icon-button" aria-label="Dismiss error" onClick={() => setError("")}><X size={14} /></button></div>}{notice && <div className="alert alert-success" role="status"><CheckCircle2 size={15} /><span>{notice}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={14} /></button></div>}{pageContent[page]}</div>
    </main>
    <nav className="mobile-nav" aria-label="Mobile navigation">{[navigation[0], navigation[1], navigation[2], navigation[3]].map(({ name, icon: Icon }) => <button key={name} className={page === name ? "active" : ""} onClick={() => changePage(name)}><Icon size={17} /><span>{name === "Shopping list" ? "List" : name === "Shopping trips" ? "Trips" : name === "Purchase history" ? "History" : name}</span></button>)}</nav>
    {modal === "add" && <ItemModal products={data.products ?? []} onClose={() => setModal(null)} onSave={addItem} />}
    {editing && <ItemModal initial={editing} products={data.products ?? []} onClose={() => setEditing(null)} onSave={editItem} />}
    {modal === "trip" && <TripModal data={data} onClose={() => setModal(null)} onSave={saveTrip} />}
  </div></CurrencyContext.Provider>;
}
