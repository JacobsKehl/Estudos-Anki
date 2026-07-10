"use client";

import { useEffect, useState, useCallback } from "react";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

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

import { useUserGlobalTimer } from "@/contexts/UserGlobalTimerContext";

export function StudyTimer() {
  const {
    elapsedSeconds,
    isRunning,
    isHydrated,
    startOrResume,
    pause,
    reset,
  } = useUserGlobalTimer();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (isRunning) {
      pause();
    } else {
      startOrResume();
    }
  }, [isRunning, pause, startOrResume]);

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
            Cronômetro geral
          </span>
        </div>
        {isRunning && (
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        )}
      </div>

      {/* Timer display + controls */}
      <div className="flex items-center justify-between mt-1">
        <span
          className={cn(
            "font-mono text-xl font-bold tabular-nums tracking-tight transition-colors duration-300",
            isRunning ? "text-accent" : "text-foreground",
          )}
          data-testid="general-timer-display"
        >
          {formatTime(elapsedSeconds)}
        </span>

        <div className="flex items-center gap-1">
          {/* Play / Pause / Resume */}
          <button
            type="button"
            onClick={handlePlayPause}
            aria-label={isRunning ? "Pausar" : "Iniciar"}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
              "bg-sage-light text-accent hover:brightness-95 active:scale-95 cursor-pointer"
            )}
          >
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={reset}
            aria-label="Resetar"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
              "text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 cursor-pointer"
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
