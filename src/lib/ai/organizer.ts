import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildSubjectPrompt, buildStructurePrompt } from "./prompts/organizer";
import { OFFICIAL_TOPICS } from "../constants/official-topics";
import { callGeminiWithRetry } from "./utils/retry";

export interface SubjectIdentification {
  subjectName: string;
  confidence: number;
  reason: string;
}

const KNOWN_SUBJECTS_MAP: Record<string, string> = {
  "CONSTITUCIONAL": "Direito Constitucional",
  "ADMINISTRATIVO": "Direito Administrativo",
  "PORTUGUES": "Língua Portuguesa",
  "LINGUA PORTUGUESA": "Língua Portuguesa",
  "RLM": "Matemática e Raciocínio Lógico",
  "RACIOCINIO LOGICO": "Matemática e Raciocínio Lógico",
  "CIVIL": "Direito Civil",
  "PROCESSO CIVIL": "Direito Processual Civil",
  "PROCESSUAL CIVIL": "Direito Processual Civil",
  "TRABALHO": "Direito do Trabalho",
  "PROCESSO DO TRABALHO": "Direito Processual do Trabalho",
  "PROCESSUAL DO TRABALHO": "Direito Processual do Trabalho",
  "PREVIDENCIARIO": "Legislação específica",
  "INFORMATICA": "Informática",
};

// Cadeia de candidatos a modelo Gemini para estabilidade do pipeline
export const GEMINI_MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL_PRIMARY || "gemini-2.5-flash",
  process.env.GEMINI_MODEL_FALLBACK_1 || "gemini-2.5-flash-lite",
];

// Helper para detectar erros temporários ou instabilidade na API do Gemini
function isRecoverableGeminiError(error: any): boolean {
  const msg = error.message || "";
  const status = error.status;
  const is503 = status === 503 || msg.includes("503") || msg.includes("Service Unavailable");
  const is429 = status === 429 || msg.includes("429") || msg.includes("Rate Limit") || msg.includes("Too Many Requests");
  const isTimeout = msg.includes("fetch failed") || msg.includes("timeout") || msg.includes("AI_TIMEOUT") || msg.includes("ECONNRESET");
  return is503 || is429 || isTimeout;
}

// Trigger automatic Vercel redeploy to activate new GEMINI_API_KEY environment variables
export async function identifySubject(firstPagesContent: string, fileName?: string): Promise<SubjectIdentification> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = buildSubjectPrompt(firstPagesContent, fileName);
  let lastError: any = null;

  for (const modelName of GEMINI_MODEL_CANDIDATES) {
    console.log(`[AI Subject] Tentando identificar matéria usando o modelo: ${modelName}`);
    try {
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      const result = await callGeminiWithRetry(() => model.generateContent(prompt));
      const responseText = result.response.text();
      const startIndex = responseText.indexOf("{");
      const endIndex = responseText.lastIndexOf("}");
      if (startIndex === -1) throw new Error("JSON de matéria não encontrado na resposta da IA");
      const cleanJson = responseText.substring(startIndex, endIndex + 1);
      const parsed: SubjectIdentification = JSON.parse(cleanJson);

      // Normalização básica
      let normalizedName = parsed.subjectName;
      const upperName = normalizedName.toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/DIREITO /g, ""); // Remove prefixo comum para busca

      if (KNOWN_SUBJECTS_MAP[upperName]) {
        normalizedName = KNOWN_SUBJECTS_MAP[upperName];
      }

      const forbiddenSubjects = ["outros", "outro", "geral", "sem categoria", "desconhecido"];
      const isForbidden = forbiddenSubjects.includes(normalizedName.toLowerCase().trim());

      if (parsed.confidence < 0.5 || isForbidden) {
        throw new Error(`Baixa confiança ou matéria genérica inválida identificada ("${parsed.subjectName}" com confiança ${parsed.confidence}). Motivo: ${parsed.reason || "Não especificado"}`);
      }

      if (modelName !== GEMINI_MODEL_CANDIDATES[0]) {
        console.log(`🤖 [AI Fallback] Modelo principal falhou na identificação de matéria. Fallback usado com sucesso: ${modelName}.`);
      }

      return {
        ...parsed,
        subjectName: normalizedName
      };
    } catch (error: any) {
      console.warn(`[AI Subject Fallback] Modelo ${modelName} falhou: ${error.message}`);
      lastError = error;

      // Se não for erro de infraestrutura temporário, lançamos imediatamente sem testar próximos modelos
      if (!isRecoverableGeminiError(error)) {
        throw new Error(`SUBJECT_DETECTION_FAILED: ${error.message || "Erro desconhecido na IA"}`);
      }
    }
  }

  throw new Error(`SUBJECT_DETECTION_FAILED: Todos os modelos do Gemini falharam temporariamente. Último erro: ${lastError?.message}`);
}

export interface DetectedBlock {
  type?: string;
  title: string;
  description: string;
  pageStart: number;
  pageEnd: number;
  sourceHeading: string;
  estimatedStudyMinutes: number;
  confidence?: number;
  createdBy?: string;
  officialTopicId?: string | null;
  officialTopicName?: string | null;
  topicCode?: string | null;
  justification?: string;
  pageTypes?: string[];
  supportType?: string | null;
  contentDensity?: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  isShortBlock?: boolean;
  shortBlockJustification?: string | null;
  mergeRationale?: string | null;
  selectionJustification?: string | null;
  titleQuality?: "GOOD" | "WEAK" | "INVALID";
  titleRationale?: string;
  isMechanicalCut?: boolean;
  isSummaryOnly?: boolean;
  isQuestionsOnly?: boolean;
}

export interface DetectedStructureResult {
  materialRole: string; // MAIN_MATERIAL | SUPPORT_MATERIAL | MIXED_MATERIAL | UNKNOWN
  blocks: DetectedBlock[];
  aiModelUsed?: string; // Armazenar qual modelo final gerou com sucesso
  sourceStrategy?: string;
  tocDetected?: boolean;
  tocConfidence?: number;
}

const FORBIDDEN_GENERIC_PATTERNS = [
  /^parte\s+\d+/i,
  /^bloco\s+\d+$/i,
  /^conte[uú]do\s+completo$/i,
  /^todo\s+conte[uú]do$/i,
  /^outros$/i
];

const GENERIC_TITLES = [
  "TODO CONTEUDO", "TODO O CONTEUDO", "CONTEUDO COMPLETO",
  "MATERIAL COMPLETO", "MATERIAL GERAL", "RESUMO GERAL", "CONTEUDO GERAL",
  "CONTEUDO DA MATERIA", "APOSTILA COMPLETA", "PDF COMPLETO",
  "PARTE 1 DO CONTEUDO", "PARTE 2 DO CONTEUDO", "PARTE 3 DO CONTEUDO",
  "PARTE DO CONTEUDO", "MATERIAL INTEGRA", "TODO O PDF",
  "CONTEUDO INTEGRAL", "VISAO GERAL", "ESTUDO COMPLETO", "APOSTILA", "PDF", 
  "CONTEUDO", "SUMARIO", "CAPITULO", "INTRODUCAO", "SEM CATEGORIA", "DESCONHECIDO",
  "OUTROS", "FUNDAMENTOS E CONCEITOS DE OUTROS", "PARTE 1", "PARTE 2", "PARTE 3",
  "BLOCO 1", "BLOCO 2", "BLOCO 3"
];

const WEAK_CORRIGIBLE_TITLES = [
  "INTRODUCAO", "CONCEITOS INICIAIS", "FUNDAMENTOS", "COMPETENCIA", 
  "ATOS PROCESSUAIS", "RECURSOS", "EXECUCAO", "PROVAS", "SENTENCA",
  "RECURSO", "PROVA"
];

export function enhanceBlockTitle(b: DetectedBlock, subjectName: string): string {
  const originalTitle = b.title.trim();
  const titleNorm = originalTitle.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  let coreConcept = originalTitle;

  // Tópico oficial
  let detailText = "";
  if (b.officialTopicName && b.officialTopicName !== "Tópico não identificado") {
    detailText = b.officialTopicName;
  } else if (b.sourceHeading && b.sourceHeading !== "GERAL") {
    detailText = b.sourceHeading;
  } else if (b.description && b.description.length > 10) {
    detailText = b.description.split(/[.\n]/)[0].trim();
  }

  if (detailText.toLowerCase().includes(coreConcept.toLowerCase())) {
    coreConcept = detailText;
    detailText = "";
  }

  const subjectClean = subjectName.replace(/Direito /i, "").trim();
  let newTitle = coreConcept;

  if (!newTitle.toLowerCase().includes(subjectClean.toLowerCase())) {
    newTitle = `${coreConcept} no ${subjectClean}`;
  }

  if (detailText && detailText.length > 0) {
    const cleanDetail = detailText.replace(/Tópico\s+\d+\s*-?\s*/i, "").trim();
    if (cleanDetail.length > 5) {
      newTitle = `${newTitle} — ${cleanDetail.substring(0, 70)}`;
    }
  }

  newTitle = newTitle.charAt(0).toUpperCase() + newTitle.slice(1);
  newTitle = newTitle.replace(/[.\s—-]+$/, "").trim();

  // Mapeamentos específicos aprovados pelo usuário
  if (titleNorm === "COMPETENCIA") {
    return `Competência no ${subjectClean} — critérios de fixação, espécies e conflitos`;
  }
  if (titleNorm === "PROVAS") {
    return `Provas no ${subjectClean} — teoria geral e meios de prova`;
  }
  if (titleNorm === "RECURSOS") {
    return `Recursos no ${subjectClean} — teoria geral e recursos em espécie`;
  }
  if (titleNorm === "EXECUCAO") {
    return `Processo de Execução no ${subjectClean} — fundamentos, espécies e atos executivos`;
  }
  if (titleNorm === "ATOS PROCESSUAIS") {
    return `Atos Processuais no ${subjectClean} — forma, prazos e comunicação dos atos`;
  }

  return newTitle;
}

