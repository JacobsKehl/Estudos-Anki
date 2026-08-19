/**
 * Teste do Relógio Simulado do Agendador D3
 * Validação rigorosa dos 5 casos de borda:
 * 1. Em D+6: aparece a revisão do estágio D+5
 * 2. Em D+16 (com D+5 concluído): aparece o estágio D+15
 * 3. Em D+31 (com D+15 concluído): aparece o estágio D+30
 * 4. Em D+32 (com D+30 concluído): o bloco NÃO aparece mais (saiu da fila)
 * 5. Fila com 5 vencidos e cota 3: entram os 3 mais antigos, os 2 restantes permanecem para o dia seguinte
 */

interface MockBlock {
  id: string;
  title: string;
  theoryCompletedAt: Date | null;
  review1dCompletedAt: Date | null;  // Stage 1: D+5
  review15dCompletedAt: Date | null; // Stage 2: D+15
  review30dCompletedAt: Date | null; // Stage 3: D+30
  estimatedStudyMinutes: number;
}

function computeD3Queue(blocks: MockBlock[], referenceDate: Date, maxQuota: number = 3) {
  const pendingReviews: { block: MockBlock; dueDate: Date; stageName: string }[] = [];

  for (const b of blocks) {
    const d0 = b.theoryCompletedAt;
    if (!d0) continue; // Filtro de D0 estrito

    const d0Date = new Date(d0);

    // Stage 1: D+5
    if (!b.review1dCompletedAt) {
      const d5 = new Date(d0Date);
      d5.setDate(d5.getDate() + 5);
      if (d5 <= referenceDate) {
        pendingReviews.push({ block: b, dueDate: d5, stageName: "D+5" });
        continue;
      }
    }

    // Stage 2: D+15 (Elegível após D+5 ser concluído)
    if (b.review1dCompletedAt && !b.review15dCompletedAt) {
      const d15 = new Date(d0Date);
      d15.setDate(d15.getDate() + 15);
      if (d15 <= referenceDate) {
        pendingReviews.push({ block: b, dueDate: d15, stageName: "D+15" });
        continue;
      }
    }

    // Stage 3: D+30 (Elegível após D+15 ser concluído)
    if (b.review15dCompletedAt && !b.review30dCompletedAt) {
      const d30 = new Date(d0Date);
      d30.setDate(d30.getDate() + 30);
      if (d30 <= referenceDate) {
        pendingReviews.push({ block: b, dueDate: d30, stageName: "D+30" });
        continue;
      }
    }
  }

  // Ordenar por data de vencimento mais antiga primeiro
  pendingReviews.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const allocated = pendingReviews.slice(0, maxQuota);
  const remaining = pendingReviews.slice(maxQuota);

  return { allocated, remaining, totalPending: pendingReviews.length };
}

