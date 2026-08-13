-- =====================================================================
-- SCHEMA COMPLETO DO BANCO DE DADOS (PRISMA ENGINE AUTO-GENERATED)
-- Data: 2026-08-13T18:19:30.096Z
-- Instruções: Copie todo o conteúdo deste arquivo e cole no SQL Editor
--             do painel do Supabase no projeto de DESTINO/TESTE.
-- =====================================================================

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MaterialRole" AS ENUM ('MAIN_MATERIAL', 'REFERENCE_MATERIAL', 'SUPPORT_MATERIAL', 'MIXED_MATERIAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StudyMaterialProvider" AS ENUM ('CFC', 'ESTRATEGIA', 'OTHER');

-- CreateEnum
CREATE TYPE "StudyBlockMethodology" AS ENUM ('LINEAR', 'ANCHOR_BASED');

-- CreateEnum
CREATE TYPE "SchedulingStatus" AS ENUM ('ACTIVE', 'DEFERRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StudySessionActionType" AS ENUM ('THEORY', 'SECOND_PASS', 'REINFORCEMENT', 'EXTRA_STUDY', 'REVIEW_BLOCK', 'REVIEW_FLASHCARDS');

-- CreateEnum
CREATE TYPE "StudySessionSource" AS ENUM ('TIMER', 'MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "QuestionReviewStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "QuestionReviewOrigin" AS ENUM ('AUTOMATIC', 'BACKFILL');

-- CreateEnum
CREATE TYPE "WeeklyReviewMissedBehavior" AS ENUM ('MOVE_TO_NEXT_AVAILABLE_DAY', 'SKIP_CURRENT_WEEK');

-- CreateEnum
CREATE TYPE "WeeklyReviewSessionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WeeklyReviewSelectionReason" AS ENUM ('WEEK_CONTENT', 'OVERDUE', 'LONG_UNSEEN');

-- CreateEnum
CREATE TYPE "WeeklyReviewTopicResult" AS ENUM ('PENDING', 'DID_WELL', 'HAD_DOUBTS', 'REVIEW_AGAIN');

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
    "weeklyReviewEnabled" BOOLEAN NOT NULL DEFAULT false,
    "weeklyReviewDayOfWeek" INTEGER NOT NULL DEFAULT 0,
    "weeklyReviewMissedBehavior" "WeeklyReviewMissedBehavior" NOT NULL DEFAULT 'MOVE_TO_NEXT_AVAILABLE_DAY',
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
    "schedulingStatus" "SchedulingStatus" NOT NULL DEFAULT 'ACTIVE',
    "deferredUntil" TIMESTAMP(3),
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
    "provider" "StudyMaterialProvider" NOT NULL DEFAULT 'OTHER',

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
    "generationReason" TEXT,
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
    "createdBy" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceHeading" TEXT,
    "sourceSection" TEXT,
    "officialTopicId" TEXT,
    "officialTopicName" TEXT,
    "topicCode" TEXT,
    "needsManualReview" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "possiblyAlreadyStudied" BOOLEAN NOT NULL DEFAULT false,
    "sourceV1BlockId" TEXT,
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
    "methodology" "StudyBlockMethodology" NOT NULL DEFAULT 'LINEAR',
    "generationRunId" TEXT,

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
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "studiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "StudySessionSource" NOT NULL DEFAULT 'TIMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudySessionLog_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "SyllabusVersion" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyllabusSubject" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "blocoConhecimento" TEXT,
    "questoesDaMateria" INTEGER,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyllabusTopic" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "subjectCanonicalKey" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "topicCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyllabusTopic_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "StudyBlock_generationRunId_key" ON "StudyBlock"("generationRunId");

-- CreateIndex
CREATE INDEX "StudyBlock_userId_theoryStatus_idx" ON "StudyBlock"("userId", "theoryStatus");

-- CreateIndex
CREATE INDEX "StudyBlock_methodology_idx" ON "StudyBlock"("methodology");

-- CreateIndex
CREATE INDEX "StudyScheduleItem_userId_scheduledDate_status_idx" ON "StudyScheduleItem"("userId", "scheduledDate", "status");

-- CreateIndex
CREATE INDEX "StudyScheduleItem_userId_scheduleId_status_idx" ON "StudyScheduleItem"("userId", "scheduleId", "status");

-- CreateIndex
CREATE INDEX "StudySessionLog_userId_studiedAt_idx" ON "StudySessionLog"("userId", "studiedAt");

-- CreateIndex
CREATE INDEX "StudySessionLog_userId_studyBlockId_idx" ON "StudySessionLog"("userId", "studyBlockId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionReviewTask_studyBlockId_key" ON "QuestionReviewTask"("studyBlockId");

-- CreateIndex
CREATE INDEX "QuestionReviewTask_userId_scheduledDate_status_idx" ON "QuestionReviewTask"("userId", "scheduledDate", "status");

-- CreateIndex
CREATE INDEX "QuestionReviewTask_userId_subjectId_status_idx" ON "QuestionReviewTask"("userId", "subjectId", "status");

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

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusVersion_label_key" ON "SyllabusVersion"("label");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusVersion_single_active" ON "SyllabusVersion"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusSubject_versionId_canonicalKey_key" ON "SyllabusSubject"("versionId", "canonicalKey");

-- CreateIndex
CREATE INDEX "SyllabusTopic_versionId_idx" ON "SyllabusTopic"("versionId");

-- CreateIndex
CREATE INDEX "SyllabusTopic_subjectCanonicalKey_idx" ON "SyllabusTopic"("subjectCanonicalKey");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusTopic_versionId_topicCode_key" ON "SyllabusTopic"("versionId", "topicCode");

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

-- AddForeignKey
ALTER TABLE "QuestionReviewTask" ADD CONSTRAINT "QuestionReviewTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionReviewTask" ADD CONSTRAINT "QuestionReviewTask_studyBlockId_fkey" FOREIGN KEY ("studyBlockId") REFERENCES "StudyBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionReviewTask" ADD CONSTRAINT "QuestionReviewTask_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "StudySubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "SyllabusSubject" ADD CONSTRAINT "SyllabusSubject_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SyllabusVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SyllabusVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_versionId_subjectCanonicalKey_fkey" FOREIGN KEY ("versionId", "subjectCanonicalKey") REFERENCES "SyllabusSubject"("versionId", "canonicalKey") ON DELETE RESTRICT ON UPDATE CASCADE;

