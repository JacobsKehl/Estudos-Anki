import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  if (!user) return;

  const { data: schedules } = await supabase
    .from("StudySchedule")
    .select("id, name, status, startDate, endDate, createdAt")
    .eq("userId", user.id);

  console.log("======================================================================");
  console.log(` CRONOGRAMAS DA GABRIELA NA TABELA StudySchedule: ${schedules?.length || 0}`);
  console.log("======================================================================\n");

  (schedules || []).forEach(s => {
    console.log(` - ID: ${s.id} | Nome: '${s.name}' | Status: ${s.status} | Início: ${s.startDate} | Fim: ${s.endDate}`);
  });
}

main();
