import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sanitizeCpf } from "./run-f2-pilot-fixed";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

function assertCpfSanitized(text: string) {
  const cpfRegex = /\b\d{3}\.?:?\s*?\d{3}\.?:?\s*?\d{3}-?\s*?\d{2}\b/g;
  if (cpfRegex.test(text)) {
    throw new Error("🔴 SECURITY BREACH: Ocorrência de CPF detectada no texto!");
  }
}

const PILOT_BLOCKS = [
  {
    type: "RELAÇÃO_FORTE",
    id: "cmss35if4000piyao90mqrh43", // Lei 8.112/90
    title: "Lei 8.112/90 – Estatuto dos Servidores Públicos Federais"
  },
  {
    type: "CFC_MAIS_ESTREITO",
    id: "cmss35fow0007iyaoey50kzf4", // Atos Administrativos
    title: "Atos Administrativos"
  },
  {
    type: "CFC_MAIS_AMPLO",
    id: "cmss35f290003iyao33it738i", // Conceitos, Fontes e Poderes
    title: "Conceitos e Fontes + Adm Pública + Poderes"
  }
];

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não encontrada no .env!");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const tmpF2Dir = path.join(process.cwd(), "tmp", "f2");

  console.log("======================================================================");
  console.log("  RE-EXECUÇÃO DOS 3 PILOTOS COM CFC E ESTRATÉGIA INTEGRICAIS (SEM CORTE) ");
  console.log("======================================================================\n");

  const results: any[] = [];

  for (const pilot of PILOT_BLOCKS) {
    console.log(`📌 Processando Piloto [${pilot.type}]: ${pilot.title}...`);

    const cfcBlock = await prisma.studyBlock.findUnique({
      where: { id: pilot.id },
      include: { material: true }
    });

    if (!cfcBlock) continue;

    // 1. CFC INTEGRAL (SEM CORTE)
    const cfcExtracted = await prisma.extractedContent.findMany({
      where: {
        materialId: cfcBlock.materialId,
        pageNumber: { gte: cfcBlock.pageStart, lte: cfcBlock.pageEnd }
      },
      orderBy: { pageNumber: "asc" }
    });

    const cfcRawText = cfcExtracted.map(e => e.text).join("\n\n");
    const cfcCleanText = sanitizeCpf(cfcRawText);
    assertCpfSanitized(cfcCleanText);

    // 2. ESTRATÉGIA INTEGRAL (SEM CORTE)
    let estrategiaCleanText = "";
    if (cfcBlock.officialTopicId) {
      const mappings = await prisma.syllabusTopicMapping.findMany({
        where: { v2TopicId: cfcBlock.officialTopicId }
      });

      const v1TopicIds = mappings.map(m => m.v1TopicId);

      const estrategiaBlocks = await prisma.studyBlock.findMany({
        where: {
          officialTopicId: { in: v1TopicIds },
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
Título: ${cfcBlock.title}
Conteúdo:
${cfcCleanText}

COBERTURA DE REFERÊNCIA (EDITAL/ESTRATÉGIA):
${estrategiaCleanText}
`;

    console.log(`  • cfcCharLength: ${cfcCleanText.length.toLocaleString()} chars`);
    console.log(`  • estrategiaCharLength: ${estrategiaCleanText.length.toLocaleString()} chars`);
    console.log(`  • Requisição enviada para a Gemini API...`);

    const res = await model.generateContent(prompt);
    const rawOutput = res.response.text().trim();

    const record = {
      pilotType: pilot.type,
      blockId: pilot.id,
      blockTitle: cfcBlock.title,
      cfcCharLength: cfcCleanText.length,
      estrategiaCharLength: estrategiaCleanText.length,
      output: rawOutput,
      generatedAt: new Date().toISOString()
    };

    const jsonPath = path.join(tmpF2Dir, `block_${pilot.id}_full_context.json`);
    const mdPath = path.join(tmpF2Dir, `block_${pilot.id}_full_context.md`);

    fs.writeFileSync(jsonPath, JSON.stringify(record, null, 2), "utf-8");
    fs.writeFileSync(mdPath, `# Nota de Lacunas (Contexto Integral) - ${pilot.type}\n**Bloco:** ${cfcBlock.title}\n\n${rawOutput}\n`, "utf-8");

    results.push(record);
    console.log(`  ✅ Saída salva em tmp/f2/block_${pilot.id}_full_context.md\n`);
  }

  console.log("======================================================================");
  console.log("             TESTE DE CONTEXTO INTEGRAL CONCLUÍDO!");
  console.log("======================================================================\n");
}

main().catch(console.error).finally(() => prisma.$disconnect());
