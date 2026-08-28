import fs from "fs";
import path from "path";

function loadBlueprintPages(): Map<string, Set<string>> {
  const csvPath = path.resolve(__dirname, "../../tmp/BLUEPRINT-blocos-cfc.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n").map(l => l.trim()).filter(Boolean).slice(1);
  const map = new Map<string, Set<string>>();

  for (const line of lines) {
    // Parse CSV line properly handling quotes
    const cols: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        cols.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    cols.push(cur.trim());

    const materia = cols[0];
    const pageStart = cols[6];
    const pageEnd = cols[7];
    if (materia && pageStart && pageEnd) {
      if (!map.has(materia)) map.set(materia, new Set());
      map.get(materia)!.add(`${pageStart}-${pageEnd}`);
    }
  }
  return map;
}

const bp = loadBlueprintPages();
let total = 0;
for (const [m, s] of bp.entries()) {
  console.log(`${m}: ${s.size} blocos`);
  total += s.size;
}
console.log("Total blocos carregados:", total);
console.log("Const 53-55 existe?", bp.get("Direito Constitucional")?.has("53-55"));
console.log("Civil 34-34 existe?", bp.get("Direito Processual Civil")?.has("34-34"));
