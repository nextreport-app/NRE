/** A remembered account is a convenience, never authorization or permission proof. */
export function resolveRememberedMetaAccount(accounts: readonly { id: string }[], savedId: unknown) {
  const remembered = typeof savedId === "string" && /^(act_)?\d+$/.test(savedId) ? savedId : null;
  if (remembered) {
    return accounts.some(account => account.id === remembered)
      ? { id: remembered, unavailable: false }
      : { id: "", unavailable: true };
  }
  return { id: accounts.length === 1 ? accounts[0].id : "", unavailable: false };
}
