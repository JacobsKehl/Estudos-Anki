const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

async function main() {
  const subjects = await prisma.studySubject.findMany({ select: { name: true } });
  const blockCount = await prisma.studyBlock.count();
  const organized = await prisma.studyMaterial.findMany({
    where: { organizationStatus: "ORGANIZED" },
    select: { fileName: true, organizationStatus: true, _count: { select: { studyBlocks: true } } }
  });
  const errored = await prisma.studyMaterial.findMany({
    where: { organizationStatus: "ERROR" },
    select: { fileName: true, processingError: true }
  });
  const pending = await prisma.studyMaterial.count({
    where: { organizationStatus: { in: ["IMPORTED", "ANALYZING", "UPLOADED"] } }
  });

  console.log("=== STATUS DO BANCO ===");
  console.log("Matérias criadas:", subjects.map(s => s.name));
  console.log("Total de blocos criados:", blockCount);
  console.log("Materiais ORGANIZADOS:", organized.map(m => `${m.fileName} (${m._count.studyBlocks} blocos)`));
  console.log("Materiais com ERRO:", errored.map(m => `${m.fileName}: ${m.processingError}`));
  console.log("Materiais PENDENTES:", pending);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); });
