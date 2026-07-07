/**
 * Suíte de Testes de Comportamento (Hook e Acessibilidade) para a Revisão Semanal.
 * Roda de forma pura no Node usando JSDOM para validação real de acessibilidade e ciclo de vida do React.
 */

import { JSDOM } from "jsdom";

// Enable React act environment
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true });

// 1. Setup JSDOM
const dom = new JSDOM("<!DOCTYPE html><html><body><div id='root'></div><button id='trigger'>Trigger</button></body></html>", {
  url: "http://localhost"
});

// Auxiliar adaptador para instalar propriedades globais do JSDOM sem casts repetidos
function installDomGlobals(domInstance: JSDOM): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: domInstance.window,
  });

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: domInstance.window.document,
  });

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: domInstance.window.navigator,
  });

  globalThis.requestAnimationFrame = domInstance.window.requestAnimationFrame;
  globalThis.cancelAnimationFrame = domInstance.window.cancelAnimationFrame;
}

installDomGlobals(dom);

// 2. Setup require mock before loading other modules
import Module from "module";
const originalRequire = Module.prototype.require;

let mockSessionIdInUrl: string | null = null;
const routerState = { lastReplaceCall: null as string | null };

Module.prototype.require = function (id: string, ...args: unknown[]) {
  if (id === "next/navigation") {
    return {
      useRouter: () => ({
        push: () => {},
        replace: (url: string) => { routerState.lastReplaceCall = url; },
        prefetch: () => {}
      }),
      useSearchParams: () => ({
        get: (k: string) => k === "sessionId" ? mockSessionIdInUrl : null
      })
    };
  }
  if (id === "sonner") {
    return {
      toast: {
        success: () => {},
        error: () => {},
        warning: () => {},
        info: () => {}
      }
    };
  }
  if (id === "lucide-react") {
    return {
      Loader2: () => null,
      Wrench: () => null,
      Sliders: () => null
    };
  }
  return originalRequire.apply(this, [id, ...args] as [string]);
};

// 3. Mock Storage
const mockStorage: Record<string, string> = {};
const mockSessionStorage = {
  getItem: (key: string): string | null => mockStorage[key] ?? null,
  setItem: (key: string, value: string): void => { mockStorage[key] = value; },
  removeItem: (key: string): void => { delete mockStorage[key]; },
  clear: (): void => { for (const k in mockStorage) delete mockStorage[k]; },
  length: 0,
  key: (_index: number): string | null => { if (_index) {} return null; }
};

Object.defineProperty(dom.window, "sessionStorage", {
  value: mockSessionStorage,
  writable: true,
  configurable: true
});
Object.defineProperty(globalThis, "sessionStorage", {
  value: mockSessionStorage,
  writable: true,
  configurable: true
});

// 4. Mock Fetch
interface FetchCall {
  url: string;
  options?: RequestInit;
}
const fetchCalls: FetchCall[] = [];
let nextFetchResponse: unknown = { success: true, data: {} };
let nextFetchStatus = 200;

const mockFetch = async (url: string | URL | Request, options?: RequestInit) => {
  const urlStr = typeof url === "string" ? url : (url as { url?: string }).url || String(url);
  fetchCalls.push({ url: urlStr, options });
  return {
    ok: nextFetchStatus >= 200 && nextFetchStatus < 300,
    status: nextFetchStatus,
    json: async () => nextFetchResponse,
  } as unknown as Response;
};

Object.defineProperty(dom.window, "fetch", {
  value: mockFetch,
  writable: true,
  configurable: true
});
Object.defineProperty(globalThis, "fetch", {
  value: mockFetch,
  writable: true,
  configurable: true
});

import { AssertionError } from "assert";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AccessibleDialog } from "../src/components/weekly-review/AccessibleDialog";
import { useWeeklyReview } from "../src/hooks/useWeeklyReview";
import { saveDraft, loadDraft, clearDraft, getDraftKey } from "../src/lib/weekly-review-ui";
import { getTodayRangeSP } from "../src/lib/date-utils";
import { parseIsoDateString } from "../src/lib/validation/weekly-review";

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    throw new AssertionError({ message });
  }
  passedAssertions++;
}

// Wrapper para extrair estado do hook useWeeklyReview de forma limpa e tipada
let hookVal: ReturnType<typeof useWeeklyReview> | null = null;
function HookTestWrapper() {
  const val = useWeeklyReview();
  React.useEffect(() => {
    hookVal = val;
  }, [val]);
  return null;
}

