import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("======================================================================");
  console.log("    PROVA DOS PRIMEIROS 200 CARACTERES GRAVADOS NOS 4 BLOCOS         ");
  console.log("======================================================================\n");

  const targetIds = [
    "cmss35if4000piyao90mqrh43", // Lei 8.112/90
    "cmss361lj004hiyaodwrvf1xa", // Recursos Trabalhistas
    "cmss361vd004jiyao8r2h6cd9", // Prescrição no DPT
    "cmss362ay004niyao0hismb0p"  // Jurisprudências DPT
  ];

  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, theoryStatus, content, rawText")
    .in("id", targetIds);

  const { data: extracted } = await supabase
    .from("ExtractedContent")
    .select("id, blockId, pageNumber, contentText")
    .in("blockId", targetIds)
    .order("pageNumber", { ascending: true });

  for (const b of (blocks || [])) {
    console.log(`======================================================================`);
    console.log(`📌 BLOCO: '${b.title}' (ID: ${b.id})`);
    console.log(` - Intervalo no Banco: pp. ${b.pageStart}–${b.pageEnd} (${b.estimatedStudyMinutes} min)`);
    console.log(` - theoryStatus: ${b.theoryStatus}`);

    console.log(` - content: ${b.content ? '"' + b.content.substring(0, 100) + '..."' : 'null'}`);
    console.log(` - rawText: ${b.rawText ? '"' + b.rawText.substring(0, 100) + '..."' : 'null'}`);
    console.log();
  }
}

main().catch(console.error);
