import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

function addDaysAtStartOfDayUTC(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

async function main() {
  try {
    console.log(`=== Cap Flashcard Spacing to 30 Days Maximum ===`);
    console.log(`Mode: ${DRY_RUN ? 'SIMULATION (DRY RUN)' : 'REAL UPDATE (LIVE)'}`);
    console.log(`Connecting to database...`);

    const cards = await prisma.flashcard.findMany({
      where: {
        intervalDays: {
          gt: 30
        }
      },
      select: {
        id: true,
        question: true,
        intervalDays: true,
        lastReviewedAt: true,
        nextReviewAt: true,
        createdAt: true
      }
    });

    console.log(`Found ${cards.length} flashcard(s) exceeding 30 days interval.\n`);

    if (cards.length === 0) {
      console.log("No flashcards need updating.");
      return;
    }

    let successCount = 0;
    
    for (const card of cards) {
      const referenceDate = card.lastReviewedAt || card.createdAt;
      const newNextReviewAt = addDaysAtStartOfDayUTC(referenceDate, 30);

      console.log(`Card ID: ${card.id}`);
      console.log(`Question: "${card.question.substring(0, 50)}..."`);
      console.log(`Interval: ${card.intervalDays} days -> 30 days`);
      console.log(`Last Reviewed: ${card.lastReviewedAt ? card.lastReviewedAt.toISOString() : 'Never (using CreatedAt)'}`);
      console.log(`Next Review At: ${card.nextReviewAt ? card.nextReviewAt.toISOString() : 'None'} -> ${newNextReviewAt.toISOString()}`);

      if (!DRY_RUN) {
        await prisma.flashcard.update({
          where: { id: card.id },
          data: {
            intervalDays: 30,
            nextReviewAt: newNextReviewAt
          }
        });
        successCount++;
        console.log(`Status: UPDATED successfully.`);
      } else {
        console.log(`Status: SIMULATED (no database changes).`);
      }
      console.log(`---`);
    }

    console.log(`\nProcess finished.`);
    if (DRY_RUN) {
      console.log(`Dry run complete. No rows were modified.`);
    } else {
      console.log(`Successfully updated ${successCount} flashcards in the database.`);
    }

  } catch (error) {
    console.error("Failed to run cap migration script:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
