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
  process.env.GEMINI_MODEL_FALLBACK_2 || "gemini-2.0-flash",
  process.env.GEMINI_MODEL_FALLBACK_3 || "gemini-2.0-flash-lite",
  process.env.GEMINI_MODEL_FALLBACK_4 || "gemini-2.5-pro",
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
}

export interface DetectedStructureResult {
  materialRole: string; // MAIN_MATERIAL | SUPPORT_MATERIAL | MIXED_MATERIAL | UNKNOWN
  blocks: DetectedBlock[];
  aiModelUsed?: string; // Armazenar qual modelo final gerou com sucesso
}

const FORBIDDEN_GENERIC_PATTERNS = [
  /^parte\s+\d+/i,
  /^conteúdo\s+\d+/i,
  /^conteudo\s+\d+/i,
  /^bloco\s+\d+$/i
];

const GENERIC_TITLES = [
  "TODO CONTEUDO", "TODO O CONTEUDO", "CONTEUDO COMPLETO", "CONTEUDO COMPLETO", 
  "MATERIAL COMPLETO", "MATERIAL GERAL", "RESUMO GERAL", "CONTEUDO GERAL",
  "CONTEUDO GERAL", "CONTEUDO DA MATERIA", "CONTEUDO DA MATERIA",
  "APOSTILA COMPLETA", "PDF COMPLETO", "PARTE 1 DO CONTEUDO",
  "PARTE 2 DO CONTEUDO", "PARTE 3 DO CONTEUDO", "PARTE DO CONTEUDO",
  "PARTE DO CONTEUDO", "MATERIAL INTEGRA", "TODO O PDF",
  "CONTEUDO INTEGRAL", "VISAO GERAL", "ESTUDO COMPLETO", "APOSTILA", "PDF", 
  "CONTEUDO", "SUMARIO", "CAPITULO", "INTRODUCAO"
];

