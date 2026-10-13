const STORAGE_KEY = "nre.wizard.seenImportDownloadInstructions";

export function hasSeenImportDownloadInstructions(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** After the user has seen Import once, download instructions start collapsed. */
export function markImportDownloadInstructionsSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
}
