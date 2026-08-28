import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, theoryStatus, theoryCompletedAt, sourceV1BlockId, StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId);

  const targets = (blocks || []).filter(b => 
    (b as any).StudyMaterial?.originalFileName === "2 - Direito do Trabalho.pdf" &&
    (b.title.includes("Empregador") || b.title.includes("Rescisão"))
  );

  console.log("=================================================================================");
  console.log("    INSPEÇÃO DOS 2 BLOCOS CONCLUÍDOS (ORIGEM DA CONCLUSÃO)                     ");
  console.log("=================================================================================\n");

  for (const b of targets) {
    const { data: logs } = await supabase
      .from("StudySessionLog")
      .select("*")
      .eq("studyBlockId", b.id);

    console.log(`• Bloco: '${b.title}' (ID: ${b.id})`);
    console.log(`  Intervalo Atual: [${b.pageStart}–${b.pageEnd}] | Status: ${b.theoryStatus}`);
    console.log(`  theoryCompletedAt: ${b.theoryCompletedAt} | sourceV1BlockId: ${b.sourceV1BlockId}`);
    console.log(`  Logs de Sessão de Estudo Registrados: ${logs?.length || 0}`);
    if (logs && logs.length > 0) {
      logs.forEach(l => console.log(`    └ Log ID: ${l.id} | Action: ${l.actionType} | Duration: ${l.actualDurationMinutes} min | Created: ${l.createdAt}`));
    }
    console.log();
  }
}

main().catch(console.error);
