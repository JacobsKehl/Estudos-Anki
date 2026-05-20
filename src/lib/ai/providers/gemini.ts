import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeneratedFlashcard } from "../flashcards";
import { buildFlashcardPrompt, FlashcardDifficulty } from "../prompts/flashcard-generation";
import { callGeminiWithRetry } from "../utils/retry";

/**
 * Gemini Flashcard Generator
 * Uses real Google Gemini API to generate cards from text.
 */
export async function generateFlashcardsWithGemini(
  blockText: string,
  difficulty: FlashcardDifficulty = "NORMAL_PLUS"
): Promise<GeneratedFlashcard[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  console.log("🚀 AI: Using GEMINI provider for flashcard generation.");

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = buildFlashcardPrompt(blockText, difficulty);
    
    const result = await callGeminiWithRetry(() => model.generateContent(prompt));
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error("Resposta da IA veio vazia.");
    }

    try {
      const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const flashcards = JSON.parse(cleanJson);
      
      if (!Array.isArray(flashcards)) {
        throw new Error("O formato retornado pela IA não é um array.");
      }

      return flashcards as GeneratedFlashcard[];
    } catch (_parseError) {
      console.error("Failed to parse Gemini response:", text);
      throw new Error("A resposta da IA veio em um formato inesperado. Tente gerar novamente.");
    }
  } catch (error: unknown) {
    console.error("Gemini API Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro de comunicação com a Gemini API.";
    throw new Error(errorMessage);
  }
}
