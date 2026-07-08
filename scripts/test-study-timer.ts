import { JSDOM } from "jsdom";
import Module from "module";

// Config React Act environment
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

// ============================================================================
// 1. Setup JSDOM & Global Browser Environment
// ============================================================================

const dom = new JSDOM("<!DOCTYPE html><html><body><div id='root'></div></body></html>", {
  url: "http://localhost",
});

global.window = dom.window as any;
global.self = dom.window as any;
global.document = dom.window.document;
Object.defineProperty(global, "navigator", {
  value: dom.window.navigator,
  writable: true,
  configurable: true,
});
global.localStorage = dom.window.localStorage;
global.sessionStorage = dom.window.sessionStorage;
global.StorageEvent = dom.window.StorageEvent;

// Mock matchMedia
dom.window.matchMedia = dom.window.matchMedia || function () {
  return {
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
};

// ============================================================================
// 2. Control Date & Time (Fake Timers)
// ============================================================================

const OriginalDate = Date;
let fakeTime = OriginalDate.now();

// Custom Fake Date class
class FakeDate extends OriginalDate {
  constructor(...args: any[]) {
    if (args.length === 0) {
      super(fakeTime);
    } else {
      super(...(args as [any, any?, any?, any?, any?, any?, any?]));
    }
  }
}
(global as any).Date = FakeDate;
FakeDate.now = () => fakeTime;

function advanceTime(ms: number) {
  fakeTime += ms;
  // Trigger interval callbacks to simulate ticks
  intervalCallbacks.forEach((cb) => cb());
}

// Custom Fake setInterval
const intervalCallbacks: (() => void)[] = [];
const activeIntervals = new Map<any, () => void>();

(global as any).setInterval = (cb: () => void, ms: number) => {
  intervalCallbacks.push(cb);
  const id = Math.random();
  activeIntervals.set(id, cb);
  return id as any;
};

(global as any).clearInterval = (id: any) => {
  const cb = activeIntervals.get(id);
  if (cb) {
    const idx = intervalCallbacks.indexOf(cb);
    if (idx !== -1) {
      intervalCallbacks.splice(idx, 1);
    }
    activeIntervals.delete(id);
  }
};

// ============================================================================
// 3. Mock Next/Navigation, Sonner & Fetch APIs
// ============================================================================

let currentRoute = "/";
const routerPushCalls: string[] = [];

const mockNavigation = {
  usePathname: () => currentRoute,
  useRouter: () => ({
    push: (url: string) => {
      routerPushCalls.push(url);
      currentRoute = url;
    },
    refresh: () => {},
    back: () => {},
  }),
};

const mockSonner = {
  toast: {
    loading: () => "mock-toast-id",
    success: () => {},
    error: () => {},
  },
};

// Module injection hooks
const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean) {
  if (request === "next/navigation") {
    return "next-navigation-mock";
  }
  if (request === "sonner") {
    return "sonner-mock";
  }
  return originalResolve.apply(this, [request, parent, isMain]);
};

require.cache["next-navigation-mock"] = {
  id: "next-navigation-mock",
  filename: "next-navigation-mock",
  loaded: true,
  exports: mockNavigation,
} as any;

require.cache["sonner-mock"] = {
  id: "sonner-mock",
  filename: "sonner-mock",
  loaded: true,
  exports: mockSonner,
} as any;

// Mock window.fetch
let mockFetchResponseStatus = 200;
let mockFetchResponseBody = {};

global.fetch = async (url: string | URL | Request, options?: RequestInit) => {
  return {
    ok: mockFetchResponseStatus >= 200 && mockFetchResponseStatus < 300,
    status: mockFetchResponseStatus,
    json: async () => mockFetchResponseBody,
  } as any;
};

// Mock preferences provider hook output
let currentUserId = "user-123";
let prefsLoading = false;

// Override require/resolve for useStudyPreferences to mock the context hook
const preferencesPath = require.resolve("../src/hooks/useStudyPreferences");
require.cache[preferencesPath] = {
  id: preferencesPath,
  filename: preferencesPath,
  loaded: true,
  exports: {
    useStudyPreferences: () => ({
      preferences: {
        userId: currentUserId,
        name: "Test User",
        displayName: "Test User",
      },
      isLoading: prefsLoading,
    }),
    StudyPreferencesProvider: ({ children }: any) => children,
  },
} as any;

// ============================================================================
// 4. Import Target Files
// ============================================================================

import { StudyTimerProvider, useStudyTimer } from "../src/contexts/StudyTimerContext";
import { BlockStudyView } from "../src/components/blocks/BlockStudyView";
import { getTodayRangeSP } from "../src/lib/date-utils";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

