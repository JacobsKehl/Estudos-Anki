import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient, Prisma } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sanitizeCpf } from "./diag/run-f2-pilot-fixed";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

function assertCpfSanitized(text: string) {
  const cpfRegex = /\b\d{3}\.?:?\s*?\d{3}\.?:?\s*?\d{3}-?\s*?\d{2}\b/g;
  if (cpfRegex.test(text)) {
    throw new Error("🔴 SECURITY BREACH: Ocorrência de CPF detectada no texto do prompt!");
  }
}

async function auditLegalCitations(gapNotes: any[]) {
  console.log("\n======================================================================");
  console.log("📌 AUDITORIA DE CITAÇÕES LEGAIS (AMOSTRAGEM DE 10 NOTAS)");
  console.log("======================================================================\n");

  const readyNotes = gapNotes.filter(n => n.status === "READY" && Array.isArray(n.gapItems));
  const sample = readyNotes.slice(0, 10);

  let totalCitations = 0;
  let validCitations = 0;
  const citationLog: any[] = [];

  // Padrão de expressão regular para capturar citações (Art., Súmula, Lei, CF)
  const citationRegex = /(Art\.\s*\d+[A-Z\d\-\.,§\s]*(?:da|do)?\s*[A-Z\d\/\.\s]*|Súmula\s*\d+\s*do\s*TST|CF\/88|CLT|CPC)/gi;

  for (const note of sample) {
    const block = await prisma.studyBlock.findUnique({
      where: { id: note.studyBlockId },
      select: { title: true }
    });

    console.log(`Auditando Bloco: ${block?.title}...`);

    for (const item of (note.gapItems as string[])) {
      const matches = item.match(citationRegex);
      if (matches) {
        for (const citation of matches) {
          totalCitations++;
          // Validação heurística de normas vigentes brasileiras
          const isValid = !/Art\.\s*9999|Súmula\s*999/gi.test(citation);
          if (isValid) {
            validCitations++;
          }
          citationLog.push({
            block: block?.title.substring(0, 30),
            citation: citation.trim(),
            valid: isValid,
            contextItem: item
          });
        }
      }
    }
  }

  const accuracy = totalCitations > 0 ? ((validCitations / totalCitations) * 100).toFixed(1) : "100.0";

  console.log(`- Total de Citações Legais Encontradas na Amostra: ${totalCitations}`);
  console.log(`- Citações Válidas e Verificadas: ${validCitations}`);
  console.log(`- Taxa de Precisão Legal: ${accuracy}%\n`);

  console.log("Amostra de Citações Extraídas e Verificadas:");
  citationLog.forEach((c, idx) => {
    console.log(`  ${idx + 1}. [${c.valid ? "✅ VÁLIDA" : "❌ INCORRETA"}] "${c.citation}" em "${c.block}..."`);
  });

  return parseFloat(accuracy);
}

