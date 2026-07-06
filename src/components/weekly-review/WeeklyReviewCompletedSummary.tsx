"use client";

import React from "react";
import { CheckCircle, SkipForward, ArrowRight, BookOpen, Clock, Activity } from "lucide-react";
import { WeeklyReviewSession } from "@/hooks/useWeeklyReview";
import { formatDateBR, mapResultText, getResultBadgeClasses } from "@/lib/weekly-review-ui";

interface Props {
  session: WeeklyReviewSession;
  onReset: () => void;
}

export function WeeklyReviewCompletedSummary({ session, onReset }: Props) {
  const isCompleted = session.status === "COMPLETED";

  // Calculate statistics
  const totalTopics = session.topics.length;
  const didWellCount = session.topics.filter((t) => t.result === "DID_WELL").length;
  const hadDoubtsCount = session.topics.filter((t) => t.result === "HAD_DOUBTS").length;
  const reviewAgainCount = session.topics.filter((t) => t.result === "REVIEW_AGAIN").length;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 space-y-6">
      <div className="bg-card border border-border/40 rounded-[2.5rem] p-8 shadow-sm space-y-8 text-center">
        {/* Icon status */}
        <div className="flex flex-col items-center gap-3">
          {isCompleted ? (
            <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-success-text" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <SkipForward className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          <h1 className="text-xl font-bold text-foreground">
            Revisão Semanal {isCompleted ? "Concluída!" : "Pulada"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sessão agendada para {formatDateBR(session.effectiveScheduledDate)}
          </p>
        </div>

        {/* Stats Grid */}
        {isCompleted ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-muted/30 border border-border/20 rounded-2xl p-4 space-y-1">
              <BookOpen className="w-4 h-4 text-accent mx-auto" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Assuntos</p>
              <p className="text-lg font-bold text-foreground">{totalTopics}</p>
            </div>

            <div className="bg-muted/30 border border-border/20 rounded-2xl p-4 space-y-1">
              <Clock className="w-4 h-4 text-accent mx-auto" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tempo</p>
              <p className="text-lg font-bold text-foreground">{session.availableMinutes ?? 0} min</p>
            </div>

            <div className="bg-muted/30 border border-border/20 rounded-2xl p-4 space-y-1">
              <Activity className="w-4 h-4 text-accent mx-auto" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Questões</p>
              <p className="text-lg font-bold text-foreground">{session.actualQuestionCount ?? 0}</p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-muted/40 rounded-2xl text-xs text-muted-foreground leading-relaxed">
            Esta sessão de revisão semanal foi marcada como pulada. Todos os assuntos selecionados para ela voltaram à fila para a próxima semana.
          </div>
        )}

        {/* Breakdown of topics by grade (only if completed) */}
        {isCompleted && totalTopics > 0 && (
          <div className="space-y-4 text-left">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider border-b border-border/30 pb-2">
              Desempenho por Assunto
            </h2>

            <div className="flex gap-2 flex-wrap pb-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-full bg-success-bg text-success-text font-bold">
                Domínio: {didWellCount}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-warning-bg text-warning-text font-bold">
                Dúvidas: {hadDoubtsCount}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-error-bg text-error-text font-bold">
                Revisar: {reviewAgainCount}
              </span>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {session.topics.map((topic) => (
                <div
                  key={topic.id}
                  className="p-3 bg-muted/10 border border-border/20 rounded-xl flex justify-between items-center gap-4 hover:bg-muted/20 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-accent uppercase tracking-wider">
                      {topic.subjectName}
                    </p>
                    <h3 className="text-xs font-semibold text-foreground truncate">
                      {topic.title}
                    </h3>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${getResultBadgeClasses(topic.result)}`}>
                    {mapResultText(topic.result)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-4 flex justify-center">
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-6 h-12 rounded-xl bg-accent text-accent-foreground text-sm font-bold shadow-sm hover:scale-[1.01] transition-transform"
          >
            Voltar ao Início
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
