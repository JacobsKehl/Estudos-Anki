export type LanguageTone = "FEMININE" | "MASCULINE_NEUTRAL";

export function getUserCopy(languageTone?: string) {
  const tone: LanguageTone =
    languageTone === "FEMININE" ? "FEMININE" : "MASCULINE_NEUTRAL";

  const isFeminine = tone === "FEMININE";

  return {
    // Títulos de Páginas e Seções
    profileTitle: isFeminine
      ? "Central Pessoal da Estudante"
      : "Central Pessoal de Estudos",
      
    profileHeaderTitle: isFeminine
      ? "Central da Estudante"
      : "Central de Estudos",

    // Saudações e Boas-Vindas
    welcomeBack: (name?: string) =>
      isFeminine
        ? `Bem-vinda de volta${name ? `, ${name}` : ""}`
        : `Bem-vindo de volta${name ? `, ${name}` : ""}`,

    welcomeGeneric: isFeminine
      ? "Bem-vinda ao Kehl Study"
      : "Bem-vindo ao Kehl Study",

    // Mensagens Motivacionais / Estado de Preparação
    readyToContinue: isFeminine
      ? "Você está preparada para continuar"
      : "Você está pronto para continuar",

    readyForMore: isFeminine
      ? "Você está preparada para mais um dia de estudos."
      : "Você está pronto para mais um dia de estudos.",

    todayReady: isFeminine
      ? "Sua rotina de estudos está pronta"
      : "Seu roteiro de estudos está pronto",

    completedToday: isFeminine
      ? "A estudante concluiu os estudos de hoje"
      : "O estudante concluiu os estudos de hoje",

    // Acesso Restrito / Avisos Gerais
    accessExclusive: isFeminine
      ? "Acesso exclusivo para estudantes convidadas."
      : "Acesso exclusivo para estudantes convidados.",

    // Perfil & Segurança
    accountSecurityDesc: isFeminine
      ? "Gerencie suas credenciais e verifique os acessos da estudante."
      : "Gerencie suas credenciais e verifique os acessos do estudante.",

    studentDetails: isFeminine
      ? "Ajuste suas informações básicas de estudante e metas de cronograma."
      : "Ajuste suas informações básicas de estudo e metas de cronograma.",

    studentMetadata: isFeminine
      ? "Informações da Estudante"
      : "Informações do Estudante",
  };
}
