const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando limpeza do banco de dados...");
  
  try {
    // Como o onDelete está como Cascade no schema para materiais e blocos,
    // deletar as matérias deve limpar quase tudo.
    const deletedSubjects = await prisma.studySubject.deleteMany({});
    console.log(`Sucesso: ${deletedSubjects.count} matérias removidas (e seus materiais/blocos via Cascade).`);
    
    // Opcional: Limpar flashcards se não estiverem em cascata (alguns podem estar soltos)
    const deletedFlashcards = await prisma.flashcard.deleteMany({});
    console.log(`${deletedFlashcards.count} flashcards removidos.`);

    // Limpar cronogramas
    await prisma.studyScheduleItem.deleteMany({});
    await prisma.studySchedule.deleteMany({});
    console.log("Cronogramas limpos.");

    console.log("\nBanco de dados pronto para um novo começo!");
  } catch (error) {
    console.error("Erro ao limpar banco:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
