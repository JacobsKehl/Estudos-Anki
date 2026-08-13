-- MIGRATION 3: create_syllabus_tables_and_seed
-- Auto-gerado por scripts/generate-syllabus-migration-sql.ts
-- DUAS VERSÕES: ESTRATEGIA_COURSE_GRID (ativa, 110 tópicos) + TRT4_2026_PROJETADO (inativa, 109 tópicos)

-- 1. Criar Tabela SyllabusVersion
CREATE TABLE IF NOT EXISTS "SyllabusVersion" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyllabusVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusVersion_label_key" ON "SyllabusVersion"("label");
CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusVersion_single_active" ON "SyllabusVersion"("isActive") WHERE "isActive" = true;

-- 2. Criar Tabela SyllabusSubject
CREATE TABLE IF NOT EXISTS "SyllabusSubject" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "canonicalKey" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "blocoConhecimento" TEXT,
  "questoesDaMateria" INTEGER,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyllabusSubject_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SyllabusSubject_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SyllabusVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusSubject_versionId_canonicalKey_key" ON "SyllabusSubject"("versionId", "canonicalKey");

-- 3. Criar Tabela SyllabusTopic
CREATE TABLE IF NOT EXISTS "SyllabusTopic" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "subjectCanonicalKey" TEXT NOT NULL,
  "subjectName" TEXT NOT NULL,
  "topicCode" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyllabusTopic_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SyllabusTopic_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SyllabusVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SyllabusTopic_subject_fkey" FOREIGN KEY ("versionId", "subjectCanonicalKey") REFERENCES "SyllabusSubject"("versionId", "canonicalKey") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusTopic_versionId_topicCode_key" ON "SyllabusTopic"("versionId", "topicCode");
CREATE INDEX IF NOT EXISTS "SyllabusTopic_versionId_idx" ON "SyllabusTopic"("versionId");
CREATE INDEX IF NOT EXISTS "SyllabusTopic_subjectCanonicalKey_idx" ON "SyllabusTopic"("subjectCanonicalKey");

