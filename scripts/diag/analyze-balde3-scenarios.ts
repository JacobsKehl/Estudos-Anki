import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("======================================================================");
  console.log("   ANÁLISE DE PRODUTO DO BALDE 3: CENÁRIO A vs CENÁRIO B             ");
  console.log("======================================================================\n");

  const { data: user } = await supabase
    .from("User")
    .select("id")
    .eq("email", "gabriela.furtado.p@gmail.com")
    .single();
  const userId = user!.id;

  const cfcFileNames = [
    "1 - Direito Administrativo_compressed.pdf",
    "3 - Direito Constitucional_compressed.pdf",
    "3 - Direito Constitucional.pdf",
    "Direito Processual Civil_compressed.pdf",
    "4 - Direito Processual do Trabalho.pdf",
    "2 - Direito do Trabalho.pdf"
  ];

  const { data: cfcMaterials } = await supabase
    .from("StudyMaterial")
    .select("id")
    .in("originalFileName", cfcFileNames);

  const cfcMaterialIds = (cfcMaterials || []).map(m => m.id);

  // 1. Cenário A: Apenas blocos concluídos/pré-creditados do CFC
  const { data: cfcCompletedBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, theoryCompletedAt")
    .eq("userId", userId)
    .eq("theoryStatus", "COMPLETED")
    .in("materialId", cfcMaterialIds);

  // 2. Cenário B: Todos os blocos concluídos no banco (CFC + Estratégia)
  const { data: allCompletedBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, theoryCompletedAt")
    .eq("userId", userId)
    .eq("theoryStatus", "COMPLETED");

  console.log(`[CENÁRIO A — Âncoras do CFC Apenas]:`);
  console.log(` - Blocos Concluídos/Pré-creditados do CFC: ${cfcCompletedBlocks?.length || 0}`);
  
  // No Cenário A, cada bloco gera no máximo 3 revisões (D+5, D+15, D+30)
  // Se contarmos retroativamente a partir do pré-crédito do F1 (14/08):
  // D+5 venceu em 19/08 (hoje!) -> 13 itens vencidos hoje.
  // D+15 vencerá em 29/08 -> 13 itens.
  // D+30 vencerá em 13/09 -> 13 itens.
  const cfcReviewsTotal = (cfcCompletedBlocks?.length || 0) * 3;
  console.log(` - Total histórico de revisões geradas no CFC (D+5, D+15, D+30): ${cfcReviewsTotal} revisões`);
  
  const today = new Date("2026-08-19T00:00:00-03:00");
  let cfcOverdueToday = 0;
  (cfcCompletedBlocks || []).forEach(b => {
    const compDate = b.theoryCompletedAt ? new Date(b.theoryCompletedAt) : new Date("2026-08-14T00:00:00-03:00");
    const d5 = new Date(compDate); d5.setDate(d5.getDate() + 5);
    const d15 = new Date(compDate); d15.setDate(d15.getDate() + 15);
    const d30 = new Date(compDate); d30.setDate(d30.getDate() + 30);

    if (d5 <= today) cfcOverdueToday++;
    if (d15 <= today) cfcOverdueToday++;
    if (d30 <= today) cfcOverdueToday++;
  });

  console.log(` - Revisões VENCIDAS HOJE (19/08) no Cenário A: ${cfcOverdueToday} revisões`);
  console.log(` - Tempo para drenar as revisões vencidas do CFC a 2/dia: ${Math.ceil(cfcOverdueToday / 2)} dias\n`);

  console.log(`----------------------------------------------------------------------`);
  console.log(`[CENÁRIO B — Âncoras do CFC + Todo o Histórico Antigo do Estratégia]:`);
  console.log(` - Blocos Concluídos Totais no Banco (CFC + Estratégia): ${allCompletedBlocks?.length || 0}`);
  
  let allOverdueToday = 0;
  (allCompletedBlocks || []).forEach(b => {
    const compDate = b.theoryCompletedAt ? new Date(b.theoryCompletedAt) : new Date("2026-08-14T00:00:00-03:00");
    const d5 = new Date(compDate); d5.setDate(d5.getDate() + 5);
    const d15 = new Date(compDate); d15.setDate(d15.getDate() + 15);
    const d30 = new Date(compDate); d30.setDate(d30.getDate() + 30);

    if (d5 <= today) allOverdueToday++;
    if (d15 <= today) allOverdueToday++;
    if (d30 <= today) allOverdueToday++;
  });

  console.log(` - Total de itens de revisão VENCIDOS ACUMULADOS HOJE (19/08): ${allOverdueToday} revisões vencidas`);
  console.log(`\nTempo para drenar o backlog acumulado do Estratégia + CFC no Cenário B:`);
  console.log(` - A 2 revisões de bloco por dia: ${Math.ceil(allOverdueToday / 2)} dias (${(allOverdueToday / 2 / 30).toFixed(1)} meses!)`);
  console.log(` - A 4 revisões de bloco por dia: ${Math.ceil(allOverdueToday / 4)} dias (${(allOverdueToday / 4 / 30).toFixed(1)} meses!)`);
  console.log(` - A 6 revisões de bloco por dia: ${Math.ceil(allOverdueToday / 6)} dias (${(allOverdueToday / 6 / 30).toFixed(1)} meses!)`);
}

main();
