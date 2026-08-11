import { PrismaClient } from "@prisma/client";
import { generateSmartSchedule } from "@/lib/scheduler";

const prisma = new PrismaClient();

async function main() {
  const isApply = process.argv.includes("--apply");

  console.log("=== DIAGNÓSTICO E REORGANIZAÇÃO DO CRONOGRAMA DA GABRIELA ===");
  console.log(`Modo: ${isApply ? "EXECUÇÃO (--apply)" : "LEITURA / DIAGNÓSTICO (passar --apply para executar)"}`);

  const gabriela = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { contains: "gabriela", mode: "insensitive" } },
        { name: { contains: "gabriela", mode: "insensitive" } }
      ]
    },
    include: { preferences: true }
  });

  if (!gabriela) {
    console.error("❌ Usuário Gabriela não encontrado no banco de dados.");
    await prisma.$disconnect();
    return;
  }

  console.log(`\n1. Usuário: ${gabriela.name} (${gabriela.email}), ID: ${gabriela.id}`);
  console.log(`   Modo de agendamento: ${gabriela.preferences?.scheduleGenerationMode}`);

  // 2. Consultar matérias concluídas (histórico real)
  const completedTheory = await prisma.studyScheduleItem.findMany({
    where: {
      userId: gabriela.id,
      status: "COMPLETED",
      actionType: "THEORY",
    },
    include: { subject: true, studyBlock: { include: { material: true } } },
    orderBy: [{ completedAt: "asc" }, { scheduledDate: "asc" }],
  });

  console.log(`\n2. Matérias de Teoria efetivamente concluídas no histórico (${completedTheory.length} itens):`);
  completedTheory.forEach((item, idx) => {
    console.log(`   [${idx + 1}] ${item.subject?.name || "Sem Matéria"} | Bloco: ${item.studyBlock?.title || "N/A"} | Material: ${item.studyBlock?.material?.fileName || "N/A"}`);
  });

  // 3. Consultar cronograma ativo atual (antes)
  const currentActiveSchedule = await prisma.studySchedule.findFirst({
    where: { userId: gabriela.id, status: "ACTIVE" },
    include: {
      items: {
        include: { subject: true, studyBlock: { include: { material: true } } },
        orderBy: [{ dayNumber: "asc" }, { priorityScore: "desc" }]
      }
    }
  });

  if (currentActiveSchedule) {
    console.log(`\n3. Cronograma ATIVO antes da reorganização (ID=${currentActiveSchedule.id}):`);
    const theoryItems = currentActiveSchedule.items.filter(i => i.actionType === "THEORY");
    const byDay: Record<number, typeof theoryItems> = {};
    theoryItems.forEach(i => {
      const d = i.dayNumber || 1;
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(i);
    });

    Object.keys(byDay).slice(0, 5).forEach(day => {
      const dNum = parseInt(day, 10);
      const subs = byDay[dNum].map(i => i.subject?.name).join(", ");
      console.log(`   Dia ${dNum}: ${subs}`);
    });
  } else {
    console.log("\n3. Nenhum cronograma ACTIVE encontrado antes da reorganização.");
  }

  if (!isApply) {
    console.log("\n[READ-ONLY] Para reorganizar o cronograma da Gabriela com a nova regra, execute:");
    console.log("powershell -ExecutionPolicy Bypass -Command \"npx ts-node -r tsconfig-paths/register scripts/reorganize-gabriela-schedule.ts --apply\"");
    await prisma.$disconnect();
    return;
  }

  // 4. Executar reorganização controlada
  console.log("\n4. Executando reorganização do cronograma via generateSmartSchedule...");
  const result = await generateSmartSchedule(gabriela.id, {
    startDate: new Date(),
    dailyMinutes: gabriela.preferences?.dailyGoalMinutes || 120,
  });

  console.log(`✔ Cronograma gerado com sucesso! ID=${result.schedule?.id}, Itens=${result.itemsCount}`);

  // 5. Validar o resultado gerado (depois)
  const newSchedule = await prisma.studySchedule.findFirst({
    where: { userId: gabriela.id, status: "ACTIVE" },
    include: {
      items: {
        where: { actionType: "THEORY" },
        include: { subject: true, studyBlock: { include: { material: true } } },
        orderBy: [{ dayNumber: "asc" }, { priorityScore: "desc" }]
      }
    }
  });

  if (!newSchedule) {
    console.error("❌ Erro ao buscar o novo cronograma ativo.");
    await prisma.$disconnect();
    return;
  }

  console.log("\n5. VALIDAÇÃO DO RESULTADO GERADO (Primeiros 5 Dias de Estudo):");
  const newTheoryItems = newSchedule.items;
  const newByDay: Record<number, typeof newTheoryItems> = {};
  newTheoryItems.forEach(i => {
    const d = i.dayNumber || 1;
    if (!newByDay[d]) newByDay[d] = [];
    newByDay[d].push(i);
  });

  Object.keys(newByDay).slice(0, 5).forEach(day => {
    const dNum = parseInt(day, 10);
    const dayItems = newByDay[dNum];
    console.log(`\n   📅 Dia ${dNum} (Data: ${dayItems[0]?.scheduledDate?.toISOString().split("T")[0]}):`);
    dayItems.forEach((item, idx) => {
      console.log(`      Slot ${idx + 1}: ${item.subject?.name} | Bloco: "${item.studyBlock?.title}" | PDF: "${item.studyBlock?.material?.fileName}"`);
    });
  });

  console.log("\n=== REORGANIZAÇÃO DA GABRIELA CONCLUÍDA COM SUCESSO ===");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
