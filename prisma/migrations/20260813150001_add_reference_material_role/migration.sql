-- =====================================================================
-- RESSALVA DE AMBIENTE (COMPOSIÇÃO REFERENCIAL MANUAL)
-- Nota: Esta migração foi composta com base no Prisma Engine.
--       Em ambiente sem TCP (apenas HTTPS/PostgREST), ela DEVE ser
--       conferida contra um shadow database assim que a porta 5432 estiver disponível.
-- =====================================================================

-- AlterEnum
ALTER TYPE "MaterialRole" ADD VALUE 'REFERENCE_MATERIAL';
