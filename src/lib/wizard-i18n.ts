import type { SiteLocaleId } from "./site-theme";
import type { Platform } from "./nre/google-columns";

type Step = 1 | 2 | 3 | 4;

const EN = {
  stepImport: "Import",
  stepCampaigns: "Campaigns",
  stepMetrics: "Metrics",
  stepGenerate: "Generate",
  heading1Meta: "Add your ad data",
  heading1Google: "Add your Google Ads data",
  heading2Meta: "Select campaigns & objectives",
  heading2Google: "Select campaigns, ad groups & objectives",
  heading3: "Review metrics",
  heading4: "Generate report",
  subtitle1: "Pick a report type, follow Download instructions for that type, then upload CSV.",
  subtitle2: "Choose campaigns and confirm each primary result objective.",
  subtitle3: "Metric chips are pre-selected from your CSV — tweak only if needed.",
  subtitle4: "Confirm dates and preview, then generate your deck.",
};

type WizardStrings = typeof EN;

const ES: Partial<WizardStrings> = {
  stepImport: "Importar",
  stepCampaigns: "Campañas",
  stepMetrics: "Métricas",
  stepGenerate: "Generar",
  heading1Meta: "Añade tus datos de anuncios",
  heading1Google: "Añade tus datos de Google Ads",
  heading2Meta: "Selecciona campañas y objetivos",
  heading2Google: "Selecciona campañas, grupos y objetivos",
  heading3: "Revisar métricas",
  heading4: "Generar informe",
  subtitle1: "Elige el tipo de informe, sigue las instrucciones de descarga y sube el CSV.",
  subtitle2: "Elige campañas y confirma el objetivo de resultados de cada una.",
  subtitle3: "Las métricas vienen preseleccionadas del CSV — ajusta solo si hace falta.",
  subtitle4: "Confirma fechas y vista previa, luego genera el deck.",
};

const LOCALE: Partial<Record<SiteLocaleId, Partial<WizardStrings>>> = {
  es: ES,
  fr: {
    stepImport: "Import",
    stepCampaigns: "Campagnes",
    stepMetrics: "Métriques",
    stepGenerate: "Générer",
    heading1Meta: "Ajoutez vos données pub",
    heading3: "Revoir les métriques",
    heading4: "Générer le rapport",
  },
  pt: {
    stepImport: "Importar",
    stepCampaigns: "Campanhas",
    stepMetrics: "Métricas",
    stepGenerate: "Gerar",
    heading1Meta: "Adicionar dados de anúncios",
    heading3: "Revisar métricas",
    heading4: "Gerar relatório",
  },
  de: {
    stepImport: "Import",
    stepCampaigns: "Kampagnen",
    stepMetrics: "Metriken",
    stepGenerate: "Generieren",
    heading1Meta: "Anzeigendaten hinzufügen",
    heading3: "Metriken prüfen",
    heading4: "Report erstellen",
  },
};

function strings(locale: SiteLocaleId): WizardStrings {
  return { ...EN, ...LOCALE[locale] };
}

export function wizardStepLabel(step: Step, locale: SiteLocaleId): string {
  const s = strings(locale);
  const map: Record<Step, string> = {
    1: s.stepImport,
    2: s.stepCampaigns,
    3: s.stepMetrics,
    4: s.stepGenerate,
  };
  return map[step];
}

export function wizardStepHeading(step: Step, platform: Platform, locale: SiteLocaleId): string {
  const s = strings(locale);
  if (step === 1) return platform === "GOOGLE" ? s.heading1Google : s.heading1Meta;
  if (step === 2)
    return platform === "TIKTOK" || platform === "GOOGLE" ? s.heading2Google : s.heading2Meta;
  if (step === 3) return s.heading3;
  return s.heading4;
}

export function wizardStepSubtitle(step: Step, _platform: Platform, locale: SiteLocaleId): string {
  const s = strings(locale);
  if (step === 4) return s.subtitle4;
  if (step === 3) return s.subtitle3;
  if (step === 2) return s.subtitle2;
  if (step === 1) return s.subtitle1;
  return "";
}
