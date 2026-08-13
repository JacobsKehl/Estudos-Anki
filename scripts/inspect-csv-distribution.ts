import fs from "fs";
import path from "path";

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
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

const csvPath = path.join(__dirname, "../docs/taxonomy/de-para-draft.csv");
const content = fs.readFileSync(csvPath, "utf-8");
const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

console.log(`Header: ${lines[0]}`);
console.log(`Total data rows: ${lines.length - 1}`);

const distribution: Record<string, number> = {};
let hasV1AndV2 = 0;
let missingV1OrV2 = 0;

for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  const v2_topic_id = cols[0];
  const v1_topic_id = cols[3];
  const revisado = cols[11] || cols[6];

  distribution[revisado] = (distribution[revisado] || 0) + 1;

  if (v1_topic_id && v2_topic_id) {
    hasV1AndV2++;
  } else {
    missingV1OrV2++;
  }
}

console.log("\nDistribuição por relationType no CSV:");
console.dir(distribution);
console.log(`\nCom v1 e v2: ${hasV1AndV2} | Faltando v1 ou v2: ${missingV1OrV2}`);
