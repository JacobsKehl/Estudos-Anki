export class WeeklyReviewValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeeklyReviewValidationError";
  }
}

// Auxiliar para rejeitar chaves extras em um objeto
function assertNoExtraKeys(obj: any, allowedKeys: string[]) {
  if (obj === null || typeof obj !== "object") {
    throw new WeeklyReviewValidationError("O payload de entrada deve ser um objeto.");
  }
  const keys = Object.keys(obj);
  for (const key of keys) {
    if (!allowedKeys.includes(key)) {
      throw new WeeklyReviewValidationError(`Campo extra não permitido: "${key}".`);
    }
  }
}

// 1. Validação de string YYYY-MM-DD canônica
export function parseIsoDateString(value: unknown): string {
  if (typeof value !== "string") {
    throw new WeeklyReviewValidationError("A data deve ser uma string.");
  }

  const match = value.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) {
    throw new WeeklyReviewValidationError("A data deve estar no formato YYYY-MM-DD.");
  }

  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (month < 1 || month > 12) {
    throw new WeeklyReviewValidationError("Mês inválido na data.");
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    throw new WeeklyReviewValidationError(`Dia inválido para o mês especificado (máximo: ${daysInMonth}).`);
  }

  return value;
}

// 2. Validação de preferências
export function parsePreferencesInput(body: any) {
  assertNoExtraKeys(body, ["enabled", "dayOfWeek", "missedBehavior"]);

  if (body.enabled !== undefined && typeof body.enabled !== "boolean") {
    throw new WeeklyReviewValidationError("weeklyReviewEnabled deve ser um valor booleano.");
  }

  let dayOfWeek: number | undefined;
  if (body.dayOfWeek !== undefined) {
    const val = body.dayOfWeek;
    if (typeof val !== "number" || !Number.isInteger(val) || val < 0 || val > 6) {
      throw new WeeklyReviewValidationError("weeklyReviewDayOfWeek deve ser um número inteiro de 0 a 6 (0 = Domingo).");
    }
    dayOfWeek = val;
  }

  let missedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY" | "SKIP_CURRENT_WEEK" | undefined;
  if (body.missedBehavior !== undefined) {
    const val = body.missedBehavior;
    if (val !== "MOVE_TO_NEXT_AVAILABLE_DAY" && val !== "SKIP_CURRENT_WEEK") {
      throw new WeeklyReviewValidationError("weeklyReviewMissedBehavior inválido.");
    }
    missedBehavior = val;
  }

  return {
    enabled: body.enabled,
    dayOfWeek,
    missedBehavior
  };
}

// 3. Validação de prévia
export function parsePreviewInput(body: any) {
  assertNoExtraKeys(body, ["referenceDate", "availableMinutes"]);

  let referenceDate: string | undefined;
  if (body.referenceDate !== undefined) {
    referenceDate = parseIsoDateString(body.referenceDate);
  }

  let availableMinutes: number | undefined;
  if (body.availableMinutes !== undefined) {
    const val = body.availableMinutes;
    if (typeof val !== "number" || !Number.isInteger(val) || val < 5 || val > 480) {
      throw new WeeklyReviewValidationError("availableMinutes deve estar entre 5 e 480 minutos.");
    }
    availableMinutes = val;
  }

  return {
    referenceDate,
    availableMinutes
  };
}

// 4. Validação de criação de sessão
export function parseCreateSessionInput(body: any) {
  if (body === null || body === undefined || Object.keys(body).length === 0) {
    return { originalScheduledDate: undefined };
  }
  
  assertNoExtraKeys(body, ["originalScheduledDate"]);

  let originalScheduledDate: string | undefined;
  if (body.originalScheduledDate !== undefined) {
    originalScheduledDate = parseIsoDateString(body.originalScheduledDate);
  }

  return {
    originalScheduledDate
  };
}

// 5. Validação de início de sessão
export function parseStartSessionInput(body: any) {
  assertNoExtraKeys(body, ["availableMinutes", "targetQuestionCount"]);

  const minutes = body.availableMinutes;
  if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 5 || minutes > 480) {
    throw new WeeklyReviewValidationError("availableMinutes deve estar entre 5 e 480 minutos.");
  }

  const questions = body.targetQuestionCount;
  if (typeof questions !== "number" || !Number.isInteger(questions) || questions < 1 || questions > 500) {
    throw new WeeklyReviewValidationError("targetQuestionCount deve estar entre 1 e 500 questões.");
  }

  return {
    availableMinutes: minutes,
    targetQuestionCount: questions
  };
}

// 6. Validação de resultado de tópico
export function parseTopicResultInput(body: any) {
  assertNoExtraKeys(body, ["result", "notes"]);

  const res = body.result;
  if (res !== "DID_WELL" && res !== "HAD_DOUBTS" && res !== "REVIEW_AGAIN") {
    throw new WeeklyReviewValidationError("O resultado do tópico deve ser DID_WELL, HAD_DOUBTS ou REVIEW_AGAIN.");
  }

  let notes: string | undefined;
  if (body.notes !== undefined) {
    if (typeof body.notes !== "string") {
      throw new WeeklyReviewValidationError("As anotações devem ser do tipo texto.");
    }
    if (body.notes.length > 2000) {
      throw new WeeklyReviewValidationError("As anotações excederam o limite máximo de 2.000 caracteres.");
    }
    notes = body.notes;
  }

  return {
    result: res,
    notes
  };
}

// 7. Validação de conclusão de sessão
export function parseCompleteSessionInput(body: any) {
  if (body === null || body === undefined || Object.keys(body).length === 0) {
    return { actualQuestionCount: undefined };
  }
  
  assertNoExtraKeys(body, ["actualQuestionCount"]);

  let actualQuestionCount: number | undefined;
  if (body.actualQuestionCount !== undefined) {
    const val = body.actualQuestionCount;
    if (typeof val !== "number" || !Number.isInteger(val) || val < 0 || val > 500) {
      throw new WeeklyReviewValidationError("actualQuestionCount deve estar entre 0 e 500 questões.");
    }
    actualQuestionCount = val;
  }

  return {
    actualQuestionCount
  };
}

// 8. Validação de carryover
export function parseCarrySessionInput(body: any) {
  assertNoExtraKeys(body, ["newEffectiveScheduledDate"]);

  const newEffectiveScheduledDate = parseIsoDateString(body.newEffectiveScheduledDate);

  return {
    newEffectiveScheduledDate
  };
}

// 9. Validação de IDs
export function parseId(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new WeeklyReviewValidationError(`O identificador "${name}" deve ser uma string preenchida.`);
  }
  if (value.length > 100) {
    throw new WeeklyReviewValidationError(`O identificador "${name}" excede o limite máximo de 100 caracteres.`);
  }
  return value;
}
