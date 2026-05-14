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
      
      const startIndex = lastResponse.indexOf("[");
      const endIndex = lastResponse.lastIndexOf("]");
      if (startIndex === -1) throw new Error("JSON não encontrado");
      
      const cleanJson = lastResponse.substring(startIndex, endIndex + 1);
      const blocks: DetectedBlock[] = JSON.parse(cleanJson);

      // --- Validação ---
      const errors: string[] = [];

      // 1. Títulos genéricos
      const hasGenericTitle = blocks.some(b => {
        const titleNorm = b.title.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const isForbiddenLiteral = GENERIC_TITLES.some(gt => titleNorm === gt || titleNorm.includes(gt));
        const isForbiddenPattern = FORBIDDEN_GENERIC_PATTERNS.some(re => re.test(b.title));
        return isForbiddenLiteral || isForbiddenPattern;
      });
      if (hasGenericTitle) errors.push("Contém títulos genéricos proibidos (Parte X, Conteúdo Completo, etc).");

      // 2. Bloco único para material longo
      if (blocks.length === 1 && totalPages > 5) {
        errors.push("Criou apenas um bloco para um material longo. Divida por assuntos específicos.");
      }

      // 3. Quantidade mínima de blocos
      let minBlocks = 1;
      if (totalPages > 50) minBlocks = 8;
      else if (totalPages > 20) minBlocks = 5;
      else if (totalPages > 5) minBlocks = 3;

      if (blocks.length < minBlocks && totalPages > 5) {
        errors.push(`Quantidade insuficiente de blocos (encontrado ${blocks.length}, esperado no mínimo ${minBlocks}).`);
      }

      if (errors.length === 0) {
        return blocks;
      }

      // Se falhou na validação, tenta de novo com prompt de correção
      attempts++;
      console.warn(`[AI] Tentativa ${attempts} falhou: ${errors.join(" ")}`);
      currentPrompt = initialPrompt + `\n\nREJEITADO: A divisão anterior foi rejeitada pelos seguintes erros: ${errors.join(" ")}\nPOR FAVOR, extraia títulos reais do PDF. Não use "Parte X" ou "Conteúdo Completo".`;
      
    } catch (error) {
      console.error("Erro ao detectar estrutura:", error);
      attempts++;
    }
  }

  // --- Fallback Seguro se falhou após retries ---
  console.warn(`[AI] Usando fallback temático para ${totalPages} páginas.`);
  const fallbackBlocks: DetectedBlock[] = [];
  const pageSize = totalPages > 50 ? 10 : 6;
  const numBlocks = Math.ceil(totalPages / pageSize);

  for (let i = 0; i < numBlocks; i++) {
    const start = i * pageSize + 1;
    const end = Math.min((i + 1) * pageSize, totalPages);
    
    let fallbackTitle = `Tópicos centrais do material (Bloco ${i + 1})`;
    if (i === 0) fallbackTitle = "Tópicos iniciais e fundamentos";
    if (i === numBlocks - 1 && numBlocks > 1) fallbackTitle = "Questões e consolidação do conteúdo";

    fallbackBlocks.push({
      title: fallbackTitle,
      description: "Divisão automática provisória baseada no volume de páginas. Revise o conteúdo.",
      pageStart: start,
      pageEnd: end,
      sourceHeading: "Divisão Automática (Fallback)",
      estimatedStudyMinutes: (end - start + 1) * 3,
      confidence: 0.3,
      createdBy: "AI_FALLBACK"
    });
  }

  return fallbackBlocks;
}
