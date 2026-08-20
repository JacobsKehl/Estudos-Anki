/**
 * apply-cfc-absolute-realignment.ts
 *
 * Realinhamento Absoluto e Idempotente dos 58 Blocos do CFC.
 *
 * Regras:
 * 1. Mapeamento estrito por blockId -> { pageStart, pageEnd, estimatedStudyMinutes } em valores ABSOLUTOS (nunca deltas).
 * 2. Asserção prévia de limites (pageStart >= primeiraPáginaConteudo, pageEnd <= numPages) — aborta se violado.
 * 3. Recálculo dos minutos com a regra unificada: Math.max(páginas * 3, 15).
 * 4. Relatório de minutos antes vs. depois.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface MaterialBounds {
  numPages: number;
  firstContentPage: number;
}

const MATERIAL_BOUNDS: Record<string, MaterialBounds> = {
  "1 - Direito Administrativo_compressed.pdf": { numPages: 152, firstContentPage: 6 },
  "2 - Direito do Trabalho.pdf": { numPages: 38, firstContentPage: 4 },
  "3 - Direito Constitucional.pdf": { numPages: 86, firstContentPage: 4 },
  "4 - Direito Processual do Trabalho.pdf": { numPages: 30, firstContentPage: 3 },
  "Direito Processual Civil_compressed.pdf": { numPages: 76, firstContentPage: 4 },
};

interface AbsoluteTarget {
  pdf: string;
  titleMatch: string;
  pageStart: number;
  pageEnd: number;
}

const ABSOLUTE_TARGETS: AbsoluteTarget[] = [
  // === 1 - Direito Administrativo_compressed.pdf (16) ===
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "Glossário de Siglas", pageStart: 6, pageEnd: 7 },
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "Conceitos e Fontes do Direito Administrativo", pageStart: 8, pageEnd: 16 },
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "Atos Administrativos", pageStart: 17, pageEnd: 25 },
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "Organização da Administração Pública e Tercei", pageStart: 26, pageEnd: 30 },
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "Serviços Públicos", pageStart: 31, pageEnd: 39 },
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "Responsabilidade Civil do Estado", pageStart: 40, pageEnd: 49 },
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "Lei 9.784", pageStart: 50, pageEnd: 56 },
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "Bens Públicos", pageStart: 57, pageEnd: 63 },
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "Lei 12.527", pageStart: 64, pageEnd: 67 },
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "Agentes Públicos", pageStart: 68, pageEnd: 75 },
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "Lei 8.112", pageStart: 76, pageEnd: 89 },
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "Licitações (Fases", pageStart: 90, pageEnd: 103 },
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "Licitações (Modalidades", pageStart: 104, pageEnd: 116 },
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "Nova Lei de Licitações (Parte de C", pageStart: 117, pageEnd: 130 },
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "Improbidade", pageStart: 131, pageEnd: 140 },
  { pdf: "1 - Direito Administrativo_compressed.pdf", titleMatch: "LGPD", pageStart: 141, pageEnd: 151 },

  // === 2 - Direito do Trabalho.pdf (12) ===
  { pdf: "2 - Direito do Trabalho.pdf", titleMatch: "Princípios e Fontes do Direito do Trabalho", pageStart: 4, pageEnd: 6 },
  { pdf: "2 - Direito do Trabalho.pdf", titleMatch: "Empregador, Empregado", pageStart: 7, pageEnd: 7 },
  { pdf: "2 - Direito do Trabalho.pdf", titleMatch: "Contrato de Trabalho", pageStart: 8, pageEnd: 11 },
  { pdf: "2 - Direito do Trabalho.pdf", titleMatch: "Remuneração", pageStart: 12, pageEnd: 14 },
  { pdf: "2 - Direito do Trabalho.pdf", titleMatch: "Duração do Trabalho", pageStart: 15, pageEnd: 16 },
  { pdf: "2 - Direito do Trabalho.pdf", titleMatch: "Teletrabalho", pageStart: 17, pageEnd: 17 },
  { pdf: "2 - Direito do Trabalho.pdf", titleMatch: "Férias Anuais", pageStart: 18, pageEnd: 19 },
  { pdf: "2 - Direito do Trabalho.pdf", titleMatch: "Rescisão do Contrato", pageStart: 20, pageEnd: 22 },
  { pdf: "2 - Direito do Trabalho.pdf", titleMatch: "Tutelas Especiais", pageStart: 23, pageEnd: 24 },
  { pdf: "2 - Direito do Trabalho.pdf", titleMatch: "Responsabilidade Trabalhista", pageStart: 25, pageEnd: 25 },
  { pdf: "2 - Direito do Trabalho.pdf", titleMatch: "Convenções Coletivas", pageStart: 26, pageEnd: 27 },
  { pdf: "2 - Direito do Trabalho.pdf", titleMatch: "Jurisprudências", pageStart: 28, pageEnd: 37 },

  // === 3 - Direito Constitucional.pdf (12) ===
  { pdf: "3 - Direito Constitucional.pdf", titleMatch: "Aspectos Introdutórios", pageStart: 4, pageEnd: 8 },
  { pdf: "3 - Direito Constitucional.pdf", titleMatch: "Princípios Fundamentais", pageStart: 9, pageEnd: 9 },
  { pdf: "3 - Direito Constitucional.pdf", titleMatch: "Direitos e Garantias Fundamentais", pageStart: 10, pageEnd: 25 },
  { pdf: "3 - Direito Constitucional.pdf", titleMatch: "Organização do Estado", pageStart: 26, pageEnd: 32 },
  { pdf: "3 - Direito Constitucional.pdf", titleMatch: "Administração Pública", pageStart: 33, pageEnd: 42 },
  { pdf: "3 - Direito Constitucional.pdf", titleMatch: "Poder Legislativo", pageStart: 43, pageEnd: 55 },
  { pdf: "3 - Direito Constitucional.pdf", titleMatch: "Poder Executivo", pageStart: 56, pageEnd: 60 },
  { pdf: "3 - Direito Constitucional.pdf", titleMatch: "Poder Judiciário", pageStart: 61, pageEnd: 68 },
  { pdf: "3 - Direito Constitucional.pdf", titleMatch: "Funções Essenciais", pageStart: 69, pageEnd: 71 },
  { pdf: "3 - Direito Constitucional.pdf", titleMatch: "Defesa do Estado", pageStart: 72, pageEnd: 73 },
  { pdf: "3 - Direito Constitucional.pdf", titleMatch: "Ordem Social", pageStart: 74, pageEnd: 77 },
  { pdf: "3 - Direito Constitucional.pdf", titleMatch: "Controle de Constitucionalidade", pageStart: 78, pageEnd: 85 },

  // === 4 - Direito Processual do Trabalho.pdf (7) ===
  { pdf: "4 - Direito Processual do Trabalho.pdf", titleMatch: "Organização da Justiça do Trabalho", pageStart: 3, pageEnd: 5 },
  { pdf: "4 - Direito Processual do Trabalho.pdf", titleMatch: "Do Processo em Geral", pageStart: 6, pageEnd: 10 },
  { pdf: "4 - Direito Processual do Trabalho.pdf", titleMatch: "Dissídios Individuais", pageStart: 11, pageEnd: 14 },
  { pdf: "4 - Direito Processual do Trabalho.pdf", titleMatch: "Da Execução", pageStart: 15, pageEnd: 16 },
  { pdf: "4 - Direito Processual do Trabalho.pdf", titleMatch: "Recursos Trabalhistas", pageStart: 17, pageEnd: 19 },
  { pdf: "4 - Direito Processual do Trabalho.pdf", titleMatch: "Prescrição no Direito Processual", pageStart: 20, pageEnd: 20 },
  { pdf: "4 - Direito Processual do Trabalho.pdf", titleMatch: "Jurisprudências", pageStart: 21, pageEnd: 29 },

  // === Direito Processual Civil_compressed.pdf (11) ===
  { pdf: "Direito Processual Civil_compressed.pdf", titleMatch: "Introdução", pageStart: 4, pageEnd: 5 },
  { pdf: "Direito Processual Civil_compressed.pdf", titleMatch: "Da Função Jurisdicional", pageStart: 6, pageEnd: 10 },
  { pdf: "Direito Processual Civil_compressed.pdf", titleMatch: "Partes", pageStart: 11, pageEnd: 17 },
  { pdf: "Direito Processual Civil_compressed.pdf", titleMatch: "Juiz e dos Auxiliares", pageStart: 18, pageEnd: 22 },
  { pdf: "Direito Processual Civil_compressed.pdf", titleMatch: "Atos Processuais", pageStart: 23, pageEnd: 31 },
  { pdf: "Direito Processual Civil_compressed.pdf", titleMatch: "Tutela Provisória", pageStart: 32, pageEnd: 34 },
  { pdf: "Direito Processual Civil_compressed.pdf", titleMatch: "Procedimento Comum", pageStart: 35, pageEnd: 47 },
  { pdf: "Direito Processual Civil_compressed.pdf", titleMatch: "Cumprimento da Sentença", pageStart: 48, pageEnd: 51 },
  { pdf: "Direito Processual Civil_compressed.pdf", titleMatch: "Processo de Execução", pageStart: 52, pageEnd: 54 },
  { pdf: "Direito Processual Civil_compressed.pdf", titleMatch: "Meios de Impugnação", pageStart: 55, pageEnd: 66 },
  { pdf: "Direito Processual Civil_compressed.pdf", titleMatch: "Tabela Auxiliar de Prazos", pageStart: 67, pageEnd: 75 },
];

async function main() {
  console.log("=================================================================");
  console.log("  PASSO 3: REALINHAMENTO ABSOLUTO DOS 58 BLOCOS CFC NO SUPABASE");
  console.log("=================================================================\n");

  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const { data: allBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, theoryStatus, StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId);

  // 1. Validar pre-condições e compilar a lista de atualizações
  const updates: Array<{ id: string; title: string; pdf: string; oldStart: number; oldEnd: number; oldMins: number; newStart: number; newEnd: number; newMins: number }> = [];

  let totalMinsBefore = 0;
  let totalMinsAfter = 0;

  for (const target of ABSOLUTE_TARGETS) {
    const bounds = MATERIAL_BOUNDS[target.pdf];
    if (!bounds) {
      throw new Error(`🛑 ERRO DE CONFIGURAÇÃO: PDF '${target.pdf}' sem limites definidos.`);
    }

    // Asserção estrita de limites
    if (target.pageStart < bounds.firstContentPage) {
      throw new Error(`🛑 ASSERÇÃO FALHOU: ${target.pdf} - '${target.titleMatch}' pageStart ${target.pageStart} < primeira página de conteúdo ${bounds.firstContentPage}`);
    }
    if (target.pageEnd > bounds.numPages) {
      throw new Error(`🛑 ASSERÇÃO FALHOU: ${target.pdf} - '${target.titleMatch}' pageEnd ${target.pageEnd} > numPages ${bounds.numPages}`);
    }

    const block = (allBlocks || []).find(b =>
      (b as any).StudyMaterial?.originalFileName === target.pdf &&
      b.title.includes(target.titleMatch) &&
      b.theoryStatus !== "EXCLUDED"
    );

    if (!block) {
      throw new Error(`🛑 BLOCO NÃO ENCONTRADO NO BANCO: ${target.pdf} - '${target.titleMatch}'`);
    }

    const pages = target.pageEnd - target.pageStart + 1;
    const newMins = Math.max(pages * 3, 15);

    totalMinsBefore += block.estimatedStudyMinutes || 0;
    totalMinsAfter += newMins;

    updates.push({
      id: block.id,
      title: block.title,
      pdf: target.pdf,
      oldStart: block.pageStart,
      oldEnd: block.pageEnd,
      oldMins: block.estimatedStudyMinutes || 0,
      newStart: target.pageStart,
      newEnd: target.pageEnd,
      newMins,
    });
  }

  console.log(`✅ ASSERÇÕES PRÉVIAS PASSARAM: 58/58 blocos dentro dos limites físicos [firstContentPage..numPages]`);
  console.log(`   Minutos totais dos 58 blocos CFC:`);
  console.log(`   - Antes do realinhamento:  ${totalMinsBefore} min (${(totalMinsBefore / 60).toFixed(1)} h)`);
  console.log(`   - Depois do realinhamento: ${totalMinsAfter} min (${(totalMinsAfter / 60).toFixed(1)} h)`);
  console.log(`   - Diferença líquida:       ${totalMinsAfter - totalMinsBefore} min\n`);

  console.log("-----------------------------------------------------------------");
  console.log("  EXECUTANDO ATUALIZAÇÕES ABSOLUTAS POR BLOCK ID (IDEMPOTENTE)");
  console.log("-----------------------------------------------------------------\n");

  let updatedCount = 0;

  for (const u of updates) {
    const { error } = await supabase
      .from("StudyBlock")
      .update({
        pageStart: u.newStart,
        pageEnd: u.newEnd,
        estimatedStudyMinutes: u.newMins,
      })
      .eq("id", u.id);

    if (error) {
      throw new Error(`🛑 FALHA AO ATUALIZAR BLOCO ${u.id} (${u.title}): ${error.message}`);
    }

    updatedCount++;
    const changed = u.oldStart !== u.newStart || u.oldEnd !== u.newEnd || u.oldMins !== u.newMins;
    if (changed) {
      console.log(`  [UPDATED] ${u.pdf.substring(0, 18)} | ${u.title.substring(0, 40).padEnd(40)} | [${u.oldStart}–${u.oldEnd}] (${u.oldMins}m) → [${u.newStart}–${u.newEnd}] (${u.newMins}m)`);
    } else {
      console.log(`  [NO-CHANGE] ${u.pdf.substring(0, 18)} | ${u.title.substring(0, 40).padEnd(40)} | Já em [${u.newStart}–${u.newEnd}] (${u.newMins}m)`);
    }
  }

  console.log(`\n=================================================================`);
  console.log(`  SUCESSO: ${updatedCount}/58 blocos atualizados com sucesso no banco!`);
  console.log(`=================================================================\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
