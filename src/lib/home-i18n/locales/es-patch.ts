import type { HomeCopyPatch } from "../merge";

export const ES_HOME_PATCH: HomeCopyPatch = {
  specialistTimeSavings:
    "Cada informe automatizado ahorra unos 15–25 minutos de trabajo especializado. Con tarifas habituales de agencia, eso se traduce en capacidad real cada mes — no solo un viernes más corto.",
  howItWorksTitle: "Informes para clientes en tres pasos",
  howItWorksSubtitle: "El asistente tiene cuatro pasos detallados — esta es la versión breve.",
  howItWorksSteps: [
    {
      title: "Subir CSV",
      description:
        "Elige el tipo de informe, exporta el CSV diario desde Informes de Meta Ads e impórtalo.",
    },
    {
      title: "Confirmar y revisar",
      description: "Selecciona campañas, verifica objetivos y previsualiza las métricas antes de generar.",
    },
    {
      title: "Generar y compartir",
      description: "PPTX con tu marca, enlace, Google Drive, WhatsApp o email — a menudo en menos de 2 minutos.",
    },
  ],
  howItWorksLink: "Ver el recorrido completo de 4 pasos →",
  painTitle: "Deja de dedicar horas a los informes cada semana",
  painBody:
    "La agencia digital media dedica 25 minutos por cliente y semana a descargar datos, maquetar diapositivas y redactar resúmenes. Con 10 clientes son más de 4 horas semanales sin valor estratégico. NextReport lo hace en menos de 2 minutos.",
  painWithoutLabel: "Sin NextReport",
  painWithoutCalc: "10 clientes × 25 minutos",
  painWithoutResult: "= más de 4 h/semana",
  painWithLabel: "Con NextReport",
  painWithCalc: "10 clientes × 2 minutos",
  painWithResult: "= 20 minutos/semana",
  featuresTitle: "Todo lo que necesitas para mejores informes de Meta",
  featuresSubtitle: "Lanzamos con Meta Ads — Google Ads, TikTok y GA4 muy pronto.",
  features: [
    {
      title: "Subida de CSV",
      description:
        "Exporta Últimos 30 días o Mes anterior con desglose diario desde Ads Manager — la forma admitida hoy.",
    },
    {
      title: "Comparación con mes anterior",
      description:
        "Sube un CSV del mes previo para que Total combinado compare periodos — panel opcional en el paso 1.",
    },
    {
      title: "Detecta objetivos de campaña",
      description:
        "Identifica leads, compras, tráfico, alcance y más — elige las métricas correctas por campaña.",
    },
    {
      title: "Resúmenes con IA",
      description: "Cada diapositiva incluye resumen e insights escritos por IA — sin redactar a mano.",
    },
    {
      title: "Informes comparativos",
      description: "Compara dos periodos campaña a campaña — esta semana vs la anterior o un rango personalizado.",
    },
    {
      title: "Enlace en el navegador",
      description: "Tus clientes abren el informe en cualquier dispositivo y navegador — sin PowerPoint.",
    },
    {
      title: "Informes web GA4",
      description: "Tráfico, canales, landing pages, dispositivo y geo — un deck completo de rendimiento web.",
    },
    {
      title: "Google y TikTok Ads",
      description: "La misma plantilla y flujo — subida CSV cuando abramos las siguientes plataformas.",
    },
  ],
  trustStrip:
    "Cada cifra proviene de tu cuenta Meta o exportación CSV. Nunca modificamos los datos de campaña.",
  reportPreviewTitle: "Lo que recibirán tus clientes",
  reportPreviewSubtitle:
    "Un PowerPoint con tu marca e insights con IA — generado automáticamente desde tus datos.",
  reportPreviewFootnote: "Tus informes reales usarán tus datos y el branding de tu agencia.",
  reportSlideNames: ["Resumen de campaña", "Conjunto de anuncios", "Rendimiento MTD", "Total combinado"],
  reportPrevSlide: "Diapositiva anterior",
  reportNextSlide: "Diapositiva siguiente",
  sampleTitle: "Míralo antes de registrarte",
  sampleBody:
    "Descarga un informe real generado por NextReport — mismo formato, mismos insights con IA, misma calidad profesional.",
  sampleCta: "Descargar informe de ejemplo →",
  sampleFootnote: "Sin registro. Se abre en PowerPoint o Google Slides.",
  testimonialsEyebrow: "Primeros usuarios",
  testimonialsTitle: "Las agencias envían informes más rápido",
  testimonials: [
    {
      quote:
        "Antes dedicábamos medio lunes a formatear informes de Meta en PowerPoint. NextReport lo redujo a menos de 15 minutos para toda la cartera.",
      role: "Fundador",
      company: "Agencia de marketing de rendimiento",
      location: "India",
    },
    {
      quote:
        "Los resúmenes con IA son útiles — edito una frase y envío. Los clientes notan la diferencia frente a nuestros decks manuales.",
      role: "Account manager",
      company: "Agencia digital boutique",
      location: "EAU",
    },
    {
      quote:
        "Export a Slides más enlace: ya no persigo descargas. Les mando el enlace y listo.",
      role: "Media buyer freelance",
      company: "Consultor independiente",
      location: "Estados Unidos",
    },
  ],
  referTitle: "Recomienda una agencia",
  referLink: "Cómo funcionan las referencias →",
  whatsappTitle: "WhatsApp para agencias",
  whatsappLink: "Abrir WhatsApp →",
  whatsappPrefill: "Hola — soy una agencia que usa (o prueba) NextReport para informes de Meta.",
  referralLine:
    "Recomienda otra agencia: cuando se suscriban, ambos obtienen un mes gratis en la próxima renovación.",
  whatsappLine:
    "Agencias en India: escríbenos por WhatsApp para ayuda de configuración, consejos de reporting y novedades.",
  leadTitle: "Pregúntanos lo que quieras",
  leadBody:
    "Demo, precios o una función — déjanos una nota y respondemos en un día laborable.",
  leadPreferEmail: "¿Prefieres email?",
  leadContactLink: "Formulario de contacto →",
  pricingNeedDemo: "¿Necesitas una demo? Escríbenos a",
  heroMockCampaign: "Coastal Skin Co. — Generación de leads",
  heroMockWeekly: "Semanal",
  heroMetrics: [
    { label: "Gasto en anuncios", value: "$480" },
    { label: "Alcance", value: "40,000" },
    { label: "Impresiones", value: "80,000" },
    { label: "Leads formulario instantáneo", value: "120" },
    { label: "Coste por lead", value: "$4.00" },
    { label: "CTR (total)", value: "2.00%" },
    { label: "Clics en enlace", value: "1,200" },
    { label: "Coste por clic", value: "$0.30" },
  ],
  enquiry: {
    namePlaceholder: "Tu nombre",
    emailPlaceholder: "Email de trabajo",
    whatsappPlaceholder: "WhatsApp (+91, +1, +44 …)",
    messagePlaceholder: "Cuéntanos sobre tu agencia o haz una pregunta…",
    send: "Enviar consulta",
    sending: "Enviando…",
    success: "Gracias — responderemos en un día laborable.",
    error: "Algo falló — escribe a hello@nextreport.in directamente.",
  },
  pricing: {
    billingPeriodAria: "Periodo de facturación",
    monthly: "Mensual",
    annual: "Anual (ahorra 20 %)",
    mostPopular: "Más popular",
    perMonth: "/mes",
    perYear: "/año",
    saveAnnual: "Ahorra 20 % frente al pago mensual",
    exclGst: "Sin IVA (18 %)",
    exclTax: "Impuestos no incluidos",
    payInr: "Pago seguro con UPI, tarjetas o banca en línea",
    payUsd: "Pago seguro con tarjeta de crédito o débito",
    subscribeToPrefix: "Suscribirse a",
    redirecting: "Redirigiendo…",
    plans: {
      starter: {
        bestFor: "Freelancers y agencias boutique",
        features: [
          "Hasta 10 clientes — Meta, Google, TikTok y GA4 incluidos",
          "Generación ilimitada de informes",
          "Meta Ads — subida CSV (activo)",
          "Google, TikTok y GA4 — muy pronto",
          "Resúmenes e insights con IA",
          "PowerPoint, Google Slides y enlace en navegador",
          "Guardado automático en Google Drive",
          "Informes con tu marca (white-label)",
          "Webhooks Slack y Zapier",
          "Soporte por email en 24 horas",
        ],
      },
      professional: {
        bestFor: "Agencias en crecimiento con más clientes",
        features: [
          "Clientes ilimitados — todas las plataformas incluidas",
          "Todo lo de Agency",
          "Informes CSV Meta para cada cliente; más plataformas al lanzar",
          "Informes trimestrales, YTD y creativos — pronto",
          "Soporte prioritario por email",
          "Acceso anticipado a funciones nuevas",
        ],
      },
    },
  },
};
