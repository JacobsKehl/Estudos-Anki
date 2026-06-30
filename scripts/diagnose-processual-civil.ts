import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  try {
    const gabrielaEmail = "gabriela.furtado.p@gmail.com";
    console.log(`🔍 Buscando usuário Gabriela: ${gabrielaEmail}...`);
    const user = await prisma.user.findUnique({
      where: { email: gabrielaEmail },
      include: { preferences: true }
    });

    if (!user) {
      console.error("❌ Gabriela não encontrada!");
      return;
    }

    console.log(`👤 Usuário encontrado: ${user.name} (ID: ${user.id})`);
    console.log(`⚙️ Modo de geração: ${user.preferences?.scheduleGenerationMode}`);

    // 1. Listar todas as matérias e prioridades
    console.log("\n=== MATÉRIAS E PRIORIDADES DA GABRIELA ===");
    const subjects = await prisma.studySubject.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" }
    });

    for (const sub of subjects) {
      const pendingBlocksCount = await prisma.studyBlock.count({
        where: { userId: user.id, subjectId: sub.id, status: { not: "COMPLETED" } }
      });
      const completedBlocksCount = await prisma.studyBlock.count({
        where: { userId: user.id, subjectId: sub.id, status: "COMPLETED" }
      });
      console.log(`- ${sub.name}: Prioridade = ${sub.studyPriority} | Blocos Pendentes = ${pendingBlocksCount} | Blocos Concluídos = ${completedBlocksCount}`);
    }

    // 2. Analisar especificamente Direito Processual Civil
    console.log("\n=== ANÁLISE DE DIREITO PROCESSUAL CIVIL ===");
    const procCivil = subjects.find(s => s.name.toLowerCase().includes("processual civil"));
    if (!procCivil) {
      console.log("❌ Matéria 'Direito Processual Civil' não encontrada!");
    } else {
      console.log(`Matéria: ${procCivil.name} (ID: ${procCivil.id})`);
      console.log(`Prioridade ativa: ${procCivil.studyPriority}`);

      // Buscar todos os blocos desta matéria
      const blocks = await prisma.studyBlock.findMany({
        where: { userId: user.id, subjectId: procCivil.id },
        orderBy: { orderIndex: "asc" }
      });

      console.log(`Total de blocos cadastrados: ${blocks.length}`);
      if (blocks.length === 0) {
        console.log("⚠️ Nenhum bloco teórico cadastrado para esta matéria!");
      } else {
        blocks.forEach((block, idx) => {
          console.log(`  [${idx + 1}] Título: "${block.title}" | Status: ${block.status} | Ordem: ${block.orderIndex}`);
        });
      }
    }

    // 3. Buscar agendamentos de hoje
    console.log("\n=== ITENS AGENDADOS PARA HOJE (30/06/2026) ===");
    const startOfToday = new Date("2026-06-30T00:00:00-03:00");
    const endOfToday = new Date("2026-06-30T23:59:59.999-03:00");

    const todayItems = await prisma.studyScheduleItem.findMany({
      where: {
        userId: user.id,
        scheduledDate: {
          gte: startOfToday,
          lte: endOfToday
        }
      },
      include: {
        subject: { select: { name: true } },
        studyBlock: { select: { title: true } }
      },
      orderBy: { priorityScore: "desc" }
    });

    if (todayItems.length === 0) {
      console.log("Nenhum item agendado para hoje no banco de dados.");
    } else {
      todayItems.forEach(item => {
        console.log(`- Matéria: ${item.subject?.name} | Bloco: ${item.studyBlock?.title || "Revisão/Cards"} | Tipo: ${item.actionType} | Status: ${item.status}`);
      });
    }

  } catch (err: any) {
    console.error("❌ Erro ao executar diagnóstico:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
