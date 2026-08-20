import fs from "fs";
import path from "path";

async function main() {
  const backupDir = path.join(process.cwd(), "backups", "json");
  const files = fs.readdirSync(backupDir).filter(f => f.endsWith(".json"));

  console.log("=================================================================");
  console.log("  AUDITORIA DOS BACKUPS ANTERIORES EM backups/json/");
  console.log("=================================================================\n");

  for (const f of files) {
    const filePath = path.join(backupDir, f);
    const sizeMb = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2);
    const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    const itemsCnt = content.items?.length ?? content.tables?.StudyScheduleItem?.length ?? "N/A";
    const extractedCnt = content.extractedContent?.length ?? content.tables?.ExtractedContent?.length ?? "N/A";
    const flashcardsCnt = content.flashcards?.length ?? content.tables?.Flashcard?.length ?? "N/A";
    const blocksCnt = content.blocks?.length ?? content.tables?.StudyBlock?.length ?? "N/A";

    const isTruncated = itemsCnt === 1000 || extractedCnt === 1000;

    console.log(`📄 Arquivo: ${f.padEnd(35)} (${sizeMb} MB)`);
    console.log(`   └ StudyScheduleItem: ${itemsCnt} | ExtractedContent: ${extractedCnt} | Flashcards: ${flashcardsCnt} | StudyBlock: ${blocksCnt}`);
    console.log(`   └ Status: ${isTruncated ? "⚠️ TRUNCADO NO LIMITE DE 1000 LINHAS" : "✅ NÃO-TRUNCADO"}\n`);
  }
}

main().catch(console.error);
