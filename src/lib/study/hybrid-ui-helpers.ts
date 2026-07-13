/**
 * src/lib/study/hybrid-ui-helpers.ts
 *
 * Funções lógicas puras para suporte a componentes visuais da metodologia híbrida 80/20.
 * Facilita testes unitários puros Jest sem necessidade de React Testing Library.
 */

export interface WizardFormInput {
  availableMinutes: number;
  selectedDeepeningMaterialIds: string[];
}

export interface WizardFormValidationResult {
  isValid: boolean;
  errors: {
    availableMinutes?: string;
    deepeningMaterials?: string;
  };
}

/**
 * 1. Validação do formulário do wizard
 */
export function validateWizardForm(input: WizardFormInput): WizardFormValidationResult {
  const errors: WizardFormValidationResult["errors"] = {};
  
  if (input.availableMinutes <= 0 || isNaN(input.availableMinutes)) {
    errors.availableMinutes = "O tempo disponível deve ser maior que 0 minutos.";
  }
  
  if (!input.selectedDeepeningMaterialIds || input.selectedDeepeningMaterialIds.length === 0) {
    errors.deepeningMaterials = "Selecione ao menos um material de aprofundamento (Estratégia).";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * 2. Bloqueio por blockingWarnings
 */
export function shouldBlockWizard(blockingWarnings: string[] | null | undefined): boolean {
  if (!blockingWarnings) return false;
  return blockingWarnings.length > 0;
}

export interface SourceItem {
  materialId: string;
  sourceRole: "ANCHOR_8020" | "DEEPENING";
  material?: {
    fileName: string;
  };
}

/**
 * 3. Agrupamento de sources
 */
export function groupSourcesByRole(sources: SourceItem[] | null | undefined) {
  const result = {
    anchors: [] as SourceItem[],
    deepenings: [] as SourceItem[]
  };

  if (!sources) return result;

  for (const s of sources) {
    if (s.sourceRole === "ANCHOR_8020") {
      result.anchors.push(s);
    } else if (s.sourceRole === "DEEPENING") {
      result.deepenings.push(s);
    }
  }

  return result;
}

export interface ContentItem {
  sourceRole: "ANCHOR_8020" | "DEEPENING" | null;
  disposition: "READ" | "CONSULT" | "SKIP" | "CONTRADICTION" | null;
  pageNumber: number;
  text: string;
}

/**
 * 4. Agrupamento por disposition
 */
export function groupContentByDisposition(content: ContentItem[] | null | undefined) {
  const result = {
    readAnchor: [] as ContentItem[],
    readDeepening: [] as ContentItem[],
    deprioritized: [] as ContentItem[]
  };

  if (!content) return result;

  for (const c of content) {
    if (c.disposition === "READ") {
      if (c.sourceRole === "ANCHOR_8020") {
        result.readAnchor.push(c);
      } else if (c.sourceRole === "DEEPENING") {
        result.readDeepening.push(c);
      }
    } else if (c.disposition === "CONSULT" || c.disposition === "SKIP" || c.disposition === "CONTRADICTION") {
      result.deprioritized.push(c);
    }
  }

  return result;
}

/**
 * 5. Seleção de estado seguro quando a flag está desativada
 */
export function getSafeStateFlagDisabled() {
  return {
    title: "Metodologia Híbrida 80/20",
    message: "Esta funcionalidade está temporariamente indisponível nesta versão. Ative a flag correspondente no servidor para começar.",
    allowActions: false
  };
}

/**
 * 6. Seleção de estado seguro quando as sources do bloco híbrido estão vazias
 */
export function getSafeStateNoSources() {
  return {
    title: "Bloco Híbrido Sem Fontes",
    message: "Nenhum material de origem (CFC ou Estratégia) foi vinculado a este bloco híbrido.",
    allowActions: false
  };
}

/**
 * 7. Bloqueio de edição de páginas no StudyBlockItem
 */
export function isPageEditDisabled(methodology: string | null | undefined): boolean {
  return methodology === "HYBRID_8020";
}

/**
 * 8. Criação de generationRunId por nova tentativa
 */
export function createNewGenerationRunId(salt?: string): string {
  const timestamp = Date.now();
  const rand = Math.floor(Math.random() * 1000000);
  return `run_${timestamp}_${rand}${salt ? `_${salt}` : ""}`;
}

/**
 * 9. Identificação de token expirado (Validade padrão de 30 minutos = 1800000 ms)
 */
export function isTokenExpired(generatedAtIsoString: string, currentTimestampMs: number): boolean {
  try {
    const genTime = new Date(generatedAtIsoString).getTime();
    if (isNaN(genTime)) return true;
    const diff = currentTimestampMs - genTime;
    return diff > 1800000; // 30 minutos em ms
  } catch {
    return true;
  }
}
