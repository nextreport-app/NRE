import type { SiteLocaleId } from "./site-theme";
import type { Platform } from "./nre/google-columns";
import type { LaunchEnabledReportType } from "./meta-launch-scope";
import {
  WIZARD_REPORT_TYPE_COPY,
  type WizardReportTypeCopy,
} from "./nre/wizard-report-type-copy";
import type { ReportTypeValue } from "@/components/report-upload-wizard/types";

type Step = 1 | 2 | 3 | 4;

const EN_UI = {
  reportingFor: "Reporting for",
  changeClient: "Change client →",
  csvMismatchTitle: (count: number) =>
    count === 1
      ? "Deck preview differs from your CSV on 1 total"
      : `Deck preview differs from your CSV on ${count} totals`,
  csvMismatchBody:
    "You can still generate and fix mismatches in the deck. Open a support ticket if this keeps happening for the same setup.",
  csvVerifiedTitle: "Verified against your CSV",
  csvVerifiedDetail: (scopesLabel: string) =>
    `Spend, results, and cost per result match your CSV for ${scopesLabel}.`,
  generateForInternalReview: "Generate for internal review",
  confirmedPeriodWeeklyLead: "Your weekly report will cover:",
  confirmedPeriodWeeklyWeekSuffix: "week",
  confirmedPeriodWeeklyMtdPrefix: "MTD from",
  confirmedPeriodWeeklyChart: "Last 30 days in a visual chart slide",
  weeklyReportScopeLine: "Includes last week, MTD, and a last-30-day chart.",
  reportingWeekLabel: "Reporting week",
  openLiveReportRecommended: "Open live report (recommended)",
  csvMismatchShareWarningTitle: "CSV check was not green when you generated",
  csvMismatchShareWarningBody:
    "Deck totals may not match your CSV export. Review the report yourself before sharing with the client.",
  whatReportBuilding: "What report are you building?",
  reportTypeHint:
    "Each type needs a specific CSV date range (always day-wise from Ads Reporting). Hover a card for details.",
  recommended: "Recommended",
  whatYouGet: "What you get",
  requiredCsv: "Required CSV",
  back: "Back",
  continueToCampaigns: "Continue to campaigns",
  continueToMetrics: "Continue to metrics",
  continueToGenerate: "Continue to generate",
  generateReport: "Generate Report",
  loading: "Loading…",
  campaignObjectives: "Campaign objectives",
  objectivesIntro: "Detected from your CSV. Change a dropdown only if something looks wrong, then continue.",
  reviewMetrics: "Review metrics",
  reviewMetricsHint: "Metric chips are pre-selected from your CSV — tweak only if needed.",
  includedMetrics: "Included metrics",
  addFromCsv: "Add from your CSV",
  addFromCsvHint: "Columns in this file that are not already chips.",
  detectedChangeIfWrong: "Detected — change if wrong",
  csvResultTypeHeading: "CSV Result type",
  csvResultTypeMatch: "Matches detected objective",
  csvResultTypeMismatch: (csvLabel: string, detectedLabel: string) =>
    `CSV maps to ${csvLabel} — engine picked ${detectedLabel}. Adjust the dropdown if needed.`,
  detectedConfirmLead: "Detected — confirm lead type if wrong",
  previouslyConfirmed: "Previously confirmed",
  confirmationRequired: "Confirmation required",
  stepOf: (step: number, total: number, label: string) => `Step ${step} of ${total} · ${label}`,
  generateHeadingPrefix: "Generate:",
  moreReportTypes: "More report types",
  happyPathBannerTitle: "Using your saved setup for this client",
  happyPathBannerBody:
    "Campaigns, objectives, and metrics match your last successful report. Confirm dates below, or review campaigns or metrics if anything changed.",
  happyPathReviewCampaigns: "Review campaigns",
  happyPathReviewMetrics: "Review metrics",
};

const EN_STEPS = {
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
  subtitle1: "Confirm your ad platform, pick a report type, follow CSV Download instructions, then upload.",
  subtitle2: "Choose campaigns and confirm each primary result objective.",
  subtitle3: "Metric chips are pre-selected from your CSV — tweak only if needed.",
  subtitle4: "Confirm dates and preview, then generate your deck.",
};

export type WizardCopy = typeof EN_UI & typeof EN_STEPS;

