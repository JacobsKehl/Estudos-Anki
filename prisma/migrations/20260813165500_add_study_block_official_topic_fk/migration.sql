-- Add Foreign Key: StudyBlock.officialTopicId → SyllabusTopic.id
-- Applied manually via scripts/apply-official-topic-fk.ts
-- ON DELETE SET NULL: se o SyllabusTopic for excluído, officialTopicId fica NULL (não apaga o StudyBlock)
-- ON UPDATE CASCADE: se o id do SyllabusTopic mudar, propaga para StudyBlock

ALTER TABLE "StudyBlock" ADD CONSTRAINT "StudyBlock_officialTopicId_fkey"
  FOREIGN KEY ("officialTopicId") REFERENCES "SyllabusTopic"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
