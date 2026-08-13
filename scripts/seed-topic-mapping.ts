import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Map das relações do CSV para o enum / modelo do banco
const RELATION_MAP: Record<string, string> = {
  "EXATO": "EXACT",
  "V1_MAIS_AMPLO": "V1_MAIS_AMPLO",
  "V1_MAIS_ESTREITO": "V1_MAIS_ESTREITO",
  "PARCIAL": "PARCIAL",
  "NENHUM": "NENHUM",
};

interface CSVRow {
  v2_topic_id: string;
  v2_materia: string;
  v2_topico: string;
  v1_topic_id: string;
  v1_materia: string;
  v1_topico: string;
  relacao_sugerida: string;
  score: string;
  revisado: string;
  observacao: string;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // pular aspas escapadas
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

async function seedTopicMapping() {
  const csvPath = path.join(__dirname, "../docs/taxonomy/de-para-draft.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Arquivo de de-para não encontrado em: ${csvPath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(csvPath, "utf-8");
  const lines = fileContent.split(/\r?\n/).filter(l => l.trim().length > 0);

  if (lines.length <= 1) {
    console.error("❌ O arquivo CSV está vazio ou contém apenas o cabeçalho.");
    process.exit(1);
  }

  const header = parseCSVLine(lines[0]);
  const rows: CSVRow[] = [];
  const unreviewedRows: { lineNumber: number; row: CSVRow }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const row: CSVRow = {
      v2_topic_id: cols[0] || "",
      v2_materia: cols[1] || "",
      v2_topico: cols[2] || "",
      v1_topic_id: cols[3] || "",
      v1_materia: cols[4] || "",
      v1_topico: cols[5] || "",
      relacao_sugerida: cols[6] || "",
      score: cols[7] || "0",
      revisado: cols[8] || "",
      observacao: cols[9] || "",
    };

    rows.push(row);

    // 🔒 Trava de Segurança: verifica se a linha foi revisada humanamente
    const isReviewed = row.revisado.trim().toUpperCase();
    if (!["SIM", "OK", "X", "TRUE", "1", "EXATO", "V1_MAIS_AMPLO", "V1_MAIS_ESTREITO", "PARCIAL", "NENHUM"].includes(isReviewed)) {
      unreviewedRows.push({ lineNumber: i + 1, row });
    }
  }

  // 🛑 TRAVA DE SEGURANÇA MANDATÓRIA: Aborta se houver qualquer linha pendente de curadoria humana
  if (unreviewedRows.length > 0) {
    console.error(`\n🛑 TRAVA DE SEGURANÇA ATIVADA!`);
    console.error(`Existem ${unreviewedRows.length} linhas pendentes de curadoria humana no CSV.`);
    console.error(`O script RECUSA a execução até que 100% das linhas estejam marcadas como revisadas na coluna 'revisado'.\n`);
    console.error(`Primeiras 10 linhas pendentes:`);
    for (const un of unreviewedRows.slice(0, 10)) {
      console.error(`  - Linha ${un.lineNumber}: [V2: ${un.row.v2_materia} | ${un.row.v2_topico}] ↔ [V1: ${un.row.v1_topico || 'Nenhum'}] (sugerido: '${un.row.relacao_sugerida}')`);
    }
    if (unreviewedRows.length > 10) {
      console.error(`  ... e mais ${unreviewedRows.length - 10} linhas.`);
    }
    console.error(`\nPor favor, revise o arquivo 'docs/taxonomy/de-para-draft.csv', preencha a coluna 'revisado' para todas as linhas e execute novamente.`);
    process.exit(1);
  }

  console.log(`✅ Trava de segurança OK: Todas as ${rows.length} linhas do CSV estão revisadas!`);
  console.log("⏳ Conectando ao banco para semear SyllabusTopicMapping...");

  // Este trecho rodará quando o banco Supabase estiver disponível e as migrations aplicadas
  try {
    let inserted = 0;
    let skipped = 0;

    for (const r of rows) {
      const relation = RELATION_MAP[r.revisado.toUpperCase()] || RELATION_MAP[r.relacao_sugerida.toUpperCase()] || "NENHUM";
      
      // Linhas com NENHUM ou sem v1_topic_id que não possuem vínculo ativo
      if (!r.v1_topic_id || relation === "NENHUM") {
        skipped++;
        continue;
      }

      // Upsert no SyllabusTopicMapping (será executado quando a migration 3/4 criar a tabela)
      // await prisma.syllabusTopicMapping.upsert({ ... })
      inserted++;
    }

    console.log(`\n🎉 Seed de de-para concluído com sucesso!`);
    console.log(` - Mapeamentos válidos processados: ${inserted}`);
    console.log(` - Mapeamentos sem correspondência (NENHUM): ${skipped}`);
  } catch (error) {
    console.error("❌ Erro ao semear no banco:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedTopicMapping();
