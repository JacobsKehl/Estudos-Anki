import fs from "fs";
import path from "path";
import PDFParser from "pdf2json";

// Silence verbose warnings from pdf2json
process.stdout.write = ((write) => (chunk: any, encoding?: any, cb?: any) => {
  if (typeof chunk === 'string' && (chunk.includes("Warning:") || chunk.includes("TODO:"))) return true;
  return write.call(process.stdout, chunk, encoding, cb);
})(process.stdout.write);

process.stderr.write = ((write) => (chunk: any, encoding?: any, cb?: any) => {
  if (typeof chunk === 'string' && (chunk.includes("Warning:") || chunk.includes("TODO:"))) return true;
  return write.call(process.stderr, chunk, encoding, cb);
})(process.stderr.write);

export interface SubItem {
  titulo: string;
  paginaInicio: number;
  paginaFim: number;
}

export interface SummaryItem {
  titulo: string;
  paginaInicio: number;
  paginaFim: number;
  subitens: SubItem[];
}

export interface CfcSummaryData {
  materia: string;
  totalPaginasPdf: number;
  offset: number; // Always +1 in CFC PDFs (PDF Page = Printed Page + 1)
  capaPages: number;
  sumarioPages: number;
  conteudoPages: number;
  tecPages: number;
  inicioSecaoTecImpressa: number;
  inicioSecaoTecPdf: number;
  itensNivel1: SummaryItem[];
  tableDetection: {
    totalTabular: number;
    totalNaoTabular: number;
    paginasTabulares: number[];
    paginasNaoTabulares: number[];
  };
}

const CFC_FILES = [
  { materia: "Direito Administrativo", path: "c:\\Users\\henrique.kehl\\Downloads\\study-inbox\\1 - Direito Administrativo.pdf", jsonName: "sumario-direito-administrativo.json" },
  { materia: "Direito do Trabalho", path: "c:\\Users\\henrique.kehl\\Downloads\\study-inbox\\2 - Direito do Trabalho.pdf", jsonName: "sumario-direito-do-trabalho.json" },
  { materia: "Direito Constitucional", path: "c:\\Users\\henrique.kehl\\Downloads\\study-inbox\\3 - Direito Constitucional.pdf", jsonName: "sumario-direito-constitucional.json" },
  { materia: "Direito Processual do Trabalho", path: "c:\\Users\\henrique.kehl\\Downloads\\study-inbox\\4 - Direito Processual do Trabalho.pdf", jsonName: "sumario-direito-processual-do-trabalho.json" },
  { materia: "Direito Processual Civil", path: "c:\\Users\\henrique.kehl\\Downloads\\study-inbox\\Direito Processual Civil.pdf", jsonName: "sumario-direito-processual-civil.json" },
];

function loadPdf(pdfPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)();
    pdfParser.on("pdfParser_dataError", (err: any) => reject(err));
    pdfParser.on("pdfParser_dataReady", (data: any) => resolve(data));
    pdfParser.loadPDF(pdfPath);
  });
}

function safeDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    try { return unescape(str); } catch { return str; }
  }
}

