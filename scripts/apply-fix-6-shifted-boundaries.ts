import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("======================================================================");
  console.log("    APLICANDO CORREÇÃO PAREADA DAS 6 FRONTEIRAS DESLOCADAS EM PROD    ");
  console.log("======================================================================\n");

  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId);

  const getBlock = (pdf: string, titlePart: string) => {
    return (blocks || []).find(b => 
      (b as any).StudyMaterial?.originalFileName === pdf && b.title.includes(titlePart)
    );
  };

  // 1. Processual Civil
  const tutela = getBlock("Direito Processual Civil_compressed.pdf", "Tutela Provisória");
  const procComum = getBlock("Direito Processual Civil_compressed.pdf", "Procedimento Comum");

  // 2. Direito do Trabalho
  const empregador = getBlock("2 - Direito do Trabalho.pdf", "Empregador, Empregado");
  const contrato = getBlock("2 - Direito do Trabalho.pdf", "Contrato de Trabalho");
  const remuneracao = getBlock("2 - Direito do Trabalho.pdf", "Remuneração");
  const rescisao = getBlock("2 - Direito do Trabalho.pdf", "Rescisão do Contrato");
  const tutelasEsp = getBlock("2 - Direito do Trabalho.pdf", "Tutelas Especiais");
  const respTrab = getBlock("2 - Direito do Trabalho.pdf", "Responsabilidade Trabalhista");
  const convColetivas = getBlock("2 - Direito do Trabalho.pdf", "Convenções Coletivas");
  const prescricao = getBlock("2 - Direito do Trabalho.pdf", "Prescrição");

  const updates = [
    // Proc Civil: [31-33] -> [31-34] e [34-46] -> [35-46]
    { block: tutela, pageStart: 31, pageEnd: 34, title: "Tutela Provisória..." },
    { block: procComum, pageStart: 35, pageEnd: 46, title: "Procedimento Comum" },

    // Direito do Trabalho (em ordem crescente de página):
    // 1. Empregador: [6-6] -> [6-7]
    { block: empregador, pageStart: 6, pageEnd: 7, title: "Empregador, Empregado..." },
    // 2. Contrato de Trabalho: [7-10] -> [8-11]
    { block: contrato, pageStart: 8, pageEnd: 11, title: "Contrato de Trabalho..." },
    // 3. Remuneração: [11-13] -> [12-13]
    { block: remuneracao, pageStart: 12, pageEnd: 13, title: "Remuneração" },
    // 4. Rescisão: [19-21] -> [19-22]
    { block: rescisao, pageStart: 19, pageEnd: 22, title: "Rescisão..." },
    // 5. Tutelas Especiais: [22-23] -> [23-24]
    { block: tutelasEsp, pageStart: 23, pageEnd: 24, title: "Tutelas Especiais" },
    // 6. Responsabilidade Trabalhista: [24-24] -> [25-25]
    { block: respTrab, pageStart: 25, pageEnd: 25, title: "Responsabilidade Trabalhista" },
    // 7. Convenções Coletivas: [25-25] -> [26-27]
    { block: convColetivas, pageStart: 26, pageEnd: 27, title: "Convenções Coletivas..." },
    // 8. Prescrição: [26-26] -> [27-27]
    { block: prescricao, pageStart: 27, pageEnd: 27, title: "Prescrição" }
  ];

  for (const u of updates) {
    if (!u.block) {
      console.log(` ❌ ERRO: Bloco não encontrado: ${u.title}`);
      continue;
    }

    const { error } = await supabase
      .from("StudyBlock")
      .update({ pageStart: u.pageStart, pageEnd: u.pageEnd })
      .eq("id", u.block.id);

    if (error) {
      console.log(` ❌ Erro ao atualizar ${u.title}: ${error.message}`);
    } else {
      console.log(` ✅ Atualizado '${u.title}' (${u.block.id}): [${u.block.pageStart}–${u.block.pageEnd}] ➔ [${u.pageStart}–${u.pageEnd}]`);
    }
  }

  console.log("\n======================================================================");
  console.log("    ATUALIZAÇÕES CONCLUÍDAS COM SUCESSO                                ");
  console.log("======================================================================\n");
}

main().catch(console.error);
