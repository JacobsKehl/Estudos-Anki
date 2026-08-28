/**
 * decompose-58-blocks.ts
 *
 * Decomposição exata dos 58 blocos do acervo CFC em 5 buckets mutuamente exclusivos:
 * 1. COMPLETED com sourceV1BlockId != null (pré-creditados do Estratégia)
 * 2. COMPLETED com sourceV1BlockId == null (lidos no app)
 * 3. NOT_STARTED com possiblyAlreadyStudied == true (painel aguardando confirmação)
 * 4. NOT_STARTED limpos (possiblyAlreadyStudied == false) -> inéditos de verdade
 * 5. EXCLUDED (bloco fantasma de Prescrição)
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const CFC_FILES = [
  "1 - Direito Administrativo_compressed.pdf",
  "2 - Direito do Trabalho.pdf",
  "3 - Direito Constitucional.pdf",
  "4 - Direito Processual do Trabalho.pdf",
  "Direito Processual Civil_compressed.pdf",
];

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const { data: allBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, theoryStatus, pageStart, pageEnd, estimatedStudyMinutes, possiblyAlreadyStudied, sourceV1BlockId, StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId);

  const cfcBlocks = (allBlocks || []).filter(b =>
    CFC_FILES.includes((b as any).StudyMaterial?.originalFileName || "")
  );

  console.log("=================================================================");
  console.log(`  DECOMPOSIÇÃO DOS ${cfcBlocks.length} BLOCOS CFC EM 5 BUCKETS`);
  console.log("=================================================================\n");

  const b1 = cfcBlocks.filter(b => b.theoryStatus === "COMPLETED" && b.sourceV1BlockId !== null);
  const b2 = cfcBlocks.filter(b => b.theoryStatus === "COMPLETED" && b.sourceV1BlockId === null);
  const b3 = cfcBlocks.filter(b => b.theoryStatus === "NOT_STARTED" && b.possiblyAlreadyStudied === true);
  const b4 = cfcBlocks.filter(b => b.theoryStatus === "NOT_STARTED" && (b.possiblyAlreadyStudied === false || b.possiblyAlreadyStudied === null));
  const b5 = cfcBlocks.filter(b => b.theoryStatus === "EXCLUDED");

  console.log(`  Bucket 1: COMPLETED (pré-crédito Estratégia, sourceV1BlockId != null): ${b1.length}`);
  console.log(`  Bucket 2: COMPLETED (lidos no app, sourceV1BlockId == null):          ${b2.length}`);
  console.log(`  Bucket 3: NOT_STARTED (no painel, possiblyAlreadyStudied == true):    ${b3.length}`);
  console.log(`  Bucket 4: NOT_STARTED limpos (inéditos reais):                        ${b4.length}`);
  console.log(`  Bucket 5: EXCLUDED (fantasma desativado):                             ${b5.length}`);

  const totalSum = b1.length + b2.length + b3.length + b4.length + b5.length;
  console.log(`  -----------------------------------------------------------------`);
  console.log(`  SOMA DOS 5 BUCKETS: ${totalSum} / ${cfcBlocks.length} (${totalSum === cfcBlocks.length ? "✅ BATE 100%" : "⚠️ DIVERGÊNCIA"})\n`);

  console.log("=================================================================");
  console.log("  DETALHES DO BUCKET 2: BLOCOS LIDOS NO APP (sourceV1BlockId == null)");
  console.log("=================================================================\n");

  b2.forEach((b: any, idx) => {
    console.log(`   ${idx + 1}. [${b.StudyMaterial?.originalFileName.substring(0, 18)}] ${b.title} [pág ${b.pageStart}–${b.pageEnd}] (${b.estimatedStudyMinutes}m)`);
  });

  console.log("\n=================================================================");
  console.log("  DETALHES DO BUCKET 3: BLOCOS AINDA NO PAINEL (possiblyAlreadyStudied == true)");
  console.log("=================================================================\n");

  b3.forEach((b: any, idx) => {
    console.log(`   ${idx + 1}. [${b.StudyMaterial?.originalFileName.substring(0, 18)}] ${b.title} [pág ${b.pageStart}–${b.pageEnd}]`);
  });
}

main().catch(console.error);
