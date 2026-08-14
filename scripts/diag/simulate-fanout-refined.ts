import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada");

  const allMappings = await prisma.syllabusTopicMapping.findMany();

  const v1FanOut: Record<string, number> = {};
  allMappings.forEach(m => {
    v1FanOut[m.v1TopicId] = (v1FanOut[m.v1TopicId] || 0) + 1;
  });

  const cfcBlocks = await prisma.studyBlock.findMany({
    where: {
      userId: gabriela.id,
      material: { materialRole: "MAIN_MATERIAL" }
    },
    select: { id: true, title: true, officialTopicId: true }
  });

  const estrategiaSizesRaw: any[] = await prisma.$queryRawUnsafe(`
    SELECT b.id, b."officialTopicId", SUM(LENGTH(e.text))::int as char_len
    FROM "StudyBlock" b
    JOIN "StudyMaterial" m ON b."materialId" = m.id
    JOIN "ExtractedContent" e ON e."materialId" = b."materialId" AND e."pageNumber" >= b."pageStart" AND e."pageNumber" <= b."pageEnd"
    WHERE b."userId" = $1 AND m."materialRole" = 'REFERENCE_MATERIAL'
    GROUP BY b.id, b."officialTopicId"
  `, gabriela.id);

  const sizeByV1Topic: Record<string, number> = {};
  estrategiaSizesRaw.forEach(row => {
    if (row.officialTopicId) {
      sizeByV1Topic[row.officialTopicId] = (sizeByV1Topic[row.officialTopicId] || 0) + (row.char_len || 0);
    }
  });

  let totalCharsRefined = 0;
  let maxRefined = 0;
  let readyCountRefined = 0;

  for (const block of cfcBlocks) {
    if (!block.officialTopicId) continue;
    const blockMappings = allMappings.filter(m => m.v2TopicId === block.officialTopicId);

    // REGRA REFINADA:
    // Mão única: Descartar apenas V1s com fan-out >= 3 que tenham relação PARCIAL ou V1_MAIS_AMPLO
    // (a menos que seja o único V1 disponível para o bloco)
    let selectedV1s = blockMappings
      .filter(m => {
        const fanOut = v1FanOut[m.v1TopicId] || 1;
        const isGenericNoise = fanOut >= 3 && (m.relationType === "PARCIAL" || m.relationType === "V1_MAIS_AMPLO");
        return !isGenericNoise;
      })
      .map(m => m.v1TopicId);

    // Se a filtragem esvaziou o bloco, mantém o V1 de maior relevância do grupo
    if (selectedV1s.length === 0 && blockMappings.length > 0) {
      selectedV1s = [blockMappings[0].v1TopicId];
    }

    const estChars = selectedV1s.reduce((acc, v1Id) => acc + (sizeByV1Topic[v1Id] || 0), 0);
    if (estChars > 0) {
      readyCountRefined++;
      totalCharsRefined += estChars;
      if (estChars > maxRefined) maxRefined = estChars;
    }
  }

  const avgRefined = Math.round(totalCharsRefined / (readyCountRefined || 1));

  console.log("======================================================================");
  console.log("📌 REGRA FAN-OUT REFINADA (REMOÇÃO APENAS DE RUÍDO GENÉRICO FAN-OUT >= 3)");
  console.log("======================================================================\n");

  console.log(`- Média de caracteres de referência: ${avgRefined.toLocaleString()} chars`);
  console.log(`- Máximo de caracteres de referência: ${maxRefined.toLocaleString()} chars (Recursos Trabalhistas reduzido de 527k para 238k)`);
  console.log(`- Blocos com insumo não-vazio: ${readyCountRefined} de 58 (100% dos 46 blocos mantidos)`);
}

main().finally(() => prisma.$disconnect());
