"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { getTodayRangeSP } from "@/lib/date-utils";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";

export interface ActiveStudyTimerSession {
  blockId: string;
  subjectId: string;
  subjectName: string;
  blockTitle: string;
  startedAt: string; // ISO string
}

export interface StudyTimerSnapshot {
  startedAt: string | null;
  completedAt: string | null;
  actualDurationMinutes: number | null;
}

export interface StudyTimerSessionInput {
  blockId: string;
  subjectId: string;
  subjectName: string;
  blockTitle: string;
}

export interface StudyTimerContextValue {
  session: ActiveStudyTimerSession | null;
  elapsedSeconds: number;
  isRunning: boolean;
  isIdle: boolean;
  pauseReason: "IDLE" | "DAY_CHANGED" | null;
  legacyUnassigned: number;
  startSession(input: StudyTimerSessionInput, startRunning?: boolean): void;
  pause(reason?: "IDLE" | "DAY_CHANGED"): void;
  resume(): void;
  reset(): void;
  resetLegacy(): void;
  getSessionSnapshot(blockId: string): StudyTimerSnapshot;
  completeSession(blockId: string): void;
}

interface PersistedTimerState {
  userId: string;
  session: ActiveStudyTimerSession | null;
  accumulatedSeconds: number;
  runningSince: number | null; // ms timestamp
  isRunning: boolean;
  lastPersistedAt: number;
  revision: number;
  pauseReason: "IDLE" | "DAY_CHANGED" | null;
  legacyUnassigned: number;
  dateStringSP: string;
}

const STORAGE_KEY = "kehl-study-timer:v2";
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

function getDefaultState(userId: string): PersistedTimerState {
  return {
    userId,
    session: null,
    accumulatedSeconds: 0,
    runningSince: null,
    isRunning: false,
    lastPersistedAt: Date.now(),
    revision: 0,
    pauseReason: null,
    legacyUnassigned: 0,
    dateStringSP: getTodayRangeSP(new Date()).dateString,
  };
}

function sanitizeState(parsed: any, userId: string): PersistedTimerState {
  const defaultState = getDefaultState(userId);
  if (!parsed || typeof parsed !== "object") return defaultState;

  const sanitized = { ...defaultState };

  if (typeof parsed.userId === "string") {
    sanitized.userId = parsed.userId;
  }

  if (parsed.session && typeof parsed.session === "object") {
    const s = parsed.session;
    if (
      typeof s.blockId === "string" &&
      typeof s.subjectId === "string" &&
      typeof s.subjectName === "string" &&
      typeof s.blockTitle === "string" &&
      typeof s.startedAt === "string"
    ) {
      sanitized.session = {
        blockId: s.blockId,
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        blockTitle: s.blockTitle,
        startedAt: s.startedAt,
      };
    }
  }

  if (typeof parsed.accumulatedSeconds === "number" && Number.isFinite(parsed.accumulatedSeconds) && parsed.accumulatedSeconds >= 0) {
    sanitized.accumulatedSeconds = parsed.accumulatedSeconds;
  }

  if (typeof parsed.runningSince === "number" && Number.isFinite(parsed.runningSince) && parsed.runningSince > 0) {
    if (parsed.runningSince > Date.now() + 5000) {
      sanitized.runningSince = Date.now();
    } else {
      sanitized.runningSince = parsed.runningSince;
    }
  } else {
    sanitized.runningSince = null;
  }

  if (typeof parsed.isRunning === "boolean") {
    sanitized.isRunning = parsed.isRunning;
  }

  if (sanitized.isRunning && !sanitized.runningSince) {
    sanitized.runningSince = Date.now();
  } else if (!sanitized.isRunning) {
    sanitized.runningSince = null;
  }

  if (typeof parsed.lastPersistedAt === "number" && Number.isFinite(parsed.lastPersistedAt)) {
    sanitized.lastPersistedAt = parsed.lastPersistedAt;
  }

  if (typeof parsed.revision === "number" && Number.isFinite(parsed.revision) && parsed.revision >= 0) {
    sanitized.revision = parsed.revision;
  }

  if (parsed.pauseReason === "IDLE" || parsed.pauseReason === "DAY_CHANGED") {
    sanitized.pauseReason = parsed.pauseReason;
  } else {
    sanitized.pauseReason = null;
  }

  if (typeof parsed.legacyUnassigned === "number" && Number.isFinite(parsed.legacyUnassigned) && parsed.legacyUnassigned >= 0) {
    sanitized.legacyUnassigned = parsed.legacyUnassigned;
  }

  if (typeof parsed.dateStringSP === "string") {
    sanitized.dateStringSP = parsed.dateStringSP;
  }

  return sanitized;
}