-- ═══ VERSÃO 1: ESTRATEGIA_COURSE_GRID (ATIVA) ═══
INSERT INTO "SyllabusVersion" ("id", "label", "source", "description", "isActive", "createdAt", "updatedAt")
VALUES ('cm01_estrategia_grid_v1', 'ESTRATEGIA_COURSE_GRID', 'Estratégia Concursos PDF Grid (Legacy initial ingestion)', 'Taxonomia inicial de tópicos baseada no sumário dos materiais do Estratégia Concursos.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("label") DO NOTHING;

-- 4a. Matérias da versão ESTRATEGIA_COURSE_GRID (7 matérias)
INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")
VALUES ('cm01_estrategia_grid_v1__portuguese', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', NULL, NULL, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")
VALUES ('cm01_estrategia_grid_v1__direito_administrativo', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', NULL, NULL, 1.2, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")
VALUES ('cm01_estrategia_grid_v1__direito_constitucional', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', NULL, NULL, 1.2, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")
VALUES ('cm01_estrategia_grid_v1__direito_trabalho', 'cm01_estrategia_grid_v1', 'DIREITO_TRABALHO', 'Direito do Trabalho', NULL, NULL, 2, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")
VALUES ('cm01_estrategia_grid_v1__direito_civil', 'cm01_estrategia_grid_v1', 'DIREITO_CIVIL', 'Direito Civil', NULL, NULL, 1, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")
VALUES ('cm01_estrategia_grid_v1__direito_processual_civil', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', NULL, NULL, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")
VALUES ('cm01_estrategia_grid_v1__direito_processual_trabalho', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', NULL, NULL, 2, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- 4b. Tópicos da versão ESTRATEGIA_COURSE_GRID (110 tópicos)
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t0', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 00', 'Ortografia oficial. Acentuação gráfica.', 'ortografia oficial acentuacao grafica', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t1', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 01', 'Classes de palavras I: substantivo, adjetivo, advérbios, artigo, numeral, interjeição.', 'classes de palavras substantivo adjetivo adverbios artigo numeral interjeicao', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t2', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 02', 'Classes de palavras II: preposição e conjunção.', 'classes de palavras preposicao conjuncao', 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t3', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 03', 'Classes de palavras III: pronomes. Colocação pronominal.', 'classes de palavras pronomes colocacao pronominal', 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t4', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 04', 'Classes de palavras IV: verbos.', 'classes de palavras verbos', 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t5', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 05', 'Correlação e vozes verbais.', 'correlacao vozes verbais', 5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t6', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 06', 'Formação de palavras.', 'formacao de palavras', 6, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t7', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 07', 'Sintaxe da oração: termos da oração.', 'sintaxe da oracao termos da oracao', 7, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t8', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 08', 'Relações de coordenação entre orações e entre termos da oração.', 'relacoes de coordenacao entre oracoes entre termos da oracao', 8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t9', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 09', 'Pontuação.', 'pontuacao', 9, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t10', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 10', 'Concordância Verbal e Nominal.', 'concordancia verbal nominal', 10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t11', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 11', 'Regência verbal e nominal. Crase.', 'regencia verbal nominal crase', 11, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t12', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 12', 'Mecanismos de coesão e coerência textuais.', 'mecanismos de coesao coerencia textuais', 12, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t13', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 13', 'Semântica. Significação das palavras.', 'semantica significacao das palavras', 13, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t14', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 14', 'Compreensão e interpretação de textos. Tipologia textual. Funções da linguagem.', 'compreensao interpretacao de textos tipologia textual funcoes da linguagem', 14, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('portuguese_t15', 'cm01_estrategia_grid_v1', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 15', 'Variação linguística.', 'variacao linguistica', 15, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t0', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 00', 'Princípios administrativos. Regime jurídico-administrativo.', 'principios administrativos regime juridico administrativo expressos implicitos da administracao publica', 0, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t1', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 01', 'Introdução ao direito administrativo. Estado, governo e administração pública.', 'introducao direito administrativo estado governo administracao publica', 1, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t2', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 02', 'Organização administrativa. Administração direta e indireta. Autarquias. Agências.', 'organizacao administrativa administracao direta indireta autarquias agencias', 2, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t3', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 03', 'Fundações públicas. Empresas públicas. Sociedades de economia mista.', 'fundacoes publicas empresas publicas sociedades de economia mista', 3, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t4', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 04', 'Entidades paraestatais e terceiro setor.', 'entidades paraestatais terceiro setor', 4, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t5', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 05', 'Poderes e deveres da Administração Pública.', 'poderes deveres da administracao publica discricionario vinculado hierarquico disciplinar regulamentar de policia', 5, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t6', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 06', 'Atos administrativos.', 'atos administrativos requisitos atributos classificacao especies extincao invalidez', 6, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t7', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 07', 'Licitações e Contratos Administrativos. Lei nº 14.133/2021 — licitações parte 1.', 'licitacoes contratos lei 14133 2021 parte 1', 7, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t8', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 08', 'Licitações e Contratos Administrativos. Lei nº 14.133/2021 — licitações parte 2.', 'licitacoes contratos lei 14133 2021 parte 2', 8, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t9', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 09', 'Licitações e Contratos Administrativos — contratos.', 'licitacoes contratos administrativos', 9, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t10', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 10', 'Serviços públicos. Lei nº 8.987/1995.', 'servicos publicos lei 8987 1995 concessao permissao autorizacao', 10, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t11', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 11', 'PPPs, consórcios públicos e consórcios administrativos.', 'ppps parcerias publico privadas consorcios publicos consorcios administrativos', 11, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t12', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 12', 'Convênios e instrumentos congêneres.', 'convenios instrumentos congeneres', 12, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t13', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 13', 'Controle da Administração Pública.', 'controle da administracao publica administrativo judicial legislativo', 13, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t14', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 14', 'Responsabilidade civil do Estado.', 'responsabilidade civil do estado objetiva subjetiva regressiva', 14, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t15', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 15', 'Bens públicos.', 'bens publicos classificacao afetacao desafetacao aquisicao alienacao', 15, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t16', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 16', 'Intervenção do Estado na propriedade.', 'intervencao do estado na propriedade desapropriacao tombamento servidao ocupacao requisicao', 16, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t17', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 17', 'Agentes públicos.', 'agentes publicos cargos empregos funcoes publicas lei 8112', 17, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t18', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 18', 'Processo administrativo. Lei nº 9.784/1999.', 'processo administrativo lei 9784 1999', 18, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('admin_t19', 'cm01_estrategia_grid_v1', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 19', 'Improbidade administrativa. Lei nº 8.429/1992.', 'improbidade administrativa lei 8429 1992', 19, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t0', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 00', 'Conceitos introdutórios. Classificação e aplicabilidade das normas.', 'conceitos introdutorios principios fundamentais classificacao das constituicoes aplicabilidade interpretacao vigencia eficacia', 0, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t1', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 01', 'Teoria geral dos direitos fundamentais.', 'teoria geral dos direitos fundamentais', 1, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t2', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 02', 'Direitos e deveres individuais e coletivos — Parte I.', 'direitos deveres individuais coletivos parte 1 artigo 5', 2, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t3', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 03', 'Direitos e deveres individuais e coletivos — Parte II.', 'direitos deveres individuais coletivos parte 2', 3, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t4', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 04', 'Direitos sociais.', 'direitos sociais trabalhadores', 4, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t5', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 05', 'Nacionalidade.', 'nacionalidade nato naturalizado', 5, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t6', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 06', 'Direitos políticos.', 'direitos politicos elegibilidade', 6, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t7', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 07', 'Partidos políticos.', 'partidos politicos autonomias', 7, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t8', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 08', 'Organização político-administrativa.', 'organizacao politico administrativa uniao estados distrito federal municipios', 8, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t9', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 09', 'Administração Pública. Servidores públicos.', 'administracao publica principios constituicionais servidores publicos', 9, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t10', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 10', 'Poder Legislativo.', 'poder legislativo congresso camara senado tribunal de contas', 10, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t11', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 11', 'Processo Legislativo. Reforma Constitucional.', 'processo legislativo reforma constitucional emendas', 11, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t12', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 12', 'Poder Executivo.', 'poder executivo presidente da republica ministros de estado atribuicoes responsabilidades', 12, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t13', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 13', 'Poder Judiciário.', 'poder judiciario disposicoes gerais stf stj tst trt tribunais', 13, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t14', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 14', 'Funções essenciais à Justiça.', 'funcoes essenciais justica ministerio publico defensoria advocacia publica', 14, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t15', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 15', 'Ordem Social.', 'ordem social seguridade educacao saude cultura', 15, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('const_t16', 'cm01_estrategia_grid_v1', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 16', 'Controle de Constitucionalidade.', 'controle de constitucionalidade concentrado difuso adi adc adpf', 16, 1.2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('work_t1', 'cm01_estrategia_grid_v1', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 01', 'Princípios e fontes do Direito do Trabalho. Direitos Constitucionais dos Trabalhadores. Renúncia e transação.', 'principios fontes do direito do trabalho constitucionais trabalhadores renuncia transacao', 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('work_t2', 'cm01_estrategia_grid_v1', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 02', 'Relações de trabalho e emprego. Empregado. Empregador.', 'relacoes de trabalho emprego empregado empregador caracteristicas', 2, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('work_t3', 'cm01_estrategia_grid_v1', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 03', 'Terceirização trabalhista.', 'terceirizacao trabalhista atividade fim meio responsabilidade', 3, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('work_t4', 'cm01_estrategia_grid_v1', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 04', 'Contrato de trabalho. Alteração, suspensão e interrupção. Poderes do empregador.', 'contrato de trabalho alteracao suspensao interrupcao poderes do empregador', 4, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('work_t5', 'cm01_estrategia_grid_v1', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 05', 'Término do contrato de trabalho. Aviso prévio. Garantias provisórias de emprego.', 'termino do contrato de trabalho aviso previo garantias provisorias estabilidade', 5, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('work_t6', 'cm01_estrategia_grid_v1', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 06', 'Jornada de trabalho e descansos.', 'jornada de trabalho descansos intervalos horas extras', 6, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('work_t7', 'cm01_estrategia_grid_v1', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 07', 'Remuneração e salário. Equiparação salarial.', 'remuneracao salario equiparacao salarial parcelas salariais', 7, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('work_t8', 'cm01_estrategia_grid_v1', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 08', 'Férias. Prescrição e decadência.', 'ferias prescricao decadencia bienal quinquenal', 8, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('work_t9', 'cm01_estrategia_grid_v1', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 09', 'Segurança e Saúde do Trabalho. CIPA. Trabalho do menor e da mulher.', 'seguranca saude do trabalho cipa menor mulher', 9, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('work_t10', 'cm01_estrategia_grid_v1', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 10', 'Comissões de Conciliação Prévia. Direito Coletivo do Trabalho.', 'comissoes de conciliacao previa direito coletivo do trabalho acordos convencoes coletivas', 10, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('work_t11', 'cm01_estrategia_grid_v1', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 11', 'FGTS.', 'fgts fundo de garantia tempo servico depositos saques', 11, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('work_t12', 'cm01_estrategia_grid_v1', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 12', 'Sindicatos. Greve.', 'sindicatos greve direito a greve limitacoes', 12, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('work_t13', 'cm01_estrategia_grid_v1', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 13', 'Trabalho doméstico.', 'trabalho domestico lei complementar 150', 13, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t0', 'cm01_estrategia_grid_v1', 'DIREITO_CIVIL', 'Direito Civil', 'Tópico 00', 'Lei de Introdução às Normas do Direito Brasileiro.', 'lindb lei de introducao normas do direito brasileiro vigencia eficacia leis', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t1', 'cm01_estrategia_grid_v1', 'DIREITO_CIVIL', 'Direito Civil', 'Tópico 01', 'Pessoas naturais.', 'pessoas naturais personalidade capacidade emancipacao ausencia morte', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t2', 'cm01_estrategia_grid_v1', 'DIREITO_CIVIL', 'Direito Civil', 'Tópico 02', 'Pessoas jurídicas.', 'pessoas juridicas associacoes fundacoes desconsideracao personalidade', 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t3', 'cm01_estrategia_grid_v1', 'DIREITO_CIVIL', 'Direito Civil', 'Tópico 03', 'Bens.', 'bens moveis imoveis fungiveis consumiveis publicos', 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t4', 'cm01_estrategia_grid_v1', 'DIREITO_CIVIL', 'Direito Civil', 'Tópico 04', 'Fatos jurídicos.', 'fatos juridicos negocios juridicos validade defeitos erros dolo coacao fraude', 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t5', 'cm01_estrategia_grid_v1', 'DIREITO_CIVIL', 'Direito Civil', 'Tópico 05', 'Atos jurídicos.', 'atos juridicos lícitos ilicitos', 5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t6', 'cm01_estrategia_grid_v1', 'DIREITO_CIVIL', 'Direito Civil', 'Tópico 06', 'Prescrição e decadência.', 'prescricao decadencia prazos civil', 6, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t7', 'cm01_estrategia_grid_v1', 'DIREITO_CIVIL', 'Direito Civil', 'Tópico 07', 'Direito das obrigações — Parte I.', 'direito das obrigacoes parte 1 dar fazer nao fazer solidarias', 7, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t8', 'cm01_estrategia_grid_v1', 'DIREITO_CIVIL', 'Direito Civil', 'Tópico 08', 'Direito das obrigações — Parte II.', 'direito das obrigacoes parte 2 adimplemento inadimplemento perdas danos', 8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t9', 'cm01_estrategia_grid_v1', 'DIREITO_CIVIL', 'Direito Civil', 'Tópico 09', 'Teoria geral dos contratos.', 'teoria geral dos contratos principios interpretacao', 9, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t10', 'cm01_estrategia_grid_v1', 'DIREITO_CIVIL', 'Direito Civil', 'Tópico 10', 'Responsabilidade civil.', 'responsabilidade civil dano nexo causalidade culpa objetiva subjetiva', 10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t11', 'cm01_estrategia_grid_v1', 'DIREITO_CIVIL', 'Direito Civil', 'Tópico 11', 'Posse e propriedade.', 'posse propriedade aquisicao perda usucapiao', 11, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t12', 'cm01_estrategia_grid_v1', 'DIREITO_CIVIL', 'Direito Civil', 'Tópico 12', 'Direitos reais.', 'direitos reais superficie usufruto hipoteca alienacao fiduciaria', 12, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t0', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 00', 'Normas Fundamentais do Processo Civil.', 'normas fundamentais do processo civil principios cpc', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t1', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 01', 'Jurisdição e Ação.', 'jurisdicao acao elementos condicoes', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t2', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 02', 'Competência.', 'competencia absoluta relativa territorial valor', 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t3', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 03', 'Sujeitos Processuais: Partes e Procuradores. Litisconsórcio e Intervenção de terceiros.', 'sujeitos processuais partes procuradores litisconsorcio intervencao terceiros', 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t4', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 04', 'Sujeitos Processuais: Juízes, Auxiliares da Justiça, Ministério Público, Defensoria Pública e Advocacia Pública.', 'sujeitos processuais juizes auxiliares da justica ministerio publico defensoria advocacia', 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t5', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 05', 'Atos Processuais.', 'atos processuais tempo lugar prazos forma', 5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t6', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 06', 'Comunicação dos Atos Processuais, Nulidade, Valor da Causa, Distribuição e Registro.', 'comunicacao atos processuais nulidade valor da causa distribuicao registro', 6, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t7', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 07', 'Tutela Provisória.', 'tutela provisoria urgencia evidencia cautelar antecipada', 7, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t8', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 08', 'Formação, Suspensão e Extinção do Processo. Procedimento comum até o saneamento.', 'formacao suspensao extincao do processo procedimento comum saneamento peticao inicial', 8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t9', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 09', 'Provas — parte 01.', 'provas parte 1 teoria geral depoimento confissao documentos', 9, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t10', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 10', 'Provas — parte 02.', 'provas parte 2 testemunhal pericial inspecao judicial', 10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t11', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 11', 'Sentença, Coisa Julgada, Liquidação e Cumprimento de Sentença.', 'sentenca coisa julgada liquidacao cumprimento de sentenca', 11, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t12', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 12', 'Processo de Execução.', 'processo de execucao titulos judiciais extrajudiciais embargos', 12, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t13', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 13', 'Procedimentos Especiais — parte 01.', 'procedimentos especiais parte 1 consignacao em pagamento possessorias', 13, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t14', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 14', 'Procedimentos Especiais — parte 02.', 'procedimentos especiais parte 2 inventario partilha monitoria', 14, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t15', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 15', 'Meios de Impugnação das Decisões Judiciais.', 'meios de impugnacao das decisoes judiciais cpc', 15, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t16', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 16', 'Recursos em Espécie.', 'recursos em especie apelacao agravos embargos declaracao especial extraordinario', 16, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t17', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 17', 'Ação Popular, Ação Civil Pública, Mandado de Segurança, Mandado de Injunção, Habeas Data.', 'acao popular acao civil publica mandado seguranca injuncao habeas data', 17, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t18', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 18', 'Processo Civil nos sistemas de controle da constitucionalidade e ações constitucionais.', 'processo civil sistemas controle constitucionalidade acoes constitucionais', 18, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_civil_t19', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 19', 'Processo Judicial Eletrônico. Lei nº 11.419/2006.', 'processo judicial eletronico lei 11419 2006', 19, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_work_t0', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 00', 'Teoria geral do processo do trabalho. Princípios e organização da Justiça do Trabalho.', 'teoria geral processo do trabalho principios organizacao da justica do trabalho', 0, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_work_t1', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 01', 'Competência da Justiça do Trabalho.', 'competencia da justica do trabalho material territorial funcional', 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_work_t2', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 02', 'Serviços Auxiliares da Justiça do Trabalho. Partes e Procuradores. Ministério Público.', 'servicos auxiliares justica do trabalho partes procuradores ministerio publico jus postulandi', 2, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_work_t3', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 03', 'Prazos processuais. Custas. Nulidades processuais. Petição inicial.', 'prazos processuais custas nulidades peticao inicial trabalhista', 3, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_work_t4', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 04', 'Notificação do reclamado. Resposta do réu. Revelia.', 'notificacao reclamado resposta do reu revelia contestacao reconvencao excecoes', 4, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_work_t5', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 05', 'Audiência. Provas. Sentença. Coisa julgada. Rito sumário e sumaríssimo.', 'audiencia provas sentenca coisa julgada rito sumario sumarissimo instrucao julgamento', 5, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_work_t6', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 06', 'Recursos no processo do trabalho — teoria geral e recursos em espécie.', 'recursos processo trabalho teoria geral recursos especie ordinario revista agravos embargos tst', 6, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_work_t7', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 07', 'Liquidação de sentença e processo de execução.', 'liquidacao de sentenca processo de execucao calculos embargos penhora', 7, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_work_t8', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 08', 'Procedimentos especiais trabalhistas.', 'procedimentos especiais trabalhistas consignacao inquerito apuracao falta grave', 8, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_work_t9', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 09', 'Dissídio coletivo de trabalho e ação de cumprimento.', 'dissidio coletivo trabalho acao de cumprimento', 9, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('proc_work_t10', 'cm01_estrategia_grid_v1', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 10', 'Processo Judicial Eletrônico.', 'processo judicial eletronico pje trabalhista', 10, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;

-- ═══ VERSÃO 2: TRT4_2026_PROJETADO (INATIVA) ═══
INSERT INTO "SyllabusVersion" ("id", "label", "source", "description", "isActive", "createdAt", "updatedAt")
VALUES ('cm02_trt4_2026_projetado', 'TRT4_2026_PROJETADO', 'Edital verticalizado TRT4 AJAJ 2026 (projetado a partir de editais anteriores)', 'Taxonomia projetada do edital TRT4 2026, com 109 tópicos em 8 matérias. Inclui RLM e Legislação (peso 1). Versão inativa até edital oficial.', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("label") DO NOTHING;

-- 5a. Matérias da versão TRT4_2026_PROJETADO (8 matérias)
INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")
VALUES ('cm02_trt4_2026_projetado__direito_constitucional', 'cm02_trt4_2026_projetado', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'ESPECIFICOS', 30, 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")
VALUES ('cm02_trt4_2026_projetado__direito_processual_trabalho', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'ESPECIFICOS', 30, 2, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")
VALUES ('cm02_trt4_2026_projetado__direito_trabalho', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'ESPECIFICOS', 30, 2, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")
VALUES ('cm02_trt4_2026_projetado__direito_processual_civil', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'ESPECIFICOS', 30, 2, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")
VALUES ('cm02_trt4_2026_projetado__direito_administrativo', 'cm02_trt4_2026_projetado', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'ESPECIFICOS', 30, 2, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")
VALUES ('cm02_trt4_2026_projetado__portuguese', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'GERAIS', 30, 1, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")
VALUES ('cm02_trt4_2026_projetado__raciocinio_logico_matematico', 'cm02_trt4_2026_projetado', 'RACIOCINIO_LOGICO_MATEMATICO', 'Raciocínio Lógico-Matemático', 'GERAIS', 30, 1, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SyllabusSubject" ("id", "versionId", "canonicalKey", "displayName", "blocoConhecimento", "questoesDaMateria", "weight", "orderIndex", "createdAt", "updatedAt")
VALUES ('cm02_trt4_2026_projetado__legislacao', 'cm02_trt4_2026_projetado', 'LEGISLACAO', 'Legislação', 'GERAIS', 30, 1, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- 5b. Tópicos da versão TRT4_2026_PROJETADO (109 tópicos)
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__const_t1', 'cm02_trt4_2026_projetado', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 01', 'Constituição: Princípios fundamentais', 'constituicao principios fundamentais', 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__const_t2', 'cm02_trt4_2026_projetado', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 02', 'Aplicabilidade, interpretação, vigência e eficácia das normas constitucionais', 'aplicabilidade interpretacao vigencia e eficacia das normas constitucionais', 2, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__const_t3', 'cm02_trt4_2026_projetado', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 03', 'Controle de Constitucionalidade: Sistemas difuso e concentrado; ADI, ADC e ADPF', 'controle de constitucionalidade sistemas difuso e concentrado adi adc e adpf', 3, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__const_t4', 'cm02_trt4_2026_projetado', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 04', 'Direitos e Garantias Fundamentais: Direitos e deveres individuais e coletivos; Direitos sociais', 'direitos e garantias fundamentais direitos e deveres individuais e coletivos direitos sociais', 4, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__const_t5', 'cm02_trt4_2026_projetado', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 05', 'Direitos e Garantias Fundamentais: Nacionalidade e Direitos políticos', 'direitos e garantias fundamentais nacionalidade e direitos politicos', 5, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__const_t6', 'cm02_trt4_2026_projetado', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 06', 'Organização do Estado: Organização político-administrativa da União, Estados, Municípios, DF e Territórios', 'organizacao do estado organizacao politico administrativa da uniao estados municipios df e territorios', 6, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__const_t7', 'cm02_trt4_2026_projetado', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 07', 'Administração Pública: Disposições gerais e Servidores Públicos', 'administracao publica disposicoes gerais e servidores publicos', 7, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__const_t8', 'cm02_trt4_2026_projetado', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 08', 'Poder Executivo: Atribuições e responsabilidades do Presidente da República', 'poder executivo atribuicoes e responsabilidades do presidente da republica', 8, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__const_t9', 'cm02_trt4_2026_projetado', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 09', 'Poder Legislativo: Congresso Nacional, Câmara, Senado, Processo Legislativo e Fiscalização Contábil/Financeira/Orçamentária', 'poder legislativo congresso nacional camara senado processo legislativo e fiscalizacao contabil financeira orcamentaria', 9, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__const_t10', 'cm02_trt4_2026_projetado', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 10', 'Poder Judiciário: Disposições gerais; STF; CNJ; STJ; Tribunais e Juízes do Trabalho; CSJT', 'poder judiciario disposicoes gerais stf cnj stj tribunais e juizes do trabalho csjt', 10, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__const_t11', 'cm02_trt4_2026_projetado', 'DIREITO_CONSTITUCIONAL', 'Direito Constitucional', 'Tópico 11', 'Funções Essenciais à Justiça: Ministério Público, Advocacia Pública, Advocacia e Defensoria Pública', 'funcoes essenciais a justica ministerio publico advocacia publica advocacia e defensoria publica', 11, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t1', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 01', 'Justiça do Trabalho: Organização e competência (Varas, TRTs e TST)', 'justica do trabalho organizacao e competencia varas trts e tst', 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t2', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 02', 'Serviços auxiliares da Justiça do Trabalho (Secretarias, Distribuidores, Oficial de Justiça, Peritos, Honorários Periciais, Gratuidade)', 'servicos auxiliares da justica do trabalho secretarias distribuidores oficial de justica peritos honorarios periciais gratuidade', 2, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t3', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 03', 'Ministério Público do Trabalho: Organização e competência', 'ministerio publico do trabalho organizacao e competencia', 3, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t4', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 04', 'Princípios gerais do processo trabalhista (aplicação subsidiária do CPC). Prescrição, decadência e prescrição intercorrente', 'principios gerais do processo trabalhista aplicacao subsidiaria do cpc prescricao decadencia e prescricao intercorrente', 4, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t5', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 05', 'Atos, termos e prazos processuais. Distribuição. Valor da causa. Custas e emolumentos', 'atos termos e prazos processuais distribuicao valor da causa custas e emolumentos', 5, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t6', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 06', 'Partes e procuradores: Jus postulandi; Substituição e representação processual; Massa falida e Recuperação Judicial', 'partes e procuradores jus postulandi substituicao e representacao processual massa falida e recuperacao judicial', 6, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t7', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 07', 'Litisconsórcio, Assistência judiciária, Honorários advocatícios', 'litisconsorcio assistencia judiciaria honorarios advocaticios', 7, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t8', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 08', 'Nulidades e Exceções. Dano processual. Conflitos de jurisdição/competência', 'nulidades e excecoes dano processual conflitos de jurisdicao competencia', 8, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t9', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 09', 'Audiências (conciliação, instrução, julgamento); Notificação, Arquivamento, Revelia e Confissão', 'audiencias conciliacao instrucao julgamento notificacao arquivamento revelia e confissao', 9, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t10', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 10', 'Provas. Decisão e sua eficácia', 'provas decisao e sua eficacia', 10, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t11', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 11', 'Dissídios individuais: Reclamação escrita e verbal, Legitimidade, Procedimento Ordinário e Sumaríssimo', 'dissidios individuais reclamacao escrita e verbal legitimidade procedimento ordinario e sumarissimo', 11, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t12', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 12', 'Procedimentos especiais: Inquérito para apuração de falta grave, Ação Rescisória, Mandado de Segurança, Ação Civil Pública', 'procedimentos especiais inquerito para apuracao de falta grave acao rescisoria mandado de seguranca acao civil publica', 12, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t13', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 13', 'IDPJ e Homologação de acordo extrajudicial (Jurisdição Voluntária)', 'idpj e homologacao de acordo extrajudicial jurisdicao voluntaria', 13, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t14', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 14', 'Liquidação da sentença (cálculo, artigos, arbitramento). Dissídios coletivos (extensão, cumprimento, revisão)', 'liquidacao da sentenca calculo artigos arbitramento dissidios coletivos extensao cumprimento revisao', 14, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t15', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 15', 'Execução: Provisória e definitiva, Prestações sucessivas, Fazenda Pública, Massa Falida. Citação, depósito, penhora, bens impenhoráveis (Lei 8.009/90)', 'execucao provisoria e definitiva prestacoes sucessivas fazenda publica massa falida citacao deposito penhora bens impenhoraveis lei 8 009 90', 15, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t16', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 16', 'Garantias na execução (Seguro-fiança, seguro-garantia). Embargos à execução, Impugnação, Embargos de terceiro, Praça/Leilão/Arrematação', 'garantias na execucao seguro fianca seguro garantia embargos a execucao impugnacao embargos de terceiro praca leilao arrematacao', 16, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t17', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 17', 'Recursos no processo do trabalho', 'recursos no processo do trabalho', 17, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t18', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 18', 'Processo Judicial Eletrônico (PJe); Reforma Trabalhista (Lei 13.467/2017); Leis 6.858/80 e 5.584/70', 'processo judicial eletronico pje reforma trabalhista lei 13 467 2017 leis 6 858 80 e 5 584 70', 18, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t19', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 19', 'Política Judiciária de Solução de Disputas (Res. CSJT 174/16 e 288/21, RA TRT4 05/22)', 'politica judiciaria de solucao de disputas res csjt 174 16 e 288 21 ra trt4 05 22', 19, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_trab_t20', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_TRABALHO', 'Direito Processual do Trabalho', 'Tópico 20', 'Súmulas, OJ, IN e Atos do TST; Súmulas Vinculantes do STF relativas ao Processo do Trabalho', 'sumulas oj in e atos do tst sumulas vinculantes do stf relativas ao processo do trabalho', 20, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t1', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 01', 'Princípios e fontes do Direito do Trabalho. Direitos constitucionais dos trabalhadores (art. 7º CF/88)', 'principios e fontes do direito do trabalho direitos constitucionais dos trabalhadores art 7o cf 88', 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t2', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 02', 'Relação de trabalho vs. relação de emprego; Trabalho autônomo, eventual, temporário, avulso e intermitente', 'relacao de trabalho vs relacao de emprego trabalho autonomo eventual temporario avulso e intermitente', 2, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t3', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 03', 'Sujeitos do contrato: Empregado e Empregador; Poderes do empregador; Grupo econômico; Sucessão; Responsabilidade solidária e subsidiária', 'sujeitos do contrato empregado e empregador poderes do empregador grupo economico sucessao responsabilidade solidaria e subsidiaria', 3, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t4', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 04', 'CTPS: Emissão, entrega, anotações e valor probatório', 'ctps emissao entrega anotacoes e valor probatorio', 4, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t5', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 05', 'Contrato individual de trabalho: Conceito, classificação, características; Alteração (unilateral/bilateral, jus variandi)', 'contrato individual de trabalho conceito classificacao caracteristicas alteracao unilateral bilateral jus variandi', 5, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t6', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 06', 'Suspensão e Interrupção do contrato de trabalho', 'suspensao e interrupcao do contrato de trabalho', 6, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t7', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 07', 'Rescisão contratual: Justas causas, Despedida indireta, Dispensa arbitrária, Despedida coletiva, Culpa recíproca, Indenização, Aviso prévio', 'rescisao contratual justas causas despedida indireta dispensa arbitraria despedida coletiva culpa reciproca indenizacao aviso previo', 7, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t8', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 08', 'Estabilidade e garantias provisórias de emprego; Reintegração; Força maior', 'estabilidade e garantias provisorias de emprego reintegracao forca maior', 8, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t9', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 09', 'Duração do trabalho: Jornada, In itinere, Descansos, Intervalos, DSR, Trabalho noturno e extraordinário, Compensação de horas', 'duracao do trabalho jornada in itinere descansos intervalos dsr trabalho noturno e extraordinario compensacao de horas', 9, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t10', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 10', 'Salário mínimo; Férias (duração, concessão, coletivas, remuneração, abono, rescisão)', 'salario minimo ferias duracao concessao coletivas remuneracao abono rescisao', 10, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t11', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 11', 'Salário e Remuneração: Conceito, composição, modalidades, pagamento, 13º salário; Equiparação salarial, Desvio de função', 'salario e remuneracao conceito composicao modalidades pagamento 13o salario equiparacao salarial desvio de funcao', 11, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t12', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 12', 'FGTS. Prescrição e decadência trabalhista', 'fgts prescricao e decadencia trabalhista', 12, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t13', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 13', 'Segurança e Medicina no Trabalho: CIPA, EPI, Atividades insalubres e perigosas', 'seguranca e medicina no trabalho cipa epi atividades insalubres e perigosas', 13, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t14', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 14', 'Proteção ao trabalho da mulher, gestante e menor. Licença-maternidade e estabilidade da gestante (art. 10, ADCT)', 'protecao ao trabalho da mulher gestante e menor licenca maternidade e estabilidade da gestante art 10 adct', 14, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t15', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 15', 'Direito Coletivo: Liberdade sindical (Convenção 87 OIT), Categoria diferenciada, Convenções e Acordos Coletivos, Greve', 'direito coletivo liberdade sindical convencao 87 oit categoria diferenciada convencoes e acordos coletivos greve', 15, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t16', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 16', 'Renúncia e Transação. Teletrabalho (Lei 13.467/2017). Dano moral trabalhista', 'renuncia e transacao teletrabalho lei 13 467 2017 dano moral trabalhista', 16, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t17', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 17', 'Acidentes de trabalho; Responsabilidade civil trabalhista; Assédio moral e sexual; Princípio da não discriminação', 'acidentes de trabalho responsabilidade civil trabalhista assedio moral e sexual principio da nao discriminacao', 17, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__trab_t18', 'cm02_trt4_2026_projetado', 'DIREITO_TRABALHO', 'Direito do Trabalho', 'Tópico 18', 'Súmulas, OJ e Atos do TST; Súmulas Vinculantes do STF relativas ao Direito do Trabalho', 'sumulas oj e atos do tst sumulas vinculantes do stf relativas ao direito do trabalho', 18, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_civil_t1', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 01', 'Código de Processo Civil (Lei 13.105/2015): Princípios gerais, fontes, eficácia, aplicação, interpretação e direito intertemporal', 'codigo de processo civil lei 13 105 2015 principios gerais fontes eficacia aplicacao interpretacao e direito intertemporal', 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_civil_t2', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 02', 'Jurisdição (conceito, características, limites) e Competência (absoluta, relativa, modificações, conflitos)', 'jurisdicao conceito caracteristicas limites e competencia absoluta relativa modificacoes conflitos', 2, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_civil_t3', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 03', 'Direito de ação (elementos, condições, cumulação, conexão e continência). Relação jurídica processual e pressupostos', 'direito de acao elementos condicoes cumulacao conexao e continencia relacao juridica processual e pressupostos', 3, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_civil_t4', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 04', 'Sujeitos do Processo: Partes, procuradores, capacidade, representação, honorários, gratuidade da justiça, Litisconsórcio', 'sujeitos do processo partes procuradores capacidade representacao honorarios gratuidade da justica litisconsorcio', 4, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_civil_t5', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 05', 'Intervenção de terceiros: Assistência, Denunciação, Chamamento, IDPJ, Amicus Curiae', 'intervencao de terceiros assistencia denunciacao chamamento idpj amicus curiae', 5, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_civil_t6', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 06', 'Juiz (poderes, deveres, impedimento e suspeição). Auxiliares da justiça, MP, Advocacia Pública e Defensoria Pública', 'juiz poderes deveres impedimento e suspeicao auxiliares da justica mp advocacia publica e defensoria publica', 6, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_civil_t7', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 07', 'Atos processuais (forma, tempo, lugar, prazos), Comunicação dos atos (citação, intimação) e Nulidades', 'atos processuais forma tempo lugar prazos comunicacao dos atos citacao intimacao e nulidades', 7, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_civil_t8', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 08', 'Tutela Provisória (urgência e evidência). Formação, suspensão e extinção do processo', 'tutela provisoria urgencia e evidencia formacao suspensao e extincao do processo', 8, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_civil_t9', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 09', 'Procedimento comum: Petição inicial, Contestação, Reconvenção, Revelia, Saneamento e Julgamento conforme o estado', 'procedimento comum peticao inicial contestacao reconvencao revelia saneamento e julgamento conforme o estado', 9, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_civil_t10', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 10', 'Provas: Ônus, depoimento pessoal, confissão, documentos, testemunhas, perícia, inspeção judicial', 'provas onus depoimento pessoal confissao documentos testemunhas pericia inspecao judicial', 10, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_civil_t11', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 11', 'Sentença (elementos, efeitos, remessa necessária), Coisa Julgada, Liquidação e Cumprimento de Sentença', 'sentenca elementos efeitos remessa necessaria coisa julgada liquidacao e cumprimento de sentenca', 11, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_civil_t12', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 12', 'Recursos: Disposições gerais, Agravo Interno e de Instrumento, Embargos de Declaração, Repercussão Geral, Recursos Repetitivos', 'recursos disposicoes gerais agravo interno e de instrumento embargos de declaracao repercussao geral recursos repetitivos', 12, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_civil_t13', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 13', 'Processo de Execução: Princípios, execução contra a Fazenda Pública (Precatórios e RPV), Penhora, Expropriação, Embargos, Exceção de Pré-executividade', 'processo de execucao principios execucao contra a fazenda publica precatorios e rpv penhora expropriacao embargos excecao de pre executividade', 13, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_civil_t14', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 14', 'Procedimentos especiais e Ações Constitucionais: Consignação, Embargos de Terceiro, Monitória, Ação Civil Pública, Mandado de Segurança, Mandado de Injunção, Habeas Data', 'procedimentos especiais e acoes constitucionais consignacao embargos de terceiro monitoria acao civil publica mandado de seguranca mandado de injuncao habeas data', 14, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__proc_civil_t15', 'cm02_trt4_2026_projetado', 'DIREITO_PROCESSUAL_CIVIL', 'Direito Processual Civil', 'Tópico 15', 'Controle de Constitucionalidade no CPC: ADI, ADC, Arguição incidental, IAC, IRDR, Ação Rescisória, Reclamação', 'controle de constitucionalidade no cpc adi adc arguicao incidental iac irdr acao rescisoria reclamacao', 15, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__adm_t1', 'cm02_trt4_2026_projetado', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 01', 'Administração Pública: Princípios básicos e Poderes Administrativos (hierárquico, disciplinar, regulamentar, polícia, uso/abuso de poder)', 'administracao publica principios basicos e poderes administrativos hierarquico disciplinar regulamentar policia uso abuso de poder', 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__adm_t2', 'cm02_trt4_2026_projetado', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 02', 'Ato administrativo: Conceito, requisitos, atributos, anulação, revogação, convalidação, discricionariedade e vinculação', 'ato administrativo conceito requisitos atributos anulacao revogacao convalidacao discricionariedade e vinculacao', 2, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__adm_t3', 'cm02_trt4_2026_projetado', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 03', 'Organização administrativa: Administração direta e indireta, Autarquias, Fundações, Empresas Públicas, Sociedades de Economia Mista, Consórcios Públicos (Lei 11.107/05)', 'organizacao administrativa administracao direta e indireta autarquias fundacoes empresas publicas sociedades de economia mista consorcios publicos lei 11 107 05', 3, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__adm_t4', 'cm02_trt4_2026_projetado', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 04', 'Servidores públicos: Cargo, emprego e função; Lei nº 8.112/1990; Lei nº 11.416/2006 (Carreiras do PJU)', 'servidores publicos cargo emprego e funcao lei no 8 112 1990 lei no 11 416 2006 carreiras do pju', 4, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__adm_t5', 'cm02_trt4_2026_projetado', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 05', 'Processo administrativo federal (Lei nº 9.784/1999)', 'processo administrativo federal lei no 9 784 1999', 5, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__adm_t6', 'cm02_trt4_2026_projetado', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 06', 'Controle e responsabilização da administração (administrativo, judicial, legislativo); Responsabilidade extracontratual do Estado', 'controle e responsabilizacao da administracao administrativo judicial legislativo responsabilidade extracontratual do estado', 6, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__adm_t7', 'cm02_trt4_2026_projetado', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 07', 'Improbidade Administrativa (Lei nº 8.429/1992 e Lei nº 14.230/2021)', 'improbidade administrativa lei no 8 429 1992 e lei no 14 230 2021', 7, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__adm_t8', 'cm02_trt4_2026_projetado', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 08', 'Nova Lei de Licitações e Contratos Administrativos (Lei nº 14.133/2021)', 'nova lei de licitacoes e contratos administrativos lei no 14 133 2021', 8, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__adm_t9', 'cm02_trt4_2026_projetado', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 09', 'Serviços públicos: Conceito, regime jurídico, princípios, delegação (autorização, permissão, concessão)', 'servicos publicos conceito regime juridico principios delegacao autorizacao permissao concessao', 9, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__adm_t10', 'cm02_trt4_2026_projetado', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 10', 'Bens públicos (classificação, regime jurídico, formas de uso) e Intervenção do Estado na propriedade (desapropriação, servidão, tombamento)', 'bens publicos classificacao regime juridico formas de uso e intervencao do estado na propriedade desapropriacao servidao tombamento', 10, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__adm_t11', 'cm02_trt4_2026_projetado', 'DIREITO_ADMINISTRATIVO', 'Direito Administrativo', 'Tópico 11', 'Terceiro Setor e Entes paraestatais', 'terceiro setor e entes paraestatais', 11, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t1', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 01', 'Domínio da ortografia oficial', 'dominio da ortografia oficial', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t2', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 02', 'Emprego da acentuação gráfica', 'emprego da acentuacao grafica', 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t3', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 03', 'Emprego dos sinais de pontuação', 'emprego dos sinais de pontuacao', 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t4', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 04', 'Emprego do sinal indicativo de crase', 'emprego do sinal indicativo de crase', 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t5', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 05', 'Flexão nominal e verbal', 'flexao nominal e verbal', 5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t6', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 06', 'Pronomes: emprego, formas de tratamento e colocação (pronominal)', 'pronomes emprego formas de tratamento e colocacao pronominal', 6, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t7', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 07', 'Domínio dos mecanismos de coesão e coerência textual', 'dominio dos mecanismos de coesao e coerencia textual', 7, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t8', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 08', 'Emprego de tempos e modos verbais e Vozes do verbo', 'emprego de tempos e modos verbais e vozes do verbo', 8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t9', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 09', 'Concordância nominal e verbal', 'concordancia nominal e verbal', 9, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t10', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 10', 'Regência nominal e verbal', 'regencia nominal e verbal', 10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t11', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 11', 'Morfossintaxe, Classes de palavras e Termos da oração', 'morfossintaxe classes de palavras e termos da oracao', 11, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t12', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 12', 'Processos de coordenação e subordinação', 'processos de coordenacao e subordinacao', 12, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t13', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 13', 'Redação (confronto e reconhecimento de frases corretas e incorretas)', 'redacao confronto e reconhecimento de frases corretas e incorretas', 13, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t14', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 14', 'Compreensão e interpretação de textos de gêneros variados', 'compreensao e interpretacao de textos de generos variados', 14, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t15', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 15', 'Reconhecimento de tipos e gêneros textuais', 'reconhecimento de tipos e generos textuais', 15, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t16', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 16', 'Figuras de linguagem e Argumentação', 'figuras de linguagem e argumentacao', 16, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t17', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 17', 'Discurso direto, indireto e indireto livre', 'discurso direto indireto e indireto livre', 17, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__port_t18', 'cm02_trt4_2026_projetado', 'PORTUGUESE', 'Língua Portuguesa', 'Tópico 18', 'Adequação da linguagem ao tipo de documento', 'adequacao da linguagem ao tipo de documento', 18, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__rlm_t1', 'cm02_trt4_2026_projetado', 'RACIOCINIO_LOGICO_MATEMATICO', 'Raciocínio Lógico-Matemático', 'Tópico 01', 'Números inteiros e racionais: operações; expressões numéricas; múltiplos e divisores; problemas', 'numeros inteiros e racionais operacoes expressoes numericas multiplos e divisores problemas', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__rlm_t2', 'cm02_trt4_2026_projetado', 'RACIOCINIO_LOGICO_MATEMATICO', 'Raciocínio Lógico-Matemático', 'Tópico 02', 'Frações e operações com frações', 'fracoes e operacoes com fracoes', 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__rlm_t3', 'cm02_trt4_2026_projetado', 'RACIOCINIO_LOGICO_MATEMATICO', 'Raciocínio Lógico-Matemático', 'Tópico 03', 'Números e grandezas proporcionais: razões e proporções, divisão proporcional, regra de três, porcentagem', 'numeros e grandezas proporcionais razoes e proporcoes divisao proporcional regra de tres porcentagem', 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__rlm_t4', 'cm02_trt4_2026_projetado', 'RACIOCINIO_LOGICO_MATEMATICO', 'Raciocínio Lógico-Matemático', 'Tópico 04', 'Estrutura lógica de relações arbitrárias entre pessoas, lugares, objetos ou eventos fictícios', 'estrutura logica de relacoes arbitrarias entre pessoas lugares objetos ou eventos ficticios', 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__rlm_t5', 'cm02_trt4_2026_projetado', 'RACIOCINIO_LOGICO_MATEMATICO', 'Raciocínio Lógico-Matemático', 'Tópico 05', 'Raciocínio verbal, matemático, sequencial, orientação espacial e temporal, formação de conceitos', 'raciocinio verbal matematico sequencial orientacao espacial e temporal formacao de conceitos', 5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__rlm_t6', 'cm02_trt4_2026_projetado', 'RACIOCINIO_LOGICO_MATEMATICO', 'Raciocínio Lógico-Matemático', 'Tópico 06', 'Compreensão do processo lógico que conduz a conclusões determinadas', 'compreensao do processo logico que conduz a conclusoes determinadas', 6, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__legis_t1', 'cm02_trt4_2026_projetado', 'LEGISLACAO', 'Legislação', 'Tópico 01', 'Lei nº 8.112/1990: Disposições Preliminares; Provimento, Vacância, Remoção, Redistribuição e Substituição', 'lei no 8 112 1990 disposicoes preliminares provimento vacancia remocao redistribuicao e substituicao', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__legis_t2', 'cm02_trt4_2026_projetado', 'LEGISLACAO', 'Legislação', 'Tópico 02', 'Lei nº 8.112/1990: Direitos e Vantagens (Vencimento/Remuneração, Vantagens, Férias, Licenças, Afastamentos)', 'lei no 8 112 1990 direitos e vantagens vencimento remuneracao vantagens ferias licencas afastamentos', 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__legis_t3', 'cm02_trt4_2026_projetado', 'LEGISLACAO', 'Legislação', 'Tópico 03', 'Lei nº 8.112/1990: Regime Disciplinar (Deveres, Proibições, Acumulação, Responsabilidades, Penalidades, PAD)', 'lei no 8 112 1990 regime disciplinar deveres proibicoes acumulacao responsabilidades penalidades pad', 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__legis_t4', 'cm02_trt4_2026_projetado', 'LEGISLACAO', 'Legislação', 'Tópico 04', 'Lei nº 9.784/1999 (Processo Administrativo na Administração Pública Federal)', 'lei no 9 784 1999 processo administrativo na administracao publica federal', 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__legis_t5', 'cm02_trt4_2026_projetado', 'LEGISLACAO', 'Legislação', 'Tópico 05', 'Lei nº 8.429/1992 e Lei nº 14.230/2021 (Improbidade Administrativa)', 'lei no 8 429 1992 e lei no 14 230 2021 improbidade administrativa', 5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__legis_t6', 'cm02_trt4_2026_projetado', 'LEGISLACAO', 'Legislação', 'Tópico 06', 'Lei nº 14.133/2021 (Nova Lei de Licitações e Contratos Administrativos)', 'lei no 14 133 2021 nova lei de licitacoes e contratos administrativos', 6, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__legis_t7', 'cm02_trt4_2026_projetado', 'LEGISLACAO', 'Legislação', 'Tópico 07', 'Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD)', 'lei no 13 709 2018 lei geral de protecao de dados pessoais lgpd', 7, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__legis_t8', 'cm02_trt4_2026_projetado', 'LEGISLACAO', 'Legislação', 'Tópico 08', 'Lei nº 13.146/2015 (Estatuto da Pessoa com Deficiência / LBI)', 'lei no 13 146 2015 estatuto da pessoa com deficiencia lbi', 8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__legis_t9', 'cm02_trt4_2026_projetado', 'LEGISLACAO', 'Legislação', 'Tópico 09', 'Regimento Interno do TRT da 4ª Região', 'regimento interno do trt da 4a regiao', 9, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('trt4_2026p__legis_t10', 'cm02_trt4_2026_projetado', 'LEGISLACAO', 'Legislação', 'Tópico 10', 'Resolução CNJ nº 400/2021 (Política de Sustentabilidade no Poder Judiciário)', 'resolucao cnj no 400 2021 politica de sustentabilidade no poder judiciario', 10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
