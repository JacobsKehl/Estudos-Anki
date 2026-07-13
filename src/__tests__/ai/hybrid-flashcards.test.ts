/**
 * Testes unitários para hybrid-flashcards.ts
 *
 * Executar com: npx jest src/__tests__/ai/hybrid-flashcards.test.ts
 */

import {
  normalizeForDedup,
  isDuplicate,
  generateMoreHybridFlashcards,
  type FlashcardAIProvider,
  type HybridFlashcardContextPage,
  type ExistingCardSnapshot,
  type HybridFlashcardSeed,
} from "@/lib/ai/hybrid-flashcards";

// ── normalizeForDedup ─────────────────────────────────────────────────────────

describe("normalizeForDedup", () => {
  test("colapsa espaços múltiplos", () => {
    expect(normalizeForDedup("hello   world")).toBe("hello world");
  });

  test("converte para lowercase", () => {
    expect(normalizeForDedup("HELLO World")).toBe("hello world");
  });

  test("remove espaços nas bordas", () => {
    expect(normalizeForDedup("  hello  ")).toBe("hello");
  });

  test("normaliza caracteres Unicode compostos (NFC)", () => {
    // "é" pode ser representado como é (U+00E9) ou e + combining accent (U+0065 + U+0301)
    const composed = "\u00E9";    // é pré-composto
    const decomposed = "\u0065\u0301"; // e + acento
    expect(normalizeForDedup(composed)).toBe(normalizeForDedup(decomposed));
  });

  test("string vazia retorna string vazia", () => {
    expect(normalizeForDedup("")).toBe("");
  });
});

// ── isDuplicate ───────────────────────────────────────────────────────────────

describe("isDuplicate", () => {
  const existingCards: ExistingCardSnapshot[] = [
    {
      question: "O que é rescisão por justa causa?",
      answer: "Dispensa por motivo grave imputado ao empregado.",
      materialId: "mat-1",
      sourcePageStart: 10,
      sourcePageEnd: 12,
    },
  ];

  test("detecta duplicata exata", () => {
    expect(
      isDuplicate(
        {
          question: "O que é rescisão por justa causa?",
          answer: "Dispensa por motivo grave imputado ao empregado.",
        },
        existingCards
      )
    ).toBe(true);
  });

  test("detecta duplicata com capitalização diferente", () => {
    expect(
      isDuplicate(
        {
          question: "o que é RESCISÃO por justa causa?",
          answer: "DISPENSA por motivo grave imputado ao empregado.",
        },
        existingCards
      )
    ).toBe(true);
  });

  test("detecta duplicata com espaços extras", () => {
    expect(
      isDuplicate(
        {
          question: "  O que é rescisão por justa causa?  ",
          answer: "Dispensa por motivo grave imputado ao empregado.",
        },
        existingCards
      )
    ).toBe(true);
  });

  test("não considera duplicata quando a resposta é diferente", () => {
    expect(
      isDuplicate(
        {
          question: "O que é rescisão por justa causa?",
          answer: "Resposta completamente diferente.",
        },
        existingCards
      )
    ).toBe(false);
  });

  test("não considera duplicata quando a pergunta é diferente", () => {
    expect(
      isDuplicate(
        {
          question: "O que é demissão voluntária?",
          answer: "Dispensa por motivo grave imputado ao empregado.",
        },
        existingCards
      )
    ).toBe(false);
  });

  test("retorna false para lista vazia de existentes", () => {
    expect(
      isDuplicate(
        { question: "Qualquer pergunta", answer: "Qualquer resposta" },
        []
      )
    ).toBe(false);
  });
});

// ── generateMoreHybridFlashcards ──────────────────────────────────────────────

