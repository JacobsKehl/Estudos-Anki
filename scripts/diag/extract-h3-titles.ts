import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "tmp", "smoke", "schedule_today.html");
const content = fs.readFileSync(filePath, "utf-8");

console.log("======================================================================");
console.log("TITULOS DE BLOCOS EXTRAÍDOS DAS TAGS H3 DO CRONOGRAMA DE HOJE");
console.log("======================================================================\n");

// Regex para capturar os elementos h3 renderizados na agenda
const matches = Array.from(content.matchAll(/\["\$","h3",null,\{"className":"font-semibold[^"]*","children":"([^"]+)"\}/g)).map(m => m[1]);

console.log(`📌 Total de Blocos Exibidos no Cronograma de Hoje: ${matches.length}\n`);
matches.forEach((t, i) => {
  console.log(`   [${i + 1}] "${t}"`);
});

// Verificar se algum pertence ao Estratégia (marcas ou nomes do Estratégia)
const estrategiaMatches = matches.filter(t => t.includes("Concurseiro") || t.includes("Estratégia"));
console.log(`\n🔍 Verificação de Marcas do Estratégia nos Títulos da Agenda:`);
console.log(`   - Total de ocorrências do Estratégia: ${estrategiaMatches.length}`);