const StudyTimerContext = createContext<StudyTimerContextValue | undefined>(undefined);

export function StudyTimerProvider({ children }: { children: React.ReactNode }) {
  const { preferences, isLoading: prefsLoading } = useStudyPreferences();
  const userId = preferences.userId || "";

  // The central state
  const [state, setState] = useState<PersistedTimerState | null>(null);
  // React state updated in interval to tick UI smoothly
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const lastActivityRef = useRef<number>(0);
  const unmountInProgressRef = useRef(false);

  // Helper to persist to localStorage safely
  const persistState = useCallback((nextState: PersistedTimerState) => {
    try {
      const stateToSave = {
        ...nextState,
        lastPersistedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      setState(stateToSave);
    } catch (e) {
      console.error("Erro ao gravar localStorage no timer:", e);
    }
  }, []);

  // Helper to calculate current elapsed time from state
  const getElapsedFromState = useCallback((s: PersistedTimerState) => {
    if (!s.isRunning || !s.runningSince) {
      return s.accumulatedSeconds;
    }
    const elapsed = s.accumulatedSeconds + Math.floor((Date.now() - s.runningSince) / 1000);
    return Math.max(0, elapsed);
  }, []);

  // Load / migrate on mount (once preferences are loaded)
  useEffect(() => {
    if (prefsLoading || !userId) return;

    let loadedState: PersistedTimerState | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.userId === userId) {
          loadedState = sanitizeState(parsed, userId);
        } else {
          // Divergence in userId: discard and use default
          loadedState = getDefaultState(userId);
        }
      }
    } catch (e) {
      console.warn("Falha ao analisar JSON do cronômetro global, reiniciando:", e);
    }

    if (!loadedState) {
      loadedState = getDefaultState(userId);
    }

    // Legacy migration check
    const todayStr = getTodayRangeSP(new Date()).dateString;
    const oldAccKey = `study-timer-accumulated-${todayStr}`;
    const oldStartKey = `study-timer-start-${todayStr}`;
    let legacyVal = 0;
    let hasLegacy = false;

    try {
      const rawOldAcc = localStorage.getItem(oldAccKey);
      const rawOldStart = localStorage.getItem(oldStartKey);

      if (rawOldAcc !== null || rawOldStart !== null) {
        hasLegacy = true;
        const oldAcc = rawOldAcc ? Number(rawOldAcc) : 0;
        const oldStart = rawOldStart ? Number(rawOldStart) : 0;
        let oldElapsed = Number.isFinite(oldAcc) && oldAcc > 0 ? oldAcc : 0;
        if (Number.isFinite(oldStart) && oldStart > 0) {
          oldElapsed += Math.max(0, Math.floor((Date.now() - oldStart) / 1000));
        }
        legacyVal = oldElapsed;
      }
    } catch (e) {
      console.error("Erro na leitura de chaves legadas:", e);
    }

    if (hasLegacy) {
      loadedState.legacyUnassigned = legacyVal;
      loadedState.revision += 1;
      persistState(loadedState);
      try {
        localStorage.removeItem(oldAccKey);
        localStorage.removeItem(oldStartKey);
      } catch (e) {}
    } else {
      setState(loadedState);
    }

    // Set initial elapsed
    setElapsedSeconds(getElapsedFromState(loadedState));
    lastActivityRef.current = Date.now();
  }, [userId, prefsLoading, getElapsedFromState, persistState]);

  // Synchronize state changes from other tabs in real-time
  useEffect(() => {
    if (typeof window === "undefined" || !userId) return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          const incoming = sanitizeState(parsed, userId);
          if (incoming.userId === userId) {
            setState((curr) => {
              const currentRev = curr ? curr.revision : -1;
              if (incoming.revision > currentRev) {
                setElapsedSeconds(getElapsedFromState(incoming));
                return incoming;
              }
              return curr;
            });
          }
        } catch (e) {
          console.error("Erro ao sincronizar cronômetro entre abas:", e);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [userId, getElapsedFromState]);

  // Dynamic ticking interval when running + inactivity & rollover checks
  useEffect(() => {
    if (!state || !state.isRunning) return;

    const interval = setInterval(() => {
      // 1. Tick elapsed seconds
      const elapsed = getElapsedFromState(state);
      setElapsedSeconds(elapsed);

      // 2. Inactivity check (15 minutes limit)
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;
      if (idleTime >= IDLE_TIMEOUT_MS) {
        // Pause due to idle
        const accumulated = state.accumulatedSeconds + Math.floor((now - state.runningSince!) / 1000);
        const nextState: PersistedTimerState = {
          ...state,
          isRunning: false,
          runningSince: null,
          accumulatedSeconds: Math.max(0, accumulated),
          pauseReason: "IDLE",
          revision: state.revision + 1,
        };
        persistState(nextState);
        return;
      }

      // 3. Day civil rollover check
      const currentDayStr = getTodayRangeSP(new Date()).dateString;
      if (currentDayStr !== state.dateStringSP) {
        // Roll over detected: Pause timer, set DAY_CHANGED
        const accumulated = state.accumulatedSeconds + Math.floor((now - state.runningSince!) / 1000);
        const nextState: PersistedTimerState = {
          ...state,
          isRunning: false,
          runningSince: null,
          accumulatedSeconds: Math.max(0, accumulated),
          pauseReason: "DAY_CHANGED",
          dateStringSP: currentDayStr,
          revision: state.revision + 1,
        };
        persistState(nextState);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state, getElapsedFromState, persistState]);

  // Activity listeners to reset idle timer
  useEffect(() => {
    if (!state || !state.isRunning) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);
    window.addEventListener("touchstart", handleActivity);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, [state]);

  // Handle logout: clean up state when userId goes empty or changes
  useEffect(() => {
    if (!prefsLoading && !userId && state) {
      // User is logged out, clear context
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      setState(null);
      setElapsedSeconds(0);
    }
  }, [userId, prefsLoading, state]);

  // Pause on unmount (public route navigation or tab exit)
  useEffect(() => {
    unmountInProgressRef.current = false;
    return () => {
      unmountInProgressRef.current = true;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.isRunning && parsed.runningSince) {
            const now = Date.now();
            const accumulated = parsed.accumulatedSeconds + Math.floor((now - parsed.runningSince) / 1000);
            const pausedState: PersistedTimerState = {
              ...parsed,
              isRunning: false,
              runningSince: null,
              accumulatedSeconds: Math.max(0, accumulated),
              revision: parsed.revision + 1,
              lastPersistedAt: now,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(pausedState));
          }
        }
      } catch (e) {
        console.error("Erro ao pausar cronômetro no desmonte:", e);
      }
    };
  }, []);

  // Action: Iniciar Sessão
  const startSession = useCallback((input: StudyTimerSessionInput, startRunning = false) => {
    if (!userId || !state) return;

    const nextState: PersistedTimerState = {
      ...state,
      session: {
        blockId: input.blockId,
        subjectId: input.subjectId,
        subjectName: input.subjectName,
        blockTitle: input.blockTitle,
        startedAt: new Date().toISOString(),
      },
      accumulatedSeconds: 0,
      runningSince: startRunning ? Date.now() : null,
      isRunning: startRunning,
      pauseReason: null,
      revision: state.revision + 1,
    };

    persistState(nextState);
    setElapsedSeconds(0);
    lastActivityRef.current = Date.now();
  }, [userId, state, persistState]);

  // Action: Pausar
  const pause = useCallback((reason?: "IDLE" | "DAY_CHANGED") => {
    if (!userId || !state) return;

    const nextState = { ...state };
    if (state.isRunning && state.runningSince) {
      const now = Date.now();
      const elapsed = state.accumulatedSeconds + Math.floor((now - state.runningSince) / 1000);
      nextState.accumulatedSeconds = Math.max(0, elapsed);
    }
    nextState.isRunning = false;
    nextState.runningSince = null;
    nextState.pauseReason = reason || null;
    nextState.revision += 1;

    persistState(nextState);
    setElapsedSeconds(nextState.accumulatedSeconds);
  }, [userId, state, persistState]);

  // Action: Retomar
  const resume = useCallback(() => {
    if (!userId || !state || !state.session) return;

    const nextState: PersistedTimerState = {
      ...state,
      isRunning: true,
      runningSince: Date.now(),
      pauseReason: null,
      revision: state.revision + 1,
    };

    persistState(nextState);
    setElapsedSeconds(getElapsedFromState(nextState));
    lastActivityRef.current = Date.now();
  }, [userId, state, getElapsedFromState, persistState]);

  // Action: Zerar / Resetar
  const reset = useCallback(() => {
    if (!userId || !state) return;

    const nextState: PersistedTimerState = {
      ...state,
      session: null,
      accumulatedSeconds: 0,
      runningSince: null,
      isRunning: false,
      pauseReason: null,
      revision: state.revision + 1,
    };

    persistState(nextState);
    setElapsedSeconds(0);
  }, [userId, state, persistState]);

  // Action: Resetar tempo legado
  const resetLegacy = useCallback(() => {
    if (!userId || !state) return;

    const nextState: PersistedTimerState = {
      ...state,
      legacyUnassigned: 0,
      revision: state.revision + 1,
    };
    persistState(nextState);
  }, [userId, state, persistState]);

  // Action: Obter snapshot para envio à API (não modifica estado)
  const getSessionSnapshot = useCallback((blockId: string): StudyTimerSnapshot => {
    if (!state || !state.session || state.session.blockId !== blockId) {
      return { startedAt: null, completedAt: null, actualDurationMinutes: null };
    }

    const currentElapsed = getElapsedFromState(state);
    const durationMin = Math.max(1, Math.round(currentElapsed / 60));

    return {
      startedAt: state.session.startedAt,
      completedAt: new Date().toISOString(),
      actualDurationMinutes: durationMin,
    };
  }, [state, getElapsedFromState]);

  // Action: Confirmar e encerrar a sessão (após sucesso da API)
  const completeSession = useCallback((blockId: string) => {
    if (!userId || !state) return;
    if (state.session && state.session.blockId === blockId) {
      const nextState: PersistedTimerState = {
        ...state,
        session: null,
        accumulatedSeconds: 0,
        runningSince: null,
        isRunning: false,
        pauseReason: null,
        revision: state.revision + 1,
      };
      persistState(nextState);
      setElapsedSeconds(0);
    }
  }, [userId, state, persistState]);

  const value: StudyTimerContextValue = {
    session: state ? state.session : null,
    elapsedSeconds,
    isRunning: state ? state.isRunning : false,
    isIdle: state ? (!state.isRunning && state.pauseReason === "IDLE") : false,
    pauseReason: state ? state.pauseReason : null,
    legacyUnassigned: state ? state.legacyUnassigned : 0,
    startSession,
    pause,
    resume,
    reset,
    resetLegacy,
    getSessionSnapshot,
    completeSession,
  };

  return (
    <StudyTimerContext.Provider value={value}>
      {children}
    </StudyTimerContext.Provider>
  );
}

export function useStudyTimer() {
  const context = useContext(StudyTimerContext);
  if (context === undefined) {
    throw new Error("useStudyTimer deve ser usado dentro de um StudyTimerProvider");
  }
  return context;
}
