import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import {
  AppWindow, Archive, ArchiveRestore, Banknote, BookOpen, Briefcase, CalendarDays, Car, ChevronDown, ChevronUp,
  Code2, Database, ExternalLink, FileText, GraduationCap, Grid2X2, GripVertical, Heart, LayoutDashboard, Link2, List, Mail, Monitor,
  MoreHorizontal, Pencil, Plus, Search, Settings2, ShoppingBag, Sparkles, Star, Trash2, X,
  type LucideIcon,
} from "lucide-react";
import { Button, Card, EmptyState, Field, Input, Modal } from "./ui";
import { createId, isSafeHttpUrl } from "../lib/data";
import {
  DEFAULT_EXTERNAL_APP_CATEGORIES, MAX_EXTERNAL_APPS, type ExternalAppLink,
} from "../types";

const DEFAULT_BACKGROUND = "#dcebdd";
const PAGE_SIZE = 12;
const ICONS: Record<string, LucideIcon> = {
  AppWindow, Banknote, BookOpen, Briefcase, CalendarDays, Car, Code2, Database, FileText,
  GraduationCap, Heart, LayoutDashboard, Link2, Mail, Monitor, ShoppingBag, Sparkles, Settings2,
};
const CATEGORY_ICONS: Record<string, string> = {
  Personal: "Heart",
  Finance: "Banknote",
  Development: "Code2",
  "Vehicle Management": "Car",
  "Education & Career": "GraduationCap",
  Productivity: "CalendarDays",
  Other: "AppWindow",
};
type HubFilter = "all" | "favorites" | "recent" | "categories" | "archived";
const HUB_FILTERS: { id: HubFilter; label: string }[] = [
  { id: "all", label: "All Apps" },
  { id: "favorites", label: "Favorites" },
  { id: "recent", label: "Recently Used" },
  { id: "categories", label: "Categories" },
  { id: "archived", label: "Archived" },
];

function getAppCategory(app: Pick<ExternalAppLink, "name" | "url" | "category">) {
  if (app.category) return app.category;
  const identity = `${app.name} ${app.url}`.toLocaleLowerCase();
  if (/\b(car|vehicle|automotive|garage|fuel|fleet|transport)\b/.test(identity)) return "Vehicle Management";
  if (/\b(school|college|course|education|learning|student|training|university)\b/.test(identity)) return "Education & Career";
  if (/\b(github|gitlab|vercel|lovable|supabase|developer|development|code|database|api)\b/.test(identity)) return "Development";
  if (/\b(bank|finance|money|payment|stock|invest|expense|account|budget|bill)\b/.test(identity)) return "Finance";
  if (/\b(calendar|task|project|notion|workspace|drive|mail|document|office)\b/.test(identity)) return "Productivity";
  if (/\b(personal|health|fitness|family|wellness)\b/.test(identity)) return "Personal";
  return "Other";
}

function normalizedUrl(url: string) {
  if (!url.trim()) return "";
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "").toLocaleLowerCase();
  } catch {
    return url.trim().toLocaleLowerCase();
  }
}

