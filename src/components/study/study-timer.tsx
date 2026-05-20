"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTodayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function storageKey(suffix: string) {
  return `study-timer-${suffix}-${getTodayKey()}`;
}

function readNumber(key: string): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(key);
  if (raw === null) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ------ Cleanup helper ------
  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ------ Persist to localStorage ------
  const persist = useCallback(
    (accumulated: number, running: boolean, startTs?: number) => {
      const accKey = storageKey("accumulated");
      const startKey = storageKey("start");

      localStorage.setItem(accKey, String(accumulated));

      if (running && startTs !== undefined) {
        localStorage.setItem(startKey, String(startTs));
      } else {
        localStorage.removeItem(startKey);
      }
    },
    [],
  );

  // ------ Restore from localStorage on mount ------
  useEffect(() => {
    const accKey = storageKey("accumulated");
    const startKey = storageKey("start");

    const accumulated = readNumber(accKey);
    const startTs = readNumber(startKey);

    if (startTs > 0) {
      // Timer was running when user navigated away
      const now = Date.now();
      const extra = (now - startTs) / 1000;
      const total = accumulated + extra;
      setElapsedSeconds(total);
      setIsRunning(true);
    } else {
      setElapsedSeconds(accumulated);
      setIsRunning(false);
    }

    setMounted(true);
  }, []);

  // ------ Tick interval ------
  useEffect(() => {
    if (!mounted) return;

    clearTimer();

    if (isRunning) {
      const startKey = storageKey("start");
      const accKey = storageKey("accumulated");
      const accumulated = readNumber(accKey);
      const startTs = readNumber(startKey);

      // Ensure a valid startTs exists
      if (startTs <= 0) {
        const now = Date.now();
        localStorage.setItem(startKey, String(now));
      }

      intervalRef.current = setInterval(() => {
        const currentStart = readNumber(storageKey("start"));
        const currentAcc = readNumber(storageKey("accumulated"));
        if (currentStart > 0) {
          const now = Date.now();
          const total = currentAcc + (now - currentStart) / 1000;
          setElapsedSeconds(total);
        }
      }, 1000);
    }

    return clearTimer;
  }, [isRunning, mounted, clearTimer]);

  // ------ Actions ------
  const handlePlay = useCallback(() => {
    if (isRunning) return;
    const now = Date.now();
    const accumulated = Math.floor(elapsedSeconds);
    persist(accumulated, true, now);
    setIsRunning(true);
  }, [isRunning, elapsedSeconds, persist]);

  const handlePause = useCallback(() => {
    if (!isRunning) return;
    const startTs = readNumber(storageKey("start"));
    const accumulated = readNumber(storageKey("accumulated"));
    const now = Date.now();
    const newAccumulated =
      startTs > 0 ? accumulated + (now - startTs) / 1000 : accumulated;
    persist(Math.floor(newAccumulated), false);
    setElapsedSeconds(Math.floor(newAccumulated));
    setIsRunning(false);
  }, [isRunning, persist]);

  const handleReset = useCallback(() => {
    clearTimer();
    localStorage.removeItem(storageKey("accumulated"));
    localStorage.removeItem(storageKey("start"));
    setElapsedSeconds(0);
    setIsRunning(false);
  }, [clearTimer]);

  // ------ Avoid hydration mismatch ------
  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6",
        "rounded-2xl border border-border/40 bg-card/80 text-card-foreground",
        "shadow-lg backdrop-blur-xl",
        "transition-all duration-300",
        "w-[210px] select-none",
      )}
    >
      <div className="flex flex-col gap-1 px-3 py-2.5">
        {/* Header */}
        <div className="flex items-center gap-1.5">
          <Timer
            className={cn(
              "h-3.5 w-3.5 transition-colors duration-300",
              isRunning ? "text-accent" : "text-muted-foreground",
            )}
          />
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Tempo de estudo
          </span>
        </div>

        {/* Timer display + controls */}
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "font-mono text-xl font-semibold tabular-nums tracking-tight transition-colors duration-300",
              isRunning ? "text-accent" : "text-foreground",
            )}
          >
            {formatTime(elapsedSeconds)}
          </span>

          <div className="flex items-center gap-1">
            {/* Play / Pause */}
            {isRunning ? (
              <button
                type="button"
                onClick={handlePause}
                aria-label="Pausar cronômetro"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-xl",
                  "bg-sage-light text-accent",
                  "transition-all duration-200",
                  "hover:brightness-95 active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
                )}
              >
                <Pause className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePlay}
                aria-label="Iniciar cronômetro"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-xl",
                  "bg-sage-light text-accent",
                  "transition-all duration-200",
                  "hover:brightness-95 active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
                )}
              >
                <Play className="h-4 w-4" />
              </button>
            )}

            {/* Reset */}
            <button
              type="button"
              onClick={handleReset}
              aria-label="Resetar cronômetro"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl",
                "text-muted-foreground",
                "transition-all duration-200",
                "hover:bg-muted hover:text-foreground active:scale-95",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
