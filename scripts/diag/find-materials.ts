import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: mats, error } = await supabase
    .from("StudyMaterial")
    .select("id, originalFileName, fileUrl, storagePath, userId, mimeType");
  console.log("Error:", error);
  console.log("Mats:", mats);
}

main().catch(console.error);