export async function detectStructure(
  summaryContent: string,
  totalPages: number,
  subjectName: string,
  pageTexts?: { pageNumber: number; text: string }[]
): Promise<DetectedStructureResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");

  const genAI = new GoogleGenerativeAI(apiKey);

  // 1. Filtrar os tópicos oficiais relevantes para esta matéria
  const relevantTopics = OFFICIAL_TOPICS.filter(
    t => t.subjectName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
         subjectName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );

  const officialTopicsListText = relevantTopics.length > 0
    ? relevantTopics.map(t => `- ID: "${t.id}" | Código: "${t.topicCode}" | Título: "${t.title}"`).join("\n")
    : "Esta matéria não possui matriz de tópicos cadastrada. Use officialTopicId = null, topicCode = \"GERAL\", officialTopicName = \"Tópico não identificado\".";

  const initialPrompt = buildStructurePrompt(summaryContent, subjectName, officialTopicsListText) +
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
          const blocks = parsedResult.blocks || [];

          // --- Validação Técnica & Pedagógica ---
          const errors: string[] = [];

          // 1. Títulos genéricos
          const hasGenericTitle = blocks.some(b => {
            const titleNorm = b.title.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const isForbiddenLiteral = GENERIC_TITLES.some(gt => titleNorm === gt || titleNorm.includes(gt));
            const isForbiddenPattern = FORBIDDEN_GENERIC_PATTERNS.some(re => re.test(b.title));
            return isForbiddenLiteral || isForbiddenPattern;
          });
          if (hasGenericTitle) {
            errors.push("Contém títulos genéricos proibidos (Parte X, Conteúdo Completo, Bloco 1, etc). Por favor, crie títulos altamente específicos e temáticos.");
          }

          // 2. Bloco único para material longo
          if (blocks.length === 1 && totalPages > 5) {
            errors.push("Criou apenas um bloco único para um material longo. Divida-o por assuntos específicos.");
          }

          // 3. Quantidade mínima de blocos
          let minBlocks = 1;
          if (totalPages > 50) minBlocks = 4;
          else if (totalPages > 20) minBlocks = 3;
          else if (totalPages > 5) minBlocks = 2;

          if (blocks.length < minBlocks && totalPages > 5) {
            errors.push(`Quantidade insuficiente de blocos (encontrado ${blocks.length}, esperado no mínimo ${minBlocks}).`);
          }

          // 4. Validação de Páginas de Resumo/Bizus vs Explicação Principal & Detecção de Questões/Gabaritos
          if (pageTexts && pageTexts.length > 0) {
            for (const b of blocks) {
              const blockPages = pageTexts.filter(p => p.pageNumber >= b.pageStart && p.pageNumber <= b.pageEnd);
              const fullBlockText = blockPages.map(p => p.text).join("\n");
              const normalizedBlockText = fullBlockText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

              if (normalizedBlockText.trim().length > 0) {
                // Executar heurística programática de Questões/Gabaritos
                const qgResult = detectQuestionsOrGabaritoHeuristic(fullBlockText);
                if (qgResult.isQuestions || qgResult.isAnswerKey) {
                  console.log(`[Heuristic Match] Bloco "${b.title}" (p.${b.pageStart}-${b.pageEnd}) detectado como Questões/Gabarito pelo backend. Convertendo para Apoio.`);
                  b.type = "SUPPORT_BLOCK";
                  b.supportType = qgResult.isQuestions ? "QUESTIONS" : "ANSWER_KEY";
                  b.estimatedStudyMinutes = 0;
                  b.description = b.description || `Banco de questões/gabarito de apoio para o assunto.`;
                  continue;
                }

                // Contagem de palavras-chave negativas (resumos/bizus/questões)
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

                // Contagem de palavras-chave positivas (desenvolvimento teórico completo)
                const positiveKeywords = [
                  "conceito", "definicao", "definicao", "exemplo", "classificacao", "classificacao",
                  "regra", "excecao", "excecao", "jurisprudencia", "jurisprudencia", "artigo",
                  "fundamento", "aplicacao", "aplicacao", "doutrina", "entendimento", "explicacao", "explicacao"
                ];
                let positiveScore = 0;
                positiveKeywords.forEach(kw => {
                  const regex = new RegExp(kw, "g");
                  const matches = normalizedBlockText.match(regex);
                  if (matches) positiveScore += matches.length;
                });

                console.log(`[AI Validation] Bloco "${b.title}" (Páginas ${b.pageStart}-${b.pageEnd}): negativeScore=${negativeScore}, positiveScore=${positiveScore}`);

                // Critério de Rejeição: Mais de 80% do texto do bloco consiste em termos resumitivos E há baixíssima densidade teórica explicativa
                // Apenas para MAIN_BLOCK (blocos teóricos)
                const isResumoOnly = negativeScore > 6 && positiveScore <= 2;
                if (isResumoOnly && (!b.type || b.type === "MAIN_BLOCK")) {
                  console.warn(`[AI Validation] Bloco "${b.title}" (Páginas ${b.pageStart}-${b.pageEnd}) REJEITADO por parecer resumo/bizu/questões (negativo=${negativeScore}, positivo=${positiveScore})`);
                  errors.push(`A seleção de páginas ${b.pageStart}-${b.pageEnd} para o bloco principal "${b.title}" foi rejeitada porque parece conter apenas resumo, bizu, simulado ou revisão rápida. É obrigatório incluir as páginas de desenvolvimento conceitual e explicação teórica em blocos MAIN_BLOCK.`);
                  break;
                }
              }
            }
          }

          // 5. Validação de Fatiamento Mecânico por número fixo de páginas
          if (errors.length === 0) {
            const hasMechanicalCutting = detectMechanicalCuttingHeuristic(blocks);
            if (hasMechanicalCutting) {
              console.warn("[AI Validation] Rejeitando divisão por fatiamento mecânico de páginas detectado pelo backend.");
              errors.push("A divisão anterior parece ter sido feita por cortes fixos de páginas (ex: de 10 em 10 páginas), e não por unidade temática. Refaça a divisão respeitando a estrutura real do conteúdo (títulos, subtítulos), os tópicos oficiais, a continuidade do assunto e o desenvolvimento teórico principal. Não divida o PDF de forma regular/mecânica.");
            }
          }

          if (errors.length === 0) {
            // Validação de blocos muito curtos sem justificativa
            const hasUnjustifiedShortBlock = blocks.some(b => {
              const pageCount = (b.pageEnd - b.pageStart) + 1;
              return pageCount < 4 && !b.shortBlockJustification && (!b.type || b.type === "MAIN_BLOCK");
            });
            
            if (hasUnjustifiedShortBlock) {
              errors.push("Existem blocos muito curtos (1 a 3 páginas) sem justificativa ('shortBlockJustification'). Agrupe esses subtópicos menores em blocos maiores de 5 a 12 páginas, mantendo a coerência temática.");
            }
          }

          if (errors.length === 0) {
            // Mapear tópicos oficiais com segurança (limpar correspondências vazias ou inválidas se houver)
            const mappedBlocks = blocks.map(b => {
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

            // Log de sucesso de fallback se não for o primeiro da lista
            if (modelName !== GEMINI_MODEL_CANDIDATES[0]) {
              console.log(`🤖 [AI Fallback] Modelo principal falhou na mapeamento de estrutura. Fallback usado com sucesso: ${modelName}.`);
            }

            return {
              materialRole: role,
              blocks: finalBlocks,
              aiModelUsed: modelName // Salva qual modelo foi usado nos metadados!
            };
          }

          accumulatedErrors = errors;
          attempts++;
          console.warn(`[AI] Tentativa ${attempts} falhou nos critérios de qualidade: ${errors.join(" ")}`);
          currentPrompt = initialPrompt + `\n\nREJEITADO: A divisão anterior foi rejeitada pelos seguintes erros de qualidade: ${errors.join(" ")}\nPOR FAVOR, refaça o mapeamento de blocos respeitando rigorosamente a explicação teórica principal. Evite títulos genéricos como 'Parte X'.`;
          
        } catch (error: any) {
          console.error("Erro ao detectar estrutura:", error);
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

      // Se falhou por qualidade dos blocos (VALIDATION_REJECTED_ALL_BLOCKS), não faz fallback automático
      if (accumulatedErrors.length > 0) {
        throw new Error(`VALIDATION_REJECTED_ALL_BLOCKS: ${accumulatedErrors.join(" | ")}`);
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

      // Critério 14: Só fazer fallback de modelo para erros recuperáveis de infraestrutura (503, 429, timeout)
      const isRecoverable = isRecoverableGeminiError(error);
      if (!isRecoverable) {
        // Erro permanente (como validação falhar ou JSON inválido recorrente) -> lança imediatamente
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
    const contiguous = (next.pageStart <= current.pageEnd + 2); // Pode ter uma página vazia no meio
    const sameType = (current.type || "MAIN_BLOCK") === (next.type || "MAIN_BLOCK");
    const isMainBlock = (current.type || "MAIN_BLOCK") === "MAIN_BLOCK";

    // Tentamos mesclar se forem blocos principais, mesmo tópico, contíguos e o tamanho final <= 15
    // Condição forte: se um dos dois for pequeno (< 4 páginas), forçamos o merge para evitar quebra excessiva
    if (isMainBlock && sameTopic && contiguous && sameType && combinedPages <= 15 && (isCurrentShort || isNextShort || currentPages < 5)) {
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
    let minutesPerPage = 5; // MEDIUM default

    switch (b.contentDensity) {
      case "LOW": minutesPerPage = 3; break;
      case "MEDIUM": minutesPerPage = 5; break;
      case "HIGH": minutesPerPage = 8; break;
      case "VERY_HIGH": minutesPerPage = 10; break;
    }

    let calcMinutes = pageCount * minutesPerPage;
    // Tenta aproximar a sessão ao range 30-60 (idealmente 45)
    calcMinutes = Math.max(30, Math.min(60, calcMinutes));

    return {
      ...b,
      estimatedStudyMinutes: calcMinutes
    };
  });
}

export function detectQuestionsOrGabaritoHeuristic(text: string): { isQuestions: boolean; isAnswerKey: boolean; confidence: number } {
  const textLower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Contagem de alternativas (ex: A), B), C), D), E))
  const alternativeRegex = /\b[a-e]\s*[\).\-]\s*/gi;
  const altMatches = textLower.match(alternativeRegex) || [];
  
  // Contagem de questões numeradas (ex: 1., 2), 3 -)
  const questionNumRegex = /\b\d+\s*[\).\-]\s+/gi;
  const numMatches = textLower.match(questionNumRegex) || [];

  // Contagem de palavras-chave de questões
  const questionKeywords = ["questao", "questoes", "exercicio", "exercicios", "simulado", "prova", "assinale", "julgue", "certo ou errado", "alternativa"];
  let questionKeywordCount = 0;
  questionKeywords.forEach(kw => {
    const regex = new RegExp(kw, "g");
    const m = textLower.match(regex);
    if (m) questionKeywordCount += m.length;
  });

  // Contagem de palavras-chave de gabaritos
  const answerKeyKeywords = ["gabarito", "gabaritos", "resposta correta", "letra a", "letra b", "letra c", "letra d", "letra e", "alternativa correta"];
  let answerKeyKeywordCount = 0;
  answerKeyKeywords.forEach(kw => {
    const regex = new RegExp(kw, "g");
    const m = textLower.match(regex);
    if (m) answerKeyKeywordCount += m.length;
  });

  // Heurística de decisão baseada em densidade relativa
  const hasManyAlternatives = altMatches.length >= 5;
  const hasManyQuestionNumbers = numMatches.length >= 3;
  const hasManyQuestionKeywords = questionKeywordCount >= 4;
  const hasManyAnswerKeyKeywords = answerKeyKeywordCount >= 3;

  const isAnswerKey = hasManyAnswerKeyKeywords && (answerKeyKeywordCount > questionKeywordCount || altMatches.length < 3);
  const isQuestions = (hasManyAlternatives || hasManyQuestionNumbers || hasManyQuestionKeywords) && !isAnswerKey;

  const confidence = Math.min(
    1.0,
    ((altMatches.length * 0.1) + (numMatches.length * 0.15) + (questionKeywordCount * 0.1) + (answerKeyKeywordCount * 0.1)) / 2
  );

  return {
    isQuestions,
    isAnswerKey,
    confidence: confidence > 0.3 ? confidence : 0.0
  };
}

export function detectMechanicalCuttingHeuristic(blocks: DetectedBlock[]): boolean {
  const mainBlocks = blocks.filter(b => !b.type || b.type === "MAIN_BLOCK");
  if (mainBlocks.length < 3) return false;

  const sizes = mainBlocks.map(b => (b.pageEnd - b.pageStart) + 1);
  
  // Contar frequências dos tamanhos
  const frequencies: Record<number, number> = {};
  sizes.forEach(s => {
    frequencies[s] = (frequencies[s] || 0) + 1;
  });

  // Encontrar a maior frequência
  let maxFreq = 0;
  let mostCommonSize = 0;
  for (const [sizeStr, freq] of Object.entries(frequencies)) {
    if (freq > maxFreq) {
      maxFreq = freq;
      mostCommonSize = Number(sizeStr);
    }
  }

  // Se mais de 75% dos blocos têm exatamente o mesmo tamanho (ex: 10 em 10 páginas)
  const ratio = maxFreq / mainBlocks.length;
  if (ratio >= 0.75 && mostCommonSize >= 5) {
    // Também checar se o primeiro bloco começa exatamente no 1 ou 2, e os outros são contíguos perfeitos (ex: 1-10, 11-20, 21-30)
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
