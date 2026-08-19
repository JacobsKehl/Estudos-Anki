import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("======================================================================");
  console.log("    CORREÇÃO COMPLETA DE LACUNAS E SOBREPOSIÇÕES NOS BLOCOS          ");
  console.log("======================================================================\n");

  // 1. Corrigir lacuna da página 89 em Direito Administrativo (Lei 8.112 -> pageEnd: 89)
  const lei8112Id = "cmss35if4000piyao90mqrh43";
  const { error: err1 } = await supabase
    .from("StudyBlock")
    .update({ pageEnd: 89, estimatedStudyMinutes: 45 })
    .eq("id", lei8112Id);

  if (err1) console.error("Erro ao atualizar Lei 8.112:", err1);
  else console.log("✅ Lacuna da Página 89 Zerada: Bloco Lei 8.112/90 estendido para pp. 75–89 (15 págs, 45 min).");

  // 2. Corrigir sobreposição da página 19 em Processual do Trabalho
  const recursosId = "cmss361lj004hiyaodwrvf1xa";
  const prescricaoId = "cmss361vd004jiyao8r2h6cd9";
  const jurisprudenciaId = "cmss362ay004niyao0hismb0p";

  // Recursos Trabalhistas: 16–19
  await supabase.from("StudyBlock").update({ pageStart: 16, pageEnd: 19 }).eq("id", recursosId);
  // Prescrição: 20–20
  await supabase.from("StudyBlock").update({ pageStart: 20, pageEnd: 20 }).eq("id", prescricaoId);
  // Jurisprudências: 21–34
  await supabase.from("StudyBlock").update({ pageStart: 21, pageEnd: 34 }).eq("id", jurisprudenciaId);

  console.log("✅ Sobreposição de Processual do Trabalho Zerada:");
  console.log(" • Recursos Trabalhistas: pp. 16–19");
  console.log(" • Prescrição: pp. 20–20");
  console.log(" • Jurisprudências: pp. 21–34\n");
}

main();
