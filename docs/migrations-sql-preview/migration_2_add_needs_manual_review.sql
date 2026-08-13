-- MIGRATION 2: add_needs_manual_review
-- Adiciona a coluna needsManualReview à tabela StudyBlock
ALTER TABLE "StudyBlock" ADD COLUMN IF NOT EXISTS "needsManualReview" BOOLEAN NOT NULL DEFAULT false;
