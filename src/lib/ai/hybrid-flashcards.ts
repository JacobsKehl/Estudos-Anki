/**
 * src/lib/ai/hybrid-flashcards.ts
 *
 * Gerador de flashcards adicionais para blocos HYBRID_8020.
 *
 * IMPORTANTE:
 *   - Esta função não executa Prisma.
 *   - O provider de IA é injetável para testes mockados.
 *   - Apenas segmentos READ são aceitos como origem.
 *   - Deduplicação realizada antes de retornar (não modifica cards existentes).
 *   - Todos os cards retornados têm status implícito PENDING_APPROVAL.
 */

export interface HybridFlashcardContextPage {
  materialId: string;
  pageNumber: number;
  text: string;
}

export interface ExistingCardSnapshot {
  question: string;
  answer: string;
  materialId: string | null;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
}

export interface GenerateHybridFlashcardsInput {
  studyBlockId: string;
  /** Apenas páginas correspondentes a segmentos READ — filtragem feita pelo chamador */
  pages: HybridFlashcardContextPage[];
  /** Cards já existentes para deduplicação */
  existingCards: ExistingCardSnapshot[];
  requestedAmount: number;
}

export interface HybridFlashcardSeed {
  question: string;
  answer: string;
  type: "CLOZE" | "QUESTION_ANSWER";
  sourceMaterialId: string;
  /** Página inicial do segmento READ de origem */
  sourcePageStart: number;
  /** Página final do segmento READ de origem */
  sourcePageEnd: number;
  /** Obrigatório — justificativa da geração */
  generationReason: string;
}

/** Provider de IA injetável — permite mocks nos testes */
export interface FlashcardAIProvider {
  generate(params: {
    pages: HybridFlashcardContextPage[];
    existingCardQuestions: string[];
    requestedAmount: number;
  }): Promise<HybridFlashcardSeed[]>;
}

// ─── Normalização para deduplicação ──────────────────────────────────────────

/**
 * Normaliza uma string para comparação de deduplicação.
 * Não remove pontuação agressivamente para não alterar o sentido.
 * Remove apenas espaços extras e normaliza Unicode.
 */
export function normalizeForDedup(text: string): string {
  return text
    .normalize("NFC")            // Normaliza composição Unicode
    .replace(/\s+/g, " ")        // Colapsa espaços múltiplos
    .trim()
    .toLowerCase();
}

/**
 * Verifica se um card candidato já existe na lista de cards existentes.
 * Compara pergunta e resposta normalizadas.
 */
export function isDuplicate(
  candidate: { question: string; answer: string },
  existingCards: ExistingCardSnapshot[]
): boolean {
  const normalizedQ = normalizeForDedup(candidate.question);
  const normalizedA = normalizeForDedup(candidate.answer);

  return existingCards.some(
    (c) =>
      normalizeForDedup(c.question) === normalizedQ &&
      normalizeForDedup(c.answer) === normalizedA
  );
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Gera flashcards adicionais para um bloco HYBRID_8020.
 *
 * @param input - Contexto do bloco e páginas READ.
 * @param aiProvider - Provider de IA (real ou mock).
 * @returns Array de HybridFlashcardSeed únicos (sem duplicatas dos existentes).
 *
 * @throws Error se `pages` estiver vazia — use somente segmentos READ.
 * @throws Error se `requestedAmount` <= 0.
 */
export async function generateMoreHybridFlashcards(
  input: GenerateHybridFlashcardsInput,
  aiProvider: FlashcardAIProvider
): Promise<HybridFlashcardSeed[]> {
  const { pages, existingCards, requestedAmount } = input;

  if (pages.length === 0) {
    throw new Error(
      "[hybrid-flashcards] Nenhuma página READ fornecida. " +
        "Certifique-se de filtrar apenas segmentos com disposition=READ antes de chamar esta função."
    );
  }

  if (requestedAmount <= 0) {
    throw new Error("[hybrid-flashcards] requestedAmount deve ser > 0");
  }

  // Extrair perguntas normalizadas para passar ao provider e evitar duplicatas na geração
  const existingQuestions = existingCards.map((c) => normalizeForDedup(c.question));

  const generated = await aiProvider.generate({
    pages,
    existingCardQuestions: existingQuestions,
    requestedAmount,
  });

  // Filtrar duplicatas que o provider eventualmente retornar
  const unique = generated.filter((card) => !isDuplicate(card, existingCards));

  return unique;
}
