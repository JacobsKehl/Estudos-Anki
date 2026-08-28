import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: gn } = await supabase
    .from("StudyBlockGapNote")
    .select("*")
    .eq("studyBlockId", "cmss35ioo000riyao37ku8jaj");

  console.log("GapNote details for parent block:", gn);
}

main();
