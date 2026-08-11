import {
  getLegacyTrt4NextSubjects,
  sortPendingBlocksForSubject,
  extractMaterialSequenceNumber,
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
    const completedHistory: string[] = [];
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
      hasPendingBlocks: () => true,
    });

    expect(result).toHaveLength(2);
    expect(result[0].subjectName).toBe("Direito do Trabalho");
    expect(result[1].subjectName).toBe("Língua Portuguesa");
  });

  test("Teste 6 — ordem dos PDFs: PDF 4, PDF 5, PDF 8 pendentes -> Selecionar PDF 4", () => {
    const blocks = [
      { id: "b8", orderIndex: 1, material: { id: "mat-8", fileName: "Direito Administrativo 8.pdf" } },
      { id: "b5", orderIndex: 1, material: { id: "mat-5", fileName: "Direito Administrativo 5.pdf" } },
      { id: "b4", orderIndex: 1, material: { id: "mat-4", fileName: "Direito Administrativo 4.pdf" } },
    ];

    const sorted = sortPendingBlocksForSubject(blocks);
    expect(sorted[0].id).toBe("b4");
    expect(sorted[1].id).toBe("b5");
    expect(sorted[2].id).toBe("b8");
  });

  test("Teste 7 — ordem interna do PDF: PDF 4 com Bloco 1, 2, 3 pendentes -> Selecionar Bloco 1", () => {
    const blocks = [
      { id: "b3", orderIndex: 3, material: { id: "mat-4", fileName: "Direito Administrativo 4.pdf" } },
      { id: "b1", orderIndex: 1, material: { id: "mat-4", fileName: "Direito Administrativo 4.pdf" } },
      { id: "b2", orderIndex: 2, material: { id: "mat-4", fileName: "Direito Administrativo 4.pdf" } },
    ];

    const sorted = sortPendingBlocksForSubject(blocks);
    expect(sorted[0].id).toBe("b1");
    expect(sorted[1].id).toBe("b2");
    expect(sorted[2].id).toBe("b3");
  });

  test("Teste 8 — PDF 10 não vem antes do PDF 2 e PDF 9 vem antes de PDF 10", () => {
    const blocks = [
      { id: "b10", orderIndex: 1, material: { id: "mat-10", fileName: "Direito Administrativo 10.pdf" } },
      { id: "b9", orderIndex: 1, material: { id: "mat-9", fileName: "Direito Administrativo 9.pdf" } },
      { id: "b2", orderIndex: 1, material: { id: "mat-2", fileName: "Direito Administrativo 2.pdf" } },
      { id: "b1", orderIndex: 1, material: { id: "mat-1", fileName: "Direito Administrativo 1.pdf" } },
    ];

    const sorted = sortPendingBlocksForSubject(blocks);
    expect(sorted[0].id).toBe("b1");
    expect(sorted[1].id).toBe("b2");
    expect(sorted[2].id).toBe("b9");
    expect(sorted[3].id).toBe("b10");
  });

  test("Teste 9 — Bloco 2 de PDF 4 é selecionado antes do Bloco 1 de PDF 5", () => {
    const blocks = [
      { id: "b5-1", orderIndex: 1, material: { id: "mat-5", fileName: "Direito Administrativo 5.pdf" } },
      { id: "b4-3", orderIndex: 3, material: { id: "mat-4", fileName: "Direito Administrativo 4.pdf" } },
      { id: "b4-2", orderIndex: 2, material: { id: "mat-4", fileName: "Direito Administrativo 4.pdf" } },
    ];

    const sorted = sortPendingBlocksForSubject(blocks);
    expect(sorted[0].id).toBe("b4-2"); // Bloco 2 do PDF 4
    expect(sorted[1].id).toBe("b4-3"); // Bloco 3 do PDF 4
    expect(sorted[2].id).toBe("b5-1"); // Bloco 1 do PDF 5
  });

  test("Teste 10 — Extração direta de número sequencial didático de materiais", () => {
    expect(extractMaterialSequenceNumber("Direito Administrativo 1.pdf")).toBe(1);
    expect(extractMaterialSequenceNumber("Direito Administrativo 2.pdf")).toBe(2);
    expect(extractMaterialSequenceNumber("Direito Administrativo 10.pdf")).toBe(10);
    expect(extractMaterialSequenceNumber("Aula 04 - Direito do Trabalho")).toBe(4);
  });
});
