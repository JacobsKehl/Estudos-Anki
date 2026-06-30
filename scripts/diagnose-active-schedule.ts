import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  try {
    const gabrielaEmail = "gabriela.furtado.p@gmail.com";
    console.log(`🔍 Buscando usuário Gabriela...`);
    const user = await prisma.user.findUnique({
      where: { email: gabrielaEmail }
    });

    if (!user) {
      console.error("❌ Gabriela não encontrada!");
      return;
    }

    // 1. Buscar o cronograma ativo
    const activeSchedule = await prisma.studySchedule.findFirst({
      where: { userId: user.id, status: "ACTIVE" }
    });

    if (!activeSchedule) {
      console.error("❌ Nenhum cronograma ativo encontrado!");
      return;
    }

    console.log(`👤 Cronograma Ativo: "${activeSchedule.title}" (ID: ${activeSchedule.id}) | Data Início: ${activeSchedule.startDate.toISOString()}`);

    // 2. Buscar todos os itens do cronograma ativo ordenados por data
    const activeItems = await prisma.studyScheduleItem.findMany({
      where: {
        scheduleId: activeSchedule.id
      },
      include: {
        subject: { select: { name: true } },
        studyBlock: { select: { title: true } }
      },
      orderBy: [
        { scheduledDate: "asc" },
        { dayNumber: "asc" },
        { priorityScore: "desc" }
      ]
    });

    console.log(`\n=== LISTA COMPLETA DO CRONOGRAMA ATIVO (Total: ${activeItems.length} itens) ===`);
    
    // Agrupar por data
    const itemsByDate: Record<string, typeof activeItems> = {};
    activeItems.forEach(item => {
      if (!item.scheduledDate) return;
      const dateStr = item.scheduledDate.toISOString().split("T")[0];
      if (!itemsByDate[dateStr]) {
        itemsByDate[dateStr] = [];
      }
      itemsByDate[dateStr].push(item);
    });

    // Listar os dias ao redor de hoje (de 26/06 até 05/07)
    const dates = Object.keys(itemsByDate).sort();
    dates.forEach(dateStr => {
      console.log(`\n📅 Data: ${dateStr}`);
      itemsByDate[dateStr].forEach(item => {
        console.log(`  - [ID: ${item.id}] [Tipo: ${item.actionType}] [Status: ${item.status}] [Day: ${item.dayNumber}] Matéria: ${item.subject?.name} | Bloco: ${item.studyBlock?.title || "Revisão/Cards"}`);
      });
    });

  } catch (err: any) {
    console.error("❌ Erro:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
