import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const gabriela = await prisma.user.findUnique({
    where: { email: "gabriela.furtado.p@gmail.com" },
  });

  if (!gabriela) {
    console.error("Gabriela não encontrada!");
    process.exit(1);
  }

  const userId = gabriela.id;
  const now = new Date();
  const next30Days = new Date();
  next30Days.setDate(now.getDate() + 30);

  console.log("=======================================================================");
  console.log("  AUDITORIA SRS DA GABRIELA: FLASHCARDS COM REVISÃO NOS PRÓXIMOS 30 DIAS");
  console.log(`  Data Base: ${now.toISOString().split("T")[0]} | Janela: até ${next30Days.toISOString().split("T")[0]}`);
  console.log("=======================================================================\n");

  const cardsIn30Days = await prisma.flashcard.findMany({
    where: {
      userId,
      nextReviewAt: {
        lte: next30Days,
      },
    },
    include: {
      subject: true,
    },
  });

  const cardsOverdueOrToday = cardsIn30Days.filter(c => c.nextReviewAt && c.nextReviewAt <= now);
  const cardsFuture30 = cardsIn30Days.filter(c => c.nextReviewAt && c.nextReviewAt > now);

  const totalCardsGabriela = await prisma.flashcard.count({ where: { userId } });

  console.log(`TOTAL FLASHCARDS DA GABRIELA NO BANCO: ${totalCardsGabriela}`);
  console.log(`TOTAL CARDS COM REVISÃO AGENDADA NOS PRÓXIMOS 30 DIAS: ${cardsIn30Days.length}`);
  console.log(` - Vencidos/Para Hoje (nextReviewAt <= Hoje): ${cardsOverdueOrToday.length}`);
  console.log(` - Vencem nos Próximos 1 a 30 dias:              ${cardsFuture30.length}\n`);

  // Agrupamento por Matéria
  const countBySubject: Record<string, { totalIn30: number; overdue: number; future: number; totalSubjectInDb: number; schedulingStatus: string }> = {};

  const subjects = await prisma.studySubject.findMany({ where: { userId } });

  for (const s of subjects) {
    const totalSub = await prisma.flashcard.count({ where: { userId, subjectId: s.id } });
    if (totalSub > 0) {
      countBySubject[s.name] = {
        totalIn30: 0,
        overdue: 0,
        future: 0,
        totalSubjectInDb: totalSub,
        schedulingStatus: s.schedulingStatus,
      };
    }
  }

  for (const card of cardsIn30Days) {
    const subName = card.subject?.name || "Sem Matéria";
    if (!countBySubject[subName]) {
      countBySubject[subName] = { totalIn30: 0, overdue: 0, future: 0, totalSubjectInDb: 0, schedulingStatus: "N/A" };
    }
    countBySubject[subName].totalIn30++;
    if (card.nextReviewAt && card.nextReviewAt <= now) {
      countBySubject[subName].overdue++;
    } else {
      countBySubject[subName].future++;
    }
  }

  console.log("--- DISTRIBUIÇÃO SRS NOS PRÓXIMOS 30 DIAS POR MATÉRIA ---");
  console.log(
    "Matéria".padEnd(32) +
    "Status".padEnd(12) +
    "Revisão 30d".padEnd(14) +
    "Hoje/Vencidos".padEnd(16) +
    "Futuros (1-30d)".padEnd(16) +
    "Total no Banco"
  );
  console.log("-".repeat(102));

  let sum30d = 0;
  let sumOverdue = 0;
  let sumFuture = 0;
  let sumDb = 0;

  for (const [subName, info] of Object.entries(countBySubject)) {
    sum30d += info.totalIn30;
    sumOverdue += info.overdue;
    sumFuture += info.future;
    sumDb += info.totalSubjectInDb;

    console.log(
      subName.padEnd(32) +
      info.schedulingStatus.padEnd(12) +
      String(info.totalIn30).padEnd(14) +
      String(info.overdue).padEnd(16) +
      String(info.future).padEnd(16) +
      String(info.totalSubjectInDb)
    );
  }

  console.log("-".repeat(102));
  console.log(
    "SOMA TOTAL DA GABRIELA".padEnd(44) +
    String(sum30d).padEnd(14) +
    String(sumOverdue).padEnd(16) +
    String(sumFuture).padEnd(16) +
    String(sumDb)
  );

  console.log(`\nVERIFICAÇÃO DE MATÉRIAS PAUSADAS/ARQUIVADAS:`);
  console.log(` - Língua Portuguesa (DEFERRED): ${countBySubject["Língua Portuguesa"]?.totalIn30 || 0} cards agendados SRS nos próximos 30d (de ${countBySubject["Língua Portuguesa"]?.totalSubjectInDb || 0} totais no banco)`);
  console.log(` - Direito Civil (ARCHIVED):    ${countBySubject["Direito Civil"]?.totalIn30 || 0} cards agendados SRS nos próximos 30d (de ${countBySubject["Direito Civil"]?.totalSubjectInDb || 0} totais no banco)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
