/**
 * backup-pre-reaponta-revisoes-orfas-2026-09-16.ts
 *
 * Backup paginado, com asserção de completude por tabela, antes de reapontar
 * as 3 StudyScheduleItem (REVIEW_BLOCK PENDING) do cronograma ativo que hoje
 * apontam para StudyBlock EXCLUDED.
 *
 * Só backup. A escrita é feita por outro script (reaponta-revisoes-orfas.ts).
 */
import "dotenv/config";
import { createPaginatedBackup } from "./backup-paginated";

createPaginatedBackup("pre-reaponta-revisoes-orfas-2026-09-16").catch((err) => {
  console.error(err);
  process.exit(1);
});
