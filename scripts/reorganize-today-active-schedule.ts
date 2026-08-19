import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const cfcFileNames = [
  "1 - Direito Administrativo_compressed.pdf",
  "3 - Direito Constitucional_compressed.pdf",
  "3 - Direito Constitucional.pdf",
  "Direito Processual Civil_compressed.pdf",
  "4 - Direito Processual do Trabalho.pdf",
  "2 - Direito do Trabalho.pdf"
];

async function main() {
  console.log("======================================================================");
  console.log("    EXECUTANDO REORGANIZAÇÃO DO CRONOGRAMA DA GABRIELA (HOJE 19/08)   ");
  console.log("======================================================================\n");

  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  if (!user) {
    console.error("Usuária não encontrada");
    return;
  }
  const userId = user.id;

  // 1. Obter materiais do CFC
  const { data: cfcMaterials } = await supabase
    .from("StudyMaterial")
    .select("id, originalFileName")
    .in("originalFileName", cfcFileNames);

  const cfcMaterialIds = (cfcMaterials || []).map(m => m.id);

  // 2. Obter matérias ativas
  const { data: activeSubjects } = await supabase
    .from("StudySubject")
    .select("id, name")
    .eq("userId", userId)
    .not("studyPriority", "in", '("SECONDARY","EXCLUDED")');

  // 3. Buscar todos os blocos inéditos do CFC (theoryStatus = 'NOT_STARTED', sourceV1BlockId = null, possiblyAlreadyStudied = false)
  const { data: unstudiedBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, subjectId, materialId, orderIndex, createdAt, StudySubject:subjectId(name), StudyMaterial:materialId(originalFileName)")
    .eq("userId", userId)
    .eq("theoryStatus", "NOT_STARTED")
    .is("sourceV1BlockId", null)
    .eq("possiblyAlreadyStudied", false)
    .in("materialId", cfcMaterialIds)
    .order("orderIndex", { ascending: true })
    .order("createdAt", { ascending: true });

  console.log(`Total de blocos inéditos do CFC disponíveis: ${unstudiedBlocks?.length || 0}`);

  if (!unstudiedBlocks || unstudiedBlocks.length === 0) {
    console.log("Nenhum bloco inédito pendente.");
    return;
  }

  // 4. Desativar/Arquivar cronogramas anteriores
  await supabase
    .from("StudySchedule")
    .update({ status: "ARCHIVED" })
    .eq("userId", userId)
    .eq("status", "ACTIVE");

  // 5. Criar novo Cronograma Ativo
  const todayStr = "2026-08-19";
  const startDate = `${todayStr}T00:00:00.000Z`;
  const scheduleId = `cmss_sch_${Date.now()}`;

  const { data: newSchedule, error: schErr } = await supabase
    .from("StudySchedule")
    .insert({
      id: scheduleId,
      userId,
      title: "Cronograma Ativo CFC 2026",
      dailyStudyMinutes: 120,
      startDate,
      status: "ACTIVE",
      updatedAt: new Date().toISOString()
    })
    .select()
    .single();

  if (schErr || !newSchedule) {
    console.error("Erro ao criar StudySchedule:", schErr);
    return;
  }

  console.log(`✅ Novo Cronograma Ativo Criado (ID: ${newSchedule.id})\n`);

  // 6. Alocar blocos inéditos (2 por dia, pulando domingos)
  const scheduleItemsToInsert: any[] = [];
  let currentDate = new Date("2026-08-19T10:00:00Z");
  let blockIndex = 0;
  let dayNumber = 1;
  let itemCounter = 1;

  while (blockIndex < unstudiedBlocks.length) {
    // Checar se o dia de São Paulo é domingo (0)
    const spDay = new Date(currentDate.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay();
    if (spDay === 0) {
      // Domingo: Folga de teoria!
      currentDate.setDate(currentDate.getDate() + 1);
      dayNumber++;
      continue;
    }

    // Alocar até 2 blocos para o dia
    const dayBlocks = unstudiedBlocks.slice(blockIndex, blockIndex + 2);
    const dateStr = currentDate.toISOString().substring(0, 10);

    for (const block of dayBlocks) {
      const estimatedMins = block.estimatedStudyMinutes ?? 35;
      const itemId = `cmss_item_${Date.now()}_${itemCounter++}`;
      scheduleItemsToInsert.push({
        id: itemId,
        userId,
        scheduleId: newSchedule.id,
        subjectId: block.subjectId,
        studyBlockId: block.id,
        actionType: "THEORY",
        priorityScore: 80,
        reason: `Roteiro CFC: Teoria de ${(block.StudySubject as any)?.name || 'CFC'}`,
        dayNumber,
        scheduledDate: `${dateStr}T10:00:00.000Z`,
        estimatedMinutes: estimatedMins,
        status: "PENDING",
        updatedAt: new Date().toISOString()
      });
    }

    blockIndex += dayBlocks.length;
    currentDate.setDate(currentDate.getDate() + 1);
    dayNumber++;
  }

  // 7. Inserir itens agendados no banco
  const { data: insertedItems, error: itemErr } = await supabase
    .from("StudyScheduleItem")
    .insert(scheduleItemsToInsert)
    .select();

  if (itemErr) {
    console.error("Erro ao inserir StudyScheduleItem:", itemErr);
    return;
  }

  console.log(`======================================================================`);
  console.log(` ✅ CRONOGRAMA REORGANIZADO COM SUCESSO! (${insertedItems?.length} ITENS ALOCADOS)`);
  console.log(`======================================================================\n`);

  console.log("📌 CRONOGRAMA PARA HOJE (19/08/2026 - 2 BLOCOS INÉDITOS / 57 MINUTOS):");
  const todayItems = (insertedItems || []).filter(i => i.scheduledDate.startsWith("2026-08-19"));
  todayItems.forEach((item, idx) => {
    const block = unstudiedBlocks.find(b => b.id === item.studyBlockId);
    console.log(` [${idx + 1}] '${item.reason}' | Bloco: '${block?.title}' (${item.estimatedMinutes} min, pp. ${block?.pageStart}–${block?.pageEnd})`);
  });
}

main();
