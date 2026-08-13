-- MIGRATION 4: add_study_subject_canonical_key
-- 1. Adicionar coluna canonicalKey em StudySubject
ALTER TABLE "StudySubject" ADD COLUMN IF NOT EXISTS "canonicalKey" TEXT;
