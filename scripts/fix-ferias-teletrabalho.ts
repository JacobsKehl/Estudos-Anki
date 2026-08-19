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

  const tele = (blocks || []).find(b => 
    (b as any).StudyMaterial?.originalFileName === "2 - Direito do Trabalho.pdf" && b.title.includes("Teletrabalho")
  );
  const ferias = (blocks || []).find(b => 
    (b as any).StudyMaterial?.originalFileName === "2 - Direito do Trabalho.pdf" && b.title.includes("Férias")
  );

  if (tele) {
    await supabase.from("StudyBlock").update({ pageStart: 16, pageEnd: 17 }).eq("id", tele.id);
    console.log(` ✅ Atualizado Teletrabalho: [16–16] ➔ [16–17]`);
  }
  if (ferias) {
    await supabase.from("StudyBlock").update({ pageStart: 18, pageEnd: 18 }).eq("id", ferias.id);
    console.log(` ✅ Atualizado Férias Anuais: [17–18] ➔ [18–18]`);
  }
}

main().catch(console.error);
