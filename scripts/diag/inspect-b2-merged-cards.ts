import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("    INSPEÇÃO B2: RESPOSTAS LITERAIS DOS 4 CARDS MESCLADOS NO BANCO    ");
  console.log("======================================================================\n");

  const targetIds = [
    "cmponiiao000bl704hb5s0xe6", // Jus postulandi
    "cmqslvja4000djm043pzpt087", // Improbidade
    "cmq1jhju20003lb04fd2l4jba", // Honorários
    "cmqu3vtjv000jjs04kcz1o1bg"  // Licença nojo
  ];

  const cards = await prisma.flashcard.findMany({
    where: { id: { in: targetIds } },
    select: { id: true, question: true, answer: true }
  });

  cards.forEach((c, idx) => {
    console.log(`[Card ${idx + 1}/4] ID: ${c.id}`);
    console.log(`FRENTE: "${c.question}"`);
    console.log(`VERSO ATUAL LITERAL:\n"""\n${c.answer}\n"""\n`);
  });
}

main().finally(() => prisma.$disconnect());