const LOCALE_UI: Partial<Record<SiteLocaleId, Partial<typeof EN_UI>>> = {
  es: {
    reportingFor: "Informe para",
    changeClient: "Cambiar cliente →",
    whatReportBuilding: "¿Qué informe estás creando?",
    reportTypeHint:
      "Cada tipo necesita un rango de fechas CSV concreto (siempre por día desde Ads Reporting). Pasa el cursor sobre una tarjeta para ver detalles.",
    recommended: "Recomendado",
    whatYouGet: "Qué incluye",
    requiredCsv: "CSV requerido",
    back: "Atrás",
    continueToCampaigns: "Continuar a campañas",
    continueToMetrics: "Continuar a métricas",
    continueToGenerate: "Continuar a generar",
    generateReport: "Generar informe",
    loading: "Cargando…",
    campaignObjectives: "Objetivos de campaña",
    objectivesIntro:
      "Detectado desde tu CSV. Cambia un desplegable solo si algo no cuadra, luego continúa.",
    reviewMetrics: "Revisar métricas",
    reviewMetricsHint: "Las métricas vienen preseleccionadas del CSV — ajusta solo si hace falta.",
    includedMetrics: "Métricas incluidas",
    addFromCsv: "Añadir desde tu CSV",
    addFromCsvHint: "Columnas en este archivo que aún no son chips.",
    detectedChangeIfWrong: "Detectado — cámbialo si no es correcto",
    detectedConfirmLead: "Detectado — confirma el tipo de lead si no es correcto",
    previouslyConfirmed: "Confirmado antes",
    confirmationRequired: "Confirmación obligatoria",
    generateHeadingPrefix: "Generar:",
    moreReportTypes: "Más tipos de informe",
    weeklyReportScopeLine: "Incluye la semana, MTD y un gráfico de 30 días.",
    reportingWeekLabel: "Semana del informe",
    openLiveReportRecommended: "Abrir informe en vivo (recomendado)",
  },
  fr: {
    reportingFor: "Rapport pour",
    changeClient: "Changer de client →",
    whatReportBuilding: "Quel rapport construisez-vous ?",
    recommended: "Recommandé",
    whatYouGet: "Contenu",
    requiredCsv: "CSV requis",
    back: "Retour",
    continueToMetrics: "Continuer vers les métriques",
    continueToGenerate: "Continuer vers la génération",
    generateReport: "Générer le rapport",
    campaignObjectives: "Objectifs de campagne",
    reviewMetrics: "Revoir les métriques",
    includedMetrics: "Métriques incluses",
    detectedChangeIfWrong: "Détecté — modifiez si incorrect",
    generateHeadingPrefix: "Générer :",
  },
  pt: {
    reportingFor: "Relatório para",
    changeClient: "Trocar cliente →",
    whatReportBuilding: "Que relatório você está criando?",
    recommended: "Recomendado",
    whatYouGet: "O que inclui",
    requiredCsv: "CSV necessário",
    back: "Voltar",
    continueToMetrics: "Continuar para métricas",
    continueToGenerate: "Continuar para gerar",
    generateReport: "Gerar relatório",
    campaignObjectives: "Objetivos da campanha",
    reviewMetrics: "Revisar métricas",
    includedMetrics: "Métricas incluídas",
    detectedChangeIfWrong: "Detectado — altere se estiver errado",
    generateHeadingPrefix: "Gerar:",
  },
  de: {
    reportingFor: "Reporting für",
    changeClient: "Kunde wechseln →",
    whatReportBuilding: "Welchen Report erstellen Sie?",
    recommended: "Empfohlen",
    whatYouGet: "Inhalt",
    requiredCsv: "Erforderliches CSV",
    back: "Zurück",
    continueToMetrics: "Weiter zu Metriken",
    continueToGenerate: "Weiter zur Generierung",
    generateReport: "Report erstellen",
    campaignObjectives: "Kampagnenziele",
    reviewMetrics: "Metriken prüfen",
    includedMetrics: "Enthaltene Metriken",
    detectedChangeIfWrong: "Erkannt — bei Bedarf ändern",
    generateHeadingPrefix: "Erstellen:",
  },
};

const LOCALE_STEPS: Partial<Record<SiteLocaleId, Partial<typeof EN_STEPS>>> = {
  es: {
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
  },
  fr: {
    stepImport: "Import",
    stepCampaigns: "Campagnes",
    stepMetrics: "Métriques",
    stepGenerate: "Générer",
    heading1Meta: "Ajoutez vos données pub",
    heading2Meta: "Sélectionnez campagnes et objectifs",
    heading3: "Revoir les métriques",
    heading4: "Générer le rapport",
    subtitle2: "Choisissez les campagnes et confirmez l'objectif de chacune.",
    subtitle3: "Les métriques sont préselectionnées depuis votre CSV.",
    subtitle4: "Confirmez les dates et l'aperçu, puis générez.",
  },
  pt: {
    stepImport: "Importar",
    stepCampaigns: "Campanhas",
    stepMetrics: "Métricas",
    stepGenerate: "Gerar",
    heading1Meta: "Adicionar dados de anúncios",
    heading2Meta: "Selecionar campanhas e objetivos",
    heading3: "Revisar métricas",
    heading4: "Gerar relatório",
    subtitle2: "Escolha campanhas e confirme o objetivo de cada uma.",
    subtitle3: "As métricas vêm pré-selecionadas do CSV.",
    subtitle4: "Confirme datas e pré-visualização, depois gere.",
  },
  de: {
    stepImport: "Import",
    stepCampaigns: "Kampagnen",
    stepMetrics: "Metriken",
    stepGenerate: "Generieren",
    heading1Meta: "Anzeigendaten hinzufügen",
    heading2Meta: "Kampagnen und Ziele wählen",
    heading3: "Metriken prüfen",
    heading4: "Report erstellen",
    subtitle2: "Kampagnen wählen und Ziel pro Kampagne bestätigen.",
    subtitle3: "Metriken sind aus Ihrer CSV vorausgewählt.",
    subtitle4: "Daten und Vorschau bestätigen, dann generieren.",
  },
};

