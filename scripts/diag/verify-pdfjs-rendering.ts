import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";

async function main() {
  console.log("=== SIMULAÇÃO REAL DE RENDERIZAÇÃO DO PDFJS (PdfBlockViewer) ===");

  const { data: mat, error: mErr } = await supabase
    .from("StudyMaterial")
    .select("id, originalFileName, sourcePath")
    .eq("userId", userId)
    .eq("originalFileName", "2 - Direito do Trabalho.pdf")
    .single();

  if (mErr || !mat) {
    console.error("Erro ao buscar material:", mErr);
    return;
  }

  console.log("Material encontrado:", mat.id, mat.originalFileName, mat.sourcePath);

  const { data: fileData, error: sErr } = await supabase.storage.from("materials").download(mat.sourcePath!);
  if (sErr || !fileData) {
    console.error("Erro ao baixar do storage:", sErr);
    return;
  }

  const arrayBuffer = await fileData.arrayBuffer();
  const pdfBuffer = Buffer.from(arrayBuffer);

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), cMapPacked: true });
  const pdf = await loadingTask.promise;

  console.log(`\nPDF carregado pelo PDF.js! Total de páginas do arquivo: ${pdf.numPages}`);

  // Simular renderização do bloco CONTRATO DE TRABALHO [8–10]
  console.log("\n==========================================================================");
  console.log("  SIMULANDO PdfBlockViewer no bloco 'CONTRATO DE TRABALHO' (pageStart=8)");
  console.log("==========================================================================");

  for (let pageNum = 8; pageNum <= 10; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const strings = textContent.items.map((item: any) => (item as any).str).filter(Boolean);

    console.log(`\n📄 [PÁGINA ${pageNum} RENDERIZADA NA TELA (pdf.getPage(${pageNum}))]`);
    console.log("Primeiras 6 linhas visíveis:");
    strings.slice(0, 6).forEach((s, idx) => console.log(`   L${idx + 1}: ${s}`));
  }
}

main().catch(console.error);
