import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "tmp", "smoke", "schedule_today.html");
const content = fs.readFileSync(filePath, "utf-8");

const matches = Array.from(content.matchAll(/h3[^}]+\} text-base leading-tight[^}]+\}/g));
console.log("Matches:", matches.length);

// Procurar por `Agentes Públicos` e ver os caracteres exatos antes e depois
const pos = content.indexOf("Agentes Públicos");
if (pos !== -1) {
  console.log("Escaped raw string around Agentes Públicos:");
  console.log(JSON.stringify(content.substring(pos - 100, pos + 100)));
}
