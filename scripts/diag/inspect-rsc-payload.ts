import fs from "fs";
import path from "path";

function inspectPayload(fileName: string, terms: string[]) {
  const filePath = path.join(process.cwd(), "tmp", "smoke", fileName);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  console.log(`======================================================================`);
  console.log(`🔍 Inspeção do Payload RSC em tmp/smoke/${fileName}`);
  console.log(`======================================================================`);

  terms.forEach(t => {
    const idx = content.indexOf(t);
    if (idx !== -1) {
      console.log(`   ✅ Encontrado no HTML/Flight Payload: "${t}"`);
      const snippet = content.substring(Math.max(0, idx - 80), Math.min(content.length, idx + 150)).replace(/\n/g, " ");
      console.log(`      Snippet: "...${snippet}..."`);
    } else {
      console.log(`   ❌ Não encontrado: "${t}"`);
    }
  });
  console.log("\n");
}

inspectPayload("anchor_precredit.html", [
  "cmss35fow0007iyaoey50kzf4",
  "Atos Administrativos",
  "possiblyAlreadyStudied",
  "sourceV1Info",
  "PossiblyStudiedCard"
]);

inspectPayload("anchor_completed.html", [
  "cmss35g1r0009iyaobhjwwlbd",
  "Organização da Administração Pública",
  "COMPLETED",
  "theoryStatus"
]);

inspectPayload("schedule_today.html", [
  "CFC",
  "Estratégia",
  "MAIN_MATERIAL",
  "REFERENCE_MATERIAL",
  "scheduleItems"
]);
