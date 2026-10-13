import {
  mergeWizardGenerateBaselines,
  wizardGenerateBaselineSchema,
  type WizardGenerateBaseline,
} from "@/lib/nre/wizard-generate-baseline";
import { readClientWizardPreferences, saveClientWizardPreferences } from "./client-wizard-preferences";

export function readLocalGenerateBaseline(clientId: string): WizardGenerateBaseline | null {
  return readClientWizardPreferences(clientId)?.generateBaseline ?? null;
}

export function writeLocalGenerateBaseline(clientId: string, baseline: WizardGenerateBaseline): void {
  saveClientWizardPreferences(clientId, { generateBaseline: baseline });
}

/** Load server baseline, merge with local by savedAt, persist the winner to both stores. */
export async function hydrateGenerateBaseline(clientId: string): Promise<WizardGenerateBaseline | null> {
  const local = readLocalGenerateBaseline(clientId);
  let server: WizardGenerateBaseline | null = null;
  try {
    const res = await fetch(`/api/clients/${clientId}/wizard-generate-baseline`);
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json?.baseline && typeof json.baseline === "object") {
        const parsed = wizardGenerateBaselineSchema.safeParse(json.baseline);
        if (parsed.success) server = parsed.data;
      }
    }
  } catch {
    /* offline */
  }

  const merged = mergeWizardGenerateBaselines(local, server);
  if (!merged) return null;

  writeLocalGenerateBaseline(clientId, merged);
  if (!server || Date.parse(merged.savedAt) > Date.parse(server.savedAt)) {
    void persistGenerateBaselineToServer(clientId, merged);
  }
  return merged;
}

export async function persistGenerateBaselineToServer(
  clientId: string,
  baseline: WizardGenerateBaseline,
): Promise<void> {
  writeLocalGenerateBaseline(clientId, baseline);
  try {
    await fetch(`/api/clients/${clientId}/wizard-generate-baseline`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseline }),
    });
  } catch {
    /* offline — local cache still updated */
  }
}

export function readGenerateBaselineForHappyPath(clientId: string): WizardGenerateBaseline | null {
  return readLocalGenerateBaseline(clientId);
}
