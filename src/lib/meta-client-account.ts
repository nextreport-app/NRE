/** Only provider IDs establish a client/account mismatch; names are labels. */
export function normalizeMetaAccountId(value: string | null | undefined): string | null {
  const id = value?.trim().replace(/^act_/i, "");
  return id && /^\d+$/.test(id) ? id : null;
}

export function metaClientAccountStatus(
  linkedId: string | null | undefined,
  selectedId: string | null | undefined,
) {
  const selected = normalizeMetaAccountId(selectedId);
  if (!selected) return "unselected";
  const linked = normalizeMetaAccountId(linkedId);
  if (linked) return linked === selected ? "matched" : "mismatch";
  return "unlinked";
}
