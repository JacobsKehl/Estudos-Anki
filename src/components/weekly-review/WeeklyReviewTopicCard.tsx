"use client";

import React, { useState, useEffect } from "react";
import { Check, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { WeeklyReviewTopic } from "@/hooks/useWeeklyReview";
import { getResultBadgeClasses, mapSelectionReason, formatDateBR } from "@/lib/weekly-review-ui";

interface Props {
  topic: WeeklyReviewTopic;
  suggestedQuestions: number;
  saveState: "idle" | "saving" | "saved" | "error";
  onSave: (result: "DID_WELL" | "HAD_DOUBTS" | "REVIEW_AGAIN", notes: string) => Promise<void>;
}

export function WeeklyReviewTopicCard({ topic, suggestedQuestions, saveState, onSave }: Props) {
  // Local state for grading selection and draft notes
  const [selectedResult, setSelectedResult] = useState(topic.result);
  const [notes, setNotes] = useState(topic.notes ?? "");

  // Sync state if topic properties update from parent
  useEffect(() => {
    setSelectedResult(topic.result);
    setNotes(topic.notes ?? "");
  }, [topic]);

  const handleSelectDidWell = () => {
    setSelectedResult("DID_WELL");
    setNotes("");
    onSave("DID_WELL", "");
  };

  const handleSelectHadDoubts = () => {
    setSelectedResult("HAD_DOUBTS");
  };

  const handleSelectReviewAgain = () => {
    setSelectedResult("REVIEW_AGAIN");
  };

  const handleSaveNotes = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedResult === "PENDING") return;
    onSave(selectedResult as "HAD_DOUBTS" | "REVIEW_AGAIN", notes.slice(0, 2000));
  };

  const isPending = selectedResult === "PENDING";
  const showTextarea = selectedResult === "HAD_DOUBTS" || selectedResult === "REVIEW_AGAIN";
  const characterCount = notes.length;
  const isDirty = selectedResult !== topic.result || notes !== (topic.notes ?? "");

  return (
    <div className="bg-card border border-border/40 rounded-[2.5rem] p-6 shadow-sm space-y-4 hover:border-border/60 transition-colors">
      {/* Title & Metadata */}
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div className="space-y-1 min-w-0">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sage-light text-accent">
              {topic.subjectName}
            </span>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground border border-border/40">
              {mapSelectionReason(topic.selectionReason as any)}
            </span>
            {suggestedQuestions > 0 && (
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/10 text-accent border border-accent/20">
                Sugerido: {suggestedQuestions} q
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-foreground mt-2 truncate">
            {topic.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            Data de estudo original: {formatDateBR(topic.sourceStudyDate || "")}
            {topic.materialName && ` • ${topic.materialName}`}
            {topic.pageStart && ` (pág. {topic.pageStart} a {topic.pageEnd})`}
          </p>
        </div>

        {/* Current status indicator */}
        <div className="shrink-0">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getResultBadgeClasses(topic.result)}`}>
            {topic.result === "PENDING" ? "Pendente" : topic.result === "DID_WELL" ? "Dominei" : topic.result === "HAD_DOUBTS" ? "Dúvidas" : "Revisar"}
          </span>
        </div>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <button
          type="button"
          onClick={handleSelectDidWell}
          className={`flex items-center justify-center gap-2 h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            selectedResult === "DID_WELL"
              ? "bg-success-bg border-success-text/20 text-success-text shadow-sm"
              : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <Check className="w-4 h-4" />
          DOMINEI BEM
        </button>

        <button
          type="button"
          onClick={handleSelectHadDoubts}
          className={`flex items-center justify-center gap-2 h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            selectedResult === "HAD_DOUBTS"
              ? "bg-warning-bg border-warning-text/20 text-warning-text shadow-sm"
              : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          TIVE DÚVIDAS
        </button>

        <button
          type="button"
          onClick={handleSelectReviewAgain}
          className={`flex items-center justify-center gap-2 h-11 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            selectedResult === "REVIEW_AGAIN"
              ? "bg-error-bg border-error-text/20 text-error-text shadow-sm"
              : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          REVISAR NOVAMENTE
        </button>
      </div>

      {/* Conditional Textarea for Notes */}
      {showTextarea && (
        <form onSubmit={handleSaveNotes} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <label htmlFor={`notes-${topic.id}`} className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
              Anotações de revisão e dúvidas
            </label>
            <textarea
              id={`notes-${topic.id}`}
              placeholder="Digite aqui as principais dúvidas, fórmulas ou pontos de atenção para revisar no futuro..."
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              rows={3}
              maxLength={2000}
              className="w-full p-4 rounded-2xl bg-muted/40 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-y min-h-[80px]"
              disabled={saveState === "saving"}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>Máximo 2000 caracteres</span>
              <span className={characterCount >= 2000 ? "text-error-text font-bold" : ""}>
                {characterCount} / 2000
              </span>
            </div>
          </div>

          <div className="flex justify-end items-center gap-3">
            {saveState === "saved" && (
              <span className="text-[10px] font-bold text-success-text uppercase tracking-wider flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Salvo!
              </span>
            )}
            {saveState === "error" && (
              <span className="text-[10px] font-bold text-error-text uppercase tracking-wider">
                Erro ao salvar
              </span>
            )}

            <button
              type="submit"
              disabled={saveState === "saving" || !isDirty}
              className={`flex items-center justify-center gap-2 px-5 h-9 rounded-lg text-xs font-bold shadow-sm transition-all ${
                isDirty && saveState !== "saving"
                  ? "bg-accent text-white hover:scale-[1.01] cursor-pointer"
                  : "bg-muted/50 text-muted-foreground cursor-not-allowed"
              }`}
            >
              {saveState === "saving" ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  SALVANDO...
                </>
              ) : (
                "SALVAR ANOTAÇÃO"
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
