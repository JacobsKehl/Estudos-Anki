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

  if (!user) {
    console.error("User not found");
    return;
  }

  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, review1dCompletedAt, review7dCompletedAt, review15dCompletedAt, review30dCompletedAt")
    .eq("userId", user.id);

  const total = blocks?.length || 0;
  const with1d = (blocks || []).filter(b => b.review1dCompletedAt !== null);
  const with7d = (blocks || []).filter(b => b.review7dCompletedAt !== null);
  const with15d = (blocks || []).filter(b => b.review15dCompletedAt !== null);
  const with30d = (blocks || []).filter(b => b.review30dCompletedAt !== null);

  console.log("======================================================================");
  console.log("    AUDITORIA DE COLUNAS DE REVISÃO EM STUDYBLOCK                    ");
  console.log("======================================================================\n");
  console.log(`Total de StudyBlocks da Gabriela: ${total}`);
  console.log(` - review1dCompletedAt preenchidos: ${with1d.length}`);
  console.log(` - review7dCompletedAt preenchidos: ${with7d.length}`);
  console.log(` - review15dCompletedAt preenchidos: ${with15d.length}`);
  console.log(` - review30dCompletedAt preenchidos: ${with30d.length}`);
}

main();
