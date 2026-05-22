const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Checking for 'máultiplos' or 'maultiplos' in database...");
  
  // Search StudyMaterial
  const materials = await prisma.studyMaterial.findMany({
    where: {
      OR: [
        { fileName: { contains: 'máultiplos', mode: 'insensitive' } },
        { originalFileName: { contains: 'máultiplos', mode: 'insensitive' } },
        { fileName: { contains: 'maultiplos', mode: 'insensitive' } },
        { originalFileName: { contains: 'maultiplos', mode: 'insensitive' } }
      ]
    }
  });
  console.log("Found materials:", materials.map(m => ({ id: m.id, fileName: m.fileName, originalFileName: m.originalFileName })));

  // Search StudyBlock
  const blocks = await prisma.studyBlock.findMany({
    where: {
      OR: [
        { title: { contains: 'máultiplos', mode: 'insensitive' } },
        { description: { contains: 'máultiplos', mode: 'insensitive' } },
        { title: { contains: 'maultiplos', mode: 'insensitive' } },
        { description: { contains: 'maultiplos', mode: 'insensitive' } }
      ]
    }
  });
  console.log("Found blocks:", blocks.map(b => ({ id: b.id, title: b.title })));

  // Search Flashcard
  const flashcards = await prisma.flashcard.findMany({
    where: {
      OR: [
        { question: { contains: 'máultiplos', mode: 'insensitive' } },
        { answer: { contains: 'máultiplos', mode: 'insensitive' } },
        { question: { contains: 'maultiplos', mode: 'insensitive' } },
        { answer: { contains: 'maultiplos', mode: 'insensitive' } }
      ]
    }
  });
  console.log("Found flashcards:", flashcards.map(f => ({ id: f.id, question: f.question })));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
