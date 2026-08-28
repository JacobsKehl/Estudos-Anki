import fs from "fs";
import path from "path";

const pathA = path.resolve(__dirname, "../../backups/json/pre-teste-reorganize-28-08.json");
const pathB = path.resolve(__dirname, "../../backups/json/pre-teste-reorganize-28-08-b.json");

const backupA = JSON.parse(fs.readFileSync(pathA, "utf-8"));
const backupB = JSON.parse(fs.readFileSync(pathB, "utf-8"));

const itemsA: any[] = backupA.tables.StudyScheduleItem;
const itemsB: any[] = backupB.tables.StudyScheduleItem;

console.log("==========================================================================");
console.log("  DIFF EXCLUSIVO ENTRE OS DOIS BACKUPS DE DISCO");
console.log("==========================================================================");
console.log(`Backup A (pre-teste-reorganize-28-08.json)   : ${itemsA.length} itens`);
console.log(`Backup B (pre-teste-reorganize-28-08-b.json) : ${itemsB.length} itens`);
console.log(`Diferença líquida: ${itemsA.length - itemsB.length} itens\n`);

const mapB = new Map(itemsB.map(i => [i.id, i]));
const onlyInA = itemsA.filter(i => !mapB.has(i.id));

console.log(`Total de itens que existem em A e NÃO existem em B: ${onlyInA.length}\n`);

// Agrupar por status e actionType
const summary: Record<string, number> = {};
for (const item of onlyInA) {
  const key = `${item.actionType} | status=${item.status}`;
  summary[key] = (summary[key] || 0) + 1;
}

console.log("Distribuição dos itens sumidos por (actionType | status):");
for (const [k, count] of Object.entries(summary)) {
  console.log(`  - ${k}: ${count}`);
}

console.log("\nAmostra dos primeiros 10 itens sumidos de A:");
for (const item of onlyInA.slice(0, 10)) {
  console.log(`  ID: ${item.id} | data: ${item.scheduledDate} | tipo: ${item.actionType} | status: ${item.status} | blocoId: ${item.studyBlockId} | reason: ${item.reason || "N/A"}`);
}

const createdInTest = onlyInA.filter(i => i.id.startsWith("cmitem_"));
console.log(`\nItens com prefixo de ID sintético/reorganize (cmitem_*): ${createdInTest.length} de ${onlyInA.length}`);
