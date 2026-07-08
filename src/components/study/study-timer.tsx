"use client";

import { useEffect, useState, useCallback } from "react";
import { Play, Pause, RotateCcw, Timer, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudyTimer } from "@/contexts/StudyTimerContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) {
    const hh = String(hours).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StudyTimer() {
  const {
    session,
    elapsedSeconds,
    isRunning,
    pauseReason,
    legacyUnassigned,
    isHydrated,
    resume,
    pause,
    reset,
    resetLegacy,
  } = useStudyTimer();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (isRunning) {
      pause();
    } else {
      resume();
    }
  }, [isRunning, pause, resume]);

  if (!mounted || !isHydrated) return null;

  return (
    <div
      className={cn(
        "fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6",
        "rounded-2xl border border-border/40 bg-card/80 text-card-foreground",
        "shadow-lg backdrop-blur-xl",
        "transition-all duration-300",
        "w-[230px] select-none p-3 flex flex-col gap-2",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 justify-between">
        <div className="flex items-center gap-1.5">
          <Timer
            className={cn(
              "h-3.5 w-3.5 transition-colors duration-300",
              isRunning ? "text-accent" : "text-muted-foreground",
            )}
          />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Tempo de estudo
          </span>
        </div>
        {isRunning && (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        )}
      </div>

      {/* Subject and Block Info */}
      {session ? (
        <div className="flex flex-col gap-0.5 max-w-full overflow-hidden">
          <span className="text-xs font-bold text-foreground truncate" title={session.subjectName}>
            {session.subjectName}
          </span>
          <span className="text-[10px] text-muted-foreground truncate" title={session.blockTitle}>
            {session.blockTitle}
          </span>
        </div>
      ) : (
        <div className="text-[10px] text-muted-foreground italic">
          Abra um bloco para iniciar
        </div>
      )}

      {/* Timer display + controls */}
      <div className="flex items-center justify-between mt-1">
        <span
          className={cn(
            "font-mono text-xl font-bold tabular-nums tracking-tight transition-colors duration-300",
            isRunning ? "text-accent" : "text-foreground",
          )}
        >
          {formatTime(elapsedSeconds)}
        </span>

        <div className="flex items-center gap-1">
          {/* Play / Pause / Resume */}
          <button
            type="button"
            onClick={handlePlayPause}
            disabled={!session}
            aria-label={isRunning ? "Pausar cronômetro" : "Iniciar cronômetro"}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
              session
                ? "bg-sage-light text-accent hover:brightness-95 active:scale-95 cursor-pointer"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed",
            )}
          >
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={reset}
            disabled={!session}
            aria-label="Resetar cronômetro"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
              session
                ? "text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
                : "text-muted-foreground/30 cursor-not-allowed",
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Specific Pause Warnings */}
      {!isRunning && pauseReason && (
        <div className="mt-1 flex items-start gap-1 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="text-[9px] font-medium leading-normal">
            {pauseReason === "IDLE"
              ? "Pausado por inatividade"
              : "Pausado por mudança de dia (estudo começou ontem)"}
          </span>
        </div>
      )}

      {/* Legacy/Migrated Time */}
      {legacyUnassigned > 0 && (
        <div className="mt-1 pt-1.5 border-t border-border/40 flex items-center justify-between">
          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold truncate">
            Legado: {formatTime(legacyUnassigned)}
          </span>
          <button
            type="button"
            onClick={resetLegacy}
            className="text-[9px] text-muted-foreground hover:text-foreground hover:underline font-bold"
          >
            Zerar
          </button>
        </div>
      )}
    </div>
  );
}
