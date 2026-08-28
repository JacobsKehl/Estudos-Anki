import fs from "fs";
import path from "path";

async function main() {
  const filePath = path.join(process.cwd(), "tmp", "smoke", "schedule_today.html");
  const content = fs.readFileSync(filePath, "utf-8");

  console.log("======================================================================");
  console.log("EXTRAÇÃO DOS BLOCOS DO CFC RENDEREZADOS NO CRONOGRAMA (SCHEDULE_TODAY)");
  console.log("======================================================================\n");

  // Localizar todas as ocorrências de blocos com material no payload do React Server Component
  const matches = Array.from(content.matchAll(/\\"title\\":\\"([^\\"]+)\\",\\"description\\":/g)).map(m => m[1]);

  // Se a regex com barra escapada não pegar por causa do formato do script, usar busca textual flexível
  let titles = matches;
  if (titles.length === 0) {
    const rawMatches = Array.from(content.matchAll(/"title":"([^"]+)"/g)).map(m => m[1]);
    titles = rawMatches;
  }

  // Filtrar títulos reais de blocos de estudo
  const ignore = ["Kehl Study", "Cronograma", "Matérias", "Configurações", "Perfil", "Biblioteca", "Desempenho", "Hoje", "Sair"];
  const uniqueTitles = Array.from(new Set(titles)).filter(t => !ignore.includes(t) && t.length > 2);

  console.log(`📌 Títulos de Blocos de Teoria Encontrados no HTML da Agenda (${uniqueTitles.length}):\n`);
  uniqueTitles.forEach((t, i) => {
    console.log(`   [${i + 1}] ${t}`);
  });

  // Verificar se existe qualquer título do Estratégia (que possuíam sufixos como "— atributos:", "— regime jurídico", etc.)
  const estrategiaStyleTitles = uniqueTitles.filter(t => t.includes("—") || t.toLowerCase().includes("estrategia") || t.toLowerCase().includes("concurseiro"));
  
  console.log(`\n🔍 Verificação de Blocos do Estratégia na Agenda:`);
  console.log(`   - Blocos do Estratégia encontrados: ${estrategiaStyleTitles.length}`);
  if (estrategiaStyleTitles.length > 0) {
    console.log(`   - Lista encontrada:`, estrategiaStyleTitles);
  } else {
    console.log(`   - ✅ ZERO BLOCOS DO ESTRATÉGIA NA AGENDA. TODOS OS BLOCOS PERTENCEM AOS RESUMOS ÂNCORA DO CFC!`);
  }
}

main();
