/**
 * Testes unitários para hybrid-engine.ts
 *
 * Executar com: npx jest src/__tests__/ai/
 */

import {
  validateHybridInput,
  validateHybridOutput,
  mergeAdjacentSegments,
  computeLegacyEnvelope,
  type HybridBlockInput,
  type HybridSourceSeed,
} from "@/lib/ai/hybrid-engine";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_CFC_MATERIAL = {
  id: "mat-cfc-1",
  fileName: "CFC - Direito do Trabalho.pdf",
  provider: "CFC" as const,
  totalPages: 50,
  textByPage: [
    { pageNumber: 1, text: "Texto CFC página 1" },
    { pageNumber: 2, text: "Texto CFC página 2" },
  ],
};

const BASE_ESTRATEGIA_MATERIAL = {
  id: "mat-strat-1",
  fileName: "Estrategia - Direito do Trabalho.pdf",
  provider: "ESTRATEGIA" as const,
  totalPages: 200,
  textByPage: [
    { pageNumber: 10, text: "Texto Estrategia página 10" },
    { pageNumber: 20, text: "Texto Estrategia página 20" },
  ],
};

const BASE_INPUT: HybridBlockInput = {
  generationRunId: "run-abc-123",
  subject: "Direito do Trabalho",
  targetTheme: "Rescisão Contratual",
  cfcMaterial: BASE_CFC_MATERIAL,
  estrategiaMaterials: [BASE_ESTRATEGIA_MATERIAL],
  examProfile: "FCC",
  goal: "Dominar os tipos de rescisão para questões FCC",
  availableMinutes: 90,
  aiConfig: {
    provider: "gemini",
    model: "gemini-pro",
    promptVersion: "v1.0.0",
  },
};

const BASE_SOURCES: HybridSourceSeed[] = [
  {
    materialId: "mat-cfc-1",
    fileName: "CFC.pdf",
    sourceRole: "ANCHOR_8020",
    isCanonical: false,
    selectionReason: "Âncora CFC",
    confidence: 0.9,
    orderIndex: 0,
    segments: [
      { disposition: "READ", pageStart: 1, pageEnd: 5, reason: "CFC READ" },
    ],
  },
  {
    materialId: "mat-strat-1",
    fileName: "Estrategia.pdf",
    sourceRole: "DEEPENING",
    isCanonical: true,
    selectionReason: "Aprofundamento",
    confidence: 0.85,
    orderIndex: 1,
    segments: [
      { disposition: "READ", pageStart: 10, pageEnd: 20, reason: "Estrategia READ" },
    ],
  },
];

const BASE_SCOPE = {
  cfcPageNumbers: [1, 2, 3, 4, 5],
  deepeningMaterials: [{ materialId: "mat-strat-1", pageNumbers: [10, 11, 12, 13, 14, 15] }],
};

// ── validateHybridInput ───────────────────────────────────────────────────────

describe("validateHybridInput", () => {
  test("retorna vazio para input válido", () => {
    const errors = validateHybridInput(BASE_INPUT);
    expect(errors).toHaveLength(0);
  });

  test("rejeita generationRunId vazio", () => {
    const errors = validateHybridInput({ ...BASE_INPUT, generationRunId: "" });
    expect(errors.some((e) => e.field === "generationRunId")).toBe(true);
  });

  test("rejeita cfcMaterial.provider diferente de CFC", () => {
    const input = {
      ...BASE_INPUT,
      cfcMaterial: { ...BASE_CFC_MATERIAL, provider: "ESTRATEGIA" as const },
    };
    const errors = validateHybridInput(input);
    expect(errors.some((e) => e.field === "cfcMaterial.provider")).toBe(true);
  });

  test("rejeita estrategiaMaterials vazio", () => {
    const errors = validateHybridInput({ ...BASE_INPUT, estrategiaMaterials: [] });
    expect(errors.some((e) => e.field === "estrategiaMaterials")).toBe(true);
  });

  test("rejeita estrategiaMaterials com provider diferente de ESTRATEGIA", () => {
    const input = {
      ...BASE_INPUT,
      estrategiaMaterials: [{ ...BASE_ESTRATEGIA_MATERIAL, provider: "CFC" as const }],
    };
    const errors = validateHybridInput(input);
    expect(errors.some((e) => e.field.includes("provider"))).toBe(true);
  });

  test("rejeita material com totalPages <= 0", () => {
    const input = {
      ...BASE_INPUT,
      cfcMaterial: { ...BASE_CFC_MATERIAL, totalPages: 0 },
    };
    const errors = validateHybridInput(input);
    expect(errors.some((e) => e.field.includes("totalPages"))).toBe(true);
  });

  test("rejeita pageNumber <= 0 em textByPage", () => {
    const input = {
      ...BASE_INPUT,
      cfcMaterial: {
        ...BASE_CFC_MATERIAL,
        textByPage: [{ pageNumber: 0, text: "texto" }],
      },
    };
    const errors = validateHybridInput(input);
    expect(errors.some((e) => e.field.includes("textByPage"))).toBe(true);
  });

  test("rejeita pageNumber excedendo totalPages", () => {
    const input = {
      ...BASE_INPUT,
      cfcMaterial: {
        ...BASE_CFC_MATERIAL,
        totalPages: 5,
        textByPage: [{ pageNumber: 10, text: "texto" }],
      },
    };
    const errors = validateHybridInput(input);
    expect(errors.some((e) => e.message.includes("excede"))).toBe(true);
  });

  test("rejeita páginas duplicadas no mesmo material", () => {
    const input = {
      ...BASE_INPUT,
      cfcMaterial: {
        ...BASE_CFC_MATERIAL,
        textByPage: [
          { pageNumber: 1, text: "texto" },
          { pageNumber: 1, text: "duplicado" },
        ],
      },
    };
    const errors = validateHybridInput(input);
    expect(errors.some((e) => e.message.includes("duplicada"))).toBe(true);
  });

  test("rejeita availableMinutes <= 0", () => {
    const errors = validateHybridInput({ ...BASE_INPUT, availableMinutes: 0 });
    expect(errors.some((e) => e.field === "availableMinutes")).toBe(true);
  });
});

