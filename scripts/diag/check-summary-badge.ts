import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "tmp", "smoke", "anchor_completed.html");
const content = fs.readFileSync(filePath, "utf-8");

console.log("======================================================================");
console.log("GREP NO HTML DE BLOCO CONCLUÍDO: tmp/smoke/anchor_completed.html");
console.log("======================================================================\n");

// 1. Sessão Concluída
const sessaoMatches = Array.from(content.matchAll(/Sessão\s+Concluída!/gi));
console.log(`1. Marca 'Sessão Concluída!': ${sessaoMatches.length} ocorrência(s)`);
if (sessaoMatches.length > 0 && sessaoMatches[0].index !== undefined) {
  const idx = sessaoMatches[0].index;
  console.log(`   Snippet: "${content.substring(Math.max(0, idx - 100), Math.min(content.length, idx + 200)).replace(/\n/g, " ")}"`);
}

// 2. ClassName border-none / bg-accent/10
const borderNoneMatches = Array.from(content.matchAll(/border-none font-bold text-xs uppercase/gi));
console.log(`\n2. ClassName 'border-none font-bold text-xs uppercase': ${borderNoneMatches.length} ocorrência(s)`);

// 3. Ícone Trophy / SVG Troféu
const trophyMatches = Array.from(content.matchAll(/lucide-trophy|trophy/gi));
console.log(`\n3. Ícone de Troféu (Trophy / lucide-trophy): ${trophyMatches.length} ocorrência(s)`);
