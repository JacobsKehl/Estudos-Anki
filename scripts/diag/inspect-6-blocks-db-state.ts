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
    .select("id, title, pageStart, pageEnd, theoryStatus, estimatedStudyMinutes, StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId);

  const targets = [
    { pdf: "Direito Processual Civil_compressed.pdf", title: "Procedimento Comum" },
    { pdf: "Direito Processual Civil_compressed.pdf", title: "Tutela Provisória" },
    { pdf: "2 - Direito do Trabalho.pdf", title: "Contrato de Trabalho" },
    { pdf: "2 - Direito do Trabalho.pdf", title: "Empregador, Empregado" },
    { pdf: "2 - Direito do Trabalho.pdf", title: "Remuneração" },
    { pdf: "2 - Direito do Trabalho.pdf", title: "Tutelas Especiais" },
    { pdf: "2 - Direito do Trabalho.pdf", title: "Rescisão do Contrato" },
    { pdf: "2 - Direito do Trabalho.pdf", title: "Responsabilidade Trabalhista" },
    { pdf: "2 - Direito do Trabalho.pdf", title: "Convenções Coletivas" },
    { pdf: "2 - Direito do Trabalho.pdf", title: "Prescrição" },
    { pdf: "2 - Direito do Trabalho.pdf", title: "Jurisprudências" }
  ];

  console.log("=================================================================================");
  console.log("    ESTADO ATUAL NO BANCO DE DADOS (STATUS + CRONOGRAMA)                         ");
  console.log("=================================================================================\n");

  for (const t of targets) {
    const matched = (blocks || []).filter(b => 
      (b as any).StudyMaterial?.originalFileName === t.pdf && b.title.includes(t.title)
    );

    for (const b of matched) {
      // Checar se está no cronograma ativo
      const { data: schedItems } = await supabase
        .from("StudyScheduleItem")
        .select("id, scheduledDate, completedAt, status")
        .eq("studyBlockId", b.id);

      console.log(`• Bloco ID: ${b.id}`);
      console.log(`  Matéria/PDF: '${t.pdf}' | Título: '${b.title}'`);
      console.log(`  Intervalo Atual: [${b.pageStart}–${b.pageEnd}] | Minutos: ${b.estimatedStudyMinutes} | Status: ${b.theoryStatus}`);
      console.log(`  Itens de Cronograma Vinculados: ${schedItems?.length || 0}`);
      if (schedItems && schedItems.length > 0) {
        schedItems.forEach(si => console.log(`    └ SchedItem ID: ${si.id} | Data: ${si.scheduledDate} | Status: ${si.status}`));
      }
      console.log();
    }
  }
}

main().catch(console.error);
