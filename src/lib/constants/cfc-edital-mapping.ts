export type CfcMateria = "ADM" | "CONST" | "TRAB" | "PCIV" | "PTRAB";

export const MATERIA_NOME: Record<CfcMateria, string> = {
  ADM: "Direito Administrativo",
  CONST: "Direito Constitucional",
  TRAB: "Direito do Trabalho",
  PCIV: "Direito Processual Civil",
  PTRAB: "Direito Processual do Trabalho",
};

export interface CfcMappingItem {
  mat: CfcMateria;
  ord: number;      // ordem do item no sumário
  pag: number;      // página impressa de início
  titulo: string;
  v2: string | null;   // -> StudyBlock.officialTopicId
  rel: "EXATO" | "CFC_MAIS_ESTREITO" | "CFC_MAIS_AMPLO" | "PARCIAL" | "NENHUM";
  sec: string[];       // -> StudyBlockSupport
  obs?: string;
}

export const CFC_EDITAL_MAPPING: CfcMappingItem[] = [

  // ===== Direito Administrativo =====
  { mat: "ADM", ord: 1, pag: 5, titulo: "Glossário de Siglas", v2: null, rel: "NENHUM", sec: [], obs: "Apoio de leitura, não é conteúdo do edital" },
  { mat: "ADM", ord: 2, pag: 7, titulo: "Conceitos e Fontes do Direito Administrativo", v2: "trt4_2026p__adm_t1", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "t1 = princípios básicos + poderes; itens 2, 3 e 4 o compõem" },
  { mat: "ADM", ord: 3, pag: 9, titulo: "Administração Pública (conforme CF/88)", v2: "trt4_2026p__adm_t1", rel: "CFC_MAIS_ESTREITO", sec: ["trt4_2026p__const_t7"], obs: "Também toca Constitucional t7" },
  { mat: "ADM", ord: 4, pag: 13, titulo: "Poderes e Deveres da Administração Pública", v2: "trt4_2026p__adm_t1", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "Fecha o t1 com os itens 2 e 3" },
  { mat: "ADM", ord: 5, pag: 16, titulo: "Atos Administrativos", v2: "trt4_2026p__adm_t2", rel: "EXATO", sec: [], obs: "Escopo idêntico ao tópico do edital" },
  { mat: "ADM", ord: 6, pag: 25, titulo: "Organização da Administração Pública e Terceiro Setor", v2: "trt4_2026p__adm_t3", rel: "CFC_MAIS_AMPLO", sec: ["trt4_2026p__adm_t11"], obs: "Cobre t3 e t11 (terceiro setor) no mesmo item" },
  { mat: "ADM", ord: 7, pag: 30, titulo: "Serviços Públicos", v2: "trt4_2026p__adm_t9", rel: "EXATO", sec: [], obs: "Inclui PPP e concessões, como o edital" },
  { mat: "ADM", ord: 8, pag: 39, titulo: "Responsabilidade Civil do Estado", v2: "trt4_2026p__adm_t6", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "t6 = controle E responsabilização; itens 8 e 9 o compõem" },
  { mat: "ADM", ord: 9, pag: 42, titulo: "Controle da Administração Pública", v2: "trt4_2026p__adm_t6", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "Fecha o t6 com o item 8" },
  { mat: "ADM", ord: 10, pag: 49, titulo: "Lei 9.784/99 – Processo Administrativo Federal", v2: "trt4_2026p__adm_t5", rel: "EXATO", sec: [], obs: "Mesma lei dos dois lados" },
  { mat: "ADM", ord: 11, pag: 56, titulo: "Bens Públicos", v2: "trt4_2026p__adm_t10", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "t10 = bens + intervenção; itens 11 e 12 o compõem" },
  { mat: "ADM", ord: 12, pag: 58, titulo: "Intervenção do Estado na Propriedade Privada", v2: "trt4_2026p__adm_t10", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "Fecha o t10 com o item 11" },
  { mat: "ADM", ord: 13, pag: 63, titulo: "Lei 12.527/12 – Acesso à Informação", v2: null, rel: "NENHUM", sec: [], obs: "LAI não está nos 11 tópicos de Administrativo; conferir contra Legislação" },
  { mat: "ADM", ord: 14, pag: 67, titulo: "Agentes Públicos – Parte Constitucional", v2: "trt4_2026p__adm_t4", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "t4 = servidores + 8.112; itens 14 e 15 o compõem" },
  { mat: "ADM", ord: 15, pag: 75, titulo: "Lei 8.112/90 – Estatuto dos Servidores Públicos Federais", v2: "trt4_2026p__adm_t4", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "Fecha o t4 com o item 14" },
  { mat: "ADM", ord: 16, pag: 89, titulo: "Lei 14.133/21 – Nova Lei de Licitações (Parte de Licitações)", v2: "trt4_2026p__adm_t8", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "t8 = licitações + contratos; itens 16 e 17 o compõem" },
  { mat: "ADM", ord: 17, pag: 116, titulo: "Lei 14.133/21 – Nova Lei de Licitações (Parte de Contratos)", v2: "trt4_2026p__adm_t8", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "Fecha o t8 com o item 16" },
  { mat: "ADM", ord: 18, pag: 130, titulo: "Lei 8.429/92 – Lei de Improbidade Administrativa", v2: "trt4_2026p__adm_t7", rel: "EXATO", sec: [], obs: "Mesma lei dos dois lados" },
  { mat: "ADM", ord: 19, pag: 140, titulo: "Lei 13.709/18 – LGPD", v2: null, rel: "NENHUM", sec: [], obs: "LGPD não está em Administrativo; conferir contra Legislação" },

  // ===== Direito Constitucional =====
  { mat: "CONST", ord: 1, pag: 3, titulo: "Aspectos Introdutórios do Direito Constitucional", v2: "trt4_2026p__const_t2", rel: "EXATO", sec: [], obs: "t2 = aplicabilidade, interpretação, vigência e eficácia" },
  { mat: "CONST", ord: 2, pag: 8, titulo: "Dos Princípios Fundamentais", v2: "trt4_2026p__const_t1", rel: "EXATO", sec: [] },
  { mat: "CONST", ord: 3, pag: 9, titulo: "Dos Direitos e Garantias Fundamentais", v2: "trt4_2026p__const_t4", rel: "CFC_MAIS_AMPLO", sec: ["trt4_2026p__const_t5"], obs: "Cobre t4 e t5 (nacionalidade e direitos políticos) no mesmo item" },
  { mat: "CONST", ord: 4, pag: 25, titulo: "Da Organização do Estado", v2: "trt4_2026p__const_t6", rel: "EXATO", sec: [] },
  { mat: "CONST", ord: 5, pag: 30, titulo: "Da Intervenção", v2: "trt4_2026p__const_t6", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "Intervenção federal integra a organização do Estado" },
  { mat: "CONST", ord: 6, pag: 32, titulo: "Da Administração Pública", v2: "trt4_2026p__const_t7", rel: "EXATO", sec: ["trt4_2026p__adm_t4"] },
  { mat: "CONST", ord: 7, pag: 42, titulo: "Do Poder Legislativo", v2: "trt4_2026p__const_t9", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "t9 = Congresso + processo legislativo; itens 7, 8 e 9 o compõem" },
  { mat: "CONST", ord: 8, pag: 48, titulo: "Do Processo Legislativo", v2: "trt4_2026p__const_t9", rel: "CFC_MAIS_ESTREITO", sec: [] },
  { mat: "CONST", ord: 9, pag: 52, titulo: "Da Fiscalização Contábil, Financeira e Orçamentária", v2: "trt4_2026p__const_t9", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "TCU é função do Legislativo" },
  { mat: "CONST", ord: 10, pag: 55, titulo: "Do Poder Executivo", v2: "trt4_2026p__const_t8", rel: "EXATO", sec: [] },
  { mat: "CONST", ord: 11, pag: 60, titulo: "Do Poder Judiciário", v2: "trt4_2026p__const_t10", rel: "EXATO", sec: [] },
  { mat: "CONST", ord: 12, pag: 68, titulo: "Das Funções Essenciais à Justiça", v2: "trt4_2026p__const_t11", rel: "EXATO", sec: [] },
  { mat: "CONST", ord: 13, pag: 71, titulo: "Da Defesa do Estado e das Instituições Democráticas", v2: null, rel: "NENHUM", sec: [], obs: "Não consta nos 11 tópicos do edital" },
  { mat: "CONST", ord: 14, pag: 73, titulo: "Da Ordem Social", v2: null, rel: "NENHUM", sec: [], obs: "Não consta nos 11 tópicos do edital" },
  { mat: "CONST", ord: 15, pag: 77, titulo: "Controle de Constitucionalidade", v2: "trt4_2026p__const_t3", rel: "EXATO", sec: ["trt4_2026p__proc_civil_t15"], obs: "Também dá suporte a Proc. Civil t15" },

  // ===== Direito do Trabalho =====
  { mat: "TRAB", ord: 1, pag: 3, titulo: "Princípios e Fontes do Direito do Trabalho", v2: "trt4_2026p__trab_t1", rel: "EXATO", sec: [] },
  { mat: "TRAB", ord: 2, pag: 4, titulo: "Direitos Trabalhistas Previstos Constitucionalmente", v2: "trt4_2026p__trab_t1", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "t1 inclui direitos constitucionais dos trabalhadores" },
  { mat: "TRAB", ord: 3, pag: 6, titulo: "Empregador, Empregado e Relação de Emprego", v2: "trt4_2026p__trab_t3", rel: "CFC_MAIS_AMPLO", sec: ["trt4_2026p__trab_t2"], obs: "Cobre t2 (relação de trabalho × emprego) e t3" },
  { mat: "TRAB", ord: 4, pag: 7, titulo: "Contrato de Trabalho", v2: "trt4_2026p__trab_t5", rel: "CFC_MAIS_AMPLO", sec: ["trt4_2026p__trab_t6"], obs: "Cobre t5 e t6 (suspensão e interrupção)" },
  { mat: "TRAB", ord: 5, pag: 10, titulo: "Contratos Especiais de Trabalho", v2: "trt4_2026p__trab_t5", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "Doméstico e temporário dentro de contrato individual" },
  { mat: "TRAB", ord: 6, pag: 11, titulo: "Remuneração", v2: "trt4_2026p__trab_t11", rel: "CFC_MAIS_AMPLO", sec: ["trt4_2026p__trab_t13"], obs: "Insalubridade e periculosidade também tocam t13" },
  { mat: "TRAB", ord: 7, pag: 14, titulo: "Duração do Trabalho", v2: "trt4_2026p__trab_t9", rel: "EXATO", sec: [] },
  { mat: "TRAB", ord: 8, pag: 16, titulo: "Teletrabalho", v2: "trt4_2026p__trab_t16", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "t16 = renúncia, transação, teletrabalho e dano moral" },
  { mat: "TRAB", ord: 9, pag: 17, titulo: "Férias Anuais", v2: "trt4_2026p__trab_t10", rel: "EXATO", sec: [] },
  { mat: "TRAB", ord: 10, pag: 19, titulo: "Rescisão do Contrato de Trabalho", v2: "trt4_2026p__trab_t7", rel: "EXATO", sec: [] },
  { mat: "TRAB", ord: 11, pag: 21, titulo: "Aviso Prévio", v2: "trt4_2026p__trab_t7", rel: "CFC_MAIS_ESTREITO", sec: ["trt4_2026p__trab_t8"], obs: "Aviso prévio integra a rescisão" },
  { mat: "TRAB", ord: 12, pag: 22, titulo: "Tutelas Especiais", v2: "trt4_2026p__trab_t14", rel: "EXATO", sec: [], obs: "Proteção da mulher e do menor" },
  { mat: "TRAB", ord: 13, pag: 24, titulo: "Responsabilidade Trabalhista", v2: "trt4_2026p__trab_t17", rel: "PARCIAL", sec: ["trt4_2026p__trab_t3"], obs: "Grupo econômico e sucessão ficam mais perto de t3 que de t17" },
  { mat: "TRAB", ord: 14, pag: 25, titulo: "Convenções Coletivas de Trabalho", v2: "trt4_2026p__trab_t15", rel: "EXATO", sec: [] },
  { mat: "TRAB", ord: 15, pag: 26, titulo: "Prescrição", v2: "trt4_2026p__trab_t12", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "t12 = FGTS + prescrição; o CFC não traz FGTS" },
  { mat: "TRAB", ord: 16, pag: 27, titulo: "Jurisprudências (Súmulas STF/STJ/TST e OJ)", v2: "trt4_2026p__trab_t18", rel: "EXATO", sec: [], obs: "O Estratégia não tinha este tópico — o CFC cobre" },

  // ===== Direito Processual Civil =====
  { mat: "PCIV", ord: 1, pag: 3, titulo: "Introdução", v2: "trt4_2026p__proc_civil_t1", rel: "EXATO", sec: [] },
  { mat: "PCIV", ord: 2, pag: 5, titulo: "Da Função Jurisdicional", v2: "trt4_2026p__proc_civil_t2", rel: "CFC_MAIS_AMPLO", sec: ["trt4_2026p__proc_civil_t3"], obs: "Jurisdição, competência e cooperação internacional" },
  { mat: "PCIV", ord: 3, pag: 10, titulo: "Partes e dos Procuradores - Sujeitos do Processo", v2: "trt4_2026p__proc_civil_t4", rel: "CFC_MAIS_AMPLO", sec: ["trt4_2026p__proc_civil_t5"], obs: "Litisconsórcio e intervenção de terceiros (t5) no mesmo item" },
  { mat: "PCIV", ord: 4, pag: 17, titulo: "Juiz e dos Auxiliares da Justiça", v2: "trt4_2026p__proc_civil_t6", rel: "EXATO", sec: [] },
  { mat: "PCIV", ord: 5, pag: 22, titulo: "Atos Processuais", v2: "trt4_2026p__proc_civil_t7", rel: "EXATO", sec: [] },
  { mat: "PCIV", ord: 6, pag: 31, titulo: "Tutela Provisória (arts. 294 a 311)", v2: "trt4_2026p__proc_civil_t8", rel: "CFC_MAIS_ESTREITO", sec: [], obs: "t8 = tutela + formação/suspensão/extinção; itens 6 e 7 o compõem" },
  { mat: "PCIV", ord: 7, pag: 33, titulo: "Formação, Suspensão e Extinção do Processo", v2: "trt4_2026p__proc_civil_t8", rel: "CFC_MAIS_ESTREITO", sec: [] },
  { mat: "PCIV", ord: 8, pag: 34, titulo: "Procedimento Comum", v2: "trt4_2026p__proc_civil_t9", rel: "CFC_MAIS_AMPLO", sec: ["trt4_2026p__proc_civil_t10", "trt4_2026p__proc_civil_t11"], obs: "Inclui provas (t10) e sentença/coisa julgada (t11)" },
  { mat: "PCIV", ord: 9, pag: 47, titulo: "Cumprimento da Sentença (arts. 513 a 538)", v2: "trt4_2026p__proc_civil_t11", rel: "CFC_MAIS_ESTREITO", sec: [] },
  { mat: "PCIV", ord: 10, pag: 51, titulo: "Do Processo de Execução", v2: "trt4_2026p__proc_civil_t13", rel: "EXATO", sec: [] },
  { mat: "PCIV", ord: 11, pag: 54, titulo: "Meios de Impugnação das Decisões Judiciais", v2: "trt4_2026p__proc_civil_t12", rel: "CFC_MAIS_ESTREITO", sec: ["trt4_2026p__proc_civil_t14"], obs: "Ação rescisória, IRDR, reclamação" },
  { mat: "PCIV", ord: 12, pag: 59, titulo: "Dos Recursos", v2: "trt4_2026p__proc_civil_t12", rel: "EXATO", sec: [] },
  { mat: "PCIV", ord: 13, pag: 66, titulo: "Tabela Auxiliar de Prazos", v2: null, rel: "NENHUM", sec: [], obs: "Tabela de consulta, não é tópico" },

  // ===== Direito Processual do Trabalho =====
  { mat: "PTRAB", ord: 1, pag: 2, titulo: "Organização da Justiça do Trabalho", v2: "trt4_2026p__proc_trab_t1", rel: "EXATO", sec: ["trt4_2026p__proc_trab_t2"] },
  { mat: "PTRAB", ord: 2, pag: 3, titulo: "Jurisdição e Competência da Justiça do Trabalho", v2: "trt4_2026p__proc_trab_t1", rel: "CFC_MAIS_ESTREITO", sec: [] },
  { mat: "PTRAB", ord: 3, pag: 5, titulo: "Do Processo em Geral", v2: "trt4_2026p__proc_trab_t5", rel: "CFC_MAIS_AMPLO", sec: ["trt4_2026p__proc_trab_t6", "trt4_2026p__proc_trab_t7", "trt4_2026p__proc_trab_t8", "trt4_2026p__proc_trab_t10"], obs: "Atos, prazos, custas, partes, exceções e provas num item só" },
  { mat: "PTRAB", ord: 4, pag: 10, titulo: "Dos Dissídios Individuais", v2: "trt4_2026p__proc_trab_t11", rel: "CFC_MAIS_AMPLO", sec: ["trt4_2026p__proc_trab_t9", "trt4_2026p__proc_trab_t12", "trt4_2026p__proc_trab_t13"], obs: "Audiências, procedimentos especiais e jurisdição voluntária" },
  { mat: "PTRAB", ord: 5, pag: 14, titulo: "Da Execução", v2: "trt4_2026p__proc_trab_t15", rel: "CFC_MAIS_AMPLO", sec: ["trt4_2026p__proc_trab_t14", "trt4_2026p__proc_trab_t16"], obs: "Liquidação, execução, garantias e embargos" },
  { mat: "PTRAB", ord: 6, pag: 16, titulo: "Recursos Trabalhistas", v2: "trt4_2026p__proc_trab_t17", rel: "EXATO", sec: [] },
  { mat: "PTRAB", ord: 7, pag: 19, titulo: "Prescrição no Direito Processual do Trabalho", v2: null, rel: "NENHUM", sec: ["trt4_2026p__trab_t12"], obs: "Prescrição está no edital de Direito do Trabalho, não no processual" },
  { mat: "PTRAB", ord: 8, pag: 19, titulo: "Jurisprudências (Súmulas STF/STJ/TST e OJ)", v2: "trt4_2026p__proc_trab_t20", rel: "EXATO", sec: [], obs: "O Estratégia não tinha este tópico — o CFC cobre" },
];
