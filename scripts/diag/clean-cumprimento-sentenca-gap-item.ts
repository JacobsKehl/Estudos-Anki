import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const note = await prisma.studyBlockGapNote.findFirst({
    where: { studyBlockId: "cmss35x63003fiyaov5894md1" }
  });

  if (!note || !Array.isArray(note.gapItems)) {
    throw new Error("Nota de Cumprimento da Sentença não encontrada ou sem gapItems");
  }

  const items = note.gapItems as string[];
  console.log("======================================================================");
  console.log("ITEMS ORIGINAIS DE CUMPRIMENTO DA SENTENÇA:");
  console.log("======================================================================\n");
  items.forEach((it, idx) => console.log(`${idx + 1}. ${it}`));

  const cleanedItems = items.filter(it => !it.includes("489"));

  console.log("\n======================================================================");
  console.log("ITEMS APÓS REMOÇÃO DO ART. 489:");
  console.log("======================================================================\n");
  cleanedItems.forEach((it, idx) => console.log(`${idx + 1}. ${it}`));

  await prisma.studyBlockGapNote.update({
    where: { id: note.id },
    data: { gapItems: cleanedItems }
  });

  console.log("\n✅ UPDATE realizado com sucesso em banco de dados no registro StudyBlockGapNote!");
}

main().finally(() => prisma.$disconnect());
