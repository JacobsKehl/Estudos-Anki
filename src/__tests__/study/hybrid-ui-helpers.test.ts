/**
 * src/__tests__/study/hybrid-ui-helpers.test.ts
 *
 * Testes unitários puros para a lógica visual e auxiliar de UI do bloco híbrido 80/20.
 */

import {
  validateWizardForm,
  shouldBlockWizard,
  groupSourcesByRole,
  groupContentByDisposition,
  getSafeStateFlagDisabled,
  getSafeStateNoSources,
  isPageEditDisabled,
  createNewGenerationRunId,
  isTokenExpired
} from "../../lib/study/hybrid-ui-helpers";

describe("Metodologia Híbrida 80/20 — Helpers Puros da UI", () => {
  describe("validateWizardForm", () => {
    it("deve rejeitar tempo disponível menor ou igual a zero", () => {
      const res = validateWizardForm({
        availableMinutes: 0,
        selectedDeepeningMaterialIds: ["mat-1"]
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.availableMinutes).toBeDefined();
    });

    it("deve rejeitar quando nenhum material de aprofundamento for selecionado", () => {
      const res = validateWizardForm({
        availableMinutes: 90,
        selectedDeepeningMaterialIds: []
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.deepeningMaterials).toBeDefined();
    });

    it("deve aprovar formulário válido", () => {
      const res = validateWizardForm({
        availableMinutes: 120,
        selectedDeepeningMaterialIds: ["mat-1", "mat-2"]
      });
      expect(res.isValid).toBe(true);
      expect(res.errors.availableMinutes).toBeUndefined();
      expect(res.errors.deepeningMaterials).toBeUndefined();
    });
  });

  describe("shouldBlockWizard", () => {
    it("deve bloquear se existirem blockingWarnings", () => {
      expect(shouldBlockWizard(["Erro crítico de integridade"])).toBe(true);
    });

    it("não deve bloquear se a lista de warnings for vazia ou nula", () => {
      expect(shouldBlockWizard([])).toBe(false);
      expect(shouldBlockWizard(null)).toBe(false);
      expect(shouldBlockWizard(undefined)).toBe(false);
    });
  });

  describe("groupSourcesByRole", () => {
    it("deve separar as fontes por papel (ANCHOR e DEEPENING)", () => {
      const sources: any[] = [
        { materialId: "m1", sourceRole: "ANCHOR_8020" },
        { materialId: "m2", sourceRole: "DEEPENING" },
        { materialId: "m3", sourceRole: "DEEPENING" }
      ];

      const grouped = groupSourcesByRole(sources);
      expect(grouped.anchors).toHaveLength(1);
      expect(grouped.deepenings).toHaveLength(2);
      expect(grouped.anchors[0].materialId).toBe("m1");
    });

    it("deve tratar lista de fontes vazia ou nula", () => {
      const grouped = groupSourcesByRole(null);
      expect(grouped.anchors).toHaveLength(0);
      expect(grouped.deepenings).toHaveLength(0);
    });
  });

  describe("groupContentByDisposition", () => {
    it("deve agrupar conteúdo por disposição para as abas", () => {
      const content: any[] = [
        { sourceRole: "ANCHOR_8020", disposition: "READ", text: "T1" },
        { sourceRole: "DEEPENING", disposition: "READ", text: "T2" },
        { sourceRole: "DEEPENING", disposition: "SKIP", text: "T3" },
        { sourceRole: "ANCHOR_8020", disposition: "CONTRADICTION", text: "T4" }
      ];

      const grouped = groupContentByDisposition(content);
      expect(grouped.readAnchor).toHaveLength(1);
      expect(grouped.readDeepening).toHaveLength(1);
      expect(grouped.deprioritized).toHaveLength(2); // SKIP e CONTRADICTION vão para depriorizados
    });
  });

  describe("getSafeStateFlags", () => {
    it("deve retornar informações seguras para flag desativada", () => {
      const res = getSafeStateFlagDisabled();
      expect(res.allowActions).toBe(false);
      expect(res.message).toContain("indisponível");
    });

    it("deve retornar informações seguras para bloco sem fontes", () => {
      const res = getSafeStateNoSources();
      expect(res.allowActions).toBe(false);
      expect(res.message).toContain("Nenhum material");
    });
  });

  describe("isPageEditDisabled", () => {
    it("deve bloquear edição para HYBRID_8020", () => {
      expect(isPageEditDisabled("HYBRID_8020")).toBe(true);
    });

    it("não deve bloquear edição para linear clássico", () => {
      expect(isPageEditDisabled("LINEAR")).toBe(false);
      expect(isPageEditDisabled(null)).toBe(false);
    });
  });

  describe("createNewGenerationRunId", () => {
    it("deve gerar string única contendo run_", () => {
      const runId = createNewGenerationRunId();
      expect(runId).toContain("run_");
    });

    it("deve incluir o salt quando fornecido", () => {
      const runId = createNewGenerationRunId("salt");
      expect(runId).toContain("_salt");
    });
  });

  describe("isTokenExpired", () => {
    it("deve acusar expiração após 30 minutos", () => {
      const dateStr = new Date(Date.now() - 31 * 60 * 1000).toISOString();
      expect(isTokenExpired(dateStr, Date.now())).toBe(true);
    });

    it("não deve acusar expiração antes de 30 minutos", () => {
      const dateStr = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      expect(isTokenExpired(dateStr, Date.now())).toBe(false);
    });
  });
});
