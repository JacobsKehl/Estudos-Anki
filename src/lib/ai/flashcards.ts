import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildFlashcardPrompt } from "./prompts/flashcard-generation";

export interface GeneratedFlashcard {
  question: string;
  answer: string;
  type: "QUESTION_ANSWER" | "CLOZE";
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

export async function generateFlashcards(text: string): Promise<GeneratedFlashcard[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");

  const genAI = new GoogleGenerativeAI(apiKey);
  // Usando gemini-flash-latest conforme estabilizado anteriormente
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = buildFlashcardPrompt(text);

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    
    // Limpa a resposta para garantir que seja um JSON válido
    const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const cards: GeneratedFlashcard[] = JSON.parse(cleanJson);

    // Validações básicas e normalização
    return cards
      .filter(card => card.question && card.answer && card.type)
      .map(card => ({
        ...card,
        type: (card.type.toUpperCase() === "CLOZE" ? "CLOZE" : "QUESTION_ANSWER") as any,
        difficulty: (["EASY", "MEDIUM", "HARD"].includes(card.difficulty.toUpperCase()) 
          ? card.difficulty.toUpperCase() 
          : "MEDIUM") as any
      }));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Erro ao gerar flashcards com IA:", errorMessage);
    throw new Error(`Falha na IA ao gerar cards: ${errorMessage}`);
  }
}
