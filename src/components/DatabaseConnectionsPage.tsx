import { useEffect, useState, type FormEvent } from "react";
import { Database, Eye, EyeOff, KeyRound, LockKeyhole, Pencil, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Select } from "./ui";
import { createId } from "../lib/data";
import {
  loadSavedProfileDatabaseCatalog,
  loadSavedProfileDatabaseRows,
  testSupabaseConnection,
  type DatabaseRows,
  type DatabaseTable,
} from "../lib/databaseApi";
import { testProfileDocumentStorage } from "../lib/documentApi";
import { loadDatabaseConnectionVault, saveDatabaseConnectionVault } from "../lib/databaseConnectionsApi";
import {
  decryptDatabaseConnectionProfiles,
  encryptDatabaseConnectionProfiles,
  serializeLocalDatabaseConnectionConfig,
  type DatabaseConnectionProfile,
} from "../lib/databaseConnectionProfiles";
import type { EncryptedVault } from "../types";

function moduleNames(value: string): string[] {
  return [...new Set(value.split(",").map((module) => module.trim()).filter(Boolean))];
}

function formatDatabaseValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "undefined") return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value, null, 2) ?? String(value);
  return String(value);
}

export function DatabaseConnectionsPage() {
  const [vault, setVault] = useState<EncryptedVault | null>(null);
  const [profiles, setProfiles] = useState<DatabaseConnectionProfile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [vaultLoadFailed, setVaultLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [profileId, setProfileId] = useState("");
  const [name, setName] = useState("");
  const [modules, setModules] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const [caCertificate, setCaCertificate] = useState("");
  const [storageUrl, setStorageUrl] = useState("");
  const [storageServiceRoleKey, setStorageServiceRoleKey] = useState("");
  const [storageBucket, setStorageBucket] = useState("mydocumentsmanager-documents");
  const [showStorageServiceRoleKey, setShowStorageServiceRoleKey] = useState(false);
  const [showConnectionString, setShowConnectionString] = useState(true);
  const [testedFingerprint, setTestedFingerprint] = useState("");
  const [testedStorageFingerprint, setTestedStorageFingerprint] = useState("");
  const [browsingProfileId, setBrowsingProfileId] = useState("");
  const [profileTables, setProfileTables] = useState<DatabaseTable[]>([]);
  const [selectedProfileTable, setSelectedProfileTable] = useState("");
  const [profileRows, setProfileRows] = useState<DatabaseRows | null>(null);
  const [profileBrowseBusy, setProfileBrowseBusy] = useState(false);
  const [profileBrowseError, setProfileBrowseError] = useState("");

  useEffect(() => {
    let active = true;
    void loadDatabaseConnectionVault()
      .then((savedVault) => {
        if (active) setVault(savedVault);
      })
      .catch((caught: unknown) => {
        if (active) {
          setVaultLoadFailed(true);
          setError(caught instanceof Error ? caught.message : "Could not load saved database connections.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const currentFingerprint = `${connectionString.trim()}\n${caCertificate.trim()}`;
  const currentStorageFingerprint = `${storageUrl.trim()}\n${storageServiceRoleKey.trim()}\n${storageBucket.trim()}`;

  function resetEditor() {
    setProfileId("");
    setName("");
    setModules("");
    setConnectionString("");
    setCaCertificate("");
    setStorageUrl("");
    setStorageServiceRoleKey("");
    setStorageBucket("mydocumentsmanager-documents");
    setShowStorageServiceRoleKey(false);
    setShowConnectionString(true);
    setTestedFingerprint("");
    setTestedStorageFingerprint("");
  }

  async function unlockOrCreateVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (vault) {
        const unlockedProfiles = await decryptDatabaseConnectionProfiles(vault, passphrase);
        setProfiles(unlockedProfiles);
        setNotice("Connection profiles unlocked for this screen.");
      } else {
        if (passphrase.length < 16) throw new Error("Choose a passphrase with at least 16 characters.");
        if (passphrase !== confirmPassphrase) throw new Error("The passphrases do not match.");
        setProfiles([]);
        setNotice("Vault ready. It will be created when you save the first connection profile.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not unlock the database connection vault.");
    } finally {
      setBusy(false);
    }
  }

  async function testConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setTestedFingerprint("");
    setBusy(true);
    try {
      const result = await testSupabaseConnection(connectionString.trim(), caCertificate.trim());
      setTestedFingerprint(currentFingerprint);
      setNotice(`Connected successfully to the "${result.database}" database. You can now save this profile.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not test this Supabase connection.");
    } finally {
      setBusy(false);
    }
  }

  async function testStorageConnection() {
    setError("");
    setNotice("");
    setTestedStorageFingerprint("");
    setBusy(true);
    try {
      await testProfileDocumentStorage(storageUrl.trim(), storageServiceRoleKey.trim(), storageBucket.trim());
      setTestedStorageFingerprint(currentStorageFingerprint);
      setNotice(`Connected to the private "${storageBucket.trim()}" bucket. Its contents will remain separate from the other Supabase projects.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not verify the private Storage bucket.");
    } finally {
      setBusy(false);
    }
  }

  async function persistProfiles(nextProfiles: DatabaseConnectionProfile[], successMessage: string) {
    const encryptedVault = await encryptDatabaseConnectionProfiles(nextProfiles, passphrase);
    await saveDatabaseConnectionVault(encryptedVault);
    setVault(encryptedVault);
    setProfiles(nextProfiles);
    setNotice(successMessage);
  }

  async function saveProfile() {
    setError("");
    setNotice("");
    if (profiles === null) {
      setError("Unlock the connection vault before saving a profile.");
      return;
    }
    if (!name.trim()) {
      setError("Enter a name for this connection.");
      return;
    }
    if (testedFingerprint !== currentFingerprint) {
      setError("Test the current URI and CA certificate before saving this profile.");
      return;
    }
    const assignedModules = new Set(moduleNames(modules).map((module) => module.toLocaleLowerCase()));
    const isDocumentProfile = name.trim() === "mydocumentsmanager" &&
      ["Documents", "Personal Documents", "Account credentials"].every((module) => assignedModules.has(module.toLocaleLowerCase()));
    if (isDocumentProfile && (!storageUrl.trim() || !storageServiceRoleKey.trim() || !storageBucket.trim())) {
      setError("Configure the new project's Supabase URL, secret or legacy service-role key, and private bucket before saving the mydocumentsmanager profile.");
      return;
    }
    if ((storageUrl.trim() || storageServiceRoleKey.trim()) &&
      testedStorageFingerprint !== currentStorageFingerprint) {
      setError("Test the Storage project and private bucket before saving these Storage settings.");
      return;
    }

    const profile: DatabaseConnectionProfile = {
      id: profileId || createId(),
      name: name.trim(),
      modules: moduleNames(modules),
      connectionString: connectionString.trim(),
      caCertificate: caCertificate.trim(),
      ...(storageUrl.trim() && storageServiceRoleKey.trim() ? {
        storageUrl: new URL(storageUrl.trim()).origin,
        storageServiceRoleKey: storageServiceRoleKey.trim(),
        storageBucket: storageBucket.trim(),
      } : {}),
    };
    const nextProfiles = profileId
      ? profiles.map((entry) => entry.id === profileId ? profile : entry)
      : [...profiles, profile];

    setBusy(true);
    try {
      await persistProfiles(nextProfiles, `Saved "${profile.name}" encrypted across devices. Download the encrypted local config for a local copy. Module assignments do not change existing modules.`);
      resetEditor();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the encrypted connection profile.");
    } finally {
      setBusy(false);
    }
  }

  async function removeProfile(profile: DatabaseConnectionProfile) {
    if (profiles === null || !window.confirm(`Remove the saved connection profile "${profile.name}"? This will not delete or change any database records.`)) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const nextProfiles = profiles.filter((entry) => entry.id !== profile.id);
      await persistProfiles(nextProfiles, `Removed "${profile.name}" from the shared vault. No database records were changed. Download the encrypted local config if you need an updated local copy.`);
      if (browsingProfileId === profile.id) {
        setBrowsingProfileId("");
        setProfileTables([]);
        setProfileRows(null);
      }
      if (profileId === profile.id) resetEditor();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove the connection profile.");
    } finally {
      setBusy(false);
    }
  }

  function editProfile(profile: DatabaseConnectionProfile) {
    setProfileId(profile.id);
    setName(profile.name);
    setModules(profile.modules.join(", "));
    setConnectionString(profile.connectionString);
    setCaCertificate(profile.caCertificate);
    setStorageUrl(profile.storageUrl ?? "");
    setStorageServiceRoleKey(profile.storageServiceRoleKey ?? "");
    setStorageBucket(profile.storageBucket ?? "mydocumentsmanager-documents");
    setShowStorageServiceRoleKey(false);
    setShowConnectionString(true);
    setTestedFingerprint("");
    setTestedStorageFingerprint("");
    setError("");
    setNotice("");
  }

  function lockVault() {
    setProfiles(null);
    setPassphrase("");
    setConfirmPassphrase("");
    setBrowsingProfileId("");
    setProfileTables([]);
    setProfileRows(null);
    resetEditor();
    setError("");
    setNotice("");
  }

  async function browseProfile(profile: DatabaseConnectionProfile) {
    setBrowsingProfileId(profile.id);
    setProfileTables([]);
    setSelectedProfileTable("");
    setProfileRows(null);
    setProfileBrowseError("");
    setProfileBrowseBusy(true);
    try {
      const catalog = await loadSavedProfileDatabaseCatalog(profile.id, passphrase);
      setProfileTables(catalog.tables);
      const firstTable = catalog.tables[0]?.name ?? "";
      setSelectedProfileTable(firstTable);
      if (firstTable) {
        setProfileRows(await loadSavedProfileDatabaseRows(profile.id, passphrase, firstTable, 0));
      }
    } catch (caught) {
      setProfileBrowseError(caught instanceof Error ? caught.message : "Could not read tables from this profile.");
    } finally {
      setProfileBrowseBusy(false);
    }
  }

  async function readProfileTable(table: string, offset: number) {
    if (!browsingProfileId) return;
    setSelectedProfileTable(table);
    setProfileRows(null);
    setProfileBrowseError("");
    setProfileBrowseBusy(true);
    try {
      setProfileRows(await loadSavedProfileDatabaseRows(browsingProfileId, passphrase, table, offset));
    } catch (caught) {
      setProfileBrowseError(caught instanceof Error ? caught.message : "Could not read this database table.");
    } finally {
      setProfileBrowseBusy(false);
    }
  }

  function downloadLocalConfig() {
    if (!vault) {
      setError("Save a connection profile before downloading the local config.");
      return;
    }
    const file = new Blob([serializeLocalDatabaseConnectionConfig(vault)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "my-finance-tracker-database-connections.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setNotice("Downloaded the encrypted local config. It still requires the vault passphrase to unlock.");
  }

  return <>
    <div className="page-head"><div><p className="eyebrow">Data & tools</p><h1 className="page-title">Database connections</h1><p className="page-subtitle">Save encrypted connection profiles and map them to modules for later integration.</p></div></div>
    <div className="alert alert-warning"><Database size={15} style={{ flex: "none", marginTop: 1 }} /><span>These assignments do not change existing modules or move, overwrite, or delete their data. Database manager can connect to a saved profile directly; other modules need their own integration before using a profile. The app still needs its existing server settings to access this shared profile store.</span></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    {loading
      ? <Card><p className="section-description">Loading encrypted connection settings...</p></Card>
      : vaultLoadFailed
        ? <Card><h2 className="section-title">Connection settings unavailable</h2><p className="section-description">The existing vault could not be loaded. Creating or saving profiles is disabled to prevent replacing saved settings. Check the app connection and reload this page.</p><Button type="button" variant="outline" onClick={() => window.location.reload()}>Reload page</Button></Card>
        : profiles === null
        ? <Card className="connector-card"><div className="card-head"><div><h2 className="section-title">{vault ? "Unlock connection profiles" : "Create the connection vault"}</h2><p className="section-description">{vault ? "Enter the separate passphrase used when these profiles were saved." : "Choose a separate passphrase with at least 16 characters. It is never stored, so losing it makes saved profiles unrecoverable."}</p></div><LockKeyhole size={16} /></div>
          <form className="connector-form" onSubmit={(event) => void unlockOrCreateVault(event)}>
            <Field className="full" label="Connection vault passphrase"><Input type="password" autoComplete={vault ? "current-password" : "new-password"} minLength={vault ? undefined : 16} maxLength={256} required value={passphrase} onChange={(event) => setPassphrase(event.target.value)} /></Field>
            {!vault && <Field className="full" label="Confirm passphrase"><Input type="password" autoComplete="new-password" minLength={16} maxLength={256} required value={confirmPassphrase} onChange={(event) => setConfirmPassphrase(event.target.value)} /></Field>}
            <div className="full"><Button type="submit" disabled={busy}>{busy ? "Working..." : vault ? "Unlock profiles" : "Create vault"}</Button></div>
          </form>
        </Card>
        : <div className="database-connections-layout">
          <Card className="connector-card"><div className="card-head"><div><h2 className="section-title">Connection vault</h2><p className="section-description">Supabase is the shared source of truth across devices. Download an encrypted local copy for local tools; it is not a plaintext config and still needs the vault passphrase.</p></div><Badge tone="green">Unlocked</Badge></div><div className="connector-actions"><Button type="button" variant="outline" onClick={downloadLocalConfig}><Database size={14} />Download encrypted local config</Button><Button type="button" variant="outline" onClick={lockVault}><LockKeyhole size={14} />Lock vault</Button></div></Card>
          <Card className="connector-card"><div className="card-head"><div><h2 className="section-title">{profileId ? "Edit connection profile" : "Add a connection profile"}</h2><p className="section-description">Test a URI and optional CA certificate before saving its encrypted profile.</p></div><Badge tone="neutral">Configuration only</Badge></div>
            <form className="connector-form" onSubmit={(event) => void testConnection(event)}>
              <Field label="Profile name"><Input required maxLength={80} placeholder="e.g. MyRideTracker" value={name} onChange={(event) => setName(event.target.value)} /></Field>
              <Field label="Module / screen names (comma-separated)"><Input maxLength={4000} placeholder="e.g. Vehicles, Payments, Documents" value={modules} onChange={(event) => setModules(event.target.value)} /></Field>
              <Field className="full" label="Supabase PostgreSQL connection URI"><div className="credential-secret-field"><Input type={showConnectionString ? "text" : "password"} autoComplete="off" maxLength={2000} required placeholder="postgresql://user:password@host:5432/database" value={connectionString} onChange={(event) => { setConnectionString(event.target.value); setTestedFingerprint(""); }} /><button type="button" className="icon-button" aria-label={showConnectionString ? "Hide connection URI" : "Show connection URI"} title={showConnectionString ? "Hide connection URI" : "Show connection URI"} onClick={() => setShowConnectionString((visible) => !visible)}>{showConnectionString ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></Field>
              <Field className="full" label="Optional Supabase database CA certificate (PEM)"><textarea className="field textarea" rows={3} maxLength={20000} autoComplete="off" placeholder="Paste the certificate only if TLS verification fails." value={caCertificate} onChange={(event) => { setCaCertificate(event.target.value); setTestedFingerprint(""); }} /></Field>
              <div className="full"><h3 className="section-title">Supabase Storage for this profile</h3><p className="section-description">For mydocumentsmanager, enter the new Supabase project URL and secret key (or legacy service-role key). The key is included only in the encrypted profile vault and used by the server to access a private bucket. Other modules continue using their existing storage configuration.</p></div>
              <Field className="full" label="Supabase project URL"><Input type="url" autoComplete="url" maxLength={300} placeholder="https://your-project.supabase.co" value={storageUrl} onChange={(event) => { setStorageUrl(event.target.value); setTestedStorageFingerprint(""); }} /><span className="section-description">A project URL ending in /rest/v1 is accepted and saved as the project origin.</span></Field>
              <Field label="Private bucket name"><Input autoComplete="off" maxLength={63} placeholder="mydocumentsmanager-documents" value={storageBucket} onChange={(event) => { setStorageBucket(event.target.value); setTestedStorageFingerprint(""); }} /></Field>
              <Field label="Supabase secret key (or legacy service-role key)"><div className="credential-secret-field"><Input type={showStorageServiceRoleKey ? "text" : "password"} autoComplete="new-password" maxLength={4096} value={storageServiceRoleKey} onChange={(event) => { setStorageServiceRoleKey(event.target.value); setTestedStorageFingerprint(""); }} /><button type="button" className="icon-button" aria-label={showStorageServiceRoleKey ? "Hide secret key" : "Show secret key"} title={showStorageServiceRoleKey ? "Hide secret key" : "Show secret key"} onClick={() => setShowStorageServiceRoleKey((visible) => !visible)}>{showStorageServiceRoleKey ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></Field>
              <div className="full connector-actions"><Button type="submit" disabled={busy}>{busy ? "Testing..." : "Test database connection"}</Button><Button type="button" variant="outline" disabled={busy || !storageUrl.trim() || !storageServiceRoleKey.trim() || !storageBucket.trim() || testedStorageFingerprint === currentStorageFingerprint} onClick={() => void testStorageConnection()}>{busy ? "Testing..." : testedStorageFingerprint === currentStorageFingerprint ? "Private bucket verified" : "Test Storage & create private bucket"}</Button><Button type="button" variant="outline" disabled={busy || testedFingerprint !== currentFingerprint || (Boolean(storageUrl.trim() || storageServiceRoleKey.trim()) && testedStorageFingerprint !== currentStorageFingerprint)} onClick={() => void saveProfile()}>{busy ? "Saving..." : profileId ? "Save profile changes" : "Save encrypted profile"}</Button>{profileId && <Button type="button" variant="ghost" disabled={busy} onClick={resetEditor}>Cancel edit</Button>}</div>
            </form>
          </Card>
          <Card className="connector-card"><div className="card-head"><div><h2 className="section-title">Saved connection profiles</h2><p className="section-description">Assignments remain labels for other modules. Use Read tables to browse this database without changing any data.</p></div><Badge>{profiles.length}</Badge></div>
            {profiles.length
              ? <div className="database-connection-list">{profiles.map((profile) => <div className="database-connection-row" key={profile.id}>
                <div><strong>{profile.name}</strong><p>{profile.modules.length ? profile.modules.join(" · ") : "No modules assigned"}</p></div>
                <div className="table-actions"><Button type="button" size="sm" variant="outline" disabled={busy || profileBrowseBusy} onClick={() => void browseProfile(profile)}>{profileBrowseBusy && browsingProfileId === profile.id ? "Reading..." : "Read tables"}</Button><button type="button" className="icon-button" aria-label={`Edit ${profile.name}`} title="Edit profile" disabled={busy || profileBrowseBusy} onClick={() => editProfile(profile)}><Pencil size={14} /></button><button type="button" className="icon-button" aria-label={`Remove ${profile.name}`} title="Remove profile without deleting database records" disabled={busy || profileBrowseBusy} onClick={() => void removeProfile(profile)}><Trash2 size={14} /></button></div>
              </div>)}</div>
              : <EmptyState icon={<KeyRound size={18} />} title="No saved profiles" description="Test a connection above, assign module names, and save the first encrypted profile." />}
          </Card>
          {browsingProfileId && <Card className="database-browser"><div className="card-head"><div><h2 className="section-title">Read-only database browser</h2><p className="section-description">{profiles.find((profile) => profile.id === browsingProfileId)?.name ?? "Saved profile"} · public tables · up to 50 rows per page · passphrase is used only for this authenticated request</p></div><Badge tone="blue">Read only</Badge></div>
            {profileBrowseError && <div className="alert alert-error" role="alert">{profileBrowseError}</div>}
            {profileBrowseBusy && !profileTables.length && <p className="section-description">Connecting and loading tables...</p>}
            {!profileBrowseBusy && profileTables.length === 0 && !profileBrowseError && <EmptyState icon={<Database size={18} />} title="No public tables found" description="The connection succeeded, but this database has no public tables to display." />}
            {profileTables.length > 0 && <>
              <div className="database-table-select"><Field label="Public table"><Select value={selectedProfileTable} onChange={(event) => void readProfileTable(event.target.value, 0)}>{profileTables.map((table) => <option value={table.name} key={table.name}>{table.name} · ~{table.estimated_rows} rows · {table.column_count} columns</option>)}</Select></Field><Badge>{profileTables.length} tables</Badge></div>
              {profileRows && <><div className="database-column-list"><strong>Columns</strong>{profileRows.columns.map((column) => <Badge key={column.column_name}>{column.column_name} · {column.data_type}{profileRows.primaryKey.includes(column.column_name) ? " · PK" : ""}</Badge>)}</div>
                <div className="database-row-list">{profileRows.rows.map((row, index) => {
                  const key = JSON.stringify(profileRows.primaryKey.map((column) => row[column]));
                  return <article className="database-row" key={key || index}><div className="database-row-head"><strong>{profileRows.primaryKey.map((column) => `${column}=${formatDatabaseValue(row[column])}`).join(", ") || `Row ${profileRows.offset + index + 1}`}</strong></div><div className="database-fields">{profileRows.columns.map((column) => <div key={column.column_name}><span>{column.column_name}</span><pre>{formatDatabaseValue(row[column.column_name])}</pre></div>)}</div></article>;
                })}{!profileRows.rows.length && <EmptyState icon={<Database size={18} />} title="No rows in this table" description="This table is currently empty." />}</div>
                <div className="database-pagination"><span>Rows {profileRows.offset + 1}–{profileRows.offset + profileRows.rows.length}</span><div><Button type="button" variant="outline" size="sm" disabled={profileBrowseBusy || profileRows.offset === 0} onClick={() => void readProfileTable(profileRows.table, Math.max(0, profileRows.offset - 50))}>Previous</Button><Button type="button" variant="outline" size="sm" disabled={profileBrowseBusy || !profileRows.hasMore} onClick={() => void readProfileTable(profileRows.table, profileRows.offset + 50)}>Next</Button></div></div>
              </>}
            </>}
          </Card>}
        </div>}
  </>;
}
