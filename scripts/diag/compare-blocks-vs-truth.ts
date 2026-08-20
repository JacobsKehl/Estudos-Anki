/**
 * compare-blocks-vs-truth.ts
 * 
 * Passo 2: Comparação READ-ONLY entre os blocos no banco e a tabela-verdade
 * extraída diretamente dos 5 PDFs do CFC.
 *
 * NENHUMA MUTAÇÃO. Apenas consulta e impressão.
 *
 * A tabela-verdade lista CAPÍTULOS. Alguns blocos do banco cobrem 2+ capítulos
 * (ex: "Contrato + Contratos Especiais"), e um capítulo foi partido em 2 blocos
 * (Licitações Parte 1 / Parte 2). O mapeamento leva isso em conta.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ====================================================================
// TABELA-VERDADE: extraída pelo usuário direto do PDF
// pageStart/pageEnd = índice REAL do PDF (não o impresso)
// ====================================================================

interface TruthChapter {
  title: string;
  pageStart: number;
  pageEnd: number;
}

const truth: Record<string, { numPages: number; chapters: TruthChapter[] }> = {
  "1 - Direito Administrativo_compressed.pdf": {
    numPages: 152,
    chapters: [
      { title: "GLOSSÁRIO DE SIGLAS", pageStart: 6, pageEnd: 7 },
      { title: "CONCEITOS E FONTES DO DIREITO ADMINISTRATIVO", pageStart: 8, pageEnd: 9 },
      { title: "ADMINISTRAÇÃO PÚBLICA (CONFORME CF/88)", pageStart: 10, pageEnd: 13 },
      { title: "PODERES E DEVERES DA ADMINISTRAÇÃO PÚBLICA", pageStart: 14, pageEnd: 16 },
      { title: "ATOS ADMINISTRATIVOS", pageStart: 17, pageEnd: 25 },
      { title: "ORGANIZAÇÃO DA ADMINISTRAÇÃO PÚBLICA E TERCEIRO SETOR", pageStart: 26, pageEnd: 30 },
      { title: "SERVIÇOS PÚBLICOS", pageStart: 31, pageEnd: 39 },
      { title: "RESPONSABILIDADE CIVIL DO ESTADO", pageStart: 40, pageEnd: 42 },
      { title: "CONTROLE DA ADMINISTRAÇÃO PÚBLICA", pageStart: 43, pageEnd: 49 },
      { title: "LEI 9.784/99 – PROCESSO ADMINISTRATIVO FEDERAL", pageStart: 50, pageEnd: 56 },
      { title: "BENS PÚBLICOS", pageStart: 57, pageEnd: 58 },
      { title: "INTERVENÇÃO DO ESTADO NA PROPRIEDADE PRIVADA", pageStart: 59, pageEnd: 63 },
      { title: "LEI 12.527/12 – ACESSO À INFORMAÇÃO", pageStart: 64, pageEnd: 67 },
      { title: "AGENTES PÚBLICOS – PARTE CONSTITUCIONAL", pageStart: 68, pageEnd: 75 },
      { title: "LEI 8.112/90 – ESTATUTO DOS SERVIDORES PÚBLICOS FEDERAIS", pageStart: 76, pageEnd: 89 },
      { title: "LEI 14.133/21 – NOVA LEI DE LICITAÇÕES (PARTE DE LICITAÇÕES)", pageStart: 90, pageEnd: 116 },
      { title: "LEI 14.133/21 – NOVA LEI DE LICITAÇÕES (PARTE DE CONTRATOS)", pageStart: 117, pageEnd: 130 },
      { title: "LEI 8.429/92 – LEI DE IMPROBIDADE ADMINISTRATIVA", pageStart: 131, pageEnd: 140 },
      { title: "LEI 13.709/18 – LEI GERAL DE PROTEÇÃO DE DADOS (LGPD)", pageStart: 141, pageEnd: 151 },
      { title: "EXTRA – EXERCÍCIOS (TEC)", pageStart: 152, pageEnd: 152 },
    ]
  },
  "2 - Direito do Trabalho.pdf": {
    numPages: 38,
    chapters: [
      { title: "PRINCÍPIOS E FONTES DO DIREITO DO TRABALHO", pageStart: 4, pageEnd: 4 },
      { title: "DIREITOS TRABALHISTAS PREVISTOS CONSTITUCIONALMENTE", pageStart: 5, pageEnd: 6 },
      { title: "EMPREGADOR, EMPREGADO E RELAÇÃO DE EMPREGO", pageStart: 7, pageEnd: 7 },
      { title: "CONTRATO DE TRABALHO", pageStart: 8, pageEnd: 10 },
      { title: "CONTRATOS ESPECIAIS DE TRABALHO", pageStart: 11, pageEnd: 11 },
      { title: "REMUNERAÇÃO", pageStart: 12, pageEnd: 14 },
      { title: "DURAÇÃO DO TRABALHO", pageStart: 15, pageEnd: 16 },
      { title: "TELETRABALHO", pageStart: 17, pageEnd: 17 },
      { title: "FÉRIAS ANUAIS", pageStart: 18, pageEnd: 19 },
      { title: "RESCISÃO DO CONTRATO DE TRABALHO", pageStart: 20, pageEnd: 21 },
      { title: "AVISO PRÉVIO", pageStart: 22, pageEnd: 22 },
      { title: "TUTELAS ESPECIAIS", pageStart: 23, pageEnd: 24 },
      { title: "RESPONSABILIDADE TRABALHISTA", pageStart: 25, pageEnd: 25 },
      { title: "CONVENÇÕES COLETIVAS DE TRABALHO", pageStart: 26, pageEnd: 27 },
      { title: "JURISPRUDÊNCIAS", pageStart: 28, pageEnd: 37 },
      { title: "EXTRA – EXERCÍCIOS (TEC)", pageStart: 38, pageEnd: 38 },
    ]
  },
  "3 - Direito Constitucional.pdf": {
    numPages: 86,
    chapters: [
      { title: "ASPECTOS INTRODUTÓRIOS DO DIREITO CONSTITUCIONAL", pageStart: 4, pageEnd: 8 },
      { title: "DOS PRINCÍPIOS FUNDAMENTAIS", pageStart: 9, pageEnd: 9 },
      { title: "DOS DIREITOS E GARANTIAS FUNDAMENTAIS", pageStart: 10, pageEnd: 25 },
      { title: "DA ORGANIZAÇÃO DO ESTADO", pageStart: 26, pageEnd: 30 },
      { title: "DA INTERVENÇÃO", pageStart: 31, pageEnd: 32 },
      { title: "DA ADMINISTRAÇÃO PÚBLICA", pageStart: 33, pageEnd: 42 },
      { title: "DO PODER LEGISLATIVO", pageStart: 43, pageEnd: 48 },
      { title: "DO PROCESSO LEGISLATIVO", pageStart: 49, pageEnd: 52 },
      { title: "DA FISCALIZAÇÃO CONTÁBIL, FINANCEIRA E ORÇAMENTÁRIA", pageStart: 53, pageEnd: 55 },
      { title: "DO PODER EXECUTIVO", pageStart: 56, pageEnd: 60 },
      { title: "DO PODER JUDICIÁRIO", pageStart: 61, pageEnd: 68 },
      { title: "DAS FUNÇÕES ESSENCIAIS À JUSTIÇA", pageStart: 69, pageEnd: 71 },
      { title: "DA DEFESA DO ESTADO E DAS INSTITUIÇÕES DEMOCRÁTICAS", pageStart: 72, pageEnd: 73 },
      { title: "DA ORDEM SOCIAL", pageStart: 74, pageEnd: 77 },
      { title: "CONTROLE DE CONSTITUCIONALIDADE", pageStart: 78, pageEnd: 85 },
      { title: "EXTRA – QUESTÕES (TEC)", pageStart: 86, pageEnd: 86 },
    ]
  },
  "4 - Direito Processual do Trabalho.pdf": {
    numPages: 30,
    chapters: [
      { title: "ORGANIZAÇÃO DA JUSTIÇA DO TRABALHO", pageStart: 3, pageEnd: 5 },
      { title: "DO PROCESSO EM GERAL", pageStart: 6, pageEnd: 10 },
      { title: "DOS DISSÍDIOS INDIVIDUAIS", pageStart: 11, pageEnd: 14 },
      { title: "DA EXECUÇÃO", pageStart: 15, pageEnd: 16 },
      { title: "RECURSOS TRABALHISTAS", pageStart: 17, pageEnd: 19 },
      { title: "PRESCRIÇÃO NO DIREITO PROCESSUAL DO TRABALHO", pageStart: 20, pageEnd: 20 },
      { title: "JURISPRUDÊNCIAS", pageStart: 21, pageEnd: 29 },
      { title: "EXTRA – EXERCÍCIOS (TEC)", pageStart: 30, pageEnd: 30 },
    ]
  },
  "Direito Processual Civil_compressed.pdf": {
    numPages: 76,
    chapters: [
      { title: "INTRODUÇÃO", pageStart: 4, pageEnd: 5 },
      { title: "DA FUNÇÃO JURISDICIONAL", pageStart: 6, pageEnd: 10 },
      { title: "PARTES E DOS PROCURADORES - SUJEITOS DO PROCESSO", pageStart: 11, pageEnd: 17 },
      { title: "JUIZ E DOS AUXILIARES DA JUSTIÇA", pageStart: 18, pageEnd: 22 },
      { title: "ATOS PROCESSUAIS", pageStart: 23, pageEnd: 29 },
      { title: "INTIMAÇÕES", pageStart: 30, pageEnd: 31 },
      { title: "TUTELA PROVISÓRIA (ARTS. 294 A 311)", pageStart: 32, pageEnd: 33 },
      { title: "FORMAÇÃO, SUSPENSÃO E EXTINÇÃO DO PROCESSO (ARTS. 312 A 317)", pageStart: 34, pageEnd: 34 },
      { title: "PROCEDIMENTO COMUM", pageStart: 35, pageEnd: 47 },
      { title: "CUMPRIMENTO DA SENTENÇA (ARTS. 513 A 538)", pageStart: 48, pageEnd: 51 },
      { title: "DO PROCESSO DE EXECUÇÃO", pageStart: 52, pageEnd: 54 },
      { title: "MEIOS DE IMPUGNAÇÃO DAS DECISÕES JUDICIAIS", pageStart: 55, pageEnd: 59 },
      { title: "DOS RECURSOS", pageStart: 60, pageEnd: 66 },
      { title: "TABELA AUXILIAR DE PRAZOS", pageStart: 67, pageEnd: 75 },
      { title: "EXTRA – QUESTÕES (TEC)", pageStart: 76, pageEnd: 76 },
    ]
  }
};

// ====================================================================
// MAPEAMENTO bloco → capítulo(s)
// Cada entrada diz: "o bloco cujo título contém X cobre os capítulos de idx firstChapter a lastChapter"
// ====================================================================

interface BlockMapping {
  titleMatch: string;       // Substring para achar o bloco no banco
  pdf: string;
  firstChapterIdx: number;  // Índice no array chapters[]
  lastChapterIdx: number;   // Inclusivo
  notes?: string;
}

const blockMappings: BlockMapping[] = [
  // === Direito Administrativo (16 blocos) ===
  { titleMatch: "Glossário de Siglas", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 0, lastChapterIdx: 0 },
  { titleMatch: "Conceitos e Fontes do Direito Administrativo", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 1, lastChapterIdx: 3, notes: "Bloco junta Conceitos + Adm Pub + Poderes" },
  { titleMatch: "Atos Administrativos", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 4, lastChapterIdx: 4 },
  { titleMatch: "Organização da Administração Pública e Tercei", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 5, lastChapterIdx: 5 },
  { titleMatch: "Serviços Públicos", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 6, lastChapterIdx: 6 },
  { titleMatch: "Responsabilidade Civil do Estado", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 7, lastChapterIdx: 8, notes: "Bloco junta Resp Civil + Controle" },
  { titleMatch: "Lei 9.784", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 9, lastChapterIdx: 9 },
  { titleMatch: "Bens Públicos", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 10, lastChapterIdx: 11, notes: "Bloco junta Bens + Intervenção" },
  { titleMatch: "Lei 12.527", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 12, lastChapterIdx: 12 },
  { titleMatch: "Agentes Públicos", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 13, lastChapterIdx: 13 },
  { titleMatch: "Lei 8.112", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 14, lastChapterIdx: 14 },
  { titleMatch: "Licitações (Fases", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 15, lastChapterIdx: 15, notes: "Licitações Parte 1 — cap partido: 90–103" },
  { titleMatch: "Licitações (Modalidades", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 15, lastChapterIdx: 15, notes: "Licitações Parte 2 — cap partido: 104–116" },
  { titleMatch: "Nova Lei de Licitações (Parte de C", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 16, lastChapterIdx: 16 },
  { titleMatch: "Improbidade", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 17, lastChapterIdx: 17 },
  { titleMatch: "LGPD", pdf: "1 - Direito Administrativo_compressed.pdf", firstChapterIdx: 18, lastChapterIdx: 18 },

  // === Direito do Trabalho (12 blocos ativos, 1 EXCLUDED) ===
  { titleMatch: "Princípios e Fontes do Direito do Trabalho", pdf: "2 - Direito do Trabalho.pdf", firstChapterIdx: 0, lastChapterIdx: 1, notes: "Bloco junta Princípios + Direitos Constitucionais" },
  { titleMatch: "Empregador, Empregado", pdf: "2 - Direito do Trabalho.pdf", firstChapterIdx: 2, lastChapterIdx: 2 },
  { titleMatch: "Contrato de Trabalho", pdf: "2 - Direito do Trabalho.pdf", firstChapterIdx: 3, lastChapterIdx: 4, notes: "Bloco junta Contrato + Contratos Especiais" },
  { titleMatch: "Remuneração", pdf: "2 - Direito do Trabalho.pdf", firstChapterIdx: 5, lastChapterIdx: 5 },
  { titleMatch: "Duração do Trabalho", pdf: "2 - Direito do Trabalho.pdf", firstChapterIdx: 6, lastChapterIdx: 6 },
  { titleMatch: "Teletrabalho", pdf: "2 - Direito do Trabalho.pdf", firstChapterIdx: 7, lastChapterIdx: 7 },
  { titleMatch: "Férias Anuais", pdf: "2 - Direito do Trabalho.pdf", firstChapterIdx: 8, lastChapterIdx: 8 },
  { titleMatch: "Rescisão do Contrato", pdf: "2 - Direito do Trabalho.pdf", firstChapterIdx: 9, lastChapterIdx: 10, notes: "Bloco junta Rescisão + Aviso Prévio" },
  { titleMatch: "Tutelas Especiais", pdf: "2 - Direito do Trabalho.pdf", firstChapterIdx: 11, lastChapterIdx: 11 },
  { titleMatch: "Responsabilidade Trabalhista", pdf: "2 - Direito do Trabalho.pdf", firstChapterIdx: 12, lastChapterIdx: 12 },
  { titleMatch: "Convenções Coletivas", pdf: "2 - Direito do Trabalho.pdf", firstChapterIdx: 13, lastChapterIdx: 13 },
  // Prescrição (phantom, EXCLUDED) — skip
  { titleMatch: "Jurisprudências", pdf: "2 - Direito do Trabalho.pdf", firstChapterIdx: 14, lastChapterIdx: 14 },

  // === Direito Constitucional (12 blocos) ===
  { titleMatch: "Aspectos Introdutórios", pdf: "3 - Direito Constitucional.pdf", firstChapterIdx: 0, lastChapterIdx: 0 },
  { titleMatch: "Princípios Fundamentais", pdf: "3 - Direito Constitucional.pdf", firstChapterIdx: 1, lastChapterIdx: 1 },
  { titleMatch: "Direitos e Garantias Fundamentais", pdf: "3 - Direito Constitucional.pdf", firstChapterIdx: 2, lastChapterIdx: 2 },
  { titleMatch: "Organização do Estado", pdf: "3 - Direito Constitucional.pdf", firstChapterIdx: 3, lastChapterIdx: 4, notes: "Bloco junta Org Estado + Intervenção" },
  { titleMatch: "Administração Pública", pdf: "3 - Direito Constitucional.pdf", firstChapterIdx: 5, lastChapterIdx: 5 },
  { titleMatch: "Poder Legislativo", pdf: "3 - Direito Constitucional.pdf", firstChapterIdx: 6, lastChapterIdx: 8, notes: "Bloco junta Legislativo + Processo + Fiscalização" },
  { titleMatch: "Poder Executivo", pdf: "3 - Direito Constitucional.pdf", firstChapterIdx: 9, lastChapterIdx: 9 },
  { titleMatch: "Poder Judiciário", pdf: "3 - Direito Constitucional.pdf", firstChapterIdx: 10, lastChapterIdx: 10 },
  { titleMatch: "Funções Essenciais", pdf: "3 - Direito Constitucional.pdf", firstChapterIdx: 11, lastChapterIdx: 11, notes: "Bloco SEPARADO — só Funções Essenciais" },
  { titleMatch: "Defesa do Estado", pdf: "3 - Direito Constitucional.pdf", firstChapterIdx: 12, lastChapterIdx: 12, notes: "Bloco SEPARADO — só Defesa" },
  { titleMatch: "Ordem Social", pdf: "3 - Direito Constitucional.pdf", firstChapterIdx: 13, lastChapterIdx: 13 },
  { titleMatch: "Controle de Constitucionalidade", pdf: "3 - Direito Constitucional.pdf", firstChapterIdx: 14, lastChapterIdx: 14 },

  // === Direito Processual do Trabalho (7 blocos) ===
  { titleMatch: "Organização da Justiça do Trabalho", pdf: "4 - Direito Processual do Trabalho.pdf", firstChapterIdx: 0, lastChapterIdx: 0 },
  { titleMatch: "Do Processo em Geral", pdf: "4 - Direito Processual do Trabalho.pdf", firstChapterIdx: 1, lastChapterIdx: 1 },
  { titleMatch: "Dissídios Individuais", pdf: "4 - Direito Processual do Trabalho.pdf", firstChapterIdx: 2, lastChapterIdx: 2 },
  { titleMatch: "Da Execução", pdf: "4 - Direito Processual do Trabalho.pdf", firstChapterIdx: 3, lastChapterIdx: 3 },
  { titleMatch: "Recursos Trabalhistas", pdf: "4 - Direito Processual do Trabalho.pdf", firstChapterIdx: 4, lastChapterIdx: 4 },
  { titleMatch: "Prescrição no Direito Processual", pdf: "4 - Direito Processual do Trabalho.pdf", firstChapterIdx: 5, lastChapterIdx: 5 },
  { titleMatch: "Jurisprudências", pdf: "4 - Direito Processual do Trabalho.pdf", firstChapterIdx: 6, lastChapterIdx: 6 },

  // === Direito Processual Civil (11 blocos) ===
  { titleMatch: "Introdução", pdf: "Direito Processual Civil_compressed.pdf", firstChapterIdx: 0, lastChapterIdx: 0 },
  { titleMatch: "Da Função Jurisdicional", pdf: "Direito Processual Civil_compressed.pdf", firstChapterIdx: 1, lastChapterIdx: 1 },
  { titleMatch: "Partes", pdf: "Direito Processual Civil_compressed.pdf", firstChapterIdx: 2, lastChapterIdx: 2, notes: "Bloco SEPARADO — só Partes" },
  { titleMatch: "Juiz e dos Auxiliares", pdf: "Direito Processual Civil_compressed.pdf", firstChapterIdx: 3, lastChapterIdx: 3, notes: "Bloco SEPARADO — só Juiz" },
  { titleMatch: "Atos Processuais", pdf: "Direito Processual Civil_compressed.pdf", firstChapterIdx: 4, lastChapterIdx: 5, notes: "Bloco junta Atos + Intimações" },
  { titleMatch: "Tutela Provisória", pdf: "Direito Processual Civil_compressed.pdf", firstChapterIdx: 6, lastChapterIdx: 7, notes: "Bloco junta Tutela + Formação/Suspensão/Extinção" },
  { titleMatch: "Procedimento Comum", pdf: "Direito Processual Civil_compressed.pdf", firstChapterIdx: 8, lastChapterIdx: 8 },
  { titleMatch: "Cumprimento da Sentença", pdf: "Direito Processual Civil_compressed.pdf", firstChapterIdx: 9, lastChapterIdx: 9 },
  { titleMatch: "Processo de Execução", pdf: "Direito Processual Civil_compressed.pdf", firstChapterIdx: 10, lastChapterIdx: 10 },
  { titleMatch: "Meios de Impugnação", pdf: "Direito Processual Civil_compressed.pdf", firstChapterIdx: 11, lastChapterIdx: 12, notes: "Bloco junta Meios + Recursos" },
  { titleMatch: "Tabela Auxiliar de Prazos", pdf: "Direito Processual Civil_compressed.pdf", firstChapterIdx: 13, lastChapterIdx: 13 },
];

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const { data: allBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, theoryStatus, estimatedStudyMinutes, orderIndex, StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId);

  console.log("\n" + "=".repeat(140));
  console.log("  PASSO 2: COMPARAÇÃO BLOCO × TABELA-VERDADE (READ-ONLY)");
  console.log("=".repeat(140));

  // Header
  console.log("\n  " + [
    "#".padStart(3),
    "PDF".padEnd(18),
    "Título do Bloco".padEnd(55),
    "DB start".padStart(8),
    "DB end".padStart(7),
    "→".padStart(2),
    "TV start".padStart(8),
    "TV end".padStart(7),
    "Δstart".padStart(7),
    "Δend".padStart(7),
    "Status".padEnd(12),
    "Notas"
  ].join(" | "));
  console.log("  " + "-".repeat(180));

  let matched = 0;
  let unmatchedBlocks: string[] = [];
  let totalDeltaStart = 0;
  let totalDeltaEnd = 0;
  let casesToInvestigate: string[] = [];

  for (let i = 0; i < blockMappings.length; i++) {
    const mapping = blockMappings[i];
    const pdfTruth = truth[mapping.pdf];
    if (!pdfTruth) continue;

    const firstChapter = pdfTruth.chapters[mapping.firstChapterIdx];
    const lastChapter = pdfTruth.chapters[mapping.lastChapterIdx];
    const expectedStart = firstChapter.pageStart;
    const expectedEnd = lastChapter.pageEnd;

    // Handle Licitações split specially
    let adjExpectedStart = expectedStart;
    let adjExpectedEnd = expectedEnd;

    if (mapping.titleMatch === "Licitações (Fases") {
      // Parte 1: capítulo inteiro é 90–116, mas o bloco vai até a fronteira interna
      // A fronteira interna no banco era 102, com realinhamento deve ser 103
      adjExpectedStart = 90;
      adjExpectedEnd = 103; // fronteira interna realinhada
    } else if (mapping.titleMatch === "Licitações (Modalidades") {
      adjExpectedStart = 104;
      adjExpectedEnd = 116;
    }

    // Find the block in the database
    const block = (allBlocks || []).find(b =>
      (b as any).StudyMaterial?.originalFileName === mapping.pdf &&
      b.title.includes(mapping.titleMatch) &&
      b.theoryStatus !== "EXCLUDED"
    );

    if (!block) {
      unmatchedBlocks.push(`${mapping.pdf}: ${mapping.titleMatch}`);
      continue;
    }

    matched++;
    const deltaStart = block.pageStart - adjExpectedStart;
    const deltaEnd = block.pageEnd - adjExpectedEnd;
    totalDeltaStart += Math.abs(deltaStart);
    totalDeltaEnd += Math.abs(deltaEnd);

    const pdfShort = mapping.pdf.replace("_compressed", "").replace(".pdf", "").substring(0, 18);
    const titleShort = block.title.substring(0, 55).padEnd(55);

    let flag = "";
    if (deltaStart === 0 && deltaEnd === 0) {
      flag = "✅ OK";
    } else if (deltaStart === -1 && deltaEnd === -1) {
      flag = "⬆️ -1/-1";
    } else if (deltaStart === -1) {
      flag = `⬆️ -1/${deltaEnd > 0 ? "+" : ""}${deltaEnd}`;
    } else {
      flag = `⚠️ ${deltaStart > 0 ? "+" : ""}${deltaStart}/${deltaEnd > 0 ? "+" : ""}${deltaEnd}`;
      casesToInvestigate.push(`${pdfShort}: '${block.title.substring(0, 40)}' DB=[${block.pageStart}–${block.pageEnd}] TV=[${adjExpectedStart}–${adjExpectedEnd}] Δ=${deltaStart}/${deltaEnd}`);
    }

    const notes = mapping.notes || "";
    console.log("  " + [
      (i + 1).toString().padStart(3),
      pdfShort.padEnd(18),
      titleShort,
      block.pageStart.toString().padStart(8),
      block.pageEnd.toString().padStart(7),
      "→".padStart(2),
      adjExpectedStart.toString().padStart(8),
      adjExpectedEnd.toString().padStart(7),
      (deltaStart >= 0 ? "+" + deltaStart : deltaStart.toString()).padStart(7),
      (deltaEnd >= 0 ? "+" + deltaEnd : deltaEnd.toString()).padStart(7),
      flag.padEnd(12),
      notes
    ].join(" | "));
  }

  // Summary
  console.log("\n" + "=".repeat(100));
  console.log(`  RESUMO: ${matched} blocos mapeados`);
  console.log("=".repeat(100));
  console.log(`  Blocos sem par na tabela: ${unmatchedBlocks.length}`);
  unmatchedBlocks.forEach(u => console.log(`    ↳ ${u}`));

  if (casesToInvestigate.length > 0) {
    console.log(`\n  ⚠️ CASOS A INVESTIGAR (delta ≠ -1/-1 e ≠ 0/0):`);
    casesToInvestigate.forEach(c => console.log(`    ${c}`));
  } else {
    console.log(`\n  ✅ Nenhum caso anômalo — todos os deltas são -1/-1 (a corrigir) ou 0/0 (já correto).`);
  }

  // Also check: blocks in CFC PDFs that weren't mapped
  const cfcFiles = Object.keys(truth);
  const cfcBlocks = (allBlocks || []).filter(b =>
    cfcFiles.includes((b as any).StudyMaterial?.originalFileName || "") &&
    b.theoryStatus !== "EXCLUDED"
  );
  const mappedIds = new Set<string>();
  for (const mapping of blockMappings) {
    const block = (allBlocks || []).find(b =>
      (b as any).StudyMaterial?.originalFileName === mapping.pdf &&
      b.title.includes(mapping.titleMatch) &&
      b.theoryStatus !== "EXCLUDED"
    );
    if (block) mappedIds.add(block.id);
  }
  const orphanBlocks = cfcBlocks.filter(b => !mappedIds.has(b.id));
  if (orphanBlocks.length > 0) {
    console.log(`\n  ⚠️ BLOCOS CFC NÃO MAPEADOS (${orphanBlocks.length}):`);
    for (const b of orphanBlocks) {
      console.log(`    ${b.id} | [${b.pageStart}–${b.pageEnd}] | ${b.theoryStatus} | ${(b as any).StudyMaterial?.originalFileName} → ${b.title.substring(0, 50)}`);
    }
  }

  console.log("\n" + "=".repeat(100) + "\n");
}

main().catch(console.error);
