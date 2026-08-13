import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const gabriela = await prisma.user.findUnique({
    where: { email: "gabriela.furtado.p@gmail.com" },
  });

  if (!gabriela) {
    console.error("Gabriela (gabriela.furtado.p@gmail.com) não foi encontrada no banco.");
    process.exit(1);
  }

  const userId = gabriela.id;

  const subjects = await prisma.studySubject.findMany({
    where: { userId },
    select: { id: true, name: true, examWeight: true },
    orderBy: [{ examWeight: "desc" }, { name: "asc" }],
  });

  console.log("=======================================================================================");
  console.log(" SIMULAÇÃO DE IMPACTO NA COMPLITUDE: Estratégia alterado para SUPPORT_MATERIAL");
  console.log(" User: Gabriela Furtado (gabriela.furtado.p@gmail.com)");
  console.log("=======================================================================================\n");

  console.log(
    "MATÉRIA".padEnd(32) +
      " | " +
      "ATUAL (Total/Conc/%)".padEnd(22) +
      " | " +
      "SIMULADO (Total/Conc/%)".padEnd(24) +
      " | DELTA"
  );
  console.log("-".repeat(90));

  let globalTotalBefore = 0;
  let globalCompletedBefore = 0;
  let globalTotalAfter = 0;
  let globalCompletedAfter = 0;

  for (const s of subjects) {
    const blocks = await prisma.studyBlock.findMany({
      where: { subjectId: s.id, userId },
      include: { material: true },
    });

    // Estado Atual: exclui apenas o que JÁ É SUPPORT_MATERIAL hoje
    const blocksCurrent = blocks.filter((b) => b.material?.materialRole !== "SUPPORT_MATERIAL");
    const totalCurrent = blocksCurrent.length;
    const completedCurrent = blocksCurrent.filter((b) => b.theoryStatus === "COMPLETED").length;
    const pctCurrent = totalCurrent > 0 ? ((completedCurrent / totalCurrent) * 100).toFixed(1) : "0.0";

    // Estado Simulado: se provider === ESTRATEGIA (ou materialRole === SUPPORT_MATERIAL), exclui da teoria principal
    const blocksSimulated = blocks.filter((b) => {
      if (b.material?.materialRole === "SUPPORT_MATERIAL") return false;
      if (b.material?.provider === "ESTRATEGIA") return false;
      return true;
    });

    const totalSimulated = blocksSimulated.length;
    const completedSimulated = blocksSimulated.filter((b) => b.theoryStatus === "COMPLETED").length;
    const pctSimulated = totalSimulated > 0 ? ((completedSimulated / totalSimulated) * 100).toFixed(1) : "0.0";

    const deltaPct = (parseFloat(pctSimulated) - parseFloat(pctCurrent)).toFixed(1);

    globalTotalBefore += totalCurrent;
    globalCompletedBefore += completedCurrent;
    globalTotalAfter += totalSimulated;
    globalCompletedAfter += completedSimulated;

    console.log(
      s.name.padEnd(32) +
        " | " +
        `${totalCurrent} / ${completedCurrent} (${pctCurrent}%)`.padEnd(22) +
        " | " +
        `${totalSimulated} / ${completedSimulated} (${pctSimulated}%)`.padEnd(24) +
        " | " +
        (parseFloat(deltaPct) >= 0 ? `+${deltaPct}%` : `${deltaPct}%`)
    );
  }

  console.log("-".repeat(90));
  const globalPctBefore = globalTotalBefore > 0 ? ((globalCompletedBefore / globalTotalBefore) * 100).toFixed(1) : "0.0";
  const globalPctAfter = globalTotalAfter > 0 ? ((globalCompletedAfter / globalTotalAfter) * 100).toFixed(1) : "0.0";
  const globalDelta = (parseFloat(globalPctAfter) - parseFloat(globalPctBefore)).toFixed(1);

  console.log(
    "TOTAL GERAL".padEnd(32) +
      " | " +
      `${globalTotalBefore} / ${globalCompletedBefore} (${globalPctBefore}%)`.padEnd(22) +
      " | " +
      `${globalTotalAfter} / ${globalCompletedAfter} (${globalPctAfter}%)`.padEnd(24) +
      " | " +
      (parseFloat(globalDelta) >= 0 ? `+${globalDelta}%` : `${globalDelta}%`)
  );
  console.log("=======================================================================================");
}

main()
  .catch((e) => {
    console.error("Erro na simulação:", e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
