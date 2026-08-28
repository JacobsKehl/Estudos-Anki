import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("======================================================================");
  console.log("     EXCLUSÃO DEFINITIVA DOS 5 BLOCOS DUPLICADOS (ITEM 1)             ");
  console.log("======================================================================\n");

  const targetIds = [
    "cmsxk52in0001jm04xbpimqk0",
    "cmsxk52jt0003jm04kuwpuum4",
    "cmsxk52kg0005jm04owcpff4e",
    "cmsxk52l10007jm04g6oxglkd",
    "cmsxk52ln0009jm04dl3ssbrs"
  ];

  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada.");
  const userId = gabriela.id;

  console.log(`Deletando permanentemente os 5 blocos duplicados de 17/08...`);
  const delRes = await prisma.studyBlock.deleteMany({
    where: {
      userId,
      id: { in: targetIds }
    }
  });

  console.log(`✅ ${delRes.count} blocos excluídos com sucesso do banco de dados.\n`);

  // ------------------------------------------------------------------
  // 1. CONTAGEM DO `possiblyCount` POR MATÉRIA
  // ------------------------------------------------------------------
  console.log("======================================================================");
  console.log("CONFERÊNCIA DO possiblyCount POR MATÉRIA (ESPERADO TRABALHO = 3)");
  console.log("======================================================================\n");

  const cfcFileNames = [
    "1 - Direito Administrativo_compressed.pdf",
    "3 - Direito Constitucional_compressed.pdf",
    "3 - Direito Constitucional.pdf",
    "Direito Processual Civil_compressed.pdf",
    "4 - Direito Processual do Trabalho.pdf",
    "2 - Direito do Trabalho.pdf"
  ];

  const possiblyBlocks = await prisma.studyBlock.findMany({
    where: {
      userId,
      possiblyAlreadyStudied: true,
      theoryStatus: { not: "COMPLETED" },
      material: { originalFileName: { in: cfcFileNames } }
    },
    include: {
      subject: { select: { name: true } }
    }
  });

  const possiblyCountsPerSubject: Record<string, number> = {};
  possiblyBlocks.forEach(b => {
    const sName = b.subject.name;
    possiblyCountsPerSubject[sName] = (possiblyCountsPerSubject[sName] || 0) + 1;
  });

  console.log("--- BLOCOS SINALIZADOS PENDENTES (possiblyAlreadyStudied) POR MATÉRIA ---");
  console.table(possiblyCountsPerSubject);

  const totalPossibly = possiblyBlocks.length;
  console.log(`\nTOTAL DE BLOCOS SINALIZADOS PENDENTES: ${totalPossibly}`);
  console.log(`Direito do Trabalho é exatamente 3: ${possiblyCountsPerSubject["Direito do Trabalho"] === 3 ? "SIM ✅" : "NÃO ❌"}`);
  console.log(`Soma Global é exatamente 14:        ${totalPossibly === 14 ? "SIM ✅" : "NÃO ❌"}`);

  // ------------------------------------------------------------------
  // 2. BUSCA DA QUERY REAL DO AGENDADOR (scheduler.ts)
  // ------------------------------------------------------------------
  console.log("\n======================================================================");
  console.log("Mapeamento da Query Real do Agendador (src/lib/recommendations/adaptive-scheduler.ts)");
  console.log("======================================================================\n");
}

main().finally(() => prisma.$disconnect());