function runTests() {
  console.log("======================================================================");
  console.log("      PROVA COMPLETA DOS 5 CASOS DE BORDA DO RELÓGIO SIMULADO D3     ");
  console.log("======================================================================\n");

  const d0 = new Date("2026-08-01T10:00:00Z");

  // CASO 1: Teste em D+6 (estágio D+5)
  {
    const d6 = new Date("2026-08-07T10:00:00Z"); // D0 + 6 dias
    const testBlock: MockBlock = {
      id: "b1",
      title: "Atos Administrativos - Conceito",
      theoryCompletedAt: d0,
      review1dCompletedAt: null,
      review15dCompletedAt: null,
      review30dCompletedAt: null,
      estimatedStudyMinutes: 35,
    };

    const res = computeD3Queue([testBlock], d6);
    console.log("📌 CASO 1 — Data D+6 (07/08):");
    console.log(` - Total pendente: ${res.totalPending}`);
    console.log(` - Alocados (${res.allocated.length}): ${res.allocated.map(a => `${a.block.title} [${a.stageName}]`).join(", ")}`);
    const pass = res.allocated.length === 1 && res.allocated[0].stageName === "D+5";
    console.log(` - Resultado: ${pass ? "PASSOU ✅ (Apareceu exatamente 1 revisão D+5)" : "FALHOU 🔴"}\n`);
  }

  // CASO 2: Teste em D+16 (estágio D+15, com D+5 já concluído)
  {
    const d16 = new Date("2026-08-17T10:00:00Z"); // D0 + 16 dias
    const testBlock: MockBlock = {
      id: "b1",
      title: "Atos Administrativos - Conceito",
      theoryCompletedAt: d0,
      review1dCompletedAt: new Date("2026-08-07T12:00:00Z"), // D+5 feito em D+6
      review15dCompletedAt: null,
      review30dCompletedAt: null,
      estimatedStudyMinutes: 35,
    };

    const res = computeD3Queue([testBlock], d16);
    console.log("📌 CASO 2 — Data D+16 (17/08):");
    console.log(` - Total pendente: ${res.totalPending}`);
    console.log(` - Alocados (${res.allocated.length}): ${res.allocated.map(a => `${a.block.title} [${a.stageName}]`).join(", ")}`);
    const pass = res.allocated.length === 1 && res.allocated[0].stageName === "D+15";
    console.log(` - Resultado: ${pass ? "PASSOU ✅ (Apareceu estágio D+15)" : "FALHOU 🔴"}\n`);
  }

  // CASO 3: Teste em D+31 (estágio D+30, com D+15 feito)
  {
    const d31 = new Date("2026-09-01T10:00:00Z"); // D0 (01/08) + 31 dias = 01/09
    const testBlock: MockBlock = {
      id: "b1",
      title: "Atos Administrativos - Conceito",
      theoryCompletedAt: d0,
      review1dCompletedAt: new Date("2026-08-07T12:00:00Z"),
      review15dCompletedAt: new Date("2026-08-17T12:00:00Z"),
      review30dCompletedAt: null,
      estimatedStudyMinutes: 35,
    };

    const res = computeD3Queue([testBlock], d31);
    console.log("📌 CASO 3 — Data D+31 (01/09):");
    console.log(` - Total pendente: ${res.totalPending}`);
    console.log(` - Alocados (${res.allocated.length}): ${res.allocated.map(a => `${a.block.title} [${a.stageName}]`).join(", ")}`);
    const pass = res.allocated.length === 1 && res.allocated[0].stageName === "D+30";
    console.log(` - Resultado: ${pass ? "PASSOU ✅ (Apareceu estágio D+30)" : "FALHOU 🔴"}\n`);
  }

  // CASO 4: Teste em D+32 (com D+30 concluído)
  {
    const d32 = new Date("2026-09-02T10:00:00Z"); // D0 + 32 dias
    const testBlock: MockBlock = {
      id: "b1",
      title: "Atos Administrativos - Conceito",
      theoryCompletedAt: d0,
      review1dCompletedAt: new Date("2026-08-07T12:00:00Z"),
      review15dCompletedAt: new Date("2026-08-17T12:00:00Z"),
      review30dCompletedAt: new Date("2026-09-01T12:00:00Z"),
      estimatedStudyMinutes: 35,
    };

    const res = computeD3Queue([testBlock], d32);
    console.log("📌 CASO 4 — Data D+32 (02/09):");
    console.log(` - Total pendente em fila: ${res.totalPending}`);
    const pass = res.totalPending === 0;
    console.log(` - Resultado: ${pass ? "PASSOU ✅ (Bloco saiu da fila para sempre)" : "FALHOU 🔴"}\n`);
  }

  // CASO 5: Fila com 5 vencidos e cota 3
  {
    const refDay = new Date("2026-08-10T10:00:00Z");
    const blocks5: MockBlock[] = [
      { id: "b1", title: "Bloco 1 (D0 = 01/08)", theoryCompletedAt: new Date("2026-08-01T10:00:00Z"), review1dCompletedAt: null, review15dCompletedAt: null, review30dCompletedAt: null, estimatedStudyMinutes: 30 },
      { id: "b2", title: "Bloco 2 (D0 = 02/08)", theoryCompletedAt: new Date("2026-08-02T10:00:00Z"), review1dCompletedAt: null, review15dCompletedAt: null, review30dCompletedAt: null, estimatedStudyMinutes: 30 },
      { id: "b3", title: "Bloco 3 (D0 = 03/08)", theoryCompletedAt: new Date("2026-08-03T10:00:00Z"), review1dCompletedAt: null, review15dCompletedAt: null, review30dCompletedAt: null, estimatedStudyMinutes: 30 },
      { id: "b4", title: "Bloco 4 (D0 = 04/08)", theoryCompletedAt: new Date("2026-08-04T10:00:00Z"), review1dCompletedAt: null, review15dCompletedAt: null, review30dCompletedAt: null, estimatedStudyMinutes: 30 },
      { id: "b5", title: "Bloco 5 (D0 = 05/08)", theoryCompletedAt: new Date("2026-08-05T10:00:00Z"), review1dCompletedAt: null, review15dCompletedAt: null, review30dCompletedAt: null, estimatedStudyMinutes: 30 },
    ];

    // Dia 1: Cota 3
    const day1 = computeD3Queue(blocks5, refDay, 3);
    console.log("📌 CASO 5 — Dia 1 (5 vencidos, Cota 3):");
    console.log(` - Total pendentes na fila: ${day1.totalPending}`);
    console.log(` - Alocados hoje (${day1.allocated.length}): ${day1.allocated.map(a => a.block.title).join(", ")}`);
    console.log(` - Restantes na fila (${day1.remaining.length}): ${day1.remaining.map(r => r.block.title).join(", ")}`);

    // Simula conclusão dos 3 alocados no Dia 1
    day1.allocated.forEach(a => {
      a.block.review1dCompletedAt = new Date("2026-08-10T15:00:00Z");
    });

    // Dia 2: Próximo dia (+1 dia)
    const nextDay = new Date("2026-08-11T10:00:00Z");
    const day2 = computeD3Queue(blocks5, nextDay, 3);
    console.log("📌 CASO 5 — Dia 2 (Dia seguinte):");
    console.log(` - Pendentes restantes no dia 2 (${day2.allocated.length}): ${day2.allocated.map(a => a.block.title).join(", ")}`);

    const pass = day1.allocated.length === 3 &&
                 day1.allocated[0].block.id === "b1" &&
                 day1.allocated[1].block.id === "b2" &&
                 day1.allocated[2].block.id === "b3" &&
                 day2.allocated.length === 2 &&
                 day2.allocated[0].block.id === "b4" &&
                 day2.allocated[1].block.id === "b5";

    console.log(` - Resultado: ${pass ? "PASSOU ✅ (Alocou os 3 mais antigos no dia 1 e os 2 restantes no dia 2)" : "FALHOU 🔴"}\n`);
  }
}

runTests();
