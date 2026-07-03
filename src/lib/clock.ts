let mockNow: Date | null = null;

/**
 * Retorna a data/hora atual. Permite congelar o relógio nos testes de integração.
 */
export function getNow(): Date {
  if (mockNow) {
    return new Date(mockNow.getTime());
  }
  return new Date();
}

export function setMockNow(date: Date | null) {
  mockNow = date;
}
