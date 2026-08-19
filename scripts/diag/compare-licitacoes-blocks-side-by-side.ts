import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const id1 = "cmss35ioo000riyao37ku8jaj"; // Part 1
  const id2 = "cmssvzfdspa0jv1pp2ni8m";   // Part 2

  const { data: b1 } = await supabase.from("StudyBlock").select("*").eq("id", id1).single();
  const { data: b2 } = await supabase.from("StudyBlock").select("*").eq("id", id2).single();

  const { data: fc1 } = await supabase.from("Flashcard").select("id, front, studyBlockId").eq("studyBlockId", id1);
  const { data: fc2 } = await supabase.from("Flashcard").select("id, front, studyBlockId").eq("studyBlockId", id2);

  const { data: gn1 } = await supabase.from("StudyBlockGapNote").select("*").eq("studyBlockId", id1);
  const { data: gn2 } = await supabase.from("StudyBlockGapNote").select("*").eq("studyBlockId", id2);

  console.log("======================================================================");
  console.log("    COMPARAÇÃO LADO A LADO DOS CAMPOS DOS BLOCOS PART 1 E PART 2     ");
  console.log("======================================================================\n");

  console.log("CAMPO                       | PARTE 1 (id: cmss35ioo...)           | PARTE 2 (id: cmssvzfdspa...)");
  console.log("----------------------------+---------------------------------------+---------------------------------------");
  
  const fields = [
    "id", "userId", "subjectId", "materialId", "officialTopicId", "title",
    "pageStart", "pageEnd", "estimatedStudyMinutes", "orderIndex", "methodology",
    "theoryStatus", "questionsStatus", "flashcardsStatus", "createdBy",
    "needsManualReview", "possiblyAlreadyStudied", "sourceV1BlockId"
  ];

  fields.forEach(f => {
    const val1 = String(b1[f] ?? "null").padEnd(37, " ");
    const val2 = String(b2[f] ?? "null");
    console.log(`${f.padEnd(27, " ")} | ${val1} | ${val2}`);
  });

  console.log("\n--- VERIFICAÇÃO DE FLASHCARDS E NOTAS DO F2 ---");
  console.log(`Flashcards no Bloco Pai (Parte 1): ${fc1?.length || 0}`);
  console.log(`Flashcards no Bloco Novo (Parte 2): ${fc2?.length || 0}`);
  console.log(`GapNotes no Bloco Pai (Parte 1):    ${gn1?.length || 0}`);
  console.log(`GapNotes no Bloco Novo (Parte 2):   ${gn2?.length || 0}`);
}

main();
