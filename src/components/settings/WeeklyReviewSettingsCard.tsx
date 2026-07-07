"use client";

import React, { useState, useEffect } from "react";
import { Sliders, Wrench, Loader2 } from "lucide-react";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";
import { toast } from "sonner";

export function WeeklyReviewSettingsCard() {
  const { preferences, syncWithServer } = useStudyPreferences();

  // Local state initialized with context preferences
  const [enabled, setEnabled] = useState(preferences.weeklyReviewEnabled);
  const [dayOfWeek, setDayOfWeek] = useState(preferences.weeklyReviewDayOfWeek);
  const [missedBehavior, setMissedBehavior] = useState<
    "MOVE_TO_NEXT_AVAILABLE_DAY" | "SKIP_CURRENT_WEEK"
  >(preferences.weeklyReviewMissedBehavior);

  const [hasOpenSession, setHasOpenSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load latest state from server on mount
  useEffect(() => {
    async function loadWeeklyReviewPrefs() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/weekly-review/preferences");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setEnabled(json.data.enabled);
            setDayOfWeek(json.data.dayOfWeek);
            setMissedBehavior(json.data.missedBehavior);
            setHasOpenSession(json.data.hasOpenSession);
          }
        }
      } catch (e) {
        console.error("Erro ao carregar preferências de revisão semanal:", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadWeeklyReviewPrefs();
  }, []);

  // Sincronizar com as alterações globais vindas do hook
  useEffect(() => {
    setEnabled(preferences.weeklyReviewEnabled);
    setDayOfWeek(preferences.weeklyReviewDayOfWeek);
    setMissedBehavior(preferences.weeklyReviewMissedBehavior);
  }, [preferences.weeklyReviewEnabled, preferences.weeklyReviewDayOfWeek, preferences.weeklyReviewMissedBehavior]);

  // Check if dirty
  const isDirty =
    enabled !== preferences.weeklyReviewEnabled ||
    dayOfWeek !== preferences.weeklyReviewDayOfWeek ||
    missedBehavior !== preferences.weeklyReviewMissedBehavior;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch("/api/weekly-review/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          enabled,
          dayOfWeek,
          missedBehavior
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("Configurações da revisão semanal salvas com sucesso!");
        setHasOpenSession(data.data.hasOpenSession);

        // Atualizar hook de preferências para persistir as alterações globalmente
        await syncWithServer();
      } else {
        const errMsg = data.error?.message || "Erro desconhecido ao salvar preferências.";
        toast.error(errMsg);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro de conexão ao salvar configurações da revisão semanal.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border/40 rounded-[2.5rem] p-8 shadow-sm flex items-center justify-center space-x-2">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
        <span className="text-sm text-muted-foreground">Carregando dados da revisão semanal...</span>
      </div>
    );
  }

  return (
    <div
      id="revisao-semanal"
      className="bg-card border border-border/40 rounded-[2.5rem] p-8 space-y-6 shadow-sm scroll-mt-6"
    >
      <div className="flex items-center gap-3 border-b border-border/30 pb-4">
        <div className="w-10 h-10 rounded-2xl bg-sage-light flex items-center justify-center">
          <Wrench className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Revisão Semanal</h2>
          <p className="text-xs text-muted-foreground">
            Reserve um dia da semana para revisar por questões os principais assuntos estudados nos últimos dias.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Toggle Switch */}
        <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-border/20">
          <div className="space-y-0.5">
            <label htmlFor="weekly-review-toggle" className="text-sm font-bold text-foreground cursor-pointer">
              Ativar revisão semanal
            </label>
            <p className="text-xs text-muted-foreground">
              Habilita a consolidação e montagem periódica das revisões semanais de teoria.
            </p>
          </div>
          <button
            type="button"
            id="weekly-review-toggle"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
              enabled ? "bg-accent" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {!enabled && hasOpenSession && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
            <div className="text-xs text-amber-800 leading-relaxed">
              <span className="font-bold">Atenção:</span> Você possui uma sessão de revisão semanal ativa (pendente ou em andamento). Ela não será excluída automaticamente.
            </div>
          </div>
        )}

        {/* Day Select */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="weekly-review-day" className="text-xs font-bold text-foreground uppercase tracking-wider block">
              Dia da revisão
            </label>
            <div className="relative">
              <select
                id="weekly-review-day"
                value={dayOfWeek}
                disabled={!enabled}
                onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
                className="w-full h-12 px-4 rounded-xl bg-muted/40 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
              >
                <option value={0}>Domingo</option>
                <option value={1}>Segunda-feira</option>
                <option value={2}>Terça-feira</option>
                <option value={3}>Quarta-feira</option>
                <option value={4}>Quinta-feira</option>
                <option value={5}>Sexta-feira</option>
                <option value={6}>Sábado</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-muted-foreground">
                <Sliders className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Missed Behavior Select */}
          <div className="space-y-2">
            <label htmlFor="weekly-review-behavior" className="text-xs font-bold text-foreground uppercase tracking-wider block">
              Se eu perder o dia
            </label>
            <div className="relative">
              <select
                id="weekly-review-behavior"
                value={missedBehavior}
                disabled={!enabled}
                onChange={(e) =>
                  setMissedBehavior(e.target.value as "MOVE_TO_NEXT_AVAILABLE_DAY" | "SKIP_CURRENT_WEEK")
                }
                className="w-full h-12 px-4 rounded-xl bg-muted/40 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
              >
                <option value="MOVE_TO_NEXT_AVAILABLE_DAY">Transferir para o próximo dia disponível</option>
                <option value="SKIP_CURRENT_WEEK">Pular esta semana</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-muted-foreground">
                <Sliders className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Informative Note */}
        <div className="p-4 bg-sage-light/10 border border-accent/20 rounded-2xl flex items-start gap-3">
          <div className="text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold text-accent mb-0.5">Nota informativa:</p>
            A revisão semanal ainda não altera automaticamente o seu cronograma. A sessão será preparada somente quando você solicitar.
          </div>
        </div>

        {/* CTA Link to Weekly Review Page */}
        {(enabled || hasOpenSession) && (
          <div className="flex justify-between items-center p-4 bg-sage-light/10 border border-accent/20 rounded-2xl">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-foreground">Sessão de Revisão Disponível</h4>
              <p className="text-xs text-muted-foreground">
                Acesse a página de revisão semanal para visualizar seu progresso ou iniciar uma nova sessão.
              </p>
            </div>
            <a
              href="/weekly-review"
              className="flex items-center justify-center px-5 h-10 rounded-xl text-xs font-bold bg-accent text-white hover:scale-[1.01] transition-all cursor-pointer"
            >
              ABRIR REVISÃO SEMANAL
            </a>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving || !isDirty}
            className={`flex items-center justify-center px-6 h-12 rounded-xl text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent ${
              isDirty && !isSaving
                ? "bg-accent text-white hover:scale-[1.01] cursor-pointer"
                : "bg-muted/50 text-muted-foreground cursor-not-allowed"
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "SALVAR REVISÃO SEMANAL"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
