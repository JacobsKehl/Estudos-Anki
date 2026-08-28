/**
 * simulate-14day-global-quota.ts
 *
 * Simula os próximos 14 dias de teoria com cota GLOBAL de 2 blocos inéditos do CFC por dia.
 * Avalia o priorityScore e a distribuição por matéria.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const CFC_FILES = [
  "1 - Direito Administrativo_compressed.pdf",
  "2 - Direito do Trabalho.pdf",
  "3 - Direito Constitucional.pdf",
  "4 - Direito Processual do Trabalho.pdf",
  "Direito Processual Civil_compressed.pdf",
];

async function main() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  const { data: allBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, orderIndex, theoryStatus, possiblyAlreadyStudied, StudyMaterial:materialId(originalFileName), StudySubject:subjectId(id, name, examWeight, priority)")
    .eq("userId", userId);

  const cleanNotStarted = (allBlocks || []).filter(b =>
    CFC_FILES.includes((b as any).StudyMaterial?.originalFileName || "") &&
    b.theoryStatus === "NOT_STARTED" &&
    (b.possiblyAlreadyStudied === false || b.possiblyAlreadyStudied === null)
  );

  console.log("=================================================================");
  console.log(`  SIMULAÇÃO DE 14 DIAS — COTA GLOBAL DE 2 BLOCOS INÉDITOS/DIA`);
  console.log("=================================================================\n");

  console.log(`Total de blocos inéditos de teoria do CFC: ${cleanNotStarted.length}\n`);

  // Agrupar por matéria
  const blocksBySubject: Record<string, any[]> = {};
  for (const b of cleanNotStarted) {
    const subName = (b as any).StudySubject?.name || "Outra";
    if (!blocksBySubject[subName]) blocksBySubject[subName] = [];
    blocksBySubject[subName].push(b);
  }

  for (const [sub, list] of Object.entries(blocksBySubject)) {
    list.sort((a, b) => a.pageStart - b.pageStart);
    console.log(`  📘 Matéria: ${sub.padEnd(35)} -> ${list.length} bloco(s) inédito(s)`);
  }

  // Simular alocação de 2 por dia (rodízio vs prioridade por peso)
  console.log("\n-----------------------------------------------------------------");
  console.log("  DISTRIBUIÇÃO SIMULADA NOS PRÓXIMOS 16 DIAS LETIVOS (2 BLOCOS/DIA)");
  console.log("-----------------------------------------------------------------\n");

  // Estratégia de Rodízio Intercalado entre Matérias (Round-Robin equilibrado)
  const remainingQueues = Object.entries(blocksBySubject).map(([sub, list]) => ({ sub, list: [...list] }));
  
  let day = 1;
  let allocated = 0;
  const totalToAllocate = cleanNotStarted.length;

  while (allocated < totalToAllocate) {
    const dayBlocks: any[] = [];
    
    // Tenta pegar 1 de matérias diferentes por dia para rodízio
    for (const q of remainingQueues) {
      if (dayBlocks.length >= 2) break;
      if (q.list.length > 0) {
        dayBlocks.push({ sub: q.sub, block: q.list.shift() });
      }
    }

    if (dayBlocks.length === 0) break;

    allocated += dayBlocks.length;
    console.log(`  📅 Dia ${day.toString().padStart(2)}: ${dayBlocks.map(db => `${db.sub} ("${db.block.title.substring(0, 30)}")`).join(" + ")}`);
    day++;
  }
}

main().catch(console.error);
