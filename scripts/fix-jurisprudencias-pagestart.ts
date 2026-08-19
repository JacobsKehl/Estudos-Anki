import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId);

  const juris = (blocks || []).find(b => 
    (b as any).StudyMaterial?.originalFileName === "2 - Direito do Trabalho.pdf" && b.title.includes("Jurisprudências")
  );

  if (juris) {
    await supabase.from("StudyBlock").update({ pageStart: 28, pageEnd: 42 }).eq("id", juris.id);
    console.log(` ✅ Atualizado Jurisprudências (2 - Direito do Trabalho.pdf): [27–42] ➔ [28–42]`);
  }
}

main().catch(console.error);
