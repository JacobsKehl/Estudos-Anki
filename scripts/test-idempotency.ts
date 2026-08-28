import "dotenv/config";
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}
import { reorganizeOverdueSchedule } from "../src/lib/scheduler";
import { prisma } from "../src/lib/prisma";

const userId = "cmp8od0wz0000iybklaotfqbs";

async function main() {
  console.log("=== TESTE DE IDEMPOTÊNCIA ESTRITA (3x preserveToday = true) ===");

  console.log("\n1. Executando PASS 1 (preserveToday = true)...");
  const res1 = await reorganizeOverdueSchedule(userId, false, true, new Date());
  console.log(`Pass 1: Changes Count = ${res1.changes?.length || 0}`);

  console.log("\n2. Executando PASS 2 (preserveToday = true)...");
  const res2 = await reorganizeOverdueSchedule(userId, false, true, new Date());
  console.log(`Pass 2: Changes Count = ${res2.changes?.length || 0}`);

  console.log("\n3. Executando PASS 3 (preserveToday = true)...");
  const res3 = await reorganizeOverdueSchedule(userId, false, true, new Date());
  console.log(`Pass 3: Changes Count = ${res3.changes?.length || 0}`);

  console.log(`\n>>> IDEMPOTENCIA_ITENS_MUDADOS (Pass 3): ${res3.changes?.length || 0}`);

  await prisma.$disconnect();
}

main().catch(console.error);
