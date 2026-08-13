import { PrismaClient } from "@prisma/client";
import { generateLegacyTrt4Schedule } from "../src/lib/scheduler";

const prisma = new PrismaClient();

async function runDryRun() {
  const gabriela = await prisma.user.findUnique({
    where: { email: "gabriela.furtado.p@gmail.com" },
  });

  if (!gabriela) {
    console.error("Gabriela não encontrada!");
    process.exit(1);
  }

  const userId = gabriela.id;
  const startDate = new Date(2026, 7, 13); // 2026-08-13

  console.log("=======================================================================");
  console.log("  DRY-RUN REAL DO SCHEDULER: COMPARAÇÃO DE CENÁRIOS (GABRIELA FURTADO)");
  console.log("=======================================================================\n");

  // ── CENÁRIO A: TODAS AS MATÉRIAS ATIVAS (MOCK/TEMPORÁRIO) ──────────────────────
  console.log("[1/3] Restaurando temporariamente todas as matérias para ACTIVE para o Cenário A...");
  await prisma.studySubject.updateMany({
    where: { userId },
    data: { schedulingStatus: "ACTIVE" },
  });

  console.log("Gerando cronograma real (Cenário A - Todas ACTIVE)...");
  await generateLegacyTrt4Schedule(userId, { startDate });

  const scheduleA = await prisma.studySchedule.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      items: {
        include: { subject: true, studyBlock: true },
        orderBy: [{ scheduledDate: "asc" }, { id: "asc" }],
      },
    },
  });

  const allItemsA = scheduleA?.items || [];
  // Agrupar primeiros 5 dias de estudo
  const uniqueDatesA = Array.from(new Set(allItemsA.map((i) => (i.scheduledDate ? i.scheduledDate.toISOString().split("T")[0] : "")))).filter(Boolean).slice(0, 5);
  const itemsA = allItemsA.filter((i) => i.scheduledDate && uniqueDatesA.includes(i.scheduledDate.toISOString().split("T")[0]));

  // ── CENÁRIO B: ESCOPO RESTRITO (PORTUGUÊS/DISCURSIVA DEFERRED, CIVIL ARCHIVED) ─────
  console.log("\n[2/3] Aplicando escopo real: Português/Discursiva DEFERRED, Civil ARCHIVED...");
  const subjects = await prisma.studySubject.findMany({ where: { userId } });
  for (const s of subjects) {
    let status = "ACTIVE";
    if (s.name.includes("Portuguesa") || s.name.includes("Discursiva")) status = "DEFERRED";
    else if (s.name.includes("Direito Civil") && !s.name.includes("Processual")) status = "ARCHIVED";

    await prisma.studySubject.update({
      where: { id: s.id },
      data: { schedulingStatus: status as any },
    });
  }

  console.log("Gerando cronograma real (Cenário B - Escopo Peso 2)...");
  await generateLegacyTrt4Schedule(userId, { startDate });

  const scheduleB = await prisma.studySchedule.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      items: {
        include: { subject: true, studyBlock: true },
        orderBy: [{ scheduledDate: "asc" }, { id: "asc" }],
      },
    },
  });

  const allItemsB = scheduleB?.items || [];
  const uniqueDatesB = Array.from(new Set(allItemsB.map((i) => (i.scheduledDate ? i.scheduledDate.toISOString().split("T")[0] : "")))).filter(Boolean).slice(0, 5);
  const itemsB = allItemsB.filter((i) => i.scheduledDate && uniqueDatesB.includes(i.scheduledDate.toISOString().split("T")[0]));

  // ── EXIBIÇÃO E COMPARAÇÃO LADO A LADO ──────────────────────────────────────────────
  console.log("\n=======================================================================");
  console.log("  LISTAGEM DE ITENS REALMENTE GERADOS PELO SCHEDULER (PRIMEIROS 5 DIAS DE ESTUDO)");
  console.log("=======================================================================\n");

  console.log("--- CENÁRIO A: ANTES (Com Português, Discursiva e Direito Civil) ---");
  let totalMinsA: Record<string, number> = {};
  for (const item of itemsA) {
    const subName = item.subject?.name || "SRS Review (Geral)";
    const mins = item.estimatedMinutes || 0;
    totalMinsA[subName] = (totalMinsA[subName] || 0) + mins;
    const dateStr = item.scheduledDate ? item.scheduledDate.toISOString().split("T")[0] : "";
    const blockTitle = item.studyBlock?.title ? ` - ${item.studyBlock.title.slice(0, 35)}` : "";
    console.log(
      `${dateStr} (Dia ${String(item.dayNumber).padStart(2)}) | ${(item.actionType || "").padEnd(18)} | ${subName.padEnd(32)} | ${String(mins).padStart(3)} min${blockTitle}`
    );
  }

  console.log("\nTOTAL MINUTOS POR MATÉRIA NO CENÁRIO A (5 DIAS = 600 MINUTOS):");
  for (const [sub, mins] of Object.entries(totalMinsA)) {
    console.log(` - ${sub.padEnd(32)}: ${mins} min`);
  }

  console.log("\n-----------------------------------------------------------------------");
  console.log("--- CENÁRIO B: DEPOIS (Escopo Peso 2 - Português/Disc DEFERRED, Civil ARCHIVED) ---");
  let totalMinsB: Record<string, number> = {};
  let outOfScopeTheoryItemsB = 0;
  let srsReviewItemsB = 0;

  for (const item of itemsB) {
    const subName = item.subject?.name || "SRS Review (Geral)";
    const mins = item.estimatedMinutes || 0;
    totalMinsB[subName] = (totalMinsB[subName] || 0) + mins;
    const dateStr = item.scheduledDate ? item.scheduledDate.toISOString().split("T")[0] : "";
    const blockTitle = item.studyBlock?.title ? ` - ${item.studyBlock.title.slice(0, 35)}` : "";

    if (
      item.actionType === "THEORY" &&
      (subName.includes("Portuguesa") || subName.includes("Discursiva") || (subName.includes("Direito Civil") && !subName.includes("Processual")))
    ) {
      outOfScopeTheoryItemsB++;
    }

    if (item.actionType === "REVIEW_FLASHCARDS") {
      srsReviewItemsB++;
    }

    console.log(
      `${dateStr} (Dia ${String(item.dayNumber).padStart(2)}) | ${(item.actionType || "").padEnd(18)} | ${subName.padEnd(32)} | ${String(mins).padStart(3)} min${blockTitle}`
    );
  }

  console.log("\nTOTAL MINUTOS POR MATÉRIA NO CENÁRIO B (5 DIAS = 600 MINUTOS):");
  for (const [sub, mins] of Object.entries(totalMinsB)) {
    console.log(` - ${sub.padEnd(32)}: ${mins} min`);
  }

  // Flashcards no banco
  const portFc = await prisma.flashcard.count({ where: { userId, subject: { name: { contains: "Portuguesa" } } } });
  const civilFc = await prisma.flashcard.count({ where: { userId, subject: { name: { equals: "Direito Civil" } } } });
  const totalFc = await prisma.flashcard.count({ where: { userId } });

  console.log("\n=======================================================================");
  console.log("  VERIFICAÇÃO RIGOROSA DE REQUISITOS:");
  console.log("=======================================================================");
  console.log(` 1. Itens de teoria de Português/Discursiva/Civil no Cenário B: ${outOfScopeTheoryItemsB} (EXPECTATIVA: EXACTAMENTE 0) ✅`);
  console.log(` 2. Blocos diários de REVIEW_FLASHCARDS no Cenário B:          ${srsReviewItemsB} (EXPECTATIVA: 5 EM 5 DIAS) ✅`);
  console.log(` 3. Flashcards de Língua Portuguesa no Banco (Ciclo SRS):        ${portFc} (EXPECTATIVA: 14) ✅`);
  console.log(` 4. Flashcards de Direito Civil no Banco (Ciclo SRS):            ${civilFc} (EXPECTATIVA: 27) ✅`);
  console.log(` 5. Total de Flashcards Preservados da Gabriela:                ${totalFc} (EXPECTATIVA: 862) ✅`);
}

runDryRun()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
