/**
 * fix-const-26-08.ts
 *
 * Fix emergencial: bloco de Direito Constitucional agendado para 26/08 tem 13 páginas
 * e 3 capítulos misturados. Reduz para "Do Poder Legislativo" [43–48], 6 páginas, 18 min.
 *
 * Backup de um id só (pre-ajuste-const-26-08), contagem antes e depois.
 *
 * Uso:
 *   npx tsx scripts/fix-const-26-08.ts            # dry-run (default)
 *   npx tsx scripts/fix-const-26-08.ts --apply     # aplica
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const APPLY = process.argv.includes("--apply");
const userId = "cmp8od0wz0000iybklaotfqbs";

async function main() {
  console.log("=== FIX CONSTITUCIONAL 26/08 ===");
  console.log(`Modo: ${APPLY ? "🔴 --apply (ESCRITA)" : "🟡 --dry-run (LEITURA)"}\n`);

  // 1. Encontrar itens de THEORY agendados para hoje (26/08) em Constitucional
  const todayStart = "2026-08-26T00:00:00-03:00";
  const todayEnd = "2026-08-26T23:59:59-03:00";

  const { data: todayItems, error: itemsErr } = await supabase
    .from("StudyScheduleItem")
    .select("id, studyBlockId, scheduledDate, actionType, status, estimatedMinutes")
    .eq("userId", userId)
    .eq("actionType", "THEORY")
    .eq("status", "PENDING")
    .gte("scheduledDate", todayStart)
    .lte("scheduledDate", todayEnd);

  if (itemsErr) throw new Error(`Erro ao buscar itens: ${itemsErr.message}`);

  if (!todayItems || todayItems.length === 0) {
    console.log("❌ Nenhum item THEORY PENDING para hoje.");
    return;
  }

  const blockIds = todayItems
    .map((i) => i.studyBlockId)
    .filter((id): id is string => !!id);

  // 2. Buscar os blocos associados
  const { data: blocks, error: blocksErr } = await supabase
    .from("StudyBlock")
    .select("id, title, pageStart, pageEnd, estimatedStudyMinutes, subjectId, materialId")
    .in("id", blockIds);

  if (blocksErr) throw new Error(`Erro ao buscar blocos: ${blocksErr.message}`);

  // 3. Encontrar o bloco de Constitucional com > 8 páginas
  const { data: subjects } = await supabase
    .from("StudySubject")
    .select("id, name")
    .eq("userId", userId);

  const constSubject = (subjects || []).find((s) =>
    s.name.toLowerCase().includes("constitucional")
  );

  if (!constSubject) {
    console.log("❌ Matéria Constitucional não encontrada.");
    return;
  }

  const target = (blocks || []).find(
    (b) =>
      b.subjectId === constSubject.id &&
      b.pageStart <= 43 &&
      b.pageEnd >= 55
  );

  if (!target) {
    console.log("❌ Bloco de Constitucional com pageStart ≤ 43 e pageEnd ≥ 55 não encontrado.");
    console.log("   Blocos encontrados hoje:");
    (blocks || []).forEach((b) => {
      const sub = (subjects || []).find((s) => s.id === b.subjectId);
      console.log(`   - ${sub?.name || "?"}: [${b.pageStart}–${b.pageEnd}] "${b.title}"`);
    });
    return;
  }

  console.log("📌 Bloco encontrado:");
  console.log(`   ID: ${target.id}`);
  console.log(`   Título: ${target.title}`);
  console.log(`   Antes: [${target.pageStart}–${target.pageEnd}] = ${target.pageEnd - target.pageStart + 1} páginas, ${target.estimatedStudyMinutes} min`);
  console.log(`   Depois: [${target.pageStart}–48] = 6 páginas, 18 min\n`);

  // 4. Backup do bloco (um id só)
  const backupDir = path.join(process.cwd(), "backups", "json");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const backupData = {
    timestamp: new Date().toISOString(),
    label: "pre-ajuste-const-26-08",
    blockId: target.id,
    before: { ...target },
  };

  const backupPath = path.join(backupDir, "pre-ajuste-const-26-08.json");
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`💾 Backup salvo: ${backupPath}\n`);

  if (!APPLY) {
    console.log("🟡 DRY-RUN: nenhuma alteração feita. Use --apply para aplicar.");
    return;
  }

  // 5. Aplicar a correção
  const { error: updateErr } = await supabase
    .from("StudyBlock")
    .update({ pageEnd: 48, estimatedStudyMinutes: 18 })
    .eq("id", target.id);

  if (updateErr) throw new Error(`Erro ao atualizar bloco: ${updateErr.message}`);

  // 6. Atualizar o estimatedMinutes no StudyScheduleItem correspondente
  const matchingItem = todayItems.find((i) => i.studyBlockId === target.id);
  if (matchingItem) {
    const { error: itemUpdateErr } = await supabase
      .from("StudyScheduleItem")
      .update({ estimatedMinutes: 18 })
      .eq("id", matchingItem.id);

    if (itemUpdateErr) {
      console.warn(`⚠️ Falha ao atualizar estimatedMinutes do item ${matchingItem.id}: ${itemUpdateErr.message}`);
    }
  }

  // 7. Verificação
  const { data: after } = await supabase
    .from("StudyBlock")
    .select("id, pageStart, pageEnd, estimatedStudyMinutes")
    .eq("id", target.id)
    .single();

  console.log("✅ Atualização aplicada:");
  console.log(`   Antes:  [${target.pageStart}–${target.pageEnd}] ${target.estimatedStudyMinutes} min`);
  console.log(`   Depois: [${after?.pageStart}–${after?.pageEnd}] ${after?.estimatedStudyMinutes} min`);
}

main().catch((err) => {
  console.error("🛑 ERRO:", err.message);
  process.exit(1);
});
