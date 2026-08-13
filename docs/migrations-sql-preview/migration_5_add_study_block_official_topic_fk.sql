-- MIGRATION 5: add_study_block_official_topic_fk
-- 1. Adicionar Foreign Key entre StudyBlock.officialTopicId e SyllabusTopic.id
ALTER TABLE "StudyBlock" ADD CONSTRAINT "StudyBlock_officialTopicId_fkey" FOREIGN KEY ("officialTopicId") REFERENCES "SyllabusTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
