const fs = require('fs');
const path = require('path');

// Load .env manually
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key && !key.startsWith('#')) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  console.error("Error loading .env file:", e);
}

// Ensure we use the pooled URL for Supabase connection (port 6543)
const dbUrl = process.env.DATABASE_URL;
console.log("Using DATABASE_URL:", dbUrl);

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});

async function main() {
  // 1. Get the mock user ID (first user or default mock ID)
  const users = await prisma.studySubject.findMany({
    select: { userId: true },
    take: 1
  });
  
  if (users.length === 0) {
    console.error("Nenhum usuário ou matéria encontrados no banco de dados.");
    await prisma.$disconnect();
    return;
  }
  
  const userId = users[0].userId;
  console.log(`Usuário identificado: ${userId}`);

  // 2. Find the active schedule
  const activeSchedule = await prisma.studySchedule.findFirst({
    where: { userId, status: "ACTIVE" }
  });

  if (!activeSchedule) {
    console.error("Nenhum cronograma ATIVO encontrado para o usuário.");
    await prisma.$disconnect();
    return;
  }
  
  console.log(`Cronograma Ativo encontrado: ${activeSchedule.title} (ID: ${activeSchedule.id})`);

  // 3. Find completed study blocks
  const completedBlocks = await prisma.studyBlock.findMany({
    where: { userId, status: "COMPLETED" }
  });

  console.log(`Total de blocos concluídos no banco: ${completedBlocks.length}`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const block of completedBlocks) {
    const completionDate = block.theoryCompletedAt || block.lastStudiedAt || new Date();

    // Check if there is already a THEORY item for this block in the active schedule
    const existingItem = await prisma.studyScheduleItem.findFirst({
      where: {
        scheduleId: activeSchedule.id,
        studyBlockId: block.id,
        actionType: "THEORY"
      }
    });

    if (existingItem) {
      if (existingItem.status !== "COMPLETED") {
        await prisma.studyScheduleItem.update({
          where: { id: existingItem.id },
          data: {
            status: "COMPLETED",
            completedAt: completionDate
          }
        });
        console.log(` - Item de teoria atualizado para COMPLETED: ${block.title}`);
        updatedCount++;
      } else {
        console.log(` - Bloco já está concluído no cronograma: ${block.title}`);
      }
    } else {
      // Create a completed THEORY item in the active schedule
      await prisma.studyScheduleItem.create({
        data: {
          userId,
          scheduleId: activeSchedule.id,
          subjectId: block.subjectId,
          materialId: block.materialId,
          studyBlockId: block.id,
          actionType: "THEORY",
          priorityScore: 90,
          reason: "Colocação manual / Sincronização retroativa",
          dayNumber: 1,
          scheduledDate: completionDate,
          completedAt: completionDate,
          status: "COMPLETED"
        }
      });
      console.log(` - Item de teoria criado e concluído no cronograma: ${block.title}`);
      createdCount++;
    }
  }

  console.log(`\n--- RESULTADO ---`);
  console.log(`Itens criados: ${createdCount}`);
  console.log(`Itens atualizados: ${updatedCount}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error("Erro na execução do script:", e);
  process.exit(1);
});
