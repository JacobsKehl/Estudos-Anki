import fs from "fs";
import path from "path";
import { OFFICIAL_TOPICS } from "../src/lib/constants/official-topics";

// ═══ MAPEAMENTOS DE-PARA ═══

// Mapeamento De-Para: subjectName em OFFICIAL_TOPICS -> subjectCanonicalKey
// Corresponde 1:1 com as 7 matérias distintas presentes em official-topics.ts
const SUBJECT_CANONICAL_MAP: Record<string, string> = {
  "Língua Portuguesa": "PORTUGUESE",
  "Direito Constitucional": "DIREITO_CONSTITUCIONAL",
  "Direito Processual do Trabalho": "DIREITO_PROCESSUAL_TRABALHO",
  "Direito do Trabalho": "DIREITO_TRABALHO",
  "Direito Processual Civil": "DIREITO_PROCESSUAL_CIVIL",
  "Direito Administrativo": "DIREITO_ADMINISTRATIVO",
  "Direito Civil": "DIREITO_CIVIL",
};

// ═══ VERSÃO 2: TRT4_2026_PROJETADO ═══
// 109 tópicos do edital verticalizado, fornecidos pelo usuário em agosto/2026
// Inclui matérias que não existem como StudySubject hoje (RLM, Legislação) — elas ficam semeadas
// e sem blocos associados até o peso 1 voltar em novembro.
interface ProjetadoTopic {
  id: string;
  subjectCanonicalKey: string;
  subjectName: string;
  topicCode: string;
  title: string;
  normalizedTitle: string;
  orderIndex: number;
  weight: number;
  blocoConhecimento: string;
  questoesDaMateria: number;
}

