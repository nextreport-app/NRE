"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useWizardCopy } from "@/hooks/use-wizard-copy";
import { ChevronDownIcon } from "./platform-picker";

export type WizardClientOption = {
  id: string;
  accountName: string;
};

type WizardClientSwitcherProps = {
  clientId: string;
  clientName: string;
  clients: WizardClientOption[];
  onSwitchClient: (nextClientId: string) => void;
  onAllClientsClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
};

export function WizardClientSwitcher({
  clientId,
  clientName,
  clients,
  onSwitchClient,
  onAllClientsClick,
}: WizardClientSwitcherProps) {
  const copy = useWizardCopy();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const sortedClients = useMemo(() => {
    const list = [...clients];
    list.sort((a, b) => a.accountName.localeCompare(b.accountName, undefined, { sensitivity: "base" }));
    return list;
  }, [clients]);

  const showSearch = sortedClients.length > 6;

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedClients;
    return sortedClients.filter((c) => c.accountName.toLowerCase().includes(q));
  }, [query, sortedClients]);

  const canSwitch = sortedClients.length > 1;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    if (showSearch) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [open, showSearch]);

  function handlePick(nextId: string) {
    setOpen(false);
    if (nextId === clientId) return;
    onSwitchClient(nextId);
  }

  return (
    <div
      ref={rootRef}
      className="mb-3 rounded-lg border border-[#f6ad55]/50 border-l-4 border-l-[#f6ad55] bg-dash-card px-4 py-3.5 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-dash-ink-secondary">
          {copy.reportingFor}
        </span>

        <div className="relative min-w-0 flex-1">
          {canSwitch ? (
            <>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listboxId}
                onClick={() => setOpen((prev) => !prev)}
                className={`group flex max-w-full items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-[#f6ad55]/10 ${
                  open ? "bg-[#f6ad55]/12 ring-1 ring-[#f6ad55]/40" : ""
                }`}
              >
                <span
                  className="min-w-0 truncate text-[22px] font-bold leading-tight text-[#fbd38d] sm:text-[26px]"
                  title={clientName}
                >
                  {clientName}
                </span>
                <ChevronDownIcon
                  className={`h-5 w-5 shrink-0 text-[#fbd38d]/80 transition-transform duration-150 group-hover:text-[#fde68a] ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>

              {open ? (
                <div
                  id={listboxId}
                  role="listbox"
                  aria-label={copy.switchClientList}
                  className="absolute left-0 top-[calc(100%+0.35rem)] z-50 w-[min(100%,22rem)] overflow-hidden rounded-xl border border-dash-border bg-dash-card shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
                >
                  {showSearch ? (
                    <div className="border-b border-dash-border/80 p-2.5">
                      <input
                        ref={searchRef}
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={copy.searchClients}
                        aria-label={copy.searchClients}
                        className="w-full rounded-lg border border-dash-border bg-dash-inset px-3 py-2 text-[14px] text-dash-ink placeholder:text-dash-ink-secondary focus:border-[#f6ad55]/60 focus:outline-none focus:ring-1 focus:ring-[#f6ad55]/35"
                      />
                    </div>
                  ) : null}

                  <ul className="max-h-[min(16rem,50vh)] overflow-y-auto py-1">
                    {filteredClients.length === 0 ? (
                      <li className="px-3 py-2.5 text-[13px] text-dash-ink-secondary">{copy.noMatchingClients}</li>
                    ) : (
                      filteredClients.map((client) => {
                        const selected = client.id === clientId;
                        return (
                          <li key={client.id} role="none">
                            <button
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() => handlePick(client.id)}
                              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[14px] transition-colors ${
                                selected
                                  ? "bg-[#f6ad55]/15 font-semibold text-[#fde68a]"
                                  : "text-dash-ink hover:bg-dash-secondary"
                              }`}
                            >
                              <span className="min-w-0 flex-1 truncate" title={client.accountName}>
                                {client.accountName}
                              </span>
                              {selected ? (
                                <span className="shrink-0 text-[12px] font-medium uppercase tracking-wide text-[#f6ad55]">
                                  {copy.currentClientBadge}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>

                  <div className="border-t border-dash-border/80 px-3 py-2">
                    <Link
                      href="/clients"
                      onClick={(event) => {
                        setOpen(false);
                        onAllClientsClick?.(event);
                      }}
                      className="inline-flex text-[13px] font-semibold text-[#7dd3fc] underline decoration-[#7dd3fc]/60 underline-offset-[3px] hover:text-[#bae6fd] hover:decoration-[#bae6fd]"
                    >
                      {copy.allClients}
                    </Link>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <span
              className="block min-w-0 truncate text-[22px] font-bold leading-tight text-[#fbd38d] sm:text-[26px]"
              title={clientName}
            >
              {clientName}
            </span>
          )}
        </div>

        {canSwitch ? (
          <>
            <Link
              href="/clients"
              onClick={(event) => onAllClientsClick?.(event)}
              className="hidden shrink-0 text-[14px] font-semibold text-[#7dd3fc] underline decoration-[#7dd3fc]/60 underline-offset-[3px] hover:text-[#bae6fd] hover:decoration-[#bae6fd] sm:inline-flex"
            >
              {copy.allClients}
            </Link>
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="shrink-0 text-[14px] font-semibold text-[#7dd3fc] underline decoration-[#7dd3fc]/60 underline-offset-[3px] hover:text-[#bae6fd] hover:decoration-[#bae6fd] sm:hidden"
            >
              {copy.switchClient}
            </button>
          </>
        ) : (
          <Link
            href="/clients"
            onClick={onAllClientsClick}
            className="shrink-0 text-[14px] font-semibold text-[#7dd3fc] underline decoration-[#7dd3fc]/60 underline-offset-[3px] hover:text-[#bae6fd] hover:decoration-[#bae6fd]"
          >
            {copy.changeClient}
          </Link>
        )}
      </div>

      {canSwitch ? (
        <p className="mt-1 hidden text-[12px] text-dash-ink-secondary sm:block">{copy.switchClientHint}</p>
      ) : null}
    </div>
  );
}
