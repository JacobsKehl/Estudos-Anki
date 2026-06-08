import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== INICIANDO MIGRAÇÃO DE PREFERÊNCIAS DA GABRIELA ===");

  try {
    // Localizar a Gabriela por nome ou e-mail
    const gabriela = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { contains: "gabriela", mode: "insensitive" } },
          { name: { contains: "gabriela", mode: "insensitive" } }
        ]
      },
      include: { preferences: true }
    });

    if (!gabriela) {
      console.warn("⚠ Gabriela não encontrada no banco de dados. Pulando migração de produção.");
      return;
    }

    console.log(`✔ Usuário da Gabriela localizado: ID=${gabriela.id}, Email=${gabriela.email}`);

    if (gabriela.preferences) {
      // Atualizar preferências existentes
      await prisma.userPreferences.update({
        where: { userId: gabriela.id },
        data: {
          examGoal: "TRT4",
          languageTone: "FEMININE",
          scheduleGenerationMode: "LEGACY_TRT4"
        }
      });
      console.log("✔ Preferências existentes da Gabriela atualizadas com sucesso!");
    } else {
      // Criar preferências se não existirem
      await prisma.userPreferences.create({
        data: {
          userId: gabriela.id,
          displayName: gabriela.name || "Gabriela",
          examGoal: "TRT4",
          languageTone: "FEMININE",
          scheduleGenerationMode: "LEGACY_TRT4",
          focusArea: "Direito / Concurso TRT",
          studyDaysOfWeek: "1,2,3,4,5,6,0",
          dailyGoalMinutes: 120,
          emailReminderEnabled: true,
          emailReminderTime: "08:00"
        }
      });
      console.log("✔ Novas preferências da Gabriela criadas e configuradas com sucesso!");
    }

    // Validar atualização
    const updated = await prisma.userPreferences.findUnique({
      where: { userId: gabriela.id }
    });
    console.log("Preferências salvas no banco:", {
      userId: updated?.userId,
      examGoal: updated?.examGoal,
      languageTone: updated?.languageTone,
      scheduleGenerationMode: updated?.scheduleGenerationMode
    });

  } catch (error) {
    console.error("❌ Erro ao executar a migração:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
