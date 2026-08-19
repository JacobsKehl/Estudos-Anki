import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("======================================================================");
  console.log("    RECONCILIAÇÃO LITERAL DOS 14 BLOCOS SINALIZADOS PENDENTES          ");
  console.log("======================================================================\n");

  const { data: user } = await supabase
    .from("User")
    .select("id")
    .eq("email", "gabriela.furtado.p@gmail.com")
    .single();

  const userId = user!.id;

  // Query A: Todos os blocos com possiblyAlreadyStudied = true e theoryStatus != COMPLETED para Gabriela
  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, subjectId, theoryStatus, possiblyAlreadyStudied, materialId, StudySubject:subjectId(name), StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId)
    .eq("possiblyAlreadyStudied", true)
    .neq("theoryStatus", "COMPLETED");

  console.log(`Total de blocos sinalizados pendentes encontrados no banco: ${blocks?.length || 0}\n`);

  const breakdown: Record<string, number> = {};
  const items: any[] = [];

  (blocks || []).forEach((b: any) => {
    const sName = b.StudySubject?.name || "Desconhecido";
    breakdown[sName] = (breakdown[sName] || 0) + 1;
    items.push({
      id: b.id,
      matéria: sName,
      título: b.title.substring(0, 45),
      pdfOrigem: b.StudyMaterial?.originalFileName || "Desconhecido"
    });
  });

  console.log("--- DISTRIBUIÇÃO LITERAL DE BLOCOS POR MATÉRIA (14 BLOCOS) ---");
  console.table(breakdown);

  console.log("\n--- LISTA COMPLETA DOS 14 BLOCOS PARA O PAINEL SINALIZADO ---");
  console.table(items);
}

main();
