"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { getTodayRangeSP } from "@/lib/date-utils";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";

export interface ActiveStudyTimerSession {
  blockId: string;
  subjectId: string;
  subjectName: string;
  blockTitle: string;
  startedAt: string | null; // ISO string or null
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

export type PrepareSessionResult =
  | { status: "PREPARED" }
  | { status: "ALREADY_CURRENT" }
  | { status: "CONFLICT"; activeSession: ActiveStudyTimerSession };

export interface StudyTimerContextValue {
  session: ActiveStudyTimerSession | null;
  elapsedSeconds: number;
  isRunning: boolean;
  isIdle: boolean;
  pauseReason: "IDLE" | "DAY_CHANGED" | null;
  legacyUnassigned: number;
  isHydrated: boolean;
  prepareSession(input: StudyTimerSessionInput): PrepareSessionResult;
  startOrResume(): void;
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
const ACTIVITY_KEY = "kehl-study-timer-activity:v2";
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
      typeof s.blockTitle === "string"
    ) {
      sanitized.session = {
        blockId: s.blockId,
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        blockTitle: s.blockTitle,
        startedAt: typeof s.startedAt === "string" ? s.startedAt : null,
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
  const [isHydrated, setIsHydrated] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const stateRef = useRef<PersistedTimerState | null>(null);
  const unmountInProgressRef = useRef(false);

  const localLastActivityRef = useRef<number>(0);
  const sharedLastActivityRef = useRef<number>(0);
  const lastActivityWriteRef = useRef<number>(0);

  // Helper to persist to localStorage safely (synchronously updates ref)
  const commitState = useCallback((nextState: PersistedTimerState) => {
    try {
      const stateToSave = {
        ...nextState,
        lastPersistedAt: Date.now(),
      };
      stateRef.current = stateToSave;
      setState(stateToSave);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
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

  // Reset hydration when userId changes
  useEffect(() => {
    if (userId) {
      setIsHydrated(false);
    }
  }, [userId]);

  // Load / migrate on mount (once preferences are loaded)
  useEffect(() => {
    if (prefsLoading || !userId) {
      setIsHydrated(false);
      stateRef.current = null;
      setState(null);
      setElapsedSeconds(0);
      return;
    }

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
    } catch {
      console.warn("Falha ao analisar JSON do cronômetro global, reiniciando:");
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
    } catch {
      console.error("Erro na leitura de chaves legadas:");
    }

    if (hasLegacy) {
      loadedState.legacyUnassigned = legacyVal;
      loadedState.revision += 1;
      commitState(loadedState);
      try {
        localStorage.removeItem(oldAccKey);
        localStorage.removeItem(oldStartKey);
      } catch {}
    } else {
      stateRef.current = loadedState;
      setState(loadedState);
    }

    // Set initial elapsed
    setElapsedSeconds(getElapsedFromState(loadedState));
    localLastActivityRef.current = Date.now();
    setIsHydrated(true);
  }, [userId, prefsLoading, getElapsedFromState, commitState]);

  // Synchronize state changes from other tabs in real-time
  useEffect(() => {
    if (typeof window === "undefined" || !userId) return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          const incoming = sanitizeState(parsed, userId);
          if (incoming.userId === userId) {
            const currentRev = stateRef.current ? stateRef.current.revision : -1;
            if (incoming.revision > currentRev) {
              stateRef.current = incoming;
              setState(incoming);
              setElapsedSeconds(getElapsedFromState(incoming));
            }
          }
        } catch (e) {
          console.error("Erro ao sincronizar cronômetro entre abas:", e);
        }
      } else if (event.key === ACTIVITY_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          if (parsed && parsed.userId === userId && typeof parsed.lastActivityAt === "number") {
            const now = Date.now();
            if (parsed.lastActivityAt >= 0 && parsed.lastActivityAt <= now + 60000) {
              sharedLastActivityRef.current = Math.max(sharedLastActivityRef.current, parsed.lastActivityAt);
            }
          }
        } catch {}
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [userId, getElapsedFromState]);

  // Dynamic ticking interval when running + inactivity & rollover checks
  useEffect(() => {
    if (!state || !state.isRunning) return;

    const interval = setInterval(() => {
      const currentState = stateRef.current;
      if (!currentState || !currentState.isRunning) return;

      // 1. Tick elapsed seconds
      const elapsed = getElapsedFromState(currentState);
      setElapsedSeconds(elapsed);

      // 2. Inactivity check (15 minutes limit) with multi-tab activity sync
      const now = Date.now();
      let sharedLastActivityAt = 0;
      try {
        const sharedRaw = localStorage.getItem(ACTIVITY_KEY);
        if (sharedRaw) {
          const parsedShared = JSON.parse(sharedRaw);
          if (parsedShared && parsedShared.userId === userId && typeof parsedShared.lastActivityAt === "number") {
            if (parsedShared.lastActivityAt >= 0 && parsedShared.lastActivityAt <= now + 60000) {
              sharedLastActivityAt = parsedShared.lastActivityAt;
            }
          }
        }
      } catch {}

      sharedLastActivityRef.current = Math.max(sharedLastActivityRef.current, sharedLastActivityAt);
      const latestActivity = Math.max(localLastActivityRef.current, sharedLastActivityRef.current);

      if (now - latestActivity >= IDLE_TIMEOUT_MS) {
        // Pause due to idle
        const accumulated = currentState.accumulatedSeconds + Math.floor((now - currentState.runningSince!) / 1000);
        const nextState: PersistedTimerState = {
          ...currentState,
          isRunning: false,
          runningSince: null,
          accumulatedSeconds: Math.max(0, accumulated),
          pauseReason: "IDLE",
          revision: currentState.revision + 1,
        };
        commitState(nextState);
        return;
      }

      // 3. Day civil rollover check
      const currentDayStr = getTodayRangeSP(new Date()).dateString;
      if (currentDayStr !== currentState.dateStringSP) {
        // Roll over detected: Pause timer, set DAY_CHANGED
        const accumulated = currentState.accumulatedSeconds + Math.floor((now - currentState.runningSince!) / 1000);
        const nextState: PersistedTimerState = {
          ...currentState,
          isRunning: false,
          runningSince: null,
          accumulatedSeconds: Math.max(0, accumulated),
          pauseReason: "DAY_CHANGED",
          dateStringSP: currentDayStr,
          revision: currentState.revision + 1,
        };
        commitState(nextState);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [userId, state, getElapsedFromState, commitState]);

  // Activity listeners to reset idle timer
  useEffect(() => {
    if (!userId) return;

    const handleActivity = () => {
      const now = Date.now();
      localLastActivityRef.current = now;

      // Limit writes to once every 15 seconds
      if (now - lastActivityWriteRef.current >= 15000) {
        lastActivityWriteRef.current = now;
        sharedLastActivityRef.current = now;
        try {
          localStorage.setItem(
            ACTIVITY_KEY,
            JSON.stringify({
              userId,
              lastActivityAt: now,
            })
          );
        } catch {}
      }
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
  }, [userId]);

  // Handle logout: clean up state when userId goes empty or changes
  useEffect(() => {
    if (!prefsLoading && !userId) {
      if (stateRef.current && stateRef.current.isRunning) {
        const paused = {
          ...stateRef.current,
          isRunning: false,
          runningSince: null,
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(paused));
        } catch {}
      }
      stateRef.current = null;
      setState(null);
      setElapsedSeconds(0);
      setIsHydrated(false);
    }
  }, [userId, prefsLoading]);

  // Clean up timer on unmount: pause the timer to prevent orphaned running sessions
  useEffect(() => {
    unmountInProgressRef.current = false;
    return () => {
      unmountInProgressRef.current = true;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Pause only if we are logging out or going to a public route
          // Check if current user actually logged out or layout unmounted
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

  // Action: Iniciar / Preparar Sessão (idempotente)
  const prepareSession = useCallback((input: StudyTimerSessionInput): PrepareSessionResult => {
    if (!userId) {
      return { status: "PREPARED" };
    }

    const current = stateRef.current;
    if (!current) {
      const newState = getDefaultState(userId);
      newState.session = {
        blockId: input.blockId,
        subjectId: input.subjectId,
        subjectName: input.subjectName,
        blockTitle: input.blockTitle,
        startedAt: null,
      };
      newState.revision = 1;
      commitState(newState);
      setElapsedSeconds(0);
      return { status: "PREPARED" };
    }

    const s = current.session;
    // 1. Same block already prepared or initiated
    if (s && s.blockId === input.blockId) {
      return { status: "ALREADY_CURRENT" };
    }

    // 2. Conflict: another block with real time registered or running
    const elapsed = getElapsedFromState(current);
    if (s && (s.startedAt !== null || elapsed > 0 || current.isRunning)) {
      return { status: "CONFLICT", activeSession: s };
    }

    // 3. Substitutable: another block but paused and zeroed
    const newState: PersistedTimerState = {
      ...current,
      session: {
        blockId: input.blockId,
        subjectId: input.subjectId,
        subjectName: input.subjectName,
        blockTitle: input.blockTitle,
        startedAt: null,
      },
      accumulatedSeconds: 0,
      runningSince: null,
      isRunning: false,
      pauseReason: null,
      revision: current.revision + 1,
    };
    commitState(newState);
    setElapsedSeconds(0);
    return { status: "PREPARED" };
  }, [userId, commitState, getElapsedFromState]);

  // Action: startOrResume (seguro)
  const startOrResume = useCallback(() => {
    const current = stateRef.current;
    if (!userId || !current || !current.session) return;
    if (current.isRunning) return; // Already running

    const s = current.session;
    const now = Date.now();
    const nextState: PersistedTimerState = {
      ...current,
      isRunning: true,
      runningSince: now,
      pauseReason: null,
      revision: current.revision + 1,
    };

    if (s.startedAt === null) {
      nextState.session = {
        ...s,
        startedAt: new Date().toISOString(),
      };
    }

    commitState(nextState);
    setElapsedSeconds(getElapsedFromState(nextState));
    localLastActivityRef.current = Date.now();
  }, [userId, commitState, getElapsedFromState]);

  // Action: Pausar
  const pause = useCallback((reason?: "IDLE" | "DAY_CHANGED") => {
    const current = stateRef.current;
    if (!userId || !current || !current.session) return;
    if (!current.isRunning) return; // Already paused

    const now = Date.now();
    const elapsed = current.accumulatedSeconds + Math.floor((now - current.runningSince!) / 1000);

    const nextState: PersistedTimerState = {
      ...current,
      isRunning: false,
      runningSince: null,
      accumulatedSeconds: Math.max(0, elapsed),
      pauseReason: reason || null,
      revision: current.revision + 1,
    };

    commitState(nextState);
    setElapsedSeconds(nextState.accumulatedSeconds);
  }, [userId, commitState]);

  // Action: Retomar
  const resume = useCallback(() => {
    startOrResume();
  }, [startOrResume]);

  // Action: Zerar / Resetar
  const reset = useCallback(() => {
    const current = stateRef.current;
    if (!userId || !current) return;

    const nextState: PersistedTimerState = {
      ...current,
      session: null,
      accumulatedSeconds: 0,
      runningSince: null,
      isRunning: false,
      pauseReason: null,
      revision: current.revision + 1,
    };

    commitState(nextState);
    setElapsedSeconds(0);
  }, [userId, commitState]);

  // Action: Resetar tempo legado
  const resetLegacy = useCallback(() => {
    const current = stateRef.current;
    if (!userId || !current) return;

    const nextState: PersistedTimerState = {
      ...current,
      legacyUnassigned: 0,
      revision: current.revision + 1,
    };
    commitState(nextState);
  }, [userId, commitState]);

  // Action: Obter snapshot para envio à API (não modifica estado)
  const getSessionSnapshot = useCallback((blockId: string): StudyTimerSnapshot => {
    const current = stateRef.current;
    if (!current || !current.session || current.session.blockId !== blockId) {
      return { startedAt: null, completedAt: null, actualDurationMinutes: null };
    }

    const s = current.session;
    const currentElapsed = getElapsedFromState(current);

    if (s.startedAt === null || currentElapsed <= 0) {
      return { startedAt: null, completedAt: null, actualDurationMinutes: null };
    }

    return {
      startedAt: s.startedAt,
      completedAt: new Date().toISOString(),
      actualDurationMinutes: Math.max(1, Math.round(currentElapsed / 60)),
    };
  }, [getElapsedFromState]);

  // Action: Confirmar e encerrar a sessão (após sucesso da API)
  const completeSession = useCallback((blockId: string) => {
    const current = stateRef.current;
    if (!userId || !current) return;
    if (current.session && current.session.blockId === blockId) {
      const nextState: PersistedTimerState = {
        ...current,
        session: null,
        accumulatedSeconds: 0,
        runningSince: null,
        isRunning: false,
        pauseReason: null,
        revision: current.revision + 1,
      };
      commitState(nextState);
      setElapsedSeconds(0);
    }
  }, [userId, commitState]);

  const value: StudyTimerContextValue = {
    session: state ? state.session : null,
    elapsedSeconds,
    isRunning: state ? state.isRunning : false,
    isIdle: state ? (!state.isRunning && state.pauseReason === "IDLE") : false,
    pauseReason: state ? state.pauseReason : null,
    legacyUnassigned: state ? state.legacyUnassigned : 0,
    isHydrated,
    prepareSession,
    startOrResume,
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