// ── validateHybridOutput ──────────────────────────────────────────────────────

describe("validateHybridOutput", () => {
  test("retorna vazio para output válido", () => {
    const errors = validateHybridOutput(
      { sources: BASE_SOURCES, flashcardSeeds: [], confidence: 0.85 },
      BASE_SCOPE
    );
    expect(errors).toHaveLength(0);
  });

  test("rejeita output sem ANCHOR_8020", () => {
    const sources = BASE_SOURCES.filter((s) => s.sourceRole !== "ANCHOR_8020");
    const errors = validateHybridOutput({ sources, flashcardSeeds: [], confidence: null }, BASE_SCOPE);
    expect(errors.some((e) => e.message.includes("ANCHOR_8020"))).toBe(true);
  });

  test("rejeita output com múltiplos ANCHOR_8020", () => {
    const sources = [
      ...BASE_SOURCES,
      { ...BASE_SOURCES[0], materialId: "mat-cfc-2" },
    ];
    const errors = validateHybridOutput({ sources, flashcardSeeds: [], confidence: null }, BASE_SCOPE);
    expect(errors.some((e) => e.message.includes("ANCHOR_8020"))).toBe(true);
  });

  test("rejeita ANCHOR_8020 com isCanonical = true", () => {
    const sources = [
      { ...BASE_SOURCES[0], isCanonical: true }, // ANCHOR_8020 com canonical
      BASE_SOURCES[1],
    ];
    const errors = validateHybridOutput({ sources, flashcardSeeds: [], confidence: null }, BASE_SCOPE);
    expect(errors.some((e) => e.message.includes("ANCHOR_8020") && e.message.includes("isCanonical"))).toBe(true);
  });

  test("rejeita output sem DEEPENING", () => {
    const sources = BASE_SOURCES.filter((s) => s.sourceRole !== "DEEPENING");
    const errors = validateHybridOutput({ sources, flashcardSeeds: [], confidence: null }, BASE_SCOPE);
    expect(errors.some((e) => e.message.includes("DEEPENING"))).toBe(true);
  });

  test("rejeita output sem DEEPENING canônico", () => {
    const sources = [
      BASE_SOURCES[0],
      { ...BASE_SOURCES[1], isCanonical: false },
    ];
    const errors = validateHybridOutput({ sources, flashcardSeeds: [], confidence: null }, BASE_SCOPE);
    expect(errors.some((e) => e.message.includes("isCanonical"))).toBe(true);
  });

  test("rejeita confidence fora do intervalo [0, 1]", () => {
    const errors = validateHybridOutput(
      { sources: BASE_SOURCES, flashcardSeeds: [], confidence: 1.5 },
      BASE_SCOPE
    );
    expect(errors.some((e) => e.field === "confidence")).toBe(true);
  });

  test("aceita confidence = null", () => {
    const errors = validateHybridOutput(
      { sources: BASE_SOURCES, flashcardSeeds: [], confidence: null },
      BASE_SCOPE
    );
    expect(errors.filter((e) => e.field === "confidence")).toHaveLength(0);
  });

  test("rejeita flashcard sem generationReason", () => {
    const errors = validateHybridOutput(
      {
        sources: BASE_SOURCES,
        flashcardSeeds: [
          {
            question: "Q",
            answer: "A",
            type: "QUESTION_ANSWER",
            sourceMaterialId: "mat-strat-1",
            sourcePageStart: 10,
            sourcePageEnd: 15,
            generationReason: "", // vazio
          },
        ],
        confidence: null,
      },
      BASE_SCOPE
    );
    expect(errors.some((e) => e.field.includes("generationReason"))).toBe(true);
  });

  test("rejeita flashcard fora de segmento READ", () => {
    const sourcesWithSkip: HybridSourceSeed[] = [
      BASE_SOURCES[0],
      {
        ...BASE_SOURCES[1],
        segments: [
          { disposition: "SKIP", pageStart: 10, pageEnd: 20, reason: "SKIP" },
        ],
      },
    ];
    const errors = validateHybridOutput(
      {
        sources: sourcesWithSkip,
        flashcardSeeds: [
          {
            question: "Q",
            answer: "A",
            type: "QUESTION_ANSWER",
            sourceMaterialId: "mat-strat-1",
            sourcePageStart: 10,
            sourcePageEnd: 15,
            generationReason: "Teste",
          },
        ],
        confidence: null,
      },
      BASE_SCOPE
    );
    expect(errors.some((e) => e.message.includes("READ"))).toBe(true);
  });

  test("rejeita página com múltiplas disposições", () => {
    const sources: HybridSourceSeed[] = [
      BASE_SOURCES[0],
      {
        ...BASE_SOURCES[1],
        segments: [
          { disposition: "READ", pageStart: 10, pageEnd: 15, reason: "READ" },
          { disposition: "SKIP", pageStart: 12, pageEnd: 20, reason: "SKIP" }, // sobreposição nas 12-15
        ],
      },
    ];
    const errors = validateHybridOutput({ sources, flashcardSeeds: [], confidence: null }, BASE_SCOPE);
    expect(errors.some((e) => e.message.includes("múltiplas disposições"))).toBe(true);
  });
});

