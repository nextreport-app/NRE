/** Saved provider IDs take precedence over account-name hints. */
export function normalizeMetaAccountId(value: string | null | undefined): string | null {
  const id = value?.trim().replace(/^act_/i, "");
  return id && /^\d+$/.test(id) ? id : null;
}

function normalizedAccountName(value: string | null | undefined): string | null {
  let name = value?.normalize("NFKC").toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim() ?? "";
  // Only trim trailing legal/account labels. Do not accept substrings or
  // discard identifying words (e.g. Sherwood Tractor East versus West).
  const suffix = /\s+(?:incorporated|inc|llc|ltd|limited|corporation|corp|plc|llp|co|company|pvt|private|pte|pty|ad account|ads account)$/u;
  while (suffix.test(name)) name = name.replace(suffix, "");
  return name || null;
}

export function metaClientAccountStatus(
  linkedId: string | null | undefined,
  selectedId: string | null | undefined,
  names?: { clientName?: string | null; selectedName?: string | null },
) {
  const selected = normalizeMetaAccountId(selectedId);
  if (!selected) return "unselected";
  const linked = normalizeMetaAccountId(linkedId);
  if (linked) return linked === selected ? "matched" : "mismatch";
  const clientName = normalizedAccountName(names?.clientName);
  const selectedName = normalizedAccountName(names?.selectedName);
  // A name match avoids first-sync friction; the successful import still
  // saves the actual ID so subsequent checks never rely on names again.
  return clientName && selectedName && clientName === selectedName ? "matched" : "unlinked";
}
