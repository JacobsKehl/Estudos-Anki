import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada");

  // 1. Buscar todos os mapeamentos
  const allMappings = await prisma.syllabusTopicMapping.findMany();

  // Mapear quais V1 possuem vínculo EXATO em algum lugar
  const v1WithExactMapping = new Set(
    allMappings.filter(m => m.relationType === "EXATO").map(m => m.v1TopicId)
  );

  // 2. Buscar os 58 blocos âncora do CFC
  const cfcBlocks = await prisma.studyBlock.findMany({
    where: {
      userId: gabriela.id,
      material: { materialRole: "MAIN_MATERIAL" }
    },
    select: {
      id: true,
      title: true,
      officialTopicId: true
    }
  });

  console.log("======================================================================");
  console.log("SIMULAÇÃO DA REGRA DE EXCLUSIVIDADE NO INSUMO DO F2 (BEFORE vs AFTER)");
  console.log("======================================================================\n");

  const comparison: any[] = [];

  for (const block of cfcBlocks) {
    if (!block.officialTopicId) continue;

    const blockMappings = allMappings.filter(m => m.v2TopicId === block.officialTopicId);
    if (blockMappings.length === 0) continue;

    const v1Before = blockMappings.map(m => m.v1TopicId);

    // REGRA DE EXCLUSIVIDADE:
    // a) Se o V2 tem mapeamento EXATO, usa apenas o(s) EXATO(s)
    const exactForV2 = blockMappings.filter(m => m.relationType === "EXATO");
    
    let v1After: string[] = [];
    if (exactForV2.length > 0) {
      v1After = exactForV2.map(m => m.v1TopicId);
    } else {
      // b) Se não tem EXATO, descarta qualquer V1 que seja EXATO de OUTRO V2
      v1After = blockMappings
        .filter(m => !v1WithExactMapping.has(m.v1TopicId))
        .map(m => m.v1TopicId);
    }

    comparison.push({
      blockId: block.id.substring(0, 8),
      title: block.title,
      v2TopicId: block.officialTopicId,
      beforeCount: v1Before.length,
      afterCount: v1After.length,
      v1Before,
      v1After,
      hasExact: exactForV2.length > 0
    });
  }

  console.log(`Total de Blocos Âncora do CFC Mapeados: ${comparison.length}\n`);

  console.log("| Bloco ID | Título do Bloco | V1 Antes | V1 Depois | Usou EXATO? |");
  console.log("|---|---|---:|---:|---|");
  comparison.forEach(c => {
    console.log(`| \`${c.blockId}\` | ${c.title.substring(0, 45)}... | ${c.beforeCount} | ${c.afterCount} | ${c.hasExact ? "SIM (EXATO)" : "NÃO (Exclusividade)"} |`);
  });

  const avgBefore = (comparison.reduce((a, b) => a + b.beforeCount, 0) / comparison.length).toFixed(2);
  const avgAfter = (comparison.reduce((a, b) => a + b.afterCount, 0) / comparison.length).toFixed(2);

  console.log(`\n📊 RESUMO DOS NÚMEROS:`);
  console.log(`- Média de tópicos V1 por bloco ANTES da regra: ${avgBefore}`);
  console.log(`- Média de tópicos V1 por bloco DEPOIS da regra: ${avgAfter}`);
}

main().finally(() => prisma.$disconnect());
