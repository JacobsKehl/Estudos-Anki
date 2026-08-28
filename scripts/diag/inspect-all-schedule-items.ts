import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  if (!user) return;

  const { data: items } = await supabase
    .from("StudyScheduleItem")
    .select("id, date, status, title, estimatedMinutes, type, studyBlockId, StudyBlock:studyBlockId(title, estimatedStudyMinutes, StudyMaterial:materialId(originalFileName))")
    .eq("userId", user.id)
    .order("date", { ascending: true });

  console.log(`======================================================================`);
  console.log(` TOTAL DE ITENS NA TABELA StudyScheduleItem DA GABRIELA: ${items?.length || 0}`);
  console.log(`======================================================================\n`);

  (items || []).forEach((item, idx) => {
    const dStr = new Date(item.date).toISOString().substring(0, 10);
    console.log(`[${idx + 1}] Data: ${dStr} | Status: ${item.status} | Tipo: ${item.type} | Minutos: ${item.estimatedMinutes}`);
    console.log(`    Título: '${item.title}'`);
    console.log(`    Material: ${(item.StudyBlock as any)?.StudyMaterial?.originalFileName || "N/A"}\n`);
  });
}

main();
