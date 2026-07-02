-- CreateEnum
CREATE TYPE "WeeklyReviewMissedBehavior" AS ENUM ('MOVE_TO_NEXT_AVAILABLE_DAY', 'SKIP_CURRENT_WEEK');

-- CreateEnum
CREATE TYPE "WeeklyReviewSessionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WeeklyReviewSelectionReason" AS ENUM ('WEEK_CONTENT', 'OVERDUE', 'LONG_UNSEEN');

-- CreateEnum
CREATE TYPE "WeeklyReviewTopicResult" AS ENUM ('PENDING', 'DID_WELL', 'HAD_DOUBTS', 'REVIEW_AGAIN');

-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN     "weeklyReviewDayOfWeek" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weeklyReviewEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weeklyReviewMissedBehavior" "WeeklyReviewMissedBehavior" NOT NULL DEFAULT 'MOVE_TO_NEXT_AVAILABLE_DAY';

-- CreateTable
CREATE TABLE "WeeklyReviewSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalScheduledDate" DATE NOT NULL,
    "effectiveScheduledDate" DATE NOT NULL,
    "sourcePeriodStart" DATE NOT NULL,
    "sourcePeriodEnd" DATE NOT NULL,
    "status" "WeeklyReviewSessionStatus" NOT NULL DEFAULT 'PENDING',
    "missedBehavior" "WeeklyReviewMissedBehavior" NOT NULL,
    "availableMinutes" INTEGER,
    "suggestedQuestionCount" INTEGER,
    "targetQuestionCount" INTEGER,
    "actualQuestionCount" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReviewTopic" (
    "id" TEXT NOT NULL,
    "weeklyReviewSessionId" TEXT NOT NULL,
    "subjectId" TEXT,
    "sourceSubjectName" TEXT NOT NULL,
    "displayTitle" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "carriedFromTopicId" TEXT,
    "priorityRank" INTEGER,
    "suggestedQuestions" INTEGER,
    "selectionReason" "WeeklyReviewSelectionReason" NOT NULL,
    "result" "WeeklyReviewTopicResult" NOT NULL DEFAULT 'PENDING',
    "resultRecordedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReviewTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReviewTopicSource" (
    "id" TEXT NOT NULL,
    "weeklyReviewTopicId" TEXT NOT NULL,
    "studyBlockId" TEXT,
    "sourceBlockTitle" TEXT NOT NULL,
    "sourceMaterialName" TEXT,
    "sourcePageStart" INTEGER,
    "sourcePageEnd" INTEGER,
    "sourceStudyDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReviewTopicSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyReviewSession_userId_effectiveScheduledDate_status_idx" ON "WeeklyReviewSession"("userId", "effectiveScheduledDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReviewSession_userId_originalScheduledDate_key" ON "WeeklyReviewSession"("userId", "originalScheduledDate");

-- CreateIndex
CREATE INDEX "WeeklyReviewTopic_weeklyReviewSessionId_selectionReason_res_idx" ON "WeeklyReviewTopic"("weeklyReviewSessionId", "selectionReason", "result");

-- CreateIndex
CREATE INDEX "WeeklyReviewTopic_carriedFromTopicId_idx" ON "WeeklyReviewTopic"("carriedFromTopicId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReviewTopic_weeklyReviewSessionId_groupKey_key" ON "WeeklyReviewTopic"("weeklyReviewSessionId", "groupKey");

-- CreateIndex
CREATE INDEX "WeeklyReviewTopicSource_weeklyReviewTopicId_idx" ON "WeeklyReviewTopicSource"("weeklyReviewTopicId");

-- CreateIndex
CREATE INDEX "WeeklyReviewTopicSource_studyBlockId_idx" ON "WeeklyReviewTopicSource"("studyBlockId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReviewTopicSource_weeklyReviewTopicId_studyBlockId_key" ON "WeeklyReviewTopicSource"("weeklyReviewTopicId", "studyBlockId");

-- AddForeignKey
ALTER TABLE "WeeklyReviewSession" ADD CONSTRAINT "WeeklyReviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReviewTopic" ADD CONSTRAINT "WeeklyReviewTopic_weeklyReviewSessionId_fkey" FOREIGN KEY ("weeklyReviewSessionId") REFERENCES "WeeklyReviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReviewTopic" ADD CONSTRAINT "WeeklyReviewTopic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "StudySubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReviewTopic" ADD CONSTRAINT "WeeklyReviewTopic_carriedFromTopicId_fkey" FOREIGN KEY ("carriedFromTopicId") REFERENCES "WeeklyReviewTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReviewTopicSource" ADD CONSTRAINT "WeeklyReviewTopicSource_weeklyReviewTopicId_fkey" FOREIGN KEY ("weeklyReviewTopicId") REFERENCES "WeeklyReviewTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReviewTopicSource" ADD CONSTRAINT "WeeklyReviewTopicSource_studyBlockId_fkey" FOREIGN KEY ("studyBlockId") REFERENCES "StudyBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

