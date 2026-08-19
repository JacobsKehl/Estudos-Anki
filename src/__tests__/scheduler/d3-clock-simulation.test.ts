import { computePendingD3BlockReviews, D3BlockInput } from "@/lib/recommendations/adaptive-scheduler";

describe("D3 Spaced Repetition Block Review Queue (Clock Simulation)", () => {
  const d0 = new Date("2026-08-01T10:00:00Z");

  test("Caso 1: Em D+6 aparece 1 revisão do estágio D+5", () => {
    const d6 = new Date("2026-08-07T10:00:00Z"); // D0 + 6 dias
    const testBlock: D3BlockInput = {
      id: "b1",
      title: "Atos Administrativos - Conceito",
      theoryCompletedAt: d0,
      review1dCompletedAt: null,
      review15dCompletedAt: null,
      review30dCompletedAt: null,
      estimatedStudyMinutes: 35,
    };

    const res = computePendingD3BlockReviews([testBlock], d6, 3);
    expect(res.allPending.length).toBe(1);
    expect(res.topAllocated.length).toBe(1);
    expect(res.topAllocated[0].stageName).toBe("D+5");
    expect(res.topAllocated[0].block.id).toBe("b1");
  });

  test("Caso 2: Em D+16 aparece o estágio D+15 (com D+5 concluído)", () => {
    const d16 = new Date("2026-08-17T10:00:00Z"); // D0 + 16 dias
    const testBlock: D3BlockInput = {
      id: "b1",
      title: "Atos Administrativos - Conceito",
      theoryCompletedAt: d0,
      review1dCompletedAt: new Date("2026-08-07T12:00:00Z"), // D+5 feito em D+6
      review15dCompletedAt: null,
      review30dCompletedAt: null,
      estimatedStudyMinutes: 35,
    };

    const res = computePendingD3BlockReviews([testBlock], d16, 3);
    expect(res.allPending.length).toBe(1);
    expect(res.topAllocated[0].stageName).toBe("D+15");
  });

  test("Caso 3: Em D+31 aparece o estágio D+30 (com D+15 concluído)", () => {
    const d31 = new Date("2026-09-01T10:00:00Z"); // D0 + 31 dias
    const testBlock: D3BlockInput = {
      id: "b1",
      title: "Atos Administrativos - Conceito",
      theoryCompletedAt: d0,
      review1dCompletedAt: new Date("2026-08-07T12:00:00Z"),
      review15dCompletedAt: new Date("2026-08-17T12:00:00Z"),
      review30dCompletedAt: null,
      estimatedStudyMinutes: 35,
    };

    const res = computePendingD3BlockReviews([testBlock], d31, 3);
    expect(res.allPending.length).toBe(1);
    expect(res.topAllocated[0].stageName).toBe("D+30");
  });

  test("Caso 4: Em D+32 com D+30 concluído, o bloco sai da fila para sempre", () => {
    const d32 = new Date("2026-09-02T10:00:00Z"); // D0 + 32 dias
    const testBlock: D3BlockInput = {
      id: "b1",
      title: "Atos Administrativos - Conceito",
      theoryCompletedAt: d0,
      review1dCompletedAt: new Date("2026-08-07T12:00:00Z"),
      review15dCompletedAt: new Date("2026-08-17T12:00:00Z"),
      review30dCompletedAt: new Date("2026-09-01T12:00:00Z"),
      estimatedStudyMinutes: 35,
    };

    const res = computePendingD3BlockReviews([testBlock], d32, 3);
    expect(res.allPending.length).toBe(0);
    expect(res.topAllocated.length).toBe(0);
  });

  test("Caso 5: Fila com 5 vencidos e cota 3 -> aloca os 3 mais antigos no Dia 1 e os 2 restantes no Dia 2", () => {
    const refDay = new Date("2026-08-10T10:00:00Z");
    const blocks5: D3BlockInput[] = [
      { id: "b1", title: "Bloco 1 (D0 = 01/08)", theoryCompletedAt: new Date("2026-08-01T10:00:00Z"), review1dCompletedAt: null, review15dCompletedAt: null, review30dCompletedAt: null, estimatedStudyMinutes: 30 },
      { id: "b2", title: "Bloco 2 (D0 = 02/08)", theoryCompletedAt: new Date("2026-08-02T10:00:00Z"), review1dCompletedAt: null, review15dCompletedAt: null, review30dCompletedAt: null, estimatedStudyMinutes: 30 },
      { id: "b3", title: "Bloco 3 (D0 = 03/08)", theoryCompletedAt: new Date("2026-08-03T10:00:00Z"), review1dCompletedAt: null, review15dCompletedAt: null, review30dCompletedAt: null, estimatedStudyMinutes: 30 },
      { id: "b4", title: "Bloco 4 (D0 = 04/08)", theoryCompletedAt: new Date("2026-08-04T10:00:00Z"), review1dCompletedAt: null, review15dCompletedAt: null, review30dCompletedAt: null, estimatedStudyMinutes: 30 },
      { id: "b5", title: "Bloco 5 (D0 = 05/08)", theoryCompletedAt: new Date("2026-08-05T10:00:00Z"), review1dCompletedAt: null, review15dCompletedAt: null, review30dCompletedAt: null, estimatedStudyMinutes: 30 },
    ];

    // Dia 1: Cota 3
    const day1 = computePendingD3BlockReviews(blocks5, refDay, 3);
    expect(day1.allPending.length).toBe(5);
    expect(day1.topAllocated.length).toBe(3);
    expect(day1.topAllocated[0].block.id).toBe("b1");
    expect(day1.topAllocated[1].block.id).toBe("b2");
    expect(day1.topAllocated[2].block.id).toBe("b3");

    // Simula conclusão dos 3 alocados no Dia 1
    day1.topAllocated.forEach(a => {
      a.block.review1dCompletedAt = new Date("2026-08-10T15:00:00Z");
    });

    // Dia 2: Próximo dia (+1 dia)
    const nextDay = new Date("2026-08-11T10:00:00Z");
    const day2 = computePendingD3BlockReviews(blocks5, nextDay, 3);
    expect(day2.topAllocated.length).toBe(2);
    expect(day2.topAllocated[0].block.id).toBe("b4");
    expect(day2.topAllocated[1].block.id).toBe("b5");
  });
});
