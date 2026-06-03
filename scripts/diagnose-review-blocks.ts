import { prisma } from "../src/lib/prisma";
import { getTodayRangeSP } from "../src/lib/date-utils";

async function main() {
  const args = process.argv.slice(2);
  let userEmail: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--user-email=')) {
      userEmail = args[i].split('=')[1];
    } else if (args[i] === '--user-email' && i + 1 < args.length) {
      userEmail = args[i + 1];
    }
  }

  if (!userEmail) {
    console.error("❌ Erro: O parâmetro --user-email é obrigatório.");
    console.log("\nUso correto:");
    console.log("  npx tsx scripts/diagnose-review-blocks.ts --user-email=\"gabriela.furtado.p@gmail.com\"");
    process.exit(1);
  }

  console.log(`🔍 Buscando usuário com e-mail: ${userEmail}...`);
  const user = await prisma.user.findUnique({
    where: { email: userEmail }
  });

  if (!user) {
    console.error(`❌ Erro: Usuário com e-mail "${userEmail}" não encontrado.`);
    process.exit(1);
  }

  console.log(`👤 Usuário: ${user.name} (ID: ${user.id})`);
  console.log("🔍 Buscando todos os itens REVIEW_BLOCK no cronograma ativo...");

  // Buscar o cronograma ativo
  const activeSchedule = await prisma.studySchedule.findFirst({
    where: { userId: user.id, status: "ACTIVE" }
  });

  if (!activeSchedule) {
    console.error("❌ Erro: Nenhum cronograma ativo encontrado.");
    process.exit(1);
  }

  console.log(`📅 Cronograma Ativo: ${activeSchedule.title} (ID: ${activeSchedule.id})`);

  // Buscar todos os REVIEW_BLOCK do cronograma ativo
  const reviewItems = await (prisma as any).studyScheduleItem.findMany({
    where: {
      userId: user.id,
      scheduleId: activeSchedule.id,
      actionType: "REVIEW_BLOCK"
    },
    include: {
      subject: true,
      studyBlock: {
        include: {
          flashcards: {
            where: {
              status: "APPROVED",
              reviewState: { in: ["NEW", "LEARNING", "REVIEW", "RELEARNING"] }
            }
          }
        }
      }
    }
  });

  console.log(`\n====================================================`);
  console.log(`📊 RELATÓRIO DE DIAGNÓSTICO DE REVISÕES (REVIEW_BLOCK)`);
  console.log(`====================================================`);
  console.log(`1. Total de REVIEW_BLOCK no cronograma: ${reviewItems.length}`);

  let withoutBlockId = 0;
  let blockNotFound = 0;
  let withFlashcardsTotal = 0;
  let withActiveFlashcards = 0;
  let emptyOrOrphan = 0;

  const todayRange = getTodayRangeSP(new Date());
  const todayStart = todayRange.start;
  const todayEnd = todayRange.end;

  let scheduledTodayTotal = 0;
  let scheduledTodayEmpty = 0;
  let scheduledTodayValid = 0;

  const sampleEmpty: any[] = [];
  const sampleValid: any[] = [];

  for (const item of reviewItems) {
    const isScheduledToday = item.scheduledDate && 
                             item.scheduledDate >= todayStart && 
                             item.scheduledDate < todayEnd;
    
    if (isScheduledToday) {
      scheduledTodayTotal++;
    }

    if (!item.studyBlockId) {
      withoutBlockId++;
      emptyOrOrphan++;
      if (isScheduledToday) scheduledTodayEmpty++;
      if (sampleEmpty.length < 5) sampleEmpty.push(item);
      continue;
    }

    const block = item.studyBlock;
    if (!block) {
      blockNotFound++;
      emptyOrOrphan++;
      if (isScheduledToday) scheduledTodayEmpty++;
      if (sampleEmpty.length < 5) sampleEmpty.push(item);
      continue;
    }

    const totalCardsCount = await prisma.flashcard.count({
      where: { studyBlockId: block.id }
    });

    if (totalCardsCount > 0) {
      withFlashcardsTotal++;
    }

    const activeCardsCount = block.flashcards.length;
    if (activeCardsCount > 0) {
      withActiveFlashcards++;
      if (isScheduledToday) scheduledTodayValid++;
      if (sampleValid.length < 5) sampleValid.push(item);
    } else {
      emptyOrOrphan++;
      if (isScheduledToday) scheduledTodayEmpty++;
      if (sampleEmpty.length < 5) sampleEmpty.push(item);
    }
  }

  console.log(`2. Quantidade sem studyBlockId (órfãos de ID): ${withoutBlockId}`);
  console.log(`3. Quantidade com studyBlockId inexistente: ${blockNotFound}`);
  console.log(`4. Quantidade com blocos que possuem ALGUM flashcard: ${withFlashcardsTotal}`);
  console.log(`5. Quantidade com blocos que possuem flashcards ATIVOS/REVISÁVEIS: ${withActiveFlashcards}`);
  console.log(`6. Quantidade de REVISÕES VAZIAS/ÓRFÃS (deverão ser ocultadas/ignoradas): ${emptyOrOrphan}`);
  console.log(`7. Quantidade de REVISÕES VÁLIDAS: ${withActiveFlashcards}`);
  console.log(`----------------------------------------------------`);
  console.log(`8. REVIEW_BLOCK agendados para HOJE (${todayRange.dateString}): ${scheduledTodayTotal}`);
  console.log(`   - Válidos hoje: ${scheduledTodayValid}`);
  console.log(`   - Vazios hoje (serão ocultados da tela Hoje): ${scheduledTodayEmpty}`);
  console.log(`====================================================`);

  if (sampleEmpty.length > 0) {
    console.log(`\n📝 EXEMPLOS DE REVISÕES VAZIAS/ÓRFÃS ENCONTRADAS:`);
    sampleEmpty.forEach((item, idx) => {
      const blockTitle = item.studyBlock?.title || "Sem Bloco (Título não encontrado)";
      const reason = item.reason || "N/A";
      const scheduledStr = item.scheduledDate ? getTodayRangeSP(item.scheduledDate).dateString : "Sem data";
      console.log(`   [${idx + 1}] ID: ${item.id} | Data: ${scheduledStr} | Matéria: ${item.subject?.name} | Bloco: ${blockTitle} | Motivo: ${reason}`);
    });
  }

  if (sampleValid.length > 0) {
    console.log(`\n✅ EXEMPLOS DE REVISÕES VÁLIDAS ENCONTRADAS (COM CARDS ATIVOS):`);
    sampleValid.forEach((item, idx) => {
      const activeCardsCount = item.studyBlock?.flashcards?.length || 0;
      console.log(`   [${idx + 1}] ID: ${item.id} | Matéria: ${item.subject?.name} | Bloco: ${item.studyBlock?.title} | Flashcards Ativos: ${activeCardsCount}`);
    });
  } else {
    console.log(`\nℹ️ NENHUMA REVISÃO VÁLIDA (COM FLASHCARDS ATIVOS) FOI ENCONTRADA NO CRONOGRAMA.`);
  }

  console.log(`====================================================`);
  console.log("🏁 FIM DO DIAGNÓSTICO");
  console.log("====================================================");
}

main()
  .catch((err) => {
    console.error("❌ Erro ao rodar o diagnóstico:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
