"use client";

import { useEffect, useState } from "react";

export interface DriveFolder {
  id: string;
  name: string;
}

/**
 * Folder-tree browser backing the download screen's "Save to Google Drive"
 * button (report-upload-wizard.tsx) — fetches from /api/google-drive/folders
 * using the connected Drive account.
 *
 * Navigation model matches Drive's own "Move to folder" picker: clicking a
 * row in the list navigates INTO that folder (making it the new current
 * folder, its own children now shown); "Select This Folder" confirms
 * whichever folder is currently open, not one of its children. The
 * breadcrumb reflects the same thing — trailing arrow means "you are
 * inside here, browsing its contents."
 */
export function GoogleDriveFolderPicker({
  onSelect,
  onCancel,
  initialFolder,
}: {
  onSelect: (folder: DriveFolder) => void;
  onCancel: () => void;
  /** The client's last-used Drive folder (Client.lastDriveFolderId/Name), if any — pre-navigates the picker into it as a convenience so confirming a repeat save is a single click. The user can still navigate elsewhere. */
  initialFolder?: DriveFolder | null;
}) {
  const [path, setPath] = useState<DriveFolder[]>(
    initialFolder ? [{ id: "root", name: "My Drive" }, initialFolder] : [{ id: "root", name: "My Drive" }],
  );
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const current = path[path.length - 1];

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/google-drive/folders?parentId=${encodeURIComponent(current.id)}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setError(data.error || "Failed to load folders.");
          setFolders([]);
        } else {
          setFolders(data.folders || []);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load folders.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [current.id]);

  function navigateInto(folder: DriveFolder) {
    setLoading(true);
    setError(null);
    setPath((p) => [...p, folder]);
  }

  function navigateToBreadcrumb(index: number) {
    setLoading(true);
    setError(null);
    setPath((p) => p.slice(0, index + 1));
  }

  return (
    <div className="space-y-3 rounded-lg border border-navy-border bg-navy p-4">
      <div className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
        {path.map((segment, i) => (
          <span key={segment.id + i} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigateToBreadcrumb(i)}
              disabled={i === path.length - 1}
              className={i === path.length - 1 ? "text-white" : "text-accent hover:underline"}
            >
              {segment.name}
            </button>
            <span aria-hidden="true">→</span>
          </span>
        ))}
      </div>

      <div className="max-h-64 overflow-y-auto rounded-md border border-navy-border bg-navy-panel">
        {loading && <p className="p-3 text-xs text-ink-muted">Loading folders…</p>}
        {error && <p className="p-3 text-xs text-red-400">{error}</p>}
        {!loading && !error && folders.length === 0 && (
          <p className="p-3 text-xs text-ink-muted">No subfolders here.</p>
        )}
        {!loading && !error && folders.length > 0 && (
          <ul className="divide-y divide-navy-border">
            {folders.map((folder) => (
              <li key={folder.id}>
                <button
                  type="button"
                  onClick={() => navigateInto(folder)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-navy-border"
                >
                  <span aria-hidden="true">📁</span>
                  {folder.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-navy-border px-3 py-1.5 text-xs text-ink-secondary hover:bg-navy-border"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSelect(current)}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
        >
          Select This Folder
        </button>
      </div>
    </div>
  );
}
