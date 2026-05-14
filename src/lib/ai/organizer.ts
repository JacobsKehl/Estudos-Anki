import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildSubjectPrompt, buildStructurePrompt } from "./prompts/organizer";

export interface SubjectIdentification {
  subjectName: string;
  confidence: number;
  reason: string;
}

const KNOWN_SUBJECTS_MAP: Record<string, string> = {
  "CONSTITUCIONAL": "Direito Constitucional",
  "ADMINISTRATIVO": "Direito Administrativo",
  "PORTUGUES": "Português",
  "LINGUA PORTUGUESA": "Português",
  "RLM": "Matemática e Raciocínio Lógico",
  "RACIOCINIO LOGICO": "Matemática e Raciocínio Lógico",
  "CIVIL": "Direito Civil",
  "PROCESSO CIVIL": "Direito Processual Civil",
  "PROCESSUAL CIVIL": "Direito Processual Civil",
  "TRABALHO": "Direito do Trabalho",
  "PROCESSO DO TRABALHO": "Direito Processual do Trabalho",
  "PROCESSUAL DO TRABALHO": "Direito Processual do Trabalho",
  "PREVIDENCIARIO": "Direito Previdenciário",
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
    const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
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
}

const GENERIC_TITLES = [
  "TODO CONTEUDO", "CONTEUDO COMPLETO", "MATERIAL COMPLETO", "RESUMO GERAL", 
  "MATERIAL INTEIRO", "MATERIAL GERAL", "PDF COMPLETO", "APOSTILA COMPLETA",
  "TODOS OS TOPICOS", "CONTEUDO DA MATERIA", "MATERIAL INTEGRA", "TODO O PDF",
  "CONTEUDO INTEGRAL", "VISAO GERAL", "ESTUDO COMPLETO", "APOSTILA", "PDF", 
  "CONTEUDO", "SUMARIO", "CAPITULO", "INTRODUCAO"
];

export async function detectStructure(summaryContent: string, totalPages: number): Promise<DetectedBlock[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const initialPrompt = buildStructurePrompt(summaryContent) + `\n\nTotal de páginas do PDF: ${totalPages}`;
  
  let attempts = 0;
  let currentPrompt = initialPrompt;
  let lastResponse = "";

  while (attempts < 2) {
    try {
      const result = await model.generateContent(currentPrompt);
      const response = await result.response;
      lastResponse = response.text();
      
      const cleanJson = lastResponse.replace(/```json/g, "").replace(/```/g, "").trim();
      const blocks: DetectedBlock[] = JSON.parse(cleanJson);

      // --- Validação ---
      const errors: string[] = [];

      // 1. Títulos genéricos
      const hasGenericTitle = blocks.some(b => 
        GENERIC_TITLES.some(gt => b.title.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(gt))
      );
      if (hasGenericTitle) errors.push("Contém títulos genéricos proibidos.");

      // 2. Bloco único para material longo
      if (blocks.length === 1 && totalPages > 5) {
        errors.push("Criou apenas um bloco para um material com mais de 5 páginas.");
      }

      // 3. Quantidade mínima de blocos
      let minBlocks = 1;
      if (totalPages > 50) minBlocks = 8;
      else if (totalPages > 20) minBlocks = 5;
      else if (totalPages > 5) minBlocks = 3;

      if (blocks.length < minBlocks && totalPages > 5) {
        errors.push(`Quantidade insuficiente de blocos (encontrado ${blocks.length}, esperado no mínimo ${minBlocks}).`);
      }

      // 4. Blocos muito grandes
      const hasHugeBlock = blocks.some(b => (b.pageEnd - b.pageStart + 1) > 12 && totalPages > 12);
      if (hasHugeBlock) errors.push("Alguns blocos estão grandes demais (mais de 12 páginas).");

      if (errors.length === 0) {
        return blocks;
      }

      // Se falhou na validação, tenta de novo com prompt de correção
      attempts++;
      console.warn(`[AI] Tentativa ${attempts} falhou: ${errors.join(" ")}`);
      currentPrompt = initialPrompt + `\n\nERRO NA TENTATIVA ANTERIOR: ${errors.join(" ")}\nPOR FAVOR, DIVIDA O MATERIAL EM MAIS BLOCOS E USE TÍTULOS ESPECÍFICOS DO CONTEÚDO. É PROIBIDO USAR TÍTULOS GENÉRICOS.`;
      
    } catch (error) {
      console.error("Erro ao detectar estrutura:", error);
      attempts++;
    }
  }

  // --- Fallback Seguro se falhou após retries ---
  console.warn(`[AI] Usando fallback para ${totalPages} páginas.`);
  const fallbackBlocks: DetectedBlock[] = [];
  const pageSize = totalPages > 50 ? 10 : 6;
  const numBlocks = Math.ceil(totalPages / pageSize);

  for (let i = 0; i < numBlocks; i++) {
    const start = i * pageSize + 1;
    const end = Math.min((i + 1) * pageSize, totalPages);
    fallbackBlocks.push({
      title: `Parte ${i + 1} do Conteúdo`,
      description: "Divisão automática provisória por páginas. Revise os blocos se necessário.",
      pageStart: start,
      pageEnd: end,
      sourceHeading: "Divisão Automática",
      estimatedStudyMinutes: (end - start + 1) * 3,
      confidence: 0.3,
      createdBy: "AI_FALLBACK"
    });
  }

  return fallbackBlocks;
}
