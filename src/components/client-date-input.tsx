"use client";

import { useState } from "react";
import { WizardDatePicker } from "./report-upload-wizard/ui/wizard-date-picker";

/** Region-aware display with the unchanged ISO value submitted by GET forms. */
export function ClientDateInput({ name, label, defaultValue = "", currency }: { name: string; label: string; defaultValue?: string; currency: string }) {
  const [value, setValue] = useState(defaultValue);
  return <div className="w-full sm:w-44">
    <input type="hidden" name={name} value={value} />
    <WizardDatePicker label={label} value={value} currency={currency} onChange={setValue} />
    {value && <button type="button" className="mt-1 text-xs text-dash-ink-secondary hover:text-dash-ink" onClick={() => setValue("")}>Clear {label.toLowerCase()}</button>}
  </div>;
}