export function calculateBlockQualityScore(b: DetectedBlock, subjectName: string): { score: number; reasons: string[] } {
  let score = 0;
  const reasons = [];

  const titleNorm = b.title.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const isForbiddenLiteral = GENERIC_TITLES.some(gt => titleNorm === gt);
  const isForbiddenPattern = FORBIDDEN_GENERIC_PATTERNS.some(re => re.test(b.title));

  if (isForbiddenLiteral || isForbiddenPattern) {
    score -= 3;
    reasons.push("Título proibido absoluto");
  } else if (b.title.length >= 15 && b.title.split(/\s+/).length > 2) {
    score += 2;
    reasons.push("Título bom");
  } else {
    reasons.push("Título simples/fraco corrigível");
  }

  if (b.officialTopicId && b.officialTopicId !== "GERAL") {
    score += 2;
    reasons.push("Tópico oficial coerente");
  } else {
    reasons.push("Tópico geral");
  }

  if (b.pageStart > 0 && b.pageEnd >= b.pageStart) {
    score += 2;
    reasons.push("Páginas coerentes");
  } else {
    reasons.push("Intervalo de páginas inválido");
  }

  const isMainBlock = !b.type || b.type === "MAIN_BLOCK";
  if (isMainBlock) {
    score += 2;
    reasons.push("Bloco teórico principal");

    if (b.isQuestionsOnly || b.supportType === "QUESTIONS" || b.supportType === "ANSWER_KEY") {
      score -= 3;
      reasons.push("Questão/gabarito como MAIN_BLOCK");
    }
    if (b.isSummaryOnly || b.supportType === "SUMMARY" || b.supportType === "BIZU") {
      score -= 3;
      reasons.push("Resumo/bizu como MAIN_BLOCK");
    }
  } else {
    reasons.push("Bloco de apoio");
  }

  if (b.estimatedStudyMinutes >= 30 && b.estimatedStudyMinutes <= 60) {
    score += 1;
    reasons.push("Tempo de estudo coerente (30-60 min)");
  }

  if (b.description && b.description.length > 20) {
    score += 1;
    reasons.push("Descrição boa");
  }

  if (b.isMechanicalCut) {
    score -= 2;
    reasons.push("Fatiamento mecânico");
  }

  if (subjectName.toLowerCase().trim() === "outros") {
    score -= 3;
    reasons.push("Matéria genérica");
  }

  return { score, reasons };
}

export interface TOCEntry {
  heading: string;
  pageStart: number;
  pageEnd: number;
}

export function parseTOCLine(line: string, totalPages: number): { heading: string; pageStart: number } | null {
  // Pattern 1: dots, hyphens, underscores, or 2+ spaces followed by a page number
  const pattern1 = line.match(/^\s*(.+?)(?:\.{2,}|-{2,}|_{2,}|\s{2,})\s*(\d+)\s*$/);
  if (pattern1) {
    const heading = pattern1[1].trim();
    const pageStart = parseInt(pattern1[2], 10);
    if (pageStart >= 1 && pageStart <= totalPages) {
      return { heading, pageStart };
    }
  }

  // Pattern 2: starts with a section index (e.g. "4.1.", "1)", "Aula 01 -") and ends with a number
  // E.g. "4.1. Título da seção 15" or "Aula 01 - Introdução 3"
  const pattern2 = line.match(/^\s*((\d+(\.\d+)*|Aula\s+\d+|Capítulo\s+\d+|Seção\s+\d+|[a-zA-Z\u00C0-\u00FF\d\)\-\s]+?)\s+([a-zA-Z\u00C0-\u00FF\d\)\-\s,\/]+?))\s+(\d+)\s*$/);
  if (pattern2) {
    const heading = pattern2[1].trim();
    const pageStart = parseInt(pattern2[5], 10);
    if (pageStart >= 1 && pageStart <= totalPages && heading.length >= 3) {
      return { heading, pageStart };
    }
  }

  return null;
}

export function extractTOCFromText(text: string, totalPages: number): TOCEntry[] {
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const candidates: { heading: string; pageStart: number; lineIndex: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.toLowerCase().startsWith("página") || line.toLowerCase().startsWith("pagina")) continue;

    const parsed = parseTOCLine(line, totalPages);
    if (parsed) {
      const heading = parsed.heading
        .replace(/^[\s\.\-\*_]+/, "")
        .replace(/[\s\.\-\*_]+$/, "")
        .trim();

      if (/[a-zA-Z\u00C0-\u00FF]/.test(heading) && heading.length >= 3) {
        candidates.push({
          heading,
          pageStart: parsed.pageStart,
          lineIndex: i
        });
      }
    }
  }

  if (candidates.length === 0) return [];

  const n = candidates.length;
  const dp = new Array(n).fill(1);
  const parent = new Array(n).fill(-1);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (candidates[i].pageStart >= candidates[j].pageStart) {
        if (dp[j] + 1 > dp[i]) {
          dp[i] = dp[j] + 1;
          parent[i] = j;
        }
      }
    }
  }

  let maxLength = 0;
  let maxIdx = -1;
  for (let i = 0; i < n; i++) {
    if (dp[i] > maxLength) {
      maxLength = dp[i];
      maxIdx = i;
    }
  }

  if (maxIdx === -1) return [];

  const lndsSubsequence: typeof candidates = [];
  let curr = maxIdx;
  while (curr !== -1) {
    lndsSubsequence.push(candidates[curr]);
    curr = parent[curr];
  }
  lndsSubsequence.reverse();

  const tocEntries: TOCEntry[] = [];
  for (let i = 0; i < lndsSubsequence.length; i++) {
    const entry = lndsSubsequence[i];
    let pageEnd = totalPages;

    if (i < lndsSubsequence.length - 1) {
      const nextEntry = lndsSubsequence[i + 1];
      if (nextEntry.pageStart > entry.pageStart) {
        pageEnd = nextEntry.pageStart - 1;
      } else {
        pageEnd = entry.pageStart;
      }
    }

    tocEntries.push({
      heading: entry.heading,
      pageStart: entry.pageStart,
      pageEnd: pageEnd
    });
  }

  return tocEntries;
}

export interface DocumentSection {
  heading: string;
  pageStart: number;
  pageEnd: number;
  sectionType: "MAIN_THEORY" | "INTRO_PRESENTATION" | "SUMMARY_REVIEW" | "COMMENTED_QUESTIONS" | "QUESTIONS" | "ANSWER_KEY" | "SIMULATED_EXAM" | "APPENDIX" | "IGNORE";
}

export interface DocumentStructureMap {
  documentType: "THEORY_ONLY" | "THEORY_WITH_QUESTIONS" | "QUESTIONS_ONLY" | "ANSWER_KEY_ONLY" | "UNKNOWN";
  tocDetected: boolean;
  tocConfidence: number;
  sections: DocumentSection[];
}

export function classifyTOCHeadingForMap(heading: string): DocumentSection["sectionType"] {
  const norm = heading.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Answer Key (Gabarito)
  if (
    norm.includes("gabarito") ||
    norm.includes("resposta correta") ||
    norm.includes("respostas corretas") ||
    norm.includes("respostas")
  ) {
    return "ANSWER_KEY";
  }

  // Commented Questions
  if (
    (norm.includes("questoes") && (norm.includes("comentadas") || norm.includes("comentarios"))) ||
    norm.includes("comentadas") ||
    norm.includes("comentarios")
  ) {
    return "COMMENTED_QUESTIONS";
  }

  // Questions
  if (
    norm.includes("questoes") ||
    norm.includes("exercicio") ||
    norm.includes("provas") ||
    norm.includes("caderno de questoes") ||
    norm.includes("lista de questoes") ||
    norm.includes("questoes de fixacao") ||
    norm.includes("treino")
  ) {
    return "QUESTIONS";
  }

  // Simulated Exam
  if (norm.includes("simulado") || norm.includes("simulados")) {
    return "SIMULATED_EXAM";
  }

  // Summary / Review (Resumo / Revisão)
  if (
    norm.includes("resumo") ||
    norm.includes("bizu") ||
    norm.includes("mapa mental") ||
    norm.includes("mapas mentais") ||
    norm.includes("esquematico") ||
    norm.includes("revisao") ||
    norm.includes("checklist") ||
    norm.includes("roteiro") ||
    norm.includes("esquema")
  ) {
    return "SUMMARY_REVIEW";
  }

  // Intro / Presentation
  if (
    norm.includes("sumario") ||
    norm.includes("apresentacao") ||
    norm.includes("introducao ao curso") ||
    norm.includes("cronograma") ||
    norm.includes("prefacio")
  ) {
    return "INTRO_PRESENTATION";
  }

  // Appendix / References / Ignore
  if (
    norm.includes("bibliografia") ||
    norm.includes("referencias") ||
    norm.includes("anexo") ||
    norm.includes("apendice")
  ) {
    return "APPENDIX";
  }

  // Default is theory
  return "MAIN_THEORY";
}

