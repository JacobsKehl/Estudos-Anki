-- 1. Converter quaisquer blocos HYBRID_8020 para LINEAR antes da alteração do tipo
UPDATE "StudyBlock" SET "methodology" = 'LINEAR' WHERE "methodology"::text = 'HYBRID_8020';

-- 2. Remover tabelas e foreign keys associadas ao motor híbrido
DROP TABLE IF EXISTS "StudyBlockSourceSegment" CASCADE;
DROP TABLE IF EXISTS "StudyBlockSource" CASCADE;

-- 3. Remover enums exclusivos do motor híbrido
DROP TYPE IF EXISTS "StudyBlockSourceRole" CASCADE;
DROP TYPE IF EXISTS "StudyBlockSegmentDisposition" CASCADE;

-- 4. Remover campo aiAuditMetadata de StudyBlock
ALTER TABLE "StudyBlock" DROP COLUMN IF EXISTS "aiAuditMetadata";

-- 5. Atualizar enum StudyBlockMethodology (remover HYBRID_8020, adicionar ANCHOR_BASED)
ALTER TYPE "StudyBlockMethodology" RENAME TO "StudyBlockMethodology_old";
CREATE TYPE "StudyBlockMethodology" AS ENUM ('LINEAR', 'ANCHOR_BASED');

ALTER TABLE "StudyBlock" ALTER COLUMN "methodology" DROP DEFAULT;
ALTER TABLE "StudyBlock" ALTER COLUMN "methodology" TYPE "StudyBlockMethodology" USING (
  CASE 
    WHEN "methodology"::text = 'HYBRID_8020' THEN 'LINEAR'::"StudyBlockMethodology"
    WHEN "methodology"::text = 'ANCHOR_BASED' THEN 'ANCHOR_BASED'::"StudyBlockMethodology"
    ELSE 'LINEAR'::"StudyBlockMethodology"
  END
);
ALTER TABLE "StudyBlock" ALTER COLUMN "methodology" SET DEFAULT 'LINEAR';
DROP TYPE "StudyBlockMethodology_old";
