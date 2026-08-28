import "dotenv/config";

if (!process.env.RODAR_SCRIPT_HISTORICO) {
  console.error("🛑 SCRIPT HISTÓRICO BLOQUEADO: Para executar este script de saneamento passado, defina RODAR_SCRIPT_HISTORICO=true");
  process.exit(1);
}

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("======================================================================");
  console.log("    DESATIVANDO BLOCO FANTASMA 'PRESCRIÇÃO' DE DIREITO DO TRABALHO   ");
  console.log("======================================================================\n");

  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId);

  const prescricao = (blocks || []).find(b => 
    (b as any).StudyMaterial?.originalFileName === "2 - Direito do Trabalho.pdf" && b.title.includes("Prescrição")
  );

  if (!prescricao) {
    console.log(" ❌ Bloco Prescrição não encontrado.");
    return;
  }

  console.log(`📌 Bloco Encontrado: '${prescricao.title}' (ID: ${prescricao.id})`);

  // 1. Remover/Deletar itens do cronograma vinculados a esse bloco
  const { data: deletedItems, error: delErr } = await supabase
    .from("StudyScheduleItem")
    .delete()
    .eq("studyBlockId", prescricao.id)
    .select();

  if (delErr) {
    console.log(` ❌ Erro ao remover itens do cronograma: ${delErr.message}`);
  } else {
    console.log(` ✅ Removidos ${deletedItems?.length || 0} itens do cronograma vinculados a Prescrição.`);
  }

  // 2. Marcar o bloco como EXCLUDED / absorvido pelo capítulo de CCT (sem apagar a linha para preservar histórico)
  const { error: blockErr } = await supabase
    .from("StudyBlock")
    .update({ 
      theoryStatus: "EXCLUDED", 
      pageStart: 0, 
      pageEnd: 0
    })
    .eq("id", prescricao.id);

  if (blockErr) {
    console.log(` ❌ Erro ao desativar StudyBlock Prescrição: ${blockErr.message}`);
  } else {
    console.log(` ✅ StudyBlock Prescrição desativado com sucesso (theoryStatus: EXCLUDED).`);
  }

  console.log("\n======================================================================");
  console.log("    DESATIVAÇÃO CONCLUÍDA                                             ");
  console.log("======================================================================\n");
}

main().catch(console.error);
