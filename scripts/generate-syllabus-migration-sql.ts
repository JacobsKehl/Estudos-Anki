import fs from "fs";
import path from "path";
import { OFFICIAL_TOPICS } from "../src/lib/constants/official-topics";
import { TRT4_2026_PROJETADO_TOPICS } from "../src/lib/constants/projected-topics-trt4";

// ═══ MAPEAMENTOS DE-PARA ═══

// Mapeamento De-Para: subjectName em OFFICIAL_TOPICS -> subjectCanonicalKey
// Corresponde 1:1 com as 7 matérias distintas presentes em official-topics.ts
const SUBJECT_CANONICAL_MAP: Record<string, string> = {
  "Língua Portuguesa": "PORTUGUESE",
  "Direito Constitucional": "DIREITO_CONSTITUCIONAL",
  "Direito Processual do Trabalho": "DIREITO_PROCESSUAL_TRABALHO",
  "Direito do Trabalho": "DIREITO_TRABALHO",
  "Direito Processual Civil": "DIREITO_PROCESSUAL_CIVIL",
  "Direito Administrativo": "DIREITO_ADMINISTRATIVO",
  "Direito Civil": "DIREITO_CIVIL",
};

// ═══ GERADOR DE SQL ═══

function escapeSQLString(str: string): string {
  return str.replace(/'/g, "''");
}

// Extrai a lista de matérias únicas (SyllabusSubject) a partir dos tópicos
interface SubjectMeta {
  canonicalKey: string;
  displayName: string;
  blocoConhecimento: string;
  questoesDaMateria: string; // SQL literal (ex: "NULL" ou "30")
  weight: number;
  orderIndex: number;
}

function extractSubjectsFromEstrategia(): SubjectMeta[] {
  const subjectsMap = new Map<string, SubjectMeta>();

  let index = 1;
  for (const topic of OFFICIAL_TOPICS) {
    const canonicalKey = SUBJECT_CANONICAL_MAP[topic.subjectName];
    if (!canonicalKey) continue;

    if (!subjectsMap.has(canonicalKey)) {
      // V1 é grade de curso comercial — blocoConhecimento e questoesDaMateria são NULL.
      // O peso da matéria na V1 é o peso máximo entre os tópicos dessa matéria no arquivo de constantes.
      subjectsMap.set(canonicalKey, {
        canonicalKey,
        displayName: topic.subjectName,
        blocoConhecimento: "NULL",
        questoesDaMateria: "NULL",
        weight: topic.weight,
        orderIndex: index++,
      });
    } else {
      // Atualizar o peso se encontrar um tópico com peso maior
      const existing = subjectsMap.get(canonicalKey)!;
      if (topic.weight > existing.weight) {
        existing.weight = topic.weight;
      }
    }
  }

  return Array.from(subjectsMap.values());
}

function extractSubjectsFromProjetado(): SubjectMeta[] {
  const subjectsMap = new Map<string, SubjectMeta>();

  let index = 1;
  for (const topic of TRT4_2026_PROJETADO_TOPICS) {
    const key = topic.subjectCanonicalKey;
    if (!subjectsMap.has(key)) {
      subjectsMap.set(key, {
        canonicalKey: key,
        displayName: topic.subjectName,
        blocoConhecimento: `'${topic.blocoConhecimento}'`,
        questoesDaMateria: String(topic.questoesDaMateria),
        weight: topic.weight,
        orderIndex: index++,
      });
    }
  }

  return Array.from(subjectsMap.values());
}

function generateSQL() {
  const v1Id = "cm01_estrategia_grid_v1";
  const v2Id = "cm02_trt4_2026_projetado_v2";

  let sql = `-- MIGRATION 3: create_syllabus_tables\n`;
  sql += `-- Criada em: 2026-08-13\n`;
  sql += `-- Descrição: Cria as tabelas SyllabusVersion, SyllabusSubject e SyllabusTopic e popula com os tópicos iniciais.\n\n`;

  sql += `-- 1. Criar Tabela SyllabusVersion\n`;
  sql += `CREATE TABLE IF NOT EXISTS "SyllabusVersion" (\n`;
  sql += `  "id" TEXT NOT NULL,\n`;
  sql += `  "label" TEXT NOT NULL,\n`;
  sql += `  "source" TEXT NOT NULL,\n`;
  sql += `  "description" TEXT,\n`;
  sql += `  "isActive" BOOLEAN NOT NULL DEFAULT false,\n`;
  sql += `  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  CONSTRAINT "SyllabusVersion_pkey" PRIMARY KEY ("id")\n`;
  sql += `);\n\n`;

  sql += `CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusVersion_label_key" ON "SyllabusVersion"("label");\n`;
  sql += `CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusVersion_single_active" ON "SyllabusVersion"("isActive") WHERE "isActive" = true;\n\n`;

  sql += `-- 2. Criar Tabela SyllabusSubject\n`;
  sql += `CREATE TABLE IF NOT EXISTS "SyllabusSubject" (\n`;
  sql += `  "id" TEXT NOT NULL,\n`;
  sql += `  "versionId" TEXT NOT NULL,\n`;
  sql += `  "canonicalKey" TEXT NOT NULL,\n`;
  sql += `  "displayName" TEXT NOT NULL,\n`;
  sql += `  "blocoConhecimento" TEXT,\n`;
  sql += `  "questoesDaMateria" INTEGER,\n`;
  sql += `  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,\n`;
  sql += `  "orderIndex" INTEGER NOT NULL DEFAULT 0,\n`;
  sql += `  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  CONSTRAINT "SyllabusSubject_pkey" PRIMARY KEY ("id"),\n`;
  sql += `  CONSTRAINT "SyllabusSubject_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SyllabusVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE\n`;
  sql += `);\n\n`;

  sql += `CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusSubject_versionId_canonicalKey_key" ON "SyllabusSubject"("versionId", "canonicalKey");\n\n`;

  sql += `-- 3. Criar Tabela SyllabusTopic\n`;
  sql += `CREATE TABLE IF NOT EXISTS "SyllabusTopic" (\n`;
  sql += `  "id" TEXT NOT NULL,\n`;
  sql += `  "versionId" TEXT NOT NULL,\n`;
  sql += `  "subjectCanonicalKey" TEXT NOT NULL,\n`;
  sql += `  "subjectName" TEXT NOT NULL,\n`;
  sql += `  "topicCode" TEXT NOT NULL,\n`;
  sql += `  "title" TEXT NOT NULL,\n`;
  sql += `  "normalizedTitle" TEXT NOT NULL,\n`;
  sql += `  "orderIndex" INTEGER NOT NULL,\n`;
  sql += `  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,\n`;
  sql += `  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  CONSTRAINT "SyllabusTopic_pkey" PRIMARY KEY ("id"),\n`;
  sql += `  CONSTRAINT "SyllabusTopic_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SyllabusVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE,\n`;
  sql += `  CONSTRAINT "SyllabusTopic_subject_fkey" FOREIGN KEY ("versionId", "subjectCanonicalKey") REFERENCES "SyllabusSubject"("versionId", "canonicalKey") ON DELETE CASCADE ON UPDATE CASCADE\n`;
  sql += `);\n\n`;

  sql += `CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusTopic_versionId_topicCode_key" ON "SyllabusTopic"("versionId", "topicCode");\n`;
  sql += `CREATE INDEX IF NOT EXISTS "SyllabusTopic_versionId_idx" ON "SyllabusTopic"("versionId");\n`;
  sql += `CREATE INDEX IF NOT EXISTS "SyllabusTopic_subjectCanonicalKey_idx" ON "SyllabusTopic"("subjectCanonicalKey");\n\n`;

  // 4. Inserir Versão 1 (ESTRATEGIA_COURSE_GRID — ATIVA)
  sql += `-- 4. Inserir Versão 1 (ESTRATEGIA_COURSE_GRID — ATIVA)\n`;
  sql += `INSERT INTO "SyllabusVersion" ("id", "label", "source", "description", "isActive", "createdAt", "updatedAt")\n`;
  sql += `VALUES ('${v1Id}', 'ESTRATEGIA_COURSE_GRID', 'ESTRATEGIA_PDF_GRID', 'Grade de tópicos extraída dos PDFs do Estratégia Concursos', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\n`;
  sql += `ON CONFLICT ("label") DO NOTHING;\n`;

  // 4a. Matérias da versão ESTRATEGIA_COURSE_GRID
  const v1Subjects = extractSubjectsFromEstrategia();
  sql += `\n-- 4a. Matérias da versão ESTRATEGIA_COURSE_GRID (${v1Subjects.length} matérias)\n`;
  for (const s of v1Subjects) {
    const subjectId = `${v1Id}__${s.canonicalKey.toLowerCase()}`;
    sql += `INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")\n`;
    sql += `VALUES ('${subjectId}', '${v1Id}', '${s.canonicalKey}', '${escapeSQLString(s.displayName)}', ${s.blocoConhecimento}, ${s.questoesDaMateria}, ${s.weight}, ${s.orderIndex}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\n`;
    sql += `ON CONFLICT ("id") DO NOTHING;\n`;
  }

  // 4b. Tópicos da versão ESTRATEGIA_COURSE_GRID (110 tópicos)
  sql += `\n-- 4b. Tópicos da versão ESTRATEGIA_COURSE_GRID (${OFFICIAL_TOPICS.length} tópicos)\n`;
  for (const topic of OFFICIAL_TOPICS) {
    const canonicalKey = SUBJECT_CANONICAL_MAP[topic.subjectName];
    sql += `INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")\n`;
    sql += `VALUES ('${escapeSQLString(topic.id)}', '${v1Id}', '${canonicalKey}', '${escapeSQLString(topic.subjectName)}', '${escapeSQLString(topic.topicCode)}', '${escapeSQLString(topic.title)}', '${escapeSQLString(topic.normalizedTitle)}', ${topic.orderIndex}, ${topic.weight}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\n`;
    sql += `ON CONFLICT ("id") DO NOTHING;\n`;
  }

  // 5. Inserir Versão 2 (TRT4_2026_PROJETADO — INATIVA)
  sql += `\n-- 5. Inserir Versão 2 (TRT4_2026_PROJETADO — INATIVA)\n`;
  sql += `INSERT INTO "SyllabusVersion" ("id", "label", "source", "description", "isActive", "createdAt", "updatedAt")\n`;
  sql += `VALUES ('${v2Id}', 'TRT4_2026_PROJETADO', 'TRT4_EDITAL_VERTICALIZADO', 'Taxonomia oficial baseada no edital verticalizado TRT4 AJAJ 2026', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\n`;
  sql += `ON CONFLICT ("label") DO NOTHING;\n`;

  // 5a. Matérias da versão TRT4_2026_PROJETADO
  const v2Subjects = extractSubjectsFromProjetado();
  sql += `\n-- 5a. Matérias da versão TRT4_2026_PROJETADO (${v2Subjects.length} matérias)\n`;
  for (const s of v2Subjects) {
    const subjectId = `${v2Id}__${s.canonicalKey.toLowerCase()}`;
    sql += `INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")\n`;
    sql += `VALUES ('${subjectId}', '${v2Id}', '${s.canonicalKey}', '${escapeSQLString(s.displayName)}', ${s.blocoConhecimento}, ${s.questoesDaMateria}, ${s.weight}, ${s.orderIndex}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\n`;
    sql += `ON CONFLICT ("id") DO NOTHING;\n`;
  }

  // 5b. SyllabusTopic para V2
  sql += `\n-- 5b. Tópicos da versão TRT4_2026_PROJETADO (${TRT4_2026_PROJETADO_TOPICS.length} tópicos)\n`;
  for (const topic of TRT4_2026_PROJETADO_TOPICS) {
    sql += `INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")\n`;
    sql += `VALUES ('${escapeSQLString(topic.id)}', '${v2Id}', '${topic.subjectCanonicalKey}', '${escapeSQLString(topic.subjectName)}', '${escapeSQLString(topic.topicCode)}', '${escapeSQLString(topic.title)}', '${escapeSQLString(topic.normalizedTitle)}', ${topic.orderIndex}, ${topic.weight}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\n`;
    sql += `ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;\n`;
  }

  // ═══ GRAVAR ARQUIVOS ═══
  const outDir = path.join(__dirname, "../docs/migrations-sql-preview");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const migration3File = path.join(outDir, "migration_3_create_syllabus_tables.sql");
  fs.writeFileSync(migration3File, sql, "utf-8");

  // Migration 4 (canonicalKey em StudySubject)
  let migration4Sql = `-- MIGRATION 4: add_study_subject_canonical_key\n`;
  migration4Sql += `-- 1. Adicionar coluna canonicalKey em StudySubject\n`;
  migration4Sql += `ALTER TABLE "StudySubject" ADD COLUMN IF NOT EXISTS "canonicalKey" TEXT;\n`;

  const migration4File = path.join(outDir, "migration_4_add_study_subject_canonical_key.sql");
  fs.writeFileSync(migration4File, migration4Sql, "utf-8");

  // Migration 5 (FK de officialTopicId)
  let migration5Sql = `-- MIGRATION 5: add_study_block_official_topic_fk\n`;
  migration5Sql += `-- 1. Adicionar Foreign Key entre StudyBlock.officialTopicId e SyllabusTopic.id\n`;
  migration5Sql += `ALTER TABLE "StudyBlock" ADD CONSTRAINT "StudyBlock_officialTopicId_fkey" FOREIGN KEY ("officialTopicId") REFERENCES "SyllabusTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;\n`;

  const migration5File = path.join(outDir, "migration_5_add_study_block_official_topic_fk.sql");
  fs.writeFileSync(migration5File, migration5Sql, "utf-8");

  // Migration 6 (Campos de pré-crédito conservador em StudyBlock)
  let migration6Sql = `-- MIGRATION 6: add_study_block_conservative_precredit_fields\n`;
  migration6Sql += `-- 1. Adicionar campos para pré-crédito conservador e aviso de 1-clique na UI\n`;
  migration6Sql += `ALTER TABLE "StudyBlock" ADD COLUMN IF NOT EXISTS "possiblyAlreadyStudied" BOOLEAN NOT NULL DEFAULT false;\n`;
  migration6Sql += `ALTER TABLE "StudyBlock" ADD COLUMN IF NOT EXISTS "sourceV1BlockId" TEXT;\n`;

  const migration6File = path.join(outDir, "migration_6_add_study_block_conservative_precredit_fields.sql");
  fs.writeFileSync(migration6File, migration6Sql, "utf-8");

  // ═══ RESUMO ═══
  console.log(`✅ SQLs gerados com sucesso em:\n - ${migration3File}\n - ${migration4File}\n - ${migration5File}\n - ${migration6File}`);
  console.log(`\nVersão 1 (ESTRATEGIA_COURSE_GRID): ${v1Subjects.length} matérias, ${OFFICIAL_TOPICS.length} tópicos (ATIVA)`);
  console.log(`Versão 2 (TRT4_2026_PROJETADO): ${v2Subjects.length} matérias, ${TRT4_2026_PROJETADO_TOPICS.length} tópicos (INATIVA)`);
  console.log(`Total: ${OFFICIAL_TOPICS.length + TRT4_2026_PROJETADO_TOPICS.length} tópicos`);
}

generateSQL();
