import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

function assertCpfSanitized(text: string) {
  const cpfRegex = /\b\d{3}\.?:?\s*?\d{3}\.?:?\s*?\d{3}-?\s*?\d{2}\b/g;
  const matches = text.match(cpfRegex);
  if (matches && matches.length > 0) {
    throw new Error(`🔴 SECURITY BREACH: Ocorrência de CPF detectada no arquivo de export! Ocorrências: ${matches.length}`);
  }
}

async function main() {
  console.log("======================================================================");
  console.log("      EXPORTAÇÃO DOS FLASHCARDS NOVOS (DELTA PÓS 14/08/2026)          ");
  console.log("======================================================================\n");

  const gabriela = await prisma.user.findUnique({
    where: { email: "gabriela.furtado.p@gmail.com" }
  });

  if (!gabriela) {
    throw new Error("Usuária Gabriela não encontrada no banco de dados.");
  }

  const userId = gabriela.id;

  // Data de corte: 14/08/2026 00:00:00.000Z
  const cutoffDate = new Date("2026-08-14T00:00:00.000Z");

  const deltaCards = await prisma.flashcard.findMany({
    where: {
      userId,
      createdAt: { gte: cutoffDate }
    },
    include: {
      subject: { select: { id: true, name: true } },
      studyBlock: { select: { id: true, title: true, officialTopicId: true } },
      material: { select: { id: true, fileName: true, provider: true, materialRole: true } },
      _count: { select: { reviews: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  console.log(`Total de Flashcards Novos Encontrados (createdAt >= 14/08): ${deltaCards.length}\n`);

  const subjectCounts: Record<string, number> = {};
  deltaCards.forEach(c => {
    const sName = c.subject?.name || "Sem Matéria";
    subjectCounts[sName] = (subjectCounts[sName] || 0) + 1;
  });

  console.log("--- DISTRIBUIÇÃO DOS CARDS DO DELTA POR MATÉRIA ---");
  console.table(subjectCounts);

  const exportDir = path.join(process.cwd(), "tmp", "export");
  fs.mkdirSync(exportDir, { recursive: true });
  const exportPath = path.join(exportDir, "flashcards-delta.jsonl");

  const jsonlLines: string[] = [];

  deltaCards.forEach(c => {
    const itemObj = {
      id: c.id,
      front: c.question,
      back: c.answer,
      type: c.type,
      status: c.status,
      subjectId: c.subjectId,
      subjectName: c.subject?.name || null,
      blockId: c.studyBlockId || null,
      blockTitle: c.studyBlock?.title || null,
      officialTopicId: c.studyBlock?.officialTopicId || null,
      materialId: c.materialId || null,
      materialName: c.material?.fileName || null,
      materialProvider: c.material?.provider || null,
      materialRole: c.material?.materialRole || null,
      createdAt: c.createdAt.toISOString(),
      repetitions: c.repetitionCount || 0,
      repetitionCount: c.repetitionCount || 0,
      lapses: c.lapseCount || 0,
      lapseCount: c.lapseCount || 0,
      interval: c.intervalDays || 0,
      intervalDays: c.intervalDays || 0,
      easeFactor: c.easeFactor ?? 2.5,
      dueDate: c.nextReviewAt ? c.nextReviewAt.toISOString() : null,
      nextReviewAt: c.nextReviewAt ? c.nextReviewAt.toISOString() : null,
      lastReviewedAt: c.lastReviewedAt ? c.lastReviewedAt.toISOString() : null
    };

    jsonlLines.push(JSON.stringify(itemObj));
  });

  const fileContent = jsonlLines.join("\n");
  fs.writeFileSync(exportPath, fileContent, "utf-8");

  assertCpfSanitized(fileContent);
  console.log("\n✅ Checagem de CPF realizada: 0 CPFs no arquivo JSONL (100% Sanitizado!).");

  const stat = fs.statSync(exportPath);
  console.log(`- Arquivo salvo em: ${exportPath}`);
  console.log(`- Total de Linhas no flashcards-delta.jsonl: ${jsonlLines.length}`);
  console.log(`- Tamanho do Arquivo: ${stat.size.toLocaleString()} bytes`);
}

main().finally(() => prisma.$disconnect());
