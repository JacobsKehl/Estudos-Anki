import fs from "fs";
import path from "path";
import PDFParser from "c:/Users/henrique.kehl/OneDrive - DropReal/Área de Trabalho/kehl/node_modules/pdf2json";
import { parseSummaryLinePageNumber } from "../src/lib/cfc/page-number-parser";

interface SummaryItemLevel2 {
  nivel: 2;
  titulo: string;
  paginaImpressa: number;
  paginaPdf: number;
  paginaFimImpressa: number;
  paginaFimPdf: number;
}

interface SummaryItemLevel1 {
  nivel: 1;
  titulo: string;
  paginaImpressa: number;
  paginaPdf: number;
  paginaFimImpressa: number;
  paginaFimPdf: number;
  filhos: SummaryItemLevel2[];
}

interface CFCFileMeta {
  key: string;
  materia: string;
  pdfFileName: string;
  fullPath: string;
  totalPaginas: number;
}

const CFC_FILES: CFCFileMeta[] = [
  {
    key: "direito-administrativo",
    materia: "Direito Administrativo",
    pdfFileName: "1 - Direito Administrativo.pdf",
    fullPath: "c:\\Users\\henrique.kehl\\Downloads\\study-inbox\\1 - Direito Administrativo.pdf",
    totalPaginas: 152,
  },
  {
    key: "direito-do-trabalho",
    materia: "Direito do Trabalho",
    pdfFileName: "2 - Direito do Trabalho.pdf",
    fullPath: "c:\\Users\\henrique.kehl\\Downloads\\study-inbox\\2 - Direito do Trabalho.pdf",
    totalPaginas: 38,
  },
  {
    key: "direito-constitucional",
    materia: "Direito Constitucional",
    pdfFileName: "3 - Direito Constitucional.pdf",
    fullPath: "c:\\Users\\henrique.kehl\\Downloads\\study-inbox\\3 - Direito Constitucional.pdf",
    totalPaginas: 86,
  },
  {
    key: "direito-processual-do-trabalho",
    materia: "Direito Processual do Trabalho",
    pdfFileName: "4 - Direito Processual do Trabalho.pdf",
    fullPath: "c:\\Users\\henrique.kehl\\Downloads\\study-inbox\\4 - Direito Processual do Trabalho.pdf",
    totalPaginas: 30,
  },
  {
    key: "direito-processual-civil",
    materia: "Direito Processual Civil",
    pdfFileName: "Direito Processual Civil.pdf",
    fullPath: "c:\\Users\\henrique.kehl\\Downloads\\study-inbox\\Direito Processual Civil.pdf",
    totalPaginas: 76,
  },
];

function loadPdfData(pdfPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)();
    pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
    pdfParser.on("pdfParser_dataReady", (pdfData: any) => resolve(pdfData));
    pdfParser.loadPDF(pdfPath);
  });
}

function cleanLineText(text: string): string {
  return text
    .replace(/Preparado exclusivamente para Gabriela Furtado.*$/gi, "")
    .replace(/CPF:?\s*04692559004/gi, "")
    .replace(/04692559004/g, "")
    .replace(/concurseiroforadacaixa\.com\.br\s*\|\s*\d+/gi, "")
    .trim();
}

