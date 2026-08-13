import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { OFFICIAL_TOPICS } from "../src/lib/constants/official-topics";
import { TRT4_2026_PROJETADO_TOPICS } from "../src/lib/constants/projected-topics-trt4";

const envContent = fs.readFileSync(".env", "utf-8");
const getVal = (key: string) => {
  const m = envContent.match(new RegExp(`^${key}=["']?(.*?)["']?$`, "m"));
  return m ? m[1].trim() : "";
};

const directUrl = getVal("DIRECT_URL");
const prisma = new PrismaClient({
  datasources: {
    db: { url: directUrl }
  }
});

const SUBJECT_CANONICAL_MAP: Record<string, string> = {
  "Língua Portuguesa": "PORTUGUESE",
  "Direito Constitucional": "DIREITO_CONSTITUCIONAL",
  "Direito Processual do Trabalho": "DIREITO_PROCESSUAL_TRABALHO",
  "Direito do Trabalho": "DIREITO_TRABALHO",
  "Direito Processual Civil": "DIREITO_PROCESSUAL_CIVIL",
  "Direito Administrativo": "DIREITO_ADMINISTRATIVO",
  "Direito Civil": "DIREITO_CIVIL",
};

async function main() {
  console.log("=== SEMEANDO TAXONOMIAS EM PRODUÇÃO VIA PRISMA ORM ===");

  // Verificar que o índice correto existe (migration 20260813150007 deve ter corrigido)
  const wrongIndex = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'SyllabusTopic' AND indexname = 'SyllabusTopic_versionId_topicCode_key';
  `;
  if (wrongIndex.length > 0) {
    console.error("❌ ERRO FATAL: Índice antigo 'SyllabusTopic_versionId_topicCode_key' ainda existe.");
    console.error("   Execute a migration 20260813150007_fix_syllabus_topic_unique_index primeiro.");
    process.exit(1);
  }
  const correctIndex = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'SyllabusTopic' AND indexname = 'SyllabusTopic_version_subject_topicCode_key';
  `;
  if (correctIndex.length === 0) {
    console.error("❌ ERRO FATAL: Índice correto 'SyllabusTopic_version_subject_topicCode_key' não encontrado.");
    console.error("   Execute a migration 20260813150007_fix_syllabus_topic_unique_index primeiro.");
    process.exit(1);
  }
  console.log("✅ Índice correto (versionId, subjectCanonicalKey, topicCode) confirmado.");

  const v1Id = "cm01_estrategia_grid_v1";
  const v2Id = "cm02_trt4_2026_projetado_v2";

  // 1. Versão V1 (ESTRATEGIA_COURSE_GRID — ATIVA)
  await prisma.syllabusVersion.upsert({
    where: { label: "ESTRATEGIA_COURSE_GRID" },
    update: { isActive: true },
    create: {
      id: v1Id,
      label: "ESTRATEGIA_COURSE_GRID",
      source: "ESTRATEGIA_PDF_GRID",
      description: "Grade de tópicos extraída dos PDFs do Estratégia Concursos",
      isActive: true,
    },
  });

  // 1a. Matérias V1
  const v1SubjectsMap = new Map<string, { canonicalKey: string; displayName: string; weight: number; orderIndex: number }>();
  let v1Idx = 1;
  for (const t of OFFICIAL_TOPICS) {
    const key = SUBJECT_CANONICAL_MAP[t.subjectName];
    if (!key) continue;
    if (!v1SubjectsMap.has(key)) {
      v1SubjectsMap.set(key, { canonicalKey: key, displayName: t.subjectName, weight: t.weight, orderIndex: v1Idx++ });
    } else {
      const existing = v1SubjectsMap.get(key)!;
      if (t.weight > existing.weight) existing.weight = t.weight;
    }
  }

  for (const s of v1SubjectsMap.values()) {
    const subjectId = `${v1Id}__${s.canonicalKey.toLowerCase()}`;
    await prisma.syllabusSubject.upsert({
      where: { id: subjectId },
      update: {},
      create: {
        id: subjectId,
        versionId: v1Id,
        canonicalKey: s.canonicalKey,
        displayName: s.displayName,
        weight: s.weight,
        orderIndex: s.orderIndex,
      },
    });
  }

  // 1b. Tópicos V1 (110)
  for (const t of OFFICIAL_TOPICS) {
    const canonicalKey = SUBJECT_CANONICAL_MAP[t.subjectName];
    await prisma.syllabusTopic.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        versionId: v1Id,
        subjectCanonicalKey: canonicalKey,
        subjectName: t.subjectName,
        topicCode: t.topicCode,
        title: t.title,
        normalizedTitle: t.normalizedTitle,
        orderIndex: t.orderIndex,
        weight: t.weight,
      },
    });
  }

  // 2. Versão V2 (TRT4_2026_PROJETADO — INATIVA)
  await prisma.syllabusVersion.upsert({
    where: { label: "TRT4_2026_PROJETADO" },
    update: { isActive: false },
    create: {
      id: v2Id,
      label: "TRT4_2026_PROJETADO",
      source: "TRT4_EDITAL_VERTICALIZADO",
      description: "Taxonomia oficial baseada no edital verticalizado TRT4 AJAJ 2026",
      isActive: false,
    },
  });

  // 2a. Matérias V2
  const v2SubjectsMap = new Map<string, { canonicalKey: string; displayName: string; blocoConhecimento: string; questoesDaMateria: number; weight: number; orderIndex: number }>();
  let v2Idx = 1;
  for (const t of TRT4_2026_PROJETADO_TOPICS) {
    const key = t.subjectCanonicalKey;
    if (!v2SubjectsMap.has(key)) {
      v2SubjectsMap.set(key, {
        canonicalKey: key,
        displayName: t.subjectName,
        blocoConhecimento: t.blocoConhecimento,
        questoesDaMateria: t.questoesDaMateria,
        weight: t.weight,
        orderIndex: v2Idx++,
      });
    }
  }

  for (const s of v2SubjectsMap.values()) {
    const subjectId = `${v2Id}__${s.canonicalKey.toLowerCase()}`;
    await prisma.syllabusSubject.upsert({
      where: { id: subjectId },
      update: {},
      create: {
        id: subjectId,
        versionId: v2Id,
        canonicalKey: s.canonicalKey,
        displayName: s.displayName,
        blocoConhecimento: s.blocoConhecimento,
        questoesDaMateria: s.questoesDaMateria,
        weight: s.weight,
        orderIndex: s.orderIndex,
      },
    });
  }

  // 2b. Tópicos V2 (109)
  for (const t of TRT4_2026_PROJETADO_TOPICS) {
    await prisma.syllabusTopic.upsert({
      where: { id: t.id },
      update: { title: t.title, subjectCanonicalKey: t.subjectCanonicalKey },
      create: {
        id: t.id,
        versionId: v2Id,
        subjectCanonicalKey: t.subjectCanonicalKey,
        subjectName: t.subjectName,
        topicCode: t.topicCode,
        title: t.title,
        normalizedTitle: t.normalizedTitle,
        orderIndex: t.orderIndex,
        weight: t.weight,
      },
    });
  }

  console.log("🎉 Seed finalizado! Conferindo contagens...");

  const versionsRes: any[] = await prisma.$queryRawUnsafe(`
    SELECT v.id, v.label, v."isActive", COUNT(t.id)::int as topic_count
    FROM "SyllabusVersion" v
    LEFT JOIN "SyllabusTopic" t ON t."versionId" = v.id
    GROUP BY v.id, v.label, v."isActive"
    ORDER BY v.id;
  `);

  console.table(versionsRes);

  const activeRes: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, label, "isActive" FROM "SyllabusVersion" WHERE "isActive" = true;
  `);

  console.log(`\nVersões Ativas Encontradas (${activeRes.length}):`);
  console.log(JSON.stringify(activeRes, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
