import "dotenv/config";
import { fetchAllRowsPaginated } from "../backup-paginated";
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
  console.log("=================================================================");
  console.log("  DRY-RUN PAGINADO SEM TETO DE 1000 LINHAS — ITENS RESIDUAIS");
  console.log("=================================================================\n");

  const { data: user } = await supabase.from("User").select("id").eq("email", "gabriela.furtado.p@gmail.com").single();
  const userId = user!.id;

  // 1. Fetch all items paginated
  const { data: allItems, exactCount } = await fetchAllRowsPaginated("StudyScheduleItem");
  console.log(`Total de itens em StudyScheduleItem no banco: ${exactCount}\n`);

  // Fetch all blocks with material info
  const { data: allBlocks } = await supabase
    .from("StudyBlock")
    .select("id, title, StudyMaterial:materialId(originalFileName), StudySubject:subjectId(name)")
    .eq("userId", userId);

  const blockMap = new Map((allBlocks || []).map((b: any) => [b.id, b]));

  const userItems = allItems.filter((it: any) => it.userId === userId);
  const pendingFutureItems = userItems.filter((it: any) => {
    if (it.status !== "PENDING") return false;
    if (!it.scheduledDate) return false;
    const dStr = it.scheduledDate.substring(0, 10);
    return dStr >= "2026-08-20";
  });

  const cfcItems: any[] = [];
  const residualItems: any[] = [];

  for (const it of pendingFutureItems) {
    const b = blockMap.get(it.studyBlockId);
    const matName = b?.StudyMaterial?.originalFileName;
    const isCfc = matName && CFC_FILES.includes(matName);
    if (isCfc) {
      cfcItems.push(it);
    } else {
      residualItems.push({ ...it, blockTitle: b?.title, subjectName: b?.StudySubject?.name || "Outra" });
    }
  }

  console.log(`Total de itens PENDING a partir de 20/08/2026 (SEM TRUNCAMENTO): ${pendingFutureItems.length}`);
  console.log(`  - Itens VÁLIDOS do CFC (SERÃO PRESERVADOS):                ${cfcItems.length}`);
  console.log(`  - Itens RESIDUAIS do Estratégia (A SEREM PURGADOS):        ${residualItems.length}\n`);

  const byMonth: Record<string, number> = {};
  const bySubject: Record<string, number> = {};

  for (const it of residualItems) {
    const month = it.scheduledDate.substring(0, 7); // YYYY-MM
    const sub = it.subjectName;
    byMonth[month] = (byMonth[month] || 0) + 1;
    bySubject[sub] = (bySubject[sub] || 0) + 1;
  }

  console.log("-----------------------------------------------------------------");
  console.log("  DECOMPOSIÇÃO REAL DOS ITENS RESIDUAIS:");
  console.log("-----------------------------------------------------------------\n");

  console.log("📌 Por Mês:");
  Object.entries(byMonth).sort().forEach(([m, cnt]) => {
    console.log(`   ${m}: ${cnt} item(ns)`);
  });

  console.log("\n📌 Por Matéria:");
  Object.entries(bySubject).sort().forEach(([sub, cnt]) => {
    console.log(`   ${sub.padEnd(35)}: ${cnt} item(ns)`);
  });
}

main().catch(console.error);
