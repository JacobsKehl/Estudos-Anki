-- DropIndex
DROP INDEX IF EXISTS "StudyBlock_userId_status_idx";

-- AlterTable
ALTER TABLE "StudyBlock" DROP COLUMN IF EXISTS "status";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StudyBlock_userId_theoryStatus_idx" ON "StudyBlock"("userId", "theoryStatus");
