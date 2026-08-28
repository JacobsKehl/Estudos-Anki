import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("       INVESTIGAÇÃO C3: OS 44 FLASHCARDS CRIADOS APÓS O EXPORT        ");
  console.log("======================================================================\n");

  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada.");
  const userId = gabriela.id;

  const exportPath = path.join(process.cwd(), "tmp/export/flashcards-audit.jsonl");
  if (!fs.existsSync(exportPath)) throw new Error("Export original não encontrado em tmp/export/flashcards-audit.jsonl");

  const exportLines = fs.readFileSync(exportPath, "utf-8").trim().split("\n");
  const exportIds = new Set(exportLines.map(l => JSON.parse(l).id));

  console.log(`Total de cards no Export original: ${exportIds.size}`);

  const currentCards = await prisma.flashcard.findMany({
    where: { userId },
    include: { subject: { select: { name: true } } },
    orderBy: { createdAt: "asc" }
  });

  const newCards = currentCards.filter(c => !exportIds.has(c.id));
  console.log(`Total de cards novos criados após o export: ${newCards.length}\n`);

  if (newCards.length > 0) {
    const minCreated = newCards[0].createdAt;
    const maxCreated = newCards[newCards.length - 1].createdAt;

    console.log(`- Data do Primeiro Card Novo: ${minCreated.toISOString()}`);
    console.log(`- Data do Último Card Novo:    ${maxCreated.toISOString()}`);

    const bySubject: Record<string, number> = {};
    const byState: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    newCards.forEach(c => {
      const sName = c.subject?.name || "Sem Matéria";
      bySubject[sName] = (bySubject[sName] || 0) + 1;
      const stateKey = c.reviewState || "UNKNOWN";
      byState[stateKey] = (byState[stateKey] || 0) + 1;
      const src = c.studyBlockId ? "COM_STUDY_BLOCK" : "SEM_STUDY_BLOCK";
      bySource[src] = (bySource[src] || 0) + 1;
    });

    console.log("\nDistribuição dos 44 cards novos por Matéria:");
    console.table(bySubject);

    console.log("\nDistribuição por reviewState:");
    console.table(byState);

    console.log("\nDetalhamento dos primeiros 5 cards novos:");
    newCards.slice(0, 5).forEach(c => {
      console.log(` - ID: ${c.id} | CreatedAt: ${c.createdAt.toISOString()} | Matéria: '${c.subject?.name}' | Pergunta: "${c.question.substring(0, 45)}..."`);
    });
  }
}

main().finally(() => prisma.$disconnect());
