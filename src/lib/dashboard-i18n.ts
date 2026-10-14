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
  helpHowItWorks: string;
  gettingStartedTitle: string;
  gettingStartedLead: string;
  gettingStartedStep1Title: string;
  gettingStartedStep1Body: string;
  gettingStartedStep2Title: string;
  gettingStartedStep2Body: string;
  gettingStartedStep3Title: string;
  gettingStartedStep3Body: string;
  gettingStartedAlsoTitle: string;
  gettingStartedAccountLink: string;
  gettingStartedHowItWorksLink: string;
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
  helpHowItWorks: "How it works",
  gettingStartedTitle: "Start here",
  gettingStartedLead:
    "NextReport is Meta Ads reporting only today: add a client, upload a day-wise CSV from Ads Manager, and generate a branded deck.",
  gettingStartedStep1Title: "Add a client",
  gettingStartedStep1Body: "Name, currency, timezone, and logo — one workspace per brand.",
  gettingStartedStep2Title: "Export your Meta CSV",
  gettingStartedStep2Body: "Day-wise breakdown from Meta Ads Reporting (not the Campaigns screen export).",
  gettingStartedStep3Title: "Open the wizard & generate",
  gettingStartedStep3Body: "From the client page, choose New Report → pick a report type → upload CSV → Generate.",
  gettingStartedAlsoTitle: "Helpful links",
  gettingStartedAccountLink: "Account settings (agency branding)",
  gettingStartedHowItWorksLink: "How it works (full walkthrough)",
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
    "Optional — CSV is enough for your first deck. Connect Meta in Account later if you want API import.",
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
    helpHowItWorks: "Cómo funciona",
    gettingStartedTitle: "Empieza aquí",
    gettingStartedLead:
      "Hoy solo informes de Meta Ads: añade un cliente, sube un CSV diario de Ads Manager y genera un deck con tu marca.",
    gettingStartedStep1Title: "Añadir un cliente",
    gettingStartedStep1Body: "Nombre, moneda, zona horaria y logo — un espacio por marca.",
    gettingStartedStep2Title: "Exportar CSV de Meta",
    gettingStartedStep2Body: "Desglose por día en Meta Ads Reporting (no la exportación de Campañas).",
    gettingStartedStep3Title: "Abrir el asistente y generar",
    gettingStartedStep3Body: "Desde el cliente, Nuevo informe → tipo → subir CSV → Generar.",
    gettingStartedAlsoTitle: "Enlaces útiles",
    gettingStartedAccountLink: "Cuenta (marca de agencia)",
    gettingStartedHowItWorksLink: "Cómo funciona (guía completa)",
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
      "Opcional — el CSV basta para el primer informe. Conecta Meta en Cuenta más tarde si quieres importación por API.",
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
