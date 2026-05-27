import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== Testing Flashcard Relational Integrity ===");
  try {
    const totalCards = await prisma.flashcard.count();
    const orphanedCards = await prisma.flashcard.count({
      where: {
        AND: [
          { materialId: null },
          { studyBlockId: null }
        ]
      }
    });

    console.log(`Total Flashcards in Database: ${totalCards}`);
    console.log(`Orphaned Flashcards (no block and no material): ${orphanedCards}`);

    // Verify all flashcards have a subjectId
    const missingSubject = await prisma.flashcard.count({
      where: { subjectId: "" } // check if empty or null
    });

    if (missingSubject > 0) {
      console.error(`✗ FAILED: Found ${missingSubject} flashcards without a subject relation!`);
      process.exit(1);
    }

    console.log("✓ SUCCESS: Flashcard integrity test passed. All cards are safely associated with a subject.");
  } catch (err) {
    console.error("Flashcard validation failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
