-- MIGRATION 3: create_syllabus_tables_and_seed
-- Auto-gerado por scripts/generate-syllabus-migration-sql.ts

-- 1. Criar Tabela SyllabusVersion
CREATE TABLE IF NOT EXISTS "SyllabusVersion" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyllabusVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusVersion_label_key" ON "SyllabusVersion"("label");
CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusVersion_single_active" ON "SyllabusVersion"("isActive") WHERE "isActive" = true;

-- 2. Criar Tabela SyllabusTopic
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
  CONSTRAINT "SyllabusTopic_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SyllabusVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusTopic_versionId_topicCode_key" ON "SyllabusTopic"("versionId", "topicCode");
CREATE INDEX IF NOT EXISTS "SyllabusTopic_versionId_idx" ON "SyllabusTopic"("versionId");
CREATE INDEX IF NOT EXISTS "SyllabusTopic_subjectCanonicalKey_idx" ON "SyllabusTopic"("subjectCanonicalKey");

-- 3. Insert da Versão Ativa 'ESTRATEGIA_COURSE_GRID'
INSERT INTO "SyllabusVersion" ("id", "label", "source", "description", "isActive", "createdAt", "updatedAt")
VALUES ('cm01_estrategia_grid_v1', 'ESTRATEGIA_COURSE_GRID', 'Estratégia Concursos PDF Grid (Legacy initial ingestion)', 'Taxonomia inicial de tópicos baseada no sumário dos materiais do Estratégia Concursos.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("label") DO NOTHING;

-- 4. Inserts dos 110 tópicos oficiais da versão ESTRATEGIA_COURSE_GRID
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
VALUES ('civil_t0', 'cm01_estrategia_grid_v1', 'OUTROS', 'Direito Civil', 'Tópico 00', 'Lei de Introdução às Normas do Direito Brasileiro.', 'lindb lei de introducao normas do direito brasileiro vigencia eficacia leis', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t1', 'cm01_estrategia_grid_v1', 'OUTROS', 'Direito Civil', 'Tópico 01', 'Pessoas naturais.', 'pessoas naturais personalidade capacidade emancipacao ausencia morte', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t2', 'cm01_estrategia_grid_v1', 'OUTROS', 'Direito Civil', 'Tópico 02', 'Pessoas jurídicas.', 'pessoas juridicas associacoes fundacoes desconsideracao personalidade', 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t3', 'cm01_estrategia_grid_v1', 'OUTROS', 'Direito Civil', 'Tópico 03', 'Bens.', 'bens moveis imoveis fungiveis consumiveis publicos', 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t4', 'cm01_estrategia_grid_v1', 'OUTROS', 'Direito Civil', 'Tópico 04', 'Fatos jurídicos.', 'fatos juridicos negocios juridicos validade defeitos erros dolo coacao fraude', 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t5', 'cm01_estrategia_grid_v1', 'OUTROS', 'Direito Civil', 'Tópico 05', 'Atos jurídicos.', 'atos juridicos lícitos ilicitos', 5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t6', 'cm01_estrategia_grid_v1', 'OUTROS', 'Direito Civil', 'Tópico 06', 'Prescrição e decadência.', 'prescricao decadencia prazos civil', 6, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t7', 'cm01_estrategia_grid_v1', 'OUTROS', 'Direito Civil', 'Tópico 07', 'Direito das obrigações — Parte I.', 'direito das obrigacoes parte 1 dar fazer nao fazer solidarias', 7, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t8', 'cm01_estrategia_grid_v1', 'OUTROS', 'Direito Civil', 'Tópico 08', 'Direito das obrigações — Parte II.', 'direito das obrigacoes parte 2 adimplemento inadimplemento perdas danos', 8, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t9', 'cm01_estrategia_grid_v1', 'OUTROS', 'Direito Civil', 'Tópico 09', 'Teoria geral dos contratos.', 'teoria geral dos contratos principios interpretacao', 9, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t10', 'cm01_estrategia_grid_v1', 'OUTROS', 'Direito Civil', 'Tópico 10', 'Responsabilidade civil.', 'responsabilidade civil dano nexo causalidade culpa objetiva subjetiva', 10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t11', 'cm01_estrategia_grid_v1', 'OUTROS', 'Direito Civil', 'Tópico 11', 'Posse e propriedade.', 'posse propriedade aquisicao perda usucapiao', 11, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "title" = EXCLUDED."title", "subjectCanonicalKey" = EXCLUDED."subjectCanonicalKey", "updatedAt" = CURRENT_TIMESTAMP;
INSERT INTO "SyllabusTopic" ("id", "versionId", "subjectCanonicalKey", "subjectName", "topicCode", "title", "normalizedTitle", "orderIndex", "weight", "createdAt", "updatedAt")
VALUES ('civil_t12', 'cm01_estrategia_grid_v1', 'OUTROS', 'Direito Civil', 'Tópico 12', 'Direitos reais.', 'direitos reais superficie usufruto hipoteca alienacao fiduciaria', 12, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
