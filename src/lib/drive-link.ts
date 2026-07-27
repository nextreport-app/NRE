/**
 * Extracts a Google Drive folder id from a pasted "Get link" URL, or passes
 * through a bare folder id typed/pasted directly. Zero Node-specific
 * imports — safe to import from both server routes and "use client"
 * components (see report-upload-wizard.tsx's paste-a-link input), unlike
 * lib/google-drive.ts which pulls in node:crypto.
 *
 * Handles every share-link shape Drive's own UI produces:
 *   https://drive.google.com/drive/folders/1ABC123xyz
 *   https://drive.google.com/drive/folders/1ABC123xyz?usp=sharing
 *   https://drive.google.com/drive/u/0/folders/1ABC123xyz
 */
export function extractDriveFolderIdFromLink(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];

  // Not a recognizable link — accept a bare id typed/pasted directly. Real
  // Drive file/folder ids are alphanumeric (plus - and _) and always
  // reasonably long; this just filters out obvious non-ids (a stray word,
  // a URL that didn't match above) rather than trying to validate the id
  // precisely — an actually-wrong id still fails cleanly at upload time.
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;

  return null;
}
