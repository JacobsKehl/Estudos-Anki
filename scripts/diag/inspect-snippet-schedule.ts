import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "tmp", "smoke", "schedule_today.html");
const content = fs.readFileSync(filePath, "utf-8");

const term = "Agentes Públicos";
const idx = content.indexOf(term);
if (idx !== -1) {
  console.log("Snippet em torno de Agentes Públicos:");
  console.log(content.substring(idx - 150, idx + 300));
} else {
  console.log("Termo não encontrado");
}
