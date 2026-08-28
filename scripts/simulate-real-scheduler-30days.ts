import "dotenv/config";
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { reorganizeOverdueSchedule } from "../src/lib/scheduler";
import { getTodayRangeSP } from "../src/lib/date-utils";

const userId = "cmp8od0wz0000iybklaotfqbs";

function loadBlueprintPages(): Map<string, Set<string>> {
  const csvPath = path.resolve(__dirname, "../tmp/BLUEPRINT-blocos-cfc.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split("\n").map(l => l.trim()).filter(Boolean).slice(1);
  const map = new Map<string, Set<string>>();

  for (const line of lines) {
    const cols: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (c === ',' && !inQuotes) { cols.push(cur.trim()); cur = ""; }
      else cur += c;
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

async function main() {
  console.log("=== SIMULAÇÃO REAL 30 DIAS DO AGENDADOR (9 CONTAGENS INVARIANTES) ===\n");

  const blueprintMap = loadBlueprintPages();

  // 1. Executar Pass 1
  const res1 = await reorganizeOverdueSchedule(userId, false, false, new Date());
  // 2. Executar Pass 2 para medir idempotência real
  const res2 = await reorganizeOverdueSchedule(userId, false, false, new Date());

  const IDEMPOTENCIA_ITENS_MUDADOS = res2.changes?.length || 0;

  // 3. Buscar todos os itens de teoria nos próximos 30 dias
  const startDate = getTodayRangeSP(new Date()).start;
  const endDate = getTodayRangeSP(new Date(), 30).end;

  const items = await prisma.studyScheduleItem.findMany({
    where: {
      userId,
      schedule: { status: "ACTIVE" },
      actionType: "THEORY",
      status: "PENDING",
      scheduledDate: { gte: startDate, lte: endDate },
    },
    include: {
      subject: true,
      studyBlock: {
        include: { material: true }
      }
    },
    orderBy: [
      { scheduledDate: "asc" },
      { dayNumber: "asc" },
      { id: "asc" }
    ]
  });

  // Agrupar itens por data
  const byDate: Record<string, typeof items> = {};
  for (const item of items) {
    if (!item.scheduledDate) continue;
    const dStr = getTodayRangeSP(item.scheduledDate).dateString;
    if (!byDate[dStr]) byDate[dStr] = [];
    byDate[dStr].push(item);
  }

  const sortedDates = Object.keys(byDate).sort();
  const MIN_POR_DIA: Array<{ date: string; minutes: number; count: number; subjects: string[] }> = [];
  let DIAS_FORA_DA_FAIXA_30_60 = 0;
  let MATERIA_REPETIDA_NO_DIA = 0;
  let MATERIA_ABRINDO_DOIS_DIAS_SEGUIDOS = 0;
  let TEORIA_EM_DOMINGO = 0;
  let ITENS_COM_BLOCO_EXCLUDED = 0;
  let FORA_DE_ORDEM = 0;
  let ITENS_FORA_DO_BLUEPRINT = 0;

  let lastOpeningSubject = "";

  for (let i = 0; i < sortedDates.length; i++) {
    const dStr = sortedDates[i];
    const dayItems = byDate[dStr];
    const dayDate = new Date(dStr + "T12:00:00Z");
    const isSunday = dayDate.getUTCDay() === 0;

    if (isSunday) {
      TEORIA_EM_DOMINGO += dayItems.length;
    }

    const totalMinutes = dayItems.reduce((acc, it) => acc + (it.estimatedMinutes || 45), 0);
    const subjects = dayItems.map(it => it.subject?.name || "Sem Matéria");
    MIN_POR_DIA.push({ date: dStr, minutes: totalMinutes, count: dayItems.length, subjects });

    // Verificar faixa 30-60 min (exceto último dia de edital onde sobra resíduo)
    const isLastDay = (i === sortedDates.length - 1);
    if (!isLastDay && (totalMinutes < 30 || totalMinutes > 60)) {
      DIAS_FORA_DA_FAIXA_30_60++;
    }

    // Verificar matéria repetida no mesmo dia
    const uniqueSubjects = new Set(subjects);
    if (uniqueSubjects.size < subjects.length) {
      MATERIA_REPETIDA_NO_DIA++;
    }

    // Verificar se abriu com a mesma matéria do dia anterior
    const openingSubject = subjects[0] || "";
    if (lastOpeningSubject && openingSubject && lastOpeningSubject === openingSubject) {
      MATERIA_ABRINDO_DOIS_DIAS_SEGUIDOS++;
    }
    lastOpeningSubject = openingSubject;

    // Verificar integridade dos blocos
    for (const it of dayItems) {
      if (it.studyBlock?.theoryStatus === "EXCLUDED") {
        ITENS_COM_BLOCO_EXCLUDED++;
      }
      const matName = it.subject?.name || "";
      const pStart = it.studyBlock?.pageStart;
      const pEnd = it.studyBlock?.pageEnd;
      if (pStart !== undefined && pEnd !== undefined) {
        const bpSet = blueprintMap.get(matName);
        if (!bpSet || !bpSet.has(`${pStart}-${pEnd}`)) {
          ITENS_FORA_DO_BLUEPRINT++;
        }
      } else {
        ITENS_FORA_DO_BLUEPRINT++;
      }
    }
  }

  // Verificar ordenação didática por matéria
  const blocksBySubject: Record<string, Array<{ pageStart: number; pageEnd: number; date: string }>> = {};
  for (const it of items) {
    const sName = it.subject?.name || "";
    if (!blocksBySubject[sName]) blocksBySubject[sName] = [];
    blocksBySubject[sName].push({
      pageStart: it.studyBlock?.pageStart || 0,
      pageEnd: it.studyBlock?.pageEnd || 0,
      date: getTodayRangeSP(it.scheduledDate!).dateString
    });
  }

  for (const [sName, blks] of Object.entries(blocksBySubject)) {
    for (let j = 0; j < blks.length - 1; j++) {
      if (blks[j].pageStart > blks[j + 1].pageStart) {
        FORA_DE_ORDEM++;
        console.warn(`Violação de ordem em ${sName}: ${blks[j].pageStart}-${blks[j].pageEnd} antes de ${blks[j + 1].pageStart}-${blks[j + 1].pageEnd}`);
      }
    }
  }

  console.log("================ AS 9 CONTAGENS INVARIANTES ================");
  console.log(`MIN_POR_DIA = ${MIN_POR_DIA.map(d => `${d.date}: ${d.minutes}m (${d.count} blocos)`).join(" | ")}`);
  console.log(`DIAS_FORA_DA_FAIXA_30_60           = ${DIAS_FORA_DA_FAIXA_30_60}`);
  console.log(`MATERIA_REPETIDA_NO_DIA            = ${MATERIA_REPETIDA_NO_DIA}`);
  console.log(`MATERIA_ABRINDO_DOIS_DIAS_SEGUIDOS = ${MATERIA_ABRINDO_DOIS_DIAS_SEGUIDOS}`);
  console.log(`TEORIA_EM_DOMINGO                  = ${TEORIA_EM_DOMINGO}`);
  console.log(`ITENS_COM_BLOCO_EXCLUDED           = ${ITENS_COM_BLOCO_EXCLUDED}`);
  console.log(`FORA_DE_ORDEM                      = ${FORA_DE_ORDEM}`);
  console.log(`ITENS_FORA_DO_BLUEPRINT            = ${ITENS_FORA_DO_BLUEPRINT}`);
  console.log(`IDEMPOTENCIA_ITENS_MUDADOS         = ${IDEMPOTENCIA_ITENS_MUDADOS}`);
  console.log("============================================================\n");

  await prisma.$disconnect();
}

main().catch(console.error);
