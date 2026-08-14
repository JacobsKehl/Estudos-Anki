import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada");

  const notes = await prisma.studyBlockGapNote.findMany({
    include: {
      studyBlock: { select: { id: true, title: true, officialTopicId: true, subjectId: true } }
    }
  });

  console.log("======================================================================");
  console.log("             DIAGNÓSTICO DE REGISTROS StudyBlockGapNote               ");
  console.log("======================================================================\n");

  console.log(`Total de notas em banco: ${notes.length}`);

  const ready = notes.filter(n => n.status === "READY");
  const notRequired = notes.filter(n => n.status === "NOT_REQUIRED");
  const failed = notes.filter(n => n.status === "FAILED");
  const errored = notes.filter(n => n.errorMessage !== null);

  console.log(`- Status READY: ${ready.length}`);
  console.log(`- Status NOT_REQUIRED: ${notRequired.length}`);
  console.log(`- Status FAILED: ${failed.length}`);
  console.log(`- Linhas com errorMessage preenchido: ${errored.length}`);

  // Verificar se existe READY com gapItems vazio ou nulo
  const readyEmptyGaps = ready.filter(n => !n.gapItems || (Array.isArray(n.gapItems) && n.gapItems.length === 0));
  console.log(`- Linhas READY com gapItems vazio/nulo: ${readyEmptyGaps.length}\n`);

  console.log("======================================================================");
  console.log("LISTA DOS 13 BLOCOS NOT_REQUIRED:");
  console.log("======================================================================");
  notRequired.forEach((n, idx) => {
    console.log(`${idx + 1}. \`${n.studyBlockId.substring(0, 8)}\` - ${n.studyBlock.title} (Topic: ${n.studyBlock.officialTopicId})`);
  });
}

main().finally(() => prisma.$disconnect());
