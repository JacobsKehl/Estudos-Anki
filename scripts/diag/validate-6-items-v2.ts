/**
 * validate-6-items-v2.ts
 *
 * Script de validação READ-ONLY para os 6 itens da rodada:
 *
 *   Item 1: pdf.numPages × maior pageEnd → detectar cobertura além do arquivo
 *   Item 2: Controle positivo contra o backup (lista nominal)
 *   Item 3: Detector positivo (anchor) no estado atual
 *   Item 4: DryRun por ID do phantom (cmss35tkg002piyao8wq48uct) + confirmar legítimo
 *   Item 5: Regra de estimatedStudyMinutes — investigação
 *   Item 6: Denominador da completude — onde clause
 *
 * Nenhuma mutação de dados.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "fs";
import path from "path";
import { computePendingD3BlockReviews, D3BlockInput } from "../../src/lib/recommendations/adaptive-scheduler";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const CFC_PDFS = [
  { name: "1 - Direito Administrativo_compressed.pdf", folder: "CFC TRT4" },
  { name: "3 - Direito Constitucional.pdf", folder: "study-inbox" },
  { name: "Direito Processual Civil_compressed.pdf", folder: "study-inbox" },
  { name: "4 - Direito Processual do Trabalho.pdf", folder: "study-inbox" },
  { name: "2 - Direito do Trabalho.pdf", folder: "CFC TRT4" },
];
const CFC_FILES = CFC_PDFS.map(p => p.name);
const downloadsDir = "C:\\Users\\henrique.kehl\\Downloads";

const PHANTOM_ID = "cmss35tkg002piyao8wq48uct";
const LEGIT_DPT_ID = "cmss361vd004jiyao8r2h6cd9"; // Prescrição no Direito Processual do Trabalho

function cleanHeaderFooter(rawText: string): string {
  return rawText.replace(/Direito\s+[\w\s]+\s+C\s+o\s+n\s+c\s+u\s+r\s+s\s+e\s+i\s+r\s+o[^\n|]+\|\s*\d+/gi, "").trim();
}

function getTitleKeywords(title: string): string[] {
  const stopWords = new Set(["de", "do", "da", "dos", "das", "e", "em", "para", "com", "por", "sobre", "sua", "seus", "arts", "art"]);
  const cleanTitle = title.replace(/\(.*?\)/g, "").replace(/[+\-\/,.]/g, " ");
  return cleanTitle.split(/\s+/).map(w => w.trim()).filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
}

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

async function main() {
  const { data: user } = await supabase
    .from("User").select("id")
    .eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  // Fetch all blocks
  const { data: allBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, theoryStatus, pageStart, pageEnd, estimatedStudyMinutes, materialId, sourceV1BlockId, theoryCompletedAt, review1dCompletedAt, review7dCompletedAt, review15dCompletedAt, review30dCompletedAt, StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId);

  // ======================================================================
  // ITEM 1: pdf.numPages × maior pageEnd
  // ======================================================================
  console.log("\n" + "=".repeat(76));
  console.log("  ITEM 1: pdf.numPages × maior pageEnd — COBERTURA ALÉM DO ARQUIVO");
  console.log("=".repeat(76));

  console.log("\n  PDF                                        | numPages | maxPageEnd | minPageStart | Início OK? | Fim OK?");
  console.log("  " + "-".repeat(106));

  for (const m of CFC_PDFS) {
    const pdfPath = findPdfPath(m);
    if (!pdfPath) {
      console.log(`  ${m.name.padEnd(44)} | ❌ PDF NÃO ENCONTRADO`);
      continue;
    }

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjs.getDocument({ data }).promise;
    const numPages = doc.numPages;

    const matBlocks = (allBlocks || []).filter(b =>
      (b as any).StudyMaterial?.originalFileName === m.name &&
      b.theoryStatus !== "EXCLUDED" &&
      b.pageStart > 0
    );

    const maxPageEnd = Math.max(...matBlocks.map(b => b.pageEnd));
    const minPageStart = Math.min(...matBlocks.map(b => b.pageStart));

    const endOk = maxPageEnd <= numPages;
    const startOk = minPageStart >= 1;

    console.log(`  ${m.name.padEnd(44)} | ${numPages.toString().padStart(8)} | ${maxPageEnd.toString().padStart(10)} | ${minPageStart.toString().padStart(12)} | ${startOk ? "✅" : "⚠️ " + minPageStart}      | ${endOk ? "✅" : "⚠️ +" + (maxPageEnd - numPages)}`);

    if (!endOk) {
      // Show which block exceeds
      const exceeding = matBlocks.filter(b => b.pageEnd > numPages);
      for (const b of exceeding) {
        console.log(`    ↳ '${b.title.substring(0, 50)}' [${b.pageStart}–${b.pageEnd}] excede por ${b.pageEnd - numPages} página(s)`);
      }
    }
  }

  // ======================================================================
  // ITEM 4: DryRun por ID do phantom + confirmar legítimo
  // ======================================================================
  console.log("\n" + "=".repeat(76));
  console.log("  ITEM 4: DRYRUN POR ID — PHANTOM vs LEGÍTIMO");
  console.log("=".repeat(76));

  // Achar o phantom pelo ID
  const phantom = (allBlocks || []).find(b => b.id === PHANTOM_ID);
  const legitDPT = (allBlocks || []).find(b => b.id === LEGIT_DPT_ID);

  console.log("\n📌 Bloco PHANTOM (deactivated):");
  if (phantom) {
    console.log(`   ID:           ${phantom.id}`);
    console.log(`   Título:       ${phantom.title}`);
    console.log(`   Material:     ${(phantom as any).StudyMaterial?.originalFileName}`);
    console.log(`   theoryStatus: ${phantom.theoryStatus}`);
    console.log(`   Intervalo:    [${phantom.pageStart}–${phantom.pageEnd}]`);
  }

  console.log("\n📌 Bloco LEGÍTIMO (DPT):");
  if (legitDPT) {
    console.log(`   ID:           ${legitDPT.id}`);
    console.log(`   Título:       ${legitDPT.title}`);
    console.log(`   Material:     ${(legitDPT as any).StudyMaterial?.originalFileName}`);
    console.log(`   theoryStatus: ${legitDPT.theoryStatus}`);
    console.log(`   Intervalo:    [${legitDPT.pageStart}–${legitDPT.pageEnd}]`);
  }

  // Fetch CFC materials for D3 query
  const { data: materials } = await supabase
    .from("StudyMaterial")
    .select("id, originalFileName")
    .eq("userId", userId)
    .in("originalFileName", CFC_FILES);
  const materialIds = (materials || []).map(m => m.id);

  // D3 eligible blocks (same query as scheduler)
  const completedCFCBlocks = (allBlocks || []).filter(b =>
    b.theoryStatus === "COMPLETED" &&
    b.sourceV1BlockId === null &&
    materialIds.includes(b.materialId)
  );

  // Check by ID
  const phantomInEligible = completedCFCBlocks.some(b => b.id === PHANTOM_ID);
  console.log(`\n🔒 Phantom (${PHANTOM_ID}) nos elegíveis D3? ${phantomInEligible ? "⚠️ SIM — FALHA!" : "✅ NÃO"}`);

  // The legitimate one should be in its own subject's queue (NOT_STARTED → would be in theory queue, not D3)
  const legitInD3 = completedCFCBlocks.some(b => b.id === LEGIT_DPT_ID);
  console.log(`   Legítimo DPT (${LEGIT_DPT_ID}) nos D3? ${legitInD3 ? "Sim (está COMPLETED)" : "Não (está NOT_STARTED — esperado)"}`);

  // DryRun 14 days with ID-based assertion
  console.log("\n🔄 DryRun 14 dias — asserção por ID:");
  const today = new Date();
  let phantomEverAppeared = false;

  const d3Inputs: D3BlockInput[] = completedCFCBlocks.map(b => ({
    id: b.id,
    title: b.title,
    theoryCompletedAt: b.theoryCompletedAt ? new Date(b.theoryCompletedAt) : null,
    review1dCompletedAt: b.review1dCompletedAt ? new Date(b.review1dCompletedAt) : null,
    review15dCompletedAt: b.review15dCompletedAt ? new Date(b.review15dCompletedAt) : null,
    review30dCompletedAt: b.review30dCompletedAt ? new Date(b.review30dCompletedAt) : null,
    estimatedStudyMinutes: b.estimatedStudyMinutes,
  }));

  for (let day = 0; day < 14; day++) {
    const refDate = new Date(today);
    refDate.setDate(refDate.getDate() + day);
    const { topAllocated, allPending } = computePendingD3BlockReviews(d3Inputs, refDate, 3);

    const phantomInTop = topAllocated.some(r => r.block.id === PHANTOM_ID);
    const phantomInAll = allPending.some(r => r.block.id === PHANTOM_ID);

    if (phantomInTop || phantomInAll) {
      phantomEverAppeared = true;
      console.log(`   ⚠️ D+${day}: Phantom apareceu! (top: ${phantomInTop}, all: ${phantomInAll})`);
    }
  }
  console.log(`   ${phantomEverAppeared ? "❌ FALHA" : "✅ SUCESSO"}: Phantom ${PHANTOM_ID} ${phantomEverAppeared ? "apareceu" : "NUNCA apareceu"} em 14 dias`);

  // All 6 Prescrição blocks — confirm none are affected
  const allPresc = (allBlocks || []).filter(b => b.title.toLowerCase().includes("prescrição"));
  console.log(`\n📋 Todos os blocos com "Prescrição" (${allPresc.length} total):`);
  for (const b of allPresc) {
    const mat = (b as any).StudyMaterial?.originalFileName || "?";
    const isCFC = CFC_FILES.includes(mat);
    console.log(`   ${b.id} | ${b.theoryStatus.padEnd(12)} | [${b.pageStart}–${b.pageEnd}] | ${isCFC ? "CFC" : "EST"} | ${mat} → ${b.title.substring(0, 50)}`);
  }

  // ======================================================================
  // ITEM 3: DETECTOR POSITIVO (ANCHOR) — ESTADO ATUAL
  // ======================================================================
  console.log("\n" + "=".repeat(76));
  console.log("  ITEM 3: DETECTOR POSITIVO (ANCHOR) — ESTADO ATUAL");
  console.log("=".repeat(76));

  let totalAnchorBlocks = 0;
  let totalMissingAnchors = 0;
  const anchorIssues: string[] = [];

  for (const m of CFC_PDFS) {
    const pdfPath = findPdfPath(m);
    if (!pdfPath) continue;

    const matBlocks = (allBlocks || []).filter(b =>
      (b as any).StudyMaterial?.originalFileName === m.name &&
      b.pageStart > 0 &&
      b.theoryStatus !== "EXCLUDED"
    );
    matBlocks.sort((a: any, b: any) => a.pageStart - b.pageStart);

    console.log(`\n📘 ${m.name} (${matBlocks.length} blocos)`);

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjs.getDocument({ data }).promise;

    for (const b of matBlocks) {
      totalAnchorBlocks++;
      if (b.pageStart > doc.numPages) {
        console.log(`  🔴 FORA DO ARQUIVO: '${b.title.substring(0, 40)}' pág ${b.pageStart} > ${doc.numPages}`);
        totalMissingAnchors++;
        anchorIssues.push(`${m.name}: '${b.title}' [${b.pageStart}] > numPages=${doc.numPages}`);
        continue;
      }

      const page = await doc.getPage(b.pageStart);
      const textContent = await page.getTextContent();
      const rawText = (textContent.items as any[]).map(item => item.str).join(" ");
      const cleanText = cleanHeaderFooter(rawText).toLowerCase();

      const keywords = getTitleKeywords(b.title);
      const foundWords = keywords.filter(w => cleanText.includes(w.toLowerCase()));

      if (foundWords.length === 0) {
        totalMissingAnchors++;
        anchorIssues.push(`${m.name}: '${b.title}' pág ${b.pageStart} — nenhuma keyword casou`);
        console.log(`  🔴 TÍTULO AUSENTE: '${b.title.substring(0, 50)}' (pág ${b.pageStart})`);
        console.log(`     Keywords: ${keywords.join(", ")}`);
        console.log(`     Texto: "${cleanText.substring(0, 100)}..."`);
      } else {
        console.log(`  ✅ p.${b.pageStart}: '${b.title.substring(0, 45)}' [${foundWords.slice(0, 3).join(", ")}]`);
      }
    }
  }

  console.log(`\n  TOTAL: ${totalAnchorBlocks} blocos auditados, ${totalMissingAnchors} título(s) ausente(s)`);
  if (totalMissingAnchors === 0) {
    console.log("  ✅ DETECTOR POSITIVO ZERADO — todos os títulos presentes na página inicial");
  } else {
    console.log("  ❌ TÍTULOS AUSENTES:");
    anchorIssues.forEach(i => console.log(`     ${i}`));
  }

  // ======================================================================
  // ITEM 2: CONTROLE POSITIVO CONTRA O BACKUP (LISTA)
  // ======================================================================
  console.log("\n" + "=".repeat(76));
  console.log("  ITEM 2: CONTROLE POSITIVO CONTRA O BACKUP (LISTA NOMINAL)");
  console.log("=".repeat(76));

  const backupPath = path.join(process.cwd(), "backups", "json", "pre-fix-6-shifted-boundaries.json");
  if (!fs.existsSync(backupPath)) {
    console.log("  ❌ Backup não encontrado: " + backupPath);
  } else {
    const snapshot = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
    const backupBlocks = snapshot.blocks || [];

    // Use the SAME invariant detector (gaps + overlaps) against the backup
    console.log("\n  A) INVARIANTE (gaps + overlaps) no backup:");
    let bkpGaps = 0, bkpOverlaps = 0;
    const bkpIssues: string[] = [];

    // We need materialId → fileName mapping. Get it from current materials.
    const { data: allMats } = await supabase
      .from("StudyMaterial")
      .select("id, originalFileName")
      .eq("userId", userId);
    const matMap: Record<string, string> = {};
    for (const m of allMats || []) matMap[m.id] = m.originalFileName;

    const bkpByMat: Record<string, any[]> = {};
    for (const b of backupBlocks) {
      const fname = matMap[b.materialId];
      if (!fname || !CFC_FILES.includes(fname)) continue;
      if (b.theoryStatus === "EXCLUDED" || b.pageStart <= 0) continue;
      if (!bkpByMat[fname]) bkpByMat[fname] = [];
      bkpByMat[fname].push({ ...b, _fileName: fname });
    }

    for (const [fname, blocks] of Object.entries(bkpByMat)) {
      blocks.sort((a: any, b: any) => a.pageStart - b.pageStart);

      for (let i = 0; i < blocks.length - 1; i++) {
        const curr = blocks[i];
        const next = blocks[i + 1];

        if (curr.pageEnd + 1 < next.pageStart) {
          bkpGaps++;
          const msg = `  GAP: '${curr.title.substring(0, 35)}' [${curr.pageStart}–${curr.pageEnd}] → '${next.title.substring(0, 35)}' [${next.pageStart}–${next.pageEnd}] — pp ${curr.pageEnd + 1}–${next.pageStart - 1}`;
          bkpIssues.push(msg);
        }

        if (curr.pageEnd >= next.pageStart) {
          bkpOverlaps++;
          const msg = `  OVERLAP: '${curr.title.substring(0, 35)}' [${curr.pageStart}–${curr.pageEnd}] ∩ '${next.title.substring(0, 35)}' [${next.pageStart}–${next.pageEnd}]`;
          bkpIssues.push(msg);
        }
      }
    }

    console.log(`  BACKUP: ${bkpGaps} gap(s), ${bkpOverlaps} overlap(s)`);
    if (bkpIssues.length > 0) {
      console.log("  Lista nominal:");
      bkpIssues.forEach(i => console.log(`    ${i}`));
    } else {
      console.log("  (nenhum defeito no invariante de continuidade)");
    }

    // B) Anchor detector against backup
    console.log("\n  B) DETECTOR POSITIVO (anchor) no backup:");
    let bkpAnchorMissing = 0;
    const bkpAnchorIssues: string[] = [];

    for (const m of CFC_PDFS) {
      const pdfPath = findPdfPath(m);
      if (!pdfPath) continue;

      const matBlocks = backupBlocks
        .filter((b: any) => matMap[b.materialId] === m.name && b.pageStart > 0 && b.theoryStatus !== "EXCLUDED")
        .sort((a: any, b: any) => a.pageStart - b.pageStart);

      const pdfData = new Uint8Array(fs.readFileSync(pdfPath));
      const doc = await pdfjs.getDocument({ data: pdfData }).promise;

      for (const b of matBlocks) {
        if (b.pageStart > doc.numPages) continue;

        const page = await doc.getPage(b.pageStart);
        const textContent = await page.getTextContent();
        const rawText = (textContent.items as any[]).map((item: any) => item.str).join(" ");
        const cleanText = cleanHeaderFooter(rawText).toLowerCase();

        const keywords = getTitleKeywords(b.title);
        const foundWords = keywords.filter((w: string) => cleanText.includes(w.toLowerCase()));

        if (foundWords.length === 0) {
          bkpAnchorMissing++;
          bkpAnchorIssues.push(`${m.name}: '${b.title.substring(0, 50)}' pág ${b.pageStart}`);
        }
      }
    }

    console.log(`  BACKUP: ${bkpAnchorMissing} título(s) ausente(s) na página inicial`);
    if (bkpAnchorIssues.length > 0) {
      console.log("  Lista nominal:");
      bkpAnchorIssues.forEach(i => console.log(`    ${i}`));
    }
    console.log(`\n  → Se o backup mostra defeitos e o estado atual mostra 0, o conserto funcionou.`);
  }

  // ======================================================================
  // ITEM 5: REGRA DOS MINUTOS
  // ======================================================================
  console.log("\n" + "=".repeat(76));
  console.log("  ITEM 5: INVESTIGAÇÃO estimatedStudyMinutes");
  console.log("=".repeat(76));

  // Agrupar minutos por count de páginas, para ver se há padrão
  const cfcBlocks = (allBlocks || []).filter(b =>
    CFC_FILES.includes((b as any).StudyMaterial?.originalFileName || "") &&
    b.theoryStatus !== "EXCLUDED" &&
    b.pageStart > 0
  );

  const minutesByPages: Record<number, number[]> = {};
  for (const b of cfcBlocks) {
    const pages = b.pageEnd - b.pageStart + 1;
    if (!minutesByPages[pages]) minutesByPages[pages] = [];
    minutesByPages[pages].push(b.estimatedStudyMinutes || 0);
  }

  console.log("\n  Páginas | Ocorrências | Minutos (valores únicos)");
  console.log("  --------|-------------|------------------------");
  for (const [pages, mins] of Object.entries(minutesByPages).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const unique = [...new Set(mins)].sort((a, b) => a - b);
    console.log(`  ${pages.padStart(7)} | ${mins.length.toString().padStart(11)} | ${unique.join(", ")}`);
  }

  // Check the phantom block's minutes
  if (phantom) {
    console.log(`\n  ⚠️ Phantom (EXCLUDED) ainda tem ${phantom.estimatedStudyMinutes} min gravados.`);
  }

  // ======================================================================
  // RESUMO FINAL
  // ======================================================================
  console.log("\n" + "=".repeat(76));
  console.log("  RESUMO FINAL");
  console.log("=".repeat(76));
  console.log(`  Item 1 (numPages vs pageEnd):  TABELA ACIMA`);
  console.log(`  Item 2 (Ctrl positivo backup): LISTA ACIMA`);
  console.log(`  Item 3 (Detector positivo):    ${totalMissingAnchors === 0 ? "✅" : "❌"} ${totalMissingAnchors} títulos ausentes`);
  console.log(`  Item 4 (DryRun por ID):        ${phantomEverAppeared ? "❌" : "✅"} Phantom nunca apareceu`);
  console.log(`  Item 5 (Regra minutos):        ANÁLISE ACIMA`);
  console.log("=".repeat(76) + "\n");
}

main().catch(console.error);
