import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";

async function purgeResidual() {
  console.log("=== LIMPANDO ITENS RESIDUAIS DE BLOCOS EXCLUDED ===");

  // 1. Buscar todos os blocos EXCLUDED
  const { data: excludedBlocks } = await supabase
    .from("StudyBlock")
    .select("id")
    .eq("userId", userId)
    .eq("theoryStatus", "EXCLUDED");

  const excludedIds = (excludedBlocks || []).map((b) => b.id);
  console.log(`Blocos EXCLUDED no banco: ${excludedIds.length}`);

  // 2. Buscar itens de THEORY PENDING apontando para esses blocos
  let allResidual: any[] = [];
  const BATCH = 1000;
  let page = 0;
  while (true) {
    const { data: items } = await supabase
      .from("StudyScheduleItem")
      .select("id, studyBlockId, actionType, status")
      .eq("userId", userId)
      .eq("actionType", "THEORY")
      .eq("status", "PENDING")
      .in("studyBlockId", excludedIds)
      .range(page * BATCH, (page + 1) * BATCH - 1);

    if (items && items.length > 0) allResidual = allResidual.concat(items);
    if (!items || items.length < BATCH) break;
    page++;
  }

  console.log(`Itens residuais THEORY PENDING apontando para blocos EXCLUDED: ${allResidual.length}`);

  // 3. Atualizar para SKIPPED
  const resIds = allResidual.map((i) => i.id);
  for (let i = 0; i < resIds.length; i += 100) {
    const batch = resIds.slice(i, i + 100);
    const { error } = await supabase
      .from("StudyScheduleItem")
      .update({ status: "SKIPPED" })
      .in("id", batch);
    if (error) throw error;
  }

  console.log(`✅ ${allResidual.length} itens marcados como SKIPPED com sucesso!`);
}

purgeResidual().catch(console.error);
