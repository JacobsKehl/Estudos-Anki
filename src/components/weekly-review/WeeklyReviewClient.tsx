"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useWeeklyReview } from "@/hooks/useWeeklyReview";
import { WeeklyReviewEmptyState } from "./WeeklyReviewEmptyState";
import { WeeklyReviewPreviewForm } from "./WeeklyReviewPreviewForm";
import { WeeklyReviewPreviewTopics } from "./WeeklyReviewPreviewTopics";
import { WeeklyReviewPendingSession } from "./WeeklyReviewPendingSession";
import { WeeklyReviewInProgressSession } from "./WeeklyReviewInProgressSession";
import { WeeklyReviewCompletedSummary } from "./WeeklyReviewCompletedSummary";

function WeeklyReviewInner() {
  const hook = useWeeklyReview();

  switch (hook.phase) {
    case "loading":
      return (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">Carregando revisão semanal...</p>
        </div>
      );

    case "disabled":
      return <WeeklyReviewEmptyState />;

    case "preview-form":
      return (
        <WeeklyReviewPreviewForm
          onSubmit={hook.fetchPreview}
          isMutating={hook.isMutating}
        />
      );

    case "preview-topics":
      return (
        <WeeklyReviewPreviewTopics
          preview={hook.preview!}
          onPrepare={hook.prepareSession}
          onBack={hook.resetToForm}
          isMutating={hook.isMutating}
        />
      );

    case "pending-session":
      return (
        <WeeklyReviewPendingSession
          session={hook.session!}
          onStart={hook.startSession}
          onSkip={hook.skipSession}
          onCarry={hook.carrySession}
          isMutating={hook.isMutating}
          saveDraft={hook.saveDraft}
          loadDraft={hook.loadDraft}
        />
      );

    case "in-progress":
      return (
        <WeeklyReviewInProgressSession
          session={hook.session!}
          onRecordResult={hook.recordTopicResult}
          onComplete={hook.completeSession}
          topicSaveStates={hook.topicSaveStates}
          isMutating={hook.isMutating}
        />
      );

    case "completed":
      return (
        <WeeklyReviewCompletedSummary
          session={hook.session!}
          onReset={hook.resetToForm}
        />
      );

    case "error":
      return (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-16 h-16 rounded-full bg-error-bg flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="text-sm text-error-text text-center max-w-md">
            {hook.errorMessage || "Ocorreu um erro ao carregar a revisão semanal."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 h-10 rounded-xl bg-accent text-accent-foreground text-sm font-bold hover:scale-[1.01] transition-transform"
          >
            Tentar novamente
          </button>
        </div>
      );

    default:
      return null;
  }
}

export function WeeklyReviewClient() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      }
    >
      <WeeklyReviewInner />
    </Suspense>
  );
}
