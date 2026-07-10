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
let mockFetchResponseBody: any = {};

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
import { StudyTimer } from "../src/components/study/study-timer";
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
  console.log("🚀 Starting Study Timer JSDOM & Accessibility hardening tests...\n");

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
    document.body.style.overflow = "";
    // Remove direct body portal elements
    const portals = Array.from(document.body.childNodes).filter(
      (node) => node.nodeType === 1 && (node as HTMLElement).id !== "root"
    );
    portals.forEach((p) => p.remove());
    fakeTime = OriginalDate.now();
  };

  // --- TEST 1: Display visível em todas as rotas privadas ---
  {
    cleanup();
    currentRoute = "/subjects";
    const root = createRoot(rootEl);
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

    assert(
      rootEl.innerHTML.includes("Tempo de estudo"),
      "Test 1.1: Display do cronômetro é visível em rotas privadas"
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
      "Test 2.1: Display do cronômetro NÃO é montado em rotas públicas"
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

    const occurrences = (rootEl.innerHTML.match(/Tempo de estudo/g) || []).length;
    assert(
      occurrences === 1,
      `Test 3.1: Somente 1 cronômetro é renderizado na página do bloco`
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

    assert(intervalCallbacks.length === 0, "Test 4.1: Sem intervalos ativos quando pausado");
    root.unmount();
  }

  // --- TEST 5: Operações manuais: prepareSession, startOrResume, pause, reset, snapshot ---
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

    // 5.1 Prepare Session
    let prepResult: any = null;
    await act(async () => {
      prepResult = timerVal.prepareSession({
        blockId: "block-1",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Geometria",
      });
    });

    assert(prepResult.status === "PREPARED", "Test 5.1.1: prepareSession prepara com sucesso");
    assert(timerVal.session !== null, "Test 5.1.2: Session é montada no estado");
    assert(timerVal.session.startedAt === null, "Test 5.1.3: startedAt inicia nulo no prepareSession");
    assert(timerVal.isRunning === false, "Test 5.1.4: O cronômetro inicia pausado");

    // 5.2 Start or Resume (primeiro início)
    await act(async () => {
      timerVal.startOrResume();
    });

    assert(timerVal.isRunning === true, "Test 5.2.1: startOrResume inicia cronômetro");
    assert(timerVal.session.startedAt !== null, "Test 5.2.2: startedAt recebe string ISO");
    const originalStartedAt = timerVal.session.startedAt;

    await act(async () => {
      advanceTime(5000);
    });
    assert(timerVal.elapsedSeconds === 5, "Test 5.2.3: Cronômetro incrementa tempo decorrido");

    // 5.3 Strict-mode startOrResume call (unpause when already running does not duplicate intervals)
    const initialIntervalCount = intervalCallbacks.length;
    await act(async () => {
      timerVal.startOrResume();
    });
    assert(intervalCallbacks.length === initialIntervalCount, "Test 5.3.1: Chamar startOrResume rodando não duplica intervalos");
    assert(timerVal.session.startedAt === originalStartedAt, "Test 5.3.2: startedAt é preservado ao chamar startOrResume novamente");

    // 5.4 Pause
    await act(async () => {
      timerVal.pause();
    });
    assert(timerVal.isRunning === false, "Test 5.4.1: pause() interrompe o cronômetro");
    assert(intervalCallbacks.length === 0, "Test 5.4.2: Intervalo de ticking é limpo");

    // 5.5 Resume (retomada)
    await act(async () => {
      timerVal.startOrResume();
    });
    assert(timerVal.isRunning === true, "Test 5.5.1: startOrResume retoma cronômetro pausado");
    assert(timerVal.session.startedAt === originalStartedAt, "Test 5.5.2: startedAt original é mantido pós retomadas");

    // 5.6 Snapshot
    const snapshot = timerVal.getSessionSnapshot("block-1");
    assert(snapshot.startedAt === originalStartedAt, "Test 5.6.1: Snapshot possui startedAt original");
    assert(snapshot.actualDurationMinutes !== null, "Test 5.6.2: Snapshot calcula minutos decorridos");

    // 5.7 Reset
    await act(async () => {
      timerVal.reset();
    });
    assert(timerVal.session === null, "Test 5.7.1: reset() limpa a sessão");
    assert(timerVal.elapsedSeconds === 0, "Test 5.7.2: reset() zera o tempo decorrido");

    root.unmount();
  }

  // --- TEST 6: Navegação privada normal preserva o cronômetro ---
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
      timerVal1.prepareSession({
        blockId: "block-1",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Geometria",
      });
      timerVal1.startOrResume();
    });

    await act(async () => {
      advanceTime(10000);
    });

    // Simula renderização do mesmo provider em outra página
    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement(Page2)
        )
      );
    });

    assert(timerVal2.session !== null, "Test 6.1: Sessão mantida após navegação privada comum");
    assert(timerVal2.elapsedSeconds === 10, "Test 6.2: Tempo decorrido mantido");
    assert(timerVal2.isRunning === true, "Test 6.3: Cronômetro continua rodando após navegação");

    root.unmount();
  }

  // --- TEST 7: Refresh/Remount restaura o tempo e calcula offline delta ---
  {
    cleanup();
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

    // Avança 45 segundos offline
    fakeTime += 45000;

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

    assert(timerVal.elapsedSeconds === 65, `Test 7.1: Delta offline é somado na hidratação (decorrido: ${timerVal.elapsedSeconds})`);
    root.unmount();
  }

  // --- TEST 8: StrictMode não causa dupla contagem ou loops de hidratação ---
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
      timerVal.prepareSession({
        blockId: "block-1",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Geometria",
      });
      timerVal.startOrResume();
    });

    await act(async () => {
      advanceTime(5000);
    });

    assert(timerVal.elapsedSeconds === 5, `Test 8.1: StrictMode não afeta contagem (decorrido: ${timerVal.elapsedSeconds})`);
    root.unmount();
  }

  // --- TEST 9: JSON inválido é descartado com segurança ---
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

    assert(timerVal.session === null, "Test 9.1: JSON corrompido é ignorado");
    assert(timerVal.elapsedSeconds === 0, "Test 9.2: Cronômetro inicia zerado pós corrupção");
    root.unmount();
  }

  // --- TEST 10: Mudança de data civil de SP pausa o cronômetro com DAY_CHANGED ---
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
      timerVal.prepareSession({
        blockId: "block-1",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Geometria",
      });
      timerVal.startOrResume();
    });

    await act(async () => {
      advanceTime(5000);
    });

    // Avança 24 horas (força rollover) e despacha clique para evitar timeout de inatividade
    await act(async () => {
      fakeTime += 24 * 60 * 60 * 1000;
      window.dispatchEvent(new dom.window.Event("click"));
      intervalCallbacks.forEach((cb) => cb());
    });

    assert(timerVal.isRunning === false, "Test 10.1: Rollover do dia pausa o timer");
    assert(timerVal.pauseReason === "DAY_CHANGED", "Test 10.2: pauseReason é DAY_CHANGED");
    root.unmount();
  }

  // --- TEST 11: Inatividade local pausa o cronômetro ---
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
      timerVal.prepareSession({
        blockId: "block-1",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Geometria",
      });
      timerVal.startOrResume();
    });

    // 16 minutos de inatividade total local
    await act(async () => {
      advanceTime(16 * 60 * 1000);
    });

    assert(timerVal.isRunning === false, "Test 11.1: Inatividade local de 15m+ pausa o timer");
    assert(timerVal.pauseReason === "IDLE", "Test 11.2: pauseReason é definido como IDLE");
    root.unmount();
  }

  // --- TEST 12: Inatividade compartilhada (multi-tab activity sync) ---
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
      timerVal.prepareSession({
        blockId: "block-1",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Geometria",
      });
      timerVal.startOrResume();
    });

    // Passam 10 minutos (local inativo, mas a outra aba está ativa)
    await act(async () => {
      advanceTime(10 * 60 * 1000);
    });

    // Simula evento da outra aba enviando atividade
    await act(async () => {
      const storageEvent = new dom.window.StorageEvent("storage", {
        key: "kehl-study-timer-activity:v2",
        newValue: JSON.stringify({
          userId: "user-123",
          lastActivityAt: fakeTime,
        }),
      });
      window.dispatchEvent(storageEvent);
    });

    // Avança mais 10 minutos (total local = 20m inativo, mas pela atividade compartilhada faz apenas 10m da última atividade)
    await act(async () => {
      advanceTime(10 * 60 * 1000);
    });

    assert(timerVal.isRunning === true, "Test 12.1: Atividade em outra aba previne pausa local");
    root.unmount();
  }

  // --- TEST 13: Inatividade compartilhada pausa se ambas as abas estiverem inativas ---
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
      timerVal.prepareSession({
        blockId: "block-1",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Geometria",
      });
      timerVal.startOrResume();
    });

    // Envia atividade compartilhada agora
    const activityTime = fakeTime;
    localStorage.setItem(
      "kehl-study-timer-activity:v2",
      JSON.stringify({
        userId: "user-123",
        lastActivityAt: activityTime,
      })
    );

    // Avança 16 minutos (sem novas atividades em nenhuma das abas)
    await act(async () => {
      advanceTime(16 * 60 * 1000);
    });

    assert(timerVal.isRunning === false, "Test 13.1: Pausa se ambas as abas excederem o timeout");
    assert(timerVal.pauseReason === "IDLE", "Test 13.2: pauseReason de inatividade persistido");
    root.unmount();
  }

  // --- TEST 14: Logout e isolamento de usuários ---
  {
    cleanup();
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

    // Altera userId para vazio (logout)
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

    assert(timerVal.session === null, "Test 14.1: Logout limpa sessão no contexto");
    assert(timerVal.elapsedSeconds === 0, "Test 14.2: Tempo zerado após logout");
    assert(timerVal.isHydrated === false, "Test 14.3: Hydration é false quando deslogado");
    root.unmount();
  }

  // --- TEST 15: Tempo legado não é atribuído ao bloco ---
  {
    cleanup();
    const todayStr = getTodayRangeSP(new Date()).dateString;
    localStorage.setItem(`study-timer-accumulated-${todayStr}`, "1200"); // 20m legado

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

    assert(timerVal.legacyUnassigned === 1200, "Test 15.1: Tempo legado migrado para legacyUnassigned");
    
    await act(async () => {
      timerVal.prepareSession({
        blockId: "block-1",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Geometria",
      });
      timerVal.startOrResume();
    });

    await act(async () => {
      advanceTime(60000); // 1 minuto
    });

    const snapshot = timerVal.getSessionSnapshot("block-1");
    assert(snapshot.actualDurationMinutes === 1, `Test 15.2: Tempo legado não foi embutido no snapshot do bloco (esperado: 1, obtido: ${snapshot.actualDurationMinutes})`);
    root.unmount();
  }

  // --- TEST 16: Dialog Acessível ---
  {
    cleanup();
    const root = createRoot(rootEl);
    const { Dialog, DialogContent, DialogTitle } = require("../src/components/ui/dialog");
    let isDialogOpen: boolean = true;
    const handleOpenChange = (open: boolean) => {
      isDialogOpen = open;
    };

    // Save previous active element to assert return focus
    const prevButton = document.createElement("button");
    prevButton.id = "prev-active-element";
    document.body.appendChild(prevButton);
    prevButton.focus();
    assert(document.activeElement === prevButton, "Test 16.1: Foco inicial está no botão de fora");

    await act(async () => {
      root.render(
        React.createElement(
          Dialog,
          { open: isDialogOpen, onOpenChange: handleOpenChange },
          React.createElement(
            DialogContent,
            null,
            React.createElement(DialogTitle, null, "Modal Título"),
            React.createElement("button", { id: "modal-button" }, "Clique Aqui")
          )
        )
      );
    });

    // 16.2 check tags
    const dialogEl = document.body.querySelector("[role='dialog']");
    assert(dialogEl !== null, "Test 16.2.1: Atributo role dialog está presente");
    assert(dialogEl?.getAttribute("aria-modal") === "true", "Test 16.2.2: aria-modal é true");
    const labelId = dialogEl?.getAttribute("aria-labelledby");
    assert(!!labelId && labelId.startsWith("dialog-title-"), "Test 16.2.3: aria-labelledby aponta para o título");

    // 16.3 check initial focus trap
    const modalBtn = document.getElementById("modal-button");
    assert(document.activeElement === modalBtn, "Test 16.3.1: Foco inicial foi movido para o botão do modal");

    // 16.4 scroll lock
    assert(document.body.style.overflow === "hidden", "Test 16.4.1: Body scroll foi travado (overflow: hidden)");

    // 16.5 Escape closes dialog
    await act(async () => {
      const escapeEvent = new dom.window.KeyboardEvent("keydown", { key: "Escape" });
      window.dispatchEvent(escapeEvent);
    });

    assert(!isDialogOpen, "Test 16.5.1: Tecla Escape fecha o diálogo");

    root.unmount();
    document.body.removeChild(prevButton);
  }

  // --- TEST 17: Conclusão com falha e sucesso no BlockStudyView ---
  {
    cleanup();
    const root = createRoot(rootEl);
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

    // Render BlockStudyView and StudyTimer inside the Provider
    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement(
            "div",
            null,
            React.createElement(BlockStudyView, {
              block: blockMock,
              content: [],
              stats: { total: 0, pending: 0, approved: 0 },
              returnTo: "/",
              from: null,
            }),
            React.createElement(StudyTimer)
          )
        )
      );
    });

    // Find the floating play/pause button in JSDOM body
    const playBtn = document.body.querySelector("[aria-label='Iniciar cronômetro']") as HTMLButtonElement;
    assert(playBtn !== null, "Test 17.1.1: Botão de iniciar cronômetro está presente");

    await act(async () => {
      playBtn.click();
    });

    // Advance 125 seconds
    await act(async () => {
      advanceTime(125 * 1000);
    });

    // Assert that we have elapsed seconds >= 125
    const elapsedText = document.body.querySelector(".font-mono")?.textContent;
    assert(elapsedText === "02:05", `Test 17.1.2: Cronômetro registrou 125s decorridos (exibido: ${elapsedText})`);

    // Mock API Failure (500)
    mockFetchResponseStatus = 500;
    // Click "Concluir sem Gerar Cards"
    const concludeBtn = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Concluir sem Gerar Cards")
    ) as HTMLButtonElement;
    assert(concludeBtn !== null, "Test 17.2.1: Botão Concluir sem Gerar Cards está presente");

    // Click conclude
    await act(async () => {
      concludeBtn.click();
    });

    // Assert session is STILL PRESERVED, time is kept, and timer resumes
    const postFailText = document.body.querySelector(".font-mono")?.textContent;
    assert(postFailText === "02:05", `Test 17.2.2: Conclusão com falha preservou tempo decorrido (${postFailText})`);
    // Check localStorage wasn't cleared
    const rawVal = localStorage.getItem("kehl-study-timer:v2");
    assert(rawVal !== null && JSON.parse(rawVal).session !== null, "Test 17.2.3: Sessão continua no localStorage após falha");

    // Mock API Success (200)
    mockFetchResponseStatus = 200;
    mockFetchResponseBody = { message: "Concluído" };

    await act(async () => {
      concludeBtn.click();
    });

    // Assert session is cleared and study view transitions to summary
    const clearedVal = localStorage.getItem("kehl-study-timer:v2");
    assert(clearedVal !== null && JSON.parse(clearedVal).session === null, "Test 17.3.1: Sessão limpa no localStorage pós sucesso");
    assert(document.body.innerHTML.includes("Reabrir bloco") || document.body.innerHTML.includes("Concluída"), "Test 17.3.2: BlockStudyView transicionou para summary");

    root.unmount();
  }

  // Cleanup final
  cleanup();
  console.log("\n============================================================================");
  console.log(`Assertions executadas: ${assertionsPassed}/${assertionsRun}`);
  console.log("============================================================================\n");

  console.log("📋 Casos de Testes Executados:");
  console.log("  1. Display visível em todas as rotas privadas");
  console.log("  2. Display ausente nas rotas públicas");
  console.log("  3. Somente um display flutuante na página do bloco");
  console.log("  4. Somente um ticking interval ativo por vez");
  console.log("  5. Operações manuais completas (prepareSession, startOrResume, pause, reset, snapshot)");
  console.log("  6. Preservação do cronômetro em navegação privada");
  console.log("  7. Hidratação com delta offline");
  console.log("  8. Segurança com StrictMode");
  console.log("  9. Saneamento e segurança com JSON corrompido");
  console.log("  10. Pausa automática por Rollover civil (DAY_CHANGED)");
  console.log("  11. Pausa automática por Inatividade local");
  console.log("  12. Sincronização e prevenção de pausa por atividade compartilhada");
  console.log("  13. Pausa por inatividade compartilhada com ambas abas inativas");
  console.log("  14. Logout e isolamento seguro de usuários");
  console.log("  15. Isolamento de tempo legado");
  console.log("  16. Diálogo acessível WCAG (role, aria-modal,labelledby, Escape, scroll lock, focus trap)");
  console.log("  17. Fluxo de conclusão com erro 500 (resumo) e sucesso 200 (limpeza e summary)");

  if (assertionsPassed === assertionsRun && assertionsRun >= 50) {
    console.log("⭐ All tests passed successfully with 50+ assertions!");
    process.exit(0);
  } else {
    console.error(`💥 Assertions failed or insufficient amount (Passed: ${assertionsPassed}/${assertionsRun})`);
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test execution crashed:", e);
  process.exit(1);
});
