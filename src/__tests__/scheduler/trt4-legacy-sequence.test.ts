import {
  getLegacyTrt4NextSubjects,
  sortPendingBlocksForSubject,
} from "@/lib/scheduler/legacy-trt4-queue";

describe("LEGACY_TRT4 — Regras de Ordem Fixa e PDF/Blocos", () => {
  const userSubjects = [
    { id: "sub-dt", name: "Direito do Trabalho" },
    { id: "sub-lp", name: "Língua Portuguesa" },
    { id: "sub-dpt", name: "Direito Processual do Trabalho" },
    { id: "sub-da", name: "Direito Administrativo" },
    { id: "sub-dc", name: "Direito Constitucional" },
    { id: "sub-dpc", name: "Direito Processual Civil" },
  ];

  test("Teste 1 — ciclo normal: Ontem Constitucional e Processo Civil concluídos -> Hoje Trabalho e Português", () => {
    const completedHistory = ["sub-dc", "sub-dpc"];
    const result = getLegacyTrt4NextSubjects({
      userSubjects,
      completedSubjectHistory: completedHistory,
    });

    expect(result).toHaveLength(2);
    expect(result[0].subjectName).toBe("Direito do Trabalho");
    expect(result[1].subjectName).toBe("Língua Portuguesa");
  });

  test("Teste 2 — nenhuma matéria estudada: Previsto Trabalho e Português não estudados -> Próximo dia Trabalho e Português", () => {
    const completedHistory: string[] = []; // Nenhuma matéria concluída
    const result = getLegacyTrt4NextSubjects({
      userSubjects,
      completedSubjectHistory: completedHistory,
    });

    expect(result).toHaveLength(2);
    expect(result[0].subjectName).toBe("Direito do Trabalho");
    expect(result[1].subjectName).toBe("Língua Portuguesa");
  });

  test("Teste 3 — somente primeira matéria estudada: Trabalho ✅, Português ❌ -> Próximo dia Português e Processo do Trabalho", () => {
    const completedHistory = ["sub-dt"];
    const result = getLegacyTrt4NextSubjects({
      userSubjects,
      completedSubjectHistory: completedHistory,
    });

    expect(result).toHaveLength(2);
    expect(result[0].subjectName).toBe("Língua Portuguesa");
    expect(result[1].subjectName).toBe("Direito Processual do Trabalho");
  });

  test("Teste 4 — somente segunda matéria estudada: Constitucional ❌, Processo Civil ✅ -> Próximo dia Constitucional e Trabalho", () => {
    // 0(DT), 1(LP), 2(DPT), 3(DA) já haviam sido concluídos em rodadas anteriores.
    // Na rodada de Constitucional (4) e Processo Civil (5), apenas Processo Civil foi concluído.
    const completedHistory = ["sub-dt", "sub-lp", "sub-dpt", "sub-da", "sub-dpc"];
    const result = getLegacyTrt4NextSubjects({
      userSubjects,
      completedSubjectHistory: completedHistory,
    });

    expect(result).toHaveLength(2);
    expect(result[0].subjectName).toBe("Direito Constitucional");
    expect(result[1].subjectName).toBe("Direito do Trabalho");
  });

  test("Teste 5 — não repetir ciclo concluído: Constitucional ✅, Processo Civil ✅ -> Próximo dia continua sendo Trabalho e Português mesmo com blocos pendentes", () => {
    const completedHistory = ["sub-dc", "sub-dpc"];
    const result = getLegacyTrt4NextSubjects({
      userSubjects,
      completedSubjectHistory: completedHistory,
      hasPendingBlocks: () => true, // Todas têm 20-30 blocos pendentes
    });

    expect(result).toHaveLength(2);
    expect(result[0].subjectName).toBe("Direito do Trabalho");
    expect(result[1].subjectName).toBe("Língua Portuguesa");
  });

  test("Teste 6 — ordem dos PDFs: PDF 4, PDF 5, PDF 8 pendentes -> Selecionar PDF 4", () => {
    const blocks = [
      { id: "b8", orderIndex: 1, material: { id: "mat-8", fileName: "PDF 8.pdf" } },
      { id: "b5", orderIndex: 1, material: { id: "mat-5", fileName: "PDF 5.pdf" } },
      { id: "b4", orderIndex: 1, material: { id: "mat-4", fileName: "PDF 4.pdf" } },
    ];

    const sorted = sortPendingBlocksForSubject(blocks);
    expect(sorted[0].id).toBe("b4");
    expect(sorted[1].id).toBe("b5");
    expect(sorted[2].id).toBe("b8");
  });

  test("Teste 7 — ordem interna do PDF: PDF 4 com Bloco 1, 2, 3 pendentes -> Selecionar Bloco 1", () => {
    const blocks = [
      { id: "b3", orderIndex: 3, material: { id: "mat-4", fileName: "PDF 4.pdf" } },
      { id: "b1", orderIndex: 1, material: { id: "mat-4", fileName: "PDF 4.pdf" } },
      { id: "b2", orderIndex: 2, material: { id: "mat-4", fileName: "PDF 4.pdf" } },
    ];

    const sorted = sortPendingBlocksForSubject(blocks);
    expect(sorted[0].id).toBe("b1");
    expect(sorted[1].id).toBe("b2");
    expect(sorted[2].id).toBe("b3");
  });

  test("Teste 8 — PDF 10 não vem antes do PDF 2: Ordenação natural", () => {
    const blocks = [
      { id: "b10", orderIndex: 1, material: { id: "mat-10", fileName: "PDF 10.pdf" } },
      { id: "b2", orderIndex: 1, material: { id: "mat-2", fileName: "PDF 2.pdf" } },
      { id: "b1", orderIndex: 1, material: { id: "mat-1", fileName: "PDF 1.pdf" } },
    ];

    const sorted = sortPendingBlocksForSubject(blocks);
    expect(sorted[0].id).toBe("b1");
    expect(sorted[1].id).toBe("b2");
    expect(sorted[2].id).toBe("b10");
  });
});
