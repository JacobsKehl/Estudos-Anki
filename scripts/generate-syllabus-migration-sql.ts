import fs from "fs";
import path from "path";
import { OFFICIAL_TOPICS } from "../src/lib/constants/official-topics";

// Mapeamento De-Para explícito de nome de matéria -> canonicalKey
const SUBJECT_CANONICAL_MAP: Record<string, string> = {
  "Língua Portuguesa": "PORTUGUESE",
  "Raciocínio Lógico-Matemático": "LOGIC_MATH",
  "Noções de Tecnologia da Informação": "TECH_INFO",
  "Direito Constitucional": "DIREITO_CONSTITUCIONAL",
  "Direito Processual do Trabalho": "DIREITO_PROCESSUAL_TRABALHO",
  "Direito do Trabalho": "DIREITO_TRABALHO",
  "Direito Processual Civil": "DIREITO_PROCESSUAL_CIVIL",
  "Direito Administrativo": "DIREITO_ADMINISTRATIVO",
};

function escapeSQLString(str: string): string {
  return str.replace(/'/g, "''");
}

function generateSQL() {
  const versionId = "cm01_estrategia_grid_v1";
  const versionLabel = "ESTRATEGIA_COURSE_GRID";
  const versionSource = "Estratégia Concursos PDF Grid (Legacy initial ingestion)";
  const versionDescription = "Taxonomia inicial de tópicos baseada no sumário dos materiais do Estratégia Concursos.";

  let sql = `-- MIGRATION 3: create_syllabus_tables_and_seed\n`;
  sql += `-- Auto-gerado por scripts/generate-syllabus-migration-sql.ts\n\n`;

  // 1. DDL: Criar Tabela SyllabusVersion
  sql += `-- 1. Criar Tabela SyllabusVersion\n`;
  sql += `CREATE TABLE IF NOT EXISTS "SyllabusVersion" (\n`;
  sql += `  "id" TEXT NOT NULL,\n`;
  sql += `  "label" TEXT NOT NULL,\n`;
  sql += `  "source" TEXT NOT NULL,\n`;
  sql += `  "description" TEXT,\n`;
  sql += `  "isActive" BOOLEAN NOT NULL DEFAULT true,\n`;
  sql += `  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n`;
  sql += `  CONSTRAINT "SyllabusVersion_pkey" PRIMARY KEY ("id")\n`;
  sql += `);\n\n`;

  sql += `CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusVersion_label_key" ON "SyllabusVersion"("label");\n`;
  sql += `CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusVersion_single_active" ON "SyllabusVersion"("isActive") WHERE "isActive" = true;\n\n`;

  // 2. DDL: Criar Tabela SyllabusTopic
  sql += `-- 2. Criar Tabela SyllabusTopic\n`;
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
  sql += `  CONSTRAINT "SyllabusTopic_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SyllabusVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE\n`;
  sql += `);\n\n`;

  sql += `CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusTopic_versionId_topicCode_key" ON "SyllabusTopic"("versionId", "topicCode");\n`;
  sql += `CREATE INDEX IF NOT EXISTS "SyllabusTopic_versionId_idx" ON "SyllabusTopic"("versionId");\n`;
  sql += `CREATE INDEX IF NOT EXISTS "SyllabusTopic_subjectCanonicalKey_idx" ON "SyllabusTopic"("subjectCanonicalKey");\n\n`;

  // 3. INSERT na SyllabusVersion
  sql += `-- 3. Insert da Versão Ativa 'ESTRATEGIA_COURSE_GRID'\n`;
  sql += `INSERT INTO "SyllabusVersion" ("id", "label", "source", "description", "isActive", "createdAt", "updatedAt")\n`;
  sql += `VALUES ('${versionId}', '${versionLabel}', '${escapeSQLString(versionSource)}', '${escapeSQLString(versionDescription)}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\n`;
  sql += `ON CONFLICT ("label") DO NOTHING;\n\n`;

  // 4. INSERTs de cada tópico de OFFICIAL_TOPICS
  sql += `-- 4. Inserts dos ${OFFICIAL_TOPICS.length} tópicos oficiais da versão ESTRATEGIA_COURSE_GRID\n`;
  for (const topic of OFFICIAL_TOPICS) {
    const canonicalKey = SUBJECT_CANONICAL_MAP[topic.subjectName] || "OUTROS";
    sql += `INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")\n`;
    sql += `VALUES ('${escapeSQLString(topic.id)}', '${versionId}', '${canonicalKey}', '${escapeSQLString(topic.subjectName)}', '${escapeSQLString(topic.topicCode)}', '${escapeSQLString(topic.title)}', '${escapeSQLString(topic.normalizedTitle)}', ${topic.orderIndex}, ${topic.weight || 1.0}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)\n`;
    sql += `ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;\n`;
  }

  const outDir = path.join(__dirname, "../docs/migrations-sql-preview");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const migration3File = path.join(outDir, "migration_3_create_syllabus_tables.sql");
  fs.writeFileSync(migration3File, sql, "utf-8");

  // Migration 4 SQL Preview (Adicionar coluna canonicalKey em StudySubject)
  let migration4Sql = `-- MIGRATION 4: add_study_subject_canonical_key\n`;
  migration4Sql += `-- 1. Adicionar coluna canonicalKey em StudySubject\n`;
  migration4Sql += `ALTER TABLE "StudySubject" ADD COLUMN IF NOT EXISTS "canonicalKey" TEXT;\n`;

  const migration4File = path.join(outDir, "migration_4_add_study_subject_canonical_key.sql");
  fs.writeFileSync(migration4File, migration4Sql, "utf-8");

  // Migration 5 SQL Preview (Adicionar FK de officialTopicId em StudyBlock)
  let migration5Sql = `-- MIGRATION 5: add_study_block_official_topic_fk\n`;
  migration5Sql += `-- 1. Adicionar Foreign Key entre StudyBlock.officialTopicId e SyllabusTopic.id\n`;
  migration5Sql += `ALTER TABLE "StudyBlock" ADD CONSTRAINT "StudyBlock_officialTopicId_fkey" FOREIGN KEY ("officialTopicId") REFERENCES "SyllabusTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;\n`;

  const migration5File = path.join(outDir, "migration_5_add_study_block_official_topic_fk.sql");
  fs.writeFileSync(migration5File, migration5Sql, "utf-8");

  console.log(`✅ SQLs gerados com sucesso em:\n - ${migration3File}\n - ${migration4File}\n - ${migration5File}`);
  console.log(`Total de tópicos exportados: ${OFFICIAL_TOPICS.length}`);
}

generateSQL();