export function buildDocumentStructureMap(
  pageTexts: { pageNumber: number; text: string }[],
  totalPages: number,
  subjectName: string,
  summaryContent: string
): DocumentStructureMap {
  console.log(`[buildDocumentStructureMap] Iniciando análise documental para ${totalPages} páginas.`);

  // Passo 1: Extrair sumário programático
  const tocEntries = extractTOCFromText(summaryContent, totalPages);
  const tocDetected = tocEntries.length > 0;
  const tocConfidence = tocDetected ? 0.95 : 0.0;

  const initialSections: DocumentSection[] = [];
  let firstContentPage = 1;

  // Passo 2: Criar mapa inicial de seções
  if (tocDetected) {
    // Identificar a primeira página de conteúdo real (teoria/questões)
    const mainEntries = tocEntries.filter(e => {
      const type = classifyTOCHeadingForMap(e.heading);
      return type === "MAIN_THEORY" || type === "COMMENTED_QUESTIONS" || type === "QUESTIONS";
    });

    firstContentPage = mainEntries.length > 0 ? Math.min(...mainEntries.map(e => e.pageStart)) : 1;

    // Se o sumário ou páginas iniciais forem puramente estruturais, agrupa no IGNORE/INTRO_PRESENTATION
    if (firstContentPage > 1) {
      initialSections.push({
        heading: "Sumário e Apresentação do Curso",
        pageStart: 1,
        pageEnd: firstContentPage - 1,
        sectionType: "IGNORE"
      });
    }

    for (const entry of tocEntries) {
      if (entry.pageStart < firstContentPage) {
        continue; // Já coberto pelo bloco estrutural inicial
      }
      initialSections.push({
        heading: entry.heading,
        pageStart: entry.pageStart,
        pageEnd: entry.pageEnd,
        sectionType: classifyTOCHeadingForMap(entry.heading)
      });
    }
  } else {
    // Se não há TOC detectado, tratar o documento inteiro como MAIN_THEORY inicialmente
    initialSections.push({
      heading: `Conteúdo Teórico Principal de ${subjectName}`,
      pageStart: 1,
      pageEnd: totalPages,
      sectionType: "MAIN_THEORY"
    });
  }

  console.log(`[buildDocumentStructureMap] ${initialSections.length} seções iniciais mapeadas.`);

  const processedSections: DocumentSection[] = [];

  // Passos 3, 4 e 5: Amostrar, classificar e corrigir intervalos de cada seção
  for (const section of initialSections) {
    if (section.sectionType === "IGNORE" || section.sectionType === "INTRO_PRESENTATION" || section.sectionType === "APPENDIX") {
      processedSections.push(section);
      continue;
    }

    // Pegar todas as páginas pertencentes a esta seção
    const sectionPages = pageTexts.filter(p => p.pageNumber >= section.pageStart && p.pageNumber <= section.pageEnd);
    if (sectionPages.length === 0) {
      processedSections.push(section);
      continue;
    }

    // Passo 3: Amostrar páginas de início/fim e meio
    const sampledPages: { pageNumber: number; text: string }[] = [];
    sampledPages.push(sectionPages[0]); // Primeira página da seção
    if (sectionPages.length > 1) {
      sampledPages.push(sectionPages[sectionPages.length - 1]); // Última página
    }
    if (sectionPages.length > 2) {
      const midIndex = Math.floor(sectionPages.length / 2);
      sampledPages.push(sectionPages[midIndex]); // Página do meio
    }

    // Passo 4: Classificar com base em amostragem real e heurística de score forte
    let questionPagesCount = 0;
    let answerKeyPagesCount = 0;
    let tocPagesCount = 0;

    for (const page of sampledPages) {
      if (isTOCPage(page.text) || page.pageNumber < firstContentPage) {
        tocPagesCount++;
      } else {
        const qgResult = detectQuestionsOrGabaritoHeuristic(page.text, { heading: section.heading, isTOCContext: page.pageNumber < firstContentPage });
        if (qgResult.isQuestions) questionPagesCount++;
        else if (qgResult.isAnswerKey) answerKeyPagesCount++;
      }
    }

    let finalType: DocumentSection["sectionType"] = section.sectionType;

    // Se a amostragem indicar que a seção inteira é na verdade questões/gabarito, reclassificamos!
    if (sampledPages.length > 0) {
      const majorityQuestions = (questionPagesCount / sampledPages.length) >= 0.6;
      const majorityGabarito = (answerKeyPagesCount / sampledPages.length) >= 0.6;
      const majorityTOC = (tocPagesCount / sampledPages.length) >= 0.6;

      if (majorityTOC) {
        finalType = "IGNORE";
      } else if (majorityGabarito) {
        finalType = "ANSWER_KEY";
      } else if (majorityQuestions) {
        finalType = (section.sectionType === "MAIN_THEORY") ? "COMMENTED_QUESTIONS" : "QUESTIONS";
      }
    }

    // Passo 5: Corrigir intervalos e detectar transições internas (Teoria -> Questões)
    // Se a seção é classificada como MAIN_THEORY e tem mais de 5 páginas, verificamos se no final dela começam questões
    if (finalType === "MAIN_THEORY" && sectionPages.length > 4) {
      let splitPageNumber = -1;

      // Percorre as páginas de trás para frente para detectar onde as questões começam
      for (let idx = sectionPages.length - 1; idx >= 1; idx--) {
        const page = sectionPages[idx];
        const qg = detectQuestionsOrGabaritoHeuristic(page.text, { heading: section.heading });
        if (qg.isQuestions || qg.isAnswerKey) {
          splitPageNumber = page.pageNumber;
        } else {
          // Paramos no primeiro bloco teórico real de trás para frente
          break;
        }
      }

      if (splitPageNumber !== -1 && splitPageNumber > section.pageStart + 1) {
        console.log(`[buildDocumentStructureMap] Transição teórica para apoio detectada na página ${splitPageNumber} da seção "${section.heading}". Fatiando seção...`);
        
        // Adiciona a parte teórica ajustada
        processedSections.push({
          ...section,
          pageEnd: splitPageNumber - 1,
          sectionType: "MAIN_THEORY"
        });

        // Adiciona a parte de questões detectada
        const isAnswer = detectQuestionsOrGabaritoHeuristic(pageTexts.find(p => p.pageNumber === splitPageNumber)?.text || "").isAnswerKey;
        processedSections.push({
          heading: `${section.heading} — Exercícios e Resolução`,
          pageStart: splitPageNumber,
          pageEnd: section.pageEnd,
          sectionType: isAnswer ? "ANSWER_KEY" : "QUESTIONS"
        });

        continue;
      }
    }

    processedSections.push({
      ...section,
      sectionType: finalType
    });
  }

  // Passo 6: Retornar o DocumentStructureMap
  const hasTheory = processedSections.some(s => s.sectionType === "MAIN_THEORY");
  const hasQuestions = processedSections.some(s => s.sectionType === "QUESTIONS" || s.sectionType === "COMMENTED_QUESTIONS" || s.sectionType === "SIMULATED_EXAM");
  let documentType: DocumentStructureMap["documentType"] = "UNKNOWN";

  if (hasTheory && hasQuestions) {
    documentType = "THEORY_WITH_QUESTIONS";
  } else if (hasTheory) {
    documentType = "THEORY_ONLY";
  } else if (hasQuestions) {
    documentType = "QUESTIONS_ONLY";
  }

  const mapResult: DocumentStructureMap = {
    documentType,
    tocDetected,
    tocConfidence,
    sections: processedSections
  };

  console.log(`[buildDocumentStructureMap] Mapa estrutural final concluído. Tipo de documento: ${documentType}. TOC Detectado: ${tocDetected}`);
  return mapResult;
}

export function classifyTOCHeading(heading: string): "MAIN_THEORY" | "QUESTIONS" | "ANSWER_KEY" | "SUMMARY" | "SUPPORT" {
  const mapType = classifyTOCHeadingForMap(heading);
  if (mapType === "ANSWER_KEY") return "ANSWER_KEY";
  if (mapType === "QUESTIONS" || mapType === "COMMENTED_QUESTIONS" || mapType === "SIMULATED_EXAM") return "QUESTIONS";
  if (mapType === "SUMMARY_REVIEW") return "SUMMARY";
  if (mapType === "INTRO_PRESENTATION" || mapType === "IGNORE" || mapType === "APPENDIX") return "SUPPORT";
  return "MAIN_THEORY";
}

