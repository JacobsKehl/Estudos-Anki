import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("        DESATIVAÇÃO DOS 5 BLOCOS DUPLICADOS DE DIREITO DO TRABALHO    ");
  console.log("======================================================================\n");

  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada.");
  const userId = gabriela.id;

  const targetIds = [
    "cmsxk52in0001jm04xbpimqk0",
    "cmsxk52jt0003jm04kuwpuum4",
    "cmsxk52kg0005jm04owcpff4e",
    "cmsxk52l10007jm04g6oxglkd",
    "cmsxk52ln0009jm04dl3ssbrs"
  ];

  console.log(`Desativando os 5 blocos duplicados de 17/08...`);

  const updateRes = await prisma.studyBlock.updateMany({
    where: {
      userId,
      id: { in: targetIds }
    },
    data: {
      theoryStatus: "COMPLETED",
      theoryCompletedAt: new Date(),
      description: "DESATIVADO_DUPLICADO | Re-processamento sobreposto de 17/08/2026"
    }
  });

  console.log(`✅ ${updateRes.count} blocos atualizados para theoryStatus = 'COMPLETED'.\n`);

  // ------------------------------------------------------------------
  // CONTAGEM DOS BLOCOS INÉDITOS ELEGÍVEIS (28)
  // ------------------------------------------------------------------
  console.log("======================================================================");
  console.log("CONFERÊNCIA DOS BLOCOS INÉDITOS ELEGÍVEIS PÓS-DESATIVAÇÃO (28)");
  console.log("======================================================================\n");

  const eligibleBlocks = await prisma.studyBlock.findMany({
    where: {
      userId,
      theoryStatus: { not: "COMPLETED" },
      sourceV1BlockId: null,
      possiblyAlreadyStudied: false,
      material: {
        materialRole: "MAIN_MATERIAL"
      }
    },
    include: {
      subject: { select: { name: true } }
    }
  });

  const countsPerSubject: Record<string, number> = {};
  eligibleBlocks.forEach(b => {
    const sName = b.subject.name;
    countsPerSubject[sName] = (countsPerSubject[sName] || 0) + 1;
  });

  console.log("--- CONTAGEM DE BLOCOS INÉDITOS POR MATÉRIA ---");
  console.table(countsPerSubject);

  const totalEligible = eligibleBlocks.length;
  console.log(`\nTOTAL DE BLOCOS INÉDITOS ELEGÍVEIS: ${totalEligible}`);
  console.log(`Bate exatamente com os 28 esperados: ${totalEligible === 28 ? "SIM ✅" : "NÃO ❌"}`);

  // ------------------------------------------------------------------
  // RE-CHECK DAS CONTAS GLOBAIS DOS 58 BLOCOS DO F1
  // ------------------------------------------------------------------
  const allCfcBlocks = await prisma.studyBlock.findMany({
    where: {
      userId,
      material: { materialRole: "MAIN_MATERIAL" }
    }
  });

  const preCredited = allCfcBlocks.filter(b => b.sourceV1BlockId !== null).length;
  const flaggedPending = allCfcBlocks.filter(b => b.sourceV1BlockId === null && b.possiblyAlreadyStudied === true && b.theoryStatus !== "COMPLETED").length;
  const flaggedConfirmed = allCfcBlocks.filter(b => b.sourceV1BlockId === null && b.possiblyAlreadyStudied === true && b.theoryStatus === "COMPLETED").length;
  const ineditosEligible = allCfcBlocks.filter(b => b.sourceV1BlockId === null && b.possiblyAlreadyStudied === false && b.theoryStatus !== "COMPLETED").length;
  const ineditosCompleted = allCfcBlocks.filter(b => b.sourceV1BlockId === null && b.possiblyAlreadyStudied === false && b.theoryStatus === "COMPLETED" && !targetIds.includes(b.id)).length;

  console.log("\n--- EQUAÇÃO DE FECHAMENTO DO F1 ---");
  console.log(`- Pré-creditados pelo Histórico (F1): ${preCredited}`);
  console.log(`- Sinalizados Pendentes de Confirmação: ${flaggedPending}`);
  console.log(`- Sinalizados Confirmados pela Gabriela: ${flaggedConfirmed}`);
  console.log(`- Inéditos Elegíveis para Leitura:    ${ineditosEligible}`);
  console.log(`- Inéditos Lidos pela Gabriela:        ${ineditosCompleted}`);
  const totalEquacao = preCredited + flaggedPending + flaggedConfirmed + ineditosEligible + ineditosCompleted;
  console.log(`\nSoma Total: ${preCredited} + ${flaggedPending} + ${flaggedConfirmed} + ${ineditosEligible} + ${ineditosCompleted} = ${totalEquacao}`);
  console.log(`Fecha exatamente em 58 blocos âncora: ${totalEquacao === 58 ? "SIM ✅" : "NÃO ❌"}`);
}

main().finally(() => prisma.$disconnect());
