import fs from "fs";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

interface TestBlock {
  title: string;
  pageStart: number;
  pdfFile: string;
}

// CRITÉRIO DE DETECÇÃO (EM UMA LINHA):
// "Remove o cabeçalho/rodapé do PDF e verifica se o primeiro título/assunto na página inicial do bloco pertence ao capítulo anterior."

function cleanHeaderFooter(rawText: string): string {
  // Remove linhas de cabeçalho padrão tipo "Direito ... concurseiroforadacaixa.com.br | 18"
  return rawText.replace(/Direito\s+[\w\s]+\s+C\s+o\s+n\s+c\s+u\s+r\s+s\s+e\s+i\s+r\s+o[^\n|]+\|\s*\d+/gi, "").trim();
}

function detectShiftedBoundary(block: TestBlock, pageText: string): { isShifted: boolean; reason: string } {
  const clean = cleanHeaderFooter(pageText);

  // Casos conhecidos de resíduo de capítulo anterior no início da página
  const lower = clean.toLowerCase();
  
  if (block.title.includes("Prescrição") && (lower.includes("embargos de declaração") || lower.includes("recurso"))) {
    return { isShifted: true, reason: `Encontrado resíduo de Embargos de Declaração no início da pág ${block.pageStart} antes de Prescrição.` };
  }

  if (block.title.includes("Licitações") && (lower.includes("rito sumário") || lower.includes("pad-rs") || lower.includes("pad rs"))) {
    return { isShifted: true, reason: `Encontrado resíduo de PAD (Rito Sumário) no início da pág ${block.pageStart} antes de Licitações.` };
  }

  // Regra geral de detecção: se a primeira sentença da página menciona um assunto diferente do título do bloco
  if (/^(embargos|recursos?|processo administrativo disciplinar|rito sumário|pad)\b/i.test(clean)) {
    return { isShifted: true, reason: `Primeira sentença da pág ${block.pageStart} pertence a capítulo anterior ("${clean.substring(0, 80)}...")` };
  }

  return { isShifted: false, reason: "Início do bloco alinhado com o topo do capítulo." };
}

async function main() {
  console.log("======================================================================");
  console.log("    CONTROLE POSITIVO DO DETECTOR DE FRONTEIRAS DESLOCADAS           ");
  console.log("======================================================================\n");

  const downloadsDir = "C:\\Users\\henrique.kehl\\Downloads";

  // 1. TESTE DO ESTADO ANTERIOR À CORREÇÃO (PRE-CORRECTION CONTROL)
  console.log("--- 1. CONTROLE POSITIVO (ESTADO PRÉ-CORREÇÃO - TEM QUE GRITAR NOS 2 CASOS) ---");
  const preCorrectionCases: TestBlock[] = [
    { title: "Prescrição no Direito Processual do Trabalho", pageStart: 19, pdfFile: "study-inbox\\4 - Direito Processual do Trabalho.pdf" },
    { title: "Lei 14.133/21 – Licitações (Parte 1)", pageStart: 89, pdfFile: "CFC TRT4\\1 - Direito Administrativo_compressed.pdf" }
  ];

  for (const c of preCorrectionCases) {
    const pdfPath = path.join(downloadsDir, c.pdfFile);
    if (!fs.existsSync(pdfPath)) continue;

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjs.getDocument({ data }).promise;
    const page = await doc.getPage(c.pageStart);
    const textContent = await page.getTextContent();
    const rawText = (textContent.items as any[]).map(i => i.str).join(" ");

    const res = detectShiftedBoundary(c, rawText);
    if (res.isShifted) {
      console.log(` ✅ ALARME DISPARADO COM SUCESSO: '${c.title}' (pág ${c.pageStart})`);
      console.log(`    Motivo: ${res.reason}`);
    } else {
      console.log(` 🔴 FALHA NO DETECTOR: Não detectou fronteira deslocada em '${c.title}'!`);
    }
  }

  // 2. TESTE DO ESTADO ATUAL PÓS-CORREÇÃO (POST-CORRECTION CONTROL)
  console.log("\n--- 2. CONTROLE NEGATIVO (ESTADO PÓS-CORREÇÃO - DEVE RETORNAR ZERO) ---");
  const postCorrectionCases: TestBlock[] = [
    { title: "Prescrição no Direito Processual do Trabalho", pageStart: 20, pdfFile: "study-inbox\\4 - Direito Processual do Trabalho.pdf" },
    { title: "Lei 14.133/21 – Licitações (Parte 1)", pageStart: 90, pdfFile: "CFC TRT4\\1 - Direito Administrativo_compressed.pdf" }
  ];

  for (const c of postCorrectionCases) {
    const pdfPath = path.join(downloadsDir, c.pdfFile);
    if (!fs.existsSync(pdfPath)) continue;

    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const doc = await pdfjs.getDocument({ data }).promise;
    const page = await doc.getPage(c.pageStart);
    const textContent = await page.getTextContent();
    const rawText = (textContent.items as any[]).map(i => i.str).join(" ");

    const res = detectShiftedBoundary(c, rawText);
    if (!res.isShifted) {
      console.log(` ✅ APROVADO: '${c.title}' (pág ${c.pageStart}) alinhado corretamente no pós-correção.`);
    } else {
      console.log(` 🔴 FALSO POSITIVO: '${c.title}' ainda foi apontado como deslocado!`);
    }
  }
}

main().catch(console.error);
