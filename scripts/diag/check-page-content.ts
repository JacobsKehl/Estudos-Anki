import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";

async function main() {
  const { data: mat } = await supabase
    .from("StudyMaterial")
    .select("id, originalFileName")
    .eq("userId", userId)
    .eq("originalFileName", "2 - Direito do Trabalho.pdf")
    .single();

  const { data: contents } = await supabase
    .from("ExtractedContent")
    .select("pageNumber, title, text")
    .eq("materialId", mat!.id)
    .in("pageNumber", [7, 8, 9, 10])
    .order("pageNumber", { ascending: true });

  for (const c of contents || []) {
    console.log(`\n================== PÁGINA ${c.pageNumber} ==================`);
    console.log("Título extraído:", c.title);
    console.log("Texto início:", (c.text || "").substring(0, 400));
  }
}

main().catch(console.error);
