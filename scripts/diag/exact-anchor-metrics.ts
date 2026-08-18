import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("             APURAÇÃO EXATA DA TABELA DO ITEM 5                       ");
  console.log("======================================================================\n");

  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada.");
  const userId = gabriela.id;

  const anchorBlocks = await prisma.studyBlock.findMany({
    where: { userId, officialTopicId: { not: null } },
    include: { subject: { select: { name: true } } }
  });

  console.log(`Total de Blocos Âncora Encontrados: ${anchorBlocks.length}`);

  let preCredited = 0;
  let flaggedUnconfirmed = 0;
  let flaggedConfirmed = 0;
  let neverStudied = 0;

  const neverStudiedBySubject: Record<string, number> = {};

  anchorBlocks.forEach(b => {
    const sName = b.subject?.name || "Sem Matéria";

    if (b.sourceV1BlockId !== null) {
      if (b.theoryStatus === "COMPLETED") {
        if (b.possiblyAlreadyStudied) {
          flaggedConfirmed++;
        } else {
          preCredited++;
        }
      } else {
        flaggedUnconfirmed++;
      }
    } else {
      if (b.theoryStatus === "NOT_STARTED") {
        neverStudied++;
        neverStudiedBySubject[sName] = (neverStudiedBySubject[sName] || 0) + 1;
      }
    }
  });

  console.log("\n--- TABELA RESUMO (ITEM 5) ---");
  console.log(`1. Blocos âncora no total: ${anchorBlocks.length}`);
  console.log(`2. Pré-creditados (já contam como estudados): ${preCredited}`);
  console.log(`3. Sinalizados como 'provavelmente já estudei', ainda não confirmados: ${flaggedUnconfirmed}`);
  console.log(`4. Sinalizados já confirmados por ela desde 14/08: ${flaggedConfirmed}`);
  console.log(`5. Nunca estudados — o que sobra de verdade: ${neverStudied}`);

  console.log("\n6. Detalhamento dos 'Nunca estudados' por matéria:");
  console.table(neverStudiedBySubject);

  // Também verificar o acervo antigo de 132 blocos do Estratégia
  const e132 = await prisma.studyBlock.findMany({
    where: { userId, officialTopicId: null },
    select: { id: true, theoryStatus: true }
  });

  console.log(`\n--- VERIFICAÇÃO DO ACERVO DE 132 BLOCOS DO ESTRATÉGIA ---`);
  console.log(`Total de blocos sem officialTopicId (Estratégia/Históricos): ${e132.length}`);
  const e132Counts: Record<string, number> = {};
  e132.forEach(b => {
    e132Counts[b.theoryStatus] = (e132Counts[b.theoryStatus] || 0) + 1;
  });
  console.table(e132Counts);
}

main().finally(() => prisma.$disconnect());
