/** Known scope limitation of the restored, non-blocking API lead-action path. */
export function MetaApiLeadScopeNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return <aside role="note" className="rounded-xl border border-amber-500/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
    <p className="font-semibold">API lead-count scope</p>
    <p className="mt-1">API form reports use grouped Meta lead counts. These can differ from Ads Manager&apos;s primary instant-form Results. Use Upload CSV when you need those exact primary Results.</p>
  </aside>;
}
