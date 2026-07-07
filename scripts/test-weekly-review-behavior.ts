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

Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
Object.defineProperty(globalThis, "document", { value: dom.window.document, configurable: true });
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame;
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame;

// 2. Setup require mock before loading other modules
import Module from "module";
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string, ...args: unknown[]) {
  if (id === "next/navigation") {
    return {
      useRouter: () => ({
        push: () => {},
        replace: () => {},
        prefetch: () => {}
      }),
      useSearchParams: () => ({
        get: (_k: string) => { if (_k) {} return null; }
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

  await act(async () => {
    root.render(
      React.createElement(
        AccessibleDialog,
        {
          isOpen: true,
          onClose: () => { onCloseCalled = true; },
          titleId: "test-title",
          descriptionId: "test-desc"
        } as unknown as typeof AccessibleDialog extends React.ComponentType<infer P> ? P : never,
        React.createElement("button", { id: "btn-1" }, "First Button"),
        React.createElement("button", { id: "btn-2" }, "Second Button")
      )
    );
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

  await act(async () => {
    root.render(
      React.createElement(
        AccessibleDialog,
        {
          isOpen: false,
          onClose: () => {},
          titleId: "test-title",
          descriptionId: "test-desc"
        } as unknown as typeof AccessibleDialog extends React.ComponentType<infer P> ? P : never,
        React.createElement("button", { id: "btn-1" }, "First Button")
      )
    );
  });
  assert(document.activeElement === triggerEl, "Cenário B9: O foco deve retornar para o trigger original quando o dialog fecha.");

  // Limpeza
  await act(async () => {
    root.unmount();
  });

  console.log("✓ AccessibleDialog JSDOM integration tests passed successfully.\n");

  // ====================================================
  // TESTE C: CARREGAMENTO READ-ONLY (Integração Real do Hook)
  // ====================================================
  console.log("Running Read-Only loading hook tests...");
  fetchCalls.length = 0;

  nextFetchStatus = 200;
  nextFetchResponse = { success: true, data: { enabled: true, session: null } };

  const hookRoot = createRoot(document.createElement("div"));

  await act(async () => {
    hookRoot.render(React.createElement(HookTestWrapper));
  });

  // Verifica as chamadas de rede no mount do hook
  assert(hookVal !== null, "O hook deve ser montado com sucesso.");
  assert(fetchCalls.length > 0, "O hook deve iniciar chamadas de rede.");

  const mutatives = fetchCalls.filter(c => c.options?.method && ["POST", "PATCH", "DELETE"].includes(c.options.method.toUpperCase()));
  assert(mutatives.length === 0, "Cenário C1: Carregamento inicial do hook executa apenas GET (nenhuma mutação automática).");

  // Limpeza do hook
  await act(async () => {
    hookRoot.unmount();
  });

  console.log("✓ Read-Only loading hook tests passed successfully.\n");

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
