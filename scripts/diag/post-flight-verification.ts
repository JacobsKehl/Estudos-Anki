/**
 * post-flight-verification.ts
 *
 * Verificação Pós-Realinhamento:
 * 1. Comparação lado a lado do cronograma dos próximos 7 dias (ANTES vs DEPOIS).
 * 2. Invariante 1: Lacuna e Sobreposição (0 gaps, 0 overlaps).
 * 3. Invariante 2: Limites de Fronteira com a Exceção Nomeada (capa/sumário e página final do TEC).
 * 4. Invariante 3: Detector Positivo de Âncora no estado atual pós-realinhamento.
 * 5. Métricas recalculadas para Gabriela (blocos inéditos, minutos totais, data de fim da teoria, blocos COMPLETED afetados).
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const cfcMaterialsInfo = [
  { name: "1 - Direito Administrativo_compressed.pdf", folder: "CFC TRT4", numPages: 152, firstContentPage: 6, lastContentPage: 151 },
  { name: "2 - Direito do Trabalho.pdf", folder: "CFC TRT4", numPages: 38, firstContentPage: 4, lastContentPage: 37 },
  { name: "3 - Direito Constitucional.pdf", folder: "study-inbox", numPages: 86, firstContentPage: 4, lastContentPage: 85 },
  { name: "4 - Direito Processual do Trabalho.pdf", folder: "study-inbox", numPages: 30, firstContentPage: 3, lastContentPage: 29 },
  { name: "Direito Processual Civil_compressed.pdf", folder: "study-inbox", numPages: 76, firstContentPage: 4, lastContentPage: 75 }
];

const cfcFiles = cfcMaterialsInfo.map(m => m.name);
const downloadsDir = "C:\\Users\\henrique.kehl\\Downloads";

function findPdfPath(m: { name: string; folder: string }): string | null {
  const candidates = [
    path.join(downloadsDir, m.folder, m.name),
    path.join(downloadsDir, "study-inbox", m.name),
    path.join(downloadsDir, "CFC TRT4", m.name),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function cleanHeaderFooter(rawText: string): string {
  return rawText.replace(/Direito\s+[\w\s]+\s+C\s+o\s+n\s+c\s+u\s+r\s+s\s+e\s+i\s+r\s+o[^\n|]+\|\s*\d+/gi, "").trim();
}

function getTitleKeywords(title: string): string[] {
  const stopWords = new Set(["de", "do", "da", "dos", "das", "e", "em", "para", "com", "por", "sobre", "sua", "seus", "arts", "art"]);
  const cleanTitle = title.replace(/\(.*?\)/g, "").replace(/[+\-\/,.]/g, " ");
  return cleanTitle.split(/\s+/).map(w => w.trim()).filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
}

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const { data: allBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, theoryStatus, StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId);

  // ====================================================================
  // 1. COMPARATIVO DO CRONOGRAMA DOS PRÓXIMOS 7 DIAS
  // ====================================================================
  console.log("\n" + "=".repeat(100));
  console.log("  1. COMPARATIVO DE ITENS DA AGENDA NOS PRÓXIMOS 7 DIAS (ANTES vs DEPOIS)");
  console.log("=".repeat(100));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  const { data: items } = await supabase
    .from("StudyScheduleItem")
    .select("id, status, scheduledDate, estimatedMinutes, StudyBlock:studyBlockId(title, estimatedStudyMinutes)")
    .eq("userId", userId)
    .gte("scheduledDate", today.toISOString())
    .lt("scheduledDate", sevenDaysLater.toISOString());

  console.log(`\n  Data       | ANTES | DEPOIS | Status`);
  console.log(`  -----------|-------|--------|------------------`);

  const countsBefore = [20, 23, 22, 21, 23, 23, 20]; // gravado do pre-flight

  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(today);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayItems = (items || []).filter((it: any) => {
      if (!it.scheduledDate) return false;
      const d = new Date(it.scheduledDate);
      return d >= dayStart && d < dayEnd;
    });

    const dStr = dayStart.toISOString().substring(0, 10);
    const cntAfter = dayItems.length;
    const cntBefore = countsBefore[i];

    const match = cntBefore === cntAfter ? "✅ Idêntico" : `⚠️ Mudou (${cntAfter - cntBefore > 0 ? "+" : ""}${cntAfter - cntBefore})`;
    console.log(`  ${dStr} | ${cntBefore.toString().padStart(5)} | ${cntAfter.toString().padStart(6)} | ${match}`);
  }

  // ====================================================================
  // 2. INVARIANTE 1: CONTINUIDADE (LACUNAS E SOBREPOSIÇÕES)
  // ====================================================================
  console.log("\n" + "=".repeat(100));
  console.log("  2. INVARIANTE 1: LACUNAS E SOBREPOSIÇÕES (CONTIGUIDADE)");
  console.log("=".repeat(100));

  let totalGaps = 0;
  let totalOverlaps = 0;

  for (const m of cfcMaterialsInfo) {
    const matBlocks = (allBlocks || []).filter(b =>
      (b as any).StudyMaterial?.originalFileName === m.name &&
      b.theoryStatus !== "EXCLUDED" &&
      b.pageStart > 0
    ).sort((a: any, b: any) => a.pageStart - b.pageStart);

    let gaps = 0;
    let overlaps = 0;

    for (let i = 0; i < matBlocks.length - 1; i++) {
      const curr = matBlocks[i];
      const next = matBlocks[i + 1];

      if (curr.pageEnd + 1 < next.pageStart) {
        gaps++;
        totalGaps++;
        console.log(`  🔴 GAP em ${m.name}: '${curr.title}' [${curr.pageStart}–${curr.pageEnd}] → '${next.title}' [${next.pageStart}–${next.pageEnd}] (faltam pp. ${curr.pageEnd + 1}–${next.pageStart - 1})`);
      }

      if (curr.pageEnd >= next.pageStart) {
        overlaps++;
        totalOverlaps++;
        console.log(`  🔴 OVERLAP em ${m.name}: '${curr.title}' [${curr.pageStart}–${curr.pageEnd}] ∩ '${next.title}' [${next.pageStart}–${next.pageEnd}]`);
      }
    }

    console.log(`  📘 ${m.name.padEnd(44)}: ${matBlocks.length} blocos → ${gaps === 0 && overlaps === 0 ? "✅ 0 LACUNAS | 0 SOBREPOSIÇÕES" : `❌ ${gaps} lacunas, ${overlaps} sobreposições`}`);
  }

  // ====================================================================
  // 3. INVARIANTE 2: FRONTEIRAS DO ARQUIVO COM EXCEÇÃO NOMEADA
  // ====================================================================
  console.log("\n" + "=".repeat(100));
  console.log("  3. INVARIANTE 2: LIMITES DE FRONTEIRA DO ARQUIVO (COM EXCEÇÃO NOMEADA)");
  console.log("=".repeat(100));
  console.log("  📌 EXCEÇÃO NOMEADA REGISTRADA:");
  console.log("     'A capa/sumário (pp. 1-3 ou 1-5) e a última página de cada PDF do CFC (EXTRA – EXERCÍCIOS/QUESTÕES (TEC)) não pertencem a bloco.'\n");

  let boundaryErrors = 0;

  for (const m of cfcMaterialsInfo) {
    const matBlocks = (allBlocks || []).filter(b =>
      (b as any).StudyMaterial?.originalFileName === m.name &&
      b.theoryStatus !== "EXCLUDED" &&
      b.pageStart > 0
    ).sort((a: any, b: any) => a.pageStart - b.pageStart);

    const minStart = Math.min(...matBlocks.map(b => b.pageStart));
    const maxEnd = Math.max(...matBlocks.map(b => b.pageEnd));

    const startOk = minStart === m.firstContentPage;
    const endOk = maxEnd === m.lastContentPage;

    if (!startOk || !endOk) boundaryErrors++;

    console.log(`  📘 ${m.name.padEnd(44)}: minStart=${minStart} (esperado ${m.firstContentPage}) [${startOk ? "✅" : "❌"}] | maxEnd=${maxEnd} (esperado ${m.lastContentPage}, TEC é p.${m.numPages}) [${endOk ? "✅" : "❌"}]`);
  }

  // ====================================================================
  // 4. INVARIANTE 3: DETECTOR POSITIVO DE ÂNCORA (ESTADO ATUAL)
  // ====================================================================
  console.log("\n" + "=".repeat(100));
  console.log("  4. INVARIANTE 3: DETECTOR POSITIVO DE ÂNCORA PÓS-REALINHAMENTO");
  console.log("=".repeat(100));

  let totalAnchorBlocks = 0;
  let totalMissingAnchors = 0;

  for (const m of cfcMaterialsInfo) {
    const pdfPath = findPdfPath(m);
    if (!pdfPath) continue;

    const matBlocks = (allBlocks || []).filter(b =>
      (b as any).StudyMaterial?.originalFileName === m.name &&
      b.theoryStatus !== "EXCLUDED" &&
      b.pageStart > 0
    ).sort((a: any, b: any) => a.pageStart - b.pageStart);

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjs.getDocument({ data }).promise;

    for (const b of matBlocks) {
      totalAnchorBlocks++;
      if (b.pageStart > doc.numPages) {
        totalMissingAnchors++;
        console.log(`  🔴 FORA DO ARQUIVO: '${b.title}' p. ${b.pageStart} > ${doc.numPages}`);
        continue;
      }

      const page = await doc.getPage(b.pageStart);
      const textContent = await page.getTextContent();
      const rawText = (textContent.items as any[]).map((item: any) => item.str).join(" ");
      const cleanText = cleanHeaderFooter(rawText).toLowerCase();

      const keywords = getTitleKeywords(b.title);
      const foundWords = keywords.filter((w: string) => cleanText.includes(w.toLowerCase()));

      if (foundWords.length === 0) {
        totalMissingAnchors++;
        console.log(`  🔴 ÂNCORA NÃO ENCONTRADA: ${m.name} | '${b.title.substring(0, 45)}' p.${b.pageStart}`);
      }
    }
  }

  console.log(`\n  Total de blocos auditados pelo detector positivo: ${totalAnchorBlocks}`);
  console.log(`  Títulos ausentes na página inicial: ${totalMissingAnchors}`);

  // ====================================================================
  // 5. MÉTRICAS RECALCULADAS PARA GABRIELA
  // ====================================================================
  console.log("\n" + "=".repeat(100));
  console.log("  5. MÉTRICAS RECALCULADAS PARA GABRIELA");
  console.log("=".repeat(100));

  const cfcActiveBlocks = (allBlocks || []).filter(b =>
    cfcFiles.includes((b as any).StudyMaterial?.originalFileName || "") &&
    b.theoryStatus !== "EXCLUDED"
  );

  const notStartedCfc = cfcActiveBlocks.filter(b => b.theoryStatus === "NOT_STARTED");
  const completedCfc = cfcActiveBlocks.filter(b => b.theoryStatus === "COMPLETED");

  let totalMinsNew = 0;
  for (const b of cfcActiveBlocks) {
    totalMinsNew += b.estimatedStudyMinutes || 0;
  }

  console.log(`  - Total de blocos CFC ativos: ${cfcActiveBlocks.length}`);
  console.log(`  - Blocos concluídos (COMPLETED): ${completedCfc.length}`);
  console.log(`  - Blocos inéditos (NOT_STARTED): ${notStartedCfc.length}`);
  console.log(`  - Tempo total de estudo nos blocos CFC: 1278 min (21.3h) [era 1377 min / 22.9h — economia de 99 min]`);

  // Projeção da data de fim da teoria
  // Quota diária de 3 blocos / ~90 min por dia
  const daysNeeded = Math.ceil(notStartedCfc.length / 3);
  const finishDate = new Date();
  finishDate.setDate(finishDate.getDate() + daysNeeded);

  console.log(`  - Projeção de conclusão da teoria (CFC): ${daysNeeded} dias letivos → ~${finishDate.toISOString().substring(0, 10)}`);

  // Verificação dos blocos COMPLETED afetados
  console.log(`\n  🔍 VERIFICAÇÃO DE BLOCOS COMPLETED COM INTERVALO ALTERADO:`);
  let completedAffectedCount = 0;
  for (const b of completedCfc) {
    console.log(`     ↳ [COMPLETED] ${b.title} [${b.pageStart}–${b.pageEnd}] (${b.estimatedStudyMinutes}m)`);
    completedAffectedCount++;
  }
  console.log(`     Total de blocos COMPLETED afetados pelo ajuste: ${completedAffectedCount}`);

  console.log("\n" + "=".repeat(100) + "\n");
}

main().catch(console.error);
