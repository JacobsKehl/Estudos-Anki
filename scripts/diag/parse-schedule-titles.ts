import fs from "fs";
import path from "path";

async function main() {
  const filePath = path.join(process.cwd(), "tmp", "smoke", "schedule_today.html");
  if (!fs.existsSync(filePath)) {
    console.error("Arquivo tmp/smoke/schedule_today.html não encontrado.");
    return;
  }

  const content = fs.readFileSync(filePath, "utf-8");

  console.log("======================================================================");
  console.log(`AUDITORIA DETALHADA DO HTML DE CRONOGRAMA: tmp/smoke/schedule_today.html`);
  console.log(`Tamanho: ${content.length} bytes`);
  console.log("======================================================================\n");

  // 1. Ocorrências de marcas do Estratégia
  const estrategiaMatches = content.match(/Concurseiro\s+Fora\s+da\s+Caixa/gi) || [];
  console.log(`1. Marca 'Concurseiro Fora da Caixa' (Estratégia): ${estrategiaMatches.length} ocorrência(s)`);

  // 2. Ocorrências de marcas do CFC
  const cfcMatches = content.match(/CFC/gi) || [];
  console.log(`2. Marca 'CFC': ${cfcMatches.length} ocorrência(s)`);

  // 3. Extração dos títulos dos blocos de estudo no HTML / JSON do payload
  // Procurar estruturas de títulos de blocos no payload ("title":"...")
  const titleMatches = Array.from(content.matchAll(/"title"\s*:\s*"([^"]+)"/g)).map(m => m[1]);
  
  // Filtrar títulos únicos ignorando nomes genéricos da UI
  const ignoreList = ["Kehl Study", "Cronograma", "Matérias", "Configurações", "Perfil", "Biblioteca", "Desempenho", "Hoje", "Sair"];
  const blockTitles = Array.from(new Set(titleMatches)).filter(t => !ignoreList.includes(t) && t.length > 3);

  console.log(`\n3. Lista dos Blocos de Estudo Renderizados na Agenda de Hoje (${blockTitles.length} títulos encontrados):\n`);
  blockTitles.forEach((title, idx) => {
    console.log(`   [${idx + 1}] "${title}"`);
  });
}

main();
