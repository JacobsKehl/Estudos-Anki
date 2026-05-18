import { GoogleGenerativeAI } from "@google/generative-ai";
import { STUDY_BLOCK_GENERATION_PROMPT } from "./prompts/study-block-generation";

export interface SuggestedBlock {
  title: string;
  description: string;
  pageStart: number;
  pageEnd: number;
  estimatedStudyMinutes: number;
  confidence: number;
}

export async function suggestStudyBlocks(materialId: string, pages: { pageNumber: number, text: string }[]): Promise<SuggestedBlock[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
    }
  });

  // Formata as páginas para o prompt
  const pagesText = pages
    .map(p => `PÁGINA ${p.pageNumber}:\n${p.text.substring(0, 1000)}...`) // Limitando texto por página para não estourar tokens
    .join("\n\n---\n\n");

  const prompt = STUDY_BLOCK_GENERATION_PROMPT.replace("{{pages}}", pagesText);

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Limpa a resposta para garantir que seja um JSON válido
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const suggestions: SuggestedBlock[] = JSON.parse(cleanJson);

    // Validações básicas
    return suggestions
      .filter(s => s.title && s.pageStart > 0 && s.pageEnd >= s.pageStart)
      .sort((a, b) => a.pageStart - b.pageStart);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Erro ao sugerir blocos com IA:", errorMessage);
    throw new Error(`Falha na IA: ${errorMessage}`);
  }
}
