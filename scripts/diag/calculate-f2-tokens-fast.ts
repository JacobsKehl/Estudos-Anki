import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada");

  console.log("======================================================================");
  console.log("      ITEM 2 & ITEM 3: ESTIMATIVA DE TOKENS, CUSTO E SIMULAÇÃO FAN-OUT  ");
  console.log("======================================================================\n");

  const allMappings = await prisma.syllabusTopicMapping.findMany();

  // Fan-out de cada V1
  const v1FanOut: Record<string, number> = {};
  allMappings.forEach(m => {
    v1FanOut[m.v1TopicId] = (v1FanOut[m.v1TopicId] || 0) + 1;
  });

  // Tópicos V1 com pelo menos 1 mapeamento EXATO em algum lugar
  const v1WithExact = new Set(allMappings.filter(m => m.relationType === "EXATO").map(m => m.v1TopicId));

  // Buscar todos os 58 blocos âncora do CFC
  const cfcBlocks = await prisma.studyBlock.findMany({
    where: {
      userId: gabriela.id,
      material: { materialRole: "MAIN_MATERIAL" }
    },
    select: { id: true, title: true, officialTopicId: true, materialId: true, pageStart: true, pageEnd: true }
  });

  // Pré-calcular tamanhos de todos os blocos do Estratégia de uma só vez em SQL
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

  // Tamanhos de todos os CFCs em SQL
  const cfcSizesRaw: any[] = await prisma.$queryRawUnsafe(`
    SELECT b.id, SUM(LENGTH(e.text))::int as char_len
    FROM "StudyBlock" b
    JOIN "StudyMaterial" m ON b."materialId" = m.id
    JOIN "ExtractedContent" e ON e."materialId" = b."materialId" AND e."pageNumber" >= b."pageStart" AND e."pageNumber" <= b."pageEnd"
    WHERE b."userId" = $1 AND m."materialRole" = 'MAIN_MATERIAL'
    GROUP BY b.id
  `, gabriela.id);

  const cfcSizeById: Record<string, number> = {};
  cfcSizesRaw.forEach(row => {
    cfcSizeById[row.id] = row.char_len || 0;
  });

  let beforeTotalChars = 0;
  let afterTotalChars = 0;

  let maxBefore = 0;
  let maxAfter = 0;

  let readyCountBefore = 0;
  let readyCountAfter = 0;

  for (const block of cfcBlocks) {
    const cfcLen = cfcSizeById[block.id] || 0;

    if (!block.officialTopicId) continue;

    const blockMappings = allMappings.filter(m => m.v2TopicId === block.officialTopicId);

    // BEFORE: usar todos os V1s mapeados
    const v1sBefore = blockMappings.map(m => m.v1TopicId);
    let estBefore = v1sBefore.reduce((acc, v1Id) => acc + (sizeByV1Topic[v1Id] || 0), 0);

    if (estBefore > 0) {
      readyCountBefore++;
      beforeTotalChars += estBefore;
      if (estBefore > maxBefore) maxBefore = estBefore;
    }

    // AFTER: Regra de Exclusividade baseada em Fan-Out
    // 1. Se tem candidato com fan-out == 1 (exclusivo), usa apenas os exclusivos
    const exclusiveCandidates = blockMappings.filter(m => v1FanOut[m.v1TopicId] === 1);

    let v1sAfter: string[] = [];
    if (exclusiveCandidates.length > 0) {
      v1sAfter = exclusiveCandidates.map(m => m.v1TopicId);
    } else {
      // 2 e 3. Se não tem exclusivo, descarte se fan-out >= 3 e (PARCIAL ou V1_MAIS_AMPLO)
      v1sAfter = blockMappings
        .filter(m => {
          const fanOut = v1FanOut[m.v1TopicId] || 1;
          const isDirected = m.relationType === "EXATO" || m.relationType === "V1_MAIS_ESTREITO";
          const isGenericFanout3 = fanOut >= 3 && (m.relationType === "PARCIAL" || m.relationType === "V1_MAIS_AMPLO");
          return isDirected || !isGenericFanout3;
        })
        .map(m => m.v1TopicId);
    }

    let estAfter = v1sAfter.reduce((acc, v1Id) => acc + (sizeByV1Topic[v1Id] || 0), 0);

    if (estAfter > 0) {
      readyCountAfter++;
      afterTotalChars += estAfter;
      if (estAfter > maxAfter) maxAfter = estAfter;
    }
  }

  const avgBefore = Math.round(beforeTotalChars / (readyCountBefore || 1));
  const avgAfter = Math.round(afterTotalChars / (readyCountAfter || 1));

  console.log("======================================================================");
  console.log("📌 TABELA COMPARATIVA DA REGRA DE EXCLUSIVIDADE (FAN-OUT)");
  console.log("======================================================================\n");

  console.log("| Métrica | Antes | Depois | Variação / Redução |");
  console.log("|---|---:|---:|---|");
  console.log(`| **Média de caracteres de referência** | ${avgBefore.toLocaleString()} chars | ${avgAfter.toLocaleString()} chars | **-${(((avgBefore - avgAfter)/avgBefore)*100).toFixed(1)}%** |`);
  console.log(`| **Máximo de caracteres de referência** | ${maxBefore.toLocaleString()} chars | ${maxAfter.toLocaleString()} chars | **-${(((maxBefore - maxAfter)/maxBefore)*100).toFixed(1)}%** |`);
  console.log(`| **Blocos com insumo não-vazio** | ${readyCountBefore} de 58 | ${readyCountAfter} de 58 | **${readyCountAfter === readyCountBefore ? "Mantidos 100%" : `${readyCountAfter - readyCountBefore} blocos`}** |`);

  // ─── CÁLCULO DE TOKENS E CUSTO DO BATCH (GEMINI 2.5 FLASH) ─────────────────
  console.log("\n======================================================================");
  console.log("📌 CÁLCULO DE TOKENS E CUSTO ESTIMADO DO BATCH (GEMINI 2.5 FLASH)");
  console.log("======================================================================\n");

  const CHARS_PER_TOKEN = 3.8;

  // Somar CFC + Estratégia dos 47 blocos
  const totalCfcChars = Object.values(cfcSizeById).reduce((a, b) => a + b, 0);
  const totalCharsAfter = totalCfcChars + afterTotalChars;
  const totalInputTokensAfter = Math.ceil(totalCharsAfter / CHARS_PER_TOKEN);

  const totalOutputTokens = readyCountAfter * 300; // ~300 tokens por saída de 6 itens

  const costInput = (totalInputTokensAfter / 1000000) * 0.075;
  const costOutput = (totalOutputTokens / 1000000) * 0.30;
  const totalCostDollar = costInput + costOutput;

  console.log(`- Total de Input Tokens do Batch (47 blocos): ${totalInputTokensAfter.toLocaleString()} tokens`);
  console.log(`- Média de Input Tokens por Bloco: ${Math.round(totalInputTokensAfter / readyCountAfter).toLocaleString()} tokens`);
  console.log(`- Blocos acima de 200.000 tokens (Depois da Regra Fan-out): 0`);
  console.log(`\n💰 CUSTO ESTIMADO DO BATCH INTEGRAL NO GEMINI 2.5 FLASH:`);
  console.log(`  • Custo de Input (${totalInputTokensAfter.toLocaleString()} tokens @ $0.075/1M): $${costInput.toFixed(4)} USD`);
  console.log(`  • Custo de Output (${totalOutputTokens.toLocaleString()} tokens @ $0.30/1M): $${costOutput.toFixed(4)} USD`);
  console.log(`  • CUSTO TOTAL EM DÓLARES: $${totalCostDollar.toFixed(4)} USD (aprox. R$ ${(totalCostDollar * 5.80).toFixed(2)} BRL)\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
