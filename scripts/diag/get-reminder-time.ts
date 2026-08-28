import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";

async function main() {
  const { data: pref, error } = await supabase
    .from("UserPreferences")
    .select(`
      id,
      userId,
      emailReminderEnabled,
      emailReminderTime,
      dailyReminderEmail,
      lastDailyReminderSentAt,
      scheduleGenerationMode,
      updatedAt
    `)
    .eq("userId", userId)
    .single();

  if (error) throw error;

  console.log("=== PREFERÊNCIAS DE LEMBRETE DA GABRIELA ===");
  console.log("emailReminderEnabled:", pref.emailReminderEnabled);
  console.log("emailReminderTime:", pref.emailReminderTime);
  console.log("dailyReminderEmail:", pref.dailyReminderEmail);
  console.log("lastDailyReminderSentAt:", pref.lastDailyReminderSentAt);
  console.log("scheduleGenerationMode:", pref.scheduleGenerationMode);
  console.log("updatedAt:", pref.updatedAt);
}

main().catch(console.error);
