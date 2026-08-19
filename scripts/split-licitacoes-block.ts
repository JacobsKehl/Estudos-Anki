import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const originalBlockId = "cmss35ioo000riyao37ku8jaj";

  const { data: original, error: fetchErr } = await supabase
    .from("StudyBlock")
    .select("*")
    .eq("id", originalBlockId)
    .single();

  if (fetchErr || !original) {
    console.error("Block not found:", fetchErr);
    process.exit(1);
  }

  console.log(`Original Block found: "${original.title}" (pp.${original.pageStart}-${original.pageEnd}, ${original.estimatedStudyMinutes}m)`);

  // Operational Safety Rule #6: Count/Snapshot before mutation
  console.log(`Pre-mutation snapshot: original block ID ${original.id}, estimatedStudyMinutes: ${original.estimatedStudyMinutes}`);

  // Part 1: Update original block to pp. 89-102 (14 pages, 42 min)
  const { error: updateErr } = await supabase
    .from("StudyBlock")
    .update({
      title: "Lei 14.133/21 – Nova Lei de Licitações (Parte de Licitações – Fase Preparatória e Modalidades)",
      pageStart: 89,
      pageEnd: 102,
      estimatedStudyMinutes: 42,
      updatedAt: new Date().toISOString()
    })
    .eq("id", originalBlockId);

  if (updateErr) {
    console.error("Error updating Part 1:", updateErr);
    process.exit(1);
  }
  console.log("✅ Updated Part 1: pp.89-102 (42 min)");

  // Part 2: Insert new block for pp. 103-115 (13 pages, 39 min)
  const newBlockId = "cmss" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 10);
  const { data: newBlock, error: insertErr } = await supabase
    .from("StudyBlock")
    .insert({
      id: newBlockId,
      userId: original.userId,
      subjectId: original.subjectId,
      materialId: original.materialId,
      title: "Lei 14.133/21 – Nova Lei de Licitações (Parte de Licitações – Julgamento, Habilitação e Procedimentos Auxiliares)",
      pageStart: 103,
      pageEnd: 115,
      orderIndex: original.orderIndex + 1,
      estimatedStudyMinutes: 39,
      createdBy: original.createdBy,
      theoryStatus: "NOT_STARTED",
      questionsStatus: "NOT_STARTED",
      flashcardsStatus: "NOT_STARTED",
      officialTopicId: original.officialTopicId,
      methodology: original.methodology,
      needsManualReview: false,
      possiblyAlreadyStudied: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    .select()
    .single();

  if (insertErr) {
    console.error("Error inserting Part 2:", insertErr);
    process.exit(1);
  }

  console.log(`✅ Inserted Part 2: ID ${newBlock.id}, pp.103-115 (39 min)`);
}

main();
