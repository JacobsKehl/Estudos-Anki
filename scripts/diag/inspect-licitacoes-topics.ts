import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const blockId = "cmss35ioo000riyao37ku8jaj"; // Licitações 81m block
  const { data: block } = await supabase
    .from("StudyBlock")
    .select("*")
    .eq("id", blockId)
    .single();

  console.log("Licitações block details:", block);
}

main();