const TRT4_2026_PROJETADO_TOPICS: ProjetadoTopic[] = [
  // ── Direito Constitucional (11 tópicos, peso 2, ESPECIFICOS) ──
  { id: "trt4_2026p__const_t1", subjectCanonicalKey: "DIREITO_CONSTITUCIONAL", subjectName: "Direito Constitucional", topicCode: "Tópico 01", title: "Constituição: Princípios fundamentais", normalizedTitle: "constituicao principios fundamentais", orderIndex: 1, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__const_t2", subjectCanonicalKey: "DIREITO_CONSTITUCIONAL", subjectName: "Direito Constitucional", topicCode: "Tópico 02", title: "Aplicabilidade, interpretação, vigência e eficácia das normas constitucionais", normalizedTitle: "aplicabilidade interpretacao vigencia e eficacia das normas constitucionais", orderIndex: 2, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__const_t3", subjectCanonicalKey: "DIREITO_CONSTITUCIONAL", subjectName: "Direito Constitucional", topicCode: "Tópico 03", title: "Controle de Constitucionalidade: Sistemas difuso e concentrado; ADI, ADC e ADPF", normalizedTitle: "controle de constitucionalidade sistemas difuso e concentrado adi adc e adpf", orderIndex: 3, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__const_t4", subjectCanonicalKey: "DIREITO_CONSTITUCIONAL", subjectName: "Direito Constitucional", topicCode: "Tópico 04", title: "Direitos e Garantias Fundamentais: Direitos e deveres individuais e coletivos; Direitos sociais", normalizedTitle: "direitos e garantias fundamentais direitos e deveres individuais e coletivos direitos sociais", orderIndex: 4, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__const_t5", subjectCanonicalKey: "DIREITO_CONSTITUCIONAL", subjectName: "Direito Constitucional", topicCode: "Tópico 05", title: "Direitos e Garantias Fundamentais: Nacionalidade e Direitos políticos", normalizedTitle: "direitos e garantias fundamentais nacionalidade e direitos politicos", orderIndex: 5, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__const_t6", subjectCanonicalKey: "DIREITO_CONSTITUCIONAL", subjectName: "Direito Constitucional", topicCode: "Tópico 06", title: "Organização do Estado: Organização político-administrativa da União, Estados, Municípios, DF e Territórios", normalizedTitle: "organizacao do estado organizacao politico administrativa da uniao estados municipios df e territorios", orderIndex: 6, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__const_t7", subjectCanonicalKey: "DIREITO_CONSTITUCIONAL", subjectName: "Direito Constitucional", topicCode: "Tópico 07", title: "Administração Pública: Disposições gerais e Servidores Públicos", normalizedTitle: "administracao publica disposicoes gerais e servidores publicos", orderIndex: 7, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__const_t8", subjectCanonicalKey: "DIREITO_CONSTITUCIONAL", subjectName: "Direito Constitucional", topicCode: "Tópico 08", title: "Poder Executivo: Atribuições e responsabilidades do Presidente da República", normalizedTitle: "poder executivo atribuicoes e responsabilidades do presidente da republica", orderIndex: 8, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__const_t9", subjectCanonicalKey: "DIREITO_CONSTITUCIONAL", subjectName: "Direito Constitucional", topicCode: "Tópico 09", title: "Poder Legislativo: Congresso Nacional, Câmara, Senado, Processo Legislativo e Fiscalização Contábil/Financeira/Orçamentária", normalizedTitle: "poder legislativo congresso nacional camara senado processo legislativo e fiscalizacao contabil financeira orcamentaria", orderIndex: 9, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__const_t10", subjectCanonicalKey: "DIREITO_CONSTITUCIONAL", subjectName: "Direito Constitucional", topicCode: "Tópico 10", title: "Poder Judiciário: Disposições gerais; STF; CNJ; STJ; Tribunais e Juízes do Trabalho; CSJT", normalizedTitle: "poder judiciario disposicoes gerais stf cnj stj tribunais e juizes do trabalho csjt", orderIndex: 10, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__const_t11", subjectCanonicalKey: "DIREITO_CONSTITUCIONAL", subjectName: "Direito Constitucional", topicCode: "Tópico 11", title: "Funções Essenciais à Justiça: Ministério Público, Advocacia Pública, Advocacia e Defensoria Pública", normalizedTitle: "funcoes essenciais a justica ministerio publico advocacia publica advocacia e defensoria publica", orderIndex: 11, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },

  // ── Direito Processual do Trabalho (20 tópicos, peso 2, ESPECIFICOS) ──
  { id: "trt4_2026p__proc_trab_t1", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 01", title: "Justiça do Trabalho: Organização e competência (Varas, TRTs e TST)", normalizedTitle: "justica do trabalho organizacao e competencia varas trts e tst", orderIndex: 1, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t2", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 02", title: "Serviços auxiliares da Justiça do Trabalho (Secretarias, Distribuidores, Oficial de Justiça, Peritos, Honorários Periciais, Gratuidade)", normalizedTitle: "servicos auxiliares da justica do trabalho secretarias distribuidores oficial de justica peritos honorarios periciais gratuidade", orderIndex: 2, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t3", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 03", title: "Ministério Público do Trabalho: Organização e competência", normalizedTitle: "ministerio publico do trabalho organizacao e competencia", orderIndex: 3, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t4", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 04", title: "Princípios gerais do processo trabalhista (aplicação subsidiária do CPC). Prescrição, decadência e prescrição intercorrente", normalizedTitle: "principios gerais do processo trabalhista aplicacao subsidiaria do cpc prescricao decadencia e prescricao intercorrente", orderIndex: 4, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t5", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 05", title: "Atos, termos e prazos processuais. Distribuição. Valor da causa. Custas e emolumentos", normalizedTitle: "atos termos e prazos processuais distribuicao valor da causa custas e emolumentos", orderIndex: 5, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t6", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 06", title: "Partes e procuradores: Jus postulandi; Substituição e representação processual; Massa falida e Recuperação Judicial", normalizedTitle: "partes e procuradores jus postulandi substituicao e representacao processual massa falida e recuperacao judicial", orderIndex: 6, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t7", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 07", title: "Litisconsórcio, Assistência judiciária, Honorários advocatícios", normalizedTitle: "litisconsorcio assistencia judiciaria honorarios advocaticios", orderIndex: 7, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t8", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 08", title: "Nulidades e Exceções. Dano processual. Conflitos de jurisdição/competência", normalizedTitle: "nulidades e excecoes dano processual conflitos de jurisdicao competencia", orderIndex: 8, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t9", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 09", title: "Audiências (conciliação, instrução, julgamento); Notificação, Arquivamento, Revelia e Confissão", normalizedTitle: "audiencias conciliacao instrucao julgamento notificacao arquivamento revelia e confissao", orderIndex: 9, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t10", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 10", title: "Provas. Decisão e sua eficácia", normalizedTitle: "provas decisao e sua eficacia", orderIndex: 10, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t11", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 11", title: "Dissídios individuais: Reclamação escrita e verbal, Legitimidade, Procedimento Ordinário e Sumaríssimo", normalizedTitle: "dissidios individuais reclamacao escrita e verbal legitimidade procedimento ordinario e sumarissimo", orderIndex: 11, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t12", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 12", title: "Procedimentos especiais: Inquérito para apuração de falta grave, Ação Rescisória, Mandado de Segurança, Ação Civil Pública", normalizedTitle: "procedimentos especiais inquerito para apuracao de falta grave acao rescisoria mandado de seguranca acao civil publica", orderIndex: 12, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t13", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 13", title: "IDPJ e Homologação de acordo extrajudicial (Jurisdição Voluntária)", normalizedTitle: "idpj e homologacao de acordo extrajudicial jurisdicao voluntaria", orderIndex: 13, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t14", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 14", title: "Liquidação da sentença (cálculo, artigos, arbitramento). Dissídios coletivos (extensão, cumprimento, revisão)", normalizedTitle: "liquidacao da sentenca calculo artigos arbitramento dissidios coletivos extensao cumprimento revisao", orderIndex: 14, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t15", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 15", title: "Execução: Provisória e definitiva, Prestações sucessivas, Fazenda Pública, Massa Falida. Citação, depósito, penhora, bens impenhoráveis (Lei 8.009/90)", normalizedTitle: "execucao provisoria e definitiva prestacoes sucessivas fazenda publica massa falida citacao deposito penhora bens impenhoraveis lei 8 009 90", orderIndex: 15, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t16", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 16", title: "Garantias na execução (Seguro-fiança, seguro-garantia). Embargos à execução, Impugnação, Embargos de terceiro, Praça/Leilão/Arrematação", normalizedTitle: "garantias na execucao seguro fianca seguro garantia embargos a execucao impugnacao embargos de terceiro praca leilao arrematacao", orderIndex: 16, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t17", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 17", title: "Recursos no processo do trabalho", normalizedTitle: "recursos no processo do trabalho", orderIndex: 17, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t18", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 18", title: "Processo Judicial Eletrônico (PJe); Reforma Trabalhista (Lei 13.467/2017); Leis 6.858/80 e 5.584/70", normalizedTitle: "processo judicial eletronico pje reforma trabalhista lei 13 467 2017 leis 6 858 80 e 5 584 70", orderIndex: 18, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t19", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 19", title: "Política Judiciária de Solução de Disputas (Res. CSJT 174/16 e 288/21, RA TRT4 05/22)", normalizedTitle: "politica judiciaria de solucao de disputas res csjt 174 16 e 288 21 ra trt4 05 22", orderIndex: 19, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_trab_t20", subjectCanonicalKey: "DIREITO_PROCESSUAL_TRABALHO", subjectName: "Direito Processual do Trabalho", topicCode: "Tópico 20", title: "Súmulas, OJ, IN e Atos do TST; Súmulas Vinculantes do STF relativas ao Processo do Trabalho", normalizedTitle: "sumulas oj in e atos do tst sumulas vinculantes do stf relativas ao processo do trabalho", orderIndex: 20, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },

  // ── Direito do Trabalho (18 tópicos, peso 2, ESPECIFICOS) ──
  { id: "trt4_2026p__trab_t1", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 01", title: "Princípios e fontes do Direito do Trabalho. Direitos constitucionais dos trabalhadores (art. 7º CF/88)", normalizedTitle: "principios e fontes do direito do trabalho direitos constitucionais dos trabalhadores art 7o cf 88", orderIndex: 1, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t2", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 02", title: "Relação de trabalho vs. relação de emprego; Trabalho autônomo, eventual, temporário, avulso e intermitente", normalizedTitle: "relacao de trabalho vs relacao de emprego trabalho autonomo eventual temporario avulso e intermitente", orderIndex: 2, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t3", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 03", title: "Sujeitos do contrato: Empregado e Empregador; Poderes do empregador; Grupo econômico; Sucessão; Responsabilidade solidária e subsidiária", normalizedTitle: "sujeitos do contrato empregado e empregador poderes do empregador grupo economico sucessao responsabilidade solidaria e subsidiaria", orderIndex: 3, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t4", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 04", title: "CTPS: Emissão, entrega, anotações e valor probatório", normalizedTitle: "ctps emissao entrega anotacoes e valor probatorio", orderIndex: 4, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t5", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 05", title: "Contrato individual de trabalho: Conceito, classificação, características; Alteração (unilateral/bilateral, jus variandi)", normalizedTitle: "contrato individual de trabalho conceito classificacao caracteristicas alteracao unilateral bilateral jus variandi", orderIndex: 5, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t6", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 06", title: "Suspensão e Interrupção do contrato de trabalho", normalizedTitle: "suspensao e interrupcao do contrato de trabalho", orderIndex: 6, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t7", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 07", title: "Rescisão contratual: Justas causas, Despedida indireta, Dispensa arbitrária, Despedida coletiva, Culpa recíproca, Indenização, Aviso prévio", normalizedTitle: "rescisao contratual justas causas despedida indireta dispensa arbitraria despedida coletiva culpa reciproca indenizacao aviso previo", orderIndex: 7, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t8", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 08", title: "Estabilidade e garantias provisórias de emprego; Reintegração; Força maior", normalizedTitle: "estabilidade e garantias provisorias de emprego reintegracao forca maior", orderIndex: 8, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t9", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 09", title: "Duração do trabalho: Jornada, In itinere, Descansos, Intervalos, DSR, Trabalho noturno e extraordinário, Compensação de horas", normalizedTitle: "duracao do trabalho jornada in itinere descansos intervalos dsr trabalho noturno e extraordinario compensacao de horas", orderIndex: 9, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t10", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 10", title: "Salário mínimo; Férias (duração, concessão, coletivas, remuneração, abono, rescisão)", normalizedTitle: "salario minimo ferias duracao concessao coletivas remuneracao abono rescisao", orderIndex: 10, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t11", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 11", title: "Salário e Remuneração: Conceito, composição, modalidades, pagamento, 13º salário; Equiparação salarial, Desvio de função", normalizedTitle: "salario e remuneracao conceito composicao modalidades pagamento 13o salario equiparacao salarial desvio de funcao", orderIndex: 11, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t12", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 12", title: "FGTS. Prescrição e decadência trabalhista", normalizedTitle: "fgts prescricao e decadencia trabalhista", orderIndex: 12, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t13", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 13", title: "Segurança e Medicina no Trabalho: CIPA, EPI, Atividades insalubres e perigosas", normalizedTitle: "seguranca e medicina no trabalho cipa epi atividades insalubres e perigosas", orderIndex: 13, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t14", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 14", title: "Proteção ao trabalho da mulher, gestante e menor. Licença-maternidade e estabilidade da gestante (art. 10, ADCT)", normalizedTitle: "protecao ao trabalho da mulher gestante e menor licenca maternidade e estabilidade da gestante art 10 adct", orderIndex: 14, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t15", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 15", title: "Direito Coletivo: Liberdade sindical (Convenção 87 OIT), Categoria diferenciada, Convenções e Acordos Coletivos, Greve", normalizedTitle: "direito coletivo liberdade sindical convencao 87 oit categoria diferenciada convencoes e acordos coletivos greve", orderIndex: 15, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t16", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 16", title: "Renúncia e Transação. Teletrabalho (Lei 13.467/2017). Dano moral trabalhista", normalizedTitle: "renuncia e transacao teletrabalho lei 13 467 2017 dano moral trabalhista", orderIndex: 16, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t17", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 17", title: "Acidentes de trabalho; Responsabilidade civil trabalhista; Assédio moral e sexual; Princípio da não discriminação", normalizedTitle: "acidentes de trabalho responsabilidade civil trabalhista assedio moral e sexual principio da nao discriminacao", orderIndex: 17, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__trab_t18", subjectCanonicalKey: "DIREITO_TRABALHO", subjectName: "Direito do Trabalho", topicCode: "Tópico 18", title: "Súmulas, OJ e Atos do TST; Súmulas Vinculantes do STF relativas ao Direito do Trabalho", normalizedTitle: "sumulas oj e atos do tst sumulas vinculantes do stf relativas ao direito do trabalho", orderIndex: 18, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },

  // ── Direito Processual Civil (15 tópicos, peso 2, ESPECIFICOS) ──
  { id: "trt4_2026p__proc_civil_t1", subjectCanonicalKey: "DIREITO_PROCESSUAL_CIVIL", subjectName: "Direito Processual Civil", topicCode: "Tópico 01", title: "Código de Processo Civil (Lei 13.105/2015): Princípios gerais, fontes, eficácia, aplicação, interpretação e direito intertemporal", normalizedTitle: "codigo de processo civil lei 13 105 2015 principios gerais fontes eficacia aplicacao interpretacao e direito intertemporal", orderIndex: 1, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_civil_t2", subjectCanonicalKey: "DIREITO_PROCESSUAL_CIVIL", subjectName: "Direito Processual Civil", topicCode: "Tópico 02", title: "Jurisdição (conceito, características, limites) e Competência (absoluta, relativa, modificações, conflitos)", normalizedTitle: "jurisdicao conceito caracteristicas limites e competencia absoluta relativa modificacoes conflitos", orderIndex: 2, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_civil_t3", subjectCanonicalKey: "DIREITO_PROCESSUAL_CIVIL", subjectName: "Direito Processual Civil", topicCode: "Tópico 03", title: "Direito de ação (elementos, condições, cumulação, conexão e continência). Relação jurídica processual e pressupostos", normalizedTitle: "direito de acao elementos condicoes cumulacao conexao e continencia relacao juridica processual e pressupostos", orderIndex: 3, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_civil_t4", subjectCanonicalKey: "DIREITO_PROCESSUAL_CIVIL", subjectName: "Direito Processual Civil", topicCode: "Tópico 04", title: "Sujeitos do Processo: Partes, procuradores, capacidade, representação, honorários, gratuidade da justiça, Litisconsórcio", normalizedTitle: "sujeitos do processo partes procuradores capacidade representacao honorarios gratuidade da justica litisconsorcio", orderIndex: 4, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_civil_t5", subjectCanonicalKey: "DIREITO_PROCESSUAL_CIVIL", subjectName: "Direito Processual Civil", topicCode: "Tópico 05", title: "Intervenção de terceiros: Assistência, Denunciação, Chamamento, IDPJ, Amicus Curiae", normalizedTitle: "intervencao de terceiros assistencia denunciacao chamamento idpj amicus curiae", orderIndex: 5, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_civil_t6", subjectCanonicalKey: "DIREITO_PROCESSUAL_CIVIL", subjectName: "Direito Processual Civil", topicCode: "Tópico 06", title: "Juiz (poderes, deveres, impedimento e suspeição). Auxiliares da justiça, MP, Advocacia Pública e Defensoria Pública", normalizedTitle: "juiz poderes deveres impedimento e suspeicao auxiliares da justica mp advocacia publica e defensoria publica", orderIndex: 6, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_civil_t7", subjectCanonicalKey: "DIREITO_PROCESSUAL_CIVIL", subjectName: "Direito Processual Civil", topicCode: "Tópico 07", title: "Atos processuais (forma, tempo, lugar, prazos), Comunicação dos atos (citação, intimação) e Nulidades", normalizedTitle: "atos processuais forma tempo lugar prazos comunicacao dos atos citacao intimacao e nulidades", orderIndex: 7, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_civil_t8", subjectCanonicalKey: "DIREITO_PROCESSUAL_CIVIL", subjectName: "Direito Processual Civil", topicCode: "Tópico 08", title: "Tutela Provisória (urgência e evidência). Formação, suspensão e extinção do processo", normalizedTitle: "tutela provisoria urgencia e evidencia formacao suspensao e extincao do processo", orderIndex: 8, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_civil_t9", subjectCanonicalKey: "DIREITO_PROCESSUAL_CIVIL", subjectName: "Direito Processual Civil", topicCode: "Tópico 09", title: "Procedimento comum: Petição inicial, Contestação, Reconvenção, Revelia, Saneamento e Julgamento conforme o estado", normalizedTitle: "procedimento comum peticao inicial contestacao reconvencao revelia saneamento e julgamento conforme o estado", orderIndex: 9, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_civil_t10", subjectCanonicalKey: "DIREITO_PROCESSUAL_CIVIL", subjectName: "Direito Processual Civil", topicCode: "Tópico 10", title: "Provas: Ônus, depoimento pessoal, confissão, documentos, testemunhas, perícia, inspeção judicial", normalizedTitle: "provas onus depoimento pessoal confissao documentos testemunhas pericia inspecao judicial", orderIndex: 10, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_civil_t11", subjectCanonicalKey: "DIREITO_PROCESSUAL_CIVIL", subjectName: "Direito Processual Civil", topicCode: "Tópico 11", title: "Sentença (elementos, efeitos, remessa necessária), Coisa Julgada, Liquidação e Cumprimento de Sentença", normalizedTitle: "sentenca elementos efeitos remessa necessaria coisa julgada liquidacao e cumprimento de sentenca", orderIndex: 11, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_civil_t12", subjectCanonicalKey: "DIREITO_PROCESSUAL_CIVIL", subjectName: "Direito Processual Civil", topicCode: "Tópico 12", title: "Recursos: Disposições gerais, Agravo Interno e de Instrumento, Embargos de Declaração, Repercussão Geral, Recursos Repetitivos", normalizedTitle: "recursos disposicoes gerais agravo interno e de instrumento embargos de declaracao repercussao geral recursos repetitivos", orderIndex: 12, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_civil_t13", subjectCanonicalKey: "DIREITO_PROCESSUAL_CIVIL", subjectName: "Direito Processual Civil", topicCode: "Tópico 13", title: "Processo de Execução: Princípios, execução contra a Fazenda Pública (Precatórios e RPV), Penhora, Expropriação, Embargos, Exceção de Pré-executividade", normalizedTitle: "processo de execucao principios execucao contra a fazenda publica precatorios e rpv penhora expropriacao embargos excecao de pre executividade", orderIndex: 13, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_civil_t14", subjectCanonicalKey: "DIREITO_PROCESSUAL_CIVIL", subjectName: "Direito Processual Civil", topicCode: "Tópico 14", title: "Procedimentos especiais e Ações Constitucionais: Consignação, Embargos de Terceiro, Monitória, Ação Civil Pública, Mandado de Segurança, Mandado de Injunção, Habeas Data", normalizedTitle: "procedimentos especiais e acoes constitucionais consignacao embargos de terceiro monitoria acao civil publica mandado de seguranca mandado de injuncao habeas data", orderIndex: 14, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__proc_civil_t15", subjectCanonicalKey: "DIREITO_PROCESSUAL_CIVIL", subjectName: "Direito Processual Civil", topicCode: "Tópico 15", title: "Controle de Constitucionalidade no CPC: ADI, ADC, Arguição incidental, IAC, IRDR, Ação Rescisória, Reclamação", normalizedTitle: "controle de constitucionalidade no cpc adi adc arguicao incidental iac irdr acao rescisoria reclamacao", orderIndex: 15, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },

  // ── Direito Administrativo (11 tópicos, peso 2, ESPECIFICOS) ──
  { id: "trt4_2026p__adm_t1", subjectCanonicalKey: "DIREITO_ADMINISTRATIVO", subjectName: "Direito Administrativo", topicCode: "Tópico 01", title: "Administração Pública: Princípios básicos e Poderes Administrativos (hierárquico, disciplinar, regulamentar, polícia, uso/abuso de poder)", normalizedTitle: "administracao publica principios basicos e poderes administrativos hierarquico disciplinar regulamentar policia uso abuso de poder", orderIndex: 1, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__adm_t2", subjectCanonicalKey: "DIREITO_ADMINISTRATIVO", subjectName: "Direito Administrativo", topicCode: "Tópico 02", title: "Ato administrativo: Conceito, requisitos, atributos, anulação, revogação, convalidação, discricionariedade e vinculação", normalizedTitle: "ato administrativo conceito requisitos atributos anulacao revogacao convalidacao discricionariedade e vinculacao", orderIndex: 2, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__adm_t3", subjectCanonicalKey: "DIREITO_ADMINISTRATIVO", subjectName: "Direito Administrativo", topicCode: "Tópico 03", title: "Organização administrativa: Administração direta e indireta, Autarquias, Fundações, Empresas Públicas, Sociedades de Economia Mista, Consórcios Públicos (Lei 11.107/05)", normalizedTitle: "organizacao administrativa administracao direta e indireta autarquias fundacoes empresas publicas sociedades de economia mista consorcios publicos lei 11 107 05", orderIndex: 3, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__adm_t4", subjectCanonicalKey: "DIREITO_ADMINISTRATIVO", subjectName: "Direito Administrativo", topicCode: "Tópico 04", title: "Servidores públicos: Cargo, emprego e função; Lei nº 8.112/1990; Lei nº 11.416/2006 (Carreiras do PJU)", normalizedTitle: "servidores publicos cargo emprego e funcao lei no 8 112 1990 lei no 11 416 2006 carreiras do pju", orderIndex: 4, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__adm_t5", subjectCanonicalKey: "DIREITO_ADMINISTRATIVO", subjectName: "Direito Administrativo", topicCode: "Tópico 05", title: "Processo administrativo federal (Lei nº 9.784/1999)", normalizedTitle: "processo administrativo federal lei no 9 784 1999", orderIndex: 5, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__adm_t6", subjectCanonicalKey: "DIREITO_ADMINISTRATIVO", subjectName: "Direito Administrativo", topicCode: "Tópico 06", title: "Controle e responsabilização da administração (administrativo, judicial, legislativo); Responsabilidade extracontratual do Estado", normalizedTitle: "controle e responsabilizacao da administracao administrativo judicial legislativo responsabilidade extracontratual do estado", orderIndex: 6, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__adm_t7", subjectCanonicalKey: "DIREITO_ADMINISTRATIVO", subjectName: "Direito Administrativo", topicCode: "Tópico 07", title: "Improbidade Administrativa (Lei nº 8.429/1992 e Lei nº 14.230/2021)", normalizedTitle: "improbidade administrativa lei no 8 429 1992 e lei no 14 230 2021", orderIndex: 7, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__adm_t8", subjectCanonicalKey: "DIREITO_ADMINISTRATIVO", subjectName: "Direito Administrativo", topicCode: "Tópico 08", title: "Nova Lei de Licitações e Contratos Administrativos (Lei nº 14.133/2021)", normalizedTitle: "nova lei de licitacoes e contratos administrativos lei no 14 133 2021", orderIndex: 8, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__adm_t9", subjectCanonicalKey: "DIREITO_ADMINISTRATIVO", subjectName: "Direito Administrativo", topicCode: "Tópico 09", title: "Serviços públicos: Conceito, regime jurídico, princípios, delegação (autorização, permissão, concessão)", normalizedTitle: "servicos publicos conceito regime juridico principios delegacao autorizacao permissao concessao", orderIndex: 9, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__adm_t10", subjectCanonicalKey: "DIREITO_ADMINISTRATIVO", subjectName: "Direito Administrativo", topicCode: "Tópico 10", title: "Bens públicos (classificação, regime jurídico, formas de uso) e Intervenção do Estado na propriedade (desapropriação, servidão, tombamento)", normalizedTitle: "bens publicos classificacao regime juridico formas de uso e intervencao do estado na propriedade desapropriacao servidao tombamento", orderIndex: 10, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },
  { id: "trt4_2026p__adm_t11", subjectCanonicalKey: "DIREITO_ADMINISTRATIVO", subjectName: "Direito Administrativo", topicCode: "Tópico 11", title: "Terceiro Setor e Entes paraestatais", normalizedTitle: "terceiro setor e entes paraestatais", orderIndex: 11, weight: 2.0, blocoConhecimento: "ESPECIFICOS", questoesDaMateria: 30 },

  // ── Língua Portuguesa (18 tópicos, peso 1, GERAIS) ──
  { id: "trt4_2026p__port_t1", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 01", title: "Domínio da ortografia oficial", normalizedTitle: "dominio da ortografia oficial", orderIndex: 1, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t2", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 02", title: "Emprego da acentuação gráfica", normalizedTitle: "emprego da acentuacao grafica", orderIndex: 2, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t3", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 03", title: "Emprego dos sinais de pontuação", normalizedTitle: "emprego dos sinais de pontuacao", orderIndex: 3, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t4", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 04", title: "Emprego do sinal indicativo de crase", normalizedTitle: "emprego do sinal indicativo de crase", orderIndex: 4, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t5", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 05", title: "Flexão nominal e verbal", normalizedTitle: "flexao nominal e verbal", orderIndex: 5, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t6", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 06", title: "Pronomes: emprego, formas de tratamento e colocação (pronominal)", normalizedTitle: "pronomes emprego formas de tratamento e colocacao pronominal", orderIndex: 6, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t7", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 07", title: "Domínio dos mecanismos de coesão e coerência textual", normalizedTitle: "dominio dos mecanismos de coesao e coerencia textual", orderIndex: 7, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t8", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 08", title: "Emprego de tempos e modos verbais e Vozes do verbo", normalizedTitle: "emprego de tempos e modos verbais e vozes do verbo", orderIndex: 8, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t9", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 09", title: "Concordância nominal e verbal", normalizedTitle: "concordancia nominal e verbal", orderIndex: 9, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t10", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 10", title: "Regência nominal e verbal", normalizedTitle: "regencia nominal e verbal", orderIndex: 10, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t11", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 11", title: "Morfossintaxe, Classes de palavras e Termos da oração", normalizedTitle: "morfossintaxe classes de palavras e termos da oracao", orderIndex: 11, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t12", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 12", title: "Processos de coordenação e subordinação", normalizedTitle: "processos de coordenacao e subordinacao", orderIndex: 12, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t13", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 13", title: "Redação (confronto e reconhecimento de frases corretas e incorretas)", normalizedTitle: "redacao confronto e reconhecimento de frases corretas e incorretas", orderIndex: 13, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t14", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 14", title: "Compreensão e interpretação de textos de gêneros variados", normalizedTitle: "compreensao e interpretacao de textos de generos variados", orderIndex: 14, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t15", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 15", title: "Reconhecimento de tipos e gêneros textuais", normalizedTitle: "reconhecimento de tipos e generos textuais", orderIndex: 15, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t16", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 16", title: "Figuras de linguagem e Argumentação", normalizedTitle: "figuras de linguagem e argumentacao", orderIndex: 16, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t17", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 17", title: "Discurso direto, indireto e indireto livre", normalizedTitle: "discurso direto indireto e indireto livre", orderIndex: 17, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__port_t18", subjectCanonicalKey: "PORTUGUESE", subjectName: "Língua Portuguesa", topicCode: "Tópico 18", title: "Adequação da linguagem ao tipo de documento", normalizedTitle: "adequacao da linguagem ao tipo de documento", orderIndex: 18, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },

  // ── Raciocínio Lógico-Matemático (6 tópicos, peso 1, GERAIS) ──
  { id: "trt4_2026p__rlm_t1", subjectCanonicalKey: "RACIOCINIO_LOGICO_MATEMATICO", subjectName: "Raciocínio Lógico-Matemático", topicCode: "Tópico 01", title: "Números inteiros e racionais: operações; expressões numéricas; múltiplos e divisores; problemas", normalizedTitle: "numeros inteiros e racionais operacoes expressoes numericas multiplos e divisores problemas", orderIndex: 1, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__rlm_t2", subjectCanonicalKey: "RACIOCINIO_LOGICO_MATEMATICO", subjectName: "Raciocínio Lógico-Matemático", topicCode: "Tópico 02", title: "Frações e operações com frações", normalizedTitle: "fracoes e operacoes com fracoes", orderIndex: 2, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__rlm_t3", subjectCanonicalKey: "RACIOCINIO_LOGICO_MATEMATICO", subjectName: "Raciocínio Lógico-Matemático", topicCode: "Tópico 03", title: "Números e grandezas proporcionais: razões e proporções, divisão proporcional, regra de três, porcentagem", normalizedTitle: "numeros e grandezas proporcionais razoes e proporcoes divisao proporcional regra de tres porcentagem", orderIndex: 3, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__rlm_t4", subjectCanonicalKey: "RACIOCINIO_LOGICO_MATEMATICO", subjectName: "Raciocínio Lógico-Matemático", topicCode: "Tópico 04", title: "Estrutura lógica de relações arbitrárias entre pessoas, lugares, objetos ou eventos fictícios", normalizedTitle: "estrutura logica de relacoes arbitrarias entre pessoas lugares objetos ou eventos ficticios", orderIndex: 4, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__rlm_t5", subjectCanonicalKey: "RACIOCINIO_LOGICO_MATEMATICO", subjectName: "Raciocínio Lógico-Matemático", topicCode: "Tópico 05", title: "Raciocínio verbal, matemático, sequencial, orientação espacial e temporal, formação de conceitos", normalizedTitle: "raciocinio verbal matematico sequencial orientacao espacial e temporal formacao de conceitos", orderIndex: 5, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__rlm_t6", subjectCanonicalKey: "RACIOCINIO_LOGICO_MATEMATICO", subjectName: "Raciocínio Lógico-Matemático", topicCode: "Tópico 06", title: "Compreensão do processo lógico que conduz a conclusões determinadas", normalizedTitle: "compreensao do processo logico que conduz a conclusoes determinadas", orderIndex: 6, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },

  // ── Legislação (10 tópicos, peso 1, GERAIS) ──
  { id: "trt4_2026p__legis_t1", subjectCanonicalKey: "LEGISLACAO", subjectName: "Legislação", topicCode: "Tópico 01", title: "Lei nº 8.112/1990: Disposições Preliminares; Provimento, Vacância, Remoção, Redistribuição e Substituição", normalizedTitle: "lei no 8 112 1990 disposicoes preliminares provimento vacancia remocao redistribuicao e substituicao", orderIndex: 1, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__legis_t2", subjectCanonicalKey: "LEGISLACAO", subjectName: "Legislação", topicCode: "Tópico 02", title: "Lei nº 8.112/1990: Direitos e Vantagens (Vencimento/Remuneração, Vantagens, Férias, Licenças, Afastamentos)", normalizedTitle: "lei no 8 112 1990 direitos e vantagens vencimento remuneracao vantagens ferias licencas afastamentos", orderIndex: 2, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__legis_t3", subjectCanonicalKey: "LEGISLACAO", subjectName: "Legislação", topicCode: "Tópico 03", title: "Lei nº 8.112/1990: Regime Disciplinar (Deveres, Proibições, Acumulação, Responsabilidades, Penalidades, PAD)", normalizedTitle: "lei no 8 112 1990 regime disciplinar deveres proibicoes acumulacao responsabilidades penalidades pad", orderIndex: 3, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__legis_t4", subjectCanonicalKey: "LEGISLACAO", subjectName: "Legislação", topicCode: "Tópico 04", title: "Lei nº 9.784/1999 (Processo Administrativo na Administração Pública Federal)", normalizedTitle: "lei no 9 784 1999 processo administrativo na administracao publica federal", orderIndex: 4, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__legis_t5", subjectCanonicalKey: "LEGISLACAO", subjectName: "Legislação", topicCode: "Tópico 05", title: "Lei nº 8.429/1992 e Lei nº 14.230/2021 (Improbidade Administrativa)", normalizedTitle: "lei no 8 429 1992 e lei no 14 230 2021 improbidade administrativa", orderIndex: 5, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__legis_t6", subjectCanonicalKey: "LEGISLACAO", subjectName: "Legislação", topicCode: "Tópico 06", title: "Lei nº 14.133/2021 (Nova Lei de Licitações e Contratos Administrativos)", normalizedTitle: "lei no 14 133 2021 nova lei de licitacoes e contratos administrativos", orderIndex: 6, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__legis_t7", subjectCanonicalKey: "LEGISLACAO", subjectName: "Legislação", topicCode: "Tópico 07", title: "Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD)", normalizedTitle: "lei no 13 709 2018 lei geral de protecao de dados pessoais lgpd", orderIndex: 7, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__legis_t8", subjectCanonicalKey: "LEGISLACAO", subjectName: "Legislação", topicCode: "Tópico 08", title: "Lei nº 13.146/2015 (Estatuto da Pessoa com Deficiência / LBI)", normalizedTitle: "lei no 13 146 2015 estatuto da pessoa com deficiencia lbi", orderIndex: 8, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__legis_t9", subjectCanonicalKey: "LEGISLACAO", subjectName: "Legislação", topicCode: "Tópico 09", title: "Regimento Interno do TRT da 4ª Região", normalizedTitle: "regimento interno do trt da 4a regiao", orderIndex: 9, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
  { id: "trt4_2026p__legis_t10", subjectCanonicalKey: "LEGISLACAO", subjectName: "Legislação", topicCode: "Tópico 10", title: "Resolução CNJ nº 400/2021 (Política de Sustentabilidade no Poder Judiciário)", normalizedTitle: "resolucao cnj no 400 2021 politica de sustentabilidade no poder judiciario", orderIndex: 10, weight: 1.0, blocoConhecimento: "GERAIS", questoesDaMateria: 30 },
];

// ═══ GERADOR DE SQL ═══

function escapeSQLString(str: string): string {
  return str.replace(/'/g, "''");
}

// Extrai a lista de matérias únicas (SyllabusSubject) a partir dos tópicos
interface SubjectMeta {
  canonicalKey: string;
  displayName: string;
  blocoConhecimento: string | null;
  questoesDaMateria: number | null;
  weight: number;
  orderIndex: number;
}

function extractSubjectsFromProjetado(): SubjectMeta[] {
  const seen = new Map<string, SubjectMeta>();
  let order = 0;
  for (const t of TRT4_2026_PROJETADO_TOPICS) {
    if (!seen.has(t.subjectCanonicalKey)) {
      order++;
      seen.set(t.subjectCanonicalKey, {
        canonicalKey: t.subjectCanonicalKey,
        displayName: t.subjectName,
        blocoConhecimento: t.blocoConhecimento,
        questoesDaMateria: t.questoesDaMateria,
        weight: t.weight,
        orderIndex: order,
      });
    }
  }
  return Array.from(seen.values());
}

function extractSubjectsFromEstrategia(): SubjectMeta[] {
  const seen = new Map<string, SubjectMeta>();
  let order = 0;
  // Acumula o peso máximo por matéria a partir dos tópicos do arquivo de constantes.
  // Os valores reais no arquivo são: 1.0 (Língua Portuguesa) e 1.2 (todas as demais).
  const weightByKey = new Map<string, number>();
  for (const t of OFFICIAL_TOPICS) {
    const ck = SUBJECT_CANONICAL_MAP[t.subjectName];
    if (ck) {
      const current = weightByKey.get(ck) ?? 0;
      if ((t.weight || 1.0) > current) weightByKey.set(ck, t.weight || 1.0);
    }
  }
  for (const t of OFFICIAL_TOPICS) {
    const canonicalKey = SUBJECT_CANONICAL_MAP[t.subjectName];
    if (canonicalKey && !seen.has(canonicalKey)) {
      order++;
      seen.set(canonicalKey, {
        canonicalKey,
        displayName: t.subjectName,
        // V1 é grade de curso, NÃO edital. blocoConhecimento e questoesDaMateria ficam NULL.
        blocoConhecimento: null,
        questoesDaMateria: null,
        // Weight vem do ARQUIVO, não de inferência. Valor real por matéria.
        weight: weightByKey.get(canonicalKey) ?? 1.0,
        orderIndex: order,
      });
    }
  }
  return Array.from(seen.values());
}

function generateSQL() {
  // ═══ IDS DAS VERSÕES ═══
  const v1Id = "cm01_estrategia_grid_v1";
  const v1Label = "ESTRATEGIA_COURSE_GRID";
  const v1Source = "Estratégia Concursos PDF Grid (Legacy initial ingestion)";
  const v1Description = "Taxonomia inicial de tópicos baseada no sumário dos materiais do Estratégia Concursos.";

  const v2Id = "cm02_trt4_2026_projetado";
  const v2Label = "TRT4_2026_PROJETADO";
  const v2Source = "Edital verticalizado TRT4 AJAJ 2026 (projetado a partir de editais anteriores)";
  const v2Description = "Taxonomia projetada do edital TRT4 2026, com 109 tópicos em 8 matérias. Inclui RLM e Legislação (peso 1). Versão inativa até edital oficial.";

  let sql = `-- MIGRATION 3: create_syllabus_tables_and_seed\n`;
  sql += `-- Auto-gerado por scripts/generate-syllabus-migration-sql.ts\n`;
  sql += `-- DUAS VERSÕES: ESTRATEGIA_COURSE_GRID (ativa, 110 tópicos) + TRT4_2026_PROJETADO (inativa, 109 tópicos)\n\n`;

  // ═══ 1. DDL: SyllabusVersion ═══
  sql += `-- 1. Criar Tabela SyllabusVersion\n`;
  sql += `CREATE TABLE IF NOT EXISTS "SyllabusVersion" (\n`;
  sql += `  "id" TEXT NOT NULL,\n`;
  sql += `  "label" TEXT NOT NULL,\n`;
  sql += `  "source" TEXT NOT NULL,\n`;
  sql += `  "description" TEXT,\n`;
  sql += `  "isActive" BOOLEAN NOT NULL DEFAULT false,\n`;
  sql += `  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  CONSTRAINT "SyllabusVersion_pkey" PRIMARY KEY ("id")\n`;
  sql += `);\n\n`;
  sql += `CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusVersion_label_key" ON "SyllabusVersion"("label");\n`;
  sql += `CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusVersion_single_active" ON "SyllabusVersion"("isActive") WHERE "isActive" = true;\n\n`;

  // ═══ 2. DDL: SyllabusSubject ═══
  sql += `-- 2. Criar Tabela SyllabusSubject\n`;
  sql += `CREATE TABLE IF NOT EXISTS "SyllabusSubject" (\n`;
  sql += `  "id" TEXT NOT NULL,\n`;
  sql += `  "versionId" TEXT NOT NULL,\n`;
  sql += `  "canonicalKey" TEXT NOT NULL,\n`;
  sql += `  "displayName" TEXT NOT NULL,\n`;
  sql += `  "blocoConhecimento" TEXT,\n`;
  sql += `  "questoesDaMateria" INTEGER,\n`;
  sql += `  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,\n`;
  sql += `  "orderIndex" INTEGER NOT NULL DEFAULT 0,\n`;
  sql += `  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  CONSTRAINT "SyllabusSubject_pkey" PRIMARY KEY ("id"),\n`;
  sql += `  CONSTRAINT "SyllabusSubject_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SyllabusVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE\n`;
  sql += `);\n\n`;
  sql += `CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusSubject_versionId_canonicalKey_key" ON "SyllabusSubject"("versionId", "canonicalKey");\n\n`;

  // ═══ 3. DDL: SyllabusTopic ═══
  sql += `-- 3. Criar Tabela SyllabusTopic\n`;
  sql += `CREATE TABLE IF NOT EXISTS "SyllabusTopic" (\n`;
  sql += `  "id" TEXT NOT NULL,\n`;
  sql += `  "versionId" TEXT NOT NULL,\n`;
  sql += `  "subjectCanonicalKey" TEXT NOT NULL,\n`;
  sql += `  "subjectName" TEXT NOT NULL,\n`;
  sql += `  "topicCode" TEXT NOT NULL,\n`;
  sql += `  "title" TEXT NOT NULL,\n`;
  sql += `  "normalizedTitle" TEXT NOT NULL,\n`;
  sql += `  "orderIndex" INTEGER NOT NULL,\n`;
  sql += `  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,\n`;
  sql += `  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  CONSTRAINT "SyllabusTopic_pkey" PRIMARY KEY ("id"),\n`;
  sql += `  CONSTRAINT "SyllabusTopic_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SyllabusVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE,\n`;
  sql += `  CONSTRAINT "SyllabusTopic_subject_fkey" FOREIGN KEY ("versionId", "subjectCanonicalKey") REFERENCES "SyllabusSubject"("versionId", "canonicalKey") ON DELETE CASCADE ON UPDATE CASCADE\n`;
  sql += `);\n\n`;
  sql += `CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusTopic_versionId_topicCode_key" ON "SyllabusTopic"("versionId", "topicCode");\n`;
  sql += `CREATE INDEX IF NOT EXISTS "SyllabusTopic_versionId_idx" ON "SyllabusTopic"("versionId");\n`;
  sql += `CREATE INDEX IF NOT EXISTS "SyllabusTopic_subjectCanonicalKey_idx" ON "SyllabusTopic"("subjectCanonicalKey");\n\n`;

  // ═══ 4. SEED VERSÃO 1: ESTRATEGIA_COURSE_GRID (ativa) ═══
  sql += `-- ═══ VERSÃO 1: ESTRATEGIA_COURSE_GRID (ATIVA) ═══\n`;
  sql += `INSERT INTO "SyllabusVersion" ("id", "label", "source", "description", "isActive", "createdAt", "updatedAt")\n`;
  sql += `VALUES ('${v1Id}', '${v1Label}', '${escapeSQLString(v1Source)}', '${escapeSQLString(v1Description)}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\n`;
  sql += `ON CONFLICT ("label") DO NOTHING;\n\n`;

  // 4a. SyllabusSubject para V1
  const v1Subjects = extractSubjectsFromEstrategia();
  sql += `-- 4a. Matérias da versão ESTRATEGIA_COURSE_GRID (${v1Subjects.length} matérias)\n`;
  for (const s of v1Subjects) {
    const subjectId = `${v1Id}__${s.canonicalKey.toLowerCase()}`;
    sql += `INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")\n`;
    sql += `VALUES ('${subjectId}', '${v1Id}', '${s.canonicalKey}', '${escapeSQLString(s.displayName)}', ${s.blocoConhecimento === null ? "NULL" : `'${s.blocoConhecimento}'`}, ${s.questoesDaMateria === null ? "NULL" : s.questoesDaMateria}, ${s.weight}, ${s.orderIndex}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\n`;
    sql += `ON CONFLICT ("id") DO NOTHING;\n`;
  }
  sql += `\n`;

  // 4b. SyllabusTopic para V1
  sql += `-- 4b. Tópicos da versão ESTRATEGIA_COURSE_GRID (${OFFICIAL_TOPICS.length} tópicos)\n`;
  for (const topic of OFFICIAL_TOPICS) {
    const canonicalKey = SUBJECT_CANONICAL_MAP[topic.subjectName] || "OUTROS";
    sql += `INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")\n`;
    sql += `VALUES ('${escapeSQLString(topic.id)}', '${v1Id}', '${canonicalKey}', '${escapeSQLString(topic.subjectName)}', '${escapeSQLString(topic.topicCode)}', '${escapeSQLString(topic.title)}', '${escapeSQLString(topic.normalizedTitle)}', ${topic.orderIndex}, ${topic.weight || 1.0}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\n`;
    sql += `ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;\n`;
  }
  sql += `\n`;

  // ═══ 5. SEED VERSÃO 2: TRT4_2026_PROJETADO (inativa) ═══
  sql += `-- ═══ VERSÃO 2: TRT4_2026_PROJETADO (INATIVA) ═══\n`;
  sql += `INSERT INTO "SyllabusVersion" ("id", "label", "source", "description", "isActive", "createdAt", "updatedAt")\n`;
  sql += `VALUES ('${v2Id}', '${v2Label}', '${escapeSQLString(v2Source)}', '${escapeSQLString(v2Description)}', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\n`;
  sql += `ON CONFLICT ("label") DO NOTHING;\n\n`;

  // 5a. SyllabusSubject para V2
  const v2Subjects = extractSubjectsFromProjetado();
  sql += `-- 5a. Matérias da versão TRT4_2026_PROJETADO (${v2Subjects.length} matérias)\n`;
  for (const s of v2Subjects) {
    const subjectId = `${v2Id}__${s.canonicalKey.toLowerCase()}`;
    sql += `INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")\n`;
    sql += `VALUES ('${subjectId}', '${v2Id}', '${s.canonicalKey}', '${escapeSQLString(s.displayName)}', '${s.blocoConhecimento}', ${s.questoesDaMateria}, ${s.weight}, ${s.orderIndex}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\n`;
    sql += `ON CONFLICT ("id") DO NOTHING;\n`;
  }
  sql += `\n`;

  // 5b. SyllabusTopic para V2
  sql += `-- 5b. Tópicos da versão TRT4_2026_PROJETADO (${TRT4_2026_PROJETADO_TOPICS.length} tópicos)\n`;
  for (const topic of TRT4_2026_PROJETADO_TOPICS) {
    sql += `INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")\n`;
    sql += `VALUES ('${escapeSQLString(topic.id)}', '${v2Id}', '${topic.subjectCanonicalKey}', '${escapeSQLString(topic.subjectName)}', '${escapeSQLString(topic.topicCode)}', '${escapeSQLString(topic.title)}', '${escapeSQLString(topic.normalizedTitle)}', ${topic.orderIndex}, ${topic.weight}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\n`;
    sql += `ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;\n`;
  }

  // ═══ GRAVAR ARQUIVOS ═══
  const outDir = path.join(__dirname, "../docs/migrations-sql-preview");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const migration3File = path.join(outDir, "migration_3_create_syllabus_tables.sql");
  fs.writeFileSync(migration3File, sql, "utf-8");

  // Migration 4 (canonicalKey em StudySubject)
  let migration4Sql = `-- MIGRATION 4: add_study_subject_canonical_key\n`;
  migration4Sql += `-- 1. Adicionar coluna canonicalKey em StudySubject\n`;
  migration4Sql += `ALTER TABLE "StudySubject" ADD COLUMN IF NOT EXISTS "canonicalKey" TEXT;\n`;

  const migration4File = path.join(outDir, "migration_4_add_study_subject_canonical_key.sql");
  fs.writeFileSync(migration4File, migration4Sql, "utf-8");

  // Migration 5 (FK de officialTopicId)
  let migration5Sql = `-- MIGRATION 5: add_study_block_official_topic_fk\n`;
  migration5Sql += `-- 1. Adicionar Foreign Key entre StudyBlock.officialTopicId e SyllabusTopic.id\n`;
  migration5Sql += `ALTER TABLE "StudyBlock" ADD CONSTRAINT "StudyBlock_officialTopicId_fkey" FOREIGN KEY ("officialTopicId") REFERENCES "SyllabusTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;\n`;

  const migration5File = path.join(outDir, "migration_5_add_study_block_official_topic_fk.sql");
  fs.writeFileSync(migration5File, migration5Sql, "utf-8");

  // Migration 6 (Campos de pré-crédito conservador em StudyBlock)
  let migration6Sql = `-- MIGRATION 6: add_study_block_conservative_precredit_fields\n`;
  migration6Sql += `-- 1. Adicionar campos para pré-crédito conservador e aviso de 1-clique na UI\n`;
  migration6Sql += `ALTER TABLE "StudyBlock" ADD COLUMN IF NOT EXISTS "possiblyAlreadyStudied" BOOLEAN NOT NULL DEFAULT false;\n`;
  migration6Sql += `ALTER TABLE "StudyBlock" ADD COLUMN IF NOT EXISTS "sourceV1BlockId" TEXT;\n`;

  const migration6File = path.join(outDir, "migration_6_add_study_block_conservative_precredit_fields.sql");
  fs.writeFileSync(migration6File, migration6Sql, "utf-8");

  // ═══ RESUMO ═══
  console.log(`✅ SQLs gerados com sucesso em:\n - ${migration3File}\n - ${migration4File}\n - ${migration5File}\n - ${migration6File}`);
  console.log(`\nVersão 1 (ESTRATEGIA_COURSE_GRID): ${v1Subjects.length} matérias, ${OFFICIAL_TOPICS.length} tópicos (ATIVA)`);
  console.log(`Versão 2 (TRT4_2026_PROJETADO): ${v2Subjects.length} matérias, ${TRT4_2026_PROJETADO_TOPICS.length} tópicos (INATIVA)`);
  console.log(`Total: ${OFFICIAL_TOPICS.length + TRT4_2026_PROJETADO_TOPICS.length} tópicos`);
}

generateSQL();
