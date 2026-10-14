/** Hash target on the client detail page — monthly ad budget field in Client settings. */
export const CLIENT_MONTHLY_BUDGET_HASH = "monthly-budget";

const WIZARD_RETURN_PATH = /^\/clients\/[^/]+\/reports\/new(?:\?.*)?$/;

/** Safe in-app return URL after editing client settings from the report wizard. */
export function sanitizeWizardReturnTo(returnTo: string | null | undefined, clientId: string): string | null {
  if (!returnTo || typeof returnTo !== "string") return null;
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return null;
  if (!returnTo.includes(`/clients/${clientId}/`)) return null;
  if (!WIZARD_RETURN_PATH.test(returnTo.split("#")[0] ?? "")) return null;
  return returnTo.split("#")[0] ?? null;
}

export function clientMonthlyBudgetSettingsHref(
  clientId: string,
  options?: { returnToWizard?: boolean },
): string {
  const base = `/clients/${clientId}`;
  if (options?.returnToWizard) {
    const returnTo = encodeURIComponent(`${base}/reports/new`);
    return `${base}?returnTo=${returnTo}#${CLIENT_MONTHLY_BUDGET_HASH}`;
  }
  return `${base}#${CLIENT_MONTHLY_BUDGET_HASH}`;
}
