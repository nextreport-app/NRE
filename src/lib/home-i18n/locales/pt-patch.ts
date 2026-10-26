import type { HomeCopyPatch } from "../merge";

/** Portuguese — full homepage copy (mirrors English structure). */
export const PT_HOME_PATCH: HomeCopyPatch = {
  specialistTimeSavings:
    "Cada relatório automatizado poupa cerca de 15–25 minutos de trabalho especializado. Com tarifas típicas de agência, isso liberta capacidade real todos os meses — não só uma sexta-feira mais curta.",
  howItWorksTitle: "Relatórios para clientes em três passos",
  howItWorksSubtitle: "O assistente tem quatro passos detalhados — aqui está a versão curta.",
  howItWorksSteps: [
    {
      title: "Enviar CSV",
      description:
        "Escolha o tipo de relatório, exporte o CSV diário dos Relatórios Meta Ads e importe.",
    },
    {
      title: "Confirmar e rever",
      description: "Selecione campanhas, confirme objetivos e pré-visualize métricas antes de gerar.",
    },
    {
      title: "Gerar e partilhar",
      description: "PPTX com a sua marca, link, Google Drive, WhatsApp ou e-mail — muitas vezes em menos de 2 minutos.",
    },
  ],
  howItWorksLink: "Ver o percurso completo de 4 passos →",
  painTitle: "Pare de gastar horas em relatórios todas as semanas",
  painBody:
    "A agência digital média gasta 25 minutos por cliente por semana a descarregar dados, formatar slides e escrever resumos. Com 10 clientes são mais de 4 horas semanais sem valor estratégico. O NextReport faz isso em menos de 2 minutos.",
  painWithoutLabel: "Sem NextReport",
  painWithoutCalc: "10 clientes × 25 minutos",
  painWithoutResult: "= mais de 4 h/semana",
  painWithLabel: "Com NextReport",
  painWithCalc: "10 clientes × 2 minutos",
  painWithResult: "= 20 minutos/semana",
  featuresTitle: "Tudo o que precisa para melhores relatórios Meta",
  featuresSubtitle: "Lançamento com Meta Ads — Google Ads, TikTok e GA4 em breve.",
  features: [
    {
      title: "Upload de CSV",
      description:
        "Exporte Últimos 30 dias ou Mês anterior com detalhe diário do Ads Manager — a forma suportada hoje.",
    },
    {
      title: "Comparação com mês anterior",
      description:
        "Envie um CSV do mês anterior para o Total combinado comparar períodos — painel opcional no passo 1.",
    },
    {
      title: "Deteta objetivos de campanha",
      description: "Leads, compras, tráfego, alcance e mais — métricas certas por campanha Meta.",
    },
    {
      title: "Resumos com IA",
      description: "Cada slide tem resumo e insights com IA — sem escrever à mão.",
    },
    {
      title: "Relatórios comparativos",
      description: "Compare dois períodos campanha a campanha — esta semana vs anterior ou intervalo personalizado.",
    },
    {
      title: "Link no browser",
      description: "Os clientes abrem o relatório em qualquer dispositivo — sem PowerPoint.",
    },
    {
      title: "Relatórios GA4",
      description: "Tráfego, canais, landing pages, dispositivo e geo — deck completo de performance web.",
    },
    {
      title: "Google e TikTok Ads",
      description: "O mesmo modelo e fluxo — CSV quando abrirmos as próximas plataformas.",
    },
  ],
  trustStrip:
    "Cada número vem da sua conta Meta ou exportação CSV. Nunca alteramos os dados de campanha.",
  reportPreviewTitle: "O que os seus clientes recebem",
  reportPreviewSubtitle:
    "Um PowerPoint com a sua marca e insights com IA — gerado automaticamente a partir dos seus dados.",
  reportPreviewFootnote: "Os relatórios reais usarão os seus dados e branding da agência.",
  reportSlideNames: ["Resumo da campanha", "Conjunto de anúncios", "Desempenho MTD", "Total combinado"],
  reportPrevSlide: "Slide anterior",
  reportNextSlide: "Slide seguinte",
  sampleTitle: "Veja antes de se registar",
  sampleBody:
    "Descarregue um relatório real gerado pelo NextReport — mesmo formato, mesmos insights com IA, mesma qualidade profissional.",
  sampleCta: "Descarregar relatório de exemplo →",
  sampleFootnote: "Sem registo. Abre no PowerPoint ou Google Slides.",
  testimonialsEyebrow: "Primeiros utilizadores",
  testimonialsTitle: "Agências enviam relatórios mais depressa",
  testimonials: [
    {
      quote:
        "Gastávamos meio dia todas as segundas a formatar relatórios Meta. O NextReport reduziu para menos de 15 minutos para toda a carteira.",
      role: "Fundador",
      company: "Agência de performance",
      location: "Índia",
    },
    {
      quote:
        "Os resumos com IA são utilizáveis — edito uma frase e envio. Os clientes notam a diferença.",
      role: "Account manager",
      company: "Agência digital boutique",
      location: "EAU",
    },
    {
      quote: "Export para Slides mais link: acabaram-se as descargas em falta. Envio o link e pronto.",
      role: "Media buyer freelance",
      company: "Consultor independente",
      location: "Estados Unidos",
    },
  ],
  referTitle: "Recomendar uma agência",
  referLink: "Como funcionam as referências →",
  whatsappTitle: "WhatsApp para agências",
  whatsappLink: "Abrir WhatsApp →",
  whatsappPrefill: "Olá — sou uma agência a usar (ou a testar) o NextReport para Meta.",
  referralLine:
    "Recomende outra agência: quando subscreverem, ambos ganham um mês grátis na renovação seguinte.",
  whatsappLine:
    "Agências na Índia: fale connosco no WhatsApp para ajuda, dicas de reporting e novidades.",
  leadTitle: "Pergunte-nos o que quiser",
  leadBody: "Demo, preços ou funcionalidade — deixe uma nota e respondemos num dia útil.",
  leadPreferEmail: "Prefere e-mail?",
  leadContactLink: "Formulário de contacto →",
  pricingNeedDemo: "Precisa de demo? Escreva para",
  heroMockCampaign: "Coastal Skin Co. — Geração de leads",
  heroMockWeekly: "Semanal",
  heroMetrics: [
    { label: "Gasto em anúncios", value: "$480" },
    { label: "Alcance", value: "40,000" },
    { label: "Impressões", value: "80,000" },
    { label: "Leads formulário instantâneo", value: "120" },
    { label: "Custo por lead", value: "$4.00" },
    { label: "CTR (todos)", value: "2.00%" },
    { label: "Cliques no link", value: "1,200" },
    { label: "Custo por clique", value: "$0.30" },
  ],
  enquiry: {
    namePlaceholder: "O seu nome",
    emailPlaceholder: "E-mail profissional",
    whatsappPlaceholder: "WhatsApp (+91, +1, +44 …)",
    messagePlaceholder: "Fale-nos da sua agência ou faça uma pergunta…",
    send: "Enviar pedido",
    sending: "A enviar…",
    success: "Obrigado — respondemos num dia útil.",
    error: "Algo correu mal — escreva para hello@nextreport.in.",
  },
  pricing: {
    billingPeriodAria: "Período de faturação",
    monthly: "Mensal",
    annual: "Anual (poupa 20 %)",
    mostPopular: "Mais popular",
    perMonth: "/mês",
    perYear: "/ano",
    saveAnnual: "Poupa 20 % vs mensal",
    exclGst: "Sem IVA 18 %",
    exclTax: "Sem impostos",
    payInr: "Pagamento seguro UPI, cartões, net banking",
    payUsd: "Pagamento seguro com cartão",
    subscribeToPrefix: "Subscrever",
    redirecting: "A redirecionar…",
    plans: {
      starter: {
        bestFor: "Freelancers e agências boutique",
        features: [
          "Até 10 clientes — Meta, Google, TikTok e GA4 incluídos",
          "Geração ilimitada de relatórios",
          "Meta Ads — upload CSV (ativo)",
          "Google, TikTok e GA4 — em breve",
          "Resumos e insights com IA",
          "PowerPoint, Google Slides e link web",
          "Gravação automática no Google Drive",
          "Relatórios white-label",
          "Webhooks Slack e Zapier",
          "Suporte por e-mail em 24 horas",
        ],
      },
      professional: {
        bestFor: "Agências em crescimento",
        features: [
          "Clientes ilimitados — todas as plataformas incluídas",
          "Tudo do plano Agency",
          "Reporting CSV Meta por cliente; mais plataformas ao lançar",
          "Relatórios trimestrais, YTD e criativos — em breve",
          "Suporte prioritário por e-mail",
          "Acesso antecipado a novidades",
        ],
      },
    },
  },
};
