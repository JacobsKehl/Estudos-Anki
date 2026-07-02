-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MaterialRole" AS ENUM ('MAIN_MATERIAL', 'SUPPORT_MATERIAL', 'MIXED_MATERIAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StudySessionActionType" AS ENUM ('THEORY', 'SECOND_PASS', 'REINFORCEMENT', 'EXTRA_STUDY', 'REVIEW_BLOCK', 'REVIEW_FLASHCARDS');

-- CreateEnum
CREATE TYPE "StudySessionSource" AS ENUM ('TIMER', 'MANUAL', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "authUserId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "googleAccountConnected" BOOLEAN NOT NULL DEFAULT false,
    "googleAccessToken" TEXT,
    "googleRefreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyGoalMinutes" INTEGER NOT NULL DEFAULT 120,
    "studyResetTime" TEXT NOT NULL DEFAULT '00:00',
    "studyDaysOfWeek" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "defaultBlockDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxNewCardsPerDay" INTEGER NOT NULL DEFAULT 20,
    "flashcardDifficulty" TEXT NOT NULL DEFAULT 'NORMAL_PLUS',
    "emailReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailReminderTime" TEXT NOT NULL DEFAULT '08:00',
    "dailyReminderEmail" TEXT,
    "lastDailyReminderSentAt" TIMESTAMP(3),
    "visualDensity" TEXT NOT NULL DEFAULT 'comfortable',
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "focusArea" TEXT NOT NULL DEFAULT 'Geral',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "displayName" TEXT NOT NULL DEFAULT 'Estudante',
    "examGoal" TEXT NOT NULL DEFAULT 'TRT4',
    "deadline" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "languageTone" TEXT NOT NULL DEFAULT 'MASCULINE_NEUTRAL',
    "scheduleGenerationMode" TEXT DEFAULT 'DYNAMIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySubject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "examWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "studyPriority" TEXT NOT NULL DEFAULT 'PRIMARY',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudySubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyMaterial" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT,
    "filePath" TEXT,
    "googleDriveFileId" TEXT,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "fileSize" INTEGER,
    "totalPages" INTEGER,
    "sourceType" TEXT NOT NULL DEFAULT 'LOCAL_UPLOAD',
    "sourcePath" TEXT,
    "fileHash" TEXT,
    "organizationStatus" TEXT NOT NULL DEFAULT 'UPLOADED',
    "detectedSubjectName" TEXT,
    "detectedStructure" TEXT,
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "subjectId" TEXT,
    "materialRole" "MaterialRole" NOT NULL DEFAULT 'UNKNOWN',
    "supportForTopicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedContent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT,
    "pageNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "estimatedStudyMinutes" INTEGER,
    "materialId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "estimatedExamDate" TIMESTAMP(3),
    "dailyStudyMinutes" INTEGER NOT NULL DEFAULT 120,
    "availableWeekDays" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlanDay" (
    "id" TEXT NOT NULL,
    "studyPlanId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "subjectId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flashcard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "contentId" TEXT,
    "materialId" TEXT,
    "studyBlockId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'QUESTION_ANSWER',
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "reviewState" TEXT DEFAULT 'NEW',
    "learningStep" INTEGER DEFAULT 0,
    "easeFactor" DOUBLE PRECISION DEFAULT 2.5,
    "intervalDays" INTEGER DEFAULT 0,
    "repetitionCount" INTEGER DEFAULT 0,
    "lapseCount" INTEGER DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "sourcePageStart" INTEGER,
    "sourcePageEnd" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardReview" (
    "id" TEXT NOT NULL,
    "flashcardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousState" TEXT NOT NULL,
    "newState" TEXT NOT NULL,
    "previousInterval" INTEGER NOT NULL,
    "newInterval" INTEGER NOT NULL,
    "previousEaseFactor" DOUBLE PRECISION NOT NULL,
    "newEaseFactor" DOUBLE PRECISION NOT NULL,
    "previousNextReviewAt" TIMESTAMP(3) NOT NULL,
    "newNextReviewAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pageStart" INTEGER NOT NULL,
    "pageEnd" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "estimatedStudyMinutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "createdBy" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceHeading" TEXT,
    "sourceSection" TEXT,
    "officialTopicId" TEXT,
    "officialTopicName" TEXT,
    "topicCode" TEXT,
    "confidence" DOUBLE PRECISION,
    "theoryStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "questionsStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "flashcardsStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "theoryCompletedAt" TIMESTAMP(3),
    "questionsCompletedAt" TIMESTAMP(3),
    "flashcardsGeneratedAt" TIMESTAMP(3),
    "review1dScheduledAt" TIMESTAMP(3),
    "review7dScheduledAt" TIMESTAMP(3),
    "review15dScheduledAt" TIMESTAMP(3),
    "review30dScheduledAt" TIMESTAMP(3),
    "review1dCompletedAt" TIMESTAMP(3),
    "review7dCompletedAt" TIMESTAMP(3),
    "review15dCompletedAt" TIMESTAMP(3),
    "review30dCompletedAt" TIMESTAMP(3),
    "lastStudiedAt" TIMESTAMP(3),
    "nextActionType" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyBlockSupport" (
    "id" TEXT NOT NULL,
    "studyBlockId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "supportType" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyBlockSupport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estimatedExamDate" TIMESTAMP(3),
    "dailyStudyMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "studySubjectId" TEXT,

    CONSTRAINT "StudySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyScheduleItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "materialId" TEXT,
    "studyBlockId" TEXT,
    "actionType" TEXT,
    "priorityScore" DOUBLE PRECISION,
    "reason" TEXT,
    "dayNumber" INTEGER NOT NULL,
    "scheduledDate" TIMESTAMP(3),
    "estimatedMinutes" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "actualDurationMinutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySessionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studyBlockId" TEXT,
    "studyScheduleItemId" TEXT,
    "actionType" "StudySessionActionType" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "studiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "StudySessionSource" NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudySessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE INDEX "Flashcard_userId_nextReviewAt_idx" ON "Flashcard"("userId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "Flashcard_userId_reviewState_idx" ON "Flashcard"("userId", "reviewState");

-- CreateIndex
CREATE INDEX "StudyBlock_userId_status_idx" ON "StudyBlock"("userId", "status");

-- CreateIndex
CREATE INDEX "StudyScheduleItem_userId_scheduledDate_status_idx" ON "StudyScheduleItem"("userId", "scheduledDate", "status");

-- CreateIndex
CREATE INDEX "StudyScheduleItem_userId_scheduleId_status_idx" ON "StudyScheduleItem"("userId", "scheduleId", "status");

-- CreateIndex
CREATE INDEX "StudySessionLog_userId_studiedAt_idx" ON "StudySessionLog"("userId", "studiedAt");

-- CreateIndex
CREATE INDEX "StudySessionLog_userId_studyBlockId_idx" ON "StudySessionLog"("userId", "studyBlockId");

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySubject" ADD CONSTRAINT "StudySubject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyMaterial" ADD CONSTRAINT "StudyMaterial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyMaterial" ADD CONSTRAINT "StudyMaterial_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "StudySubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedContent" ADD CONSTRAINT "ExtractedContent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedContent" ADD CONSTRAINT "ExtractedContent_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "StudySubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedContent" ADD CONSTRAINT "ExtractedContent_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "StudyMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanDay" ADD CONSTRAINT "StudyPlanDay_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanDay" ADD CONSTRAINT "StudyPlanDay_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "StudySubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanDay" ADD CONSTRAINT "StudyPlanDay_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ExtractedContent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "StudySubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ExtractedContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "StudyMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_studyBlockId_fkey" FOREIGN KEY ("studyBlockId") REFERENCES "StudyBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardReview" ADD CONSTRAINT "FlashcardReview_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyBlock" ADD CONSTRAINT "StudyBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyBlock" ADD CONSTRAINT "StudyBlock_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "StudySubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyBlock" ADD CONSTRAINT "StudyBlock_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "StudyMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyBlockSupport" ADD CONSTRAINT "StudyBlockSupport_studyBlockId_fkey" FOREIGN KEY ("studyBlockId") REFERENCES "StudyBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyBlockSupport" ADD CONSTRAINT "StudyBlockSupport_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "StudyMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySchedule" ADD CONSTRAINT "StudySchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySchedule" ADD CONSTRAINT "StudySchedule_studySubjectId_fkey" FOREIGN KEY ("studySubjectId") REFERENCES "StudySubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyScheduleItem" ADD CONSTRAINT "StudyScheduleItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyScheduleItem" ADD CONSTRAINT "StudyScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "StudySchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyScheduleItem" ADD CONSTRAINT "StudyScheduleItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "StudySubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyScheduleItem" ADD CONSTRAINT "StudyScheduleItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "StudyMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyScheduleItem" ADD CONSTRAINT "StudyScheduleItem_studyBlockId_fkey" FOREIGN KEY ("studyBlockId") REFERENCES "StudyBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySessionLog" ADD CONSTRAINT "StudySessionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySessionLog" ADD CONSTRAINT "StudySessionLog_studyBlockId_fkey" FOREIGN KEY ("studyBlockId") REFERENCES "StudyBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySessionLog" ADD CONSTRAINT "StudySessionLog_studyScheduleItemId_fkey" FOREIGN KEY ("studyScheduleItemId") REFERENCES "StudyScheduleItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

