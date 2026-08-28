import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada.");
  const userId = gabriela.id;

  // Encontra os 5 materiais do CFC
  const cfcMaterials = await prisma.studyMaterial.findMany({
    where: {
      userId,
      OR: [
        { materialRole: "MAIN_MATERIAL" },
        { originalFileName: { contains: "Direito do Trabalho" } }
      ]
    },
    select: { id: true, originalFileName: true, materialRole: true }
  });

  const cfcMatIds = cfcMaterials.map(m => m.id);

  const cfcBlocks = await prisma.studyBlock.findMany({
    where: {
      userId,
      materialId: { in: cfcMatIds }
    },
    include: { subject: { select: { name: true } } }
  });

  console.log(`======================================================================`);
  console.log(`TOTAL DE BLOCOS ÂNCORA DO CFC (5 MATÉRIAS): ${cfcBlocks.length}`);
  console.log(`======================================================================\n`);

  let preCredited = 0;
  let flaggedUnconfirmed = 0;
  let flaggedConfirmed = 0;
  let neverStudied = 0;

  const neverStudiedBySubject: Record<string, number> = {};

  cfcBlocks.forEach(b => {
    const sName = b.subject?.name || "Sem Matéria";

    if (b.sourceV1BlockId !== null) {
      if (b.theoryStatus === "COMPLETED") {
        if (b.possiblyAlreadyStudied) {
          flaggedConfirmed++;
        } else {
          preCredited++;
        }
      } else if (b.possiblyAlreadyStudied) {
        flaggedUnconfirmed++;
      } else {
        preCredited++;
      }
    } else {
      if (b.theoryStatus === "NOT_STARTED") {
        neverStudied++;
        neverStudiedBySubject[sName] = (neverStudiedBySubject[sName] || 0) + 1;
      }
    }
  });

  console.log("--- ITEM 5: TABELA SOLICITADA DOS 58 BLOCOS ÂNCORA ---");
  console.log(`1. Blocos âncora no total: ${cfcBlocks.length}`);
  console.log(`2. Pré-creditados (já contam como estudados): ${preCredited}`);
  console.log(`3. Sinalizados como "provavelmente já estudei", ainda não confirmados: ${flaggedUnconfirmed}`);
  console.log(`4. Sinalizados já confirmados por ela desde 14/08: ${flaggedConfirmed}`);
  console.log(`5. Nunca estudados — o que sobra de verdade: ${neverStudied}`);

  console.log("\n6. Detalhamento dos 'Nunca estudados' por matéria:");
  console.table(neverStudiedBySubject);

  // Verificação dos 132 blocos do Estratégia
  const stratBlocks = await prisma.studyBlock.findMany({
    where: {
      userId,
      materialId: { notIn: cfcMatIds }
    },
    select: { id: true, theoryStatus: true }
  });

  const stratCompleted = stratBlocks.filter(b => b.theoryStatus === "COMPLETED").length;
  console.log(`\n--- ITEM 3: VERIFICAÇÃO DE PERDA DE DADOS ---`);
  console.log(`Total de blocos do histórico do Estratégia (não-CFC): ${stratBlocks.length}`);
  console.log(`Blocos com status COMPLETED no acervo antigo: ${stratCompleted} (esperado ~132)`);
}

main().finally(() => prisma.$disconnect());
