import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "tmp", "smoke", "schedule_today.html");
const content = fs.readFileSync(filePath, "utf-8");

// Procurar por ocorrências de "Concurseiro"
console.log("Concurseiro matches:", (content.match(/concurseiro/gi) || []).length);

// Procurar por títulos dos blocos âncora do CFC conhecidos no banco (ex: "Atos Administrativos", "Agentes Públicos", "Organização da Administração Pública")
const cfcAnchorTitles = [
  "Atos Administrativos",
  "Agentes Públicos",
  "Organização da Administração Pública e Terceiro Setor",
  "Princípios da Administração Pública",
  "Poderes da Administração Pública",
  "Responsabilidade Civil do Estado",
  "Controle da Administração Pública",
  "Processo Administrativo",
  "Licitações e Contratos",
  "Serviços Públicos",
  "Bens Públicos",
  "Improbidade Administrativa"
];

console.log("\nProcurando por Títulos dos Blocos Âncora do CFC no HTML da Agenda:");
cfcAnchorTitles.forEach(t => {
  const count = (content.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi")) || []).length;
  console.log(` - "${t}": ${count} ocorrência(s)`);
});

// Extrair snippets de `self.__next_f.push` contendo blocos/agendamentos na agenda
const match = content.match(/scheduleItems|todayItems|scheduledBlocks|theoryBlocks/gi);
console.log("\nPalavras-chave de agendamento encontradas:", match);
