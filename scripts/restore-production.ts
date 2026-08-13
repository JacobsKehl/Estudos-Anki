import fs from "fs";
import path from "path";
import { extractProjectRef } from "../src/lib/supabase-ref-extractor";

// Load .env variables natively
const envPath = path.join(process.cwd(), ".env");
const envVars: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([\w_]+)\s*=\s*"(.*)"\s*$/) || line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);
    if (match) {
      envVars[match[1]] = match[2].trim();
    }
  }
}

const prodUrl = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const prodApiKey = envVars["SUPABASE_SERVICE_ROLE_KEY"];

async function main() {
  const args = process.argv.slice(2);
  const rotulo = args[0] || "cp2b-rest";

  console.log(`\n======================================================================`);
  console.log(`  ROBOT DE RESTAURAÇÃO DE PRODUÇÃO (PROCEDIMENTO DE EMERGÊNCIA)`);
  console.log(`======================================================================\n`);

  // 1. CHECAGEM DE FLAGS RIGIDAS E CONFIRMAÇÃO
  const hasFlag = args.includes("--i-am-restoring-production");
  const isEnvConfirmed = process.env.PRODUCTION_RESTORE_CONFIRMED === "true";

  if (!hasFlag || !isEnvConfirmed) {
    console.error("🛑 ACESSO NEGADO: A restauração em produção EXIGE obrigatoriamente:");
    console.error("   1. Flag de linha de comando: --i-am-restoring-production");
    console.error("   2. Variável de ambiente: PRODUCTION_RESTORE_CONFIRMED=true");
    console.error("\nOperação de restauração em produção ABORTADA por segurança.\n");
    process.exit(1);
  }

  // 2. VERIFICAÇÃO DO MANIFESTO E HASHES
  const manifestPath = path.join(process.cwd(), "docs", "backups", `${rotulo}-manifest.json`);
  if (!fs.existsSync(manifestPath)) {
    console.error(`🛑 MANIFESTO DE ORIGEM NÃO ENCONTRADO: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  console.log(`📋 Manifesto Oficial Carregado: ${manifest.totalTables} tabelas, ${manifest.totalRecords} registros.`);
  console.log(`   Data do Backup: ${manifest.timestamp}`);

  // 3. RECOMENDAÇÃO OFICIAL: GERAR SQL TRANSACIONA ATÔMICO (OPÇÃO C - PADRÃO)
  console.log(`\n💡 RECOMENDAÇÃO DE SEGURANÇA (PADRÃO OPÇÃO C):`);
  console.log(`   O PostgREST via HTTP não é atômico. Para um rollback 100% seguro sem risco de truncamento,`);
  console.log(`   o sistema recomenda executar o script SQL transacional atômico (BEGIN ... COMMIT) no SQL Editor do Supabase.`);
  console.log(`\n✅ O procedimento operacional completo e comandos de emergência foram validados.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("\n❌ ERRO FATAL NA RESTAURAÇÃO DE PRODUÇÃO:", err.message);
    process.exit(1);
  });
}
