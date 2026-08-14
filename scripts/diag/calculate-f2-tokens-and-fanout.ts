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

  // 1. Calcular Fan-out de cada V1 (quantos V2 apontam para aquele V1)
  const v1FanOut: Record<string, number> = {};
  allMappings.forEach(m => {
    v1FanOut[m.v1TopicId] = (v1FanOut[m.v1TopicId] || 0) + 1;
  });

  // 2. Buscar todos os 58 blocos âncora do CFC
  const cfcBlocks = await prisma.studyBlock.findMany({
    where: {
      userId: gabriela.id,
      material: { materialRole: "MAIN_MATERIAL" }
    },
    include: { subject: true }
  });

  const blockStatsBefore: any[] = [];
  const blockStatsAfter: any[] = [];

  for (const block of cfcBlocks) {
    // Obter tamanho do CFC integral
    const cfcExtracted = await prisma.extractedContent.findMany({
      where: {
        materialId: block.materialId,
        pageNumber: { gte: block.pageStart, lte: block.pageEnd }
      },
      select: { text: true }
    });
    const cfcCharLength = cfcExtracted.reduce((acc, e) => acc + e.text.length, 0);

    if (!block.officialTopicId) {
      blockStatsBefore.push({ id: block.id, title: block.title, subject: block.subject.name, cfcCharLength, estrategiaChars: 0 });
      blockStatsAfter.push({ id: block.id, title: block.title, subject: block.subject.name, cfcCharLength, estrategiaChars: 0 });
      continue;
    }

    const mappingsForV2 = allMappings.filter(m => m.v2TopicId === block.officialTopicId);

    // ─── SEM FILTRO FAN-OUT (BEFORE) ──────────────────────────────────────────
    const v1IdsBefore = mappingsForV2.map(m => m.v1TopicId);
    let estrategiaCharsBefore = 0;

    const estrategiaBlocksBefore = await prisma.studyBlock.findMany({
      where: {
        officialTopicId: { in: v1IdsBefore },
        material: { materialRole: "REFERENCE_MATERIAL" }
      },
      select: { materialId: true, pageStart: true, pageEnd: true }
    });

    for (const eb of estrategiaBlocksBefore) {
      const ext = await prisma.extractedContent.findMany({
        where: { materialId: eb.materialId, pageNumber: { gte: eb.pageStart, lte: eb.pageEnd } },
        select: { text: true }
      });
      estrategiaCharsBefore += ext.reduce((acc, e) => acc + e.text.length, 0);
    }

    blockStatsBefore.push({ id: block.id, title: block.title, subject: block.subject.name, cfcCharLength, estrategiaChars: estrategiaCharsBefore });

    // ─── COM REGRA DE EXCLUSIVIDADE BASEADA EM FAN-OUT (AFTER) ────────────────
    // Passo 1: Candidatos com fan-out == 1 (exclusivos)
    const exclusiveCandidates = mappingsForV2.filter(m => v1FanOut[m.v1TopicId] === 1);

    let selectedV1Ids: string[] = [];
    if (exclusiveCandidates.length > 0) {
      selectedV1Ids = exclusiveCandidates.map(m => m.v1TopicId);
    } else {
      // Passo 2 & 3: Filtrar candidatos mantendo EXATO / V1_MAIS_ESTREITO e descartando fan-out >= 3 genéricos
      selectedV1Ids = mappingsForV2
        .filter(m => {
          const fanOut = v1FanOut[m.v1TopicId] || 1;
          const isDirected = m.relationType === "EXATO" || m.relationType === "V1_MAIS_ESTREITO";
          const isGenericFanout3 = fanOut >= 3 && (m.relationType === "PARCIAL" || m.relationType === "V1_MAIS_AMPLO");
          return isDirected || !isGenericFanout3;
        })
        .map(m => m.v1TopicId);
    }

    let estrategiaCharsAfter = 0;
    const estrategiaBlocksAfter = await prisma.studyBlock.findMany({
      where: {
        officialTopicId: { in: selectedV1Ids },
        material: { materialRole: "REFERENCE_MATERIAL" }
      },
      select: { materialId: true, pageStart: true, pageEnd: true }
    });

    for (const eb of estrategiaBlocksAfter) {
      const ext = await prisma.extractedContent.findMany({
        where: { materialId: eb.materialId, pageNumber: { gte: eb.pageStart, lte: eb.pageEnd } },
        select: { text: true }
      });
      estrategiaCharsAfter += ext.reduce((acc, e) => acc + e.text.length, 0);
    }

    blockStatsAfter.push({ id: block.id, title: block.title, subject: block.subject.name, cfcCharLength, estrategiaChars: estrategiaCharsAfter });
  }

  // ─── MÉTRICAS ANTES E DEPOIS DA REGRA FAN-OUT ──────────────────────────────
  const readyBefore = blockStatsBefore.filter(b => b.estrategiaChars > 0);
  const readyAfter = blockStatsAfter.filter(b => b.estrategiaChars > 0);

  const avgCharsBefore = Math.round(readyBefore.reduce((a, b) => a + b.estrategiaChars, 0) / (readyBefore.length || 1));
  const maxCharsBefore = Math.max(...blockStatsBefore.map(b => b.estrategiaChars));

  const avgCharsAfter = Math.round(readyAfter.reduce((a, b) => a + b.estrategiaChars, 0) / (readyAfter.length || 1));
  const maxCharsAfter = Math.max(...blockStatsAfter.map(b => b.estrategiaChars));

  console.log("======================================================================");
  console.log("📌 TABELA COMPARATIVA DA REGRA DE EXCLUSIVIDADE (FAN-OUT)");
  console.log("======================================================================\n");

  console.log("| Métrica | Antes | Depois | Redução / Variação |");
  console.log("|---|---:|---:|---|");
  console.log(`| **Média de caracteres de referência** | ${avgCharsBefore.toLocaleString()} chars | ${avgCharsAfter.toLocaleString()} chars | **-${(((avgCharsBefore - avgCharsAfter)/avgCharsBefore)*100).toFixed(1)}%** |`);
  console.log(`| **Máximo de caracteres de referência** | ${maxCharsBefore.toLocaleString()} chars | ${maxCharsAfter.toLocaleString()} chars | **-${(((maxCharsBefore - maxCharsAfter)/maxCharsBefore)*100).toFixed(1)}%** |`);
  console.log(`| **Blocos com insumo não-vazio** | ${readyBefore.length} de 58 | ${readyAfter.length} de 58 | **${readyAfter.length === readyBefore.length ? "Mantidos 100%" : `${readyAfter.length - readyBefore.length} blocos`}** |`);

  // ─── CÁLCULO DE TOKENS E CUSTO DO BATCH (GEMINI 2.5 FLASH) ─────────────────
  console.log("\n======================================================================");
  console.log("📌 CÁLCULO DE TOKENS E CUSTO ESTIMADO DO BATCH (GEMINI 2.5 FLASH)");
  console.log("======================================================================\n");

  // Considerar amostragem de ~3.8 caracteres por token em Português
  const CHARS_PER_TOKEN = 3.8;

  let totalInputTokensBefore = 0;
  let totalInputTokensAfter = 0;
  let blocksOver200kTokensBefore = 0;
  let blocksOver200kTokensAfter = 0;

  readyAfter.forEach(b => {
    const totalChars = b.cfcCharLength + b.estrategiaChars;
    const tokens = Math.ceil(totalChars / CHARS_PER_TOKEN);
    totalInputTokensAfter += tokens;
    if (tokens > 200000) blocksOver200kTokensAfter++;
  });

  readyBefore.forEach(b => {
    const totalChars = b.cfcCharLength + b.estrategiaChars;
    const tokens = Math.ceil(totalChars / CHARS_PER_TOKEN);
    totalInputTokensBefore += tokens;
    if (tokens > 200000) blocksOver200kTokensBefore++;
  });

  const estimatedOutputTokensPerBlock = 300; // ~300 tokens por nota de 6 itens
  const totalOutputTokens = readyAfter.length * estimatedOutputTokensPerBlock;

  // Preço oficial Gemini 2.5 Flash:
  // Input: $0.075 / 1M tokens (para prompts <= 128k tokens)
  // Output: $0.30 / 1M tokens
  const costInput = (totalInputTokensAfter / 1000000) * 0.075;
  const costOutput = (totalOutputTokens / 1000000) * 0.30;
  const totalCostDollar = costInput + costOutput;

  console.log(`- Total de Input Tokens do Batch (47 blocos): ${totalInputTokensAfter.toLocaleString()} tokens`);
  console.log(`- Média de Input Tokens por Bloco: ${Math.round(totalInputTokensAfter / readyAfter.length).toLocaleString()} tokens`);
  console.log(`- Blocos acima de 200.000 tokens (Antes): ${blocksOver200kTokensBefore}`);
  console.log(`- Blocos acima de 200.000 tokens (Depois da Regra Fan-out): ${blocksOver200kTokensAfter}`);
  console.log(`\n💰 CUSTO ESTIMADO DO BATCH INTEGRAL NO GEMINI 2.5 FLASH:`);
  console.log(`  • Custo de Input (${totalInputTokensAfter.toLocaleString()} tokens @ $0.075/1M): $${costInput.toFixed(4)}`);
  console.log(`  • Custo de Output (${totalOutputTokens.toLocaleString()} tokens @ $0.30/1M): $${costOutput.toFixed(4)}`);
  console.log(`  • CUSTO TOTAL EM DÓLARES: $${totalCostDollar.toFixed(4)} USD (aprox. R$ ${(totalCostDollar * 5.80).toFixed(2)} BRL)\n`);
}

main().finally(() => prisma.$disconnect());
