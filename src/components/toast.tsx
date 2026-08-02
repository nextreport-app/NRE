"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

interface ToastContextValue {
  showToast: (message: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

/** Dashboard-only toast notifications (form saves, deletes, ...) — mounted once in (dashboard)/layout.tsx so any dashboard page/component can call useToast(). Not used on the public site, which has no forms that need this. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={
              "pointer-events-auto rounded-md border px-4 py-3 text-[14px] font-medium shadow-lg " +
              (t.type === "success"
                ? "border-dash-success/30 bg-dash-card text-dash-success"
                : "border-dash-error/30 bg-dash-card text-dash-error")
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** No-op fallback (rather than throwing) for any component rendered outside ToastProvider — keeps this optional-enhancement, not a hard dependency. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  return ctx ?? { showToast: () => {} };
}
