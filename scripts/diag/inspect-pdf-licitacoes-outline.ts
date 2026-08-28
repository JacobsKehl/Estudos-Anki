import fs from "fs";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

async function main() {
  const pdfPath = "C:\\Users\\henrique.kehl\\Downloads\\CFC TRT4\\1 - Direito Administrativo_compressed.pdf";
  if (!fs.existsSync(pdfPath)) {
    console.error("PDF não encontrado em:", pdfPath);
    return;
  }

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  console.log(`======================================================================`);
  console.log(`  EXTRAÇÃO DIRETA DO SUMÁRIO/ESTRUTURA DE LICITAÇÕES (PÁGS 89 A 115)  `);
  console.log(`======================================================================\n`);
  console.log(`Arquivo carregado: ${pdfPath}`);
  console.log(`Total de páginas no PDF: ${doc.numPages}\n`);

  for (let pageNum = 89; pageNum <= 115; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Filtra cabeçalhos / tópicos em destaque (textos em negrito ou com fontName/altura de título)
    const items = textContent.items as any[];
    const pageText = items.map(item => item.str).join(" ");

    // Procurar por linhas de títulos de tópicos/subtópicos (números de tópicos, letras, palavras-chave)
    const headings = items.filter(item => {
      const str = item.str.trim();
      if (!str) return false;
      // Padrões típicos de tópicos e cabeçalhos em PDFs do CFC/Estratégia: "1.", "1.1", "SUMÁRIO", "Fase", "Princípios", "Modalidades", "Habilitação", "Alienações"
      return (
        /^\d+(\.\d+)*\b/.test(str) ||
        /^(Fase|Princípios|Modalidades|Dispensa|Inexigibilidade|Habilitação|Julgamento|SRP|Credenciamento|Alienações|Contratação|Procedimentos)\b/i.test(str)
      );
    });

    console.log(`--- PÁGINA ${pageNum} (PDF p.${pageNum}) ---`);
    if (headings.length > 0) {
      headings.slice(0, 8).forEach(h => console.log(`   • [Pág ${pageNum}] ${h.str.trim()}`));
    } else {
      // Amostra dos primeiros 150 caracteres da página se nenhum padrão estrito bater
      console.log(`   (Amostra): ${pageText.substring(0, 120)}...`);
    }
  }
}

main().catch(console.error);
