"use client";

import React from "react";
import { ArrowLeft, Play, AlertTriangle } from "lucide-react";
import { WeeklyReviewPreview } from "@/hooks/useWeeklyReview";
import { mapSelectionReason, formatDateBR } from "@/lib/weekly-review-ui";

interface Props {
  preview: WeeklyReviewPreview;
  onPrepare: () => Promise<void>;
  onBack: () => void;
  isMutating: boolean;
}

export function WeeklyReviewPreviewTopics({ preview, onPrepare, onBack, isMutating }: Props) {
  const hasTopics = preview.topics.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar à seleção de tempo
      </button>

      {/* Header and Details Card */}
      <div className="bg-card border border-border/40 rounded-[2.5rem] p-8 shadow-sm space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-4 border-b border-border/30 pb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Prévia da Revisão Semanal</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Período analisado: <span className="font-semibold text-foreground">{formatDateBR(preview.sourcePeriodStart)}</span> até <span className="font-semibold text-foreground">{formatDateBR(preview.sourcePeriodEnd)}</span>
            </p>
          </div>

          <div className="bg-muted/40 border border-border/40 px-4 py-2.5 rounded-2xl text-xs space-y-1">
            <div>
              Total de Assuntos: <span className="font-bold text-foreground">{preview.totals.selected}</span>
            </div>
            <div>
              Sugerido para Revisão: <span className="font-bold text-foreground">{preview.suggestedQuestionCount}</span> questões
            </div>
          </div>
        </div>

        {/* Warning Callout */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed space-y-1">
            <p className="font-bold">Aviso sobre o cronograma:</p>
            <p>
              Esta revisão semanal manual é isolada e não altera o cronograma principal nem o scheduler de repetição espaçada (SRS). Os tópicos e matérias selecionados aqui servem exclusivamente para o seu treino semanal focado.
            </p>
          </div>
        </div>

        {/* Topics List */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Assuntos Selecionados para esta Sessão
          </h2>

          {!hasTopics ? (
            <div className="text-center py-10 border border-dashed border-border/60 rounded-2xl bg-muted/10">
              <p className="text-sm text-muted-foreground">Nenhum assunto disponível no período para revisão.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {preview.topics.map((topic, i) => (
                <div
                  key={`${topic.studyBlockId}-${topic.selectionReason}-${i}`}
                  className="p-4 bg-muted/20 border border-border/20 rounded-2xl flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sage-light text-accent">
                      {topic.subjectName}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground truncate">
                      {topic.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Data de estudo original: {formatDateBR(topic.sourceStudyDate)}
                      {topic.materialName && ` • ${topic.materialName}`}
                      {topic.pageStart && ` (pág. ${topic.pageStart} a ${topic.pageEnd})`}
                    </p>
                  </div>

                  <div className="shrink-0">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${
                      topic.selectionReason === "WEEK_CONTENT"
                        ? "bg-success-bg/40 text-success-text border-success-text/20"
                        : topic.selectionReason === "OVERDUE"
                        ? "bg-error-bg/40 text-error-text border-error-text/20"
                        : "bg-warning-bg/40 text-warning-text border-warning-text/20"
                    }`}>
                      {mapSelectionReason(topic.selectionReason)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-4 border-t border-border/30">
          <button
            onClick={onPrepare}
            disabled={isMutating || !hasTopics}
            className="flex items-center gap-2 px-6 h-12 rounded-xl bg-accent text-accent-foreground text-sm font-bold shadow-sm hover:scale-[1.01] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4 fill-current" />
            {isMutating ? "PREPARANDO..." : "PREPARAR SESSÃO"}
          </button>
        </div>
      </div>
    </div>
  );
}
