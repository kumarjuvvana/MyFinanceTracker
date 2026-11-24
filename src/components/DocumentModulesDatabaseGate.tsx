import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Database, LockKeyhole } from "lucide-react";
import { Button, Card, Field, Input } from "./ui";
import {
  loadSavedProfileDocumentModules,
  mutateSavedProfileDocumentModules,
  type DocumentModuleMutation,
  type DocumentModulesData,
} from "../lib/databaseApi";
import { loadDatabaseConnectionVault } from "../lib/databaseConnectionsApi";
import { decryptDatabaseConnectionProfiles, type DatabaseConnectionProfile } from "../lib/databaseConnectionProfiles";
import {
  createProfileDocumentSignedUrl,
  deleteProfileDocumentFile,
  loadProfileDocumentStorageUsage,
  uploadProfileDocumentFile,
  type DocumentStorageUsage,
} from "../lib/documentApi";
import type { UploadPreparation } from "../lib/documentApi";

const DOCUMENT_MODULES_SESSION_PASSPHRASE_KEY = "myfinance-tracker.document-modules-profile-passphrase";
const REQUIRED_MODULES = ["Documents", "Personal Documents", "Account credentials"];

export function clearDocumentModulesSessionPassphrase(): boolean {
  try {
    window.sessionStorage.removeItem(DOCUMENT_MODULES_SESSION_PASSPHRASE_KEY);
    return true;
  } catch {
    return false;
  }
}

function isAssignedProfile(profile: DatabaseConnectionProfile): boolean {
  const modules = new Set(profile.modules.map((module) => module.trim().toLocaleLowerCase()));
  return profile.name === "mydocumentsmanager" &&
    REQUIRED_MODULES.every((module) => modules.has(module.toLocaleLowerCase()));
}

