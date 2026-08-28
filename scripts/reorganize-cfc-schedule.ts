/**
 * reorganize-cfc-schedule.ts
 *
 * Reorganiza o cronograma ativo com base no novo acervo determinístico do CFC.
 * Implementa as regras de rodízio R1–R9 via cliente Supabase PostgREST.
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
  console.log("  REORGANIZAÇÃO DETERMINÍSTICA DO CRONOGRAMA CFC");
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

  // 2. Buscar todos os blocos NOT_STARTED do CFC ordenados por pageStart crescente
  const { data: unstudiedBlocks, error: bErr } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, subjectId, materialId, orderIndex")
    .eq("userId", userId)
    .eq("theoryStatus", "NOT_STARTED")
    .in("materialId", matIds)
    .order("pageStart", { ascending: true });

  if (bErr) throw bErr;

  console.log(`📊 Blocos NOT_STARTED disponíveis para agendamento: ${unstudiedBlocks?.length || 0}`);

  // Agrupar blocos por nome de matéria na ordem canônica
  const subjectIdMap = new Map<string, string>();
  for (const s of subjects || []) {
    subjectIdMap.set(s.name.toLowerCase().trim(), s.id);
  }

  const blocksBySubjectName = new Map<string, typeof unstudiedBlocks>();
  for (const matName of ORDEM_MATERIAS) {
    const sub = (subjects || []).find((s) => s.name.toLowerCase().includes(matName.toLowerCase()) || matName.toLowerCase().includes(s.name.toLowerCase()));
    if (sub) {
      const bList = (unstudiedBlocks || []).filter((b) => b.subjectId === sub.id).sort((a, b) => a.pageStart - b.pageStart);
      blocksBySubjectName.set(matName, bList);
      console.log(`   - ${matName.padEnd(32)}: ${bList.length} blocos (${bList.reduce((acc, b) => acc + (b.estimatedStudyMinutes || 0), 0)} min)`);
    }
  }

  // 3. Obter ou criar cronograma ativo
  const { data: activeSchedules } = await supabase
    .from("StudySchedule")
    .select("id, title")
    .eq("userId", userId)
    .eq("status", "ACTIVE")
    .order("createdAt", { ascending: false });

  let scheduleId = activeSchedules?.[0]?.id;

  if (!scheduleId) {
    scheduleId = `cmss_sch_${Date.now()}`;
    await supabase.from("StudySchedule").insert({
      id: scheduleId,
      userId,
      title: "Cronograma Ativo CFC Reconstruído",
      dailyStudyMinutes: 120,
      startDate: new Date().toISOString(),
      status: "ACTIVE",
    });
    console.log(`✅ Novo cronograma ativo criado: ${scheduleId}`);
  } else {
    console.log(`📌 Cronograma ativo existente: ${scheduleId}`);
  }

  // 4. Limpar itens pendentes antigos de teoria que apontavam para blocos do CFC
  const { data: oldItems } = await supabase
    .from("StudyScheduleItem")
    .select("id")
    .eq("userId", userId)
    .eq("scheduleId", scheduleId)
    .eq("actionType", "THEORY")
    .eq("status", "PENDING");

  if (oldItems && oldItems.length > 0) {
    const oldIds = oldItems.map((i) => i.id);
    await supabase.from("StudyScheduleItem").update({ status: "SKIPPED" }).in("id", oldIds);
    console.log(`🧹 Marcados ${oldIds.length} itens THEORY PENDING antigos como SKIPPED no cronograma.`);
  }

  // 5. Alocar novos blocos a partir de hoje (27/08/2026)
  // Regras:
  // - Dias úteis (Seg-Sáb): folga aos domingos
  // - Fila circular segundo ORDEM_MATERIAS
  // - Cota diária: 2 a 3 blocos até ~45 min (ou até esgotar matérias)
  // - Anti-repetição de matéria no mesmo dia (R3)

  const itemsToInsert: any[] = [];
  let currentDate = new Date("2026-08-27T00:00:00-03:00");
  let dayNumber = 1;
  let cycleIndex = 0;
  let counter = 1;

  const hasRemainingBlocks = () => {
    for (const list of blocksBySubjectName.values()) {
      if (list.length > 0) return true;
    }
    return false;
  };

  while (hasRemainingBlocks()) {
    // Verificar domingo
    const dayOfWeek = currentDate.getDay(); // 0 = Domingo
    const dateStr = currentDate.toISOString().split("T")[0];

    if (dayOfWeek === 0) {
      // Domingo: sem teoria (R5)
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    let dayTheoryMinutes = 0;
    const sameDaySubjects = new Set<string>();

    // Rodízio circular
    let attempts = 0;
    while (dayTheoryMinutes < 45 && attempts < ORDEM_MATERIAS.length * 2) {
      attempts++;
      const targetMat = ORDEM_MATERIAS[cycleIndex % ORDEM_MATERIAS.length];
      cycleIndex++;

      if (sameDaySubjects.has(targetMat)) {
        continue; // R3: Nunca duas da mesma matéria no dia
      }

      const list = blocksBySubjectName.get(targetMat);
      if (!list || list.length === 0) {
        continue; // R7: Matéria esgotada sai em silêncio
      }

      const block = list.shift()!; // R1: pageStart crescente
      const bMins = block.estimatedStudyMinutes || 15;

      const itemId = `cmitem_${Date.now()}_${counter++}`;
      itemsToInsert.push({
        id: itemId,
        userId,
        scheduleId,
        subjectId: block.subjectId,
        studyBlockId: block.id,
        actionType: "THEORY",
        priorityScore: 90,
        reason: `Roteiro CFC: Teoria de ${targetMat}`,
        dayNumber,
        scheduledDate: `${dateStr}T10:00:00.000Z`,
        estimatedMinutes: bMins,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      sameDaySubjects.add(targetMat);
      dayTheoryMinutes += bMins;

      // Limite de 4 blocos/dia
      if (sameDaySubjects.size >= 4) break;
    }

    currentDate.setDate(currentDate.getDate() + 1);
    dayNumber++;
  }

  // 6. Inserir itens em lotes de 50
  console.log(`\n📝 Inserindo ${itemsToInsert.length} novos itens de teoria no cronograma...`);
  const BATCH_SIZE = 50;
  for (let i = 0; i < itemsToInsert.length; i += BATCH_SIZE) {
    const batch = itemsToInsert.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("StudyScheduleItem").insert(batch);
    if (error) throw error;
  }
  console.log(`✅ ${itemsToInsert.length} itens inseridos com sucesso!\n`);

  // 7. Imprimir os próximos 7 dias
  console.log("══════════════════════════════════════════════════════════════════════════════════════════════");
  console.log("  GRADE DOS PRÓXIMOS 7 DIAS");
  console.log("══════════════════════════════════════════════════════════════════════════════════════════════");

  const start7 = new Date("2026-08-27T00:00:00-03:00");
  const end7 = new Date(start7);
  end7.setDate(end7.getDate() + 7);

  const { data: next7Items } = await supabase
    .from("StudyScheduleItem")
    .select(`
      id,
      dayNumber,
      scheduledDate,
      actionType,
      status,
      estimatedMinutes,
      studyBlockId,
      StudyBlock:studyBlockId (
        id,
        title,
        pageStart,
        pageEnd,
        theoryStatus
      ),
      StudySubject:subjectId (
        name
      )
    `)
    .eq("userId", userId)
    .eq("scheduleId", scheduleId)
    .neq("status", "SKIPPED")
    .gte("scheduledDate", start7.toISOString())
    .lte("scheduledDate", end7.toISOString())
    .order("scheduledDate", { ascending: true })
    .order("dayNumber", { ascending: true });

  console.log("\nData       | Dia | Ação              | Matéria                   | Status Bloco | Págs    | Título do Bloco");
  console.log("-----------+-----+-------------------+---------------------------+--------------+---------+----------------------------------------------");

  let excludedFound = 0;
  for (const item of next7Items || []) {
    const dateStr = item.scheduledDate ? item.scheduledDate.split("T")[0] : "Sem Data";
    const action = (item.actionType || "").padEnd(17);
    const subjectName = ((item.StudySubject as any)?.name || "Sem Matéria").padEnd(25);
    const block = (item.StudyBlock as any);
    const bStatus = (block?.theoryStatus || "N/A").padEnd(12);
    const pages = block ? `[${block.pageStart}–${block.pageEnd}]`.padEnd(7) : "       ";
    const title = block?.title || (item.actionType === "REVIEW_FLASHCARDS" ? "Sessão diária SRS" : "Sem Bloco");

    if (block?.theoryStatus === "EXCLUDED") {
      excludedFound++;
    }

    console.log(`${dateStr} | ${String(item.dayNumber).padStart(3)} | ${action} | ${subjectName} | ${bStatus} | ${pages} | ${title}`);
  }

  console.log("══════════════════════════════════════════════════════════════════════════════════════════════");
  console.log(`Total de itens nos 7 dias: ${next7Items?.length || 0}`);
  console.log(`Itens apontando para bloco EXCLUDED: ${excludedFound} (esperado: 0)`);
  console.log("══════════════════════════════════════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("🛑 ERRO:", err);
  process.exit(1);
});
