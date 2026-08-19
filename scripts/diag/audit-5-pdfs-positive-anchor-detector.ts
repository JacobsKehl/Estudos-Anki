import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const cfcMaterialsInfo = [
  { name: "1 - Direito Administrativo_compressed.pdf", folder: "CFC TRT4" },
  { name: "3 - Direito Constitucional.pdf", folder: "study-inbox" },
  { name: "Direito Processual Civil_compressed.pdf", folder: "study-inbox" },
  { name: "4 - Direito Processual do Trabalho.pdf", folder: "study-inbox" },
  { name: "2 - Direito do Trabalho.pdf", folder: "CFC TRT4" }
];

function cleanHeaderFooter(rawText: string): string {
  return rawText.replace(/Direito\s+[\w\s]+\s+C\s+o\s+n\s+c\s+u\s+r\s+s\s+e\s+i\s+r\s+o[^\n|]+\|\s*\d+/gi, "").trim();
}

// Retorna as palavras-chave principais do título do bloco que DEVEM estar na página inicial
function getTitleKeywords(title: string): string[] {
  // Ignorar artigos, preposições e palavras genéricas de subtítulo
  const stopWords = new Set(["de", "do", "da", "dos", "das", "e", "em", "para", "com", "por", "sobre", "sua", "seus", "arts", "art"]);
  const cleanTitle = title.replace(/\(.*?\)/g, "").replace(/[+\-\/,.]/g, " ");
  const words = cleanTitle.split(/\s+/).map(w => w.trim()).filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
  return words;
}

async function auditBlocksList(blocksList: any[]) {
  const downloadsDir = "C:\\Users\\henrique.kehl\\Downloads";
  let totalBlocks = 0;
  let totalMissingAnchors = 0;

  for (const m of cfcMaterialsInfo) {
    let pdfPath = path.join(downloadsDir, m.folder, m.name);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "study-inbox", m.name);
    if (!fs.existsSync(pdfPath)) pdfPath = path.join(downloadsDir, "CFC TRT4", m.name);

    if (!fs.existsSync(pdfPath)) continue;

    const matBlocks = blocksList.filter(b => 
      ((b.StudyMaterial?.originalFileName === m.name) || b.materialName === m.name) &&
      b.pageStart > 0 && 
      b.theoryStatus !== "EXCLUDED"
    );
    matBlocks.sort((a, b) => a.pageStart - b.pageStart);

    console.log(`📘 AUDITANDO CRITÉRIO POSITIVO DE ÂNCORA (${matBlocks.length} BLOCOS): '${m.name}'`);

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjs.getDocument({ data }).promise;

    for (const b of matBlocks) {
      totalBlocks++;
      if (b.pageStart > doc.numPages) continue;

      const page = await doc.getPage(b.pageStart);
      const textContent = await page.getTextContent();
      const rawText = (textContent.items as any[]).map(item => item.str).join(" ");
      const cleanText = cleanHeaderFooter(rawText).toLowerCase();

      const keywords = getTitleKeywords(b.title);
      // Checar se pelo menos 1 palavra principal marcante do título aparece na p.pageStart
      const foundWords = keywords.filter(w => cleanText.includes(w.toLowerCase()));

      // Se nenhuma das palavras marcantes do título for encontrada na página inicial do bloco:
      if (foundWords.length === 0) {
        totalMissingAnchors++;
        console.log(` 🔴 TÍTULO AUSENTE NA PÁGINA INICIAL: '${b.title}' (pág física ${b.pageStart})`);
        console.log(`    Palavras buscadas: ${keywords.join(", ")} | Texto lido: "${cleanText.substring(0, 90)}..."`);
      } else {
        console.log(`  └ [OK] p.${b.pageStart}: '${b.title.substring(0, 40)}...' (Palavras confirmadas: ${foundWords.slice(0, 3).join(", ")})`);
      }
    }
    console.log();
  }

  return { totalBlocks, totalMissingAnchors };
}

async function main() {
  console.log("======================================================================================");
  console.log("    DETECTOR DE CRITÉRIO POSITIVO (O TÍTULO DO BLOCO CONSTA NA PÁGINA INICIAL?)        ");
  console.log("======================================================================================\n");

  // 1. Controle Positivo contra o Backup Pré-Correção
  const backupPath = path.join(process.cwd(), "backups", "json", "pre-fix-6-shifted-boundaries.json");
  if (fs.existsSync(backupPath)) {
    console.log("--- 1. CONTROLE POSITIVO CONTRA O BACKUP PRÉ-CORREÇÃO ---");
    const snapshot = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
    const backupBlocks = (snapshot.blocks || []).map((b: any) => {
      // Anexar nome do arquivo se disponível
      const mat = cfcMaterialsInfo.find(m => b.materialId);
      return { ...b, materialName: b.StudyMaterial?.originalFileName || mat?.name };
    });
    const resBackup = await auditBlocksList(backupBlocks);
    console.log(` ➔ CONTROLE POSITIVO NO BACKUP: Detectou ${resBackup.totalMissingAnchors} títulos ausentes!\n`);
  }

  // 2. Aferição no Estado Atual (Pós-Correção)
  console.log("--- 2. AFERIÇÃO NO ESTADO ATUAL EM PRODUÇÃO (PÓS-CORREÇÃO) ---");
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const { data: dbBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, theoryStatus, StudyMaterial:materialId(originalFileName)")
    .eq("userId", user!.id);

  const resCurrent = await auditBlocksList(dbBlocks || []);

  console.log("======================================================================================");
  console.log("    RESUMO COMPLETO DA AUDITORIA DE CRITÉRIO POSITIVO                                 ");
  console.log("======================================================================================");
  console.log(` Total de Blocos Auditados: ${resCurrent.totalBlocks}`);
  console.log(` Total de Títulos Ausentes na Página Inicial (Estado Atual): ${resCurrent.totalMissingAnchors}`);
  console.log("======================================================================================\n");
}

main().catch(console.error);
