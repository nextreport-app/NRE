import type { SiteLocaleId } from "./site-theme";

export type MarketingCopy = {
  brandTagline: string;
  navSignIn: string;
  navContact: string;
  navSignOut: string;
  navStartTrial: string;
  navDashboard: string;
  heroBadge: string;
  heroHeadline: string;
  /** English hero — accent phrase split (other locales use heroHeadline only). */
  heroHeadlineBefore?: string;
  heroHeadlineAccent?: string;
  heroHeadlineAfter?: string;
  heroSubtext: string;
  heroStartTrial: string;
  heroGoDashboard: string;
  heroRequestDemo: string;
  heroNoCard: string;
  pricingTitle: string;
  pricingSubtitle: string;
  pricingCurrencyLabel: string;
  tryCtaTitle: string;
  tryCtaHeadlineBefore?: string;
  tryCtaHeadlineAccent?: string;
  tryCtaHeadlineAfter?: string;
  tryCtaSubtitle: string;
  tryCtaFinePrint?: string;
  tryCtaStartTrial: string;
  tryCtaDashboard: string;
  ctaTrustBadges: string[];
};

const EN: MarketingCopy = {
  brandTagline: "Client reporting for agencies — Meta Ads today; Google Ads, TikTok Ads, and GA4 launching soon.",
  navSignIn: "Log in",
  navContact: "Contact us",
  navSignOut: "Sign out",
  navStartTrial: "Sign up",
  navDashboard: "Dashboard",
  heroBadge: "Meta Ads reporting for agencies",
  heroHeadline: "Branded client reporting for agencies in minutes.",
  heroHeadlineBefore: "Branded ",
  heroHeadlineAccent: "client reporting",
  heroHeadlineAfter: " for agencies in minutes.",
  heroSubtext:
    "Turn Meta Ads CSV exports into accurate, client-branded weekly performance reports — without manually rebuilding slides. Google, TikTok, GA4, and Meta API sync are launching soon.",
  heroStartTrial: "Start free trial",
  heroGoDashboard: "Go to Dashboard",
  heroRequestDemo: "Request a demo",
  heroNoCard: "No credit card required.",
  pricingTitle: "Simple pricing for growing agencies",
  pricingSubtitle: "Start free for 7 days. No credit card required.",
  pricingCurrencyLabel: "Show prices in",
  tryCtaTitle: "Try NextReport now.",
  tryCtaHeadlineBefore: "Ship ",
  tryCtaHeadlineAccent: "your first deck",
  tryCtaHeadlineAfter: " in minutes",
  tryCtaSubtitle: "Try NextReport now.",
  tryCtaFinePrint: "7-day free trial.",
  tryCtaStartTrial: "Sign up",
  tryCtaDashboard: "Go to Dashboard",
  ctaTrustBadges: ["7-day free trial", "No credit card", "CSV-backed numbers"],
};

