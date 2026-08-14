import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

export function sanitizeCpf(text: string): string {
  if (!text) return "";
  const cpfRegex = /\b\d{3}\.?:?\s*?\d{3}\.?:?\s*?\d{3}-?\s*?\d{2}\b/g;
  return text.replace(cpfRegex, "[CPF_REDACTED]");
}

function assertCpfSanitized(text: string) {
  const cpfRegex = /\b\d{3}\.?:?\s*?\d{3}\.?:?\s*?\d{3}-?\s*?\d{2}\b/g;
  if (cpfRegex.test(text)) {
    throw new Error("🔴 SECURITY BREACH: Ocorrência de CPF detectada no texto!");
  }
}

const PILOT_BLOCKS = [
  {
    type: "EXATO",
    id: "cmss35haq000hiyao4gxqyjj1",
    description: "Lei 9.784/99 – Processo Administrativo Federal (Filtro EXATO aplicado: apenas admin_t18)"
  },
  {
    type: "CFC_MAIS_ESTREITO",
    id: "cmss35fow0007iyaoey50kzf4",
    description: "Atos Administrativos (CFC cobre menos que o Edital)"
  },
  {
    type: "CFC_MAIS_AMPLO",
    id: "cmss35f290003iyao33it738i",
    description: "Conceitos e Fontes + Adm Pública + Poderes (CFC agrupa múltiplos tópicos)"
  }
];

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não encontrada no .env!");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
  });

  const tmpF2Dir = path.join(process.cwd(), "tmp", "f2");
  if (!fs.existsSync(tmpF2Dir)) {
    fs.mkdirSync(tmpF2Dir, { recursive: true });
  }

  console.log("======================================================================");
  console.log("    RE-EXECUÇÃO DO PILOTO F2 COM INSUMO E TEXTO EXTRAÍDO CORRIGIDO    ");
  console.log("======================================================================\n");

  const results: any[] = [];

  for (const pilot of PILOT_BLOCKS) {
    const cfcBlock = await prisma.studyBlock.findUnique({
      where: { id: pilot.id },
      include: { material: true, subject: true }
    });

    if (!cfcBlock) continue;

    // 1. Obter texto extraído do CFC (usando a coluna correta `e.text`)
    const cfcExtracted = await prisma.extractedContent.findMany({
      where: {
        materialId: cfcBlock.materialId,
        pageNumber: { gte: cfcBlock.pageStart, lte: cfcBlock.pageEnd }
      },
      orderBy: { pageNumber: "asc" }
    });

    const cfcRawText = cfcExtracted.map(e => e.text).join("\n\n").slice(0, 15000);
    const cfcCleanText = sanitizeCpf(cfcRawText);
    assertCpfSanitized(cfcCleanText);

    // 2. Obter conteúdo de referência do Estratégia com o filtro corrigido
    let estrategiaCleanText = "";
    if (cfcBlock.officialTopicId) {
      const mappings = await prisma.syllabusTopicMapping.findMany({
        where: { v2TopicId: cfcBlock.officialTopicId }
      });

      // Se existir mapeamento EXATO para este tópico V2, usar estritamente os EXATOS
      const exactMappings = mappings.filter(m => m.relationType === "EXATO");
      const targetMappings = exactMappings.length > 0 ? exactMappings : mappings;
      const v1TopicIds = targetMappings.map(m => m.v1TopicId);

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
          where: {
            materialId: eb.materialId,
            pageNumber: { gte: eb.pageStart, lte: eb.pageEnd }
          },
          orderBy: { pageNumber: "asc" }
        });
        const ebText = ext.map(e => e.text).join("\n").slice(0, 5000);
        if (ebText.trim()) {
          estrategiaTexts.push(`--- BLOCO ESTRATÉGIA: ${eb.title} ---\n${ebText}`);
        }
      }

      estrategiaCleanText = sanitizeCpf(estrategiaTexts.join("\n\n").slice(0, 15000));
      assertCpfSanitized(estrategiaCleanText);
    }

    // 3. Montar Prompt
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

    // 4. Chamada à API
    const res = await model.generateContent(prompt);
    const rawOutput = res.response.text().trim();

    const record = {
      pilotType: pilot.type,
      blockId: pilot.id,
      blockTitle: cfcBlock.title,
      prompt,
      cfcCharLength: cfcCleanText.length,
      estrategiaCharLength: estrategiaCleanText.length,
      output: rawOutput,
      generatedAt: new Date().toISOString()
    };

    const jsonPath = path.join(tmpF2Dir, `block_${pilot.id}_gap_note_fixed.json`);
    const mdPath = path.join(tmpF2Dir, `block_${pilot.id}_gap_note_fixed.md`);

    fs.writeFileSync(jsonPath, JSON.stringify(record, null, 2), "utf-8");
    fs.writeFileSync(mdPath, `# Nota de Lacunas - ${pilot.type}\n**Bloco:** ${cfcBlock.title}\n\n${rawOutput}\n`, "utf-8");

    results.push(record);
  }

  console.log("PILOTO RE-EXECUTADO COM SUCESSO!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
