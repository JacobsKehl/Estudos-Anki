import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada");

  // Buscar todos os 58 blocos âncora do CFC
  const cfcBlocks = await prisma.studyBlock.findMany({
    where: {
      userId: gabriela.id,
      material: { materialRole: "MAIN_MATERIAL" }
    },
    select: {
      id: true,
      title: true,
      officialTopicId: true,
      subject: { select: { name: true } }
    }
  });

  console.log("======================================================================");
  console.log("VERIFICAÇÃO DO CAMINHO DE INSUMO F2 (CFC ➔ MAPPING ➔ ESTRATÉGIA)");
  console.log("======================================================================\n");

  let zeroMatchCount = 0;
  const matchDetails: any[] = [];

  for (const block of cfcBlocks) {
    if (!block.officialTopicId) {
      zeroMatchCount++;
      continue;
    }

    // Buscar mapeamento em SyllabusTopicMapping (v2TopicId = block.officialTopicId)
    const mappings = await prisma.syllabusTopicMapping.findMany({
      where: { v2TopicId: block.officialTopicId }
    });

    const v1TopicIds = mappings.map(m => m.v1TopicId);

    // Buscar blocos do Estratégia associados a estes tópicos v1
    const estrategiaBlocks = await prisma.studyBlock.findMany({
      where: {
        userId: gabriela.id,
        officialTopicId: { in: v1TopicIds },
        material: { materialRole: "REFERENCE_MATERIAL" }
      },
      select: {
        id: true,
        title: true,
        pageStart: true,
        pageEnd: true,
        materialId: true
      }
    });

    if (estrategiaBlocks.length === 0) {
      zeroMatchCount++;
    }

    matchDetails.push({
      cfcBlockId: block.id,
      cfcTitle: block.title,
      subjectName: block.subject.name,
      v2TopicId: block.officialTopicId,
      mappingCount: mappings.length,
      relationTypes: mappings.map(m => m.relationType),
      estrategiaBlockCount: estrategiaBlocks.length
    });
  }

  console.log(`Total de Blocos Âncora do CFC Analisados: ${cfcBlocks.length}`);
  console.log(`Blocos com pelo menos 1 correspondência no Estratégia: ${cfcBlocks.length - zeroMatchCount}`);
  console.log(`Blocos com ZERO correspondência: ${zeroMatchCount}\n`);

  console.log("Amostra por Relação de Taxonomia:\n");

  // Agrupar por tipo de relação
  const exact = matchDetails.filter(m => m.relationTypes.includes("EXATO"));
  const cfcNarrower = matchDetails.filter(m => m.relationTypes.includes("V1_MAIS_AMPLO") || m.relationTypes.includes("PARCIAL"));
  const cfcWider = matchDetails.filter(m => m.relationTypes.includes("V1_MAIS_ESTREITO"));

  console.log(`- EXATO: ${exact.length} blocos`);
  if (exact.length > 0) console.log(`  Exemplo EXATO:`, exact[0]);

  console.log(`\n- CFC MAIS ESTREITO (Edital/V1 mais amplo): ${cfcNarrower.length} blocos`);
  if (cfcNarrower.length > 0) console.log(`  Exemplo CFC MAIS ESTREITO:`, cfcNarrower[0]);

  console.log(`\n- CFC MAIS AMPLO (Edital/V1 mais estreito): ${cfcWider.length} blocos`);
  if (cfcWider.length > 0) console.log(`  Exemplo CFC MAIS AMPLO:`, cfcWider[0]);
}

main().finally(() => prisma.$disconnect());
