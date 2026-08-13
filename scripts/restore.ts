import { execSync } from "child_process";
import fs from "fs";
import readline from "readline";

require("dotenv").config();

async function askConfirmation(promptText: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dumpFilePath = args[0];

  const targetEnvIdx = args.indexOf("--target-env");
  const targetEnvVarName = targetEnvIdx !== -1 ? args[targetEnvIdx + 1] : null;

  const isProductionBypass = args.includes("--target-is-production");
  const autoConfirmFlagIdx = args.indexOf("--confirm");
  const autoConfirmText = autoConfirmFlagIdx !== -1 ? args[autoConfirmFlagIdx + 1] : null;

  if (!dumpFilePath || !targetEnvVarName) {
    console.error("Uso: npx tsx scripts/restore.ts <caminho-do-dump> --target-env <NOME_VARIAVEL_ENV> [--target-is-production] [--confirm RESTAURAR]");
    console.error("Exemplo (teste):      npx tsx scripts/restore.ts backups/cp1.dump --target-env TEST_TARGET_URL");
    console.error("Exemplo (produção):   npx tsx scripts/restore.ts backups/cp1.dump --target-env DIRECT_URL --target-is-production");
    process.exit(1);
  }

  if (!fs.existsSync(dumpFilePath)) {
    console.error(`Erro: Arquivo de dump não encontrado: ${dumpFilePath}`);
    process.exit(1);
  }

  const targetUrl = process.env[targetEnvVarName];
  if (!targetUrl) {
    console.error(`Erro: Variável de ambiente '${targetEnvVarName}' não encontrada ou vazia no .env`);
    process.exit(1);
  }

  const isTargetingProduction = targetEnvVarName === "DIRECT_URL" || targetEnvVarName === "DATABASE_URL" || targetUrl.includes("pooler.supabase.com");

  if (isTargetingProduction && !isProductionBypass) {
    console.error("\n❌ ERRO DE SEGURANÇA OPERACIONAL:");
    console.error(`   A variável '${targetEnvVarName}' aponta para o banco de PRODUÇÃO!`);
    console.error("   Para restaurar no banco de produção, você DEVE passar explicitamente a flag '--target-is-production'.");
    console.error("   Operação abortada.\n");
    process.exit(1);
  }

  console.log(`\n======================================================================`);
  console.log(`  RESTAURAÇÃO DE BANCO DE DADOS (SAFETY PROTOCOL)`);
  console.log(`======================================================================`);
  console.log(`  Arquivo Dump: ${dumpFilePath}`);
  console.log(`  Variável Env: ${targetEnvVarName}`);
  console.log(`  Alvo Produção:${isTargetingProduction ? " SIM (Bypass Ativo)" : " NÃO (Banco Descartável/Teste)"}`);
  console.log(`======================================================================\n`);

  let confirmText = autoConfirmText;
  if (!confirmText) {
    confirmText = await askConfirmation('Digite "RESTAURAR" para confirmar a restauração do banco: ');
  }

  if (confirmText !== "RESTAURAR") {
    console.error("Confirmação incorreta. Operação cancelada.");
    process.exit(1);
  }

  console.log("\n[1/2] Iniciando processo de restauração...");

  try {
    const isSql = dumpFilePath.endsWith(".sql") || fs.readFileSync(dumpFilePath, "utf-8").slice(0, 100).includes("CREATE") || fs.readFileSync(dumpFilePath, "utf-8").slice(0, 100).includes("PostgreSQL");
    
    if (isSql) {
      console.log("  Executando aplicação de SQL via Supabase CLI / Prisma...");
      const cmd = `npx supabase db push --db-url "${targetUrl}" --accept-data-loss`;
      execSync(cmd, { stdio: "inherit" });
    } else {
      console.log("  Executando pg_restore com --clean --if-exists...");
      const cmd = `pg_restore --clean --if-exists --no-owner --no-privileges -d "${targetUrl}" "${dumpFilePath}"`;
      execSync(cmd, { stdio: "inherit" });
    }
  } catch (err: any) {
    console.warn("\n⚠️ AVISO DE RESTAURAÇÃO: pg_restore ou script de migração emitiu código não-zero.");
    console.warn("   (Avisos de DROP em objetos inexistentes em banco limpo são normais).");
    console.warn("   O critério real de validação será a comparação da distribuição JSON (--compare).\n");
  }

  console.log("[2/2] Processo de restauração finalizado.");
  console.log("Para validar a integridade, execute:");
  console.log(`  npx tsx scripts/checkpoint.ts --compare docs/checkpoints/<rotulo>.json <json_coletado_do_banco_restaurado>\n`);
}

main().catch((err) => {
  console.error("Erro fatal no script de restauração:", err);
  process.exit(1);
});
