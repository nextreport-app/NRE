"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export interface SelectableAdAccount {
  id: string;
  name: string;
  accountId?: string;
}

function accountNumber(account: SelectableAdAccount): string {
  return account.accountId || account.id.replace(/^act_/, "");
}

function accountName(account: SelectableAdAccount): string {
  const name = account.name.trim();
  return !name || name === accountNumber(account) || name === account.id ? "Ad account" : name;
}

export function matchingAdAccounts(accounts: readonly SelectableAdAccount[], query: string): SelectableAdAccount[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return accounts.filter(account => {
    const text = `${account.name} ${account.id} ${accountNumber(account)}`.toLowerCase();
    return terms.every(term => text.includes(term));
  });
}

/** Local search over the permitted accounts already loaded by the wizard. */
export function MetaAdAccountPicker({ accounts, value, onChange, disabled = false }: {
  accounts: readonly SelectableAdAccount[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const prefix = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const matches = matchingAdAccounts(accounts, query);
  const selected = accounts.find(account => account.id === value);
  const active = matches.length ? Math.min(activeIndex, matches.length - 1) : -1;
  const optionId = (index: number) => `${prefix}-option-${index}`;
  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, close]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${prefix}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, prefix]);

  function choose(account: SelectableAdAccount) {
    if (disabled) return;
    onChange(account.id);
    close(true);
  }

  function navigate(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (active >= 0) choose(matches[active]);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !matches.length) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? matches.length - 1
      : event.key === "ArrowDown" ? (active + 1) % matches.length
        : (active - 1 + matches.length) % matches.length;
    setActiveIndex(next);
  }

  return <div ref={root} className="min-w-0" onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) close();
  }} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(true); }
  }}>
    <button ref={trigger} type="button" disabled={disabled} aria-haspopup="dialog" aria-expanded={open}
      aria-controls={`${prefix}-dialog`} aria-label={selected ? `Ad account: ${accountName(selected)} (${accountNumber(selected)})` : "Select an ad account"}
      onClick={() => {
        if (open) { close(); return; }
        setQuery("");
        setActiveIndex(Math.max(0, accounts.findIndex(account => account.id === value)));
        setOpen(true);
      }}
      className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-dash-border bg-dash-bg px-3 py-2.5 text-left text-sm text-dash-ink transition-colors hover:border-dash-accent/60 focus-visible:outline-2 focus-visible:outline-dash-accent disabled:cursor-not-allowed disabled:opacity-50">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink-secondary">
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4"><rect x="3" y="6" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M7 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 10h14M8 10v2h4v-2" stroke="currentColor" strokeWidth="1.5"/></svg>
      </span>
      <span className="min-w-0 flex-1">
        {selected ? <><span className="block truncate font-medium">{accountName(selected)}</span><span className="mt-0.5 block truncate text-xs text-dash-ink-secondary">ID: {accountNumber(selected)}</span></> : <><span className="block font-medium">Choose an ad account</span><span className="mt-0.5 block text-xs text-dash-ink-secondary">Search by name or account ID</span></>}
      </span>
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={`h-4 w-4 shrink-0 text-dash-ink-secondary transition-transform ${open ? "rotate-180" : ""}`}><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {open && <div id={`${prefix}-dialog`} role="dialog" aria-label="Choose ad account"
      className="mt-2 flex flex-col overflow-hidden rounded-xl border border-dash-border bg-dash-popover">
      <div className="border-b border-dash-border p-3">
        <div className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-bg px-3 focus-within:border-dash-accent focus-within:ring-1 focus-within:ring-dash-accent">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-dash-ink-secondary"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <input ref={search} disabled={disabled} role="combobox" type="search" autoComplete="off" value={query} placeholder="Search by account name or ID" aria-label="Search ad accounts"
            aria-autocomplete="list" aria-expanded="true" aria-controls={`${prefix}-list`} aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            onChange={event => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={navigate}
            className="min-h-9 min-w-0 flex-1 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-ink-muted" />
        </div>
        <p role="status" aria-live="polite" className="mt-2 text-xs text-dash-ink-secondary">{matches.length} {matches.length === 1 ? "account" : "accounts"}{query.trim() ? " found" : " available"}</p>
      </div>
      <div id={`${prefix}-list`} role="listbox" aria-label="Ad accounts" className="max-h-60 min-h-0 overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin]">
        {matches.map((account, index) => <button key={account.id} id={optionId(index)} type="button" role="option" tabIndex={-1} disabled={disabled} aria-selected={account.id === value}
          onPointerMove={() => setActiveIndex(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(account)}
          className={`flex min-h-14 w-full cursor-pointer text-left items-center gap-3 rounded-lg px-3 py-2 ${account.id === value ? "bg-dash-accent/10 ring-1 ring-inset ring-dash-accent/30" : index === active ? "bg-dash-card" : "hover:bg-dash-card"}`}>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-dash-ink">{accountName(account)}</span><span className="mt-0.5 block truncate text-xs text-dash-ink-secondary">ID: {accountNumber(account)}</span></span>
          {account.id === value && <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-dash-accent/15 text-xs text-dash-accent">✓</span>}
        </button>)}
      </div>
      {!matches.length && <p role="status" className="px-4 py-5 text-center text-sm text-dash-ink-secondary">No matching accounts. Try another name or account ID.</p>}
    </div>}
  </div>;
}
