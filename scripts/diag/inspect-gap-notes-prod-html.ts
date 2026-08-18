import fs from "fs";

const html = fs.readFileSync("tmp/smoke/recursos_trab_prod.html", "utf-8");

console.log("======================================================================");
console.log("INSPEÇÃO DO HTML DE PRODUÇÃO DE RECURSOS TRABALHISTAS");
console.log("======================================================================\n");

console.log(`Tamanho total: ${html.length} bytes`);
console.log("Primeiros 500 chars:");
console.log(html.substring(0, 500));

console.log("\nProcurando ocorrências de 'gapNote' ou 'CFC' ou títulos:");
console.log(`- Contém "Recursos Trabalhistas": ${html.includes("Recursos Trabalhistas")}`);
console.log(`- Contém "Sessão Concluída!": ${html.includes("Sessão Concluída!")}`);
console.log(`- Contém "Creditado pelo Histórico": ${html.includes("Creditado pelo Histórico")}`);
console.log(`- Contém "gapNote": ${html.includes("gapNote")}`);
