import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// Regra de Sanitização Estrita de CPF (Executada ANTES da montagem do Prompt)
export function sanitizeCpf(text: string): string {
  if (!text) return "";
  // Substituir qualquer variação de CPF (com ou sem pontuação) por [CPF_REDACTED]
  const cpfRegex = /\b\d{3}\.?:?\s*?\d{3}\.?:?\s*?\d{3}-?\s*?\d{2}\b/g;
  return text.replace(cpfRegex, "[CPF_REDACTED]");
}

// Teste unitário de invariante de sanitização
function assertCpfSanitized(text: string) {
  const cpfRegex = /\b\d{3}\.?:?\s*?\d{3}\.?:?\s*?\d{3}-?\s*?\d{2}\b/g;
  if (cpfRegex.test(text)) {
    throw new Error("🔴 SECURITY BREACH: Ocorrência de CPF detectada no texto sanitizado antes do envio para a LLM!");
  }
}

// 3 Blocos Selecionados para o Piloto
const PILOT_BLOCKS = [
  {
    type: "EXATO",
    id: "cmss35haq000hiyao4gxqyjj1",
    description: "CFC e Edital cobrem exatamente o mesmo escopo (Lei 9.784/99)"
  },
  {
    type: "CFC_MAIS_ESTREITO",
    id: "cmss35fow0007iyaoey50kzf4",
    description: "CFC cobre menos tópicos que o Edital/Estratégia V1 (Atos Administrativos)"
  },
  {
    type: "CFC_MAIS_AMPLO",
    id: "cmss35f290003iyao33it738i",
    description: "CFC agrupa múltiplos tópicos (Conceitos, Fontes, Adm Pública e Poderes)"
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
  console.log("            PILOTO F2: NOTA DE LACUNAS (3 BLOCOS SELECIONADOS)        ");
  console.log("======================================================================\n");

  const results: any[] = [];

  for (const pilot of PILOT_BLOCKS) {
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`📌 Processando Bloco [${pilot.type}]: ${pilot.id}`);
    console.log(`   Descrição: ${pilot.description}`);

    const cfcBlock = await prisma.studyBlock.findUnique({
      where: { id: pilot.id },
      include: { material: true, subject: true }
    });

    if (!cfcBlock) {
      console.error(`Bloco ${pilot.id} não encontrado.`);
      continue;
    }

    // 1. Obter texto extraído do CFC (limitado a 15.000 chars)
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

    // 2. Obter conteúdo de referência do Estratégia
    let estrategiaRawText = "";
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
        select: { title: true, description: true }
      });

      estrategiaRawText = estrategiaBlocks.map(b => `- ${b.title}: ${b.description || ""}`).join("\n").slice(0, 15000);
    }

    const estrategiaCleanText = sanitizeCpf(estrategiaRawText);
    assertCpfSanitized(estrategiaCleanText);

    // 3. Montar Prompt Estrito conforme especificação
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
    console.log(`🚀 Enviando requisição para Gemini API (gemini-2.5-flash)...`);
    const res = await model.generateContent(prompt);
    const rawOutput = res.response.text().trim();

    // Garantir formatação limpa (limitar a 6 linhas e remover preâmbulos se houver)
    const lines = rawOutput
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.startsWith("-"))
      .slice(0, 6);

    const finalOutput = lines.length > 0 ? lines.join("\n") : rawOutput;

    // Salvar em tmp/f2/
    const jsonPath = path.join(tmpF2Dir, `block_${pilot.id}_gap_note.json`);
    const mdPath = path.join(tmpF2Dir, `block_${pilot.id}_gap_note.md`);

    const record = {
      pilotType: pilot.type,
      blockId: pilot.id,
      blockTitle: cfcBlock.title,
      subjectName: cfcBlock.subject.name,
      officialTopicId: cfcBlock.officialTopicId,
      rawOutput,
      finalOutput,
      cfcCharLength: cfcCleanText.length,
      estrategiaCharLength: estrategiaCleanText.length,
      generatedAt: new Date().toISOString()
    };

    fs.writeFileSync(jsonPath, JSON.stringify(record, null, 2), "utf-8");
    fs.writeFileSync(mdPath, `# Nota de Lacunas - ${pilot.type}\n**Bloco:** ${cfcBlock.title}\n\n${finalOutput}\n`, "utf-8");

    results.push(record);
    console.log(`✅ Saída salva em tmp/f2/block_${pilot.id}_gap_note.md`);
  }

  console.log("\n======================================================================");
  console.log("            PILOTO F2 CONCLUÍDO COM SUCESSO!");
  console.log("======================================================================\n");
}

main().catch(console.error).finally(() => prisma.$disconnect());
