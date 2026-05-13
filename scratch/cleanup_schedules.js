const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

async function main() {
  // Ver quantos cronogramas existem
  const schedules = await prisma.studySchedule.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, createdAt: true, _count: { select: { items: true } } }
  });

  console.log(`Total de cronogramas: ${schedules.length}`);
  schedules.forEach((s, i) => {
    console.log(`  ${i + 1}. [${s.status}] "${s.title}" - ${s._count.items} itens - ${s.createdAt.toISOString()}`);
  });

  if (schedules.length <= 1) {
    console.log("Nenhuma duplicata encontrada.");
    return;
  }

  // Manter apenas o mais recente, arquivar os demais
  const [latest, ...older] = schedules;
  const oldIds = older.map(s => s.id);

  await prisma.studySchedule.updateMany({
    where: { id: { in: oldIds } },
    data: { status: "ARCHIVED" }
  });

  console.log(`\nArquivados ${older.length} cronograma(s) antigos. Mantido: "${latest.title}" com ${latest._count.items} itens.`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); });
