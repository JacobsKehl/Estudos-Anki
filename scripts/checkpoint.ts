import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { getAllSubjectsMetrics, getGlobalMetrics } from "../src/lib/services/subject-metrics";

require("dotenv").config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || process.env.DIRECT_URL,
    },
  },
});

interface CheckpointData {
  rotulo: string;
  timestamp: string;
  pgDumpVersion: string;
  pgServerVersion: string;
  metrics: {
    gabrielaMetrics: {
      userId: string;
      email: string;
      totalStudyBlocks: number;
      completedTheoryBlocksTotal: number;
      completedTheoryBlocksWeight2: number;
      totalFlashcards: number;
      orphanedFlashcards: number;
      appCompleteness?: {
        globalProgressPct: number;
        completedTheoryBlocks: number;
        totalTheoryBlocks: number;
        bySubject: Record<string, { totalBlocks: number; completedBlocks: number; progressPct: number }>;
      } | null;
    };
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
    materialsByRole?: Record<string, number> | null;
    subjectsBySourceMode?: Record<string, number> | null;
    totalTopicGapNotes?: number | null;
    syllabusVersionsCount?: number;
    syllabusSubjectsCount?: number;
    syllabusTopicsCount?: number;
  };
}

async function collectMetrics(rotulo: string): Promise<CheckpointData> {
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

  const gabrielaUser = await prisma.user.findFirst({
    where: { email: "gabriela.furtado.p@gmail.com" },
    select: { id: true, email: true },
  });

  let gabrielaMetrics: CheckpointData["metrics"]["gabrielaMetrics"] = {
    userId: gabrielaUser?.id ?? "N/A",
    email: "gabriela.furtado.p@gmail.com",
    totalStudyBlocks: 0,
    completedTheoryBlocksTotal: 0,
    completedTheoryBlocksWeight2: 0,
    totalFlashcards: 0,
    orphanedFlashcards: 0,
    appCompleteness: null,
  };

  if (gabrielaUser) {
    const totalBlocks = await prisma.studyBlock.count({ where: { userId: gabrielaUser.id } });
    const completedTotal = await prisma.studyBlock.count({ where: { userId: gabrielaUser.id, theoryStatus: "COMPLETED" } });
    const completedWeight2 = await prisma.studyBlock.count({
      where: { userId: gabrielaUser.id, theoryStatus: "COMPLETED", subjectId: { in: weight2Ids } },
    });
    const totalFc = await prisma.flashcard.count({ where: { userId: gabrielaUser.id } });

    const gabrielaCards = await prisma.flashcard.findMany({
      where: { userId: gabrielaUser.id },
      select: { id: true, studyBlockId: true },
    });
    const gabrielaBlockIds = new Set(
      (await prisma.studyBlock.findMany({ where: { userId: gabrielaUser.id }, select: { id: true } })).map((b) => b.id)
    );

    let gabrielaOrphans = 0;
    for (const fc of gabrielaCards) {
      if (fc.studyBlockId && !gabrielaBlockIds.has(fc.studyBlockId)) {
        gabrielaOrphans++;
      }
    }

    let gabrielaAppCompleteness = null;
    try {
      const allMetrics = await getAllSubjectsMetrics(gabrielaUser.id);
      const globalStats = await getGlobalMetrics(gabrielaUser.id);
      const bySubjectMap: Record<string, { totalBlocks: number; completedBlocks: number; progressPct: number }> = {};
      for (const m of allMetrics) {
        bySubjectMap[m.name] = {
          totalBlocks: m.metrics.totalBlocks,
          completedBlocks: m.metrics.completedBlocks,
          progressPct: m.metrics.progress,
        };
      }
      gabrielaAppCompleteness = {
        globalProgressPct: globalStats.summary.globalProgress,
        completedTheoryBlocks: globalStats.summary.completedBlocks,
        totalTheoryBlocks: globalStats.summary.totalBlocks,
        bySubject: bySubjectMap,
      };
    } catch (e: any) {
      console.warn("  ⚠️ Não foi possível calcular complitude da aplicação:", e.message);
    }

    gabrielaMetrics = {
      userId: gabrielaUser.id,
      email: gabrielaUser.email || "",
      totalStudyBlocks: totalBlocks,
      completedTheoryBlocksTotal: completedTotal,
      completedTheoryBlocksWeight2: completedWeight2,
      totalFlashcards: totalFc,
      orphanedFlashcards: gabrielaOrphans,
      appCompleteness: gabrielaAppCompleteness,
    };
  }

  const blocksTheoryRaw = await prisma.studyBlock.groupBy({ by: ["theoryStatus"], _count: true });
  const blocksByTheoryStatus: Record<string, number> = {};
  for (const b of blocksTheoryRaw) blocksByTheoryStatus[b.theoryStatus] = b._count;

  const blocksQuestionsRaw = await prisma.studyBlock.groupBy({ by: ["questionsStatus"], _count: true });
  const blocksByQuestionsStatus: Record<string, number> = {};
  for (const b of blocksQuestionsRaw) blocksByQuestionsStatus[b.questionsStatus] = b._count;

  const blocksFlashcardsRaw = await prisma.studyBlock.groupBy({ by: ["flashcardsStatus"], _count: true });
  const blocksByFlashcardsStatus: Record<string, number> = {};
  for (const b of blocksFlashcardsRaw) blocksByFlashcardsStatus[b.flashcardsStatus] = b._count;

  const blocksMethodologyRaw = await prisma.studyBlock.groupBy({ by: ["methodology"], _count: true });
  const blocksByMethodology: Record<string, number> = {};
  for (const b of blocksMethodologyRaw) blocksByMethodology[b.methodology] = b._count;

  const blocksSubjectRaw = await prisma.studyBlock.groupBy({ by: ["subjectId"], _count: true });
  const blocksBySubject: Record<string, number> = {};
  for (const b of blocksSubjectRaw) blocksBySubject[b.subjectId] = b._count;

  const totalStudyBlocks = await prisma.studyBlock.count();
  const completedTheoryBlocksTotal = await prisma.studyBlock.count({ where: { theoryStatus: "COMPLETED" } });
  const completedTheoryBlocksWeight2 = await prisma.studyBlock.count({
    where: { theoryStatus: "COMPLETED", subjectId: { in: weight2Ids } },
  });

  const flashcardsReviewStateRaw = await prisma.flashcard.groupBy({ by: ["reviewState"], _count: true });
  const flashcardsByReviewState: Record<string, number> = {};
  for (const f of flashcardsReviewStateRaw) flashcardsByReviewState[f.reviewState || "UNKNOWN"] = f._count;

  const totalFlashcards = await prisma.flashcard.count();
  const allFlashcards = await prisma.flashcard.findMany({ select: { id: true, studyBlockId: true } });
  const allBlockIds = new Set((await prisma.studyBlock.findMany({ select: { id: true } })).map((b) => b.id));
  let orphanedFlashcards = 0;
  for (const fc of allFlashcards) {
    if (fc.studyBlockId && !allBlockIds.has(fc.studyBlockId)) orphanedFlashcards++;
  }

  const materialsStatusRaw = await prisma.studyMaterial.groupBy({ by: ["processingStatus"], _count: true });
  const materialsByStatus: Record<string, number> = {};
  for (const m of materialsStatusRaw) materialsByStatus[m.processingStatus] = m._count;
  const totalMaterials = await prisma.studyMaterial.count();

  const totalQuestionReviewTasks = await prisma.questionReviewTask.count();
  const totalExtractedContent = await prisma.extractedContent.count();
  const totalStudySessionLogs = await prisma.studySessionLog.count();

  let materialsByRole: Record<string, number> | null = null;
  try {
    const raw = await prisma.studyMaterial.groupBy({ by: ["materialRole"], _count: true });
    materialsByRole = {};
    for (const r of raw) materialsByRole[r.materialRole] = r._count;
  } catch {
    materialsByRole = null;
  }

  let subjectsBySourceMode: Record<string, number> | null = null;

  let totalTopicGapNotes: number | null = null;

  // Taxonomy tables counts
  let syllabusVersionsCount = 0;
  let syllabusSubjectsCount = 0;
  let syllabusTopicsCount = 0;
  try {
    syllabusVersionsCount = await prisma.syllabusVersion.count();
    syllabusSubjectsCount = await prisma.syllabusSubject.count();
    syllabusTopicsCount = await prisma.syllabusTopic.count();
  } catch {}

  let pgServerVersion = "PostgreSQL (Supabase Cloud)";
  try {
    const versionRes = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version();`;
    if (versionRes && versionRes.length > 0) pgServerVersion = versionRes[0].version;
  } catch {
    pgServerVersion = "PostgreSQL (Supabase Cloud)";
  }

  return {
    rotulo,
    timestamp: new Date().toISOString(),
    pgDumpVersion: "pg_dump (PostgreSQL)",
    pgServerVersion,
    metrics: {
      gabrielaMetrics,
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
      syllabusVersionsCount,
      syllabusSubjectsCount,
      syllabusTopicsCount,
    },
  };
}

export function verifyDumpFileStrict(dumpFilePath: string) {
  if (!fs.existsSync(dumpFilePath)) {
    throw new Error(`[VERIFICAÇÃO DE DUMP FALHOU] O arquivo ${dumpFilePath} não foi criado!`);
  }

  const stat = fs.statSync(dumpFilePath);
  if (stat.size <= 0) {
    throw new Error(`[VERIFICAÇÃO DE DUMP FALHOU] O arquivo ${dumpFilePath} tem 0 bytes! O pg_dump falhou.`);
  }

  // Verify TOC entries using pg_restore --list
  try {
    const listOutput = execSync(`pg_restore --list "${dumpFilePath}"`, { encoding: "utf-8" });
    const requiredTables = ["StudyBlock", "Flashcard", "FlashcardReview", "StudySessionLog"];
    for (const table of requiredTables) {
      if (!listOutput.includes(table)) {
        throw new Error(`[VERIFICAÇÃO DE DUMP FALHOU] A tabela obrigatória '${table}' não foi encontrada no TOC do dump!`);
      }
    }
  } catch (err: any) {
    if (err.message.includes("VERIFICAÇÃO DE DUMP FALHOU")) throw err;
    throw new Error(`[VERIFICAÇÃO DE DUMP FALHOU] O pg_restore --list falhou ao validar o TOC de ${dumpFilePath}: ${err.message}`);
  }
}

function compareCheckpoints(current: CheckpointData, baseline: CheckpointData) {
  console.log("\n=======================================================================");
  console.log(` COMPARAÇÃO DE CHECKPOINTS: [${baseline.rotulo}] ➔ [${current.rotulo}]`);
  console.log("=======================================================================\n");

  const cGab = current.metrics.gabrielaMetrics;
  const bGab = baseline.metrics.gabrielaMetrics;

  console.log("── MÉTRICAS DA GABRIELA ──");
  console.log(`  Total Blocos:               ${bGab.totalStudyBlocks} ➔ ${cGab.totalStudyBlocks} ${bGab.totalStudyBlocks === cGab.totalStudyBlocks ? "✅" : "⚠️"}`);
  console.log(`  Blocos Concluídos (Total):  ${bGab.completedTheoryBlocksTotal} ➔ ${cGab.completedTheoryBlocksTotal} ${bGab.completedTheoryBlocksTotal === cGab.completedTheoryBlocksTotal ? "✅" : "⚠️"}`);
  console.log(`  Blocos Concluídos (Peso 2): ${bGab.completedTheoryBlocksWeight2} ➔ ${cGab.completedTheoryBlocksWeight2} ${bGab.completedTheoryBlocksWeight2 === cGab.completedTheoryBlocksWeight2 ? "✅" : "⚠️"}`);
  console.log(`  Total Flashcards:           ${bGab.totalFlashcards} ➔ ${cGab.totalFlashcards} ${bGab.totalFlashcards === cGab.totalFlashcards ? "✅" : "⚠️"}`);
  console.log(`  Flashcards Órfãos:          ${bGab.orphanedFlashcards} ➔ ${cGab.orphanedFlashcards} ${cGab.orphanedFlashcards === 0 ? "✅" : "❌"}`);

  if (cGab.appCompleteness) {
    console.log("\n── COMPLITUDE DA APLICAÇÃO (GABRIELA) ──");
    console.log(`  Progresso Global:           ${cGab.appCompleteness.globalProgressPct.toFixed(2)}%`);
    console.log(`  Blocos Teoria Concluídos:   ${cGab.appCompleteness.completedTheoryBlocks} / ${cGab.appCompleteness.totalTheoryBlocks}`);
    console.log("  Por Matéria:");
    for (const [subj, data] of Object.entries(cGab.appCompleteness.bySubject)) {
      console.log(`    - ${subj.padEnd(35)} ${data.completedBlocks}/${data.totalBlocks} (${data.progressPct.toFixed(1)}%)`);
    }
  }

  console.log("\n── MÉTRICAS GLOBAIS DO SISTEMA ──");
  const cM = current.metrics;
  const bM = baseline.metrics;
  console.log(`  Total StudyBlocks:          ${bM.totalStudyBlocks} ➔ ${cM.totalStudyBlocks} ${bM.totalStudyBlocks === cM.totalStudyBlocks ? "✅" : "⚠️"}`);
  console.log(`  Total Flashcards:           ${bM.totalFlashcards} ➔ ${cM.totalFlashcards} ${bM.totalFlashcards === cM.totalFlashcards ? "✅" : "⚠️"}`);
  console.log(`  Total Materials:            ${bM.totalMaterials} ➔ ${cM.totalMaterials} ${bM.totalMaterials === cM.totalMaterials ? "✅" : "⚠️"}`);
  console.log(`  Total QuestionReviewTasks:  ${bM.totalQuestionReviewTasks} ➔ ${cM.totalQuestionReviewTasks} ${bM.totalQuestionReviewTasks === cM.totalQuestionReviewTasks ? "✅" : "⚠️"}`);

  console.log("\n── TABELAS DE TAXONOMIA ──");
  console.log(`  SyllabusVersion:            ${bM.syllabusVersionsCount ?? 0} ➔ ${cM.syllabusVersionsCount ?? 0}`);
  console.log(`  SyllabusSubject:            ${bM.syllabusSubjectsCount ?? 0} ➔ ${cM.syllabusSubjectsCount ?? 0}`);
  console.log(`  SyllabusTopic:              ${bM.syllabusTopicsCount ?? 0} ➔ ${cM.syllabusTopicsCount ?? 0}`);

  console.log("\n=======================================================================\n");
}

async function main() {
  const args = process.argv.slice(2);
  let rotulo = args.find((a) => !a.startsWith("--"));
  const compareIdx = args.indexOf("--compare");
  let compareTarget = compareIdx !== -1 ? args[compareIdx + 1] : null;

  if (!rotulo) {
    console.error("Uso: npx tsx scripts/checkpoint.ts <rotulo> [--compare <rotulo_anterior>]");
    process.exit(1);
  }

  const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

  console.log(`\n======================================================================`);
  console.log(`  GERANDO CHECKPOINT AUTO-VERIFICÁVEL: [${rotulo}]`);
  console.log(`======================================================================\n`);

  const backupsDir = path.join(process.cwd(), "backups");
  const jsonDir = path.join(process.cwd(), "docs", "checkpoints");

  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
  if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpFilePath = path.join(backupsDir, `${rotulo}-${timestamp}.dump`);
  const jsonFilePath = path.join(jsonDir, `${rotulo}.json`);

  console.log("[1/3] Tentando dump do schema public via pg_dump...");
  let dumpCreated = false;
  if (directUrl) {
    try {
      const dumpCmd = `pg_dump -Fc --dbname="${directUrl}" --schema=public -f "${dumpFilePath}"`;
      execSync(dumpCmd, { stdio: "inherit", timeout: 30000 });
      console.log("[2/3] Executando auto-verificação estrita do dump gerado...");
      verifyDumpFileStrict(dumpFilePath);
      const stats = fs.statSync(dumpFilePath);
      const dumpSizeMB = (stats.size / (1024 * 1024)).toFixed(2) + " MB";
      console.log(`  ✅ Dump validado com sucesso! Tamanho: ${dumpSizeMB}`);
      dumpCreated = true;
    } catch (e: any) {
      console.warn(`  ⚠️ aviso: pg_dump não pôde ser executado via TCP directUrl (${e.message}).`);
      console.warn("  ℹ️ Prosseguindo com geração do JSON de checkpoint de distribuição.");
    }
  }

  console.log("[3/3] Coletando métricas e salvando JSON de distribuição...");
  const checkpointData = await collectMetrics(rotulo);
  fs.writeFileSync(jsonFilePath, JSON.stringify(checkpointData, null, 2), "utf-8");

  console.log(`  ✅ JSON de distribuição salvo em: docs/checkpoints/${rotulo}.json`);

  if (compareTarget) {
    let baselinePath = compareTarget;
    if (!baselinePath.endsWith(".json")) {
      baselinePath = path.join(jsonDir, `${compareTarget}.json`);
    }
    if (fs.existsSync(baselinePath)) {
      const baselineData: CheckpointData = JSON.parse(fs.readFileSync(baselinePath, "utf-8"));
      compareCheckpoints(checkpointData, baselineData);
    } else {
      console.error(`❌ Baseline de comparação não encontrado: ${baselinePath}`);
    }
  }

  console.log(`\n🏆 CHECKPOINT [${rotulo}] GERADO E VERIFICADO COM SUCESSO!\n`);

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("\n❌ ERRO FATAL: CHECKPOINT ABORTADO E NÃO GRAVADO!", err.message);
    process.exit(1);
  });
}
