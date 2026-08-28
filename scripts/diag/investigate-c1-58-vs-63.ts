import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("    INVESTIGAÇÃO C1: OS 63 BLOCOS ÂNCORA E OS +5 DE DIREITO DO TRABALHO");
  console.log("======================================================================\n");

  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada.");
  const userId = gabriela.id;

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
    where: { userId, materialId: { in: cfcMatIds } },
    include: {
      subject: { select: { name: true } },
      material: { select: { originalFileName: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  console.log(`Total de blocos nos 5 materiais do CFC: ${cfcBlocks.length}\n`);

  // Agrupa por matéria e ordena por createdAt
  const bySubject: Record<string, any[]> = {};
  cfcBlocks.forEach(b => {
    const sName = b.subject?.name || "Sem Matéria";
    if (!bySubject[sName]) bySubject[sName] = [];
    bySubject[sName].push(b);
  });

  console.log("Contagem de blocos por matéria nos 5 PDFs do CFC:");
  Object.keys(bySubject).forEach(sName => {
    console.log(` - ${sName}: ${bySubject[sName].length} blocos`);
  });

  console.log("\n--- DETALHAMENTO DOS 18 BLOCOS DE DIREITO DO TRABALHO ---");
  const trabalhoBlocks = bySubject["Direito do Trabalho"] || [];
  trabalhoBlocks.forEach((b, idx) => {
    console.log(`[${idx + 1}] ID: ${b.id} | CreatedAt: ${b.createdAt.toISOString()} | Title: '${b.title}' | sourceV1: ${b.sourceV1BlockId} | status: ${b.theoryStatus} | possiblyAlreadyStudied: ${b.possiblyAlreadyStudied}`);
  });

  console.log("\n--- IDENTIFICAÇÃO DOS 2 BLOCOS FORA DAS 4 CATEGORIAS ---");
  const unclassified: any[] = [];
  cfcBlocks.forEach(b => {
    const isPreCredited = b.sourceV1BlockId !== null && b.theoryStatus === "COMPLETED" && !b.possiblyAlreadyStudied;
    const isFlaggedUnconfirmed = b.sourceV1BlockId !== null && b.theoryStatus === "NOT_STARTED" && b.possiblyAlreadyStudied;
    const isFlaggedConfirmed = b.sourceV1BlockId !== null && b.theoryStatus === "COMPLETED" && b.possiblyAlreadyStudied;
    const isNeverStudied = b.sourceV1BlockId === null && b.theoryStatus === "NOT_STARTED";

    if (!isPreCredited && !isFlaggedUnconfirmed && !isFlaggedConfirmed && !isNeverStudied) {
      unclassified.push({
        id: b.id,
        subject: b.subject?.name,
        title: b.title,
        sourceV1BlockId: b.sourceV1BlockId,
        theoryStatus: b.theoryStatus,
        possiblyAlreadyStudied: b.possiblyAlreadyStudied
      });
    }
  });

  console.log(`Total de blocos sem categoria prévia: ${unclassified.length}`);
  console.table(unclassified);
}

main().finally(() => prisma.$disconnect());
