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
  intervalCallbacks.forEach((cb) => cb());
}

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

let fetchCalls: { url: string; body: any }[] = [];
let mockFetchResponseStatus = 200;
let mockFetchResponseBody: any = {};

global.fetch = async (url: string | URL | Request, options?: RequestInit) => {
  fetchCalls.push({
    url: url.toString(),
    body: options?.body ? JSON.parse(options.body as string) : null,
  });
  return {
    ok: mockFetchResponseStatus >= 200 && mockFetchResponseStatus < 300,
    status: mockFetchResponseStatus,
    json: async () => mockFetchResponseBody,
  } as any;
};

// Mock preferences provider hook output
let currentUserId = "user-123";
let prefsLoading = false;

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

import { UserGlobalTimerProvider, useUserGlobalTimer } from "../src/contexts/UserGlobalTimerContext";
import { StudyTimerProvider, useStudyTimer } from "../src/contexts/StudyTimerContext";
import { BlockStudyView } from "../src/components/blocks/BlockStudyView";
import { StudyTimer } from "../src/components/study/study-timer";
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
  console.log("🚀 Starting User Global Timer Integration Tests...\n");

  const rootEl = document.getElementById("root")!;

  const cleanup = () => {
    localStorage.clear();
    sessionStorage.clear();
    intervalCallbacks.length = 0;
    activeIntervals.clear();
    routerPushCalls.length = 0;
    fetchCalls = [];
    currentRoute = "/";
    currentUserId = "user-123";
    prefsLoading = false;
    mockFetchResponseStatus = 200;
    mockFetchResponseBody = {};
    rootEl.innerHTML = "";
    document.body.style.overflow = "";
    fakeTime = OriginalDate.now();
  };

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

  // --- TEST 1: Usuário consegue iniciar cronômetro geral sem abrir bloco ---
  {
    cleanup();
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

    await act(async () => {
      root.render(
        React.createElement(
          DashboardLayout,
          null,
          React.createElement("div", null, "Dashboard")
        )
      );
    });

    const playBtn = document.body.querySelector("[aria-label='Iniciar']") as HTMLButtonElement;
    assert(playBtn !== null, "Test 1.1: Botão de iniciar o cronômetro geral está presente");

    await act(async () => {
      playBtn.click();
    });

    await act(async () => {
      advanceTime(5000);
    });

    const display = document.body.querySelector("[data-testid='general-timer-display']")?.textContent;
    assert(display === "00:05", `Test 1.2: Cronômetro geral iniciou sem bloco aberto (tempo: ${display})`);
    root.unmount();
  }

  // --- TEST 2: Cronômetro geral persiste ao navegar entre rotas privadas ---
  {
    cleanup();
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

    await act(async () => {
      root.render(
        React.createElement(
          DashboardLayout,
          null,
          React.createElement("div", null, "Dashboard")
        )
      );
    });

    // Iniciar
    const playBtn = document.body.querySelector("[aria-label='Iniciar']") as HTMLButtonElement;
    await act(async () => {
      playBtn.click();
    });

    await act(async () => {
      advanceTime(10000);
    });

    // Navegar
    await act(async () => {
      currentRoute = "/schedule";
      root.render(
        React.createElement(
          DashboardLayout,
          null,
          React.createElement("div", null, "Cronograma")
        )
      );
    });

    const display = document.body.querySelector("[data-testid='general-timer-display']")?.textContent;
    assert(display === "00:10", `Test 2.1: Cronômetro geral persistiu o tempo após navegar para outra rota privada (tempo: ${display})`);
    root.unmount();
  }

  // --- TEST 3: Cronômetro geral não existe em rotas públicas ---
  {
    cleanup();
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

    currentRoute = "/login";
    await act(async () => {
      root.render(
        React.createElement(
          DashboardLayout,
          null,
          React.createElement("div", null, "Login")
        )
      );
    });

    const display = document.body.querySelector("[data-testid='general-timer-display']");
    assert(display === null, "Test 3.1: Cronômetro geral não é renderizado em rotas públicas");
    root.unmount();
  }

  // --- TEST 4: Cronômetro geral não cria StudySessionLog ---
  {
    cleanup();
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

    await act(async () => {
      root.render(
        React.createElement(
          DashboardLayout,
          null,
          React.createElement("div", null, "Dashboard")
        )
      );
    });

    const playBtn = document.body.querySelector("[aria-label='Iniciar']") as HTMLButtonElement;
    await act(async () => {
      playBtn.click();
    });

    await act(async () => {
      advanceTime(30000);
    });

    const logCalls = fetchCalls.filter((c) => c.url.includes("study-session-log"));
    assert(logCalls.length === 0, "Test 4.1: Nenhuma chamada para a API de logs de sessão de estudo foi feita pelo cronômetro geral");
    root.unmount();
  }

  // --- TEST 5: Cronômetro geral não altera progresso de bloco ---
  {
    cleanup();
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

    await act(async () => {
      root.render(
        React.createElement(
          DashboardLayout,
          null,
          React.createElement("div", null, "Dashboard")
        )
      );
    });

    const playBtn = document.body.querySelector("[aria-label='Iniciar']") as HTMLButtonElement;
    await act(async () => {
      playBtn.click();
    });

    await act(async () => {
      advanceTime(10000);
    });

    const updateCalls = fetchCalls.filter((c) => c.url.includes("complete-step") || c.url.includes("blocks/"));
    assert(updateCalls.length === 0, "Test 5.1: Nenhuma chamada de alteração de progresso do bloco foi feita pelo cronômetro geral");
    root.unmount();
  }

  // --- TEST 6: Cronômetro geral é isolado por usuário ---
  {
    cleanup();
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

    // Iniciar com usuário A
    currentUserId = "user-A";
    await act(async () => {
      root.render(React.createElement(DashboardLayout, null, React.createElement("div", null, "Dash")));
    });

    const playBtnA = document.body.querySelector("[aria-label='Iniciar']") as HTMLButtonElement;
    await act(async () => {
      playBtnA.click();
    });

    await act(async () => {
      advanceTime(5000);
    });

    assert(
      localStorage.getItem("user-global-timer:user-A") !== null,
      "Test 6.1: Dados salvos sob a chave do user-A"
    );

    // Mudar para usuário B
    root.unmount();
    currentUserId = "user-B";
    const rootB = createRoot(rootEl);
    await act(async () => {
      rootB.render(React.createElement(DashboardLayout, null, React.createElement("div", null, "Dash")));
    });

    const displayB = document.body.querySelector("[data-testid='general-timer-display']")?.textContent;
    assert(displayB === "00:00", `Test 6.2: Cronômetro do user-B começou zerado, isolado do user-A (tempo: ${displayB})`);
    rootB.unmount();
  }

  // --- TEST 7: Reset do cronômetro geral não afeta o bloco ---
  {
    cleanup();
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

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

    // Iniciar ambos
    const blockPlay = document.body.querySelector("[aria-label='Iniciar bloco']") as HTMLButtonElement;
    const generalPlay = document.body.querySelector("[aria-label='Iniciar']") as HTMLButtonElement;

    await act(async () => {
      blockPlay.click();
      generalPlay.click();
    });

    await act(async () => {
      advanceTime(10000);
    });

    // Resetar geral
    const generalReset = document.body.querySelector("[aria-label='Resetar']") as HTMLButtonElement;
    await act(async () => {
      generalReset.click();
    });

    const blockDisplay = document.body.querySelector("[data-testid='block-timer-display']")?.textContent;
    const generalDisplay = document.body.querySelector("[data-testid='general-timer-display']")?.textContent;

    assert(generalDisplay === "00:00", "Test 7.1: Geral foi resetado");
    assert(blockDisplay === "00:10", `Test 7.2: Cronômetro do bloco NÃO foi afetado pelo reset do geral (tempo do bloco: ${blockDisplay})`);
    root.unmount();
  }

  // --- TEST 8: Timer do bloco não afeta o cronômetro geral ---
  {
    cleanup();
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

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

    const blockPlay = document.body.querySelector("[aria-label='Iniciar bloco']") as HTMLButtonElement;
    await act(async () => {
      blockPlay.click();
    });

    await act(async () => {
      advanceTime(5000);
    });

    const generalDisplay = document.body.querySelector("[data-testid='general-timer-display']")?.textContent;
    assert(generalDisplay === "00:00", `Test 8.1: Iniciar timer do bloco não iniciou nem alterou o geral (geral: ${generalDisplay})`);
    root.unmount();
  }

  // --- TEST 9: Ambos podem rodar simultaneamente ---
  {
    cleanup();
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

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

    const blockPlay = document.body.querySelector("[aria-label='Iniciar bloco']") as HTMLButtonElement;
    const generalPlay = document.body.querySelector("[aria-label='Iniciar']") as HTMLButtonElement;

    await act(async () => {
      blockPlay.click();
      generalPlay.click();
    });

    await act(async () => {
      advanceTime(12000);
    });

    const blockDisplay = document.body.querySelector("[data-testid='block-timer-display']")?.textContent;
    const generalDisplay = document.body.querySelector("[data-testid='general-timer-display']")?.textContent;

    assert(blockDisplay === "00:12", `Test 9.1: Cronômetro do bloco rodando simultaneamente (tempo: ${blockDisplay})`);
    assert(generalDisplay === "00:12", `Test 9.2: Cronômetro geral rodando simultaneamente (tempo: ${generalDisplay})`);
    root.unmount();
  }

  // --- TEST 10: Concluir bloco não pausa nem reseta o geral ---
  {
    cleanup();
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

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

    const blockPlay = document.body.querySelector("[aria-label='Iniciar bloco']") as HTMLButtonElement;
    const generalPlay = document.body.querySelector("[aria-label='Iniciar']") as HTMLButtonElement;

    await act(async () => {
      blockPlay.click();
      generalPlay.click();
    });

    await act(async () => {
      advanceTime(10000);
    });

    // Concluir bloco
    const concludeBtn = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Concluir sem Gerar Cards")
    ) as HTMLButtonElement;

    await act(async () => {
      concludeBtn.click();
    });

    const generalDisplay = document.body.querySelector("[data-testid='general-timer-display']")?.textContent;
    assert(generalDisplay === "00:10", `Test 10.1: Concluir bloco preservou o tempo acumulado no geral (geral: ${generalDisplay})`);
    root.unmount();
  }

  // --- TEST 11: Abrir bloco não inicia automaticamente o timer do bloco ---
  {
    cleanup();
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

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

    const blockDisplay = document.body.querySelector("[data-testid='block-timer-display']")?.textContent;
    assert(blockDisplay === "00:00", `Test 11.1: Cronômetro do bloco inicia pausado/zerado ao abrir o bloco (tempo: ${blockDisplay})`);
    root.unmount();
  }

  // --- TEST 12: Reload preserva o estado esperado do geral ---
  {
    cleanup();
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

    await act(async () => {
      root.render(React.createElement(DashboardLayout, null, React.createElement("div", null, "Dash")));
    });

    const playBtn = document.body.querySelector("[aria-label='Iniciar']") as HTMLButtonElement;
    await act(async () => {
      playBtn.click();
    });

    await act(async () => {
      advanceTime(15000);
    });

    // Simular unmount (limpeza de timers)
    root.unmount();

    // Recarregar
    const rootReload = createRoot(rootEl);
    await act(async () => {
      rootReload.render(React.createElement(DashboardLayout, null, React.createElement("div", null, "Dash")));
    });

    // Advance 5s
    await act(async () => {
      advanceTime(5000);
    });

    const generalDisplay = document.body.querySelector("[data-testid='general-timer-display']")?.textContent;
    assert(generalDisplay === "00:20", `Test 12.1: Estado e contagem do cronômetro geral persistiram após o reload (tempo: ${generalDisplay})`);
    rootReload.unmount();
  }

  // --- TEST 13: Multi-abas funciona com sincronização do geral ---
  {
    cleanup();
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

    await act(async () => {
      root.render(React.createElement(DashboardLayout, null, React.createElement("div", null, "Dash")));
    });

    const playBtn = document.body.querySelector("[aria-label='Iniciar']") as HTMLButtonElement;
    await act(async () => {
      playBtn.click();
    });

    await act(async () => {
      advanceTime(10000);
    });

    // Disparar evento storage manualmente simulando outra aba
    const key = `user-global-timer:user-123`;
    const updatedState = {
      userId: "user-123",
      accumulatedSeconds: 50,
      runningSince: fakeTime,
      isRunning: true,
      startedAt: new Date().toISOString(),
      pausedAt: null,
      lastPersistedAt: fakeTime,
      revision: 10,
    };

    await act(async () => {
      const event = new StorageEvent("storage", {
        key,
        newValue: JSON.stringify(updatedState),
      });
      window.dispatchEvent(event);
    });

    const generalDisplay = document.body.querySelector("[data-testid='general-timer-display']")?.textContent;
    assert(generalDisplay === "00:50", `Test 13.1: Multi-abas sincronizou o tempo atualizado da outra aba (tempo: ${generalDisplay})`);
    root.unmount();
  }

  // --- TEST 14: Conflito de blocos e isolamento do widget ---
  {
    cleanup();
    currentUserId = "user-A";
    const root = createRoot(rootEl);
    const { StudyTimerProvider } = require("../src/contexts/StudyTimerContext");
    const { BlockStudyView } = require("../src/components/blocks/BlockStudyView");

    // Configurar estado inicial da sessão sob o bloco-A
    const blockA = {
      id: "block-A",
      title: "Bloco A",
      materialId: "mat-1",
      pageStart: 1,
      pageEnd: 10,
      subjectId: "sub-1",
      subject: { name: "Matemática" },
      material: { fileName: "apostila.pdf" },
      flashcards: [],
      status: "IN_PROGRESS",
    };

    const blockB = {
      id: "block-B",
      title: "Bloco B",
      materialId: "mat-1",
      pageStart: 11,
      pageEnd: 20,
      subjectId: "sub-1",
      subject: { name: "Matemática" },
      material: { fileName: "apostila.pdf" },
      flashcards: [],
      status: "IN_PROGRESS",
    };

    // 1. Simular sessão ativa do Bloco A no localStorage do study-timer
    const user = "user-A";
    const studyTimerKey = "kehl-study-timer:v2";
    const initialStudyState = {
      userId: user,
      session: {
        blockId: "block-A",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Bloco A",
        startedAt: new Date().toISOString(),
      },
      accumulatedSeconds: 100,
      runningSince: Date.now() - 10000, // rodando há 10s
      isRunning: true,
      lastPersistedAt: Date.now(),
      revision: 1,
      pauseReason: null,
      legacyUnassigned: 0,
      dateStringSP: "2026-07-10",
    };
    localStorage.setItem(studyTimerKey, JSON.stringify(initialStudyState));

    // Forçar preferências com userId
    localStorage.setItem("kehl-study-preferences", JSON.stringify({ userId: user }));

    // 2. Renderizar bloco B (o outro bloco) para verificar conflito antes da hidratação
    // Testamos desabilitado / ausência antes de hydrated estar true (simulado passando prefsLoading = true)
    // Para simplificar, a hidratação já passa de forma segura na montagem em JSDOM.
    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement(
            UserGlobalTimerProvider,
            null,
            React.createElement(
              "div",
              null,
              React.createElement(BlockStudyView, {
                block: blockB,
                content: [],
                returnTo: "/",
                from: null,
              })
            )
          )
        )
      );
    });

    // 3. Asserção: B detecta conflito e mostra mensagem informativa
    const conflictMessage = document.body.innerHTML;
    assert(conflictMessage.includes("Existe outro bloco com cronômetro ativo."), `Test 14.1: Bloco B detecta conflito (conteúdo: ${conflictMessage})`);

    // 4. Asserção: B não exibe tempo de A (00:00 ou similar)
    const blockDisplay = document.body.querySelector("[data-testid='block-timer-display']")?.textContent;
    assert(!blockDisplay || blockDisplay === "00:00", `Test 14.2: Widget de B não exibe tempo de A (tempo: ${blockDisplay})`);

    // 5. Asserção: Controles e botões de play/pause/reset não devem existir ou devem estar desabilitados para B
    const playBtn = document.body.querySelector("[aria-label='Iniciar bloco']") as HTMLButtonElement;
    assert(!playBtn || playBtn.disabled, "Test 14.3: Controles de B desabilitados ou ausentes durante conflito");

    // 6. Confirmar troca para o bloco B
    localStorage.setItem(studyTimerKey, JSON.stringify({
      userId: user,
      session: {
        blockId: "block-B",
        subjectId: "sub-1",
        subjectName: "Matemática",
        blockTitle: "Bloco B",
        startedAt: new Date().toISOString(),
      },
      accumulatedSeconds: 0,
      runningSince: null,
      isRunning: false,
      lastPersistedAt: Date.now(),
      revision: 2,
      pauseReason: null,
      legacyUnassigned: 0,
      dateStringSP: "2026-07-10",
    }));

    // Forçar re-render para atualizar o context
    await act(async () => {
      root.render(React.createElement("div", null, "Refreshing..."));
    });

    await act(async () => {
      root.render(
        React.createElement(
          StudyTimerProvider,
          null,
          React.createElement(
            UserGlobalTimerProvider,
            null,
            React.createElement(
              "div",
              null,
              React.createElement(BlockStudyView, {
                block: blockB,
                content: [],
                returnTo: "/",
                from: null,
              })
            )
          )
        )
      );
    });

    // 7. Asserção: Agora o display de B está zerado e os controles ativos
    const newDisplay = document.body.querySelector("[data-testid='block-timer-display']")?.textContent;
    const newPlayBtn = document.body.querySelector("[aria-label='Iniciar bloco']") as HTMLButtonElement;
    assert(newDisplay === "00:00", `Test 14.4: Display de B zerado após resolução (obtido: ${newDisplay})`);
    assert(newPlayBtn && !newPlayBtn.disabled, "Test 14.5: Botão de play de B ativo após resolução");

    // 8. Iniciar o cronômetro do bloco B
    await act(async () => {
      newPlayBtn.click();
    });

    // 9. Avançar tempo
    await act(async () => {
      advanceTime(10000);
    });

    // 10. Asserção: O display de B atualizou corretamente
    const tickingDisplay = document.body.querySelector("[data-testid='block-timer-display']")?.textContent;
    assert(tickingDisplay === "00:10", `Test 14.6: Cronômetro do bloco B rodando (exibido: ${tickingDisplay})`);

    root.unmount();
  }

  // --- TEST 15: Cronômetro geral permanece totalmente independente durante conflitos ---
  {
    cleanup();
    currentUserId = "user-A";
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

    const user = "user-A";
    localStorage.setItem("kehl-study-preferences", JSON.stringify({ userId: user }));

    // Iniciar cronômetro geral e deixá-lo rodando
    const globalKey = `user-global-timer:${user}`;
    const initialGlobalState = {
      userId: user,
      accumulatedSeconds: 50,
      runningSince: Date.now(),
      isRunning: true,
      startedAt: new Date().toISOString(),
      pausedAt: null,
      lastPersistedAt: Date.now(),
      revision: 1,
    };
    localStorage.setItem(globalKey, JSON.stringify(initialGlobalState));

    await act(async () => {
      root.render(
        React.createElement(
          DashboardLayout,
          null,
          React.createElement("div", null, "Dashboard Content")
        )
      );
    });

    // Verificar se o cronômetro geral está rodando
    const generalDisplay = document.body.querySelector("[data-testid='general-timer-display']")?.textContent;
    assert(generalDisplay === "00:50", `Test 15.1: Geral rodando independente (obtido: ${generalDisplay})`);

    // Avançar tempo
    await act(async () => {
      advanceTime(10000);
    });

    const tickedDisplay = document.body.querySelector("[data-testid='general-timer-display']")?.textContent;
    assert(tickedDisplay === "01:00", `Test 15.2: Geral continuou contando normalmente (obtido: ${tickedDisplay})`);

    root.unmount();
  }

  // --- TEST 16: startOrResume é idempotente (chamadas repetidas / duplo clique) ---
  {
    cleanup();
    currentUserId = "user-A";
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

    const user = "user-A";
    localStorage.setItem("kehl-study-preferences", JSON.stringify({ userId: user }));
    localStorage.removeItem(`user-global-timer:${user}`);

    await act(async () => {
      root.render(
        React.createElement(
          DashboardLayout,
          null,
          React.createElement("div", null, "Dash")
        )
      );
    });

    const playBtn = document.body.querySelector("[aria-label='Iniciar']") as HTMLButtonElement;

    // Simular chamadas repetidas rápidas
    await act(async () => {
      playBtn.click();
      playBtn.click();
      playBtn.click();
    });

    // Verificar se o estado persistido tem revision = 1 (e não 3)
    const raw = localStorage.getItem(`user-global-timer:${user}`);
    const state = JSON.parse(raw || "{}");
    assert(state.revision === 1, `Test 16.1: startOrResume é idempotente, revision não incrementou excessivamente (revision: ${state.revision})`);

    root.unmount();
  }

  // --- TEST 17: Navegação / Remount Mantém Cronômetro Ativo ---
  {
    cleanup();
    currentUserId = "user-A";
    const root = createRoot(rootEl);
    const { DashboardLayout } = require("../src/components/layout/DashboardLayout");

    const user = "user-A";
    localStorage.setItem("kehl-study-preferences", JSON.stringify({ userId: user }));

    // Configurar timer rodando
    localStorage.setItem(`user-global-timer:${user}`, JSON.stringify({
      userId: user,
      accumulatedSeconds: 10,
      runningSince: Date.now(),
      isRunning: true,
      startedAt: new Date().toISOString(),
      pausedAt: null,
      lastPersistedAt: Date.now(),
      revision: 1,
    }));

    await act(async () => {
      root.render(React.createElement(DashboardLayout, null, React.createElement("div", null, "Pagina 1")));
    });

    // Simular navegação unmounting Pagina 1
    root.unmount();

    // Re-render (mounting Pagina 2)
    const newRoot = createRoot(rootEl);
    await act(async () => {
      newRoot.render(React.createElement(DashboardLayout, null, React.createElement("div", null, "Pagina 2")));
    });

    // Verificar se o cronômetro geral continua ativo e com o estado isRunning = true
    const raw = localStorage.getItem(`user-global-timer:${user}`);
    const state = JSON.parse(raw || "{}");
    assert(state.isRunning === true, "Test 17.1: Unmount/remount de navegação manteve isRunning em true");

    newRoot.unmount();
  }

  cleanup();
  console.log("\n============================================================================");
  console.log(`Assertions executadas: ${assertionsPassed}/${assertionsRun}`);
  console.log("============================================================================\n");

  if (assertionsPassed === assertionsRun && assertionsRun >= 10) {
    console.log(`⭐ All tests passed successfully with ${assertionsRun} assertions!`);
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