const LOCALE_OVERRIDES: Partial<Record<SiteLocaleId, Partial<MarketingCopy>>> = {
  es: {
    brandTagline: "Reporting de clientes con tu marca — Meta activo; Google, TikTok y GA4 en camino.",
    navSignIn: "Iniciar sesión",
    navContact: "Contacto",
    navSignOut: "Cerrar sesión",
    navStartTrial: "Prueba gratis",
    navDashboard: "Panel",
    heroBadge: "Meta, Google Ads, TikTok y GA4",
    heroHeadline: "Reporting de clientes con tu marca para agencias en minutos.",
    heroStartTrial: "Prueba gratis",
    heroGoDashboard: "Ir al panel",
    heroRequestDemo: "Solicitar demo",
    heroNoCard: "No se requiere tarjeta.",
    pricingTitle: "Precios simples para agencias en crecimiento",
    pricingSubtitle: "7 días gratis. Sin tarjeta de crédito.",
    pricingCurrencyLabel: "Mostrar precios en",
    tryCtaTitle: "Prueba NextReport ahora.",
    tryCtaSubtitle: "7 días gratis — sin tarjeta.",
    tryCtaStartTrial: "Prueba gratis",
    tryCtaDashboard: "Ir al panel",
  },
  fr: {
    brandTagline: "Reporting client avec votre marque — Meta, Google Ads, TikTok et GA4.",
    navSignIn: "Connexion",
    navContact: "Contact",
    navSignOut: "Déconnexion",
    navStartTrial: "Essai gratuit",
    navDashboard: "Tableau de bord",
    heroHeadline: "Reporting client de marque pour les agences, en minutes.",
    heroStartTrial: "Essai gratuit",
    heroGoDashboard: "Tableau de bord",
    heroRequestDemo: "Demander une démo",
    heroNoCard: "Sans carte bancaire.",
    pricingTitle: "Tarifs simples pour agences",
    pricingSubtitle: "7 jours gratuits. Sans carte.",
    pricingCurrencyLabel: "Afficher les prix en",
    tryCtaTitle: "Essayez NextReport.",
    tryCtaSubtitle: "7 jours gratuits — sans carte.",
    tryCtaStartTrial: "Essai gratuit",
    tryCtaDashboard: "Tableau de bord",
  },
  pt: {
    brandTagline: "Reporting de clientes com sua marca — Meta, Google Ads, TikTok e GA4.",
    navSignIn: "Entrar",
    navContact: "Contato",
    navSignOut: "Sair",
    navStartTrial: "Teste grátis",
    navDashboard: "Painel",
    heroHeadline: "Reporting de clientes com sua marca para agências em minutos.",
    heroStartTrial: "Teste grátis",
    heroGoDashboard: "Ir ao painel",
    heroRequestDemo: "Agendar demo",
    pricingTitle: "Preços simples para agências",
    pricingSubtitle: "7 dias grátis. Sem cartão.",
    pricingCurrencyLabel: "Mostrar preços em",
    tryCtaTitle: "Experimente o NextReport.",
    tryCtaStartTrial: "Teste grátis",
  },
  de: {
    brandTagline: "Gebrandetes Client-Reporting — Meta, Google Ads, TikTok & GA4.",
    navSignIn: "Anmelden",
    navContact: "Kontakt",
    navSignOut: "Abmelden",
    navStartTrial: "Kostenlos testen",
    navDashboard: "Dashboard",
    heroHeadline: "Gebrandetes Client-Reporting für Agenturen in Minuten.",
    heroStartTrial: "Kostenlos testen",
    pricingTitle: "Einfache Preise für wachsende Agenturen",
    pricingCurrencyLabel: "Preise anzeigen in",
    tryCtaTitle: "NextReport jetzt testen.",
  },
  ru: {
    navSignIn: "Войти",
    navContact: "Контакты",
    navSignOut: "Выйти",
    navStartTrial: "Бесплатный период",
    navDashboard: "Кабинет",
    heroHeadline: "Брендированная отчётность для агентств за минуты.",
    brandTagline: "Отчётность для клиентов — Meta, Google Ads, TikTok и GA4.",
    pricingTitle: "Простые тарифы для агентств",
    tryCtaTitle: "Попробуйте NextReport.",
  },
  it: {
    navSignIn: "Accedi",
    navContact: "Contatti",
    navSignOut: "Esci",
    navStartTrial: "Prova gratuita",
    heroHeadline: "Reporting clienti brandizzato per agenzie in pochi minuti.",
    brandTagline: "Reporting clienti — Meta, Google Ads, TikTok e GA4.",
    tryCtaTitle: "Prova NextReport ora.",
  },
  zh: {
    navSignIn: "登录",
    navContact: "联系",
    navSignOut: "退出",
    navStartTrial: "免费试用",
    navDashboard: "控制台",
    heroHeadline: "为代理商提供品牌化客户报告，几分钟即可完成。",
    brandTagline: "品牌化客户报告 — Meta、Google Ads、TikTok 与 GA4。",
    pricingTitle: "为成长型代理商提供的简单定价",
    tryCtaTitle: "立即试用 NextReport。",
  },
  bn: {
    navSignIn: "সাইন ইন",
    navContact: "যোগাযোগ",
    navSignOut: "সাইন আউট",
    navStartTrial: "বিনামূল্যে ট্রায়াল",
    heroHeadline: "এজেন্সির জন্য ব্র্যান্ডেড ক্লায়েন্ট রিপোর্টিং, মিনিটেই।",
    brandTagline: "ব্র্যান্ডেড রিপোর্টিং — Meta, Google Ads, TikTok ও GA4।",
  },
  mr: {
    navSignIn: "साइन इन",
    navContact: "संपर्क",
    navSignOut: "साइन आउट",
    navStartTrial: "मोफत ट्रायल",
    heroHeadline: "एजन्सीसाठी ब्रँडेड क्लायंट रिपोर्टिंग, मिनिटांत.",
    brandTagline: "ब्रँडेड रिपोर्टिंग — Meta, Google Ads, TikTok आणि GA4.",
  },
  te: {
    navSignIn: "సైన్ ఇన్",
    navContact: "సంప్రదించండి",
    navSignOut: "సైన్ అవుట్",
    navStartTrial: "ఉచిత ట్రయల్",
    heroHeadline: "ఏజెన్సీల కోసం బ్రాండెడ్ క్లయింట్ రిపోర్టింగ్, నిమిషాల్లో.",
    brandTagline: "బ్రాండెడ్ రిపోర్టింగ్ — Meta, Google Ads, TikTok & GA4.",
  },
  ta: {
    navSignIn: "உள்நுழை",
    navContact: "தொடர்பு",
    navSignOut: "வெளியேறு",
    navStartTrial: "இலவச trial",
    heroHeadline: "நிறுவனங்களுக்கான பிராண்டட் கிளையண்ட் ரிப்போர்டிங், நிமிடங்களில்.",
    brandTagline: "பிராண்டட் ரிப்போர்டிங் — Meta, Google Ads, TikTok & GA4.",
  },
};

export function marketingCopy(locale: SiteLocaleId): MarketingCopy {
  return { ...EN, ...LOCALE_OVERRIDES[locale] };
}
