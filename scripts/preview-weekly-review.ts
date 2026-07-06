import { prisma } from "@/lib/prisma";
import { buildWeeklyReviewPreview } from "@/lib/services/weekly-review";
import { getTodayRangeSP } from "@/lib/date-utils";

async function main() {
  // Parse command line arguments
  // Example: npx tsx scripts/preview-weekly-review.ts --email=gabriela@email.com --date=2026-07-02 --minutes=60
  const args = process.argv.slice(2);
  const getArg = (name: string): string | undefined => {
    const found = args.find((a) => a.startsWith(`--${name}=`));
    return found ? found.split("=")[1] : undefined;
  };

  const email = getArg("email");
  const dateStr = getArg("date") || getTodayRangeSP(new Date()).dateString;
  const minutesStr = getArg("minutes") || "60";
  const minutes = parseInt(minutesStr, 10);

  if (!email) {
    console.error("Erro: O argumento --email é obrigatório. Exemplo: --email=gabriela@email.com");
    process.exit(1);
  }

  console.log(`Localizando usuário com o email: ${email}...`);
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userPreferences: true
    }
  });

  if (!user) {
    console.error(`Erro: Usuário com o email "${email}" não encontrado.`);
    process.exit(1);
  }

  console.log(`Montando a prévia da Revisão Semanal para o usuário: ${user.name} (${user.id})`);
  console.log(`Data de referência: ${dateStr}`);
  console.log(`Minutos disponíveis: ${minutes}`);
  console.log("--------------------------------------------------------");

  try {
    const preview = await buildWeeklyReviewPreview(user.id, dateStr, "America/Sao_Paulo", minutes);
    
    console.log("\n=== TOTAIS DA PRÉVIA ===");
    console.log(`Total de Assuntos Selecionados: ${preview.totals.selected}`);
    console.log(`  - Assuntos da Semana (WEEK_CONTENT): ${preview.totals.weekContent} (Excedentes: ${preview.totals.excessWeekContent})`);
    console.log(`  - Assuntos Atrasados (OVERDUE): ${preview.totals.overdue} (Excedentes: ${preview.totals.excessOverdue})`);
    console.log(`  - Matéria Pouco Vista (LONG_UNSEEN): ${preview.totals.longUnseen}`);
    
    console.log(`\nQuestões Sugeridas: ${preview.suggestedQuestionCount} questões para ${preview.availableMinutes} minutos.`);
    console.log(`Período de estudos considerado: ${preview.sourcePeriodStart} até ${preview.sourcePeriodEnd}`);

    console.log("\n=== TÓPICOS SELECIONADOS (ORDENADOS POR PRIORIDADE) ===");
    preview.topics.forEach((topic, idx) => {
      console.log(`\n[${idx + 1}] ${topic.title} (${topic.selectionReason})`);
      console.log(`    Matéria: ${topic.subjectName}`);
      console.log(`    Estudado em: ${topic.sourceStudyDate}`);
      console.log(`    Material: ${topic.materialName || "N/A"}${topic.pageStart ? ` (Pág. ${topic.pageStart}-${topic.pageEnd})` : ""}`);
      console.log(`    Questões Sugeridas: ${topic.suggestedQuestions || 0}`);
      console.log(`    groupKey: ${topic.groupKey}`);
      if (topic.carriedFromTopicId) {
        console.log(`    Carried from topic ID: ${topic.carriedFromTopicId}`);
      }
    });

    if (preview.excluded.length > 0) {
      console.log("\n=== BLOCOS EXCLUÍDOS DA SELEÇÃO ===");
      preview.excluded.forEach((ex) => {
        console.log(`  - Bloco ${ex.studyBlockId}: ${ex.reason}`);
      });
    }

    console.log("\n--------------------------------------------------------");
    console.log("✓ Operação concluída. Nenhuma alteração foi realizada no banco.");
  } catch (error: any) {
    console.error("Erro ao gerar a prévia:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
