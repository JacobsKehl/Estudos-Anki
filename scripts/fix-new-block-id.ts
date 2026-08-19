import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const oldId = "cmssvzfdspa0jv1pp2ni8m";
  const newId = "cmssvzfdspa0001l804mwt2b1"; // Standard 25-char CUID format

  const { data: block } = await supabase.from("StudyBlock").select("*").eq("id", oldId).single();
  if (!block) {
    console.log("Block already updated or not found:", oldId);
    return;
  }

  // Update id to 25-character CUID
  const { error } = await supabase
    .from("StudyBlock")
    .update({ id: newId })
    .eq("id", oldId);

  if (error) {
    console.error("Error updating ID:", error);
  } else {
    console.log(`✅ Updated block ID from ${oldId} (22 chars) to ${newId} (25 chars CUID)`);
  }
}

main();
