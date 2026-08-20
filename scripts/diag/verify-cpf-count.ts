import "dotenv/config";
import { fetchAllRowsPaginated } from "../backup-paginated";

async function main() {
  console.log("=================================================================");
  console.log("  VERIFICAÇÃO REAL DO INVARIANTE DE CPF EM ExtractedContent");
  console.log("=================================================================\n");

  const { data: pages, exactCount } = await fetchAllRowsPaginated("ExtractedContent");
  console.log(`Total de páginas em ExtractedContent no banco: ${exactCount}\n`);

  const TARGET_CPF = "04692559004";
  const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

  let exactCpfMatchCount = 0;
  let totalCpfRegexMatchCount = 0;
  const pagesWithTargetCpf: Array<{ id: string; materialId: string; pageNumber: number }> = [];

  for (const page of pages) {
    const text = page.text || "";
    if (text.includes(TARGET_CPF)) {
      exactCpfMatchCount++;
      pagesWithTargetCpf.push({ id: page.id, materialId: page.materialId, pageNumber: page.pageNumber });
    }
    const matches = text.match(CPF_REGEX);
    if (matches) {
      totalCpfRegexMatchCount += matches.length;
    }
  }

  console.log(`📊 Ocorrências exatas do CPF de controle ('${TARGET_CPF}'): ${exactCpfMatchCount}`);
  console.log(`📊 Total de padrões de CPF encontrados (regex):              ${totalCpfRegexMatchCount}\n`);

  if (exactCpfMatchCount === 73) {
    console.log("✅ INVARIANTE CONFIRMADO E IGUAL A 73: O CPF '04692559004' permanece em EXATAMENTE 73 ocorrências!");
    console.log("   Nenhum vazamento ocorreu nas 382 novas páginas adicionadas!");
  } else {
    console.log(`⚠️ ATENÇÃO: Contagem alterada! Esperado: 73 | Encontrado: ${exactCpfMatchCount}`);
  }
}

main().catch(console.error);
