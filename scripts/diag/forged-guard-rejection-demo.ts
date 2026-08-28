import fs from "fs";
import path from "path";

interface BlueprintRow {
  materia: string;
  pdf_no_banco: string;
  ordem: number;
  titulo_capitulo: string;
  parte: number;
  de: number;
  pageStart: number;
  pageEnd: number;
  paginas: number;
  minutos_3ppm: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else current += ch;
  }
  result.push(current.trim());
  return result;
}

function loadBlueprint(): BlueprintRow[] {
  const csvPath = path.join(process.cwd(), "tmp", "BLUEPRINT-blocos-cfc.csv");
  const content = fs.readFileSync(csvPath, "utf-8").trim();
  const lines = content.split("\n").slice(1);
  return lines.map((line) => {
    const cols = parseCSVLine(line);
    return {
      materia: cols[0],
      pdf_no_banco: cols[1],
      ordem: parseInt(cols[2], 10),
      titulo_capitulo: cols[3],
      parte: parseInt(cols[4], 10),
      de: parseInt(cols[5], 10),
      pageStart: parseInt(cols[6], 10),
      pageEnd: parseInt(cols[7], 10),
      paginas: parseInt(cols[8], 10),
      minutos_3ppm: parseInt(cols[9], 10),
    };
  });
}

function validateScheduleItemsIntegrity(
  scheduleItems: any[],
  blueprint: BlueprintRow[],
  cfcFiles: readonly string[]
): string[] {
  const invalidItems: string[] = [];

  for (const item of scheduleItems || []) {
    const b = item.StudyBlock as any;
    const matFileName = b?.StudyMaterial?.originalFileName;
    const subName = (item.StudySubject as any)?.name;

    if (!b) {
      invalidItems.push(`❌ Item ${item.id} (${item.scheduledDate}) sem StudyBlock vinculado (studyBlockId=${item.studyBlockId})`);
      continue;
    }

    const match = blueprint.find(
      (r) =>
        r.pdf_no_banco === matFileName &&
        r.pageStart === b.pageStart &&
        r.pageEnd === b.pageEnd
    );

    if (!match) {
      invalidItems.push(
        `❌ Item ${item.id} (${item.scheduledDate?.substring(0, 10) ?? ""}) [${subName}]: Bloco [${b.pageStart}–${b.pageEnd}] "${b.title}" NÃO existe no Blueprint (PDF=${matFileName})`
      );
    }

    if (b.theoryStatus !== "NOT_STARTED") {
      invalidItems.push(
        `❌ Item ${item.id} (${item.scheduledDate?.substring(0, 10) ?? ""}) [${subName}]: Bloco tem theoryStatus="${b.theoryStatus}" (esperado: "NOT_STARTED")`
      );
    }

    if (!cfcFiles.includes(matFileName)) {
      invalidItems.push(
        `❌ Item ${item.id} (${item.scheduledDate?.substring(0, 10) ?? ""}) [${subName}]: Material "${matFileName}" NÃO pertence aos 5 PDFs do CFC`
      );
    }
  }

  return invalidItems;
}

const cfcFiles = [
  "1 - Direito Administrativo_compressed.pdf",
  "2 - Direito do Trabalho.pdf",
  "3 - Direito Constitucional.pdf",
  "4 - Direito Processual do Trabalho.pdf",
  "Direito Processual Civil_compressed.pdf",
];

const forgedItems = [
  {
    id: "item-antigo-1",
    scheduledDate: "2026-08-28T00:00:00-03:00",
    actionType: "THEORY",
    status: "PENDING",
    studyBlockId: "block-da-3-23",
    StudySubject: { name: "Direito Administrativo" },
    StudyBlock: {
      id: "block-da-3-23",
      title: "Agentes Públicos — Conceito, Classificações Iniciais e Agentes Políticos",
      pageStart: 3,
      pageEnd: 23,
      theoryStatus: "NOT_STARTED",
      StudyMaterial: { originalFileName: "direito administrativo 11.pdf" },
    },
  },
  {
    id: "item-antigo-2",
    scheduledDate: "2026-08-28T00:00:00-03:00",
    actionType: "THEORY",
    status: "PENDING",
    studyBlockId: "block-dc-3-13",
    StudySubject: { name: "Direito Constitucional" },
    StudyBlock: {
      id: "block-dc-3-13",
      title: "Poder Legislativo — Funções, Estrutura, Reuniões e Comissões Parlamentares",
      pageStart: 3,
      pageEnd: 13,
      theoryStatus: "NOT_STARTED",
      StudyMaterial: { originalFileName: "direito constitucional 9.pdf" },
    },
  },
];

console.log("=== DEMONSTRAÇÃO DA REPROVAÇÃO DO GUARDIÃO CONTRA ITENS FORJADOS [3-23] E [3-13] ===");
const blueprint = loadBlueprint();
const violations = validateScheduleItemsIntegrity(forgedItems, blueprint, cfcFiles);

console.log(`\nTotal de violações detectadas: ${violations.length}\n`);
violations.forEach((v) => console.log(v));

if (violations.length > 0) {
  console.log("\n🛑 STATUS: GUARDIÃO REPROVOU COM SUCESSO AS ANOMALIAS FORJADAS.");
}