async function processFile(fileMeta: CFCFileMeta) {
  console.log(`\n📄 Processando ${fileMeta.materia} (${fileMeta.pdfFileName})...`);
  const pdfData = await loadPdfData(fileMeta.fullPath);
  const pdfTotalPages = pdfData.Pages.length;

  // 1. Calcular Offset pelo Rodapé da página index 1 (2ª página do PDF)
  let offset = 0;
  const page1 = pdfData.Pages[1];
  if (page1) {
    for (const t of page1.Texts) {
      const decoded = decodeURIComponent(t.R[0].T);
      const footerMatch = decoded.match(/concurseiroforadacaixa\.com\.br\s*\|\s*(\d+)/i);
      if (footerMatch) {
        const printedPageInFooter = parseInt(footerMatch[1], 10);
        // Offset = (pdfPageIndex + 1) - printedPageInFooter. Ex: (1 + 1) - 1 = 1 para capa em index 0
        offset = (1 + 1) - printedPageInFooter;
        console.log(`  • Rodapé encontrado na pág index 1: "0${printedPageInFooter}" -> Offset calculado: ${offset}`);
        break;
      }
    }
  }

  // 2. Extrair linhas do sumário das páginas 2 a 4 (índices 1 a 3)
  interface SummaryLine {
    y: number;
    xMin: number;
    text: string;
    isBold: boolean;
    pageIndex: number;
  }

  const rawSummaryLines: SummaryLine[] = [];
  for (let p = 1; p <= 3 && p < pdfData.Pages.length; p++) {
    const page = pdfData.Pages[p];
    const texts = page.Texts.map((t: any) => ({
      x: Math.round(t.x * 100) / 100,
      y: Math.round(t.y * 100) / 100,
      fontSize: t.R[0].TS[1],
      isBold: t.R[0].TS[2] === 1,
      text: decodeURIComponent(t.R[0].T),
    }));

    const linesOnPage: Array<{ y: number; xMin: number; text: string; isBold: boolean }> = [];
    texts.forEach((t: any) => {
      if (t.text.includes("concurseiroforadacaixa") || t.text.includes("Preparado exclusivamente") || t.text.includes("04692559004")) return;
      if (t.text.toLowerCase().includes("sumário") && t.y < 5) return;

      const line = linesOnPage.find(l => Math.abs(l.y - t.y) < 0.3);
      if (line) {
        line.text += " " + t.text;
        if (t.x < line.xMin) line.xMin = t.x;
        if (t.isBold) line.isBold = true;
      } else {
        linesOnPage.push({ y: t.y, xMin: t.x, text: t.text, isBold: t.isBold });
      }
    });

    linesOnPage.sort((a, b) => a.y - b.y);
    linesOnPage.forEach(l => {
      const clean = cleanLineText(l.text);
      if (clean && !clean.toLowerCase().startsWith("direito") && !clean.toLowerCase().includes("concurseiro fora da caixa")) {
        rawSummaryLines.push({ y: l.y, xMin: l.xMin, text: clean, isBold: l.isBold, pageIndex: p });
      }
    });
  }

  // 3. Montar Árvore de Nível 1 e Nível 2
  const level1Items: SummaryItemLevel1[] = [];
  let currentLevel1: SummaryItemLevel1 | null = null;
  let tecStartPrintedPage: number | null = null;

  for (const line of rawSummaryLines) {
    const parsed = parseSummaryLinePageNumber(line.text);
    if (!parsed.title || parsed.pageNumber === null) continue;

    const printedPage = parsed.pageNumber;
    const pdfPage = printedPage + offset;

    // Detectar Seção TEC (excluir do fatiamento regular de blocos, conforme BLOCO 3)
    if (parsed.title.toLowerCase().includes("extra – exercícios (tec)") || parsed.title.toLowerCase().includes("extra – questões (tec)")) {
      tecStartPrintedPage = printedPage;
      break; // Encerra os itens regulares do sumário
    }

    // Determinar Nível pelo recuo / negrito
    const isLevel1 = line.xMin < 2.8 || (line.isBold && line.xMin < 3.2);

    if (isLevel1) {
      currentLevel1 = {
        nivel: 1,
        titulo: parsed.title,
        paginaImpressa: printedPage,
        paginaPdf: pdfPage,
        paginaFimImpressa: 0,
        paginaFimPdf: 0,
        filhos: [],
      };
      level1Items.push(currentLevel1);
    } else {
      const level2Item: SummaryItemLevel2 = {
        nivel: 2,
        titulo: parsed.title,
        paginaImpressa: printedPage,
        paginaPdf: pdfPage,
        paginaFimImpressa: 0,
        paginaFimPdf: 0,
      };
      if (currentLevel1) {
        currentLevel1.filhos.push(level2Item);
      } else {
        currentLevel1 = {
          nivel: 1,
          titulo: parsed.title,
          paginaImpressa: printedPage,
          paginaPdf: pdfPage,
          paginaFimImpressa: 0,
          paginaFimPdf: 0,
          filhos: [],
        };
        level1Items.push(currentLevel1);
      }
    }
  }

  // Se não foi encontrada explicitamente no sumário, a seção TEC começa após o último item
  if (!tecStartPrintedPage) {
    tecStartPrintedPage = pdfTotalPages - offset + 1;
  }
  const tecStartPdfPage = tecStartPrintedPage + offset;

  // 4. Calcular intervalos de página fim para cada item
  for (let i = 0; i < level1Items.length; i++) {
    const item = level1Items[i];
    const nextItem = level1Items[i + 1];

    if (nextItem) {
      item.paginaFimImpressa = Math.max(item.paginaImpressa, nextItem.paginaImpressa - 1);
    } else {
      item.paginaFimImpressa = Math.max(item.paginaImpressa, tecStartPrintedPage - 1);
    }
    item.paginaFimPdf = item.paginaFimImpressa + offset;

    for (let j = 0; j < item.filhos.length; j++) {
      const filho = item.filhos[j];
      const proximoFilho = item.filhos[j + 1];
      if (proximoFilho) {
        filho.paginaFimImpressa = Math.max(filho.paginaImpressa, proximoFilho.paginaImpressa - 1);
      } else {
        filho.paginaFimImpressa = item.paginaFimImpressa;
      }
      filho.paginaFimPdf = filho.paginaFimImpressa + offset;
    }
  }

  // 5. Invariante de Páginas Strict (BLOCO 3)
  // Rosto/Sumário = páginas PDF do início (ex: offset + (primeiraPaginaImpressa - 1))
  const firstItemPdfPage = level1Items[0]?.paginaPdf || 2;
  const coverAndSummaryPagesCount = firstItemPdfPage - 1; // Ex: página 1 do PDF é rosto

  let totalLevel1PagesCount = 0;
  for (const item of level1Items) {
    totalLevel1PagesCount += (item.paginaFimPdf - item.paginaPdf + 1);
  }

  const tecPagesCount = (pdfTotalPages - tecStartPdfPage + 1);
  const calculatedTotalPages = coverAndSummaryPagesCount + totalLevel1PagesCount + tecPagesCount;
  const invariantCheckPassed = calculatedTotalPages === pdfTotalPages;

  // Contagens
  const level1Count = level1Items.length;
  let level2Count = 0;
  level1Items.forEach(it => level2Count += it.filhos.length);

  // Páginas Tabulares
  let tabularPagesCount = 0;
  for (let p = 0; p < pdfData.Pages.length; p++) {
    const page = pdfData.Pages[p];
    if (page.Texts.length > 40) {
      tabularPagesCount++;
    }
  }

  console.log(`  • Offset: ${offset}`);
  console.log(`  • Início Seção TEC: Pág Impressa ${tecStartPrintedPage} (PDF Pág ${tecStartPdfPage}) [${tecPagesCount} pgs TEC]`);
  console.log(`  • Itens Nível 1: ${level1Count} | Itens Nível 2: ${level2Count}`);
  console.log(`  • Invariante de Páginas: ${coverAndSummaryPagesCount} (Rosto/Sumário) + ${totalLevel1PagesCount} (Conteúdo Nível 1) + ${tecPagesCount} (TEC) = ${calculatedTotalPages} / ${pdfTotalPages} -> ${invariantCheckPassed ? "✅ FECHOU EXATO" : "❌ DIVERGÊNCIA"}`);
  console.log(`  • Páginas Tabulares Detectadas: ${tabularPagesCount} de ${pdfTotalPages}`);

  // 6. Gravar JSON em docs/cfc/
  const outDir = path.join(__dirname, "../docs/cfc");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const jsonFileName = `sumario-${fileMeta.key}.json`;
  const jsonPath = path.join(outDir, jsonFileName);

  const jsonOutput = {
    arquivo: fileMeta.pdfFileName,
    materia: fileMeta.materia,
    totalPaginas: pdfTotalPages,
    offset,
    secaoTecInicioImpressa: tecStartPrintedPage,
    secaoTecInicioPdf: tecStartPdfPage,
    contadores: {
      nivel1: level1Count,
      nivel2: level2Count,
      paginasTabulares: tabularPagesCount,
    },
    invariantePaginas: {
      paginasRostoSumario: coverAndSummaryPagesCount,
      paginasTopicosNivel1: totalLevel1PagesCount,
      paginasSecaoTec: tecPagesCount,
      somaTotal: calculatedTotalPages,
      esperado: pdfTotalPages,
      statusOk: invariantCheckPassed,
    },
    itens: level1Items,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2), "utf-8");
  console.log(`  💾 JSON gravado com sucesso em: ${jsonPath}`);

  return {
    materia: fileMeta.materia,
    offset,
    tecStartPrintedPage,
    tecStartPdfPage,
    level1Count,
    level2Count,
    totalLevel1PagesCount,
    tecPagesCount,
    tabularPagesCount,
    invariantCheckPassed,
    calculatedTotalPages,
    expectedTotalPages: pdfTotalPages,
    level1Items,
  };
}

