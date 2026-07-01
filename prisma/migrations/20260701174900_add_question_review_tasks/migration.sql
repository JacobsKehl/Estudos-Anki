-- CreateEnum
CREATE TYPE "QuestionReviewStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "QuestionReviewOrigin" AS ENUM ('AUTOMATIC', 'BACKFILL');

-- CreateTable
CREATE TABLE "QuestionReviewTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyBlockId" TEXT,
    "subjectId" TEXT NOT NULL,
    "sourceBlockTitle" TEXT NOT NULL,
    "sourceMaterialName" TEXT,
    "sourcePageStart" INTEGER,
    "sourcePageEnd" INTEGER,
    "sourceSubjectName" TEXT NOT NULL,
    "questionBankUrl" TEXT,
    "recommendedQuestionCount" INTEGER NOT NULL DEFAULT 15,
    "sourceStudyDate" TIMESTAMP(3) NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "status" "QuestionReviewStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "questionsAttempted" INTEGER,
    "correctCount" INTEGER,
    "wrongCount" INTEGER,
    "cfcPdfName" TEXT,
    "cfcStartPage" INTEGER,
    "cfcEndPage" INTEGER,
    "cfcTopic" TEXT,
    "cfcNotes" TEXT,
    "notes" TEXT,
    "origin" "QuestionReviewOrigin" NOT NULL DEFAULT 'AUTOMATIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionReviewTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionReviewTask_studyBlockId_key" ON "QuestionReviewTask"("studyBlockId");

-- CreateIndex
CREATE INDEX "QuestionReviewTask_userId_scheduledDate_status_idx" ON "QuestionReviewTask"("userId", "scheduledDate", "status");

-- CreateIndex
CREATE INDEX "QuestionReviewTask_userId_subjectId_status_idx" ON "QuestionReviewTask"("userId", "subjectId", "status");

-- AddForeignKey
ALTER TABLE "QuestionReviewTask" ADD CONSTRAINT "QuestionReviewTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionReviewTask" ADD CONSTRAINT "QuestionReviewTask_studyBlockId_fkey" FOREIGN KEY ("studyBlockId") REFERENCES "StudyBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionReviewTask" ADD CONSTRAINT "QuestionReviewTask_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "StudySubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
