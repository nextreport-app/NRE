/** Only an invalidation timestamp is shared across tabs; report data stays on the server. */
export function previousMonthNotificationKey(clientId: string): string {
  return `nextreport:previous-month:${clientId}`;
}
export function notifyPreviousMonthDataChanged(clientId: string): void {
  try { window.localStorage.setItem(previousMonthNotificationKey(clientId), `${Date.now()}:${Math.random()}`); }
  catch { /* Focus refresh still works when browser storage is unavailable. */ }
}