export function findBestOfficialTopic(
  text: string,
  officialTopics: { id: string; topicCode: string; title: string }[]
): { id: string; topicCode: string; title: string } | null {
  if (officialTopics.length === 0) return null;

  const cleanText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words = cleanText.split(/[^\w]+/i).filter(w => w.length > 3);

  let bestTopic = officialTopics[0];
  let maxScore = -1;

  for (const topic of officialTopics) {
    const topicTitleClean = topic.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    let score = 0;
    for (const w of words) {
      if (topicTitleClean.includes(w)) {
        score += w.length;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestTopic = topic;
    }
  }

  return bestTopic;
}

export function buildBlocksFromTOC(
  tocEntries: TOCEntry[],
  subjectName: string,
  officialTopics: { id: string; topicCode: string; title: string }[],
  _totalPages: number
): DetectedBlock[] {
  void _totalPages;
  const blocks: DetectedBlock[] = [];
  let currentGroup: TOCEntry[] = [];
  let currentPages = 0;

  const saveCurrentGroup = () => {
    if (currentGroup.length === 0) return;

    const firstEntry = currentGroup[0];
    const lastEntry = currentGroup[currentGroup.length - 1];
    
    let groupTitle = currentGroup.map(e => e.heading).join(" e ");
    if (groupTitle.length > 80) {
      groupTitle = `${firstEntry.heading} e outros subtemas`;
    }

    const description = `Estudo detalhado de: ${currentGroup.map(e => e.heading).join(", ")}.`;
    const pageStart = firstEntry.pageStart;
    const pageEnd = lastEntry.pageEnd;

    const bestTopic = findBestOfficialTopic(groupTitle + " " + description, officialTopics);

    const block: DetectedBlock = {
      type: "MAIN_BLOCK",
      title: groupTitle,
      description,
      pageStart,
      pageEnd,
      sourceHeading: firstEntry.heading,
      estimatedStudyMinutes: 60,
      officialTopicId: bestTopic?.id || null,
      topicCode: bestTopic?.topicCode || "GERAL",
      officialTopicName: bestTopic?.title || "Tópico não identificado",
      justification: "Reconstrução determinística pelo sumário devido a falha na extração de blocos da IA."
    };

    block.title = enhanceBlockTitle(block, subjectName);
    blocks.push(block);

    currentGroup = [];
    currentPages = 0;
  };

  for (const entry of tocEntries) {
    const type = classifyTOCHeading(entry.heading);
    const pageCount = (entry.pageEnd - entry.pageStart) + 1;

    if (type === "SUPPORT") {
      // Exclui sumário físico e apresentações estruturais de virarem qualquer tipo de bloco
      continue;
    }

    if (type === "MAIN_THEORY") {
      if (currentGroup.length === 0) {
        currentGroup.push(entry);
        currentPages = pageCount;
      } else {
        const entryIsMajor = /^\s*(aula\s+\d+|capitulo\s+\d+|\d+\s*[\).\-]\s+[a-zA-Z\u00C0-\u00FF])/i.test(entry.heading);
        const currentIsLarge = currentPages >= 4;
        const entryIsLarge = pageCount >= 4;

        const shouldStartNew = (currentPages + pageCount > 18) || (currentIsLarge && (entryIsMajor || entryIsLarge));

        if (shouldStartNew) {
          saveCurrentGroup();
        }

        currentGroup.push(entry);
        currentPages += pageCount;
      }
    } else {
      saveCurrentGroup();

      let supportType: string = "OTHER";
      if (type === "QUESTIONS") supportType = "QUESTIONS";
      else if (type === "ANSWER_KEY") supportType = "ANSWER_KEY";
      else if (type === "SUMMARY") supportType = "SUMMARY";

      const bestTopic = findBestOfficialTopic(entry.heading, officialTopics);

      blocks.push({
        type: "SUPPORT_BLOCK",
        title: entry.heading,
        description: `Material de apoio: ${entry.heading}`,
        pageStart: entry.pageStart,
        pageEnd: entry.pageEnd,
        sourceHeading: entry.heading,
        estimatedStudyMinutes: 0,
        officialTopicId: bestTopic?.id || null,
        topicCode: bestTopic?.topicCode || "GERAL",
        officialTopicName: bestTopic?.title || "Tópico não identificado",
        supportType,
        justification: "Fatiamento de apoio direto pelo sumário."
      });
    }
  }

  saveCurrentGroup();

  return blocks;
}

export function splitByTOCMainSections(
  block: DetectedBlock,
  tocEntries: TOCEntry[],
  subjectName: string,
  officialTopics: { id: string; topicCode: string; title: string }[]
): DetectedBlock[] {
  console.log(`[splitByTOCMainSections] Iniciando desmembramento de bloco "${block.title}" (páginas ${block.pageStart}-${block.pageEnd}) usando sumário.`);

  // Encontra todas as entradas do sumário que caem dentro deste bloco
  const blockEntries = tocEntries.filter(t => 
    t.pageStart >= block.pageStart && 
    t.pageStart <= block.pageEnd
  );

  // Filtra apenas entradas de teoria principal
  const theoryEntries = blockEntries.filter(t => classifyTOCHeading(t.heading) === "MAIN_THEORY");

  if (theoryEntries.length <= 1) {
    console.log(`[splitByTOCMainSections] Apenas ${theoryEntries.length} seções teóricas encontradas no intervalo. Mantendo bloco unificado.`);
    return [block];
  }

  // Ajustar o pageEnd da última entrada para coincidir com o pageEnd do bloco original
  theoryEntries[theoryEntries.length - 1].pageEnd = block.pageEnd;

  const splitBlocks: DetectedBlock[] = [];
  let currentGroup: TOCEntry[] = [];
  let currentPages = 0;

  const saveCurrentGroup = () => {
    if (currentGroup.length === 0) return;

    const firstEntry = currentGroup[0];
    const lastEntry = currentGroup[currentGroup.length - 1];

    let groupTitle = currentGroup.map(e => e.heading).join(" e ");
    if (groupTitle.length > 80) {
      groupTitle = `${firstEntry.heading} e outros subtemas`;
    }

    const description = `Estudo detalhado de: ${currentGroup.map(e => e.heading).join(", ")}.`;
    const pageStart = firstEntry.pageStart;
    const pageEnd = lastEntry.pageEnd;

    const bestTopic = findBestOfficialTopic(groupTitle + " " + description, officialTopics);

    const newBlock: DetectedBlock = {
      type: "MAIN_BLOCK",
      title: groupTitle,
      description,
      pageStart,
      pageEnd,
      sourceHeading: firstEntry.heading,
      estimatedStudyMinutes: 60,
      officialTopicId: bestTopic?.id || null,
      topicCode: bestTopic?.topicCode || "GERAL",
      officialTopicName: bestTopic?.title || "Tópico não identificado",
      justification: "Desmembrado do bloco único gigante com base nas seções teóricas do sumário."
    };

    newBlock.title = enhanceBlockTitle(newBlock, subjectName);
    splitBlocks.push(newBlock);

    currentGroup = [];
    currentPages = 0;
  };

  for (const entry of theoryEntries) {
    const pageCount = (entry.pageEnd - entry.pageStart) + 1;

    if (currentGroup.length === 0) {
      currentGroup.push(entry);
      currentPages = pageCount;
    } else {
      const entryIsMajor = /^\s*(aula\s+\d+|capitulo\s+\d+|\d+\s*[\).\-]\s+[a-zA-Z\u00C0-\u00FF])/i.test(entry.heading);
      const currentIsLarge = currentPages >= 4;
      const entryIsLarge = pageCount >= 4;

      const shouldStartNew = (currentPages + pageCount > 18) || (currentIsLarge && (entryIsMajor || entryIsLarge));

      if (shouldStartNew) {
        saveCurrentGroup();
      }

      currentGroup.push(entry);
      currentPages += pageCount;
    }
  }

  saveCurrentGroup();

  console.log(`[splitByTOCMainSections] Bloco desmembrado com sucesso em ${splitBlocks.length} blocos.`);
  return splitBlocks;
}

export function handleLargePDFSingleBlockSplitting(
  blocks: DetectedBlock[],
  tocEntries: TOCEntry[],
  totalPages: number,
  subjectName: string,
  officialTopics: { id: string; topicCode: string; title: string }[]
): DetectedBlock[] {
  // Executa o fatiamento apenas para PDFs grandes com sumário confiável
  if (totalPages <= 30 || tocEntries.length === 0) {
    return blocks;
  }

  const mainBlocks = blocks.filter(b => !b.type || b.type === "MAIN_BLOCK");
  const supportBlocks = blocks.filter(b => b.type === "SUPPORT_BLOCK");

  const tocTheoryEntries = tocEntries.filter(t => classifyTOCHeading(t.heading) === "MAIN_THEORY");

  if (mainBlocks.length === 1 && tocTheoryEntries.length >= 2) {
    console.log(`[handleLargePDFSingleBlockSplitting] PDF grande (>30 pág) com colapso detectado de apenas 1 bloco teórico principal. Desmembrando via splitByTOCMainSections...`);
    const singleBlock = mainBlocks[0];
    const splitBlocks = splitByTOCMainSections(singleBlock, tocEntries, subjectName, officialTopics);
    return [...splitBlocks, ...supportBlocks];
  }

  return blocks;
}


