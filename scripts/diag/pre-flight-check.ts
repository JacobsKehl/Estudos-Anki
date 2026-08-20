import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  const { data: items } = await supabase
    .from("StudyScheduleItem")
    .select("id, status, scheduledDate, estimatedMinutes, actionType, StudyBlock:studyBlockId(title, estimatedStudyMinutes)")
    .eq("userId", userId)
    .gte("scheduledDate", today.toISOString())
    .lt("scheduledDate", sevenDaysLater.toISOString());

  console.log("=== 7-DAY SCHEDULE BREAKDOWN (PRE-UPDATE) ===");
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(today);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayItems = (items || []).filter((it: any) => {
      if (!it.scheduledDate) return false;
      const d = new Date(it.scheduledDate);
      return d >= dayStart && d < dayEnd;
    });

    const dStr = dayStart.toISOString().substring(0, 10);
    console.log(`${dStr} (D+${i}): ${dayItems.length} itens`);
    for (const it of dayItems) {
      const b = (it as any).StudyBlock;
      console.log(`   - [${it.status}] ${b?.title?.substring(0, 50)} (${it.estimatedMinutes ?? b?.estimatedStudyMinutes ?? 0}m)`);
    }
  }
}

main().catch(console.error);
