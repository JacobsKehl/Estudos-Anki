import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("======================================================================");
  console.log("    ATUALIZAÇÃO DE TÍTULOS E PÁGINAS DOS BLOCOS DE LICITAÇÕES        ");
  console.log("======================================================================\n");

  const parentBlockId = "cmss35ioo000riyao37ku8jaj"; // Parte 1 (pp. 90-102)
  const childBlockId = "cmssvzfdspa0001l804mwt2b1";  // Parte 2 (pp. 103-115)

  const parentUpdate = {
    title: "Lei 14.133/21 – Licitações (Fases do Processo Licitatório: da Preparação ao Encerramento)",
    pageStart: 90,
    pageEnd: 102,
    estimatedStudyMinutes: 39
  };

  const childUpdate = {
    title: "Lei 14.133/21 – Licitações (Modalidades, Contratação Direta e Procedimentos Auxiliares)",
    pageStart: 103,
    pageEnd: 115,
    estimatedStudyMinutes: 39
  };

  const { data: b1, error: err1 } = await supabase
    .from("StudyBlock")
    .update(parentUpdate)
    .eq("id", parentBlockId)
    .select();

  if (err1) {
    console.error("Erro ao atualizar Bloco Parte 1:", err1);
    return;
  }
  console.log("✅ Bloco Parte 1 Atualizado com Sucesso:");
  console.log(` - ID: ${parentBlockId}`);
  console.log(` - Novo Título: '${parentUpdate.title}'`);
  console.log(` - Páginas: ${parentUpdate.pageStart}–${parentUpdate.pageEnd} (${parentUpdate.pageEnd - parentUpdate.pageStart + 1} págs, ${parentUpdate.estimatedStudyMinutes} min)\n`);

  const { data: b2, error: err2 } = await supabase
    .from("StudyBlock")
    .update(childUpdate)
    .eq("id", childBlockId)
    .select();

  if (err2) {
    console.error("Erro ao atualizar Bloco Parte 2:", err2);
    return;
  }
  console.log("✅ Bloco Parte 2 Atualizado com Sucesso:");
  console.log(` - ID: ${childBlockId}`);
  console.log(` - Novo Título: '${childUpdate.title}'`);
  console.log(` - Páginas: ${childUpdate.pageStart}–${childUpdate.pageEnd} (${childUpdate.pageEnd - childUpdate.pageStart + 1} págs, ${childUpdate.estimatedStudyMinutes} min)\n`);
}

main();