export function repairMicroTheoryBlocks(blocks: DetectedBlock[], _totalPages: number): DetectedBlock[] {
  void _totalPages;
  if (blocks.length <= 1) {
    if (blocks.length === 1 && (blocks[0].type || "MAIN_BLOCK") === "MAIN_BLOCK") {
      const pageCount = (blocks[0].pageEnd - blocks[0].pageStart) + 1;
      if (pageCount <= 2) {
        blocks[0].shortBlockJustification = "Densidade/Limite total do documento. Unidade isolada real de teoria.";
        blocks[0].justification = "Permitido microbloco devido ao tamanho total reduzido do PDF.";
      }
    }
    return blocks;
  }

  let repaired = [...blocks];
  let changed = true;

  while (changed) {
    changed = false;
    const newBlocks: DetectedBlock[] = [];

    for (let i = 0; i < repaired.length; i++) {
      const b = repaired[i];
      const pageCount = (b.pageEnd - b.pageStart) + 1;
      const isMainBlock = (!b.type || b.type === "MAIN_BLOCK");

      if (isMainBlock && pageCount <= 2 && !b.shortBlockJustification) {
        let merged = false;

        // 1. Try to merge with previous block
        if (newBlocks.length > 0) {
          const prev = newBlocks[newBlocks.length - 1];
          const isPrevMain = (!prev.type || prev.type === "MAIN_BLOCK");
          if (isPrevMain && prev.pageEnd + 2 >= b.pageStart) {
            prev.pageEnd = Math.max(prev.pageEnd, b.pageEnd);
            prev.title = `${prev.title} e ${b.title}`.substring(0, 100);
            prev.description = `${prev.description} | ${b.description}`.substring(0, 200);
            prev.mergeRationale = `Mesclado microbloco teórico (${pageCount} pág) com o bloco anterior.`;
            merged = true;
            changed = true;
            continue;
          }
        }

        // 2. Try to merge with next block
        if (!merged && i < repaired.length - 1) {
          const next = repaired[i + 1];
          const isNextMain = (!next.type || next.type === "MAIN_BLOCK");
          if (isNextMain && b.pageEnd + 2 >= next.pageStart) {
            next.pageStart = Math.min(b.pageStart, next.pageStart);
            next.title = `${b.title} e ${next.title}`.substring(0, 100);
            next.description = `${b.description} | ${next.description}`.substring(0, 200);
            next.mergeRationale = `Mesclado microbloco teórico (${pageCount} pág) com o bloco seguinte.`;
            merged = true;
            changed = true;
            continue;
          }
        }

        // 3. Try to merge with any other block of the same officialTopicId
        if (!merged) {
          for (let j = 0; j < newBlocks.length; j++) {
            const candidate = newBlocks[j];
            const isCandMain = (!candidate.type || candidate.type === "MAIN_BLOCK");
            if (isCandMain && candidate.officialTopicId === b.officialTopicId) {
              candidate.pageStart = Math.min(candidate.pageStart, b.pageStart);
              candidate.pageEnd = Math.max(candidate.pageEnd, b.pageEnd);
              candidate.title = `${candidate.title} e ${b.title}`.substring(0, 100);
              candidate.mergeRationale = `Agrupado microbloco do mesmo macrotema.`;
              merged = true;
              changed = true;
              break;
            }
          }
          if (merged) continue;

          for (let j = i + 1; j < repaired.length; j++) {
            const candidate = repaired[j];
            const isCandMain = (!candidate.type || candidate.type === "MAIN_BLOCK");
            if (isCandMain && candidate.officialTopicId === b.officialTopicId) {
              candidate.pageStart = Math.min(b.pageStart, candidate.pageStart);
              candidate.pageEnd = Math.max(b.pageEnd, candidate.pageEnd);
              candidate.title = `${b.title} e ${candidate.title}`.substring(0, 100);
              candidate.mergeRationale = `Agrupado microbloco do mesmo macrotema.`;
              merged = true;
              changed = true;
              break;
            }
          }
          if (merged) continue;
        }

        // 4. Fallback: merge with closest theoretical block anyway
        if (!merged) {
          if (newBlocks.length > 0) {
            const prev = newBlocks[newBlocks.length - 1];
            const isPrevMain = (!prev.type || prev.type === "MAIN_BLOCK");
            if (isPrevMain) {
              prev.pageEnd = Math.max(prev.pageEnd, b.pageEnd);
              prev.title = `${prev.title} e ${b.title}`.substring(0, 100);
              prev.mergeRationale = `Mesclado microbloco residual com o bloco anterior.`;
              merged = true;
              changed = true;
              continue;
            }
          }
          if (!merged && i < repaired.length - 1) {
            const next = repaired[i + 1];
            const isNextMain = (!next.type || next.type === "MAIN_BLOCK");
            if (isNextMain) {
              next.pageStart = Math.min(b.pageStart, next.pageStart);
              next.title = `${b.title} e ${next.title}`.substring(0, 100);
              next.mergeRationale = `Mesclado microbloco residual com o bloco seguinte.`;
              merged = true;
              changed = true;
              continue;
            }
          }
        }

        if (!merged) {
          b.shortBlockJustification = "Unidade isolada real e irredutível de teoria.";
          b.justification = "Mantido microbloco de teoria por impossibilidade pedagógica de mesclagem.";
        }
      }

      newBlocks.push(b);
    }

    repaired = newBlocks;
  }

  return repaired;
}

export function repairDetectedBlocks(
  aiBlocks: DetectedBlock[],
  tocEntries: TOCEntry[],
  subjectName: string,
  officialTopics: { id: string; topicCode: string; title: string }[]
): DetectedBlock[] {
  const repairedBlocks: DetectedBlock[] = [];

  // Encontrar primeira página de conteúdo real a partir do sumário para excluir sumário físico de qualquer bloco
  const mainEntries = tocEntries.filter(e => {
    const type = classifyTOCHeadingForMap(e.heading);
    return type === "MAIN_THEORY" || type === "COMMENTED_QUESTIONS" || type === "QUESTIONS";
  });
  const firstContentPage = mainEntries.length > 0 ? Math.min(...mainEntries.map(e => e.pageStart)) : 1;

  for (const originalBlock of aiBlocks) {
    const b = { ...originalBlock };

    // Excluir sumário físico e ajustar limites de páginas
    if (b.pageEnd < firstContentPage) {
      console.log(`[Auto-Repair] Descartando bloco "${b.title}" (páginas ${b.pageStart}-${b.pageEnd}) pois está totalmente contido na região do sumário físico (antes da página ${firstContentPage}).`);
      continue;
    }
    if (b.pageStart < firstContentPage) {
      console.log(`[Auto-Repair] Ajustando pageStart de ${b.pageStart} para ${firstContentPage} para o bloco "${b.title}" para excluir páginas do sumário físico.`);
      b.pageStart = firstContentPage;
    }
    if (b.pageStart > b.pageEnd) {
      continue;
    }

    const originalTitle = b.title || "Sem Título";
    const titleNorm = originalTitle.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const isForbiddenLiteral = GENERIC_TITLES.some(gt => titleNorm === gt);
    const isForbiddenPattern = FORBIDDEN_GENERIC_PATTERNS.some(re => re.test(originalTitle));
    const isWeak = WEAK_CORRIGIBLE_TITLES.some(wt => titleNorm === wt) || 
                   originalTitle.length < 12 || 
                   originalTitle.split(/\s+/).length <= 2;

    if (isForbiddenLiteral || isForbiddenPattern || isWeak) {
      const enhanced = enhanceBlockTitle(b, subjectName);
      const titleNormEnhanced = enhanced.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const stillForbidden = GENERIC_TITLES.some(gt => titleNormEnhanced === gt) ||
                             FORBIDDEN_GENERIC_PATTERNS.some(re => re.test(enhanced));
      
      if (stillForbidden) {
        if (b.officialTopicName && b.officialTopicName !== "Tópico não identificado") {
          b.title = `${b.officialTopicName} no ${subjectName.replace(/Direito /i, "")}`;
        } else {
          const matchingTOC = tocEntries.find(t => b.pageStart >= t.pageStart && b.pageStart <= t.pageEnd);
          if (matchingTOC) {
            b.title = `${matchingTOC.heading} no ${subjectName.replace(/Direito /i, "")}`;
          } else {
            b.title = `Estudo de ${subjectName.replace(/Direito /i, "")} — Páginas ${b.pageStart} a ${b.pageEnd}`;
          }
        }
      } else {
        b.title = enhanced;
      }
    }

    if (b.type === "SUPPORT_BLOCK" || b.supportType === "QUESTIONS" || b.supportType === "SUMMARY") {
      const matchingTOC = tocEntries.find(t => b.pageStart >= t.pageStart && b.pageStart <= t.pageEnd);
      if (matchingTOC) {
        const tocClass = classifyTOCHeading(matchingTOC.heading);
        if (tocClass === "MAIN_THEORY") {
          b.type = "MAIN_BLOCK";
          b.supportType = null;
          b.isQuestionsOnly = false;
          b.isSummaryOnly = false;
          b.justification = `Reclassificado de apoio para bloco principal teórico com base na seção "${matchingTOC.heading}" do sumário.`;
          
          if (!b.officialTopicId) {
            const bestTopic = findBestOfficialTopic(matchingTOC.heading, officialTopics);
            if (bestTopic) {
              b.officialTopicId = bestTopic.id;
              b.topicCode = bestTopic.topicCode;
              b.officialTopicName = bestTopic.title;
            }
          }
        }
      }
    }

    if ((!b.type || b.type === "MAIN_BLOCK") && !b.officialTopicId && officialTopics.length > 0) {
      const combinedText = `${b.title} ${b.description} ${b.sourceHeading || ""}`;
      const bestTopic = findBestOfficialTopic(combinedText, officialTopics);
      if (bestTopic) {
        b.officialTopicId = bestTopic.id;
        b.topicCode = bestTopic.topicCode;
        b.officialTopicName = bestTopic.title;
      }
    }

    repairedBlocks.push(b);
  }

  return tryMergeShortBlocks(repairedBlocks);
}

