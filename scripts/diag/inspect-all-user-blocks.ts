import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada.");
  const userId = gabriela.id;

  const allBlocks = await prisma.studyBlock.findMany({
    where: { userId },
    include: {
      material: { select: { originalFileName: true, materialRole: true } },
      subject: { select: { name: true } }
    }
  });

  console.log(`Total Geral de Blocos no Banco para a Gabriela: ${allBlocks.length}`);

  const byMaterialRole: Record<string, number> = {};
  const bySubject: Record<string, number> = {};
  const bySourceV1: Record<string, number> = {};

  allBlocks.forEach(b => {
    const role = b.material?.materialRole || "SEM_MATERIAL";
    byMaterialRole[role] = (byMaterialRole[role] || 0) + 1;

    const sName = b.subject?.name || "Sem Matéria";
    bySubject[sName] = (bySubject[sName] || 0) + 1;

    const src = b.sourceV1BlockId ? "PREENCHIDO" : "NULO";
    bySourceV1[src] = (bySourceV1[src] || 0) + 1;
  });

  console.log("\nBlocos por MaterialRole:");
  console.table(byMaterialRole);

  console.log("\nBlocos por sourceV1BlockId:");
  console.table(bySourceV1);

  // Vamos ver o material do CFC vs Estratégia
  const materials = await prisma.studyMaterial.findMany({
    where: { userId },
    select: { id: true, originalFileName: true, materialRole: true, _count: { select: { studyBlocks: true } } }
  });

  console.log("\nMateriais da Gabriela:");
  console.table(materials.map(m => ({
    id: m.id,
    fileName: m.originalFileName,
    role: m.materialRole,
    blocksCount: m._count.studyBlocks
  })));

  // Quantos blocos pertencem ao material do CFC (5 PDFs)?
  const cfcMaterials = materials.filter(m => m.materialRole === "MAIN_MATERIAL");
  console.log(`\nMateriais com Role MAIN_MATERIAL (Resumos Âncora do CFC): ${cfcMaterials.length}`);
  cfcMaterials.forEach(m => {
    console.log(`- PDF: '${m.originalFileName}' | Blocks: ${m._count.studyBlocks}`);
  });

  const cfcBlockIds = cfcMaterials.map(m => m.id);
  const cfcBlocks = allBlocks.filter(b => cfcBlockIds.includes(b.materialId));

  console.log(`\nTOTAL DE BLOCOS ÂNCORA DO CFC (pertecentes aos PDFs do CFC): ${cfcBlocks.length}`);

  let cfcPreCredited = 0;
  let cfcFlaggedUnconfirmed = 0;
  let cfcFlaggedConfirmed = 0;
  let cfcNeverStudied = 0;

  const cfcNeverBySubject: Record<string, number> = {};

  cfcBlocks.forEach(b => {
    const sName = b.subject?.name || "Sem Matéria";
    if (b.sourceV1BlockId !== null) {
      if (b.theoryStatus === "COMPLETED") {
        if (b.possiblyAlreadyStudied) {
          cfcFlaggedConfirmed++;
        } else {
          cfcPreCredited++;
        }
      } else if (b.possiblyAlreadyStudied) {
        cfcFlaggedUnconfirmed++;
      } else {
        cfcPreCredited++; // fallback
      }
    } else {
      if (b.theoryStatus === "NOT_STARTED") {
        cfcNeverStudied++;
        cfcNeverBySubject[sName] = (cfcNeverBySubject[sName] || 0) + 1;
      }
    }
  });

  console.log("\n--- CONTAGEM EXATA DOS BLOCOS DO CFC (MAIN_MATERIAL) ---");
  console.log(`1. Total de Blocos Âncora do CFC: ${cfcBlocks.length}`);
  console.log(`2. Pré-creditados (sourceV1BlockId != null, COMPLETED/pré-crédito): ${cfcPreCredited}`);
  console.log(`3. Sinalizados ainda NÃO confirmados (possiblyAlreadyStudied=true, NOT_STARTED): ${cfcFlaggedUnconfirmed}`);
  console.log(`4. Sinalizados JÁ confirmados por ela desde 14/08: ${cfcFlaggedConfirmed}`);
  console.log(`5. Nunca Estudados (sourceV1BlockId == null, NOT_STARTED): ${cfcNeverStudied}`);

  console.log("\nDistribuição dos Blocos do CFC 'Nunca Estudados' por matéria:");
  console.table(cfcNeverBySubject);

  // E os blocos do Estratégia (REFERENCE_MATERIAL)?
  const stratMaterials = materials.filter(m => m.materialRole === "REFERENCE_MATERIAL");
  const stratMaterialIds = stratMaterials.map(m => m.id);
  const stratBlocks = allBlocks.filter(b => stratMaterialIds.includes(b.materialId));

  console.log(`\nTOTAL DE BLOCOS DO ESTRATÉGIA (REFERENCE_MATERIAL): ${stratBlocks.length}`);
  const stratStatusCounts: Record<string, number> = {};
  stratBlocks.forEach(b => {
    stratStatusCounts[b.theoryStatus] = (stratStatusCounts[b.theoryStatus] || 0) + 1;
  });
  console.table(stratStatusCounts);
}

main().finally(() => prisma.$disconnect());