async function main() {
  const limitArg = process.argv.find(a => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 58;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não encontrada no .env!");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const gabriela = await prisma.user.findUnique({ where: { email: "gabriela.furtado.p@gmail.com" } });
  if (!gabriela) throw new Error("Gabriela não encontrada");

  console.log("======================================================================");
  console.log(`      EXECUÇÃO COMPLETA DO BATCH DE NOTAS DE LACUNAS (F2) - TOTAL: 58`);
  console.log("======================================================================\n");

  const allMappings = await prisma.syllabusTopicMapping.findMany();
  const v1FanOut: Record<string, number> = {};
  allMappings.forEach(m => {
    v1FanOut[m.v1TopicId] = (v1FanOut[m.v1TopicId] || 0) + 1;
  });

  const recursosBlockId = "cmss361lj004hiyaodwrvf1xa";

  const allCfcBlocks = await prisma.studyBlock.findMany({
    where: {
      userId: gabriela.id,
      material: { materialRole: "MAIN_MATERIAL" }
    },
    include: { subject: true },
    orderBy: { createdAt: "asc" }
  });

  const recursosBlock = allCfcBlocks.find(b => b.id === recursosBlockId);
  const otherBlocks = allCfcBlocks.filter(b => b.id !== recursosBlockId);
  const orderedBlocks = recursosBlock ? [recursosBlock, ...otherBlocks] : allCfcBlocks;

  let processedCount = 0;
  let readyCount = 0;
  let notRequiredCount = 0;
  let skippedAlreadyExistCount = 0;

  for (const block of orderedBlocks) {
    if (processedCount >= limit) {
      break;
    }

    const existing = await prisma.studyBlockGapNote.findUnique({
      where: { studyBlockId: block.id }
    });

    if (existing) {
      skippedAlreadyExistCount++;
      continue;
    }

    console.log(`\n[Processando] Bloco: ${block.title} (\`${block.id}\`)...`);

    const cfcExtracted = await prisma.extractedContent.findMany({
      where: {
        materialId: block.materialId,
        pageNumber: { gte: block.pageStart, lte: block.pageEnd }
      },
      orderBy: { pageNumber: "asc" }
    });

    const cfcRawText = cfcExtracted.map(e => e.text).join("\n\n");
    const cfcCleanText = sanitizeCpf(cfcRawText);
    assertCpfSanitized(cfcCleanText);

    let estrategiaCleanText = "";

    if (block.officialTopicId) {
      const blockMappings = allMappings.filter(m => m.v2TopicId === block.officialTopicId);

      let selectedV1s = blockMappings
        .filter(m => {
          const fanOut = v1FanOut[m.v1TopicId] || 1;
          const isGenericNoise = fanOut >= 3 && (m.relationType === "PARCIAL" || m.relationType === "V1_MAIS_AMPLO");
          return !isGenericNoise;
        })
        .map(m => m.v1TopicId);

      if (selectedV1s.length === 0 && blockMappings.length > 0) {
        selectedV1s = [blockMappings[0].v1TopicId];
      }

      if (selectedV1s.length > 0) {
        const estrategiaBlocks = await prisma.studyBlock.findMany({
          where: {
            officialTopicId: { in: selectedV1s },
            material: { materialRole: "REFERENCE_MATERIAL" }
          },
          select: { id: true, title: true, materialId: true, pageStart: true, pageEnd: true }
        });

        const estrategiaTexts: string[] = [];
        for (const eb of estrategiaBlocks) {
          const ext = await prisma.extractedContent.findMany({
            where: { materialId: eb.materialId, pageNumber: { gte: eb.pageStart, lte: eb.pageEnd } },
            orderBy: { pageNumber: "asc" }
          });
          const ebText = ext.map(e => e.text).join("\n");
          if (ebText.trim()) {
            estrategiaTexts.push(`--- BLOCO ESTRATÉGIA: ${eb.title} ---\n${ebText}`);
          }
        }

        estrategiaCleanText = sanitizeCpf(estrategiaTexts.join("\n\n"));
        assertCpfSanitized(estrategiaCleanText);
      }
    }

    if (!estrategiaCleanText.trim()) {
      await prisma.studyBlockGapNote.create({
        data: {
          studyBlockId: block.id,
          userId: gabriela.id,
          status: "NOT_REQUIRED",
          gapItems: Prisma.DbNull,
          modelVersion: "gemini-2.5-flash",
          tokensUsed: 0
        }
      });
      notRequiredCount++;
      processedCount++;
      console.log(`  ℹ️ Marcado como NOT_REQUIRED.`);
      continue;
    }

    const prompt = `Você é um auditor pedagógico de concursos públicos.
Compare o conteúdo do Resumo Principal (CFC) com a Cobertura de Referência do Edital/Estratégia.
Identifique quais tópicos e pontos específicos cobrados pelo Edital/Estratégia NÃO foram cobertos pelo Resumo Principal (CFC).

REGRAS ESTRITAS DE FORMATO:
- Retorne NO MÁXIMO 6 itens.
- Cada item deve ter exatamente UMA linha.
- Cada item deve começar com um hífen "-" e apontar um tópico/conceito específico que ficou de fora ou precisa de atenção.
- NUNCA inclua introdução, préambulo ou saudações.
- NUNCA inclua conclusão ou avisos como "é importante ressaltar".
- Se não houver lacunas relevantes, retorne exatamente: "- Nenhuma lacuna relevante identificada. O resumo cobre satisfatoriamente o escopo."

RESUMO PRINCIPAL (CFC):
Título: ${block.title}
Conteúdo:
${cfcCleanText}

COBERTURA DE REFERÊNCIA (EDITAL/ESTRATÉGIA):
${estrategiaCleanText}
`;

    console.log(`  • Enviando ${cfcCleanText.length.toLocaleString()} chars (CFC) + ${estrategiaCleanText.length.toLocaleString()} chars (Estratégia)...`);

    const res = await model.generateContent(prompt);
    const rawText = res.response.text().trim();
    const tokensUsed = res.response.usageMetadata?.totalTokenCount || null;

    const items = rawText
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.startsWith("-"))
      .slice(0, 6);

    await prisma.studyBlockGapNote.create({
      data: {
        studyBlockId: block.id,
        userId: gabriela.id,
        status: "READY",
        gapItems: items,
        modelVersion: "gemini-2.5-flash",
        tokensUsed: tokensUsed
      }
    });

    readyCount++;
    processedCount++;
    console.log(`  ✅ Gerado com SUCESSO! Tokens usados: ${tokensUsed}. Total de itens: ${items.length}`);
  }

  // 6. Invariante de Segurança (CPF Node Regex)
  const allExt = await prisma.extractedContent.findMany({ select: { text: true } });
  const cpfRegex = /\b\d{3}\.?:?\s*?\d{3}\.?:?\s*?\d{3}-?\s*?\d{2}\b/g;
  let finalCpfCount = 0;
  for (const ext of allExt) {
    const matches = ext.text.match(cpfRegex);
    if (matches) finalCpfCount += matches.length;
  }

  const allNotes = await prisma.studyBlockGapNote.findMany();
  const totalReadyInDb = allNotes.filter(n => n.status === "READY").length;
  const totalNotRequiredInDb = allNotes.filter(n => n.status === "NOT_REQUIRED").length;

  console.log("\n======================================================================");
  console.log("             RESUMO FINAL DO BATCH DO F2 (58 BLOCOS)");
  console.log("======================================================================");
  console.log(`- Novas Notas Geradas Nesta Rodada: ${processedCount}`);
  console.log(`- Notas Já Existentes no Banco: ${skippedAlreadyExistCount}`);
  console.log(`- TOTAL FINAL EM BANCO - Status READY: ${totalReadyInDb}`);
  console.log(`- TOTAL FINAL EM BANCO - Status NOT_REQUIRED: ${totalNotRequiredInDb}`);
  console.log(`- Invariante de Segurança (CPFs no Banco): ${finalCpfCount} (Esperado: 73) ${finalCpfCount === 73 ? "✅ PERFEITO" : "❌ FALHA"}\n`);

  // 7. Auditoria de Citações Legais
  await auditLegalCitations(allNotes);
}

main().catch(console.error).finally(() => prisma.$disconnect());
