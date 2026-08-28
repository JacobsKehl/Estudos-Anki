import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

export interface BackupResult {
  backupPath: string;
  timestamp: string;
  counts: {
    blocks: number;
    scheduleItems: number;
    flashcards: number;
    flashcardReviews: number;
    schedules: number;
    subjects: number;
    materials: number;
  };
}

/**
 * Cria snapshot de backup completo para o usuário antes de qualquer operação destrutiva no organize-all.
 * Executa asserção estrita de contagem antes de permitir qualquer exclusão.
 */
export async function createPreOrganizeAllBackup(userId: string): Promise<BackupResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const label = `pre-organize-all-reset-${timestamp}`;

  // 1. Contagens prévias no banco
  const [
    blockCount,
    itemCount,
    cardCount,
    reviewCount,
    scheduleCount,
    subjectCount,
    materialCount
  ] = await Promise.all([
    prisma.studyBlock.count({ where: { userId } }),
    prisma.studyScheduleItem.count({ where: { userId } }),
    prisma.flashcard.count({ where: { userId } }),
    prisma.flashcardReview.count({ where: { flashcard: { userId } } }),
    prisma.studySchedule.count({ where: { userId } }),
    prisma.studySubject.count({ where: { userId } }),
    prisma.studyMaterial.count({ where: { userId } }),
  ]);

  // 2. Extração dos dados completos
  const [
    blocks,
    scheduleItems,
    flashcards,
    flashcardReviews,
    schedules,
    subjects,
    materials
  ] = await Promise.all([
    prisma.studyBlock.findMany({ where: { userId } }),
    prisma.studyScheduleItem.findMany({ where: { userId } }),
    prisma.flashcard.findMany({ where: { userId } }),
    prisma.flashcardReview.findMany({ where: { flashcard: { userId } } }),
    prisma.studySchedule.findMany({ where: { userId } }),
    prisma.studySubject.findMany({ where: { userId } }),
    prisma.studyMaterial.findMany({ where: { userId } }),
  ]);

  // 3. Asserção estrita de contagem (snapshot vs count prévio)
  if (blocks.length !== blockCount) {
    throw new Error(`[BACKUP ERROR] Divergência em StudyBlock: esperado ${blockCount}, obtido ${blocks.length}`);
  }
  if (scheduleItems.length !== itemCount) {
    throw new Error(`[BACKUP ERROR] Divergência em StudyScheduleItem: esperado ${itemCount}, obtido ${scheduleItems.length}`);
  }
  if (flashcards.length !== cardCount) {
    throw new Error(`[BACKUP ERROR] Divergência em Flashcard: esperado ${cardCount}, obtido ${flashcards.length}`);
  }
  if (flashcardReviews.length !== reviewCount) {
    throw new Error(`[BACKUP ERROR] Divergência em FlashcardReview: esperado ${reviewCount}, obtido ${flashcardReviews.length}`);
  }

  const snapshot = {
    label,
    userId,
    createdAt: new Date().toISOString(),
    counts: {
      blocks: blocks.length,
      scheduleItems: scheduleItems.length,
      flashcards: flashcards.length,
      flashcardReviews: flashcardReviews.length,
      schedules: schedules.length,
      subjects: subjects.length,
      materials: materials.length,
    },
    data: {
      blocks,
      scheduleItems,
      flashcards,
      flashcardReviews,
      schedules,
      subjects,
      materials
    }
  };

  const serialized = JSON.stringify(snapshot, null, 2);
  if (serialized.length < 50) {
    throw new Error("[BACKUP ERROR] Snapshot gerado está vazio ou truncado.");
  }

  // 4. Gravação com fallback seguro de diretório
  let backupDir = path.join(process.cwd(), "backups", "json");
  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
  } catch {
    // Fallback para /tmp se process.cwd() for read-only (serverless)
    backupDir = path.join("/tmp", "backups", "json");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
  }

  const backupPath = path.join(backupDir, `${label}.json`);
  fs.writeFileSync(backupPath, serialized, "utf-8");

  // 5. Validação de leitura
  if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size === 0) {
    throw new Error(`[BACKUP ERROR] Falha ao verificar gravação do arquivo de backup em: ${backupPath}`);
  }

  console.log(`[REORGANIZE BACKUP] Backup obrigatório gravado com SUCESSO: ${backupPath}`);
  console.log(`  - Blocos: ${blocks.length} | Itens: ${scheduleItems.length} | Cards: ${flashcards.length} | Revisões: ${flashcardReviews.length}`);

  return {
    backupPath,
    timestamp,
    counts: snapshot.counts
  };
}
