import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log("=== Starting Logical Database Backup ===");

  const timestamp = new Date()
    .toISOString()
    .replace(/T/, '-')
    .replace(/:/g, '-')
    .substring(0, 19);

  const backupDir = path.join(__dirname, '..', '..', 'scratch', 'backups');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFilename = `kehl-backup-${timestamp}.json`;
  const backupPath = path.join(backupDir, backupFilename);

  try {
    console.log("Fetching table records...");

    const [
      users,
      preferences,
      subjects,
      materials,
      blocks,
      schedules,
      scheduleItems,
      flashcards,
      reviews,
      extractedContent
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.userPreferences.findMany(),
      prisma.studySubject.findMany(),
      prisma.studyMaterial.findMany(),
      (prisma as any).studyBlock.findMany(),
      (prisma as any).studySchedule.findMany(),
      (prisma as any).studyScheduleItem.findMany(),
      (prisma as any).flashcard.findMany(),
      (prisma as any).flashcardReview.findMany(),
      prisma.extractedContent.findMany(),
    ]);

    const backupData = {
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0",
        schema: "P2"
      },
      data: {
        User: users,
        UserPreferences: preferences,
        StudySubject: subjects,
        StudyMaterial: materials,
        StudyBlock: blocks,
        StudySchedule: schedules,
        StudyScheduleItem: scheduleItems,
        Flashcard: flashcards,
        FlashcardReview: reviews,
        ExtractedContent: extractedContent
      }
    };

    const content = JSON.stringify(backupData, null, 2);
    fs.writeFileSync(backupPath, content, 'utf-8');

    console.log("\nBackup Completed Successfully!");
    console.log(`- File Path: ${backupPath}`);
    console.log(`- File Size: ${(content.length / 1024).toFixed(2)} KB`);
    console.log("- Counts:");
    console.log(`  * User: ${users.length}`);
    console.log(`  * UserPreferences: ${preferences.length}`);
    console.log(`  * StudySubject: ${subjects.length}`);
    console.log(`  * StudyMaterial: ${materials.length}`);
    console.log(`  * StudyBlock: ${blocks.length}`);
    console.log(`  * StudySchedule: ${schedules.length}`);
    console.log(`  * StudyScheduleItem: ${scheduleItems.length}`);
    console.log(`  * Flashcard: ${flashcards.length}`);
    console.log(`  * FlashcardReview: ${reviews.length}`);
    console.log(`  * ExtractedContent: ${extractedContent.length}`);

  } catch (err) {
    console.error("Backup failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