export async function detectStructure(
  summaryContent: string,
  totalPages: number,
  subjectName: string,
  pageTexts?: { pageNumber: number; text: string }[]
): Promise<DetectedStructureResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");

  const genAI = new GoogleGenerativeAI(apiKey);

  // 1. Construir o mapa estrutural determinístico completo do documento antes da geração de blocos
  const docStructureMap = buildDocumentStructureMap(pageTexts || [], totalPages, subjectName, summaryContent);
  const tocEntries = extractTOCFromText(summaryContent, totalPages);
  const tocDetected = docStructureMap.tocDetected;
  const tocConfidence = docStructureMap.tocConfidence;
  const sourceStrategy = tocDetected ? "TOC_BASED" : "CONTENT_BASED";

  const mainTheorySections = docStructureMap.sections.filter(s => s.sectionType === "MAIN_THEORY");
  const hasMainTheory = mainTheorySections.length >= 1;

  const relevantTopics = OFFICIAL_TOPICS.filter(
    t => t.subjectName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
         subjectName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );

  const officialTopicsListText = relevantTopics.length > 0
    ? relevantTopics.map(t => `- ID: '${t.id}' | Código: '${t.topicCode}' | Título: '${t.title}'`).join('\n')
    : "Esta matéria não possui matriz de tópicos cadastrada. Use officialTopicId = null, topicCode = 'GERAL', officialTopicName = 'Tópico não identificado'.";

  // Serializar o mapa estrutural completo do documento para guiar a IA de forma precisa
  const tocJsonText = JSON.stringify(docStructureMap, null, 2);
  const initialPrompt = buildStructurePrompt(summaryContent, subjectName, officialTopicsListText, tocJsonText) +
    `\n\nTotal de páginas do PDF: ${totalPages}`;
  
  let lastError: any = null;

  for (const modelName of GEMINI_MODEL_CANDIDATES) {
    console.log(`[AI Structure] Tentando mapear estrutura usando o modelo: ${modelName}`);
    try {
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
        }
      });

      let attempts = 0;
      let currentPrompt = initialPrompt;
      let lastResponse = "";
      let accumulatedErrors: string[] = [];
      let geminiApiError: string | null = null;
      let jsonParseError: string | null = null;

      while (attempts < 2) {
        try {
          const result = await callGeminiWithRetry(() => model.generateContent(currentPrompt));
          const response = await result.response;
          lastResponse = response.text();
          
          const startIndex = lastResponse.indexOf("{");
          const endIndex = lastResponse.lastIndexOf("}");
          if (startIndex === -1) {
            jsonParseError = "Estrutura JSON não encontrada na resposta da IA.";
            throw new Error("JSON não encontrado");
          }
          
          const cleanJson = lastResponse.substring(startIndex, endIndex + 1);
          let parsedResult: DetectedStructureResult;
          try {
            parsedResult = JSON.parse(cleanJson);
          } catch (e: any) {
            jsonParseError = `Falha no parse do JSON da IA: ${e.message}`;
            throw e;
          }
          
          const role = parsedResult.materialRole || "UNKNOWN";
          let blocks = parsedResult.blocks || [];

          // --- PIPELINE DE AUTO-REPARO DE BLOCOS ---
          console.log(`[Auto-Repair] Iniciando pipeline de auto-reparo para ${blocks.length} blocos...`);
          blocks = repairDetectedBlocks(blocks, tocEntries, subjectName, relevantTopics);
          blocks = handleLargePDFSingleBlockSplitting(blocks, tocEntries, totalPages, subjectName, relevantTopics);
          blocks = repairMicroTheoryBlocks(blocks, totalPages);
          console.log(`[Auto-Repair] Concluído. Blocos ativos após reparo: ${blocks.length}`);

          // --- Validação Inteligente Técnico & Pedagógica por Score ---
          const errors: string[] = [];
          const validatedBlocks: DetectedBlock[] = [];
          const isSupportOnlyMaterial = role === "SUPPORT_MATERIAL";

          // Validação: TOC_MAPPING_FAILED se os blocos teóricos gerados não correspondem ao sumário
          if (tocDetected && role !== "SUPPORT_MATERIAL" && blocks.length > 0) {
            let tocMatchCount = 0;
            for (const b of blocks) {
              if (b.type !== "SUPPORT_BLOCK") {
                const matchesTOCPage = tocEntries.some(t => Math.abs(t.pageStart - b.pageStart) <= 1);
                if (matchesTOCPage) tocMatchCount++;
              }
            }
            if (tocMatchCount === 0 && blocks.some(b => b.type !== "SUPPORT_BLOCK")) {
              errors.push("TOC_MAPPING_FAILED: Os blocos teóricos gerados não correspondem às páginas e divisões do sumário extraído.");
            }
          }

          // Se o sumário tem vários capítulos e a IA retornou apenas 1 bloco teórico, pode ser um colapso incorreto
          const tocTheoryEntriesCount = tocEntries.filter(t => 
            !t.heading.toLowerCase().includes("questoes") && 
            !t.heading.toLowerCase().includes("exercicio") &&
            !t.heading.toLowerCase().includes("gabarito") &&
            !t.heading.toLowerCase().includes("resumo")
          ).length;

          const mainBlocksInResult = blocks.filter(b => !b.type || b.type === "MAIN_BLOCK");

          if (tocDetected && tocTheoryEntriesCount >= 3 && mainBlocksInResult.length === 1) {
            const singleBlock = mainBlocksInResult[0];
            const hasGoodRationale = singleBlock && (singleBlock.selectionJustification?.length || 0) > 10;
            if (!hasGoodRationale) {
              errors.push("VALIDATION_FAILED: O sumário possui várias seções teóricas independentes, mas todo o conteúdo foi colapsado em um único bloco sem justificativa pedagógica coerente.");
            }
          }

          for (const b of blocks) {
            const originalTitle = b.title || "Sem Título";
            const titleNorm = originalTitle.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

            const isForbiddenLiteral = GENERIC_TITLES.some(gt => titleNorm === gt);
            const isForbiddenPattern = FORBIDDEN_GENERIC_PATTERNS.some(re => re.test(originalTitle));

            let titleCategory: "PROIBIDO" | "FRACO" | "BOM" = "BOM";
            if (isForbiddenLiteral || isForbiddenPattern) {
              titleCategory = "PROIBIDO";
            } else if (
              WEAK_CORRIGIBLE_TITLES.some(wt => titleNorm === wt) || 
              originalTitle.length < 12 || 
              originalTitle.split(/\s+/).length <= 2
            ) {
              titleCategory = "FRACO";
            }

            // Aprimoramento se for fraco
            let enhancedTitle = originalTitle;
            if (titleCategory === "FRACO") {
              enhancedTitle = enhanceBlockTitle(b, subjectName);
            }

            b.title = enhancedTitle;

            let intervalQuestionsScore = 0;
            let intervalTheoryScore = 0;

            // Executar heurísticas adicionais baseadas no texto da página
            if (pageTexts && pageTexts.length > 0) {
              const blockPages = pageTexts.filter(p => p.pageNumber >= b.pageStart && p.pageNumber <= b.pageEnd);
              const fullBlockText = blockPages.map(p => p.text).join("\n");
              const normalizedBlockText = fullBlockText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

              if (normalizedBlockText.trim().length > 0) {
                // Heurística programática de Questões/Gabaritos
                const qgResult = detectQuestionsOrGabaritoHeuristic(fullBlockText);
                
                // Calcular pontuação de questões e teoria por densidade
                const qKeywords = ["questao", "questoes", "exercicio", "exercicios", "simulado", "prova", "assinale", "julgue", "alternativa"];
                qKeywords.forEach(kw => {
                  const matches = normalizedBlockText.match(new RegExp(kw, "g"));
                  if (matches) intervalQuestionsScore += matches.length;
                });
                
                const tKeywords = ["conceito", "definicao", "exemplo", "classificacao", "regra", "excecao", "jurisprudencia", "artigo", "doutrina", "explicacao"];
                let positiveScore = 0;
                tKeywords.forEach(kw => {
                  const matches = normalizedBlockText.match(new RegExp(kw, "g"));
                  if (matches) {
                    intervalTheoryScore += matches.length;
                    positiveScore += matches.length;
                  }
                });

                if (qgResult.isQuestions || qgResult.isAnswerKey) {
                  b.type = "SUPPORT_BLOCK";
                  b.supportType = qgResult.isQuestions ? "QUESTIONS" : "ANSWER_KEY";
                  b.isQuestionsOnly = true;
                  b.estimatedStudyMinutes = 0;
                  b.description = b.description || `Banco de questões/gabarito de apoio para o assunto.`;
                } else {
                  // Checar se é resumo ou bizu
                  const negativeKeywords = [
                    "resumo", "bizu", "mapa mental", "mapas mentais", "gabarito", "questoes", "questões",
                    "simulado", "revisao de vespera", "revisão de véspera", "revisao rapida", "revisão rápida",
                    "esquematico", "esquemático", "checklist"
                  ];
                  let negativeScore = 0;
                  negativeKeywords.forEach(kw => {
                    const regex = new RegExp(kw, "g");
                    const matches = normalizedBlockText.match(regex);
                    if (matches) negativeScore += matches.length;
                  });

                  if (negativeScore > 6 && positiveScore <= 2) {
                    b.isSummaryOnly = true;
                  }
                }
              }
            }

            // Calcular score
            const { score, reasons } = calculateBlockQualityScore(b, subjectName);

            let decision: "ACCEPTED" | "ENHANCED" | "REJECTED" = "ACCEPTED";
            if (titleCategory === "PROIBIDO") {
              decision = "REJECTED";
            } else if (score < 4) {
              decision = "REJECTED";
            } else if (titleCategory === "FRACO" && enhancedTitle !== originalTitle) {
              decision = "ENHANCED";
            }

            // Exibir log formatado de diagnóstico pedagógico [BlockValidation]
            console.log(`[BlockValidation] block: "${originalTitle}"`);
            console.log(`[BlockValidation] block page range: ${b.pageStart}-${b.pageEnd}`);
            console.log(`[BlockValidation] interval has questions: ${intervalQuestionsScore}`);
            console.log(`[BlockValidation] interval has theory: ${intervalTheoryScore}`);
            console.log(`[BlockValidation] type: "${b.type || "MAIN_BLOCK"}"`);
            console.log(`[BlockValidation] titleCategory: ${titleCategory}`);
            console.log(`[BlockValidation] enhancedTitle: "${enhancedTitle}"`);
            console.log(`[BlockValidation] qualityScore: ${score}`);
            console.log(`[BlockValidation] decision: ${decision}`);
            console.log(`[BlockValidation] reasons: ${reasons.join(", ")}`);

            if (decision === "REJECTED") {
              const isMain = !b.type || b.type === "MAIN_BLOCK";
              if (isMain && !isSupportOnlyMaterial) {
                errors.push(`VALIDATION_FAILED: A seleção de páginas ${b.pageStart}-${b.pageEnd} para o bloco principal "${originalTitle}" foi rejeitada. Razões: ${reasons.join("; ")}`);
              }
            } else {
              validatedBlocks.push(b);
            }
          }

          // Logs de acompanhamento geral de materiais mistos/principais
          const mainBlocksList = validatedBlocks.filter(b => !b.type || b.type === "MAIN_BLOCK");
          const supportBlocksList = validatedBlocks.filter(b => b.type === "SUPPORT_BLOCK");
          console.log(`[MixedMaterial] mainBlocks: ${mainBlocksList.length}`);
          console.log(`[MixedMaterial] supportBlocks: ${supportBlocksList.length}`);

          // Validação de Fatiamento Mecânico por número fixo de páginas
          if (errors.length === 0 && !isSupportOnlyMaterial) {
            const hasMechanicalCutting = detectMechanicalCuttingHeuristic(validatedBlocks);
            if (hasMechanicalCutting) {
              console.warn("[AI Validation] Rejeitando divisão por fatiamento mecânico de páginas detectado pelo backend.");
              errors.push("VALIDATION_FAILED: A divisão anterior parece ter sido feita por cortes fixos de páginas (ex: de 10 em 10 páginas), e não por unidade temática.");
            }
          }

          // Garantir pelo menos um bloco principal se for MAIN_MATERIAL ou MIXED_MATERIAL
          if (errors.length === 0) {
            const mainBlocksCount = mainBlocksList.length;
            if (role === "MAIN_MATERIAL" && mainBlocksCount === 0) {
              errors.push(`NO_MAIN_THEORY_FOUND: O material foi classificado como ${role}, mas nenhum bloco principal de teoria (MAIN_BLOCK) válido foi gerado.`);
            } else if (role === "MIXED_MATERIAL" && mainBlocksCount === 0) {
              const hasTheoryBlocks = blocks.some(b => 
                (!b.type || b.type === "MAIN_BLOCK") && 
                (b.pageTypes?.includes("MAIN_THEORY") || b.pageTypes?.includes("EXPLANATION"))
              );
              if (hasTheoryBlocks) {
                errors.push("NO_MAIN_THEORY_FOUND: O material foi classificado como MIXED_MATERIAL com teoria evidente, mas nenhum bloco principal de teoria (MAIN_BLOCK) válido foi gerado.");
              } else {
                console.log("[MixedMaterial] Permitindo MIXED_MATERIAL sem MAIN_BLOCK pois não há teoria principal densa.");
              }
            }
          }

          // Se houver algum erro de qualidade da IA, mas o sumário for confiável, resgatar!
          if (errors.length > 0 && tocDetected && tocConfidence >= 0.65 && hasMainTheory) {
            console.log(`[TOC Rescue] A IA falhou ou gerou blocos ruins, mas o sumário é confiável. Iniciando reconstrução determinística via sumário...`);
            let rescueBlocks = buildBlocksFromTOC(tocEntries, subjectName, relevantTopics, totalPages);
            rescueBlocks = repairMicroTheoryBlocks(rescueBlocks, totalPages);
            
            rescueBlocks = rescueBlocks.map(b => {
              const topicId = b.officialTopicId || null;
              let code = b.topicCode || "GERAL";
              let name = b.officialTopicName || "Tópico não identificado";

              if (topicId) {
                const found = relevantTopics.find(t => t.id === topicId);
                if (found) {
                  code = found.topicCode;
                  name = found.title;
                }
              }
              return {
                ...b,
                officialTopicId: topicId,
                topicCode: code,
                officialTopicName: name
              };
            });
            
            let finalBlocks = tryMergeShortBlocks(rescueBlocks);
            finalBlocks = calculateEstimatedMinutes(finalBlocks);

            return {
              materialRole: role === "SUPPORT_MATERIAL" ? "SUPPORT_MATERIAL" : "MIXED_MATERIAL",
              sourceStrategy: "TOC_BASED",
              tocDetected: true,
              tocConfidence: 1.0,
              blocks: finalBlocks,
              aiModelUsed: `${modelName}-TOCRescue`
            };
          }

          if (errors.length === 0) {
            // Mapear tópicos oficiais com segurança
            const mappedBlocks = validatedBlocks.map(b => {
              let topicId = b.officialTopicId || null;
              let code = b.topicCode || "GERAL";
              let name = b.officialTopicName || "Tópico não identificado";

              if (topicId) {
                const found = OFFICIAL_TOPICS.find(t => t.id === topicId);
                if (found) {
                  code = found.topicCode;
                  name = found.title;
                } else {
                  topicId = null;
                  code = "GERAL";
                  name = "Tópico não identificado";
                }
              }

              return {
                ...b,
                officialTopicId: topicId,
                topicCode: code,
                officialTopicName: name
              };
            });
            
            let finalBlocks = tryMergeShortBlocks(mappedBlocks);
            finalBlocks = calculateEstimatedMinutes(finalBlocks);

            if (modelName !== GEMINI_MODEL_CANDIDATES[0]) {
              console.log(`🤖 [AI Fallback] Modelo principal falhou no mapeamento de estrutura. Fallback usado com sucesso: ${modelName}.`);
            }

            return {
              materialRole: role,
              sourceStrategy: parsedResult.sourceStrategy || sourceStrategy,
              tocDetected: parsedResult.tocDetected !== undefined ? parsedResult.tocDetected : tocDetected,
              tocConfidence: parsedResult.tocConfidence !== undefined ? parsedResult.tocConfidence : tocConfidence,
              blocks: finalBlocks,
              aiModelUsed: modelName
            };
          }

          accumulatedErrors = errors;
          attempts++;
          console.warn(`[AI] Tentativa ${attempts} falhou nos critérios de qualidade: ${errors.join(" ")}`);
          currentPrompt = initialPrompt + `\n\nREJEITADO: A divisão anterior foi rejeitada pelos seguintes erros de qualidade: ${errors.join(" ")}\nPOR FAVOR, refaça o mapeamento de blocos respeitando rigorosamente a explicação teórica principal. Evite títulos genéricos como 'Parte X'.`;
          
        } catch (error: any) {
          console.error("Erro ao detectar estrutura:", error);
          
          // Se a API falhou/timeout ou deu erro de JSON, mas temos sumário confiável, resgatar deterministicamente!
          if (tocDetected && tocConfidence >= 0.65 && hasMainTheory) {
            console.log(`[TOC Rescue Catch] Erro na requisição da IA, mas sumário confiável detectado. Resgatando deterministicamente via sumário...`);
            let rescueBlocks = buildBlocksFromTOC(tocEntries, subjectName, relevantTopics, totalPages);
            rescueBlocks = repairMicroTheoryBlocks(rescueBlocks, totalPages);
            
            rescueBlocks = rescueBlocks.map(b => {
              const topicId = b.officialTopicId || null;
              let code = b.topicCode || "GERAL";
              let name = b.officialTopicName || "Tópico não identificado";

              if (topicId) {
                const found = relevantTopics.find(t => t.id === topicId);
                if (found) {
                  code = found.topicCode;
                  name = found.title;
                }
              }
              return {
                ...b,
                officialTopicId: topicId,
                topicCode: code,
                officialTopicName: name
              };
            });
            
            let finalBlocks = tryMergeShortBlocks(rescueBlocks);
            finalBlocks = calculateEstimatedMinutes(finalBlocks);

            return {
              materialRole: "MIXED_MATERIAL",
              sourceStrategy: "TOC_BASED",
              tocDetected: true,
              tocConfidence: 1.0,
              blocks: finalBlocks,
              aiModelUsed: `${modelName}-TOCRescueCatch`
            };
          }

          if (error.status === 503 || error.message?.includes("503") || error.status === 429 || error.message?.includes("429")) {
            geminiApiError = `AI_RATE_LIMIT_OR_UNAVAILABLE: ${error.message}`;
          } else if (error.message?.includes("fetch failed") || error.message?.includes("Service Unavailable")) {
            geminiApiError = `AI_TIMEOUT_OR_NETWORK: ${error.message}`;
          } else {
            geminiApiError = error.message;
          }
          attempts++;
        }
      }

      if (accumulatedErrors.length > 0) {
        const isNoTheory = accumulatedErrors.some(e => e.includes("NO_MAIN_THEORY_FOUND") || e.includes("Nenhum bloco principal de teoria") || e.includes("não foi gerado"));
        const isTocMapping = accumulatedErrors.some(e => e.includes("TOC_MAPPING_FAILED"));
        if (isNoTheory) {
          throw new Error(`NO_MAIN_THEORY_FOUND: ${accumulatedErrors.join(" | ")}`);
        }
        if (isTocMapping) {
          throw new Error(`TOC_MAPPING_FAILED: ${accumulatedErrors.join(" | ")}`);
        }
        throw new Error(`VALIDATION_FAILED: ${accumulatedErrors.join(" | ")}`);
      }
      if (jsonParseError) {
        throw new Error(`AI_INVALID_JSON: ${jsonParseError}`);
      }
      if (geminiApiError) {
        throw new Error(`AI_UNAVAILABLE: ${geminiApiError}`);
      }

      throw new Error("STRUCTURE_MAPPING_FAILED: Não foi possível mapear a estrutura pedagógica de blocos temáticos reais de forma segura.");

    } catch (error: any) {
      console.warn(`[AI Structure Fallback] Modelo ${modelName} falhou: ${error.message}`);
      lastError = error;

      const isRecoverable = isRecoverableGeminiError(error);
      if (!isRecoverable) {
        throw error;
      }
    }
  }

  throw new Error(`AI_UNAVAILABLE: Todos os modelos do Gemini falharam temporariamente com erros de indisponibilidade. Último erro: ${lastError?.message}`);
}

