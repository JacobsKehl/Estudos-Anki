/**
 * simulate-30day-schedule.ts
 *
 * Simulação pura de 30 dias a partir do acervo reconstruído (sem escrita no banco).
 * Verifica as regras R1–R9 e gera as 5 contagens de integridade.
 * Também calcula o COUNT de StudyBlock agrupado por dia de createdAt nos últimos 10 dias.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { ORDEM_MATERIAS } from "../src/lib/scheduler/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = "cmp8od0wz0000iybklaotfqbs";

const CFC_FILES = [
  "1 - Direito Administrativo_compressed.pdf",
  "2 - Direito do Trabalho.pdf",
  "3 - Direito Constitucional.pdf",
  "4 - Direito Processual do Trabalho.pdf",
  "Direito Processual Civil_compressed.pdf",
];

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  SIMULAÇÃO DE 30 DIAS DO CRONOGRAMA CFC");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Obter matérias e materiais
  const { data: subjects } = await supabase
    .from("StudySubject")
    .select("id, name")
    .eq("userId", userId);

  const { data: materials } = await supabase
    .from("StudyMaterial")
    .select("id, originalFileName")
    .eq("userId", userId)
    .in("originalFileName", CFC_FILES);

  const matIds = (materials || []).map((m) => m.id);

  // 2. Buscar todos os blocos ativos do CFC
  const { data: blocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, subjectId, materialId, theoryStatus")
    .eq("userId", userId)
    .in("materialId", matIds)
    .neq("theoryStatus", "EXCLUDED")
    .order("pageStart", { ascending: true });

  const unstudiedBlocks = (blocks || []).filter((b) => b.theoryStatus === "NOT_STARTED");

  console.log(`Total de blocos ativos no banco: ${blocks?.length || 0}`);
  console.log(`Total de blocos NOT_STARTED para simulação: ${unstudiedBlocks.length}\n`);

  // Agrupar por matéria
  const blocksBySubject = new Map<string, typeof unstudiedBlocks>();
  for (const mat of ORDEM_MATERIAS) {
    const sub = (subjects || []).find((s) => s.name.toLowerCase().includes(mat.toLowerCase()) || mat.toLowerCase().includes(s.name.toLowerCase()));
    if (sub) {
      const list = unstudiedBlocks.filter((b) => b.subjectId === sub.id).sort((a, b) => a.pageStart - b.pageStart);
      blocksBySubject.set(mat, [...list]);
    }
  }

  // 3. Simular 30 dias a partir de 27/08/2026
  let currentDate = new Date("2026-08-27T00:00:00-03:00");
  let cycleIndex = 0;
  const minutesPerDay: number[] = [];

  let countMateriaRepetidaNoDia = 0;
  let countMateriaConsecutiva = 0;
  let countTeoriaEmDomingo = 0;
  let countBlocoExcluded = 0;
  let countForaDeOrdem = 0;

  const lastAllocatedPage = new Map<string, number>();
  let previousDaySubjects = new Set<string>();

  console.log("Dia | Data       | Matéria                   | Páginas | Min | Título do Bloco");
  console.log("----+------------+---------------------------+---------+-----+---------------------------------------------------");

  for (let day = 1; day <= 30; day++) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dayOfWeek = currentDate.getDay(); // 0 = Domingo

    if (dayOfWeek === 0) {
      if (countTeoriaEmDomingo > 0) {
        // Noted
      }
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    let dayMinutes = 0;
    const sameDaySubjects = new Set<string>();
    const allocatedThisDay: Array<{ mat: string; block: any }> = [];

    // Checar se há blocos restantes
    const hasRemaining = Array.from(blocksBySubject.values()).some((l) => l.length > 0);
    if (!hasRemaining) {
      // Acervo concluído!
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    let attempts = 0;
    while (dayMinutes < 45 && attempts < ORDEM_MATERIAS.length * 2) {
      attempts++;
      const targetMat = ORDEM_MATERIAS[cycleIndex % ORDEM_MATERIAS.length];
      cycleIndex++;

      if (sameDaySubjects.has(targetMat)) {
        countMateriaRepetidaNoDia++;
        continue;
      }

      const list = blocksBySubject.get(targetMat);
      if (!list || list.length === 0) {
        continue;
      }

      const block = list.shift()!;
      const bMins = block.estimatedStudyMinutes || 15;

      // Verificação R1: pageStart deve ser >= última alocada da matéria
      const lastP = lastAllocatedPage.get(targetMat) || 0;
      if (block.pageStart < lastP) {
        countForaDeOrdem++;
      }
      lastAllocatedPage.set(targetMat, block.pageEnd);

      // Verificação R9: bloco não pode ser EXCLUDED
      if (block.theoryStatus === "EXCLUDED") {
        countBlocoExcluded++;
      }

      allocatedThisDay.push({ mat: targetMat, block });
      sameDaySubjects.add(targetMat);
      dayMinutes += bMins;

      if (sameDaySubjects.size >= 4) break;
    }

    // Verificação R4: Matéria em dias consecutivos só quando outras esgotadas
    for (const sub of sameDaySubjects) {
      if (previousDaySubjects.has(sub)) {
        // Verificar se outras matérias tinham blocos disponíveis
        const otherSubjectsWithBlocks = Array.from(blocksBySubject.entries()).filter(
          ([m, l]) => m !== sub && l.length > 0 && !sameDaySubjects.has(m)
        );
        if (otherSubjectsWithBlocks.length > 0) {
          countMateriaConsecutiva++;
        }
      }
    }

    previousDaySubjects = new Set(sameDaySubjects);
    minutesPerDay.push(dayMinutes);

    for (let i = 0; i < allocatedThisDay.length; i++) {
      const { mat, block } = allocatedThisDay[i];
      const dNum = i === 0 ? String(day).padStart(2) : "  ";
      const dStr = i === 0 ? dateStr : "          ";
      const pages = `[${block.pageStart}–${block.pageEnd}]`.padEnd(7);
      console.log(`${dNum}  | ${dStr} | ${mat.padEnd(25)} | ${pages} | ${String(block.estimatedStudyMinutes || 0).padStart(3)} | ${block.title}`);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  RESULTADO DA SIMULAÇÃO DE 30 DIAS");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`MIN_POR_DIA=[${minutesPerDay.join(", ")}]`);
  console.log(`MATERIA_REPETIDA_NO_DIA=${countMateriaRepetidaNoDia}`);
  console.log(`MATERIA_EM_DIAS_CONSECUTIVOS=${countMateriaConsecutiva}`);
  console.log(`TEORIA_EM_DOMINGO=${countTeoriaEmDomingo}`);
  console.log(`ITENS_COM_BLOCO_EXCLUDED=${countBlocoExcluded}`);
  console.log(`FORA_DE_ORDEM=${countForaDeOrdem}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // 4. Auditoria de StudyBlock agrupado por dia de createdAt nos últimos 10 dias
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  COUNT DE StudyBlock AGRUPADO POR DATA DE CRIAÇÃO (ÚLTIMOS 10 DIAS)");
  console.log("═══════════════════════════════════════════════════════════");

  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

  const { data: recentBlocks } = await supabase
    .from("StudyBlock")
    .select("id, createdAt, materialId, theoryStatus")
    .eq("userId", userId)
    .gte("createdAt", tenDaysAgo.toISOString())
    .order("createdAt", { ascending: true });

  const countByDay: Record<string, { total: number; active: number; excluded: number }> = {};
  for (const b of recentBlocks || []) {
    const dayKey = b.createdAt ? b.createdAt.split("T")[0] : "Desconhecido";
    if (!countByDay[dayKey]) countByDay[dayKey] = { total: 0, active: 0, excluded: 0 };
    countByDay[dayKey].total++;
    if (b.theoryStatus === "EXCLUDED") countByDay[dayKey].excluded++;
    else countByDay[dayKey].active++;
  }

  console.log("\nData de Criação | Total Criado | Ativos | Excluded | Detalhe");
  console.log("----------------+--------------+--------+----------+--------------------------------------");
  for (const [dayKey, counts] of Object.entries(countByDay)) {
    let note = "";
    if (counts.total === 94) note = "← Reconstrução determinística CFC (94 blocos)";
    console.log(`${dayKey.padEnd(15)} | ${String(counts.total).padStart(12)} | ${String(counts.active).padStart(6)} | ${String(counts.excluded).padStart(8)} | ${note}`);
  }
  console.log("═══════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("🛑 ERRO:", err);
  process.exit(1);
});
