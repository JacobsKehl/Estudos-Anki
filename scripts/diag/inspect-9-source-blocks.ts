import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  console.log("=================================================================");
  console.log("  INSPEÇÃO DOS 9 BLOCOS COM sourceV1BlockId PREENCHIDO (BUCKET 1)");
  console.log("=================================================================\n");

  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, theoryStatus, sourceV1BlockId, createdAt, updatedAt, StudySubject:subjectId(name)")
    .eq("userId", userId)
    .not("sourceV1BlockId", "is", null);

  console.log(`Total de blocos com sourceV1BlockId preenchido: ${blocks?.length ?? 0}\n`);

  for (const b of blocks || []) {
    console.log(`📌 Bloco: "${b.title}" (${(b as any).StudySubject?.name})`);
    console.log(`   ID: ${b.id}`);
    console.log(`   sourceV1BlockId: ${b.sourceV1BlockId}`);
    console.log(`   createdAt:       ${b.createdAt}`);
    console.log(`   updatedAt:       ${b.updatedAt}`);
    console.log("   --------------------------------------------------------------");
  }
}

main().catch(console.error);
