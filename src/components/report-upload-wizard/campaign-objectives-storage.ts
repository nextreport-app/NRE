const storageKey = (clientId: string) => `nre.campaignObjectivesUiSeen.${clientId}`;

/** False until the user has completed step 2 once for this client — then objectives stay collapsed until expanded. */
export function hasSeenCampaignObjectivesUi(clientId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(storageKey(clientId)) === "1";
  } catch {
    return false;
  }
}

export function markCampaignObjectivesUiSeen(clientId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(clientId), "1");
  } catch {
    /* ignore quota / private mode */
  }
}
