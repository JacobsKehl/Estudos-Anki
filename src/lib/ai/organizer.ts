import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildSubjectPrompt, buildStructurePrompt } from "./prompts/organizer";
import { OFFICIAL_TOPICS } from "../constants/official-topics";

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

export async function identifySubject(firstPagesContent: string, fileName?: string): Promise<SubjectIdentification> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = buildSubjectPrompt(firstPagesContent, fileName);

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const startIndex = responseText.indexOf("{");
    const endIndex = responseText.lastIndexOf("}");
    if (startIndex === -1) throw new Error("JSON de matéria não encontrado");
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

    return {
      ...parsed,
      subjectName: normalizedName
    };
  } catch (error) {
    console.error("Erro ao identificar matéria:", error);
    return {
      subjectName: "Outros",
      confidence: 0,
      reason: "Erro técnico na identificação"
    };
  }
}

export interface DetectedBlock {
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
): Promise<DetectedBlock[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

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
  
  let attempts = 0;
  let currentPrompt = initialPrompt;
  let lastResponse = "";

  while (attempts < 2) {
    try {
      const result = await model.generateContent(currentPrompt);
      const response = await result.response;
      lastResponse = response.text();
      
      const startIndex = lastResponse.indexOf("[");
      const endIndex = lastResponse.lastIndexOf("]");
      if (startIndex === -1) throw new Error("JSON não encontrado");
      
      const cleanJson = lastResponse.substring(startIndex, endIndex + 1);
      const blocks: DetectedBlock[] = JSON.parse(cleanJson);

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
      if (totalPages > 50) minBlocks = 8;
      else if (totalPages > 20) minBlocks = 5;
      else if (totalPages > 5) minBlocks = 3;

      if (blocks.length < minBlocks && totalPages > 5) {
        errors.push(`Quantidade insuficiente de blocos (encontrado ${blocks.length}, esperado no mínimo ${minBlocks}).`);
      }

      // 4. Validação de Páginas de Resumo/Bizus vs Explicação Principal
      if (pageTexts && pageTexts.length > 0) {
        for (const b of blocks) {
          const blockPages = pageTexts.filter(p => p.pageNumber >= b.pageStart && p.pageNumber <= b.pageEnd);
          const fullBlockText = blockPages.map(p => p.text).join("\n").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

          if (fullBlockText.trim().length > 0) {
            // Contagem de palavras-chave negativas (resumos/bizus/questões)
            const negativeKeywords = [
              "resumo", "bizu", "mapa mental", "mapas mentais", "gabarito", "questoes", "questões",
              "simulado", "revisao de vespera", "revisão de véspera", "revisao rapida", "revisão rápida",
              "esquematico", "esquemático", "checklist"
            ];
            let negativeScore = 0;
            negativeKeywords.forEach(kw => {
              const regex = new RegExp(kw, "g");
              const matches = fullBlockText.match(regex);
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
              const matches = fullBlockText.match(regex);
              if (matches) positiveScore += matches.length;
            });

            console.log(`[AI Validation] Bloco "${b.title}" (Páginas ${b.pageStart}-${b.pageEnd}): negativeScore=${negativeScore}, positiveScore=${positiveScore}`);

            // Critério de Rejeição: Mais de 80% do texto do bloco consiste em termos resumitivos E há baixíssima densidade teórica explicativa
            const isResumoOnly = negativeScore > 6 && positiveScore <= 2;
            if (isResumoOnly) {
              console.warn(`[AI Validation] Bloco "${b.title}" (Páginas ${b.pageStart}-${b.pageEnd}) REJEITADO por parecer resumo/bizu/questões (negativo=${negativeScore}, positivo=${positiveScore})`);
              errors.push(`A seleção de páginas ${b.pageStart}-${b.pageEnd} para o bloco "${b.title}" foi rejeitada porque parece conter apenas resumo, bizu, simulado ou revisão rápida. É obrigatório incluir as páginas de desenvolvimento conceitual e explicação teórica.`);
              break;
            }
          }
        }
      }

      if (errors.length === 0) {
        // Mapear tópicos oficiais com segurança (limpar correspondências vazias ou inválidas se houver)
        return blocks.map(b => {
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
      }

      // Se falhou na validação, tenta de novo com prompt de correção
      attempts++;
      console.warn(`[AI] Tentativa ${attempts} falhou nos critérios de qualidade: ${errors.join(" ")}`);
      currentPrompt = initialPrompt + `\n\nREJEITADO: A divisão anterior foi rejeitada pelos seguintes erros de qualidade: ${errors.join(" ")}\nPOR FAVOR, refaça o mapeamento de blocos respeitando rigorosamente a explicação teórica principal. Evite títulos genéricos como 'Parte X'.`;
      
    } catch (error) {
      console.error("Erro ao detectar estrutura:", error);
      attempts++;
    }
  }

  // --- Fallback Seguro se falhou após retries ---
  console.warn(`[AI] Usando fallback temático mapeado para ${totalPages} páginas.`);
  const fallbackBlocks: DetectedBlock[] = [];
  const pageSize = totalPages > 50 ? 10 : 6;
  const numBlocks = Math.ceil(totalPages / pageSize);

  for (let i = 0; i < numBlocks; i++) {
    const start = i * pageSize + 1;
    const end = Math.min((i + 1) * pageSize, totalPages);
    
    let fallbackTitle = `Fundamentos e Conceitos de ${subjectName} (Bloco ${i + 1})`;
    let topicId: string | null = null;
    let code = "GERAL";
    let name = "Tópico não identificado";

    // Associa inteligentemente a um tópico oficial se houver na lista
    if (relevantTopics.length > 0) {
      const targetTopic = relevantTopics[Math.min(i, relevantTopics.length - 1)];
      fallbackTitle = `${targetTopic.title} — Visão Teórica`;
      topicId = targetTopic.id;
      code = targetTopic.topicCode;
      name = targetTopic.title;
    }

    fallbackBlocks.push({
      title: fallbackTitle,
      description: `Estudo focado de tópicos centrais da disciplina ${subjectName}.`,
      pageStart: start,
      pageEnd: end,
      sourceHeading: "Divisão Estruturada",
      estimatedStudyMinutes: (end - start + 1) * 3,
      confidence: 0.5,
      createdBy: "AI_FALLBACK",
      officialTopicId: topicId,
      topicCode: code,
      officialTopicName: name
    });
  }

  return fallbackBlocks;
}
