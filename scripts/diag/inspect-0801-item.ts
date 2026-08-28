import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: item } = await supabase
    .from("StudyScheduleItem")
    .select("id, status, actionType, reason, createdAt, scheduledDate, studyBlockId, StudyBlock:studyBlockId(title)")
    .eq("id", "cmt1etvz40000jm04zls28zll")
    .single();

  console.log("=================================================================");
  console.log("  INSPEÇÃO DO ITEM cmt1etvz40000jm04zls28zll (CRIADO ÀS 08H01)");
  console.log("=================================================================\n");

  if (item) {
    console.log(`ID:            ${item.id}`);
    console.log(`actionType:    ${item.actionType}`);
    console.log(`reason:        ${item.reason}`);
    console.log(`createdAt:     ${item.createdAt}`);
    console.log(`scheduledDate: ${item.scheduledDate}`);
    console.log(`Block Title:   ${(item as any).StudyBlock?.title}`);
  } else {
    console.log("Item não encontrado (pode ter sido purgado na limpeza).");
  }
}

main().catch(console.error);
