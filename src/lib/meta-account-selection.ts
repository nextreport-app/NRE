import { normalizeMetaAccountId } from "./meta-client-account";
/** A remembered account is a convenience, never authorization or permission proof. */
export function resolveRememberedMetaAccount(accounts: readonly { id: string }[], savedId: unknown) {
  const remembered = typeof savedId === "string" && /^(act_)?\d+$/.test(savedId) ? savedId : null;
  if (remembered) {
    const account = accounts.find(account => normalizeMetaAccountId(account.id) === normalizeMetaAccountId(remembered));
    return account
      ? { id: account.id, unavailable: false }
      : { id: "", unavailable: true };
  }
  return { id: accounts.length === 1 ? accounts[0].id : "", unavailable: false };
}
