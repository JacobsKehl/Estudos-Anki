/**
 * src/lib/ai/providers/hybrid-registry.ts
 *
 * Registro singleton global para injeção de dependência do HybridAIProvider.
 * Permite configurar o provider real em runtime de produção (Fase 2)
 * ou mocks em ambiente de testes (Fase 1B).
 */

import { HybridAIProvider } from "../hybrid-engine";
import { FlashcardAIProvider } from "../hybrid-flashcards";

let activeProvider: HybridAIProvider | null = null;
let activeFlashcardProvider: FlashcardAIProvider | null = null;

/**
 * Registra o provider ativo do motor híbrido.
 */
export function registerHybridProvider(provider: HybridAIProvider): void {
  activeProvider = provider;
}

/**
 * Retorna o provider ativo ou null se nenhum estiver configurado.
 */
export function getHybridProvider(): HybridAIProvider | null {
  return activeProvider;
}

/**
 * Limpa o provider registrado (útil para teardown em testes).
 */
export function clearHybridProvider(): void {
  activeProvider = null;
}

/**
 * Registra o provider ativo de flashcards híbridos.
 */
export function registerHybridFlashcardProvider(provider: FlashcardAIProvider): void {
  activeFlashcardProvider = provider;
}

/**
 * Retorna o provider ativo de flashcards híbridos ou null se nenhum estiver configurado.
 */
export function getHybridFlashcardProvider(): FlashcardAIProvider | null {
  return activeFlashcardProvider;
}

/**
 * Limpa o provider de flashcards híbridos registrado.
 */
export function clearHybridFlashcardProvider(): void {
  activeFlashcardProvider = null;
}
