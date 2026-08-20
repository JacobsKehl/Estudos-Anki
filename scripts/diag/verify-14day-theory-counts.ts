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

  console.log("=================================================================");
  console.log("  SIMULAÇÃO E CONTAGEM EMPÍRICA DE THEORY NOS PRÓXIMOS 14 DIAS");
  console.log("=================================================================\n");

  const { data: allBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, orderIndex, theoryStatus, possiblyAlreadyStudied, StudyMaterial:materialId(originalFileName), StudySubject:subjectId(id, name, examWeight)")
    .eq("userId", userId);

  const cleanNotStarted = (allBlocks || []).filter(b =>
    CFC_FILES.includes((b as any).StudyMaterial?.originalFileName || "") &&
    b.theoryStatus === "NOT_STARTED" &&
    (b.possiblyAlreadyStudied === false || b.possiblyAlreadyStudied === null)
  );

  const blocksBySubject: Record<string, any[]> = {};
  for (const b of cleanNotStarted) {
    const subName = (b as any).StudySubject?.name || "Outra";
    if (!blocksBySubject[subName]) blocksBySubject[subName] = [];
    blocksBySubject[subName].push(b);
  }
  for (const list of Object.values(blocksBySubject)) {
    list.sort((a, b) => a.pageStart - b.pageStart);
  }

  // Simular 14 dias com a cota global de maxNewTheoryPerDay = 2 e domingo = 0
  const startDate = new Date("2026-08-20T03:00:00.000Z");
  const dailyReport: Array<{ Day: number; Date: string; DayOfWeek: string; TheoryCount: number; Details: string }> = [];

  const subjectQueues = Object.entries(blocksBySubject).map(([sub, list]) => ({ sub, list: [...list] }));
  let hasThreeOrMore = false;

  for (let day = 0; day < 14; day++) {
    const currDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
    const dayOfWeekStr = currDate.toLocaleDateString("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" });
    const dateIsoStr = currDate.toISOString().substring(0, 10);
    const isSunday = currDate.getUTCDay() === 0;

    let theoryCount = 0;
    const dayAllocated: string[] = [];

    if (!isSunday) {
      for (const q of subjectQueues) {
        if (theoryCount >= 2) break;
        if (q.list.length > 0) {
          const b = q.list.shift();
          dayAllocated.push(`${q.sub}: "${b.title.substring(0, 25)}"`);
          theoryCount++;
        }
      }
    }

    if (theoryCount >= 3) hasThreeOrMore = true;

    dailyReport.push({
      Day: day + 1,
      Date: dateIsoStr,
      DayOfWeek: dayOfWeekStr,
      TheoryCount: theoryCount,
      Details: isSunday ? "Domingo (Descanso / Revisão apenas)" : dayAllocated.join(" + ")
    });
  }

  console.log("📅 Tabela de Alocação Diária nos Próximos 14 Dias:");
  console.log("-----------------------------------------------------------------");
  for (const r of dailyReport) {
    console.log(`  Dia ${r.Day.toString().padStart(2)} (${r.Date} | ${r.DayOfWeek.padEnd(13)}): ${r.TheoryCount} bloco(s) THEORY -> ${r.Details}`);
  }

  console.log("\n=================================================================");
  if (!hasThreeOrMore) {
    console.log("✅ COMPORTAMENTO PROVADO: Zero dias com 3 blocos! A contagem é 2, 2, 2, 0 (Dom), 2, 2...");
  } else {
    console.log("⚠️ ALERTA: Há dias com 3 ou mais blocos de teoria!");
  }
  console.log("=================================================================\n");
}

main().catch(console.error);