/** Report-type card copy — Spanish full set; others fall back to English fields. */
const REPORT_TYPE_ES: Partial<Record<LaunchEnabledReportType, Partial<WizardReportTypeCopy>>> = {
  WEEKLY: {
    cardHeading: "Informe semanal",
    cardOneLiner: "Semana, MTD y gráfico de 30 días.",
    pickerLabel: "Informe semanal",
  },
  MONTHLY: {
    cardHeading: "Informe mensual",
    cardOneLiner: "Informe del mes en curso.",
    pickerLabel: "Informe mensual",
  },
  DAILY: {
    cardHeading: "Informe de ayer",
    cardOneLiner: "Solo ayer.",
    pickerLabel: "Informe de ayer",
  },
  COMPARISON: {
    cardHeading: "Informe comparativo",
    cardOneLiner: "Periodo A vs B.",
    pickerLabel: "Informe comparativo",
  },
  HISTORICAL: {
    cardHeading: "Informe histórico multi-mes",
    cardOneLiner: "Varios meses.",
    pickerLabel: "Informe histórico",
  },
  DAY_BREAKDOWN: {
    cardHeading: "Informe día a día",
    cardOneLiner: "Una fila por día.",
    pickerLabel: "Informe día a día",
  },
};

const REPORT_TYPE_LOCALE: Partial<
  Record<SiteLocaleId, Partial<Record<LaunchEnabledReportType, Partial<WizardReportTypeCopy>>>>
> = {
  es: REPORT_TYPE_ES,
};

export function wizardCopy(locale: SiteLocaleId): WizardCopy {
  return {
    ...EN_UI,
    ...EN_STEPS,
    ...LOCALE_UI[locale],
    ...LOCALE_STEPS[locale],
  };
}

function stepStrings(locale: SiteLocaleId): typeof EN_STEPS {
  return { ...EN_STEPS, ...LOCALE_STEPS[locale] };
}

export function wizardStepLabel(step: Step, locale: SiteLocaleId): string {
  const s = stepStrings(locale);
  const map: Record<Step, string> = {
    1: s.stepImport,
    2: s.stepCampaigns,
    3: s.stepMetrics,
    4: s.stepGenerate,
  };
  return map[step];
}

export function wizardStepHeading(step: Step, platform: Platform, locale: SiteLocaleId): string {
  const s = stepStrings(locale);
  if (step === 1) return platform === "GOOGLE" ? s.heading1Google : s.heading1Meta;
  if (step === 2)
    return platform === "TIKTOK" || platform === "GOOGLE" ? s.heading2Google : s.heading2Meta;
  if (step === 3) return s.heading3;
  return s.heading4;
}

export function wizardStepSubtitle(step: Step, _platform: Platform, locale: SiteLocaleId): string {
  const s = stepStrings(locale);
  if (step === 4) return s.subtitle4;
  if (step === 3) return s.subtitle3;
  if (step === 2) return s.subtitle2;
  if (step === 1) return s.subtitle1;
  return "";
}

export function wizardReportTypeCopyForLocale(
  locale: SiteLocaleId,
  reportType: ReportTypeValue,
): WizardReportTypeCopy | null {
  if (!(reportType in WIZARD_REPORT_TYPE_COPY)) return null;
  const base = WIZARD_REPORT_TYPE_COPY[reportType as LaunchEnabledReportType];
  const patch = REPORT_TYPE_LOCALE[locale]?.[reportType as LaunchEnabledReportType];
  return patch ? { ...base, ...patch } : base;
}

export function wizardObjectiveBadgeText(
  locale: SiteLocaleId,
  tier: "cached" | "high" | "medium" | "low" | "verify",
): { text: string } {
  const c = wizardCopy(locale);
  if (tier === "cached") return { text: c.previouslyConfirmed };
  if (tier === "high" || tier === "medium") return { text: c.detectedChangeIfWrong };
  if (tier === "low") return { text: c.detectedConfirmLead };
  return { text: c.confirmationRequired };
}
