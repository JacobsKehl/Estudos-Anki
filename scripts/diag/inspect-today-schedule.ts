import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase
    .from("User")
    .select("id")
    .eq("email", "gabriela.furtado.p@gmail.com")
    .single();

  if (!user) {
    console.error("Usuária não encontrada");
    return;
  }

  const userId = user.id;

  // Data de hoje (2026-08-19)
  const todayStr = "2026-08-19";

  const { data: items } = await supabase
    .from("StudyScheduleItem")
    .select("id, date, status, title, estimatedMinutes, type, studyBlockId, StudyBlock:studyBlockId(title, estimatedStudyMinutes, pageStart, pageEnd, StudyMaterial:materialId(originalFileName))")
    .eq("userId", userId)
    .gte("date", `${todayStr}T00:00:00.000Z`)
    .lte("date", `${todayStr}T23:59:59.999Z`);

  console.log("======================================================================");
  console.log(`    ITENS AGENDADOS PARA HOJE (${todayStr}) NO BANCO DE DADOS       `);
  console.log("======================================================================\n");

  console.log(`Total de itens agendados para hoje: ${items?.length || 0}`);
  (items || []).forEach((item, idx) => {
    console.log(`\n[Item ${idx + 1}] ID: ${item.id}`);
    console.log(` - Título: '${item.title}'`);
    console.log(` - Tipo: ${item.type}`);
    console.log(` - Minutos estimados: ${item.estimatedMinutes}`);
    console.log(` - Status: ${item.status}`);
    console.log(` - Material: ${(item.StudyBlock as any)?.StudyMaterial?.originalFileName || "N/A"}`);
    console.log(` - Páginas: ${(item.StudyBlock as any)?.pageStart}–${(item.StudyBlock as any)?.pageEnd}`);
  });
}

main();
