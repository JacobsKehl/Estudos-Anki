import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";

async function main() {
  console.log("=== AUDITORIA DE FLASHCARDS COM STATUS 'ARCHIVED' ===");

  const { data: cards, error } = await supabase
    .from("Flashcard")
    .select("id, question, updatedAt, createdAt, subjectId, studyBlockId")
    .eq("userId", userId)
    .eq("status", "ARCHIVED")
    .order("updatedAt", { ascending: true });

  if (error) throw error;

  console.log(`Total de flashcards ARCHIVED da Gabriela: ${cards?.length || 0}\n`);

  const countByExactTime: Record<string, number> = {};
  const countByDay: Record<string, number> = {};

  for (const c of cards || []) {
    const day = c.updatedAt ? c.updatedAt.substring(0, 10) : "N/A";
    const exact = c.updatedAt ? c.updatedAt.substring(0, 16) : "N/A"; // YYYY-MM-DDTHH:MM

    countByDay[day] = (countByDay[day] || 0) + 1;
    countByExactTime[exact] = (countByExactTime[exact] || 0) + 1;
  }

  console.log("Distribuição por DIA de updatedAt:");
  console.log("Data       | Quantidade");
  console.log("-----------+-----------");
  for (const [day, count] of Object.entries(countByDay)) {
    console.log(`${day.padEnd(10)} | ${count}`);
  }

  console.log("\nDistribuição por MINUTO exato de updatedAt:");
  console.log("Timestamp (Minuto) | Quantidade");
  console.log("-------------------+-----------");
  for (const [ts, count] of Object.entries(countByExactTime)) {
    console.log(`${ts.padEnd(18)} | ${count}`);
  }
}

main().catch(console.error);
