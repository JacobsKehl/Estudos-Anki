-- MIGRATION 4: add_official_topic_fk
-- 1. Adicionar coluna canonicalKey em StudySubject
ALTER TABLE "StudySubject" ADD COLUMN IF NOT EXISTS "canonicalKey" TEXT;

-- 2. Adicionar Foreign Key entre StudyBlock.officialTopicId e SyllabusTopic.id
ALTER TABLE "StudyBlock" ADD CONSTRAINT "StudyBlock_officialTopicId_fkey" FOREIGN KEY ("officialTopicId") REFERENCES "SyllabusTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
