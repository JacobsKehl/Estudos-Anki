import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Query SyllabusTopic for Adm
  const { data: topics } = await supabase
    .from("SyllabusTopic")
    .select("*")
    .order("code", { ascending: true });

  console.log("======================================================================");
  console.log("    TÓPICOS DO EDITAL DO CFC / TRT4 (SyllabusTopic)                   ");
  console.log("======================================================================\n");

  const admTopics = (topics || []).filter(t => t.code?.includes("adm") || t.name?.toLowerCase().includes("licitaç"));
  console.log(admTopics);
}

main();
