"use client";

import React, { useState } from "react";
import { Clock, Loader2, BookOpen } from "lucide-react";
import { suggestQuestionCount } from "@/lib/weekly-review-ui";

interface Props {
  onSubmit: (availableMinutes: number) => Promise<void>;
  isMutating: boolean;
}

const TIME_PRESETS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
  { label: "90 min", value: 90 },
];

export function WeeklyReviewPreviewForm({ onSubmit, isMutating }: Props) {
  const [minutes, setMinutes] = useState(60);
  const suggestedCount = suggestQuestionCount(minutes);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(minutes);
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-8">
      <div className="bg-card border border-border/40 rounded-[2.5rem] p-8 shadow-sm space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/30 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-sage-light flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Nova Revisão Semanal</h1>
            <p className="text-xs text-muted-foreground">
              Selecione o tempo disponível para gerar a prévia dos assuntos.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Time presets */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
              <Clock className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
              Tempo disponível
            </label>
            <div className="flex flex-wrap gap-2">
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setMinutes(preset.value)}
                  className={`px-4 h-10 rounded-xl text-sm font-medium transition-all ${
                    minutes === preset.value
                      ? "bg-accent text-accent-foreground shadow-sm scale-[1.02]"
                      : "bg-muted/40 text-foreground border border-border/40 hover:bg-muted/60"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom slider */}
            <div className="pt-2 space-y-2">
              <input
                type="range"
                min={15}
                max={120}
                step={5}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-accent"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>15 min</span>
                <span className="font-bold text-foreground text-sm">{minutes} min</span>
                <span>120 min</span>
              </div>
            </div>
          </div>

          {/* Suggestion card */}
          <div className="p-4 bg-sage-light/20 border border-accent/20 rounded-2xl space-y-1">
            <p className="text-xs font-semibold text-accent">Sugestão automática</p>
            <p className="text-sm text-foreground">
              <span className="font-bold">{suggestedCount}</span> questões para{" "}
              <span className="font-bold">{minutes}</span> minutos
            </p>
            <p className="text-xs text-muted-foreground">
              ≈ 3 minutos por questão (mínimo 5, máximo 50)
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isMutating}
            className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-accent text-accent-foreground text-sm font-bold shadow-sm hover:scale-[1.01] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMutating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando prévia...
              </>
            ) : (
              "GERAR PRÉVIA"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
