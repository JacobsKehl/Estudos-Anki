import fs from "fs";
import path from "path";

async function main() {
  const filePath = path.join(process.cwd(), "tmp", "smoke", "schedule_today.html");
  const content = fs.readFileSync(filePath, "utf-8");

  console.log("======================================================================");
  console.log("LISTA COMPLETA DOS BLOCOS RENDEREZADOS NO CRONOGRAMA DE HOJE (PRODUÇÃO)");
  console.log("======================================================================\n");

  // Capturar todos os títulos de blocos de estudo renderizados nos elementos h3 do cronograma
  const regex = /\\"h3\\",null,\{\\"className\\":\\"[^\\"]*font-semibold[^\\"]*\\",\\"children\\":\\"([^\\"]+)\\"/g;
  const matches = Array.from(content.matchAll(regex)).map(m => m[1]);

  console.log(`📌 Total de Blocos de Teoria Exibidos na Agenda de Hoje: ${matches.length}\n`);

  matches.forEach((title, idx) => {
    console.log(`   [${idx + 1}] "${title}"`);
  });

  // 1. Marca 'Concurseiro Fora da Caixa' (Estratégia)
  const estrategiaBrandCount = (content.match(/Concurseiro\s+Fora\s+da\s+Caixa/gi) || []).length;
  console.log(`\n🔍 Verificação de Marcas do Estratégia no HTML:`);
  console.log(`   - Ocorrências de 'Concurseiro Fora da Caixa': ${estrategiaBrandCount}`);

  // 2. Marcas do CFC
  const cfcBrandCount = (content.match(/CFC/gi) || []).length;
  console.log(`   - Ocorrências da sigla 'CFC': ${cfcBrandCount}`);

  // 3. Verificação se algum dos títulos pertence ao Estratégia V1 (ex: possui '— atributos', '— conceito', etc)
  const estrategiaTitles = matches.filter(t => t.includes("— atributos:") || t.includes("— conceito, características"));
  console.log(`   - Títulos no formato estrito do Estratégia V1: ${estrategiaTitles.length}`);
}

main();
