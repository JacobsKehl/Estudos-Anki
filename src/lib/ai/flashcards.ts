import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildFlashcardPrompt, FlashcardDifficulty, FlashcardPromptOptions } from "./prompts/flashcard-generation";
import { callGeminiWithRetry } from "./utils/retry";

export interface GeneratedFlashcard {
  question: string;
  answer: string;
  type: "QUESTION_ANSWER" | "CLOZE";
  difficulty: "EASY" | "MEDIUM" | "HARD";
}

export interface GenerateFlashcardsOptions {
  text: string;
  difficulty?: FlashcardDifficulty;
  subjectName?: string | null;
  blockTitle?: string | null;
  materialTitle?: string | null;
  examGoal?: string | null;
  focusArea?: string | null;
  existingQuestions?: string[];
}

export async function generateFlashcards(
  optionsOrText: string | GenerateFlashcardsOptions,
  legacyDifficulty: FlashcardDifficulty = "NORMAL_PLUS"
): Promise<GeneratedFlashcard[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada.");

  let options: FlashcardPromptOptions;
  if (typeof optionsOrText === "string") {
    options = {
      blockText: optionsOrText,
      difficulty: legacyDifficulty
    };
  } else {
    options = {
      blockText: optionsOrText.text,
      difficulty: optionsOrText.difficulty || legacyDifficulty,
      subjectName: optionsOrText.subjectName,
      blockTitle: optionsOrText.blockTitle,
      materialTitle: optionsOrText.materialTitle,
      examGoal: optionsOrText.examGoal,
      focusArea: optionsOrText.focusArea,
      existingQuestions: optionsOrText.existingQuestions
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    }
  });

  const prompt = buildFlashcardPrompt(options);

  try {
    const result = await callGeminiWithRetry(() => model.generateContent(prompt));
    const response = await result.response;
    const responseText = response.text();
    // Limpa a resposta para garantir que seja um JSON válido
    // Busca o primeiro '[' e o último ']' para extrair apenas o array JSON
    const startIndex = responseText.indexOf("[");
    const endIndex = responseText.lastIndexOf("]");
    
    if (startIndex === -1 || endIndex === -1) {
      console.error("Gemini não retornou um array JSON válido:", responseText);
      return [];
    }

    const cleanJson = responseText.substring(startIndex, endIndex + 1);
    const cards: GeneratedFlashcard[] = JSON.parse(cleanJson);

    // Validações básicas e normalização (sempre Pergunta/Resposta)
    return cards
      .filter(card => card.question && card.answer)
      .map(card => ({
        ...card,
        type: "QUESTION_ANSWER" as const,
        difficulty: (["EASY", "MEDIUM", "HARD"].includes(card.difficulty?.toUpperCase?.() ?? "") 
          ? card.difficulty.toUpperCase() 
          : "MEDIUM") as any
      }));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Erro ao gerar flashcards com IA:", errorMessage);
    throw new Error(`Falha na IA ao gerar cards: ${errorMessage}`);
  }
}
