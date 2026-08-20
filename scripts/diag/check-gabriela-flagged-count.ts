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
  const userId = user!.id;

  const { data: flagged, count } = await supabase
    .from("StudyBlock")
    .select("id, title, possiblyAlreadyStudied, theoryStatus, needsManualReview", { count: "exact" })
    .eq("userId", userId)
    .eq("possiblyAlreadyStudied", true)
    .neq("theoryStatus", "COMPLETED");

  console.log(`Flagged blocks for Gabriela in DB (possiblyAlreadyStudied=true AND theoryStatus!='COMPLETED'): ${count}`);
  console.log("Blocks:", flagged);
}

main();
