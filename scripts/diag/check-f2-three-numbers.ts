import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sanitizeCpf } from "./run-f2-pilot-fixed";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada");

  console.log("======================================================================");
  console.log("               DIAGNÓSTICO F2: OS 3 NÚMEROS E TRUNCAGEM              ");
  console.log("======================================================================\n");

  // ─── ITEM 1: CHECAGEM DE TRUNCAGEM E FALSOS POSITIVOS (ATOS ADMINISTRATIVOS) ─
  const atosBlockId = "cmss35fow0007iyaoey50kzf4"; // Atos Administrativos
  const atosBlock = await prisma.studyBlock.findUnique({
    where: { id: atosBlockId },
    include: { material: true }
  });

  if (atosBlock) {
    const cfcExtracted = await prisma.extractedContent.findMany({
      where: {
        materialId: atosBlock.materialId,
        pageNumber: { gte: atosBlock.pageStart, lte: atosBlock.pageEnd }
      },
      orderBy: { pageNumber: "asc" }
    });

    const cfcFullText = cfcExtracted.map(e => e.text).join("\n\n");
    console.log("📌 ITEM 1 — CHECAGEM DE FALSOS POSITIVOS (ATOS ADMINISTRATIVOS):");
    console.log(`- Tamanho TOTAL do texto do CFC (Sem Corte): ${cfcFullText.length} caracteres`);

    // Busca de termos no texto integral
    const hasOrdinatorio = /ordinatóri/gi.test(cfcFullText);
    const hasUsurpacao = /usurpação/gi.test(cfcFullText);
    const has328 = /328/gi.test(cfcFullText);

    console.log(`- Termo 'ordinatóri' no texto integral: ${hasOrdinatorio ? "ENCONTRADO ❌ (FALSO POSITIVO)" : "NÃO ENCONTRADO ✅ (LACUNA REAL)"}`);
    console.log(`- Termo 'usurpação' no texto integral: ${hasUsurpacao ? "ENCONTRADO ❌ (FALSO POSITIVO)" : "NÃO ENCONTRADO ✅ (LACUNA REAL)"}`);
    console.log(`- Termo '328' no texto integral: ${has328 ? "ENCONTRADO ❌ (FALSO POSITIVO)" : "NÃO ENCONTRADO ✅ (LACUNA REAL)"}\n`);

    if (hasOrdinatorio) {
      const idx = cfcFullText.toLowerCase().indexOf("ordinatóri");
      console.log(`  [Posição de 'ordinatóri']: caractere ${idx}`);
    }
  }

  // ─── ITEM 2: COLUNAS DE SCORE E MAPEAMENTOS DUPLICADOS V1 ➔ V2 ──────────────
  // Verificar estrutura das colunas de SyllabusTopicMapping
  const sampleMapping = await prisma.syllabusTopicMapping.findFirst();
  console.log("📌 ITEM 2 — ESTRUTURA E EXCLUSIVIDADE DA TAXONOMIA:");
  console.log("- Exemplo de colunas em SyllabusTopicMapping:", Object.keys(sampleMapping || {}));

  const allMappings = await prisma.syllabusTopicMapping.findMany();
  
  // Agrupar contagem de V2 por V1
  const v1MapCount: Record<string, number> = {};
  allMappings.forEach(m => {
    v1MapCount[m.v1TopicId] = (v1MapCount[m.v1TopicId] || 0) + 1;
  });

  const sortedV1MultiMap = Object.entries(v1MapCount)
    .sort((a, b) => b[1] - a[1]);

  console.log(`- Total de tópicos V1 mapeados: ${Object.keys(v1MapCount).length}`);
  console.log(`- Tópicos V1 que aparecem em MAIS DE 1 mapeamento V2: ${sortedV1MultiMap.filter(x => x[1] > 1).length}`);
  console.log("\nTop 10 Tópicos V1 que mais aparecem em múltiplos V2:");
  for (const [v1Id, count] of sortedV1MultiMap.slice(0, 10)) {
    const v1Topic = await prisma.syllabusTopic.findUnique({ where: { id: v1Id } });
    console.log(`  - \`${v1Id}\` (${v1Topic?.title || ""}): ${count} mapeamentos V2`);
  }

  // ─── ITEM 3: O NÚMERO DECISIVO DE BLOCOS COM INSUMO NÃO-VAZIO ───────────────
  console.log("\n📌 ITEM 3 — LEVANTAMENTO DE INSUMO DISPONÍVEL NOS 58 BLOCOS ÂNCORA:\n");

  const cfcBlocks = await prisma.studyBlock.findMany({
    where: {
      userId: gabriela.id,
      material: { materialRole: "MAIN_MATERIAL" }
    },
    include: { subject: true }
  });

  let nonZeroCount = 0;
  let zeroCount = 0;

  console.log("| Bloco ID (trunc) | Matéria | Título do Bloco CFC | Chars Estratégia Disponíveis | Status |");
  console.log("|---|---|---|---:|---|");

  for (const block of cfcBlocks) {
    let estrategiaChars = 0;

    if (block.officialTopicId) {
      const mappings = await prisma.syllabusTopicMapping.findMany({
        where: { v2TopicId: block.officialTopicId }
      });
      const v1TopicIds = mappings.map(m => m.v1TopicId);

      const estrategiaBlocks = await prisma.studyBlock.findMany({
        where: {
          officialTopicId: { in: v1TopicIds },
          material: { materialRole: "REFERENCE_MATERIAL" }
        },
        select: { id: true, materialId: true, pageStart: true, pageEnd: true }
      });

      for (const eb of estrategiaBlocks) {
        const ext = await prisma.extractedContent.findMany({
          where: {
            materialId: eb.materialId,
            pageNumber: { gte: eb.pageStart, lte: eb.pageEnd }
          },
          select: { text: true }
        });
        const len = ext.reduce((acc, curr) => acc + curr.text.length, 0);
        estrategiaChars += len;
      }
    }

    if (estrategiaChars > 0) {
      nonZeroCount++;
      console.log(`| \`${block.id.substring(0, 8)}\` | ${block.subject.name} | ${block.title.substring(0, 40)}... | ${estrategiaChars} | READY |`);
    } else {
      zeroCount++;
      console.log(`| \`${block.id.substring(0, 8)}\` | ${block.subject.name} | ${block.title.substring(0, 40)}... | 0 | NOT_REQUIRED |`);
    }
  }

  console.log(`\n======================================================================`);
  console.log(`📊 TOTAL DE BLOCOSÂNCORA DO CFC COM INSUMO DISPONÍVEL:`);
  console.log(`- Blocos COM texto de referência do Estratégia (> 0 chars): ${nonZeroCount} de 58 (${((nonZeroCount/58)*100).toFixed(1)}%)`);
  console.log(`- Blocos SEM texto de referência (0 chars -> NOT_REQUIRED): ${zeroCount} de 58 (${((zeroCount/58)*100).toFixed(1)}%)`);
  console.log(`======================================================================\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
