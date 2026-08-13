import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

// Carregar .env
require("dotenv").config();

const prisma = new PrismaClient();

interface CheckpointData {
  rotulo: string;
  timestamp: string;
  pgDumpVersion: string;
  pgServerVersion: string;
  metrics: {
    blocksByTheoryStatus: Record<string, number>;
    blocksByQuestionsStatus: Record<string, number>;
    blocksByFlashcardsStatus: Record<string, number>;
    blocksByMethodology: Record<string, number>;
    blocksBySubject: Record<string, number>;
    totalStudyBlocks: number;
    completedTheoryBlocksTotal: number;
    completedTheoryBlocksWeight2: number;
    flashcardsByReviewState: Record<string, number>;
    totalFlashcards: number;
    orphanedFlashcards: number;
    materialsByStatus: Record<string, number>;
    totalMaterials: number;
    totalQuestionReviewTasks: number;
    totalExtractedContent: number;
    totalStudySessionLogs: number;
    // Campos resilientes a alterações futuras no schema (nulos se a coluna/tabela ainda não existir)
    materialsByRole?: Record<string, number> | null;
    subjectsBySourceMode?: Record<string, number> | null;
    totalTopicGapNotes?: number | null;
  };
}

async function collectMetrics(rotulo: string): Promise<CheckpointData> {
  // 1. StudyBlocks por theoryStatus
  const blocksTheoryRaw = await prisma.studyBlock.groupBy({
    by: ["theoryStatus"],
    _count: true,
  });
  const blocksByTheoryStatus: Record<string, number> = {};
  for (const b of blocksTheoryRaw) {
    blocksByTheoryStatus[b.theoryStatus] = b._count;
  }

  // 2. StudyBlocks por questionsStatus
  const blocksQuestionsRaw = await prisma.studyBlock.groupBy({
    by: ["questionsStatus"],
    _count: true,
  });
  const blocksByQuestionsStatus: Record<string, number> = {};
  for (const b of blocksQuestionsRaw) {
    blocksByQuestionsStatus[b.questionsStatus] = b._count;
  }

  // 3. StudyBlocks por flashcardsStatus
  const blocksFlashcardsRaw = await prisma.studyBlock.groupBy({
    by: ["flashcardsStatus"],
    _count: true,
  });
  const blocksByFlashcardsStatus: Record<string, number> = {};
  for (const b of blocksFlashcardsRaw) {
    blocksByFlashcardsStatus[b.flashcardsStatus] = b._count;
  }

  // 4. StudyBlocks por methodology
  const blocksMethodologyRaw = await prisma.studyBlock.groupBy({
    by: ["methodology"],
    _count: true,
  });
  const blocksByMethodology: Record<string, number> = {};
  for (const b of blocksMethodologyRaw) {
    blocksByMethodology[b.methodology] = b._count;
  }

  // 5. StudyBlocks por subjectId
  const blocksSubjectRaw = await prisma.studyBlock.groupBy({
    by: ["subjectId"],
    _count: true,
  });
  const blocksBySubject: Record<string, number> = {};
  for (const b of blocksSubjectRaw) {
    blocksBySubject[b.subjectId] = b._count;
  }

  const totalStudyBlocks = await prisma.studyBlock.count();
  const completedTheoryBlocksTotal = await prisma.studyBlock.count({
    where: { theoryStatus: "COMPLETED" },
  });

  // Matérias de Peso 2 do TRT4
  const weight2SubjectNames = [
    "Direito Constitucional",
    "Direito Processual do Trabalho",
    "Direito do Trabalho",
    "Direito Processual Civil",
    "Direito Administrativo",
  ];
  const weight2Subjects = await prisma.studySubject.findMany({
    where: { name: { in: weight2SubjectNames } },
    select: { id: true },
  });
  const weight2Ids = weight2Subjects.map((s) => s.id);

  const completedTheoryBlocksWeight2 = await prisma.studyBlock.count({
    where: {
      theoryStatus: "COMPLETED",
      subjectId: { in: weight2Ids },
    },
  });

  // 6. Flashcards por reviewState
  const flashcardsReviewStateRaw = await prisma.flashcard.groupBy({
    by: ["reviewState"],
    _count: true,
  });
  const flashcardsByReviewState: Record<string, number> = {};
  for (const f of flashcardsReviewStateRaw) {
    flashcardsByReviewState[f.reviewState] = f._count;
  }

  const totalFlashcards = await prisma.flashcard.count();

  // Flashcards órfãos (dangling references: studyBlockId apontando para bloco que não existe)
  const allFlashcards = await prisma.flashcard.findMany({
    select: { id: true, studyBlockId: true, materialId: true, contentId: true },
  });
  const allBlockIds = new Set((await prisma.studyBlock.findMany({ select: { id: true } })).map((b) => b.id));
  let orphanedFlashcards = 0;
  let flashcardsWithoutBlockId = 0;

  for (const fc of allFlashcards) {
    if (!fc.studyBlockId) {
      flashcardsWithoutBlockId++;
    } else if (!allBlockIds.has(fc.studyBlockId)) {
      orphanedFlashcards++; // Canário do F1: link quebrado para bloco inexistente
    }
  }

  // 7. StudyMaterial por processingStatus e materialRole
  const materialsStatusRaw = await prisma.studyMaterial.groupBy({
    by: ["processingStatus"],
    _count: true,
  });
  const materialsByStatus: Record<string, number> = {};
  for (const m of materialsStatusRaw) {
    materialsByStatus[m.processingStatus] = m._count;
  }

  const materialsRoleRaw = await prisma.studyMaterial.groupBy({
    by: ["materialRole"],
    _count: true,
  });
  const materialsByRoleRecorded: Record<string, number> = {};
  for (const m of materialsRoleRaw) {
    materialsByRoleRecorded[m.materialRole] = m._count;
  }
  const totalMaterials = await prisma.studyMaterial.count();

  // 8. Demais tabelas
  const totalQuestionReviewTasks = await prisma.questionReviewTask.count();
  const totalExtractedContent = await prisma.extractedContent.count();
  const totalStudySessionLogs = await prisma.studySessionLog.count();

  // Coleta resiliente de campos futuros (role, sourceMode, TopicGapNote)
  let materialsByRole: Record<string, number> | null = null;
  try {
    const raw = await (prisma.studyMaterial as any).groupBy({
      by: ["role"],
      _count: true,
    });
    materialsByRole = {};
    for (const r of raw) {
      materialsByRole[r.role] = r._count;
    }
  } catch {
    materialsByRole = null;
  }

  let subjectsBySourceMode: Record<string, number> | null = null;
  try {
    const raw = await (prisma.studySubject as any).groupBy({
      by: ["sourceMode"],
      _count: true,
    });
    subjectsBySourceMode = {};
    for (const r of raw) {
      subjectsBySourceMode[r.sourceMode] = r._count;
    }
  } catch {
    subjectsBySourceMode = null;
  }

  let totalTopicGapNotes: number | null = null;
  try {
    totalTopicGapNotes = await (prisma as any).topicGapNote.count();
  } catch {
    totalTopicGapNotes = null;
  }

  // Obter versão do Postgres
  let pgServerVersion = "PostgreSQL (Supabase Cloud)";
  try {
    const versionRes = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version();`;
    if (versionRes && versionRes.length > 0) {
      pgServerVersion = versionRes[0].version;
    }
  } catch {
    pgServerVersion = "PostgreSQL (Supabase Cloud)";
  }

  let pgDumpVersion = "npx supabase db dump (v2.114.0)";

  return {
    rotulo,
    timestamp: new Date().toISOString(),
    pgDumpVersion,
    pgServerVersion,
    metrics: {
      blocksByTheoryStatus,
      blocksByQuestionsStatus,
      blocksByFlashcardsStatus,
      blocksByMethodology,
      blocksBySubject,
      totalStudyBlocks,
      completedTheoryBlocksTotal,
      completedTheoryBlocksWeight2,
      flashcardsByReviewState,
      totalFlashcards,
      orphanedFlashcards,
      materialsByStatus,
      totalMaterials,
      totalQuestionReviewTasks,
      totalExtractedContent,
      totalStudySessionLogs,
      materialsByRole,
      subjectsBySourceMode,
      totalTopicGapNotes,
    },
  };
}

function compareJSONs(fileA: string, fileB: string) {
  if (!fs.existsSync(fileA) || !fs.existsSync(fileB)) {
    console.error(`Erro: Arquivos para comparação não encontrados (${fileA}, ${fileB}).`);
    process.exit(1);
  }

  const dataA: CheckpointData = JSON.parse(fs.readFileSync(fileA, "utf-8"));
  const dataB: CheckpointData = JSON.parse(fs.readFileSync(fileB, "utf-8"));

  console.log(`\n======================================================================`);
  console.log(`  COMPARAÇÃO DE CHECKPOINTS: [${dataA.rotulo}] vs [${dataB.rotulo}]`);
  console.log(`======================================================================\n`);

  const metricsA = dataA.metrics;
  const metricsB = dataB.metrics;

  let regressionsFound = false;

  const checkNumericMetric = (name: string, valA: number | null | undefined, valB: number | null | undefined, isCriticalDrop = false) => {
    const strA = valA === null || valA === undefined ? "N/A (não existia)" : String(valA);
    const strB = valB === null || valB === undefined ? "N/A (não existia)" : String(valB);
    let deltaStr = "-";
    let alert = "";

    if (typeof valA === "number" && typeof valB === "number") {
      const delta = valB - valA;
      deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;

      if (isCriticalDrop && delta < 0) {
        alert = " ❌ [REGRESSÃO CRÍTICA - QUEDA DETECTADA]";
        regressionsFound = true;
      }
    }

    console.log(` - ${name.padEnd(35)} | Antigo: ${strA.padEnd(16)} | Novo: ${strB.padEnd(16)} | Delta: ${deltaStr}${alert}`);
  };

  console.log("--- METRICAS CHAVE ---");
  checkNumericMetric("Total StudyBlocks", metricsA.totalStudyBlocks, metricsB.totalStudyBlocks);
  checkNumericMetric("Blocos Teoria COMPLETED (Total)", metricsA.completedTheoryBlocksTotal, metricsB.completedTheoryBlocksTotal, true);
  checkNumericMetric("Blocos Teoria COMPLETED (Peso 2)", metricsA.completedTheoryBlocksWeight2, metricsB.completedTheoryBlocksWeight2, true);
  checkNumericMetric("Total Flashcards", metricsA.totalFlashcards, metricsB.totalFlashcards, true);

  // Flashcards órfãos
  const orphanA = metricsA.orphanedFlashcards ?? 0;
  const orphanB = metricsB.orphanedFlashcards ?? 0;
  const orphanAlert = orphanB > 0 ? " ❌ [ALERT - FLASHCARDS ÓRFÃOS DETECTADOS!]" : " ✅ (Ok)";
  if (orphanB > 0) regressionsFound = true;
  console.log(` - ${"Flashcards Órfãos (Canário)".padEnd(35)} | Antigo: ${String(orphanA).padEnd(16)} | Novo: ${String(orphanB).padEnd(16)} | Delta: ${orphanB - orphanA}${orphanAlert}`);

  console.log("\n--- DEMAIS METRICAS ---");
  checkNumericMetric("Total Materials", metricsA.totalMaterials, metricsB.totalMaterials);
  checkNumericMetric("Total QuestionReviewTasks", metricsA.totalQuestionReviewTasks, metricsB.totalQuestionReviewTasks);
  checkNumericMetric("Total ExtractedContent", metricsA.totalExtractedContent, metricsB.totalExtractedContent);
  checkNumericMetric("Total StudySessionLogs", metricsA.totalStudySessionLogs, metricsB.totalStudySessionLogs);
  checkNumericMetric("Total TopicGapNotes", metricsA.totalTopicGapNotes, metricsB.totalTopicGapNotes);

  console.log("\n======================================================================");
  if (regressionsFound) {
    console.log(" ⚠️  STATUS: REGRESSÕES CRÍTICAS OU ÓRFÃOS DETECTADOS! VERIFIQUE ACIMA.");
  } else {
    console.log(" ✅ STATUS: NENHUMA REGRESSÃO CRÍTICA DETECTADA. CHECKPOINTS EM ORDEM.");
  }
  console.log("======================================================================\n");
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--compare") {
    const fileA = args[1];
    const fileB = args[2];
    if (!fileA || !fileB) {
      console.error("Uso: npx tsx scripts/checkpoint.ts --compare <arquivoA.json> <arquivoB.json>");
      process.exit(1);
    }
    compareJSONs(fileA, fileB);
    await prisma.$disconnect();
    return;
  }

  const rotulo = args[0];
  if (!rotulo) {
    console.error("Uso: npx tsx scripts/checkpoint.ts <rotulo>");
    console.error("  ou: npx tsx scripts/checkpoint.ts --compare <fileA.json> <fileB.json>");
    process.exit(1);
  }

  const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!directUrl) {
    console.error("Erro: DIRECT_URL ou DATABASE_URL não encontradas no .env");
    process.exit(1);
  }

  console.log(`\n======================================================================`);
  console.log(`  GERANDO CHECKPOINT DE BANCO & DISTRIBUIÇÃO: [${rotulo}]`);
  console.log(`======================================================================\n`);

  // Criar pastas backups e docs/checkpoints se não existirem
  const backupsDir = path.join(process.cwd(), "backups");
  const jsonDir = path.join(process.cwd(), "docs", "checkpoints");

  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpFilePath = path.join(backupsDir, `${rotulo}-${timestamp}.dump`);
  const jsonFilePath = path.join(jsonDir, `${rotulo}.json`);

  // 1. Coletar distribuição de dados via Prisma
  console.log("[1/3] Coletando métricas e distribuição dos dados...");
  const checkpointData = await collectMetrics(rotulo);

  // Salvar JSON no caminho docs/checkpoints/<rotulo>.json
  fs.writeFileSync(jsonFilePath, JSON.stringify(checkpointData, null, 2), "utf-8");
  console.log(`  -> JSON de distribuição salvo em: docs/checkpoints/${rotulo}.json`);

  // 2. Executar dump via npx supabase db dump
  console.log("[2/3] Executando dump do schema public via Supabase CLI...");
  console.log(`  -> Versão pg_dump/CLI: ${checkpointData.pgDumpVersion}`);
  console.log(`  -> Versão Servidor Postgres: ${checkpointData.pgServerVersion}`);

  try {
    const dumpCmd = `npx supabase db dump --db-url "${directUrl}" --schema public -f "${dumpFilePath}"`;
    execSync(dumpCmd, { stdio: "inherit" });
  } catch (err: any) {
    console.error("\n⚠️ AVISO: supabase db dump gerou aviso ou erro.", err.message);
  }

  // 3. Exibir resumo e confirmação
  let dumpSizeMB = "N/A";
  if (fs.existsSync(dumpFilePath)) {
    const stats = fs.statSync(dumpFilePath);
    dumpSizeMB = (stats.size / (1024 * 1024)).toFixed(2) + " MB";
  }

  console.log("\n[3/3] RESUMO DO CHECKPOINT GERADO:");
  console.log(`----------------------------------------------------------------------`);
  console.log(` Rótulo:                                ${checkpointData.rotulo}`);
  console.log(` Dump Postgres (Local/Ignorado no Git): ${dumpFilePath} (${dumpSizeMB})`);
  console.log(` Distribuição JSON (Commitado no Git):  ${jsonFilePath}`);
  console.log(` Total StudyBlocks:                     ${checkpointData.metrics.totalStudyBlocks}`);
  console.log(` Teoria COMPLETED (Total):              ${checkpointData.metrics.completedTheoryBlocksTotal}`);
  console.log(` Teoria COMPLETED (Peso 2 TRT4):        ${checkpointData.metrics.completedTheoryBlocksWeight2}`);
  console.log(` Total Flashcards:                      ${checkpointData.metrics.totalFlashcards}`);
  console.log(` Flashcards Órfãos:                     ${checkpointData.metrics.orphanedFlashcards}`);
  console.log(` Total History Logs:                    ${checkpointData.metrics.totalStudySessionLogs}`);
  console.log(`----------------------------------------------------------------------\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Erro fatal na execução do checkpoint:", err);
  process.exit(1);
});
