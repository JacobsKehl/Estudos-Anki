-- Fix SyllabusTopic unique index: composite key must include subjectCanonicalKey
-- Original migration 20260813150003 created: (versionId, topicCode)
-- Corrected to: (versionId, subjectCanonicalKey, topicCode) because topicCode
-- (e.g. "Tópico 01") repeats across subjects within the same version.
-- Applied manually via seed-taxonomies-prod.ts on 2026-08-13.

DROP INDEX IF EXISTS "SyllabusTopic_versionId_topicCode_key";
CREATE UNIQUE INDEX IF NOT EXISTS "SyllabusTopic_version_subject_topicCode_key" ON "SyllabusTopic"("versionId", "subjectCanonicalKey", "topicCode");
