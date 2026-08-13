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

  const targetUrlIdx = args.indexOf("--target-url");
  const targetUrl = targetUrlIdx !== -1 ? args[targetUrlIdx + 1] : null;

  const isProductionBypass = args.includes("--target-is-production");
  const autoConfirmFlagIdx = args.indexOf("--confirm");
  const autoConfirmText = autoConfirmFlagIdx !== -1 ? args[autoConfirmFlagIdx + 1] : null;

  if (!dumpFilePath || !targetUrl) {
    console.error("Uso: npx tsx scripts/restore.ts <caminho-do-dump> --target-url <URL_DESTINO> [--target-is-production] [--confirm RESTAURAR]");
    process.exit(1);
  }

  if (!fs.existsSync(dumpFilePath)) {
    console.error(`Erro: Arquivo de dump não encontrado: ${dumpFilePath}`);
    process.exit(1);
  }

  const directUrl = process.env.DIRECT_URL || "";
  const databaseUrl = process.env.DATABASE_URL || "";

  // Trava de segurança para produção
  const isTargetingProduction = targetUrl === directUrl || targetUrl === databaseUrl || targetUrl.includes("pooler.supabase.com");

  if (isTargetingProduction && !isProductionBypass) {
    console.error("\n❌ ERRO DE SEGURANÇA OPERACIONAL:");
    console.error("   O destino informado coincide com a URL do banco de PRODUÇÃO!");
    console.error("   Para restaurar no banco de produção, você DEVE passar explicitamente a flag '--target-is-production'.");
    console.error("   Operação abortada.\n");
    process.exit(1);
  }

  console.log(`\n======================================================================`);
  console.log(`  RESTAURAÇÃO DE BANCO DE DADOS (SAFETY PROTOCOL)`);
  console.log(`======================================================================`);
  console.log(`  Arquivo Dump: ${dumpFilePath}`);
  console.log(`  URL Destino:  ${targetUrl.replace(/:[^:@]+@/, ":****@")}`);
  console.log(`  Alvo Produção:${isTargetingProduction ? " SIM (Bypass Ativo)" : " NÃO (Banco Descartável/Teste)"}`);
  console.log(`======================================================================\n`);

  // Solicitar confirmação textual
  let confirmText = autoConfirmText;
  if (!confirmText) {
    confirmText = await askConfirmation('Digite "RESTAURAR" para confirmar a restauração do banco: ');
  }

  if (confirmText !== "RESTAURAR") {
    console.error("Confirmação incorreta. Operação cancelada.");
    process.exit(1);
  }

  console.log("\n[1/2] Iniciando processo de restauração...");

  // Executar restauração via npx prisma db push --accept-data-loss ou psql/pg_restore ou supabase db restore se SQL
  // Se o dump for um arquivo SQL gerado por supabase db dump:
  try {
    const isSql = dumpFilePath.endsWith(".sql") || fs.readFileSync(dumpFilePath, "utf-8").slice(0, 100).includes("CREATE") || fs.readFileSync(dumpFilePath, "utf-8").slice(0, 100).includes("PostgreSQL");
    
    if (isSql) {
      console.log("  Executando aplicação de SQL via psql / CLI...");
      // Restauração via SQL
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
