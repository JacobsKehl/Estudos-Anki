-- MIGRATION 6: add_study_block_conservative_precredit_fields
-- 1. Adicionar campos para pré-crédito conservador e aviso de 1-clique na UI
ALTER TABLE "StudyBlock" ADD COLUMN IF NOT EXISTS "possiblyAlreadyStudied" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StudyBlock" ADD COLUMN IF NOT EXISTS "sourceV1BlockId" TEXT;
