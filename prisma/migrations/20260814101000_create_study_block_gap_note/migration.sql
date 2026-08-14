-- CreateEnum
CREATE TYPE "GapNoteStatus" AS ENUM ('READY', 'NOT_REQUIRED', 'FAILED');

-- CreateTable
CREATE TABLE "StudyBlockGapNote" (
    "id" TEXT NOT NULL,
    "studyBlockId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "GapNoteStatus" NOT NULL DEFAULT 'READY',
    "gapItems" JSONB,
    "modelVersion" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    "tokensUsed" INTEGER,
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyBlockGapNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudyBlockGapNote_studyBlockId_key" ON "StudyBlockGapNote"("studyBlockId");

-- CreateIndex
CREATE INDEX "StudyBlockGapNote_userId_status_idx" ON "StudyBlockGapNote"("userId", "status");

-- AddForeignKey
ALTER TABLE "StudyBlockGapNote" ADD CONSTRAINT "StudyBlockGapNote_studyBlockId_fkey" FOREIGN KEY ("studyBlockId") REFERENCES "StudyBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyBlockGapNote" ADD CONSTRAINT "StudyBlockGapNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
