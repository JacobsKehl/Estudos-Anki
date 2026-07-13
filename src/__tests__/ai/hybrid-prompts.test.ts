/**
 * Testes unitários para hybrid-8020.ts prompts
 *
 * Executar com: npx jest src/__tests__/ai/hybrid-prompts.test.ts
 */

import {
  HYBRID_PROMPT_VERSION,
  buildMapPagesPrompt,
  buildCandidateRetrievalPrompt,
  buildDeepAnalysisPrompt,
  MAP_PAGES_SCHEMA,
  CANDIDATE_RETRIEVAL_SCHEMA,
  DEEP_ANALYSIS_SCHEMA,
} from "@/lib/ai/prompts/hybrid-8020";

describe("Prompts Híbridos 80/20", () => {
  test("possui versão do prompt definida", () => {
    expect(HYBRID_PROMPT_VERSION).toBeTruthy();
    expect(typeof HYBRID_PROMPT_VERSION).toBe("string");
  });

  test("possui esquemas JSON definidos para todas as etapas", () => {
    expect(MAP_PAGES_SCHEMA).toContain("pageNumber");
    expect(CANDIDATE_RETRIEVAL_SCHEMA).toContain("candidatePages");
    expect(DEEP_ANALYSIS_SCHEMA).toContain("sources");
    expect(DEEP_ANALYSIS_SCHEMA).toContain("disposition");
  });

  test("buildMapPagesPrompt injeta parâmetros corretos", () => {
    const prompt = buildMapPagesPrompt({
      materialId: "mat-123",
      pages: [{ pageNumber: 5, text: "Direitos Constitucionais" }],
    });

    expect(prompt).toContain("mat-123");
    expect(prompt).toContain("5");
    expect(prompt).toContain("Direitos Constitucionais");
    expect(prompt).toContain(HYBRID_PROMPT_VERSION);
  });

  test("buildCandidateRetrievalPrompt injeta pontos âncora e perfis", () => {
    const prompt = buildCandidateRetrievalPrompt({
      cfcAnchorPoints: ["Âncora 1", "Âncora 2"],
      estrategiaMappedPages: [{ pageNumber: 12, topics: ["Tópico A"], summary: "Sumário A" }],
      targetTheme: "Controle de Constitucionalidade",
      examProfile: "FCC",
    });

    expect(prompt).toContain("Âncora 1");
    expect(prompt).toContain("Tópico A");
    expect(prompt).toContain("Controle de Constitucionalidade");
    expect(prompt).toContain("FCC");
    expect(prompt).toContain(HYBRID_PROMPT_VERSION);
  });

  test("buildDeepAnalysisPrompt contém regras sobre READ, CONSULT, SKIP e flashcards", () => {
    const prompt = buildDeepAnalysisPrompt({
      cfcPages: [{ pageNumber: 1, text: "Texto CFC" }],
      estrategiaPages: [{ materialId: "strat-1", pageNumber: 10, text: "Texto Estratégia" }],
      targetTheme: "Atos Administrativos",
      examProfile: "FCC",
      goal: "Passar no concurso",
    });

    expect(prompt).toContain("Atos Administrativos");
    expect(prompt).toContain("Passar no concurso");
    expect(prompt).toContain("FCC");
    expect(prompt).toContain("READ");
    expect(prompt).toContain("CONSULT");
    expect(prompt).toContain("SKIP");
    expect(prompt).toContain("PROIBIDO");
    expect(prompt).toContain(HYBRID_PROMPT_VERSION);
  });
});
