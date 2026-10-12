import type { SiteLocaleId } from "./site-theme";
import type { OnboardingStepId } from "./onboarding";

export type DashboardCopy = {
  navHome: string;
  navClients: string;
  navAccount: string;
  navBilling: string;
  navSupport: string;
  navPricing: string;
  navCsvGuide: string;
  navSignOut: string;
  navSignOutTitle: string;
  trialEnds: (days: number) => string;
  trialSubscribeNow: string;
  trialEnded: string;
  trialSubscribeContinue: string;
  clientsTitle: string;
  clientsEmptySubtitle: string;
  clientsCountSubtitle: (count: number) => string;
  clientsNewClient: string;
  clientsPlaceholderDuringGuide: string;
  clientsSupportPrefix: string;
  clientsSupportOr: string;
  emptyAddFirstClient: string;
  emptyBody: string;
  emptyAddClientCta: string;
  helpCsvGuide: string;
  helpSampleReport: string;
  helpHowItWorks: string;
  onboardingAria: string;
  onboardingWelcome: string;
  onboardingTitle: string;
  onboardingLead: string;
  onboardingSkip: string;
  onboardingSkipping: string;
  onboardingDismissError: string;
  onboardingProgress: (completed: number, total: number) => string;
  onboardingOptional: string;
  onboardingStartHere: string;
  stepAddClientTitle: string;
  stepAddClientDesc: string;
  stepConnectTitle: string;
  stepConnectDesc: string;
  stepGenerateTitle: string;
  stepGenerateDesc: string;
};

const EN: DashboardCopy = {
  navHome: "Home",
  navClients: "My Clients",
  navAccount: "Account",
  navBilling: "Billing",
  navSupport: "Support",
  navPricing: "Pricing",
  navCsvGuide: "CSV Export Guide",
  navSignOut: "Sign out",
  navSignOutTitle: "Sign out of NextReport (you can sign in with a different Google account next)",
  trialEnds: (days) =>
    `Your free trial ends in ${days} day${days === 1 ? "" : "s"} —`,
  trialSubscribeNow: "Subscribe now",
  trialEnded: "Your free trial has ended —",
  trialSubscribeContinue: "Subscribe to continue",
  clientsTitle: "My Clients",
  clientsEmptySubtitle: "Your client workspaces will appear here.",
  clientsCountSubtitle: (count) =>
    `${count} client${count === 1 ? "" : "s"} · pick one to generate or manage`,
  clientsNewClient: "+ New Client",
  clientsPlaceholderDuringGuide: "Client workspaces you add in step 1 will be listed here.",
  clientsSupportPrefix: "Questions?",
  clientsSupportOr: "or",
  emptyAddFirstClient: "Add your first client",
  emptyBody:
    "One workspace per brand — set currency, timezone, and logo once. Then open New Report and upload your Meta CSV.",
  emptyAddClientCta: "+ Add client",
  helpCsvGuide: "CSV Export Guide",
  helpSampleReport: "Sample report",
  helpHowItWorks: "How it works",
  onboardingAria: "Getting started",
  onboardingWelcome: "Welcome",
  onboardingTitle: "Set up your first client report",
  onboardingLead:
    "Add a client workspace, upload a Meta day-wise CSV, and generate a branded deck — usually under 2 minutes after upload.",
  onboardingSkip: "Skip guide",
  onboardingSkipping: "Skipping…",
  onboardingDismissError: "Could not dismiss onboarding.",
  onboardingProgress: (completed, total) => `${completed} of ${total} required steps`,
  onboardingOptional: "Optional",
  onboardingStartHere: "Start here",
  stepAddClientTitle: "Add your first client",
  stepAddClientDesc:
    "Set the client name, currency, and logo — every report uses that branding automatically.",
  stepConnectTitle: "Connect ad accounts (optional)",
  stepConnectDesc:
    "You can skip this for now — your first report works with CSV only. Connect Meta, Google, or TikTok later under Account when you want API import.",
  stepGenerateTitle: "Generate your first report",
  stepGenerateDesc:
    "Open New Report → Weekly (recommended) → upload a Meta CSV with Day breakdown (Last 30 days). Use the CSV Export Guide if you are unsure which export to pull.",
};

