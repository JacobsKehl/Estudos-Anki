import { prisma } from "../src/lib/prisma";
import { backfillQuestionReviews } from "../src/lib/services/question-review";
import { getMockUserId } from "../src/lib/auth-mock";
import readline from "readline";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  
  console.log("\n========================================================");
  console.log("   KEHL STUDY — SCRIPT DE CARGA INICIAL (BACKFILL)      ");
  console.log("========================================================\n");

  let userId: string;
  try {
    const email = process.env.ADMIN_EMAIL || process.env.DAILY_REMINDER_EMAIL || "gabriela.furtado.p@gmail.com";
    const user = await prisma.user.findFirst({
      where: { email }
    });
    if (user) {
      userId = user.id;
    } else {
      const firstUser = await prisma.user.findFirst();
      if (firstUser) {
        userId = firstUser.id;
      } else {
        userId = await getMockUserId();
      }
    }
  } catch (err: any) {
    console.error("Erro: Não foi possível obter o ID do usuário. Detalhes:", err.message);
    process.exit(1);
  }

  // 1. Obter snapshot/contagem atual antes do processo
  const snapshotCount = await prisma.questionReviewTask.count({
    where: { userId }
  });

  console.log(`Snapshot prévio: ${snapshotCount} tarefas de revisão existentes.`);
  console.log("Executando simulação (dry-run) de pendências elegíveis...\n");

  // 2. Executar dry-run primeiro para exibir o preview
  const dryRunResult = await backfillQuestionReviews(userId, { apply: false });

  if (dryRunResult.scheduledCount === 0) {
    console.log("Nenhum bloco de teoria concluído sem tarefa de revisão correspondente.");
    console.log("Tudo em dia! O backfill não é necessário.");
    process.exit(0);
  }

  console.log(`Total de blocos concluídos elegíveis encontrados: ${dryRunResult.totalEligible}`);
  console.log(`Itens que serão distribuídos nesta carga (máximo 30): ${dryRunResult.scheduledCount}`);
  console.log("\nPreview da distribuição agendada (D+1 a D+15):");
  console.log("--------------------------------------------------------------------------------");
  dryRunResult.preview.forEach((item, index) => {
    const num = (index + 1).toString().padStart(2, " ");
    const dateStr = item.scheduledDate.toISOString().split("T")[0];
    const compStr = item.completedAt ? new Date(item.completedAt).toISOString().split("T")[0] : "N/A";
    console.log(`[${num}] Data agendada: ${dateStr} | Estudado em: ${compStr} | Assunto: ${item.blockTitle} (${item.subjectName})`);
  });
  console.log("--------------------------------------------------------------------------------");

  if (!apply) {
    console.log("\n[INFO] Esta foi apenas uma simulação (dry-run). Nenhuma gravação feita.");
    console.log("Para gravar de fato no banco de dados, execute o comando com a flag --apply:");
    console.log("  npx tsx scripts/run-backfill.ts --apply\n");
    process.exit(0);
  }

  // 3. Solicitar confirmação textual para aplicação (Apply)
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question("\nDeseja mesmo gravar estas tarefas de revisão no banco de dados?\nDigite 'SIM' para confirmar: ", async (answer) => {
    rl.close();
    
    if (answer.trim() !== "SIM") {
      console.log("\nExecução cancelada pelo usuário. Nenhuma alteração foi gravada.");
      process.exit(0);
    }

    console.log("\nGravando tarefas no banco de dados...");
    
    try {
      const result = await backfillQuestionReviews(userId, { apply: true });
      
      const postCount = await prisma.questionReviewTask.count({
        where: { userId }
      });

      console.log("\n========================================================");
      console.log("✓ BACKFILL CONCLUÍDO COM SUCESSO!");
      console.log(`- Tarefas adicionadas: ${result.scheduledCount}`);
      console.log(`- Total após carga: ${postCount}`);
      console.log("========================================================\n");
      process.exit(0);
    } catch (error: any) {
      console.error("\n❌ ERRO NA GRAVAÇÃO DO BACKFILL:", error);
      process.exit(1);
    }
  });
}

main().catch(console.error);