// ── mergeAdjacentSegments ─────────────────────────────────────────────────────

describe("mergeAdjacentSegments", () => {
  test("retorna vazio para array vazio", () => {
    expect(mergeAdjacentSegments([])).toHaveLength(0);
  });

  test("não muta segmentos não adjacentes", () => {
    const segments = [
      { disposition: "READ" as const, pageStart: 1, pageEnd: 5, reason: "A" },
      { disposition: "READ" as const, pageStart: 10, pageEnd: 15, reason: "B" },
    ];
    const merged = mergeAdjacentSegments(segments);
    expect(merged).toHaveLength(2);
  });

  test("funde segmentos adjacentes com mesma disposição", () => {
    const segments = [
      { disposition: "READ" as const, pageStart: 1, pageEnd: 5, reason: "A" },
      { disposition: "READ" as const, pageStart: 6, pageEnd: 10, reason: "B" },
    ];
    const merged = mergeAdjacentSegments(segments);
    expect(merged).toHaveLength(1);
    expect(merged[0].pageStart).toBe(1);
    expect(merged[0].pageEnd).toBe(10);
  });

  test("funde segmentos sobrepostos com mesma disposição", () => {
    const segments = [
      { disposition: "READ" as const, pageStart: 1, pageEnd: 8, reason: "A" },
      { disposition: "READ" as const, pageStart: 5, pageEnd: 12, reason: "B" },
    ];
    const merged = mergeAdjacentSegments(segments);
    expect(merged).toHaveLength(1);
    expect(merged[0].pageEnd).toBe(12);
  });

  test("não funde segmentos com disposições diferentes", () => {
    const segments = [
      { disposition: "READ" as const, pageStart: 1, pageEnd: 5, reason: "A" },
      { disposition: "SKIP" as const, pageStart: 6, pageEnd: 10, reason: "B" },
    ];
    const merged = mergeAdjacentSegments(segments);
    expect(merged).toHaveLength(2);
  });

  test("não muta o array original", () => {
    const segments = [
      { disposition: "READ" as const, pageStart: 1, pageEnd: 5, reason: "A" },
    ];
    const original = JSON.stringify(segments);
    mergeAdjacentSegments(segments);
    expect(JSON.stringify(segments)).toBe(original);
  });
});

// ── computeLegacyEnvelope ─────────────────────────────────────────────────────

describe("computeLegacyEnvelope", () => {
  test("retorna pageStart/pageEnd corretos do DEEPENING canônico READ", () => {
    const envelope = computeLegacyEnvelope(BASE_SOURCES);
    expect(envelope).toEqual({ pageStart: 10, pageEnd: 20 });
  });

  test("retorna null quando não há DEEPENING canônico", () => {
    const sources = BASE_SOURCES.map((s) =>
      s.sourceRole === "DEEPENING" ? { ...s, isCanonical: false } : s
    );
    expect(computeLegacyEnvelope(sources)).toBeNull();
  });

  test("retorna null quando DEEPENING canônico não tem segmento READ", () => {
    const sources: HybridSourceSeed[] = [
      BASE_SOURCES[0],
      {
        ...BASE_SOURCES[1],
        segments: [
          { disposition: "SKIP", pageStart: 10, pageEnd: 20, reason: "Tudo SKIP" },
        ],
      },
    ];
    expect(computeLegacyEnvelope(sources)).toBeNull();
  });

  test("usa mínimo/máximo entre múltiplos segmentos READ do DEEPENING canônico", () => {
    const sources: HybridSourceSeed[] = [
      BASE_SOURCES[0],
      {
        ...BASE_SOURCES[1],
        segments: [
          { disposition: "READ", pageStart: 10, pageEnd: 15, reason: "A" },
          { disposition: "SKIP", pageStart: 16, pageEnd: 18, reason: "B" },
          { disposition: "READ", pageStart: 20, pageEnd: 30, reason: "C" },
        ],
      },
    ];
    const envelope = computeLegacyEnvelope(sources);
    expect(envelope).toEqual({ pageStart: 10, pageEnd: 30 });
  });
});
