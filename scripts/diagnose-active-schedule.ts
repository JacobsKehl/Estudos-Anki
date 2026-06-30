import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  try {
    const gabrielaEmail = "gabriela.furtado.p@gmail.com";
    const user = await prisma.user.findUnique({
      where: { email: gabrielaEmail }
    });

    if (!user) {
      console.error("❌ Gabriela não encontrada!");
      return;
    }

    const activeSchedule = await prisma.studySchedule.findFirst({
      where: { userId: user.id, status: "ACTIVE" }
    });

    if (!activeSchedule) {
      console.error("❌ Nenhum cronograma ativo encontrado!");
      return;
    }

    console.log(`👤 Cronograma Ativo: ID ${activeSchedule.id}`);

    // Buscar todos os itens do tipo THEORY do cronograma ativo ordenados por dayNumber
    const theoryItems = await prisma.studyScheduleItem.findMany({
      where: {
        scheduleId: activeSchedule.id,
        actionType: "THEORY"
      },
      include: {
        subject: { select: { name: true } },
        studyBlock: { select: { title: true } }
      },
      orderBy: { dayNumber: "asc" }
    });

    console.log("\n=== ITENS DE TEORIA POR DIA DE ESTUDO (dayNumber) ===");
    
    // Agrupar por dayNumber
    const itemsByDay: Record<number, typeof theoryItems> = {};
    theoryItems.forEach(item => {
      if (item.dayNumber === null || item.dayNumber === undefined) return;
      if (!itemsByDay[item.dayNumber]) {
        itemsByDay[item.dayNumber] = [];
      }
      itemsByDay[item.dayNumber].push(item);
    });

    const days = Object.keys(itemsByDay).map(Number).sort((a, b) => a - b);
    days.forEach(day => {
      console.log(`\n📆 Estudo Day ${day}:`);
      itemsByDay[day].forEach(item => {
        console.log(`  - [ID: ${item.id}] [Date: ${item.scheduledDate?.toISOString().split('T')[0]}] [Status: ${item.status}] Matéria: ${item.subject?.name} | Bloco: ${item.studyBlock?.title}`);
      });
    });

  } catch (err: any) {
    console.error("❌ Erro:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
