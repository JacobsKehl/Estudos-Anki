import { GeneratedFlashcard } from "../flashcards";

/**
 * Mock Flashcard Generator
 * Simulates an AI call for development when GEMINI_API_KEY is missing.
 */
export async function generateFlashcardsMock(text: string, count: number = 5): Promise<GeneratedFlashcard[]> {
  console.log("🤖 AI: Using MOCK provider for flashcard generation.");
  
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  const concepts = [
    "Controle de Constitucionalidade",
    "Poder Constituinte",
    "Direitos Fundamentais",
    "Separação de Poderes",
    "Atos Administrativos",
    "Princípio da Legalidade"
  ];

  const cards: GeneratedFlashcard[] = [];
  
  for (let i = 0; i < Math.min(count, 10); i++) {
    const concept = concepts[i % concepts.length];
    cards.push({
      question: `Explique o conceito de ${concept} com base no bloco de estudo (MOCK).`,
      answer: `O conceito de ${concept} refere-se à aplicação prática dos princípios descritos no material, focando na organização e validade das normas.`,
      type: 'QUESTION_ANSWER',
      difficulty: i % 3 === 0 ? 'HARD' : i % 2 === 0 ? 'MEDIUM' : 'EASY'
    });
  }

  return cards;
}