function tryMergeShortBlocks(blocks: DetectedBlock[]): DetectedBlock[] {
  if (blocks.length === 0) return blocks;
  const merged: DetectedBlock[] = [];
  let current = { ...blocks[0] };

  for (let i = 1; i < blocks.length; i++) {
    const next = blocks[i];
    const currentPages = (current.pageEnd - current.pageStart) + 1;
    const nextPages = (next.pageEnd - next.pageStart) + 1;
    const combinedPages = currentPages + nextPages;
    
    const isCurrentShort = currentPages < 4 && !current.shortBlockJustification;
    const isNextShort = nextPages < 4 && !next.shortBlockJustification;
    
    const sameTopic = current.officialTopicId === next.officialTopicId;
    const contiguous = (next.pageStart <= current.pageEnd + 2);
    const sameType = (current.type || "MAIN_BLOCK") === (next.type || "MAIN_BLOCK");
    const isMainBlock = (current.type || "MAIN_BLOCK") === "MAIN_BLOCK";

    if (isMainBlock && sameTopic && contiguous && sameType && combinedPages <= 18 && (isCurrentShort || isNextShort || currentPages < 5)) {
      current.pageEnd = Math.max(current.pageEnd, next.pageEnd);
      current.title = `${current.title} + ${next.title}`.substring(0, 100);
      current.description = `${current.description} | ${next.description}`.substring(0, 200);
      current.mergeRationale = "Backend auto-merged consecutive short blocks of the same topic to reach 45 min target.";
      current.isShortBlock = (current.pageEnd - current.pageStart) + 1 < 4;
      if (!current.isShortBlock) current.shortBlockJustification = null;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
}

function calculateEstimatedMinutes(blocks: DetectedBlock[]): DetectedBlock[] {
  return blocks.map(b => {
    if (b.type === "SUPPORT_BLOCK") return { ...b, estimatedStudyMinutes: 0 };
    
    const pageCount = (b.pageEnd - b.pageStart) + 1;
    let minutesPerPage = 5;

    switch (b.contentDensity) {
      case "LOW": minutesPerPage = 3; break;
      case "MEDIUM": minutesPerPage = 5; break;
      case "HIGH": minutesPerPage = 8; break;
      case "VERY_HIGH": minutesPerPage = 10; break;
    }

    let calcMinutes = pageCount * minutesPerPage;
    calcMinutes = Math.max(30, Math.min(60, calcMinutes));

    return {
      ...b,
      estimatedStudyMinutes: calcMinutes
    };
  });
}

export function isTOCPage(text: string): boolean {
  const norm = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Se a página contém "sumário" ou "índice" e múltiplos padrões de pontos, é uma página de sumário
  const hasKeywords = norm.includes("sumario") || norm.includes("indice") || norm.includes("conteudo");
  const dotsMatch = norm.match(/\.{3,}/g) || [];
  
  // Contar linhas que parecem entradas de sumário com página
  const lines = text.split('\n');
  let matchCount = 0;
  for (const line of lines) {
    if (parseTOCLine(line, 1000) !== null) {
      matchCount++;
    }
  }

  return (hasKeywords && dotsMatch.length >= 3) || matchCount >= 4;
}

export function detectQuestionsOrGabaritoHeuristic(
  text: string,
  options?: { heading?: string; isTOCContext?: boolean }
): { isQuestions: boolean; isAnswerKey: boolean; confidence: number } {
  const isTOCContext = options?.isTOCContext || isTOCPage(text);
  const heading = options?.heading || "";

  if (isTOCContext) {
    return { isQuestions: false, isAnswerKey: false, confidence: 0.0 };
  }

  const textLower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const headingLower = heading.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const headingStrongQuestions =
    /quest(oes|oes)|lista de quest|exerc[ií]cio|simulado|exercicios/i.test(headingLower);

  const headingStrongGabarito =
    /gabarito|respostas|resposta correta/i.test(headingLower);

  const examCommand =
    /assinale\s+(a\s+)?(alternativa|opcao)|julgue\s+(o\s+)?(item|itens)|certo\s+ou\s+errado|e\s+correto\s+afirmar|esta\s+correto\s+o\s+que\s+se\s+afirma|considerando|com\s+base|tendo\s+em\s+vista/i.test(textLower);

  // Alternatives A-E structure: count lines that match A), B), C)... or a), b), c)... or A -, B -...
  const alternativeRegex = /^\s*([a-eA-E]|\d+\.[a-eA-E])\s*[\).\-]\s/gm;
  const altMatches = text.match(alternativeRegex) || [];
  const hasAlternatives = altMatches.length >= 3;

  const questionPrefixRegex = /\b(questao\s*\d+|q\.\s*\d+)\b/gi;
  const questionPrefixMatches = textLower.match(questionPrefixRegex) || [];

  const examKeywords = ["fcc", "fgv", "cespe", "cebraspe", "vunesp", "trt", "concurso", "esaf", "fadesp", "consulplan"];
  let examKeywordCount = 0;
  examKeywords.forEach(ek => {
    const regex = new RegExp("\\b" + ek + "\\b", "g");
    const m = textLower.match(regex);
    if (m) examKeywordCount += m.length;
  });

  const commentsKeywords = ["comentarios:", "comentario:", "resolucao:", "comentario da questao", "comentarios da questao"];
  let commentCount = 0;
  commentsKeywords.forEach(kw => {
    const regex = new RegExp("\\b" + kw + "\\b", "g");
    const m = textLower.match(regex);
    if (m) commentCount += m.length;
  });

  const answerKeyKeywords = ["gabarito", "resposta correta", "alternativa correta", "gabarito oficial"];
  let answerKeyCount = 0;
  answerKeyKeywords.forEach(kw => {
    const regex = new RegExp("\\b" + kw + "\\b", "g");
    const m = textLower.match(regex);
    if (m) answerKeyCount += m.length;
  });

  // Ordinal lists detect: e.g. 1. 2. 3. 4.1 4.2
  // If it only has sequential numbering but no alternative options or question commands, it's NOT a question
  const hasOrdinalList = /^\s*\d+(\.\d+)*\s*[\).\-]\s/gm.test(text);

  const ordinalOnly =
    hasOrdinalList && 
    !headingStrongQuestions && 
    !headingStrongGabarito && 
    !examCommand && 
    !hasAlternatives && 
    questionPrefixMatches.length === 0 &&
    commentCount === 0 &&
    answerKeyCount === 0;

  if (ordinalOnly) {
    return { isQuestions: false, isAnswerKey: false, confidence: 0.0 };
  }

  // Determine if it's answer key
  const isAnswerKey =
    headingStrongGabarito ||
    (answerKeyCount >= 2 && (answerKeyCount > commentCount || !hasAlternatives)) ||
    (answerKeyCount >= 1 && /^\s*0?1\s*[-–.]\s*[a-e]\b/gmi.test(textLower)); // Patterns like "01 - A", "02 - B"

  // Determine if it's questions (either commented or standard)
  const isQuestions = !isAnswerKey && (
    headingStrongQuestions ||
    (examCommand && hasAlternatives) ||
    (questionPrefixMatches.length >= 2) ||
    (examKeywordCount >= 1 && hasAlternatives) ||
    (commentCount >= 1 && questionPrefixMatches.length >= 1)
  );

  let confidence = 0.0;
  if (isQuestions || isAnswerKey) {
    confidence = Math.min(1.0, ((altMatches.length * 0.1) + (questionPrefixMatches.length * 0.3) + (commentCount * 0.3) + (answerKeyCount * 0.2)) / 2);
    if (headingStrongQuestions || headingStrongGabarito) {
      confidence = Math.max(confidence, 0.9);
    }
  }

  return {
    isQuestions,
    isAnswerKey,
    confidence: confidence > 0.25 ? confidence : 0.0
  };
}

