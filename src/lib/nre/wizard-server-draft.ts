import "server-only";

import type { WizardDraftSnapshot } from "@/lib/nre/wizard-draft";
import { isWizardServerDraftExpired, parseWizardDraftSnapshot } from "@/lib/nre/wizard-draft";
import {
  deleteWizardDraftBlob,
  readWizardDraftBlob,
  saveWizardDraftBlob,
} from "@/lib/storage";

export { isWizardServerDraftExpired, parseWizardDraftSnapshot, WIZARD_SERVER_DRAFT_TTL_MS } from "@/lib/nre/wizard-draft";

export async function loadWizardServerDraft(
  userId: string,
  clientId: string,
): Promise<WizardDraftSnapshot | null> {
  const raw = await readWizardDraftBlob(userId, clientId);
  if (!raw) return null;
  const draft = parseWizardDraftSnapshot(raw);
  if (!draft || isWizardServerDraftExpired(draft)) {
    await deleteWizardDraftBlob(userId, clientId).catch(() => undefined);
    return null;
  }
  return draft;
}

export async function saveWizardServerDraft(
  userId: string,
  clientId: string,
  draft: WizardDraftSnapshot,
): Promise<void> {
  await saveWizardDraftBlob(userId, clientId, JSON.stringify(draft));
}

export async function clearWizardServerDraft(userId: string, clientId: string): Promise<void> {
  await deleteWizardDraftBlob(userId, clientId);
}