const LOCALE_OVERRIDES: Partial<Record<SiteLocaleId, Partial<DashboardCopy>>> = {
  es: {
    navHome: "Inicio",
    navClients: "Mis clientes",
    navAccount: "Cuenta",
    navBilling: "Facturación",
    navSupport: "Soporte",
    navPricing: "Precios",
    navCsvGuide: "Guía de exportación CSV",
    navSignOut: "Cerrar sesión",
    navSignOutTitle: "Cerrar sesión de NextReport (puedes iniciar sesión con otra cuenta de Google)",
    trialEnds: (days) => `Tu prueba gratuita termina en ${days} día${days === 1 ? "" : "s"} —`,
    trialSubscribeNow: "Suscríbete ahora",
    trialEnded: "Tu prueba gratuita ha terminado —",
    trialSubscribeContinue: "Suscríbete para continuar",
    clientsTitle: "Mis clientes",
    clientsEmptySubtitle: "Tus espacios de cliente aparecerán aquí.",
    clientsCountSubtitle: (count) =>
      `${count} cliente${count === 1 ? "" : "s"} · elige uno para generar o gestionar`,
    clientsNewClient: "+ Nuevo cliente",
    clientsPlaceholderDuringGuide: "Los espacios que añadas en el paso 1 se listarán aquí.",
    clientsSupportPrefix: "¿Preguntas?",
    clientsSupportOr: "o",
    emptyAddFirstClient: "Añade tu primer cliente",
    emptyBody:
      "Un espacio por marca — configura moneda, zona horaria y logo una vez. Luego abre Nuevo informe y sube tu CSV de Meta.",
    emptyAddClientCta: "+ Añadir cliente",
    helpCsvGuide: "Guía CSV",
    helpSampleReport: "Informe de ejemplo",
    helpHowItWorks: "Cómo funciona",
    onboardingWelcome: "Bienvenido",
    onboardingTitle: "Configura tu primer informe de cliente",
    onboardingLead:
      "Añade un espacio de cliente, sube un CSV diario de Meta y genera un deck con tu marca — normalmente en menos de 2 minutos tras la subida.",
    onboardingSkip: "Omitir guía",
    onboardingSkipping: "Omitiendo…",
    onboardingDismissError: "No se pudo cerrar la guía.",
    onboardingProgress: (c, t) => `${c} de ${t} pasos obligatorios`,
    onboardingOptional: "Opcional",
    onboardingStartHere: "Empieza aquí",
    stepAddClientTitle: "Añade tu primer cliente",
    stepAddClientDesc:
      "Nombre, moneda y logo del cliente — cada informe usará esa marca automáticamente.",
    stepConnectTitle: "Conectar cuentas de anuncios (opcional)",
    stepConnectDesc:
      "Puedes omitirlo — tu primer informe funciona solo con CSV. Conecta Meta, Google o TikTok más tarde en Cuenta para importar por API.",
    stepGenerateTitle: "Genera tu primer informe",
    stepGenerateDesc:
      "Nuevo informe → Semanal (recomendado) → sube un CSV de Meta con desglose por día (últimos 30 días). Usa la guía CSV si no estás seguro.",
  },
  fr: {
    navHome: "Accueil",
    navClients: "Mes clients",
    navAccount: "Compte",
    navBilling: "Facturation",
    navSupport: "Assistance",
    navPricing: "Tarifs",
    navCsvGuide: "Guide d'export CSV",
    navSignOut: "Déconnexion",
    clientsTitle: "Mes clients",
    clientsNewClient: "+ Nouveau client",
    emptyAddClientCta: "+ Ajouter un client",
    onboardingTitle: "Configurez votre premier rapport client",
    onboardingSkip: "Ignorer le guide",
    helpCsvGuide: "Guide CSV",
    helpSampleReport: "Exemple de rapport",
    helpHowItWorks: "Comment ça marche",
  },
  pt: {
    navHome: "Início",
    navClients: "Meus clientes",
    navAccount: "Conta",
    navBilling: "Faturamento",
    navSupport: "Suporte",
    navPricing: "Preços",
    navCsvGuide: "Guia de exportação CSV",
    navSignOut: "Sair",
    clientsTitle: "Meus clientes",
    clientsNewClient: "+ Novo cliente",
    emptyAddClientCta: "+ Adicionar cliente",
    onboardingTitle: "Configure seu primeiro relatório de cliente",
    helpCsvGuide: "Guia CSV",
    helpSampleReport: "Relatório de exemplo",
    helpHowItWorks: "Como funciona",
  },
  de: {
    navHome: "Start",
    navClients: "Meine Kunden",
    navAccount: "Konto",
    navBilling: "Abrechnung",
    navSupport: "Support",
    navPricing: "Preise",
    navCsvGuide: "CSV-Export-Anleitung",
    navSignOut: "Abmelden",
    clientsTitle: "Meine Kunden",
    clientsNewClient: "+ Neuer Kunde",
    emptyAddClientCta: "+ Kunde hinzufügen",
    onboardingTitle: "Ersten Kundenreport einrichten",
    helpCsvGuide: "CSV-Anleitung",
    helpSampleReport: "Beispielreport",
    helpHowItWorks: "So funktioniert's",
  },
};

export function dashboardCopy(locale: SiteLocaleId): DashboardCopy {
  const patch = LOCALE_OVERRIDES[locale];
  if (!patch) return EN;
  return { ...EN, ...patch };
}

export function localizedOnboardingStep(
  locale: SiteLocaleId,
  id: OnboardingStepId,
): { title: string; description: string } {
  const d = dashboardCopy(locale);
  switch (id) {
    case "add-client":
      return { title: d.stepAddClientTitle, description: d.stepAddClientDesc };
    case "connect-platforms":
      return { title: d.stepConnectTitle, description: d.stepConnectDesc };
    case "generate-report":
      return { title: d.stepGenerateTitle, description: d.stepGenerateDesc };
  }
}