describe("generateMoreHybridFlashcards", () => {
  const mockPages: HybridFlashcardContextPage[] = [
    { materialId: "mat-strat-1", pageNumber: 10, text: "Conteúdo da página 10" },
    { materialId: "mat-strat-1", pageNumber: 11, text: "Conteúdo da página 11" },
  ];

  const mockExistingCards: ExistingCardSnapshot[] = [
    {
      question: "Pergunta já existente",
      answer: "Resposta já existente",
      materialId: "mat-strat-1",
      sourcePageStart: 10,
      sourcePageEnd: 11,
    },
  ];

  function makeProvider(seeds: HybridFlashcardSeed[]): FlashcardAIProvider {
    return {
      generate: jest.fn().mockResolvedValue(seeds),
    };
  }

  test("retorna cards únicos — remove duplicatas dos existentes", async () => {
    const provider = makeProvider([
      {
        question: "Pergunta já existente", // duplicata
        answer: "Resposta já existente",
        type: "QUESTION_ANSWER",
        sourceMaterialId: "mat-strat-1",
        sourcePageStart: 10,
        sourcePageEnd: 11,
        generationReason: "Motivo",
      },
      {
        question: "Nova pergunta única",
        answer: "Nova resposta única",
        type: "QUESTION_ANSWER",
        sourceMaterialId: "mat-strat-1",
        sourcePageStart: 10,
        sourcePageEnd: 11,
        generationReason: "Motivo",
      },
    ]);

    const result = await generateMoreHybridFlashcards(
      {
        studyBlockId: "block-1",
        pages: mockPages,
        existingCards: mockExistingCards,
        requestedAmount: 2,
      },
      provider
    );

    // Apenas o card novo deve retornar
    expect(result).toHaveLength(1);
    expect(result[0].question).toBe("Nova pergunta única");
  });

  test("lança erro quando pages está vazio", async () => {
    const provider = makeProvider([]);

    await expect(
      generateMoreHybridFlashcards(
        {
          studyBlockId: "block-1",
          pages: [],
          existingCards: [],
          requestedAmount: 5,
        },
        provider
      )
    ).rejects.toThrow("READ");
  });

  test("lança erro quando requestedAmount <= 0", async () => {
    const provider = makeProvider([]);

    await expect(
      generateMoreHybridFlashcards(
        {
          studyBlockId: "block-1",
          pages: mockPages,
          existingCards: [],
          requestedAmount: 0,
        },
        provider
      )
    ).rejects.toThrow("requestedAmount");
  });

  test("passa perguntas normalizadas dos existentes para o provider", async () => {
    const generateFn = jest.fn().mockResolvedValue([]);
    const provider: FlashcardAIProvider = { generate: generateFn };

    await generateMoreHybridFlashcards(
      {
        studyBlockId: "block-1",
        pages: mockPages,
        existingCards: mockExistingCards,
        requestedAmount: 3,
      },
      provider
    );

    expect(generateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        existingCardQuestions: ["pergunta já existente"],
        requestedAmount: 3,
      })
    );
  });

  test("retorna array vazio quando provider não gera nada", async () => {
    const provider = makeProvider([]);

    const result = await generateMoreHybridFlashcards(
      {
        studyBlockId: "block-1",
        pages: mockPages,
        existingCards: [],
        requestedAmount: 5,
      },
      provider
    );

    expect(result).toHaveLength(0);
  });

  test("não muta o array de existingCards", async () => {
    const existing: ExistingCardSnapshot[] = [
      {
        question: "Pergunta existente",
        answer: "Resposta existente",
        materialId: null,
        sourcePageStart: null,
        sourcePageEnd: null,
      },
    ];
    const originalLength = existing.length;
    const provider = makeProvider([
      {
        question: "Nova pergunta",
        answer: "Nova resposta",
        type: "QUESTION_ANSWER",
        sourceMaterialId: "mat-strat-1",
        sourcePageStart: 10,
        sourcePageEnd: 11,
        generationReason: "Motivo",
      },
    ]);

    await generateMoreHybridFlashcards(
      {
        studyBlockId: "block-1",
        pages: mockPages,
        existingCards: existing,
        requestedAmount: 3,
      },
      provider
    );

    expect(existing).toHaveLength(originalLength);
  });
});
