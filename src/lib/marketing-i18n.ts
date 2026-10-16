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
  tryCtaSubtitle: string;
  tryCtaStartTrial: string;
  tryCtaDashboard: string;
};

const EN: MarketingCopy = {
  brandTagline: "Branded Meta Ads client reporting for agencies.",
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
    "Upload Meta Ads CSV exports and deliver branded decks, live links, and share-ready client reports — without rebuilding slides every week.",
  heroStartTrial: "Start free trial",
  heroGoDashboard: "Go to Dashboard",
  heroRequestDemo: "Request a demo",
  heroNoCard: "No credit card required.",
  pricingTitle: "Simple pricing for growing agencies",
  pricingSubtitle: "Start free for 7 days. No credit card required.",
  pricingCurrencyLabel: "Show prices in",
  tryCtaTitle: "Try NextReport now.",
  tryCtaSubtitle: "7-day free trial — no credit card required.",
  tryCtaStartTrial: "Start free trial",
  tryCtaDashboard: "Go to Dashboard",
};

const LOCALE_OVERRIDES: Partial<Record<SiteLocaleId, Partial<MarketingCopy>>> = {
  es: {
    brandTagline: "Reporting de clientes con tu marca — Meta activo; Google, TikTok y GA4 en camino.",
    navSignIn: "Iniciar sesión",
    navContact: "Contacto",
    navSignOut: "Cerrar sesión",
    navStartTrial: "Prueba gratis",
    navDashboard: "Panel",
    heroBadge: "Meta Ads — activo · Google, TikTok y GA4 — pronto",
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
    brandTagline: "Reporting client avec votre marque — Meta en ligne ; Google, TikTok et GA4 bientôt.",
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
    brandTagline: "Reporting de clientes com sua marca — Meta ativo; Google, TikTok e GA4 em breve.",
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
    brandTagline: "Gebrandetes Client-Reporting für Agenturen — Meta live, Google, TikTok & GA4 folgen.",
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
    brandTagline: "Отчётность для клиентов с вашим брендом — Meta сейчас, Google, TikTok и GA4 скоро.",
    pricingTitle: "Простые тарифы для агентств",
    tryCtaTitle: "Попробуйте NextReport.",
  },
  it: {
    navSignIn: "Accedi",
    navContact: "Contatti",
    navSignOut: "Esci",
    navStartTrial: "Prova gratuita",
    heroHeadline: "Reporting clienti brandizzato per agenzie in pochi minuti.",
    brandTagline: "Reporting clienti con il tuo brand — Meta attivo; Google, TikTok e GA4 in arrivo.",
    tryCtaTitle: "Prova NextReport ora.",
  },
  zh: {
    navSignIn: "登录",
    navContact: "联系",
    navSignOut: "退出",
    navStartTrial: "免费试用",
    navDashboard: "控制台",
    heroHeadline: "为代理商提供品牌化客户报告，几分钟即可完成。",
    brandTagline: "品牌化客户报告 — Meta 已上线，Google、TikTok 与 GA4 即将推出。",
    pricingTitle: "为成长型代理商提供的简单定价",
    tryCtaTitle: "立即试用 NextReport。",
  },
  bn: {
    navSignIn: "সাইন ইন",
    navContact: "যোগাযোগ",
    navSignOut: "সাইন আউট",
    navStartTrial: "বিনামূল্যে ট্রায়াল",
    heroHeadline: "এজেন্সির জন্য ব্র্যান্ডেড ক্লায়েন্ট রিপোর্টিং, মিনিটেই।",
    brandTagline: "এজেন্সির জন্য ব্র্যান্ডেড রিপোর্টিং — Meta চালু, Google, TikTok ও GA4 শীঘ্রই।",
  },
  mr: {
    navSignIn: "साइन इन",
    navContact: "संपर्क",
    navSignOut: "साइन आउट",
    navStartTrial: "मोफत ट्रायल",
    heroHeadline: "एजन्सीसाठी ब्रँडेड क्लायंट रिपोर्टिंग, मिनिटांत.",
    brandTagline: "एजन्सीसाठी ब्रँडेड रिपोर्टिंग — Meta सुरू, Google, TikTok आणि GA4 लवकरच.",
  },
  te: {
    navSignIn: "సైన్ ఇన్",
    navContact: "సంప్రదించండి",
    navSignOut: "సైన్ అవుట్",
    navStartTrial: "ఉచిత ట్రయల్",
    heroHeadline: "ఏజెన్సీల కోసం బ్రాండెడ్ క్లయింట్ రిపోర్టింగ్, నిమిషాల్లో.",
    brandTagline: "ఏజెన్సీలకు బ్రాండెడ్ రిపోర్టింగ్ — Meta లైవ్, Google, TikTok & GA4 త్వరలో.",
  },
  ta: {
    navSignIn: "உள்நுழை",
    navContact: "தொடர்பு",
    navSignOut: "வெளியேறு",
    navStartTrial: "இலவச trial",
    heroHeadline: "நிறுவனங்களுக்கான பிராண்டட் கிளையண்ட் ரிப்போர்டிங், நிமிடங்களில்.",
    brandTagline: "நிறுவனங்களுக்கான பிராண்டட் ரிப்போர்டிங் — Meta live, Google, TikTok & GA4 விரைவில்.",
  },
};

export function marketingCopy(locale: SiteLocaleId): MarketingCopy {
  return { ...EN, ...LOCALE_OVERRIDES[locale] };
}
