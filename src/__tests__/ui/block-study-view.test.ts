import React from "react";
import { BlockStudyView } from "@/components/blocks/BlockStudyView";

// Mock de hooks e roteamento do Next.js
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock("@/contexts/StudyTimerContext", () => ({
  useStudyTimer: () => ({
    session: null,
    elapsedSeconds: 0,
    isRunning: false,
    isHydrated: true,
    prepareSession: jest.fn().mockReturnValue({ status: "OK" }),
    pause: jest.fn(),
    resume: jest.fn(),
    reset: jest.fn(),
    getSessionSnapshot: jest.fn(),
    completeSession: jest.fn(),
  }),
}));

describe("BlockStudyView Component Smoke Test", () => {
  const mockBlockPending = {
    id: "block-101",
    subjectId: "sub-01",
    title: "Bloco de Teste Direito Constitucional",
    theoryStatus: "NOT_STARTED",
    pageStart: 1,
    pageEnd: 10,
    subject: { id: "sub-01", name: "Direito Constitucional" },
    flashcards: [],
    sources: [],
  };

  const mockBlockCompleted = {
    id: "block-102",
    subjectId: "sub-01",
    title: "Bloco Concluído de Teste",
    theoryStatus: "COMPLETED",
    pageStart: 11,
    pageEnd: 20,
    subject: { id: "sub-01", name: "Direito Constitucional" },
    flashcards: [],
    sources: [],
  };

  it("deve ser instanciável para um bloco PENDENTE sem lançar erros", () => {
    expect(() => {
      React.createElement(BlockStudyView, {
        block: mockBlockPending,
        content: [],
        stats: { total: 0, pending: 0, approved: 0 },
        returnTo: "/",
        from: null,
      });
    }).not.toThrow();
  });

  it("deve ser instanciável para um bloco CONCLUÍDO sem lançar erros", () => {
    expect(() => {
      React.createElement(BlockStudyView, {
        block: mockBlockCompleted,
        content: [],
        stats: { total: 0, pending: 0, approved: 0 },
        returnTo: "/",
        from: null,
      });
    }).not.toThrow();
  });
});
