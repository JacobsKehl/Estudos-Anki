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

function normalizeText(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^\w\s]/gi, "")        // Remove pontuação
    .replace(/\s+/g, " ")           // Espaços colapsados
    .trim();
}

async function main() {
  console.log("======================================================================");
  console.log("              EXPORTAÇÃO & AUDITORIA DE FLASHCARDS                    ");
  console.log("======================================================================\n");

  const gabriela = await prisma.user.findUnique({
    where: { email: "gabriela.furtado.p@gmail.com" }
  });

  if (!gabriela) {
    throw new Error("Usuária Gabriela não encontrada no banco de dados.");
  }

  const userId = gabriela.id;

  // Buscar TODOS os flashcards da Gabriela com as relações necessárias
  const cards = await prisma.flashcard.findMany({
    where: { userId },
    include: {
      subject: { select: { id: true, name: true } },
      studyBlock: { select: { id: true, title: true, officialTopicId: true } },
      material: { select: { id: true, fileName: true, provider: true, materialRole: true } },
      _count: { select: { reviews: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  console.log(`Total de Flashcards Encontrados (Gabriela): ${cards.length}\n`);

  // ------------------------------------------------------------------
  // 1. Total por status
  // ------------------------------------------------------------------
  const statusCounts: Record<string, number> = {};
  cards.forEach(c => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  });

  // ------------------------------------------------------------------
  // 2. Total por matéria (subjectName)
  // ------------------------------------------------------------------
  const subjectCounts: Record<string, number> = {};
  cards.forEach(c => {
    const sName = c.subject?.name || "Sem Matéria";
    subjectCounts[sName] = (subjectCounts[sName] || 0) + 1;
  });

  // ------------------------------------------------------------------
  // 3. Total por provider do material de origem
  // ------------------------------------------------------------------
  const providerCounts: Record<string, number> = {};
  cards.forEach(c => {
    const prov = c.material?.provider || "NULO / SEM MATERIAL";
    providerCounts[prov] = (providerCounts[prov] || 0) + 1;
  });

  // ------------------------------------------------------------------
  // 4. Distribuição de cards por bloco
  // ------------------------------------------------------------------
  const blockCardCounts: Record<string, number> = {};
  let cardsWithoutBlock = 0;
  cards.forEach(c => {
    if (c.studyBlockId) {
      blockCardCounts[c.studyBlockId] = (blockCardCounts[c.studyBlockId] || 0) + 1;
    } else {
      cardsWithoutBlock++;
    }
  });

  let blocksRange1to5 = 0;
  let blocksRange6to10 = 0;
  let blocksRange11to20 = 0;
  let blocksRange21Plus = 0;

  const blocksList = Object.entries(blockCardCounts);
  blocksList.forEach(([_, count]) => {
    if (count >= 1 && count <= 5) blocksRange1to5++;
    else if (count >= 6 && count <= 10) blocksRange6to10++;
    else if (count >= 11 && count <= 20) blocksRange11to20++;
    else if (count >= 21) blocksRange21Plus++;
  });

  // ------------------------------------------------------------------
  // 5. Duplicatas exatas (Frente normalizada)
  // ------------------------------------------------------------------
  const frontGroups: Record<string, string[]> = {};
  cards.forEach(c => {
    const norm = normalizeText(c.question);
    if (!frontGroups[norm]) frontGroups[norm] = [];
    frontGroups[norm].push(c.id);
  });

  let duplicateGroupsCount = 0;
  let duplicateCardsTotal = 0;

  Object.values(frontGroups).forEach(group => {
    if (group.length >= 2) {
      duplicateGroupsCount++;
      duplicateCardsTotal += group.length;
    }
  });

  // ------------------------------------------------------------------
  // 6. Revisados vs Nunca Revisados
  // ------------------------------------------------------------------
  let reviewedCardsCount = 0;
  let neverReviewedCardsCount = 0;

  cards.forEach(c => {
    const hasRepetitions = (c.repetitionCount || 0) > 0;
    const hasLastReviewed = c.lastReviewedAt !== null;
    const hasReviewsLogged = c._count.reviews > 0;

    if (hasRepetitions || hasLastReviewed || hasReviewsLogged) {
      reviewedCardsCount++;
    } else {
      neverReviewedCardsCount++;
    }
  });

  // ------------------------------------------------------------------
  // EXIBIÇÃO DOS RELATÓRIOS (CONTAGENS SOLICITADAS)
  // ------------------------------------------------------------------
  console.log("======================================================================");
  console.log("1. TOTAL POR STATUS:");
  console.log("======================================================================");
  console.table(statusCounts);

  console.log("======================================================================");
  console.log("2. TOTAL POR MATÉRIA:");
  console.log("======================================================================");
  console.table(subjectCounts);

  console.log("======================================================================");
  console.log("3. TOTAL POR PROVIDER DO MATERIAL DE ORIGEM:");
  console.log("======================================================================");
  console.table(providerCounts);

  console.log("======================================================================");
  console.log("4. DISTRIBUIÇÃO DE CARDS POR BLOCO:");
  console.log("======================================================================");
  console.log(`- Total de Blocos com Cards: ${blocksList.length}`);
  console.log(`- Blocos com 1 a 5 cards:   ${blocksRange1to5}`);
  console.log(`- Blocos com 6 a 10 cards:  ${blocksRange6to10}`);
  console.log(`- Blocos com 11 a 20 cards: ${blocksRange11to20}`);
  console.log(`- Blocos com 21+ cards:     ${blocksRange21Plus}`);
  console.log(`- Cards fora de Bloco (blockId = null): ${cardsWithoutBlock}\n`);

  console.log("======================================================================");
  console.log("5. DUPLICATAS EXATAS (FRENTE NORMALIZADA):");
  console.log("======================================================================");
  console.log(`- Grupos com 2+ cards idênticos: ${duplicateGroupsCount}`);
  console.log(`- Total de Cards nesses Grupos:  ${duplicateCardsTotal}\n`);

  console.log("======================================================================");
  console.log("6. REVISADOS vs NUNCA REVISADOS:");
  console.log("======================================================================");
  console.log(`- Cards Revisados (repetitionCount > 0 ou histórico): ${reviewedCardsCount}`);
  console.log(`- Cards NUNCA Revisados:                            ${neverReviewedCardsCount}\n`);

  // ------------------------------------------------------------------
  // GERAÇÃO DO ARQUIVO JSONL
  // ------------------------------------------------------------------
  const exportDir = path.join(process.cwd(), "tmp", "export");
  fs.mkdirSync(exportDir, { recursive: true });
  const exportPath = path.join(exportDir, "flashcards-audit.jsonl");

  const jsonlLines: string[] = [];

  cards.forEach(c => {
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
      // Mapeamento SRS do Schema Prisma:
      // repetitionCount (schema) -> repetitions
      // lapseCount (schema) -> lapses
      // intervalDays (schema) -> interval
      // easeFactor (schema) -> easeFactor
      // nextReviewAt (schema) -> dueDate
      // lastReviewedAt (schema) -> lastReviewedAt
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

  // ------------------------------------------------------------------
  // CHECAGEM DE CPF E METADADOS DO ARQUIVO
  // ------------------------------------------------------------------
  console.log("======================================================================");
  console.log("CHECAGEM DE CPF & METADADOS DO ARQUIVO GERADO:");
  console.log("======================================================================");

  // Assert CPF
  assertCpfSanitized(fileContent);
  console.log("✅ Checagem de CPF realizada: 0 CPFs encontrados no arquivo JSONL (100% Sanitizado!).");

  const stat = fs.statSync(exportPath);
  console.log(`- Arquivo salvo em: ${exportPath}`);
  console.log(`- Total de Linhas no JSONL: ${jsonlLines.length}`);
  console.log(`- Tamanho do Arquivo: ${stat.size.toLocaleString()} bytes`);
  console.log(`- Bate com o total do Item 1: ${jsonlLines.length === cards.length ? "SIM ✅" : "NÃO ❌"}`);
}

main().finally(() => prisma.$disconnect());
