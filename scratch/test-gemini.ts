import { generateFlashcards } from "../src/lib/ai/flashcards";
import * as dotenv from "dotenv";
import * as path from "path";

// Load dotenv
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function run() {
  console.log("Starting Gemini Flashcard Generation test...");
  console.log("API Key loaded:", process.env.GEMINI_API_KEY ? "YES (starts with " + process.env.GEMINI_API_KEY.substring(0, 8) + ")" : "NO");

  const sampleText = `
    O Recurso Ordinário é o recurso cabível das decisões definitivas ou terminativas das Varas do Trabalho e dos Tribunais Regionais do Trabalho, em processos de sua competência originária.
    O prazo para interposição do Recurso Ordinário é de 8 (oito) dias.
    Compete ao Tribunal Regional do Trabalho julgar o Recurso Ordinário das decisões das Varas.
  `;

  try {
    const cards = await generateFlashcards(sampleText);
    console.log("SUCCESS! Generated cards:", JSON.stringify(cards, null, 2));
  } catch (error) {
    console.error("FAILURE! Error during generation:", error);
  }
}

run();