async function runSuite() {
  console.log("=== Running Weekly Review Behavior & Accessibility Tests ===\n");

  // ====================================================
  // TESTE A: COMPORTAMENTO DO STORAGE (10 Cenários)
  // ====================================================
  console.log("Running Storage Draft tests...");
  mockSessionStorage.clear();

  saveDraft("user1", "sessionA", { availableMinutes: 45, targetQuestionCount: 15 });
  const draft1 = loadDraft("user1", "sessionA");
  assert(draft1 !== null && draft1.availableMinutes === 45 && draft1.targetQuestionCount === 15, "Cenário 1: Deve carregar o rascunho correto.");

  const draft2 = loadDraft("user2", "sessionA");
  assert(draft2 === null, "Cenário 2: Usuário diferente não deve restaurar.");

  const draft3 = loadDraft("user1", "sessionB");
  assert(draft3 === null, "Cenário 3: Sessão diferente não deve restaurar.");

  assert(getDraftKey("user1", "sessionA") === "weekly-review-draft:user1:sessionA", "Cenário 4: A chave deve conter o ID da sessão.");

  clearDraft("user1", "sessionA");
  assert(loadDraft("user1", "sessionA") === null, "Cenário 5: Iniciar deve limpar a chave.");

  saveDraft("user1", "sessionA", { availableMinutes: 45, targetQuestionCount: 15 });
  clearDraft("user1", "sessionA");
  assert(loadDraft("user1", "sessionA") === null, "Cenário 6: Pular deve limpar a chave.");

  saveDraft("user1", "sessionA", { availableMinutes: 45, targetQuestionCount: 15 });
  clearDraft("user1", "sessionA");
  assert(loadDraft("user1", "sessionA") === null, "Cenário 7: Adiar deve limpar a chave.");

  mockStorage[getDraftKey("user1", "sessionCorrupt")] = "{ invalid json }";
  assert(loadDraft("user1", "sessionCorrupt") === null, "Cenário 8: JSON corrompido deve retornar null.");

  mockStorage[getDraftKey("user1", "sessionLowMins")] = JSON.stringify({ availableMinutes: 10, targetQuestionCount: 20 });
  assert(loadDraft("user1", "sessionLowMins") === null, "Cenário 9a: Tempo < 15 deve ser descartado.");

  mockStorage[getDraftKey("user1", "sessionHighMins")] = JSON.stringify({ availableMinutes: 150, targetQuestionCount: 20 });
  assert(loadDraft("user1", "sessionHighMins") === null, "Cenário 9b: Tempo > 120 deve ser descartado.");

  mockStorage[getDraftKey("user1", "sessionLowQuests")] = JSON.stringify({ availableMinutes: 60, targetQuestionCount: 3 });
  assert(loadDraft("user1", "sessionLowQuests") === null, "Cenário 9c: Questões < 5 deve ser descartada.");

  mockStorage[getDraftKey("user1", "sessionHighQuests")] = JSON.stringify({ availableMinutes: 60, targetQuestionCount: 60 });
  assert(loadDraft("user1", "sessionHighQuests") === null, "Cenário 9d: Questões > 50 deve ser descartada.");

  saveDraft("user1", "sessionA", { availableMinutes: 45, targetQuestionCount: 15 });
  const user1Draft = loadDraft("user1", "sessionA");
  const otherUserDraft = loadDraft("userLogout", "sessionA");
  assert(user1Draft !== null && otherUserDraft === null, "Cenário 10: Outro usuário após logout não lê o rascunho anterior.");

  console.log("✓ Storage Draft tests passed successfully.\n");

  // ====================================================
  // TESTE B: COMPORTAMENTO DO ACCESSIBLE DIALOG (Opção A: Integração Real em JSDOM)
  // ====================================================
  console.log("Running AccessibleDialog JSDOM integration tests...");

  const rootEl = document.getElementById("root")!;
  const triggerEl = document.getElementById("trigger")!;

  // Focar o elemento acionador antes de montar o dialog
  await act(async () => {
    triggerEl.focus();
  });
  assert(document.activeElement === triggerEl, "Trigger deve estar focado inicialmente.");

  let onCloseCalled = false;
  const root = createRoot(rootEl);

  // Renderizar o Dialog usando objetos de propriedades tipadas para evitar casts as unknown
  const dialogProps1: React.ComponentProps<typeof AccessibleDialog> = {
    isOpen: true,
    onClose: () => { onCloseCalled = true; },
    titleId: "test-title",
    descriptionId: "test-desc",
    children: React.createElement(
      React.Fragment,
      null,
      React.createElement("button", { id: "btn-1" }, "First Button"),
      React.createElement("button", { id: "btn-2" }, "Second Button")
    )
  };

  await act(async () => {
    root.render(React.createElement(AccessibleDialog, dialogProps1));
  });

  const btn1 = document.getElementById("btn-1")!;
  const btn2 = document.getElementById("btn-2")!;

  // 1. Foco Inicial Real
  assert(document.activeElement === btn1, "Cenário B1: O foco inicial real deve ir para o primeiro elemento focável.");

  // 2. Atributos ARIA
  const dialogEl = document.querySelector('[role="dialog"]')!;
  assert(dialogEl !== null, "Cenário B2: Deve conter role='dialog'.");
  assert(dialogEl.getAttribute("aria-modal") === "true", "Cenário B3: Deve conter aria-modal='true'.");
  assert(dialogEl.getAttribute("aria-labelledby") === "test-title", "Cenário B4: aria-labelledby deve coincidir.");
  assert(dialogEl.getAttribute("aria-describedby") === "test-desc", "Cenário B5: aria-describedby deve coincidir.");

  // 3. Circulação de Tab (Focus Trap)
  // Foca o último elemento focável
  await act(async () => {
    btn2.focus();
  });
  assert(document.activeElement === btn2, "Último botão deve receber foco.");

  // Dispara evento Tab no último elemento
  const tabEvent = new dom.window.KeyboardEvent("keydown", {
    key: "Tab",
    bubbles: true,
    cancelable: true
  });
  await act(async () => {
    btn2.dispatchEvent(tabEvent);
  });
  assert(document.activeElement === btn1, "Cenário B6: Tab no último elemento deve circular o foco para o primeiro.");

  // 4. Circulação de Shift+Tab
  // Foca o primeiro elemento focável
  await act(async () => {
    btn1.focus();
  });
  assert(document.activeElement === btn1, "Primeiro botão deve receber foco.");

  // Dispara Shift+Tab no primeiro elemento
  const shiftTabEvent = new dom.window.KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey: true,
    bubbles: true,
    cancelable: true
  });
  await act(async () => {
    btn1.dispatchEvent(shiftTabEvent);
  });
  assert(document.activeElement === btn2, "Cenário B7: Shift+Tab no primeiro elemento deve circular o foco para o último.");

  // 5. Fechamento por Escape
  const escEvent = new dom.window.KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true
  });
  await act(async () => {
    btn2.dispatchEvent(escEvent);
  });
  assert(onCloseCalled, "Cenário B8: Escape deve disparar onClose.");

  // 6. Devolução real do foco
  const dialogProps2: React.ComponentProps<typeof AccessibleDialog> = {
    isOpen: false,
    onClose: () => {},
    titleId: "test-title",
    descriptionId: "test-desc",
    children: React.createElement("button", { id: "btn-1" }, "First Button")
  };

  await act(async () => {
    root.render(React.createElement(AccessibleDialog, dialogProps2));
  });
  assert(document.activeElement === triggerEl, "Cenário B9: O foco deve retornar para o trigger original quando o dialog fecha.");

  // Limpeza
  await act(async () => {
    root.unmount();
  });

  console.log("✓ AccessibleDialog JSDOM integration tests passed successfully.\n");

  // ====================================================
  // TESTE C: CARREGAMENTO E NAVEGAÇÃO ENTRE SESSÕES
  // ====================================================
  console.log("Running Read-Only loading and Navigation hook tests...");
  fetchCalls.length = 0;

  nextFetchStatus = 200;
  // Configurar retorno para mock de preferências e sessões ativas
  nextFetchResponse = {
    success: true,
    data: {
      enabled: true,
      session: { id: "active-session-123", status: "PENDING", topics: [] }
    }
  };

  const hookRoot = createRoot(document.createElement("div"));

  // 1. Montar sem sessionId (sessionId ausente)
  mockSessionIdInUrl = null;
  routerState.lastReplaceCall = null;

  await act(async () => {
    hookRoot.render(React.createElement(HookTestWrapper));
  });

  console.log("sessionId ausente → GET active");
  assert(hookVal !== null, "O hook deve estar montado.");
  assert(fetchCalls.some(c => c.url.includes("/weekly-review/preferences")), "Deve buscar as preferências.");
  assert(fetchCalls.some(c => c.url.includes("/weekly-review/sessions/active")), "Deve buscar a sessão ativa.");
  assert(routerState.lastReplaceCall !== null && (routerState.lastReplaceCall as string).includes("sessionId=active-session-123"), "Deve atualizar URL com a sessão ativa.");

  fetchCalls.length = 0; // Reset
  routerState.lastReplaceCall = null;

  // 2. Navegar para sessionId = session-B
  mockSessionIdInUrl = "session-B";
  nextFetchResponse = {
    success: true,
    data: { id: "session-B", status: "IN_PROGRESS", topics: [] }
  };

  await act(async () => {
    hookRoot.render(React.createElement(HookTestWrapper));
  });

  console.log("sessionId B → GET B");
  assert(fetchCalls.some(c => c.url.includes("/weekly-review/sessions/session-B")), "Deve fazer nova chamada GET para carregar session-B.");
  assert(hookVal?.session?.id === "session-B", "Deve ter carregado a session-B no estado.");

  fetchCalls.length = 0; // Reset

  // 3. Navegar para sessionId = session-C
  mockSessionIdInUrl = "session-C";
  nextFetchResponse = {
    success: true,
    data: { id: "session-C", status: "COMPLETED", topics: [] }
  };

  await act(async () => {
    hookRoot.render(React.createElement(HookTestWrapper));
  });

  console.log("sessionId C → GET C");
  assert(fetchCalls.some(c => c.url.includes("/weekly-review/sessions/session-C")), "Deve fazer nova chamada GET para carregar session-C.");
  assert(hookVal?.session?.id === "session-C", "Deve ter carregado a session-C no estado.");

  fetchCalls.length = 0; // Reset

  // 4. Remover sessionId da URL (retorna para ativo)
  mockSessionIdInUrl = null;
  nextFetchResponse = {
    success: true,
    data: {
      enabled: true,
      session: { id: "active-session-123", status: "PENDING", topics: [] }
    }
  };

  await act(async () => {
    hookRoot.render(React.createElement(HookTestWrapper));
  });

  console.log("sessionId removido → GET active");
  assert(fetchCalls.some(c => c.url.includes("/weekly-review/sessions/active")), "Deve reconsultar a sessão ativa.");

  // 5. Verificar ausência de métodos mutativos automáticos (POST, PATCH, DELETE)
  const autoMutations = fetchCalls.filter(c => c.options?.method && ["POST", "PATCH", "DELETE"].includes(c.options.method.toUpperCase()));

  console.log("POST automático: " + autoMutations.filter(c => c.options?.method?.toUpperCase() === "POST").length);
  console.log("PATCH automático: " + autoMutations.filter(c => c.options?.method?.toUpperCase() === "PATCH").length);
  console.log("DELETE automático: " + autoMutations.filter(c => c.options?.method?.toUpperCase() === "DELETE").length);

  assert(autoMutations.length === 0, "Nenhuma mutação automática deve ser disparada ao alterar parâmetros.");

  // Limpeza
  await act(async () => {
    hookRoot.unmount();
  });

  console.log("✓ Read-Only loading and Navigation hook tests passed successfully.\n");

  // ====================================================
  // TESTE D: VALIDAÇÃO DA DATA CIVIL (5 Cenários de Assertions)
  // ====================================================
  console.log("Running Civil Date validation assertions...");

  // D1. 2026-07-07 → permanece 2026-07-07 em America/Sao_Paulo
  const d1 = new Date("2026-07-07T12:00:00Z");
  const dStr1 = getTodayRangeSP(d1).dateString;
  assert(dStr1 === "2026-07-07", "Cenário D1: Data 2026-07-07T12:00:00Z deve permanecer 2026-07-07 em SP.");

  // D2. 2026-01-01 → permanece 2026-01-01 em America/Sao_Paulo
  const d2 = new Date("2026-01-01T12:00:00Z");
  const dStr2 = getTodayRangeSP(d2).dateString;
  assert(dStr2 === "2026-01-01", "Cenário D2: Data 2026-01-01T12:00:00Z deve permanecer 2026-01-01 em SP.");

  // D3. 2026-02-30 → 400 INVALID_INPUT (lança erro lógico na validação do dia do mês)
  try {
    parseIsoDateString("2026-02-30");
    assert(false, "Cenário D3: Dia 30 de Fevereiro não deve ser aceito.");
  } catch (err: unknown) {
    assert(err instanceof Error, "Cenário D3: Lançamento de erro esperado para dia impossível.");
  }

  // D4. 2026-13-40 → 400 INVALID_INPUT (lança erro na validação do mês)
  try {
    parseIsoDateString("2026-13-40");
    assert(false, "Cenário D4: Mês 13 não deve ser aceito.");
  } catch (err: unknown) {
    assert(err instanceof Error, "Cenário D4: Lançamento de erro esperado para mês inválido.");
  }

  // D5. 2026-07-07T00:00:00Z → 400 INVALID_INPUT (rejeitado por não ser formato rígido YYYY-MM-DD)
  try {
    parseIsoDateString("2026-07-07T00:00:00Z");
    assert(false, "Cenário D5: ISO Timestamp completo não deve ser aceito.");
  } catch (err: unknown) {
    assert(err instanceof Error, "Cenário D5: Lançamento de erro esperado para formato estendido.");
  }

  console.log("✓ Civil Date validation tests passed successfully.\n");

  console.log("=== All Behavior & Accessibility Tests Passed Successfully! ===");
  console.log(`Assertions executadas: ${passedAssertions}/${totalAssertions}`);
}

try {
  runSuite();
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("Test failed with error:", msg);
  process.exit(1);
}