export function detectMechanicalCuttingHeuristic(blocks: DetectedBlock[]): boolean {
  const mainBlocks = blocks.filter(b => !b.type || b.type === "MAIN_BLOCK");
  if (mainBlocks.length < 3) return false;

  const sizes = mainBlocks.map(b => (b.pageEnd - b.pageStart) + 1);
  
  const frequencies: Record<number, number> = {};
  sizes.forEach(s => {
    frequencies[s] = (frequencies[s] || 0) + 1;
  });

  let maxFreq = 0;
  let mostCommonSize = 0;
  for (const [sizeStr, freq] of Object.entries(frequencies)) {
    if (freq > maxFreq) {
      maxFreq = freq;
      mostCommonSize = Number(sizeStr);
    }
  }

  const ratio = maxFreq / mainBlocks.length;
  if (ratio >= 0.75 && mostCommonSize >= 5) {
    let isSuspiciouslySequential = true;
    for (let i = 0; i < mainBlocks.length - 1; i++) {
      if (mainBlocks[i + 1].pageStart !== mainBlocks[i].pageEnd + 1) {
        isSuspiciouslySequential = false;
        break;
      }
    }
    if (isSuspiciouslySequential) {
      console.warn(`[AI Validation] Fatiamento mecânico detectado! Tamanho mais comum: ${mostCommonSize} páginas (${maxFreq}/${mainBlocks.length} blocos).`);
      return true;
    }
  }

  return false;
}
