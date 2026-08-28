import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "tmp", "smoke", "anchor_completed.html");
const content = fs.readFileSync(filePath, "utf-8");

console.log("======================================================================");
console.log("INSPEÇÃO DA OCORRÊNCIA DE 'CONCLUÍDO' EM TMP/SMOKE/ANCHOR_COMPLETED.HTML");
console.log("======================================================================\n");

const match = content.match(/concluído/i);
if (match && match.index !== undefined) {
  const start = Math.max(0, match.index - 150);
  const end = Math.min(content.length, match.index + 200);
  const snippet = content.substring(start, end).replace(/\n/g, " ");
  
  console.log(`✅ Ocorrência encontrada na posição ${match.index}:`);
  console.log(`\nSnippet literal (~350 caracteres em volta):\n`);
  console.log(`"${snippet}"\n`);
} else {
  console.log("❌ Ocorrência não encontrada.");
}

// Procurar também por badges de status visual no HTML/RSC Flight Payload (ex: "COMPLETED", "Concluído", "badge", etc.)
const statusBadges = Array.from(content.matchAll(/theoryStatus\\":\\"([^\\"]+)\\"/g)).map(m => m[1]);
console.log("Status de Teoria no JSON do payload:", Array.from(new Set(statusBadges)));
