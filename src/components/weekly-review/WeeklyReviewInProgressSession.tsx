"use client";

import React, { useState, useEffect } from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { WeeklyReviewSession, WeeklyReviewTopic, TopicSaveState } from "@/hooks/useWeeklyReview";
import { calculateProgress, distributeQuestionsAcrossTopics } from "@/lib/weekly-review-ui";
import { WeeklyReviewTopicCard } from "./WeeklyReviewTopicCard";

interface Props {
  session: WeeklyReviewSession;
  onRecordResult: (topicId: string, result: "DID_WELL" | "HAD_DOUBTS" | "REVIEW_AGAIN", notes?: string) => Promise<void>;
  onComplete: (actualQuestionCount: number) => Promise<void>;
  topicSaveStates: Record<string, TopicSaveState>;
  isMutating: boolean;
}

export function WeeklyReviewInProgressSession({
  session,
  onRecordResult,
  onComplete,
  topicSaveStates,
  isMutating,
}: Props) {
  const { count, total, percent } = calculateProgress(session.topics);
  const isAllAnswered = count === total;

  // Actual questions solved (default to targetQuestionCount)
  const [actualQuestions, setActualQuestions] = useState(session.targetQuestionCount ?? 20);

  // Suggested questions per topic (for visual assistance inside cards)
  const distributedQuestions = distributeQuestionsAcrossTopics(
    session.targetQuestionCount ?? 20,
    session.topics
  );

  useEffect(() => {
    if (session.targetQuestionCount) {
      setActualQuestions(session.targetQuestionCount);
    }
  }, [session.targetQuestionCount]);

  const handleSubmitComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllAnswered) return;
    onComplete(actualQuestions);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
      {/* Session progress header */}
      <div className="bg-card border border-border/40 rounded-[2.5rem] p-8 shadow-sm space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sage-light text-accent mb-2">
              Em Andamento
            </span>
            <h1 className="text-xl font-bold text-foreground">Executando Revisão Semanal</h1>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-foreground">{count}</span>
            <span className="text-xs text-muted-foreground"> / {total} respondidos</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
          <div
            className="bg-accent h-full transition-all duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Topics list */}
      <div className="space-y-4">
        {session.topics.map((topic) => (
          <WeeklyReviewTopicCard
            key={topic.id}
            topic={topic}
            suggestedQuestions={distributedQuestions[topic.id] ?? 0}
            saveState={topicSaveStates[topic.id] ?? "idle"}
            onSave={(result, notes) => onRecordResult(topic.id, result, notes)}
          />
        ))}
      </div>

      {/* Final Completion Form */}
      <div className="bg-card border border-border/40 rounded-[2.5rem] p-8 shadow-sm space-y-6">
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">Concluir Sessão Semanal</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Após avaliar todos os assuntos listados acima, informe o total de questões realmente resolvidas nesta revisão para salvar o resultado final no banco.
          </p>
        </div>

        <form onSubmit={handleSubmitComplete} className="space-y-6">
          <div className="space-y-2 max-w-xs">
            <label htmlFor="actual-questions-input" className="text-xs font-bold text-foreground uppercase tracking-wider block">
              Questões reais resolvidas
            </label>
            <input
              id="actual-questions-input"
              type="number"
              min={0}
              max={200}
              value={actualQuestions}
              onChange={(e) => setActualQuestions(Math.max(0, Number(e.target.value)))}
              className="w-full h-11 px-4 rounded-xl bg-muted/40 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={!isAllAnswered || isMutating}
              required
            />
          </div>

          {!isAllAnswered && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
              <p className="text-xs text-amber-800 leading-relaxed font-semibold">
                ⚠️ Avalie todos os assuntos acima antes de concluir a sessão.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!isAllAnswered || isMutating}
              className="flex items-center justify-center gap-2 px-6 h-12 rounded-xl bg-accent text-accent-foreground text-sm font-bold shadow-sm hover:scale-[1.01] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMutating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Concluindo...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  CONCLUIR REVISÃO
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
