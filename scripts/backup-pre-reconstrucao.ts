/**
 * backup-pre-reconstrucao.ts
 *
 * Executa o backup paginado completo com asserção estrita antes do rebuild dos 94 blocos.
 * Salva em backups/json/pre-reconstrucao-blocos-cfc.json.
 */
import { createPaginatedBackup } from "./backup-paginated";

async function main() {
  const label = "pre-reconstrucao-blocos-cfc";
  console.log(`Iniciando backup obrigatório: ${label}...`);
  const result = await createPaginatedBackup(label);
  console.log(`Backup finalizado com sucesso em: ${result.backupPath}`);
}

main().catch((err) => {
  console.error("🛑 FALHA NO BACKUP:", err);
  process.exit(1);
});
