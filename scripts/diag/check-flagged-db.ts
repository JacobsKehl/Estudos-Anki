import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase
    .from("User")
    .select("id, email")
    .eq("email", "gabriela.furtado.p@gmail.com")
    .single();

  console.log("Gabriela User:", user);

  const { data: blocks, count } = await supabase
    .from("StudyBlock")
    .select("id, title, possiblyAlreadyStudied, theoryStatus", { count: "exact" })
    .eq("userId", user!.id)
    .eq("possiblyAlreadyStudied", true)
    .neq("theoryStatus", "COMPLETED");

  console.log(`Count of flagged blocks for Gabriela: ${count}`);
  console.log("Sample blocks:", blocks?.slice(0, 5));
}

main();
