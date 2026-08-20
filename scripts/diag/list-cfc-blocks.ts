import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const cfcFiles = [
  "1 - Direito Administrativo_compressed.pdf",
  "3 - Direito Constitucional.pdf",
  "Direito Processual Civil_compressed.pdf",
  "4 - Direito Processual do Trabalho.pdf",
  "2 - Direito do Trabalho.pdf"
];
async function main() {
  const { data: u } = await s.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const { data: b } = await s.from("StudyBlock")
    .select("id, title, pageStart, pageEnd, theoryStatus, StudyMaterial:materialId(originalFileName)")
    .eq("userId", u!.id);
  for (const f of cfcFiles) {
    console.log(`\n=== ${f} ===`);
    const fb = (b || [])
      .filter((x: any) => x.StudyMaterial?.originalFileName === f && x.theoryStatus !== "EXCLUDED")
      .sort((a: any, b: any) => a.pageStart - b.pageStart);
    for (const x of fb) {
      console.log(`  [${x.pageStart}–${x.pageEnd}] ${x.title}`);
    }
  }
}
main();
