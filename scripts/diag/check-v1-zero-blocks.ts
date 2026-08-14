import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada");

  // Buscar todos os v1TopicId presentes em SyllabusTopicMapping
  const allMappings = await prisma.syllabusTopicMapping.findMany({
    select: { v1TopicId: true, v2TopicId: true, relationType: true }
  });

  const v1TopicIds = Array.from(new Set(allMappings.map(m => m.v1TopicId)));

  console.log("======================================================================");
  console.log("CONTAGEM DE TÓPICOS V1 COM BLOCOS DO ESTRATÉGIA NO BANCO DE DADOS");
  console.log("======================================================================\n");

  console.log(`Total de Tópicos V1 Mapeados na Taxonomia: ${v1TopicIds.length}`);

  let zeroBlocksCount = 0;
  const v1WithBlocks: any[] = [];
  const v1WithoutBlocks: any[] = [];

  for (const v1Id of v1TopicIds) {
    const blocksCount = await prisma.studyBlock.count({
      where: {
        userId: gabriela.id,
        officialTopicId: v1Id,
        material: { materialRole: "REFERENCE_MATERIAL" }
      }
    });

    if (blocksCount === 0) {
      zeroBlocksCount++;
      v1WithoutBlocks.push(v1Id);
    } else {
      v1WithBlocks.push({ v1Id, count: blocksCount });
    }
  }

  console.log(`- Tópicos V1 COM pelo menos 1 bloco do Estratégia: ${v1WithBlocks.length}`);
  console.log(`- Tópicos V1 COM ZERO blocos do Estratégia: ${zeroBlocksCount}\n`);

  if (v1WithoutBlocks.length > 0) {
    console.log("Amostra de Tópicos V1 sem blocos cadastrados:", v1WithoutBlocks.slice(0, 10));
  }
}

main().finally(() => prisma.$disconnect());