function ExternalAppEditor({ initial, apps, categories, onClose, onSave }: {
  initial?: ExternalAppLink;
  apps: ExternalAppLink[];
  categories: string[];
  onClose: () => void;
  onSave: (app: ExternalAppLink) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial ? getAppCategory(initial) : "Other");
  const [icon, setIcon] = useState(initial?.icon ?? CATEGORY_ICONS[initial ? getAppCategory(initial) : "Other"] ?? "AppWindow");
  const [backgroundColor, setBackgroundColor] = useState(initial?.backgroundColor ?? DEFAULT_BACKGROUND);
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [isFavorite, setIsFavorite] = useState(initial?.isFavorite ?? false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    const normalizedName = trimmedName.toLocaleLowerCase();
    const duplicate = apps.find((app) => app.id !== initial?.id && (
      app.name.trim().toLocaleLowerCase() === normalizedName ||
      Boolean(trimmedUrl) && normalizedUrl(app.url) === normalizedUrl(trimmedUrl)
    ));
    if (!trimmedName || trimmedName.length > 80) {
      setError("Enter an application name between 1 and 80 characters.");
      return;
    }
    if (duplicate) {
      setError(`An application named “${duplicate.name}” or using the same URL already exists.`);
      return;
    }
    if (trimmedUrl && !isSafeHttpUrl(trimmedUrl)) {
      setError("Enter a valid HTTP or HTTPS URL, or leave the link blank.");
      return;
    }
    const normalizedTags = [...new Set(tags.split(",").map((tag) => tag.trim()).filter(Boolean))];
    if (description.trim().length > 240 || normalizedTags.length > 20 || normalizedTags.some((tag) => tag.length > 40)) {
      setError("Description must be at most 240 characters. Add up to 20 tags of at most 40 characters each.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave({
        id: initial?.id ?? createId(),
        name: trimmedName,
        url: trimmedUrl,
        description: description.trim(),
        category,
        icon,
        backgroundColor,
        tags: normalizedTags,
        isFavorite,
        isArchived: initial?.isArchived,
        lastOpenedAt: initial?.lastOpenedAt,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this application.");
    } finally {
      setSaving(false);
    }
  }

  const IconPreview = ICONS[icon] ?? AppWindow;
  return <Modal title={initial ? "Edit application" : "Add application"} onClose={() => { if (!saving) onClose(); }} wide>
    <form className="external-app-form" onSubmit={(event) => void submit(event)}>
      <div className="external-app-form-grid">
        <Field label="Application name">
          <Input autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="For example, Calendar" />
        </Field>
        <Field label="Application URL">
          <Input type="url" maxLength={2048} autoComplete="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" />
        </Field>
        <Field label="Category">
          <select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </Field>
        <Field label="Application icon">
          <div className="external-app-icon-select"><IconPreview size={17} /><select className="field" value={icon} onChange={(event) => setIcon(event.target.value)}>{Object.keys(ICONS).map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></div>
        </Field>
        <Field label="Description">
          <Input maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A short note about this application" />
        </Field>
        <Field label="Tags">
          <Input maxLength={500} value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Separate tags with commas" />
        </Field>
        <Field label="Display color">
          <div className="external-app-color-field"><input className="external-app-color-input" type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} /><span>{backgroundColor.toUpperCase()}</span></div>
        </Field>
        <label className="external-app-favorite-check"><input type="checkbox" checked={isFavorite} onChange={(event) => setIsFavorite(event.target.checked)} /><Star size={15} /> Favorite application</label>
      </div>
      <p className="section-description">Applications open in a new tab. Your existing URL is preserved when editing. Without a URL, the card displays the name only.</p>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="modal-actions">
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save application"}</Button>
      </div>
    </form>
  </Modal>;
}

function CategoryManager({ categories, apps, onClose, onSave }: {
  categories: string[];
  apps: ExternalAppLink[];
  onClose: () => void;
  onSave: (categories: string[], renames?: { from: string; to: string }[]) => Promise<void>;
}) {
  const [categoryEntries, setCategoryEntries] = useState<{ original: string | null; name: string }[]>(() => categories
    .filter((category) => !DEFAULT_EXTERNAL_APP_CATEGORIES.includes(category as (typeof DEFAULT_EXTERNAL_APP_CATEGORIES)[number]))
    .map((name) => ({ original: name, name })));
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(nextCategories: string[], renames?: { from: string; to: string }[]) {
    setSaving(true);
    setError("");
    try {
      await onSave(nextCategories, renames);
      setCategoryEntries(nextCategories.filter((category) => !DEFAULT_EXTERNAL_APP_CATEGORIES.includes(category as (typeof DEFAULT_EXTERNAL_APP_CATEGORIES)[number]))
        .map((name) => ({ original: name, name })));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save application categories.");
    } finally {
      setSaving(false);
    }
  }

  return <Modal title="Manage categories" onClose={() => { if (!saving) onClose(); }}>
    <div className="external-app-category-manager">
      {categoryEntries.map((entry, index) => <div className="external-app-category-row" key={entry.original ?? `new-${index}`}>
        <Input aria-label={`Category ${entry.name}`} value={entry.name} maxLength={80} onChange={(event) => setCategoryEntries((current) => current.map((category, categoryIndex) => categoryIndex === index ? { ...category, name: event.target.value } : category))} />
        <button type="button" className="icon-button" disabled={saving || Boolean(entry.original && apps.some((app) => app.category === entry.original))} title={entry.original && apps.some((app) => app.category === entry.original) ? "Move applications out of this category before removing it" : "Remove category"} aria-label={`Remove ${entry.name}`} onClick={() => setCategoryEntries((current) => current.filter((_, categoryIndex) => categoryIndex !== index))}><X size={14} /></button>
      </div>)}
      {!categoryEntries.length && <p className="section-description">Add your own categories; built-in categories are always available.</p>}
      <form className="external-app-category-add" onSubmit={(event) => {
        event.preventDefault();
        const value = newCategory.trim();
        if (categoryEntries.length >= MAX_EXTERNAL_APPS || !value || value.length > 80 || categories.some((category) => category.toLocaleLowerCase() === value.toLocaleLowerCase()) ||
          categoryEntries.some((entry) => entry.name.trim().toLocaleLowerCase() === value.toLocaleLowerCase())) {
          setError("Enter a unique category name (up to 80 characters).");
          return;
        }
        setNewCategory("");
        setCategoryEntries((current) => [...current, { original: null, name: value }]);
      }}><Input aria-label="New category name" maxLength={80} value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="New category name" /><Button type="submit" size="sm" disabled={saving}><Plus size={13} /> Add</Button></form>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="modal-actions">
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Close</Button>
        <Button type="button" disabled={saving} onClick={() => {
          const trimmed = categoryEntries.map((entry) => entry.name.trim());
          if (trimmed.some((entry) => !entry) || new Set(trimmed.map((entry) => entry.toLocaleLowerCase())).size !== trimmed.length ||
            trimmed.some((entry) => DEFAULT_EXTERNAL_APP_CATEGORIES.some((builtin) => builtin.toLocaleLowerCase() === entry.toLocaleLowerCase()))) {
            setError("Category names must be non-empty and unique.");
            return;
          }
          const renames = categoryEntries.flatMap((entry, index) => entry.original && entry.original !== trimmed[index]
            ? [{ from: entry.original, to: trimmed[index] }]
            : []);
          const renamedCategories = new Set(renames.map((entry) => entry.from));
          const removedInUse = categories.find((category) =>
            !DEFAULT_EXTERNAL_APP_CATEGORIES.includes(category as (typeof DEFAULT_EXTERNAL_APP_CATEGORIES)[number]) &&
            !trimmed.includes(category) && !renamedCategories.has(category) &&
            apps.some((app) => app.category === category));
          if (removedInUse) {
            setError(`Move applications out of “${removedInUse}” before removing that category.`);
            return;
          }
          void save(trimmed, renames);
        }}>Save categories</Button>
      </div>
    </div>
  </Modal>;
}

export function ExternalAppsPage({ apps, categories: savedCategories, saving, onSave, onArchive, onDelete, onReorder, onOpen, onSaveCategories }: {
  apps: ExternalAppLink[];
  categories: string[];
  saving: boolean;
  onSave: (app: ExternalAppLink) => Promise<void>;
  onArchive: (id: string, isArchived: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReorder: (apps: ExternalAppLink[]) => Promise<void>;
  onOpen: (id: string) => Promise<void>;
  onSaveCategories: (categories: string[], renames?: { from: string; to: string }[]) => Promise<void>;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalAppLink | undefined>();
  const [actionError, setActionError] = useState("");
  const [filter, setFilter] = useState<HubFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [page, setPage] = useState(0);
  const [draggedAppId, setDraggedAppId] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set([
    ...DEFAULT_EXTERNAL_APP_CATEGORIES,
    ...savedCategories,
    ...apps.map(getAppCategory),
  ])].sort((a, b) => a.localeCompare(b)), [savedCategories, apps]);
  const activeApps = apps.filter((app) => !app.isArchived);
  const archivedApps = apps.filter((app) => app.isArchived);
  const filteredApps = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    let matches = apps.filter((app) => {
      if (filter === "archived") return Boolean(app.isArchived);
      if (app.isArchived) return false;
      if (filter === "favorites" && !app.isFavorite) return false;
      if (filter === "recent" && !app.lastOpenedAt) return false;
      if (categoryFilter && getAppCategory(app) !== categoryFilter) return false;
      if (!query) return true;
      return [app.name, app.description ?? "", getAppCategory(app), ...(app.tags ?? [])]
        .join(" ").toLocaleLowerCase().includes(query);
    });
    if (filter === "recent") matches = matches.sort((a, b) => (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? ""));
    return matches;
  }, [apps, categoryFilter, filter, search]);
  const pageCount = Math.max(1, Math.ceil(filteredApps.length / PAGE_SIZE));
  const pageApps = filteredApps.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);
  const displayGroups = groupByCategory
    ? [...new Set(pageApps.map(getAppCategory))].map((category) => ({
      category,
      apps: pageApps.filter((app) => getAppCategory(app) === category),
    }))
    : [{ category: "", apps: pageApps }];

  function openEditor(app?: ExternalAppLink) {
    setActionError("");
    setEditing(app);
    setEditorOpen(true);
  }

  async function saveApp(app: ExternalAppLink) {
    await onSave(app);
    setEditorOpen(false);
    setEditing(undefined);
  }

  async function setAppArchived(app: ExternalAppLink, isArchived: boolean) {
    setActionError("");
    try {
      await onArchive(app.id, isArchived);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : `Could not ${isArchived ? "archive" : "restore"} this application.`);
    }
  }

  async function deleteApp(app: ExternalAppLink) {
    if (!window.confirm(`Permanently delete “${app.name}”? This cannot be undone.`)) return;
    setActionError("");
    try {
      await onDelete(app.id);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not delete this application.");
    }
  }

  async function reorderApp(sourceId: string, targetId: string) {
    if (sourceId === targetId || saving) return;
    const visible = [...filteredApps];
    const sourceIndex = visible.findIndex((app) => app.id === sourceId);
    const targetIndex = visible.findIndex((app) => app.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [movedApp] = visible.splice(sourceIndex, 1);
    visible.splice(targetIndex, 0, movedApp);
    let visibleIndex = 0;
    const visibleIds = new Set(filteredApps.map((app) => app.id));
    const reordered = apps.map((app) => visibleIds.has(app.id) ? visible[visibleIndex++] : app);
    setActionError("");
    try {
      await onReorder(reordered);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not save application order.");
    }
  }

  function startDragging(event: DragEvent<HTMLButtonElement>, appId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", appId);
    setDraggedAppId(appId);
  }

  function dropOnCard(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain") || draggedAppId;
    if (sourceId) void reorderApp(sourceId, targetId);
    setDraggedAppId(null);
  }

  function selectFilter(next: HubFilter) {
    setFilter(next);
    setCategoryFilter("");
    setPage(0);
  }

  async function toggleFavorite(app: ExternalAppLink) {
    try {
      await onSave({ ...app, isFavorite: !app.isFavorite });
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not update the favorite.");
    }
  }

  async function changeCategory(app: ExternalAppLink, category: string) {
    try {
      await onSave({ ...app, category });
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not change the application category.");
    }
  }

  async function trackOpen(id: string) {
    try {
      await onOpen(id);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not update application usage.");
    }
  }

  function renderAppCard(app: ExternalAppLink, index: number) {
    const appCategory = getAppCategory(app);
    const Icon = ICONS[app.icon ?? ""] ?? ICONS[CATEGORY_ICONS[appCategory]] ?? AppWindow;
    const openedAt = app.lastOpenedAt ? new Date(app.lastOpenedAt) : null;
    function launchFromCard(target: EventTarget) {
      if (!app.url || !(target instanceof Element) || target.closest("a, button, details, select, input")) return;
      window.open(app.url, "_blank", "noopener,noreferrer");
      void trackOpen(app.id);
    }
    return <Card
      key={app.id}
      className={`external-app-card external-app-${view}${draggedAppId === app.id ? " is-dragging" : ""}`}
      onClick={(event) => launchFromCard(event.target)}
      onDragOver={(event) => { if (draggedAppId) event.preventDefault(); }}
      onDrop={(event) => dropOnCard(event, app.id)}
    >
      <div className="external-app-card-icon" style={{ backgroundColor: `${app.backgroundColor}30`, color: app.backgroundColor }}><Icon size={20} /></div>
      <div className="external-app-card-content">
        <div className="external-app-card-title"><strong>{app.name}</strong>{app.isFavorite && <Star size={13} fill="currentColor" aria-label="Favorite" />}</div>
        <p>{app.description || "No description added."}</p>
        <div className="external-app-card-meta"><span>{appCategory}</span><span className={`external-app-status${app.isArchived ? " archived" : ""}`}>{app.isArchived ? "Archived" : "Active"}</span></div>
        {(app.tags?.length || openedAt) && <div className="external-app-card-foot">{app.tags?.slice(0, 3).map((tag) => <span className="external-app-tag" key={tag}>{tag}</span>)}{openedAt && <small>Opened {openedAt.toLocaleDateString()}</small>}</div>}
      </div>
      <div className="external-app-card-actions">
        <button type="button" className="icon-button external-app-drag-handle" draggable={!saving} disabled={saving || filter === "recent"} aria-label={`Drag ${app.name} to reorder`} title="Drag to reorder" onDragStart={(event) => startDragging(event, app.id)} onDragEnd={() => setDraggedAppId(null)}><GripVertical size={13} /></button>
        <button type="button" className="icon-button" disabled={saving || index === 0 || filter === "recent"} aria-label={`Move ${app.name} up`} title="Move up" onClick={() => index > 0 && void reorderApp(app.id, pageApps[index - 1]?.id)}><ChevronUp size={13} /></button>
        <button type="button" className="icon-button" disabled={saving || index === pageApps.length - 1 || filter === "recent"} aria-label={`Move ${app.name} down`} title="Move down" onClick={() => index < pageApps.length - 1 && void reorderApp(app.id, pageApps[index + 1]?.id)}><ChevronDown size={13} /></button>
        <details className="external-app-menu"><summary aria-label={`Actions for ${app.name}`} title="Application actions"><MoreHorizontal size={15} /></summary><div className="external-app-menu-popover">
          {app.url && <a href={app.url} target="_blank" rel="noopener noreferrer" onClick={() => void trackOpen(app.id)}><ExternalLink size={13} />Open application</a>}
          <button type="button" onClick={() => openEditor(app)}><Pencil size={13} />Edit details</button>
          <button type="button" onClick={() => void toggleFavorite(app)}><Star size={13} />{app.isFavorite ? "Remove from favorites" : "Add to favorites"}</button>
          <label><span><AppWindow size={13} />Change category</span><select aria-label={`Change category for ${app.name}`} value={appCategory} onChange={(event) => void changeCategory(app, event.target.value)}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <button type="button" onClick={() => void setAppArchived(app, !app.isArchived)}>{app.isArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}{app.isArchived ? "Restore" : "Archive"}</button>
          <button type="button" className="danger" onClick={() => void deleteApp(app)}><Trash2 size={13} />Delete</button>
        </div></details>
      </div>
      {app.url
        ? <a className="external-app-open" href={app.url} target="_blank" rel="noopener noreferrer" onClick={() => void trackOpen(app.id)}>Open application <ExternalLink size={13} /></a>
        : <span className="external-app-no-url">No URL configured</span>}
    </Card>;
  }

  return <>
    <div className="external-app-hub-header">
      <div><p className="eyebrow">Your workspace</p><h1 className="page-title">Application Hub</h1><p className="page-subtitle">Manage and access your connected applications.</p></div>
      <Button type="button" disabled={saving || apps.length >= MAX_EXTERNAL_APPS} onClick={() => openEditor()}><Plus size={14} /> Add Application</Button>
    </div>
    <div className="external-app-statistics" aria-label="Application counts">
      <div><strong>{apps.length}</strong><span>Total applications</span></div>
      <div><strong>{activeApps.length}</strong><span>Active</span></div>
      <div><strong>{archivedApps.length}</strong><span>Archived</span></div>
    </div>
    {saving && <p className="external-app-sync-status" role="status">Saving application hub changes…</p>}
    {actionError && <div className="alert alert-error" role="alert">{actionError}</div>}
    <div className="external-app-toolbar">
      <label className="external-app-search"><Search size={16} /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} aria-label="Search applications" placeholder="Search name, description, category, or tags…" /></label>
      <div className="external-app-view-toggle" aria-label="Application layout">
        <button type="button" className={view === "grid" ? "active" : ""} aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Grid2X2 size={15} /></button>
        <button type="button" className={view === "list" ? "active" : ""} aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={15} /></button>
      </div>
    </div>
    <div className="external-app-tabs" role="tablist" aria-label="Application filters">
      {HUB_FILTERS.map(({ id, label }) => {
        const count = id === "all" ? activeApps.length
          : id === "favorites" ? activeApps.filter((app) => app.isFavorite).length
            : id === "recent" ? activeApps.filter((app) => app.lastOpenedAt).length
              : id === "archived" ? archivedApps.length : categories.length;
        return <button type="button" role="tab" aria-selected={filter === id} className={filter === id ? "active" : ""} key={id} onClick={() => selectFilter(id)}>{label}<span>{count}</span></button>;
      })}
      <button type="button" className="external-app-manage-categories" onClick={() => setCategoryManagerOpen(true)}><Settings2 size={13} />Manage categories</button>
      {filter === "categories" && <button type="button" className={`external-app-group-toggle${groupByCategory ? " active" : ""}`} onClick={() => setGroupByCategory((current) => !current)}>{groupByCategory ? "Grouped by category" : "Group by category"}</button>}
    </div>
    {filter === "categories" && <div className="external-app-category-filters"><button type="button" className={!categoryFilter ? "active" : ""} onClick={() => { setCategoryFilter(""); setPage(0); }}>All categories</button>{categories.map((category) => <button type="button" key={category} className={categoryFilter === category ? "active" : ""} onClick={() => { setCategoryFilter(category); setPage(0); }}>{category}<span>{activeApps.filter((app) => getAppCategory(app) === category).length}</span></button>)}</div>}
    {filter === "recent" && <p className="external-app-recent-note">Applications are listed by latest open activity on this device account.</p>}
    {filteredApps.length ? <div className={`external-app-results external-app-${view}-grid`}>
      {displayGroups.map(({ category, apps: groupApps }) => <section className="external-app-result-group" key={category || "all"}>
        {category && <h2>{category}</h2>}
        <div className={`external-app-grid external-app-${view}`}>{groupApps.map((app) => renderAppCard(app, pageApps.findIndex((entry) => entry.id === app.id)))}</div>
      </section>)}
    </div> : <Card><EmptyState
      icon={filter === "favorites" ? <Star size={18} /> : filter === "recent" ? <CalendarDays size={18} /> : <Search size={18} />}
      title={search ? "No matching applications" : filter === "archived" ? "No archived applications" : filter === "favorites" ? "No favorite applications" : filter === "recent" ? "No recently used applications" : "No applications yet"}
      description={search ? "Try another name, description, category, or tag." : filter === "archived" ? "Archived applications will appear here and can be restored anytime." : filter === "favorites" ? "Mark applications as favorites from their action menu." : filter === "recent" ? "Open an application to see it here." : "Add your first application to create a shortcut."}
    /></Card>}
    {pageCount > 1 && <div className="external-app-pagination"><span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredApps.length)} of {filteredApps.length}</span><div><Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</Button><span>Page {page + 1} of {pageCount}</span><Button size="sm" variant="outline" disabled={page >= pageCount - 1} onClick={() => setPage((current) => current + 1)}>Next</Button></div></div>}
    {editorOpen && <ExternalAppEditor key={editing?.id ?? "new"} initial={editing} apps={apps} categories={categories} onClose={() => setEditorOpen(false)} onSave={saveApp} />}
    {categoryManagerOpen && <CategoryManager categories={categories} apps={apps} onClose={() => setCategoryManagerOpen(false)} onSave={onSaveCategories} />}
  </>;
}
