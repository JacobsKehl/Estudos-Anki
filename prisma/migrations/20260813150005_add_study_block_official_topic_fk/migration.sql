-- =====================================================================
-- RESSALVA DE AMBIENTE (COMPOSIÇÃO REFERENCIAL MANUAL)
-- Nota: Esta migração foi composta com base no Prisma Engine.
--       Em ambiente sem TCP (apenas HTTPS/PostgREST), ela DEVE ser
--       conferida contra um shadow database assim que a porta 5432 estiver disponível.
-- =====================================================================

-- AlterTable
ALTER TABLE "StudyBlock" ADD COLUMN "officialTopicId" TEXT;

-- AddForeignKey
ALTER TABLE "StudyBlock" ADD CONSTRAINT "StudyBlock_officialTopicId_fkey" FOREIGN KEY ("officialTopicId") REFERENCES "SyllabusTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
