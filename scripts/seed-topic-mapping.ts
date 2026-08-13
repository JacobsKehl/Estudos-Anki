import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// Map das relações do CSV para o enum / modelo do banco
const RELATION_MAP: Record<string, string> = {
  "EXATO": "EXATO",
  "EXACT": "EXATO",
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
  cont_v1: string;
  cont_v2: string;
  sobra: string;
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

  const rows: CSVRow[] = [];
  const unreviewedRows: { lineNumber: number; row: CSVRow }[] = [];
  const distribution: Record<string, number> = {
    EXATO: 0,
    PARCIAL: 0,
    V1_MAIS_ESTREITO: 0,
    V1_MAIS_AMPLO: 0,
    NENHUM: 0,
  };

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
      cont_v1: cols[8] || "",
      cont_v2: cols[9] || "",
      sobra: cols[10] || "",
      revisado: cols[11] || "",
      observacao: cols[12] || "",
    };

    rows.push(row);

    const rel = RELATION_MAP[row.revisado.trim().toUpperCase()] || RELATION_MAP[row.relacao_sugerida.trim().toUpperCase()] || "NENHUM";
    distribution[rel] = (distribution[rel] || 0) + 1;

    // 🔒 Trava de Segurança: verifica se a linha foi revisada humanamente
    const isReviewed = row.revisado.trim().toUpperCase();
    if (!["EXATO", "EXACT", "V1_MAIS_AMPLO", "V1_MAIS_ESTREITO", "PARCIAL", "NENHUM"].includes(isReviewed)) {
      unreviewedRows.push({ lineNumber: i + 1, row });
    }
  }

  // 🛑 TRAVA DE SEGURANÇA MANDATÓRIA: Aborta se houver qualquer linha pendente de curadoria humana
  if (unreviewedRows.length > 0) {
    console.error(`\n🛑 TRAVA DE SEGURANÇA ATIVADA!`);
    console.error(`Existem ${unreviewedRows.length} linhas pendentes de curadoria humana no CSV.`);
    for (const un of unreviewedRows.slice(0, 10)) {
      console.error(`  - Linha ${un.lineNumber}: [V2: ${un.row.v2_materia} | ${un.row.v2_topico}] ↔ [V1: ${un.row.v1_topico || 'Nenhum'}]`);
    }
    process.exit(1);
  }

  console.log(`✅ Trava de segurança OK: Todas as ${rows.length} linhas do CSV estão revisadas!`);
  console.log("⏳ Conectando ao banco para semear SyllabusTopicMapping...");

  try {
    let upsertedCount = 0;
    let unmappedNenhumCount = 0;

    for (const r of rows) {
      const relationType = RELATION_MAP[r.revisado.trim().toUpperCase()] || RELATION_MAP[r.relacao_sugerida.trim().toUpperCase()] || "NENHUM";

      if (!r.v1_topic_id || !r.v2_topic_id) {
        unmappedNenhumCount++;
        continue;
      }

      await prisma.syllabusTopicMapping.upsert({
        where: {
          v1TopicId_v2TopicId: {
            v1TopicId: r.v1_topic_id,
            v2TopicId: r.v2_topic_id,
          },
        },
        create: {
          v1TopicId: r.v1_topic_id,
          v2TopicId: r.v2_topic_id,
          relationType,
          notes: r.observacao || null,
        },
        update: {
          relationType,
          notes: r.observacao || null,
        },
      });

      upsertedCount++;
    }

    console.log(`\n🎉 Seed de SyllabusTopicMapping concluído com sucesso!`);
    console.log(` - Mapeamentos salvos no banco (upserted): ${upsertedCount}`);
    console.log(` - Tópicos NENHUM sem par no banco (órfãos de V1/V2): ${unmappedNenhumCount}`);
    console.log(`\n── Distribuição por relationType (${rows.length} linhas totais no CSV) ──`);
    console.log(`  EXATO:            ${distribution.EXATO}`);
    console.log(`  PARCIAL:          ${distribution.PARCIAL}`);
    console.log(`  V1_MAIS_ESTREITO: ${distribution.V1_MAIS_ESTREITO}`);
    console.log(`  V1_MAIS_AMPLO:    ${distribution.V1_MAIS_AMPLO}`);
    console.log(`  NENHUM:           ${distribution.NENHUM}`);
    console.log(`  TOTAL CSV:        ${rows.length}`);
  } catch (error) {
    console.error("❌ Erro ao semear no banco:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedTopicMapping();
