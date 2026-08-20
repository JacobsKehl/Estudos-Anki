import fs from "fs";
import path from "path";

async function main() {
  const p1 = path.join(process.cwd(), "backups", "json", "pre-limpeza-agenda.json");
  const p2 = path.join(process.cwd(), "backups", "json", "pre-limpeza-agenda-completo.json");

  console.log("=================================================================");
  console.log("  INSPEÇÃO DOS ARQUIVOS DE BACKUP EM backups/json/");
  console.log("=================================================================\n");

  if (fs.existsSync(p1)) {
    const c1 = JSON.parse(fs.readFileSync(p1, "utf-8"));
    const items1 = c1.tables?.StudyScheduleItem?.length ?? c1.items?.length ?? 0;
    const size1 = (fs.statSync(p1).size / (1024 * 1024)).toFixed(2);
    console.log(`📄 pre-limpeza-agenda.json (${size1} MB):`);
    console.log(`   └ StudyScheduleItem: ${items1} linhas`);
    console.log(`   └ Status: ${items1 === 2678 ? "✅ BACKUP ÍNTEGRO (2.678 LINHAS)" : "⚠️ SOBRESCRITO / TRUNCADO"}\n`);
  }

  if (fs.existsSync(p2)) {
    const c2 = JSON.parse(fs.readFileSync(p2, "utf-8"));
    const items2 = c2.tables?.StudyScheduleItem?.length ?? c2.items?.length ?? 0;
    const size2 = (fs.statSync(p2).size / (1024 * 1024)).toFixed(2);
    console.log(`📄 pre-limpeza-agenda-completo.json (${size2} MB):`);
    console.log(`   └ StudyScheduleItem: ${items2} linhas`);
    console.log(`   └ Status: ${items2 === 1702 ? "✅ PÓS-PRIMEIRA-EXPURGA (1.702 LINHAS)" : "N/A"}\n`);
  }
}

main().catch(console.error);
