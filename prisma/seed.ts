import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = "cm39k012x0001k93jqwerty12";
  
  console.log('Seed: Criando usuário mock...');
  
  const user = await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      name: "Henrique Kehl",
      email: "henrique@kehl.com",
    },
  });

  await prisma.userPreferences.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      dailyGoalMinutes: 120,
      studyResetTime: "00:00",
      studyDaysOfWeek: "0,1,2,3,4,5,6",
      defaultBlockDurationMinutes: 30,
      maxNewCardsPerDay: 20,
      flashcardDifficulty: "NORMAL",
      emailReminderEnabled: false,
      emailReminderTime: "08:00",
      visualDensity: "comfortable",
      reducedMotion: false,
      focusArea: "Estudos",
      displayName: "Henrique Kehl",
      examGoal: "TRT",
      languageTone: "MASCULINE_NEUTRAL",
    }
  });

  console.log('Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
