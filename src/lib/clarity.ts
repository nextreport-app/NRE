import { ANALYTICS_PUBLIC_PATHS, analyticsPageLocation } from "./analytics";

export const CLARITY_PROJECT_ID = "zeg3y17w2d";
export const CLARITY_SCRIPT_ID = "nre-microsoft-clarity";
/** Queue only: no vendor request or recording before the saved consent is read. */
export const CLARITY_BOOT_SCRIPT = 'window.clarity=window.clarity||function(){(window.clarity.q=window.clarity.q||[]).push(arguments);};';
type Clarity = ((method: string, ...args: unknown[]) => void) & { q?: unknown[]; v?: string };
type ClarityWindow = Window & { clarity?: Clarity };
let enabled = false;
let entryUrl: URL | null = null;
let documentRetired = false;

/** Clarity observes its own URL, so do not expose private paths, arbitrary
 * query values or fragments that the existing analytics policy excludes. */
export function clarityUrlAllowed(url: URL): boolean {
  if (!ANALYTICS_PUBLIC_PATHS.has(url.pathname) || url.hash) return false;
  const safe = new URL(analyticsPageLocation(url.origin, url.pathname, url.search)!);
  return [...url.searchParams].every(([key, value]) => safe.searchParams.getAll(key).includes(value));
}
export function clarityDocumentAllowed(entry: URL, current: URL, referrer: string): boolean {
  if (!clarityUrlAllowed(entry) || !clarityUrlAllowed(current)) return false;
  if (!referrer) return true;
  try {
    const from = new URL(referrer);
    return from.origin === current.origin ? clarityUrlAllowed(from) : !from.search && !from.hash;
  } catch { return false; }
}
function clearClarityCookies() {
  // Only Clarity's first-party cookies, never authentication or preferences.
  const host = window.location.hostname.split(".");
  const domains = ["", ...host.map((_, index) => `;domain=${host.slice(index).join(".")}`)];
  for (const name of ["_clck", "_clsk"]) for (const domain of domains) document.cookie = `${name}=;Max-Age=0;path=/${domain};SameSite=Lax`;
}
function afterClarityScriptLoad() {
  if (enabled) return;
  const win = window as ClarityWindow;
  // An inactive SDK queues commands; do not queue another stop that could
  // cancel a future explicit start after consent is granted again.
  if (win.clarity?.v) win.clarity("stop");
  clearClarityCookies();
}
function maskForms(root: ParentNode = document) {
  root.querySelectorAll("form,input,textarea,[contenteditable]").forEach(node => node.setAttribute("data-clarity-mask", "true"));
}
export function setClarityAllowed(allowed: boolean) {
  const win = window as ClarityWindow;
  const current = new URL(window.location.href);
  entryUrl ??= current;
  allowed = allowed && !documentRetired && clarityDocumentAllowed(entryUrl, current, document.referrer);
  const script = document.getElementById(CLARITY_SCRIPT_ID);
  if (!allowed) {
    if (script && enabled) {
      win.clarity?.("stop");
      // Also handle consent/navigation changes while the SDK is still loading.
      if (win.clarity?.q) win.clarity.q = [["stop"]];
    }
    if (/(?:^|;\s*)_cl(?:ck|sk)=/.test(document.cookie)) clearClarityCookies();
    enabled = false;
    return;
  }
  maskForms();
  if (!win.clarity) {
    const queue: Clarity = (method, ...args) => { (queue.q ??= []).push([method, ...args]); };
    win.clarity = queue;
  }
  if (script && !enabled) win.clarity("start");
  if (!enabled) win.clarity("consentv2", { analytics_Storage: "granted", ad_Storage: "denied" });
  enabled = true;
  if (script) return;
  const tag = document.createElement("script");
  tag.id = CLARITY_SCRIPT_ID;
  tag.type = "text/javascript";
  tag.async = true;
  tag.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
  tag.addEventListener("load", afterClarityScriptLoad, { once: true });
  document.head.appendChild(tag);
}

/** Stop before client-side route/history changes, not after private DOM has
 * rendered. The layout effect is a second check for route/consent changes. */
export function installClarityRouteBoundary() {
  let installed = true;
  const beforeUrl = (value: string | URL | null | undefined) => {
    if (installed && value != null && !clarityUrlAllowed(new URL(String(value), window.location.href))) {
      documentRetired = true;
      setClarityAllowed(false);
    }
  };
  const click = (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin === window.location.origin) {
      beforeUrl(url);
      if (!ANALYTICS_PUBLIC_PATHS.has(url.pathname) && document.getElementById(CLARITY_SCRIPT_ID)) {
        // A fresh document prevents an in-flight recording SDK from starting
        // against a private SPA screen after a marketing-page navigation.
        event.preventDefault(); event.stopImmediatePropagation();
        window.location.assign(url.href);
      }
    }
  };
  const historyChange = () => beforeUrl(window.location.href);
  const push = window.history.pushState, replace = window.history.replaceState;
  const wrappedPush: History["pushState"] = function (this: History, ...args) { beforeUrl(args[2]); return push.apply(this, args); };
  const wrappedReplace: History["replaceState"] = function (this: History, ...args) { beforeUrl(args[2]); return replace.apply(this, args); };
  window.history.pushState = wrappedPush; window.history.replaceState = wrappedReplace;
  const forms = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue;
      if (node instanceof HTMLScriptElement && node.src) {
        const host = new URL(node.src, window.location.href).hostname;
        if (host === "clarity.ms" || host.endsWith(".clarity.ms")) node.addEventListener("load", afterClarityScriptLoad, { once: true });
      }
      if (!enabled) continue;
      if (node.matches("form,input,textarea,[contenteditable]")) node.setAttribute("data-clarity-mask", "true");
      maskForms(node);
    }
  });
  forms.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("click", click, true);
  window.addEventListener("popstate", historyChange, true);
  window.addEventListener("hashchange", historyChange, true);
  return () => {
    installed = false;
    forms.disconnect();
    document.removeEventListener("click", click, true);
    window.removeEventListener("popstate", historyChange, true);
    window.removeEventListener("hashchange", historyChange, true);
    if (window.history.pushState === wrappedPush) window.history.pushState = push;
    if (window.history.replaceState === wrappedReplace) window.history.replaceState = replace;
    setClarityAllowed(false);
  };
}
