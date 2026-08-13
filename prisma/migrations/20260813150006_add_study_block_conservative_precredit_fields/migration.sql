-- =====================================================================
-- RESSALVA DE AMBIENTE (COMPOSIÇÃO REFERENCIAL MANUAL)
-- Nota: Esta migração foi composta com base no Prisma Engine.
--       Em ambiente sem TCP (apenas HTTPS/PostgREST), ela DEVE ser
--       conferida contra um shadow database assim que a porta 5432 estiver disponível.
-- =====================================================================

-- AlterTable
ALTER TABLE "StudyBlock" ADD COLUMN "possiblyAlreadyStudied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sourceV1BlockId" TEXT;
