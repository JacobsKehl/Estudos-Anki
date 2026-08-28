import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("     PROVA EMPÍRICA DOS 28 BLOCOS INÉDITOS DA GABRIELA POR MATÉRIA    ");
  console.log("======================================================================\n");

  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada.");
  const userId = gabriela.id;

  const targetDuplicateIds = [
    "cmsxk52in0001jm04xbpimqk0",
    "cmsxk52jt0003jm04kuwpuum4",
    "cmsxk52kg0005jm04owcpff4e",
    "cmsxk52l10007jm04g6oxglkd",
    "cmsxk52ln0009jm04dl3ssbrs"
  ];

  const cfcFileNames = [
    "1 - Direito Administrativo_compressed.pdf",
    "3 - Direito Constitucional_compressed.pdf",
    "3 - Direito Constitucional.pdf",
    "Direito Processual Civil_compressed.pdf",
    "4 - Direito Processual do Trabalho.pdf",
    "2 - Direito do Trabalho.pdf"
  ];

  // Buscar todos os 58 blocos âncora do F1 (sem os 5 duplicados)
  const cfcBlocks = await prisma.studyBlock.findMany({
    where: {
      userId,
      material: {
        originalFileName: { in: cfcFileNames }
      },
      id: { notIn: targetDuplicateIds }
    },
    include: {
      subject: { select: { name: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  console.log(`Total de blocos âncora do F1 (sem os 5 duplicados): ${cfcBlocks.length}\n`);

  const breakdown: Record<string, { preCredited: number; flagged: number; ineditosCompleted: number; ineditosEligible: number; total: number }> = {};

  cfcBlocks.forEach(b => {
    const sName = b.subject.name;
    if (!breakdown[sName]) {
      breakdown[sName] = { preCredited: 0, flagged: 0, ineditosCompleted: 0, ineditosEligible: 0, total: 0 };
    }

    breakdown[sName].total++;

    if (b.sourceV1BlockId !== null) {
      breakdown[sName].preCredited++;
    } else if (b.possiblyAlreadyStudied) {
      breakdown[sName].flagged++;
    } else if (b.theoryStatus === "COMPLETED") {
      breakdown[sName].ineditosCompleted++;
    } else {
      breakdown[sName].ineditosEligible++;
    }
  });

  console.log("--- TABELA CONSOLIDADA DOS 58 BLOCOS DO F1 POR MATÉRIA ---");
  console.table(Object.entries(breakdown).map(([subject, data]) => ({
    matéria: subject,
    "pré-creditados (F1)": data.preCredited,
    "sinalizados (F1)": data.flagged,
    "lidos por ela": data.ineditosCompleted,
    "INÉDITOS ELEGÍVEIS (28)": data.ineditosEligible,
    "TOTAL MATÉRIA": data.total
  })));

  const totalIneditos = Object.values(breakdown).reduce((acc, cur) => acc + cur.ineditosEligible, 0);
  const totalGeral = Object.values(breakdown).reduce((acc, cur) => acc + cur.total, 0);

  console.log(`\nSOMA DOS BLOCOS INÉDITOS ELEGÍVEIS: ${totalIneditos}`);
  console.log(`SOMA TOTAL DOS BLOCOS ÂNCORA DO F1:  ${totalGeral}`);
  console.log(`\nBate com os 28 inéditos: ${totalIneditos === 28 ? "SIM ✅" : "NÃO ❌"}`);
  console.log(`Bate com os 58 do F1:    ${totalGeral === 58 ? "SIM ✅" : "NÃO ❌"}`);
}

main().finally(() => prisma.$disconnect());