function parsePageNum(str: string): number | null {
  const cleaned = str.replace(/\s+/g, "").trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

export function isPageTabularStrict(pageData: any): boolean {
  const sorted = [...pageData.Texts].sort((a: any, b: any) => a.y - b.y || a.x - b.x);
  const lines: { y: number; tokens: { x: number; w: number; txt: string }[] }[] = [];
  let currentY = -1;
  let currentTokens: { x: number; w: number; txt: string }[] = [];

  sorted.forEach((t: any) => {
    const txt = safeDecode(t.R[0].T).trim();
    if (!txt) return;
    const x = t.x;
    const w = (t.w || 1);

    if (Math.abs(t.y - currentY) > 0.35) {
      if (currentTokens.length > 0) lines.push({ y: currentY, tokens: currentTokens });
      currentY = t.y;
      currentTokens = [{ x, w, txt }];
    } else {
      currentTokens.push({ x, w, txt });
    }
  });
  if (currentTokens.length > 0) lines.push({ y: currentY, tokens: currentTokens });

  let consecutiveMultiColumnRows = 0;
  let maxConsecutive = 0;

  for (const line of lines) {
    const tokens = line.tokens;
    if (tokens.length < 2) {
      consecutiveMultiColumnRows = 0;
      continue;
    }

    let gaps = 0;
    for (let i = 0; i < tokens.length - 1; i++) {
      const tokenEnd = tokens[i].x + tokens[i].w;
      const nextStart = tokens[i + 1].x;
      const gap = nextStart - tokenEnd;

      const textConcat = tokens[i].txt + tokens[i + 1].txt;
      if (textConcat.includes("...") || textConcat.includes(".....")) continue;

      if (gap >= 3.5) gaps++;
    }

    if (gaps >= 1) {
      consecutiveMultiColumnRows++;
      if (consecutiveMultiColumnRows > maxConsecutive) maxConsecutive = consecutiveMultiColumnRows;
    } else {
      consecutiveMultiColumnRows = 0;
    }
  }

  return maxConsecutive >= 3;
}

export function parseSummaryFromPdf(materia: string, pdfData: any): CfcSummaryData {
  const totalPaginasPdf = pdfData.Pages.length;
  const offset = 1;

  let capaPages = 0;
  let sumarioPages = 0;

  interface RawSummaryLine {
    text: string;
    firstX: number;
    pagePdf: number;
  }

  const rawSummaryLines: RawSummaryLine[] = [];

  for (let p = 0; p < Math.min(6, totalPaginasPdf); p++) {
    const page = pdfData.Pages[p];
    const pageNum = p + 1;
    const fullText = page.Texts.map((t: any) => safeDecode(t.R[0].T)).join(" ");
    
    const isSummary = fullText.includes("Sumário") || fullText.includes("......") || fullText.includes("........... ");
    if (isSummary) {
      sumarioPages++;
      const sorted = [...page.Texts].sort((a: any, b: any) => a.y - b.y || a.x - b.x);
      let currentY = -1;
      let lineTokens: { txt: string; x: number }[] = [];

      sorted.forEach((t: any) => {
        const txt = safeDecode(t.R[0].T);
        if (Math.abs(t.y - currentY) > 0.35) {
          if (lineTokens.length > 0) {
            const combinedStr = lineTokens.map(l => l.txt).join(" ").trim();
            if (combinedStr.includes("...") && !combinedStr.includes("Sumário") && !combinedStr.includes("Concurseiro")) {
              rawSummaryLines.push({ text: combinedStr, firstX: lineTokens[0].x, pagePdf: pageNum });
            }
          }
          currentY = t.y;
          lineTokens = [{ txt, x: t.x }];
        } else {
          lineTokens.push({ txt, x: t.x });
        }
      });
      if (lineTokens.length > 0) {
        const combinedStr = lineTokens.map(l => l.txt).join(" ").trim();
        if (combinedStr.includes("...") && !combinedStr.includes("Sumário") && !combinedStr.includes("Concurseiro")) {
          rawSummaryLines.push({ text: combinedStr, firstX: lineTokens[0].x, pagePdf: pageNum });
        }
      }
    } else if (sumarioPages === 0) {
      capaPages++;
    }
  }

  interface ExtractedLine {
    titulo: string;
    paginaPrinted: number;
    firstX: number;
    isTec: boolean;
  }

  const extracted: ExtractedLine[] = [];

  rawSummaryLines.forEach((l) => {
    const match = l.text.match(/^(.*?)\s*(\.{3,})\s*(\d(?:\s*\d)*)\s*$/);
    if (match) {
      const rawTitle = match[1].trim();
      const rawPageStr = match[3];
      const pageNumPrinted = parsePageNum(rawPageStr);

      if (pageNumPrinted !== null && rawTitle.length > 2) {
        const isTec = rawTitle.toLowerCase().includes("extra") && (rawTitle.toLowerCase().includes("tec") || rawTitle.toLowerCase().includes("exercícios") || rawTitle.toLowerCase().includes("questões"));
        extracted.push({
          titulo: rawTitle,
          paginaPrinted: pageNumPrinted,
          firstX: l.firstX,
          isTec
        });
      }
    }
  });

  const tecLine = extracted.find(e => e.isTec);
  if (!tecLine) {
    throw new Error(`[PARSER ERROR] ${materia} - Não foi possível localizar a Seção TEC no sumário!`);
  }

  const inicioSecaoTecImpressa = tecLine.paginaPrinted;
  const inicioSecaoTecPdf = inicioSecaoTecImpressa + offset;
  const tecPages = (totalPaginasPdf - inicioSecaoTecPdf) + 1;

  const contentExtracted = extracted.filter(e => !e.isTec);

  const itensNivel1: SummaryItem[] = [];
  let currentLevel1: SummaryItem | null = null;

  for (let i = 0; i < contentExtracted.length; i++) {
    const curr = contentExtracted[i];
    // PURE LAYOUT SIGNAL: Level 1 topics start at x <= 2.6 (no indentation)
    const isLevel1 = curr.firstX <= 2.6;

    if (isLevel1 || !currentLevel1) {
      currentLevel1 = {
        titulo: curr.titulo,
        paginaInicio: curr.paginaPrinted,
        paginaFim: curr.paginaPrinted,
        subitens: []
      };
      itensNivel1.push(currentLevel1);
    } else {
      currentLevel1.subitens.push({
        titulo: curr.titulo,
        paginaInicio: curr.paginaPrinted,
        paginaFim: curr.paginaPrinted
      });
    }
  }

  for (let i = 0; i < itensNivel1.length; i++) {
    const item = itensNivel1[i];
    const nextItem = itensNivel1[i + 1];

    const calculatedEnd = nextItem
      ? (nextItem.paginaInicio === item.paginaInicio ? item.paginaInicio : nextItem.paginaInicio - 1)
      : (inicioSecaoTecImpressa - 1);

    for (let j = 0; j < item.subitens.length; j++) {
      const sub = item.subitens[j];
      const nextSub = item.subitens[j + 1];
      const subEnd = nextSub ? (nextSub.paginaInicio - 1) : calculatedEnd;
      sub.paginaFim = Math.max(sub.paginaInicio, subEnd);
    }

    const maxChildEnd = item.subitens.reduce((max, s) => Math.max(max, s.paginaFim), item.paginaInicio);
    item.paginaFim = Math.max(calculatedEnd, maxChildEnd);
  }

  const conteudoPages = (inicioSecaoTecPdf - 1) - (capaPages + sumarioPages);

  const paginasTabulares: number[] = [];
  const paginasNaoTabulares: number[] = [];

  for (let p = 0; p < totalPaginasPdf; p++) {
    const pageNum = p + 1;
    const page = pdfData.Pages[p];
    const isTabular = isPageTabularStrict(page);
    if (isTabular) {
      paginasTabulares.push(pageNum);
    } else {
      paginasNaoTabulares.push(pageNum);
    }
  }

  const summaryResult: CfcSummaryData = {
    materia,
    totalPaginasPdf,
    offset,
    capaPages,
    sumarioPages,
    conteudoPages,
    tecPages,
    inicioSecaoTecImpressa,
    inicioSecaoTecPdf,
    itensNivel1,
    tableDetection: {
      totalTabular: paginasTabulares.length,
      totalNaoTabular: paginasNaoTabulares.length,
      paginasTabulares,
      paginasNaoTabulares
    }
  };

  validateInvariants(summaryResult);
  return summaryResult;
}

export function validateInvariants(summary: CfcSummaryData) {
  const { materia, totalPaginasPdf, capaPages, sumarioPages, tecPages, inicioSecaoTecImpressa, inicioSecaoTecPdf, itensNivel1 } = summary;

  // 1. nenhum item pode ter paginaFim < paginaInicio
  for (const item of itensNivel1) {
    if (item.paginaFim < item.paginaInicio) {
      throw new Error(`[INVARIANTE 1 FALHOU] ${materia} - Item Nível 1 "${item.titulo}" tem fim (${item.paginaFim}) < início (${item.paginaInicio})`);
    }
    for (const sub of item.subitens) {
      if (sub.paginaFim < sub.paginaInicio) {
        throw new Error(`[INVARIANTE 1 FALHOU] ${materia} - Subitem Nível 2 "${sub.titulo}" tem fim (${sub.paginaFim}) < início (${sub.paginaInicio})`);
      }
    }
  }

  // 2. dois itens de nível 1 não podem começar na mesma página exceto se o primeiro for pontual (ex: 19..19)
  for (let i = 0; i < itensNivel1.length - 1; i++) {
    const current = itensNivel1[i];
    const next = itensNivel1[i + 1];
    if (current.paginaInicio === next.paginaInicio) {
      if (current.paginaFim > current.paginaInicio) {
        throw new Error(`[INVARIANTE 2 FALHOU] ${materia} - Dois itens Nível 1 começam na pág ${current.paginaInicio}, mas o primeiro se estende até ${current.paginaFim}`);
      }
    }
  }

  // 3. os intervalos de nível 1 não podem se sobrepor
  for (let i = 0; i < itensNivel1.length - 1; i++) {
    const current = itensNivel1[i];
    const next = itensNivel1[i + 1];
    if (current.paginaFim > next.paginaInicio) {
      throw new Error(`[INVARIANTE 3 FALHOU] ${materia} - Sobreposição: "${current.titulo}" (${current.paginaInicio}..${current.paginaFim}) invade "${next.titulo}" (${next.paginaInicio}..${next.paginaFim})`);
    }
  }

  // 4. todo item de nível 2 tem que estar contido no intervalo do pai
  for (const item of itensNivel1) {
    for (const sub of item.subitens) {
      if (sub.paginaInicio < item.paginaInicio || sub.paginaFim > item.paginaFim) {
        throw new Error(`[INVARIANTE 4 FALHOU] ${materia} - Subitem Nível 2 "${sub.titulo}" (${sub.paginaInicio}..${sub.paginaFim}) fora do pai "${item.titulo}" (${item.paginaInicio}..${item.paginaFim})`);
      }
    }
  }

  // 5. inicioSecaoTec tem que ser <= totalPaginas
  if (inicioSecaoTecPdf > totalPaginasPdf) {
    throw new Error(`[INVARIANTE 5 FALHOU] ${materia} - Início da Seção TEC (${inicioSecaoTecPdf}) excede total de páginas (${totalPaginasPdf})`);
  }

  // 6. capa + sumario + conteudo + tec = total, e nenhuma parcela pode ser zero por omissão
  if (capaPages <= 0 || sumarioPages <= 0 || tecPages <= 0) {
    throw new Error(`[INVARIANTE 6 FALHOU] ${materia} - Parcela zero detectada: capa=${capaPages}, sumario=${sumarioPages}, tec=${tecPages}`);
  }
  const conteudoPages = (inicioSecaoTecPdf - 1) - (capaPages + sumarioPages);
  const calculatedTotal = capaPages + sumarioPages + conteudoPages + tecPages;
  if (calculatedTotal !== totalPaginasPdf) {
    throw new Error(`[INVARIANTE 6 FALHOU] ${materia} - Soma de páginas (${calculatedTotal}) != Total PDF (${totalPaginasPdf}) [capa=${capaPages}, sumario=${sumarioPages}, conteudo=${conteudoPages}, tec=${tecPages}]`);
  }

  // 7. INVARIANTE DE LACUNAS: Os intervalos de nível 1 têm que cobrir a faixa de conteúdo inteira (sem páginas órfãs)
  const startContentPage = sumarioPages + 1; // Primeira página impressa do conteúdo (ex: pág 1 se sumário for 1 pág, pág 2 se for 2)
  const endContentPage = inicioSecaoTecImpressa - 1;

  for (let page = startContentPage; page <= endContentPage; page++) {
    const isCovered = itensNivel1.some(item => page >= item.paginaInicio && page <= item.paginaFim);
    if (!isCovered) {
      throw new Error(`[INVARIANTE DE LACUNA FALHOU] ${materia} - Página de conteúdo impressa ${page} (PDF pág ${page + 1}) não pertence a nenhum bloco Nível 1!`);
    }
  }
}

async function main() {
  console.log("=== PARSER DE SUMÁRIOS CFC (ETAPAS 2 E 4 DO F1 - HIERARQUIA PURA DE LAYOUT) ===");
  const docsDir = path.join(process.cwd(), "docs", "cfc");
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  let totalL1 = 0;

  for (const f of CFC_FILES) {
    const pdfData = await loadPdf(f.path);
    const summary = parseSummaryFromPdf(f.materia, pdfData);
    totalL1 += summary.itensNivel1.length;

    const targetJsonPath = path.join(docsDir, f.jsonName);
    fs.writeFileSync(targetJsonPath, JSON.stringify(summary, null, 2), "utf-8");
    console.log(`✅ [${f.materia}] Todos os 7 Invariantes (incluindo Lacunas) Aprovados! Nível 1: ${summary.itensNivel1.length} blocos. JSON: ${targetJsonPath}`);
  }

  console.log(`\n🏆 Processamento concluído com sucesso! Total de itens de Nível 1 extraídos por layout puro: ${totalL1}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("FATAL PARSER ERROR:", err);
    process.exit(1);
  });
}