async function main() {
  const summariesResults = [];
  for (const f of CFC_FILES) {
    const res = await processFile(f);
    summariesResults.push(res);
  }

  const grandTotalLevel1 = summariesResults.reduce((acc, r) => acc + r.level1Count, 0);
  const grandTotalLevel2 = summariesResults.reduce((acc, r) => acc + r.level2Count, 0);

  console.log(`\n==================================================`);
  console.log(`📊 RESUMO CONSOLIDADO DOS 5 ARQUIVOS CFC:`);
  console.log(`==================================================`);
  console.log(` 🏆 TOTAL DE ITENS DE NÍVEL 1 (BLOCOS ÂNCORA CFC): ${grandTotalLevel1}`);
  console.log(` 📌 TOTAL DE ITENS DE NÍVEL 2 (SUBTÓPICOS): ${grandTotalLevel2}`);

  // Varredura Strict de Segurança (BLOCO 2 item 11)
  console.log(`\n🔒 REALIZANDO VARREDURA STRICT DE SEGURANÇA CONTRA CPF...`);
  const cfcDocsDir = path.join(__dirname, "../docs/cfc");
  const files = fs.readdirSync(cfcDocsDir);

  let cpfLeaksFound = 0;
  for (const file of files) {
    const filePath = path.join(cfcDocsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    if (content.includes("04692559004") || content.includes("CPF")) {
      console.error(`🚨 VAZAMENTO DETECTADO no arquivo ${file}!`);
      cpfLeaksFound++;
    }
  }

  if (cpfLeaksFound === 0) {
    console.log(`✅ VARREDURA CONCLUÍDA: ZERO dados de CPF ou strings restritas encontrados nos arquivos gerados em docs/cfc/!`);
  } else {
    console.error(`❌ VARREDURA FALHOU: VAZAMENTO DE CPF ENCONTRADO.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("❌ ERRO NO PARSER DE SUMÁRIOS:", err);
  process.exit(1);
});