// ============================================================================
// 5. Test Suite Implementation
// ============================================================================

let assertionsRun = 0;
let assertionsPassed = 0;

function assert(condition: boolean, message: string) {
  assertionsRun++;
  if (condition) {
    assertionsPassed++;
    console.log(`✅ [PASS] ${message}`);
  } else {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log("🚀 Starting Study Timer global state JSDOM tests...\n");

  const rootEl = document.getElementById("root")!;

  // Cleanup helper between tests
  const cleanup = () => {
    localStorage.clear();
    sessionStorage.clear();
    intervalCallbacks.length = 0;
    activeIntervals.clear();
    routerPushCalls.length = 0;
    currentRoute = "/";
    currentUserId = "user-123";
    prefsLoading = false;
    mockFetchResponseStatus = 200;
    mockFetchResponseBody = {};
    rootEl.innerHTML = "";
  };

  // --- TEST 1: Display visível em todas as rotas privadas ---
  {
    cleanup();
    currentRoute = "/subjects";
    const root = createRoot(rootEl);
    
    // Render DashboardLayout (which contains provider & timer)
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");
    
    await act(async () => {
      root.render(
        React.createElement(
          DashboardLayout,
          null,
          React.createElement("div", null, "Conteúdo Privado")
        )
      );
    });

    // Check if StudyTimer is mounted (has element with "Tempo de estudo")
    assert(
      rootEl.innerHTML.includes("Tempo de estudo"),
      "Test 1: Display do cronômetro é visível em rotas privadas"
    );
    root.unmount();
  }

  // --- TEST 2: Display ausente nas rotas públicas ---
  {
    cleanup();
    currentRoute = "/login";
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

    await act(async () => {
      root.render(
        React.createElement(
          DashboardLayout,
          null,
          React.createElement("div", null, "Página de Login")
        )
      );
    });

    assert(
      !rootEl.innerHTML.includes("Tempo de estudo"),
      "Test 2: Display do cronômetro NÃO é montado em rotas públicas"
    );
    root.unmount();
  }

  // --- TEST 3: Somente um display flutuante na página do bloco ---
  {
    cleanup();
    currentRoute = "/blocks/block-1";
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

    const blockMock = {
      id: "block-1",
      title: "Geometria Espacial",
      materialId: "mat-1",
      pageStart: 1,
      pageEnd: 10,
      subjectId: "sub-1",
      subject: { name: "Matemática" },
      material: { fileName: "apostila.pdf" },
      flashcards: [],
      status: "IN_PROGRESS",
    };

    await act(async () => {
      root.render(
        React.createElement(
          DashboardLayout,
          null,
          React.createElement(BlockStudyView, {
            block: blockMock,
            content: [],
            stats: { total: 0, pending: 0, approved: 0 },
            returnTo: "/",
            from: null,
          })
        )
      );
    });

    // Count how many times the header "Tempo de estudo" occurs in innerHTML
    const occurrences = (rootEl.innerHTML.match(/Tempo de estudo/g) || []).length;
    assert(
      occurrences === 1,
      `Test 3: Somente 1 cronômetro é renderizado na página do bloco (encontrados: ${occurrences})`
    );
    root.unmount();
  }

  // --- TEST 4: Somente um intervalo ativo ---
  {
    cleanup();
    const root = createRoot(rootEl);
    
    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement("div", null, "App")
        )
      );
    });

    // Initially 0 intervals because it starts paused
    assert(intervalCallbacks.length === 0, "Test 4.1: Sem intervalos ativos quando pausado");
    root.unmount();
  }

  // --- TEST 5 & 6 & 7 & 8: Manual operations: start, pause, resume, reset ---
  {
    cleanup();
    const root = createRoot(rootEl);
    let timerContextValue: any = null;

    function TestComponent() {
      timerContextValue = useStudyTimer();
      return null;
    }

    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement(TestComponent)
        )
      );
    });

    // 5. Manual start
    await act(async () => {
      timerContextValue.startSession({
        blockId: "block-1",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Geometria",
      }, true); // Start running
    });

    assert(timerContextValue.isRunning === true, "Test 5.1: startSession inicia o timer");
    assert(intervalCallbacks.length === 1, "Test 5.2: Ticking interval é iniciado");

    await act(async () => {
      advanceTime(5000); // 5 seconds
    });
    assert(timerContextValue.elapsedSeconds === 5, "Test 5.3: Tempo decorrido soma 5 segundos");

    // 6. Pause
    await act(async () => {
      timerContextValue.pause();
    });
    assert(timerContextValue.isRunning === false, "Test 6.1: pause() interrompe execução");
    assert(intervalCallbacks.length === 0, "Test 6.2: Intervalo é limpo");
    
    await act(async () => {
      advanceTime(5000);
    });
    assert(timerContextValue.elapsedSeconds === 5, "Test 6.3: Tempo decorrido permanece inalterado com tempo passando");

    // 7. Resume
    await act(async () => {
      timerContextValue.resume();
    });
    assert(timerContextValue.isRunning === true, "Test 7.1: resume() retoma execução");
    assert(intervalCallbacks.length === 1, "Test 7.2: Intervalo é recriado");

    await act(async () => {
      advanceTime(3000);
    });
    assert(timerContextValue.elapsedSeconds === 8, "Test 7.3: Tempo volta a contar");

    // 8. Reset
    await act(async () => {
      timerContextValue.reset();
    });
    assert(timerContextValue.session === null, "Test 8.1: reset() limpa a sessão");
    assert(timerContextValue.isRunning === false, "Test 8.2: reset() desativa execução");
    assert(timerContextValue.elapsedSeconds === 0, "Test 8.3: reset() zera o tempo");

    root.unmount();
  }

  // --- TEST 9: Navegação preserva o tempo ---
  {
    cleanup();
    const root = createRoot(rootEl);
    let timerVal1: any = null;
    let timerVal2: any = null;

    function Page1() {
      timerVal1 = useStudyTimer();
      return null;
    }
    function Page2() {
      timerVal2 = useStudyTimer();
      return null;
    }

    // Step 1: Render Page1
    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement(Page1)
        )
      );
    });

    await act(async () => {
      timerVal1.startSession({
        blockId: "block-1",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Geometria",
      }, true);
    });
    await act(async () => {
      advanceTime(10000);
    });
    assert(timerVal1.elapsedSeconds === 10, "Test 9.1: Contador inicializado na Página 1");

    // Step 2: Render Page2 (simulating router navigation keeping same provider instance)
    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement(Page2)
        )
      );
    });

    assert(timerVal2.session !== null, "Test 9.2: Sessão persistida na Página 2");
    assert(timerVal2.elapsedSeconds === 10, "Test 9.3: Tempo preservado na navegação");

    root.unmount();
  }

  // --- TEST 10 & 11: Refresh/Remount restaura o tempo e calcula offline delta ---
  {
    cleanup();
    // Start session and advance time
    localStorage.setItem(
      "kehl-study-timer:v2",
      JSON.stringify({
        userId: "user-123",
        session: {
          blockId: "block-1",
          subjectId: "sub-1",
          subjectName: "Matemática",
          blockTitle: "Geometria",
          startedAt: new Date().toISOString(),
        },
        accumulatedSeconds: 20,
        runningSince: fakeTime,
        isRunning: true,
        lastPersistedAt: fakeTime,
        revision: 1,
        pauseReason: null,
        legacyUnassigned: 0,
        dateStringSP: getTodayRangeSP(new Date()).dateString,
      })
    );

    // Simulate closing app, advancing time by 45 seconds while page was unmounted
    fakeTime += 45000;

    // Load provider
    const root = createRoot(rootEl);
    let timerVal: any = null;
    function TestComponent() {
      timerVal = useStudyTimer();
      return null;
    }

    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement(TestComponent)
        )
      );
    });

    // The new elapsed seconds should be 20 + 45 = 65 seconds
    assert(timerVal.elapsedSeconds === 65, `Test 10 & 11: Refresh restaura o tempo e adiciona delta offline (esperado: 65, obtido: ${timerVal.elapsedSeconds})`);
    root.unmount();
  }

  // --- TEST 12: StrictMode não duplica a contagem ---
  {
    cleanup();
    const root = createRoot(rootEl);
    let timerVal: any = null;
    function TestComponent() {
      timerVal = useStudyTimer();
      return null;
    }

    await act(async () => {
      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(
            StudyTimerProvider,
            null,
            React.createElement(TestComponent)
          )
        )
      );
    });

    await act(async () => {
      timerVal.startSession({
        blockId: "block-1",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Geometria",
      }, true);
    });
    await act(async () => {
      advanceTime(5000);
    });

    // Ticking once in interval loop should add exactly 5 seconds
    assert(
      timerVal.elapsedSeconds === 5,
      `Test 12: StrictMode não causa dupla contagem de segundos (esperado: 5, obtido: ${timerVal.elapsedSeconds})`
    );
    root.unmount();
  }

  // --- TEST 13: JSON inválido é descartado com segurança ---
  {
    cleanup();
    localStorage.setItem("kehl-study-timer:v2", "CORRUPTED_JSON_STRING{]");

    const root = createRoot(rootEl);
    let timerVal: any = null;
    function TestComponent() {
      timerVal = useStudyTimer();
      return null;
    }

    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement(TestComponent)
        )
      );
    });

    assert(timerVal.session === null, "Test 13.1: JSON corrompido é ignorado");
    assert(timerVal.elapsedSeconds === 0, "Test 13.2: Cronômetro inicia zerado");
    root.unmount();
  }

  // --- TEST 14: Mudança de data civil de SP pausa o cronômetro com DAY_CHANGED ---
  {
    cleanup();
    const root = createRoot(rootEl);
    let timerVal: any = null;
    function TestComponent() {
      timerVal = useStudyTimer();
      return null;
    }

    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement(TestComponent)
        )
      );
    });

    await act(async () => {
      timerVal.startSession({
        blockId: "block-1",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Geometria",
      }, true);
    });
    await act(async () => {
      advanceTime(5000);
    });

    // Force day rollover (advance time by 24 hours) and dispatch click to avoid idle timeout
    await act(async () => {
      fakeTime += 24 * 60 * 60 * 1000;
      window.dispatchEvent(new dom.window.Event("click"));
      intervalCallbacks.forEach((cb) => cb());
    });

    assert(timerVal.isRunning === false, "Test 14.1: Mudança de data civil de SP pausa o cronômetro");
    assert(timerVal.pauseReason === "DAY_CHANGED", "Test 14.2: pauseReason é definido como DAY_CHANGED");
    assert(timerVal.elapsedSeconds > 0, "Test 14.3: Tempo acumulado é preservado");

    root.unmount();
  }

  // --- TEST 15 & 16: Conclusão envia tempo global correto e falha preserva tempo ---
  {
    cleanup();
    const root = createRoot(rootEl);
    let timerVal: any = null;
    function TestComponent() {
      timerVal = useStudyTimer();
      return null;
    }

    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement(TestComponent)
        )
      );
    });

    await act(async () => {
      timerVal.startSession({
        blockId: "block-1",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Geometria",
      }, true);
    });
    await act(async () => {
      advanceTime(120000); // 120 seconds = 2 minutes
    });

    const snapshot = timerVal.getSessionSnapshot("block-1");
    assert(snapshot.actualDurationMinutes === 2, `Test 15: Snapshot possui duração correta (esperado: 2, obtido: ${snapshot.actualDurationMinutes})`);

    // Mock API Failure
    mockFetchResponseStatus = 500;
    
    // Simulate failed API conclusion in BlockStudyView
    let concludedSuccessfully = false;
    try {
      await act(async () => {
        timerVal.pause(); // Pause
        const res = await fetch("/api/complete", { method: "POST", body: JSON.stringify(snapshot) });
        if (!res.ok) throw new Error("API Error");
        timerVal.completeSession("block-1");
        concludedSuccessfully = true;
      });
    } catch (e) {
      // Re-resume on failure
      await act(async () => {
        timerVal.resume();
      });
    }

    assert(concludedSuccessfully === false, "Test 16.1: API com erro falha a conclusão");
    assert(timerVal.session !== null, "Test 16.2: Sessão continua preservada no timer");
    assert(timerVal.isRunning === true, "Test 16.3: Timer foi retomado");

    // Mock API Success
    mockFetchResponseStatus = 200;
    await act(async () => {
      timerVal.pause();
      const res = await fetch("/api/complete", { method: "POST", body: JSON.stringify(snapshot) });
      if (res.ok) {
        timerVal.completeSession("block-1");
      }
    });

    assert(timerVal.session === null, "Test 16.4: API com sucesso limpa a sessão exatamente uma vez");
    root.unmount();
  }

  // --- TEST 17: Segundo bloco não substitui sessão ativa sem confirmação ---
  {
    cleanup();
    // Simulate an active study session for block-1 with 150 accumulated seconds
    localStorage.setItem(
      "kehl-study-timer:v2",
      JSON.stringify({
        userId: "user-123",
        session: {
          blockId: "block-1",
          subjectId: "sub-1",
          subjectName: "Matemática",
          blockTitle: "Geometria",
          startedAt: new Date().toISOString(),
        },
        accumulatedSeconds: 150,
        runningSince: null,
        isRunning: false,
        lastPersistedAt: fakeTime,
        revision: 1,
        pauseReason: null,
        legacyUnassigned: 0,
        dateStringSP: getTodayRangeSP(new Date()).dateString,
      })
    );

    const root = createRoot(rootEl);
    const block2Mock = {
      id: "block-2",
      title: "Algebra Linear",
      materialId: "mat-2",
      pageStart: 1,
      pageEnd: 15,
      subjectId: "sub-2",
      subject: { name: "Matemática" },
      material: { fileName: "algebra.pdf" },
      flashcards: [],
      status: "IN_PROGRESS",
    };

    // Render BlockStudyView for block-2
    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement(BlockStudyView, {
            block: block2Mock,
            content: [],
            stats: { total: 0, pending: 0, approved: 0 },
            returnTo: "/",
            from: null,
          })
        )
      );
    });

    // Check if the conflict modal has popped up
    assert(
      rootEl.innerHTML.includes("Cronômetro Ativo") || rootEl.innerHTML.includes("trocar de bloco"),
      "Test 17: Modal de conflito é apresentado ao carregar outro bloco com cronômetro registrado"
    );
    root.unmount();
  }

  // --- TEST 18: Inatividade pausa o cronômetro ---
  {
    cleanup();
    const root = createRoot(rootEl);
    let timerVal: any = null;
    function TestComponent() {
      timerVal = useStudyTimer();
      return null;
    }

    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement(TestComponent)
        )
      );
    });

    await act(async () => {
      timerVal.startSession({
        blockId: "block-1",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Geometria",
      }, true);
    });
    await act(async () => {
      advanceTime(5000);
    });

    // Simulate 16 minutes of absolute user inactivity
    await act(async () => {
      advanceTime(16 * 60 * 1000);
    });

    assert(timerVal.isRunning === false, "Test 18.1: Inatividade de 15+ minutos pausa o cronômetro");
    assert(timerVal.pauseReason === "IDLE", "Test 18.2: pauseReason é definido como IDLE");
    assert(timerVal.elapsedSeconds > 0, "Test 18.3: Tempo acumulado é mantido");
    root.unmount();
  }

  // --- TEST 19: Logout e isolamento de usuários ---
  {
    cleanup();
    // Simulate user-123 logged in with active session
    localStorage.setItem(
      "kehl-study-timer:v2",
      JSON.stringify({
        userId: "user-123",
        session: {
          blockId: "block-1",
          subjectId: "sub-1",
          subjectName: "Matemática",
          blockTitle: "Geometria",
          startedAt: new Date().toISOString(),
        },
        accumulatedSeconds: 100,
        runningSince: null,
        isRunning: false,
        lastPersistedAt: fakeTime,
        revision: 1,
        pauseReason: null,
        legacyUnassigned: 0,
        dateStringSP: getTodayRangeSP(new Date()).dateString,
      })
    );

    // Switch current user to empty (simulating logout)
    currentUserId = "";

    const root = createRoot(rootEl);
    let timerVal: any = null;
    function TestComponent() {
      timerVal = useStudyTimer();
      return null;
    }

    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement(TestComponent)
        )
      );
    });

    assert(timerVal.session === null, "Test 19.1: Logout zera o contexto");
    assert(timerVal.elapsedSeconds === 0, "Test 19.2: Cronômetro do usuário deslogado fica zerado");
    root.unmount();
  }

  // --- TEST 20: Tempo legado não é atribuído ao bloco ---
  {
    cleanup();
    // Set legacy unassigned keys
    const todayStr = getTodayRangeSP(new Date()).dateString;
    localStorage.setItem(`study-timer-accumulated-${todayStr}`, "1200"); // 20 minutes

    const root = createRoot(rootEl);
    let timerVal: any = null;
    function TestComponent() {
      timerVal = useStudyTimer();
      return null;
    }

    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement(TestComponent)
        )
      );
    });

    assert(timerVal.legacyUnassigned === 1200, "Test 20.1: Tempo legado migrado com sucesso");
    assert(timerVal.session === null, "Test 20.2: Sessão permanece nula pós migração");
    
    // Start session and check snapshot
    await act(async () => {
      timerVal.startSession({
        blockId: "block-1",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Geometria",
      }, true);
    });
    await act(async () => {
      advanceTime(60000); // 1 minute
    });

    const snapshot = timerVal.getSessionSnapshot("block-1");
    assert(snapshot.actualDurationMinutes === 1, `Test 20.3: Tempo legado não foi atribuído ao bloco (esperado: 1, obtido: ${snapshot.actualDurationMinutes})`);
    root.unmount();
  }

  // Cleanup final
  cleanup();
  console.log("\n============================================================================");
  console.log(`Assertions executadas: ${assertionsPassed}/${assertionsRun}`);
  console.log("============================================================================\n");

  if (assertionsPassed === assertionsRun) {
    console.log("⭐ All tests passed successfully!");
    process.exit(0);
  } else {
    console.error("💥 Some assertions failed.");
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test execution crashed:", e);
  process.exit(1);
});
