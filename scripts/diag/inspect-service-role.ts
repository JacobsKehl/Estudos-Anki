import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from("StudyBlock").select("id, title, pageStart, pageEnd, estimatedStudyMinutes, summary, theoryStatus").limit(10);
  if (error) {
    console.error("Erro com Service Role Key:", error);
    return;
  }
  console.log(`Sucesso! Total retornado: ${data?.length}`);
  data?.forEach(b => console.log(` • [${b.pageStart}–${b.pageEnd}] ${b.title}`));
}

main();
