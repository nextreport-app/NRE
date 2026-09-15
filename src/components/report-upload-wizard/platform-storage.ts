import type { WizardPlatformChoice } from "./types";
import { LAST_PLATFORM_STORAGE_KEY } from "./constants";

export function readStoredWizardPlatform(): WizardPlatformChoice | null {
  try {
    const stored = localStorage.getItem(LAST_PLATFORM_STORAGE_KEY);
    if (stored === "META" || stored === "GOOGLE" || stored === "TIKTOK" || stored === "GA4") return stored;
  } catch {
    /* private mode */
  }
  return null;
}

export function saveWizardPlatformChoice(choice: WizardPlatformChoice) {
  try {
    localStorage.setItem(LAST_PLATFORM_STORAGE_KEY, choice);
  } catch {
    /* private mode */
  }
}

export function readInitialPlatformPickerState(showTikTokOption: boolean): {
  wizardKind: "ads" | "website";
  selectedPlatformCard: "META" | "GOOGLE" | "TIKTOK" | null;
  platformPickerExpanded: boolean;
  hasSavedPlatformPreference: boolean;
} {
  const stored = typeof window === "undefined" ? null : readStoredWizardPlatform();
  if (stored === "GA4") {
    return {
      wizardKind: "website",
      selectedPlatformCard: null,
      platformPickerExpanded: false,
      hasSavedPlatformPreference: true,
    };
  }
  if (stored === "TIKTOK" && !showTikTokOption) {
    return {
      wizardKind: "ads",
      selectedPlatformCard: "META",
      platformPickerExpanded: true,
      hasSavedPlatformPreference: false,
    };
  }
  if (stored === "META" || stored === "GOOGLE" || stored === "TIKTOK") {
    return {
      wizardKind: "ads",
      selectedPlatformCard: stored,
      platformPickerExpanded: false,
      hasSavedPlatformPreference: true,
    };
  }
  return {
    wizardKind: "ads",
    selectedPlatformCard: "META",
    platformPickerExpanded: true,
    hasSavedPlatformPreference: false,
  };
}
