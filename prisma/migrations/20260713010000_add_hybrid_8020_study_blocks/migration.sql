-- CreateEnum
CREATE TYPE "StudyMaterialProvider" AS ENUM ('CFC', 'ESTRATEGIA', 'OTHER');

-- CreateEnum
CREATE TYPE "StudyBlockMethodology" AS ENUM ('LINEAR', 'HYBRID_8020');

-- CreateEnum
CREATE TYPE "StudyBlockSourceRole" AS ENUM ('ANCHOR_8020', 'DEEPENING', 'QUESTIONS', 'LAW_TEXT', 'SUPPORT');

-- CreateEnum
CREATE TYPE "StudyBlockSegmentDisposition" AS ENUM ('READ', 'CONSULT', 'SKIP');

-- AlterTable
ALTER TABLE "StudyMaterial" ADD COLUMN     "provider" "StudyMaterialProvider" NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN     "generationReason" TEXT;

-- AlterTable
ALTER TABLE "StudyBlock" ADD COLUMN     "aiAuditMetadata" JSONB,
ADD COLUMN     "generationRunId" TEXT,
ADD COLUMN     "methodology" "StudyBlockMethodology" NOT NULL DEFAULT 'LINEAR';

-- CreateTable
CREATE TABLE "StudyBlockSource" (
    "id" TEXT NOT NULL,
    "studyBlockId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "sourceRole" "StudyBlockSourceRole" NOT NULL,
    "isCanonical" BOOLEAN NOT NULL DEFAULT false,
    "selectionReason" TEXT,
    "confidence" DOUBLE PRECISION,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyBlockSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyBlockSourceSegment" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "disposition" "StudyBlockSegmentDisposition" NOT NULL,
    "pageStart" INTEGER NOT NULL,
    "pageEnd" INTEGER NOT NULL,
    "reason" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyBlockSourceSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyBlockSource_studyBlockId_idx" ON "StudyBlockSource"("studyBlockId");

-- CreateIndex
CREATE INDEX "StudyBlockSource_materialId_idx" ON "StudyBlockSource"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "StudyBlockSource_studyBlockId_materialId_sourceRole_key" ON "StudyBlockSource"("studyBlockId", "materialId", "sourceRole");

-- CreateIndex
CREATE INDEX "StudyBlockSourceSegment_sourceId_disposition_idx" ON "StudyBlockSourceSegment"("sourceId", "disposition");

-- CreateIndex
CREATE UNIQUE INDEX "StudyBlock_generationRunId_key" ON "StudyBlock"("generationRunId");

-- CreateIndex
CREATE INDEX "StudyBlock_methodology_idx" ON "StudyBlock"("methodology");

-- AddForeignKey
ALTER TABLE "StudyBlockSource" ADD CONSTRAINT "StudyBlockSource_studyBlockId_fkey" FOREIGN KEY ("studyBlockId") REFERENCES "StudyBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyBlockSource" ADD CONSTRAINT "StudyBlockSource_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "StudyMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyBlockSourceSegment" ADD CONSTRAINT "StudyBlockSourceSegment_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "StudyBlockSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
