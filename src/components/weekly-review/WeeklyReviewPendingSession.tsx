"use client";

import React, { useState, useEffect } from "react";
import { Clock, Play, SkipForward, Calendar, Loader2, AlertTriangle } from "lucide-react";
import { WeeklyReviewSession } from "@/hooks/useWeeklyReview";
import { suggestQuestionCount, formatDateBR, mapSelectionReason } from "@/lib/weekly-review-ui";

interface Props {
  session: WeeklyReviewSession;
  onStart: (availableMinutes: number, targetQuestionCount: number) => Promise<void>;
  onSkip: () => Promise<void>;
  onCarry: (newDate: string) => Promise<void>;
  isMutating: boolean;
  saveDraft: (sessionId: string, data: { availableMinutes: number; targetQuestionCount: number }) => void;
  loadDraft: (sessionId: string) => { availableMinutes: number; targetQuestionCount: number } | null;
}

export function WeeklyReviewPendingSession({
  session,
  onStart,
  onSkip,
  onCarry,
  isMutating,
  saveDraft,
  loadDraft,
}: Props) {
  // Configurable session parameters
  const [minutes, setMinutes] = useState(60);
  const [questions, setQuestions] = useState(20);

  // Dialog states
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showCarryModal, setShowCarryModal] = useState(false);

  // Carry date state
  const [carryDate, setCarryDate] = useState("");
  const [minCarryDate, setMinCarryDate] = useState("");
  const [maxCarryDate, setMaxCarryDate] = useState("");

  // Initialize and load sessionStorage draft if available
  useEffect(() => {
    const draft = loadDraft(session.id);
    if (draft) {
      setMinutes(draft.availableMinutes);
      setQuestions(draft.targetQuestionCount);
    } else {
      // Use values from database if present, otherwise fallback
      const dbMinutes = session.availableMinutes ?? 60;
      const dbQuestions = session.targetQuestionCount ?? 20;
      setMinutes(dbMinutes);
      setQuestions(dbQuestions);
    }
  }, [session, loadDraft]);

  // Calculate carry limits based on session's effectiveScheduledDate
  useEffect(() => {
    try {
      const currentEffDate = new Date(session.effectiveScheduledDate);
      
      // Min date is the day after the current effective scheduled date
      const minDateObj = new Date(currentEffDate.getTime() + 24 * 60 * 60 * 1000);
      const minStr = minDateObj.toISOString().split("T")[0];
      
      // Max date is 14 days after the current effective scheduled date
      const maxDateObj = new Date(currentEffDate.getTime() + 14 * 24 * 60 * 60 * 1000);
      const maxStr = maxDateObj.toISOString().split("T")[0];
      
      setMinCarryDate(minStr);
      setMaxCarryDate(maxStr);
      setCarryDate(minStr); // Default selector to min date
    } catch {
      // Fallback
      const today = new Date().toISOString().split("T")[0];
      setMinCarryDate(today);
      setCarryDate(today);
    }
  }, [session.effectiveScheduledDate]);

  // Handle updates to inputs and save draft
  const handleMinutesChange = (newMins: number) => {
    setMinutes(newMins);
    const suggested = suggestQuestionCount(newMins);
    setQuestions(suggested);
    saveDraft(session.id, { availableMinutes: newMins, targetQuestionCount: suggested });
  };

  const handleQuestionsChange = (newQuests: number) => {
    setQuestions(newQuests);
    saveDraft(session.id, { availableMinutes: minutes, targetQuestionCount: newQuests });
  };

  const handleStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(minutes, questions);
  };

  const handleSkipConfirm = async () => {
    await onSkip();
    setShowSkipModal(false);
  };

  const handleCarrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carryDate) return;
    await onCarry(carryDate);
    setShowCarryModal(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
      {/* Session details */}
      <div className="bg-card border border-border/40 rounded-[2.5rem] p-8 shadow-sm space-y-8">
        <div className="flex justify-between items-start flex-wrap gap-4 border-b border-border/30 pb-6">
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-warning-bg text-warning-text mb-2">
              Sessão Pendente
            </span>
            <h1 className="text-xl font-bold text-foreground">
              Revisão de {formatDateBR(session.effectiveScheduledDate)}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Criada em {formatDateBR(session.createdAt)}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowCarryModal(true)}
              disabled={isMutating}
              className="flex items-center gap-2 px-4 h-10 rounded-xl bg-muted/40 text-foreground border border-border/40 hover:bg-muted/60 text-xs font-bold transition-all disabled:opacity-50"
            >
              <Calendar className="w-3.5 h-3.5" />
              ADIAR
            </button>
            <button
              onClick={() => setShowSkipModal(true)}
              disabled={isMutating}
              className="flex items-center gap-2 px-4 h-10 rounded-xl bg-muted/40 text-error-text border border-error-bg hover:bg-error-bg/10 text-xs font-bold transition-all disabled:opacity-50"
            >
              <SkipForward className="w-3.5 h-3.5" />
              PULAR
            </button>
          </div>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleStartSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Ajustar Parâmetros
            </h2>

            {/* Available Minutes */}
            <div className="space-y-2">
              <label htmlFor="duration-slider" className="text-xs font-bold text-foreground uppercase tracking-wider flex justify-between">
                <span>Duração da revisão</span>
                <span className="text-accent font-bold text-sm">{minutes} min</span>
              </label>
              <input
                id="duration-slider"
                type="range"
                min={15}
                max={120}
                step={5}
                value={minutes}
                onChange={(e) => handleMinutesChange(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-accent"
              />
            </div>

            {/* Target Questions */}
            <div className="space-y-2">
              <label htmlFor="questions-slider" className="text-xs font-bold text-foreground uppercase tracking-wider flex justify-between">
                <span>Número de questões</span>
                <span className="text-accent font-bold text-sm">{questions} questões</span>
              </label>
              <input
                id="questions-slider"
                type="range"
                min={5}
                max={50}
                step={1}
                value={questions}
                onChange={(e) => handleQuestionsChange(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-accent"
              />
              <p className="text-[10px] text-muted-foreground">
                Mínimo 5, máximo 50. Questões sugeridas são calculadas automaticamente com base nos minutos.
              </p>
            </div>

            {/* Start Button */}
            <button
              type="submit"
              disabled={isMutating}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-accent text-accent-foreground text-sm font-bold shadow-sm hover:scale-[1.01] transition-transform disabled:opacity-50"
            >
              {isMutating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  INICIAR SESSÃO AGORA
                </>
              )}
            </button>
          </div>

          {/* Topics summary list */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Assuntos desta Sessão ({session.topics.length})
            </h2>

            <div className="max-h-[250px] overflow-y-auto border border-border/40 rounded-2xl bg-muted/10 divide-y divide-border/20 p-2 space-y-1">
              {session.topics.map((topic, i) => (
                <div key={topic.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-accent uppercase tracking-wider">
                      {topic.subjectName}
                    </p>
                    <h3 className="text-xs font-semibold text-foreground truncate">
                      {topic.title}
                    </h3>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground border border-border/40">
                    {mapSelectionReason(topic.selectionReason as any)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </form>
      </div>

      {/* Skip Confirmation Dialog */}
      {showSkipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border/40 rounded-[2rem] p-6 max-w-md w-full shadow-lg space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-error-text" />
                Pular Sessão Semanal?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ao pular esta sessão de revisão, todos os assuntos selecionados voltarão para a fila para serem reavaliados na próxima oportunidade. Deseja prosseguir?
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSkipModal(false)}
                className="px-4 h-10 rounded-xl bg-muted text-muted-foreground text-xs font-bold hover:bg-muted/80 transition-all"
              >
                CANCELAR
              </button>
              <button
                onClick={handleSkipConfirm}
                className="px-4 h-10 rounded-xl bg-error-bg text-error-text text-xs font-bold hover:bg-error-bg/80 transition-all"
              >
                PULAR REVISÃO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Carry/Adiar Dialog */}
      {showCarryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border/40 rounded-[2rem] p-6 max-w-md w-full shadow-lg space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent" />
                Adiar Sessão Semanal
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Escolha uma nova data para agendar a revisão. A nova data deve ser posterior à atual e no máximo 14 dias de distância ({formatDateBR(maxCarryDate)}).
              </p>
            </div>

            <form onSubmit={handleCarrySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="carry-date-input" className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider block">
                  Nova data agendada
                </label>
                <input
                  id="carry-date-input"
                  type="date"
                  min={minCarryDate}
                  max={maxCarryDate}
                  value={carryDate}
                  onChange={(e) => setCarryDate(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-muted/40 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCarryModal(false)}
                  className="px-4 h-10 rounded-xl bg-muted text-muted-foreground text-xs font-bold hover:bg-muted/80 transition-all"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-4 h-10 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:scale-[1.01] transition-transform"
                >
                  ADIAR REVISÃO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