export function DocumentModulesDatabaseGate({
  children,
  onDataChange,
}: {
  children: (controls: {
    data: DocumentModulesData;
    mutate: (mutation: DocumentModuleMutation) => Promise<void>;
    uploadFile: (file: File) => Promise<UploadPreparation>;
    createFileUrl: (storagePath: string, downloadName?: string) => Promise<string>;
    deleteFile: (storagePath: string) => Promise<void>;
    loadStorageUsage: () => Promise<DocumentStorageUsage>;
  }) => ReactNode;
  onDataChange?: (data: DocumentModulesData | null) => void;
}) {
  const [vaultLoading, setVaultLoading] = useState(true);
  const [vault, setVault] = useState<Awaited<ReturnType<typeof loadDatabaseConnectionVault>>>(null);
  const [profiles, setProfiles] = useState<Pick<DatabaseConnectionProfile, "id" | "name">[]>([]);
  const [profileId, setProfileId] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [data, setData] = useState<DocumentModulesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const resumeAttempted = useRef(false);

  function requireStorageProfile() {
    if (!profileId || !passphrase) throw new Error("Unlock the mydocumentsmanager profile before accessing its file storage.");
    return { profileId, passphrase };
  }

  const uploadFile = (file: File) => uploadProfileDocumentFile(file, requireStorageProfile());
  const createFileUrl = (storagePath: string, downloadName?: string) =>
    createProfileDocumentSignedUrl(requireStorageProfile(), storagePath, downloadName);
  const deleteFile = (storagePath: string) => deleteProfileDocumentFile(requireStorageProfile(), storagePath);
  const loadStorageUsage = () => loadProfileDocumentStorageUsage(requireStorageProfile());

  async function connect(key: string, savedProfiles: DatabaseConnectionProfile[], remember: boolean) {
    const assigned = savedProfiles.filter(isAssignedProfile);
    if (!assigned.length) {
      throw new Error("No saved profile named mydocumentsmanager is assigned to all three document modules.");
    }
    if (assigned.length !== 1) {
      throw new Error("Assign the three document modules to exactly one mydocumentsmanager profile.");
    }
    const profile = assigned[0];
    const loaded = await loadSavedProfileDocumentModules(profile.id, key);
    if (remember) {
      try {
        window.sessionStorage.setItem(DOCUMENT_MODULES_SESSION_PASSPHRASE_KEY, key);
      } catch {
        setNotice("Connected, but this browser could not remember the passphrase for this tab session.");
      }
    }
    setProfiles(assigned.map(({ id, name }) => ({ id, name })));
    setProfileId(profile.id);
    setPassphrase(key);
    setData(loaded);
    onDataChange?.(loaded);
  }

  useEffect(() => {
    let active = true;
    void loadDatabaseConnectionVault()
      .then((savedVault) => { if (active) setVault(savedVault); })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load the saved document database profile.");
      })
      .finally(() => { if (active) setVaultLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (vaultLoading || !vault || resumeAttempted.current) return;
    resumeAttempted.current = true;
    let savedPassphrase: string | null;
    try {
      savedPassphrase = window.sessionStorage.getItem(DOCUMENT_MODULES_SESSION_PASSPHRASE_KEY);
    } catch {
      setError("Browser session storage is unavailable. Enter the database vault passphrase to connect.");
      return;
    }
    if (!savedPassphrase) return;
    setLoading(true);
    setPassphrase(savedPassphrase);
    void decryptDatabaseConnectionProfiles(vault, savedPassphrase)
      .then((savedProfiles) => connect(savedPassphrase, savedProfiles, false))
      .catch((caught: unknown) => {
        clearDocumentModulesSessionPassphrase();
        setPassphrase("");
        setError(caught instanceof Error ? caught.message : "Could not reconnect to the document database.");
      })
      .finally(() => setLoading(false));
  }, [vault, vaultLoading]);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      if (!vault) throw new Error("No saved database connection vault was found.");
      const savedProfiles = await decryptDatabaseConnectionProfiles(vault, passphrase);
      await connect(passphrase, savedProfiles, true);
      setNotice("Connected to mydocumentsmanager. Document records are loaded from the assigned database.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not connect to mydocumentsmanager.");
    } finally {
      setLoading(false);
    }
  }

  async function mutate(mutation: DocumentModuleMutation) {
    if (!profileId || !passphrase) throw new Error("Unlock the mydocumentsmanager profile before saving.");
    try {
      const updated = await mutateSavedProfileDocumentModules(profileId, passphrase, mutation);
      setData(updated);
      onDataChange?.(updated);
      setError("");
      setNotice("");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The document database update failed.";
      setError(message);
      throw caught;
    }
  }

  function lock() {
    const cleared = clearDocumentModulesSessionPassphrase();
    setProfiles([]);
    setProfileId("");
    setPassphrase("");
    setData(null);
    onDataChange?.(null);
    setError(cleared ? "" : "The remembered passphrase could not be cleared. Close this browser tab to remove it.");
    setNotice("");
  }

  if (data) {
    return <div className="document-modules-profile">
      <div className="document-modules-profile-bar">
        <span><Database size={14} /> Connected to {profiles.find((profile) => profile.id === profileId)?.name ?? "mydocumentsmanager"}</span>
        <Button type="button" size="sm" variant="ghost" onClick={lock}><LockKeyhole size={13} /> Lock database</Button>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {children({ data, mutate, uploadFile, createFileUrl, deleteFile, loadStorageUsage })}
    </div>;
  }

  return <Card className="document-modules-connect">
    <div className="card-head"><div><h2 className="section-title">Connect document database</h2><p className="section-description">Unlock the saved profile assigned to Documents, Personal Documents, and Account credentials. Their uploaded files use that profile's private Storage bucket.</p></div><Database size={16} /></div>
    {vaultLoading || loading ? <p className="section-description">{vaultLoading ? "Loading saved database profile..." : "Connecting to mydocumentsmanager..."}</p> : <form className="connector-form" onSubmit={(event) => void unlock(event)}>
      <Field className="full" label="Database connection vault passphrase"><Input type="password" autoComplete="current-password" maxLength={256} required value={passphrase} onChange={(event) => setPassphrase(event.target.value)} /></Field>
      <div className="full connector-actions"><Button type="submit" disabled={!vault || loading}>{loading ? "Connecting..." : "Unlock document database"}</Button></div>
    </form>}
    {error && <div className="alert alert-error" style={{ marginTop: 12 }} role="alert">{error}</div>}
    {notice && <div className="alert alert-success" style={{ marginTop: 12 }} role="status">{notice}</div>}
    {!vaultLoading && !vault && !error && <p className="section-description">Save a database connection profile in Database connections before opening these modules.</p>}
  </Card>;
}
