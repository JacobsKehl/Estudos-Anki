import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("======================================================================");
  console.log("    INSPEÇÃO DE CONTEÚDO EXTRAÍDO NOS 4 BLOCOS ALTERADOS              ");
  console.log("======================================================================\n");

  const { data: blocks, error } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, theoryStatus, userId");

  if (error) {
    console.error("Erro na busca de blocos:", error);
    return;
  }

  console.log(`Total de blocos no banco: ${blocks?.length}`);
  const targetBlocks = (blocks || []).filter(b => 
    b.title.includes("8.112") || b.title.includes("Prescrição") || b.title.includes("Jurisprudência") || b.title.includes("Recurso")
  );

  console.log(`Blocos alvo encontrados: ${targetBlocks.length}`);
  for (const b of targetBlocks) {
    console.log(`\n• ID: ${b.id} | Título: '${b.title}' | pp. ${b.pageStart}–${b.pageEnd} | theoryStatus: ${b.theoryStatus}`);
  }
}

main().catch(console.error);
