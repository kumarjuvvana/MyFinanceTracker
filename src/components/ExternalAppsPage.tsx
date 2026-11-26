import { useState, type FormEvent, type ReactNode } from "react";
import { Archive, ArchiveRestore, ExternalLink, Pencil, Plus } from "lucide-react";
import { Button, Card, EmptyState, Field, Input, Modal } from "./ui";
import { createId, isSafeHttpUrl } from "../lib/data";
import { MAX_EXTERNAL_APPS, type ExternalAppLink } from "../types";

const DEFAULT_BACKGROUND = "#dcebdd";

function getTextColor(backgroundColor: string) {
  const hex = backgroundColor.slice(1);
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 155 ? "#253027" : "#ffffff";
}

function ExternalAppEditor({ initial, onClose, onSave }: {
  initial?: ExternalAppLink;
  onClose: () => void;
  onSave: (app: ExternalAppLink) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [backgroundColor, setBackgroundColor] = useState(initial?.backgroundColor ?? DEFAULT_BACKGROUND);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || trimmedName.length > 80) {
      setError("Enter a name between 1 and 80 characters.");
      return;
    }
    if (trimmedUrl && !isSafeHttpUrl(trimmedUrl)) {
      setError("Enter a valid HTTP or HTTPS URL, or leave the link blank.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave({
        id: initial?.id ?? createId(),
        name: trimmedName,
        url: trimmedUrl,
        backgroundColor,
        isArchived: initial?.isArchived,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this app shortcut.");
    } finally {
      setSaving(false);
    }
  }

  return <Modal title={initial ? "Edit app shortcut" : "Add app shortcut"} onClose={() => { if (!saving) onClose(); }}>
    <form className="external-app-form" onSubmit={(event) => void submit(event)}>
      <Field label="Display name">
        <Input autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="For example, Calendar" />
      </Field>
      <Field label="App URL (optional)">
        <Input type="url" maxLength={2048} autoComplete="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" />
      </Field>
      <Field label="Card background color">
        <input className="external-app-color-input" type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} />
      </Field>
      <p className="section-description">Without a URL, the card displays the name only. Add a URL to open the app in a new tab.</p>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="modal-actions">
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save shortcut"}</Button>
      </div>
    </form>
  </Modal>;
}

export function ExternalAppsPage({ apps, saving, onSave, onArchive }: {
  apps: ExternalAppLink[];
  saving: boolean;
  onSave: (app: ExternalAppLink) => Promise<void>;
  onArchive: (id: string, isArchived: boolean) => Promise<void>;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ExternalAppLink | undefined>();
  const [actionError, setActionError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const displayedApps = apps.filter((app) => Boolean(app.isArchived) === showArchived);

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
      setActionError(caught instanceof Error ? caught.message : `Could not ${isArchived ? "archive" : "restore"} this app shortcut.`);
    }
  }

  return <>
    <PageHeading
      title="External apps"
      subtitle="Save shortcuts to your other apps. Add a URL to open a card in a new tab; shortcuts sync across your devices."
      action={<Button type="button" disabled={saving || showArchived || apps.filter((app) => !app.isArchived).length >= MAX_EXTERNAL_APPS} onClick={() => openEditor()}><Plus size={14} /> Add app</Button>}
    />
    <div className="external-app-tabs" role="tablist" aria-label="External app shortcuts">
      <button type="button" role="tab" aria-selected={!showArchived} className={!showArchived ? "active" : ""} onClick={() => setShowArchived(false)}>Active ({apps.filter((app) => !app.isArchived).length})</button>
      <button type="button" role="tab" aria-selected={showArchived} className={showArchived ? "active" : ""} onClick={() => setShowArchived(true)}>Archived ({apps.filter((app) => app.isArchived).length})</button>
    </div>
    {saving && <p className="external-app-sync-status" role="status">Saving shortcuts to shared preferences…</p>}
    {actionError && <div className="alert alert-error" role="alert">{actionError}</div>}
    {displayedApps.length ? <div className="external-app-grid">{displayedApps.map((app) => <Card
      key={app.id}
      className="external-app-card"
      style={{ backgroundColor: app.backgroundColor, color: getTextColor(app.backgroundColor) }}
    >
      <div className="external-app-card-actions">
        <button type="button" className="icon-button" disabled={saving} aria-label={`Edit ${app.name}`} title={`Edit ${app.name}`} onClick={() => openEditor(app)}><Pencil size={12} /></button>
        <button type="button" className="icon-button" disabled={saving} aria-label={showArchived ? `Restore ${app.name}` : `Archive ${app.name}`} title={showArchived ? "Restore shortcut" : "Archive shortcut"} onClick={() => void setAppArchived(app, !showArchived)}>{showArchived ? <ArchiveRestore size={12} /> : <Archive size={12} />}</button>
      </div>
      {app.url
        ? <a className="external-app-card-link" href={app.url} target="_blank" rel="noopener noreferrer">{app.name}</a>
        : <strong className="external-app-card-name">{app.name}</strong>}
    </Card>)}</div> : <Card><EmptyState
      icon={<ExternalLink size={18} />}
      title={showArchived ? "No archived apps" : "No external apps yet"}
      description={showArchived ? "Shortcuts you archive will appear here. You can restore them anytime." : "Add a shortcut card for another app. You can set its name and background color, then add a URL whenever you’re ready."}
    /></Card>}
    {!showArchived && apps.filter((app) => !app.isArchived).length >= MAX_EXTERNAL_APPS && <p className="section-description">You can save up to {MAX_EXTERNAL_APPS} active app shortcuts.</p>}
    {editorOpen && <ExternalAppEditor key={editing?.id ?? "new"} initial={editing} onClose={() => setEditorOpen(false)} onSave={saveApp} />}
  </>;
}

function PageHeading({ title, subtitle, action }: { title: string; subtitle: string; action: ReactNode }) {
  return <div className="page-head"><div><p className="eyebrow">Your shortcuts</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>;
}
