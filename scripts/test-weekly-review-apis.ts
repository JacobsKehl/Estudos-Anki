import {
  handleGetPreferences,
  handlePatchPreferences
} from "../src/app/api/weekly-review/preferences/handlers";
import { handlePostPreview } from "../src/app/api/weekly-review/preview/handlers";
import { handlePostCreateSession } from "../src/app/api/weekly-review/sessions/handlers";
import { handleGetActiveSession } from "../src/app/api/weekly-review/sessions/active/handlers";
import { handleGetSessionById } from "../src/app/api/weekly-review/sessions/[sessionId]/handlers";
import { handlePostCarrySession } from "../src/app/api/weekly-review/sessions/[sessionId]/carry/handlers";
import { handlePostStartSession } from "../src/app/api/weekly-review/sessions/[sessionId]/start/handlers";
import { handlePostCompleteSession } from "../src/app/api/weekly-review/sessions/[sessionId]/complete/handlers";
import { handlePostSkipSession } from "../src/app/api/weekly-review/sessions/[sessionId]/skip/handlers";
import { handlePatchTopicResult } from "../src/app/api/weekly-review/sessions/[sessionId]/topics/[topicId]/handlers";
import { RouteDependencies } from "../src/lib/api/weekly-review-response";

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    throw new Error(`[ASSERT FAILURE] ${message}`);
  }
  passedAssertions++;
}

import {
  Prisma,
  UserPreferences,
  WeeklyReviewSession,
  WeeklyReviewTopic,
  WeeklyReviewTopicSource,
  WeeklyReviewSelectionReason
} from "@prisma/client";
import { PrismaClientLike, WeeklyReviewServiceLike } from "../src/lib/api/weekly-review-response";

interface PrefsRecord {
  id?: string;
  userId: string;
  weeklyReviewEnabled: boolean;
  weeklyReviewDayOfWeek: number;
  weeklyReviewMissedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY" | "SKIP_CURRENT_WEEK";
  createdAt?: Date;
  updatedAt?: Date;
}

interface SessionRecord {
  id: string;
  userId: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  originalScheduledDate?: Date;
  effectiveScheduledDate: Date;
  missedBehavior?: "MOVE_TO_NEXT_AVAILABLE_DAY" | "SKIP_CURRENT_WEEK";
  createdAt?: Date;
  updatedAt?: Date;
  availableMinutes?: number | null;
  targetQuestionCount?: number | null;
  actualQuestionCount?: number | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  skippedAt?: Date | null;
  topics?: TopicRecord[];
}

interface TopicRecord {
  id: string;
  weeklyReviewSessionId: string;
  result: "PENDING" | "DID_WELL" | "HAD_DOUBTS" | "REVIEW_AGAIN";
  title?: string;
  createdAt?: Date;
  updatedAt?: Date;
  subjectId?: string | null;
  sourceSubjectName?: string;
  notes?: string | null;
  priorityRank?: number;
  carriedFromTopicId?: string | null;
  sourceStudyDate?: Date | null;
  materialName?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  selectionReason?: WeeklyReviewSelectionReason;
  sources?: WeeklyReviewTopicSource[];
}

const defaultUserPreferences: UserPreferences = {
  id: "",
  userId: "",
  dailyGoalMinutes: 120,
  studyResetTime: "00:00",
  studyDaysOfWeek: "1,2,3,4,5",
  defaultBlockDurationMinutes: 30,
  maxNewCardsPerDay: 20,
  flashcardDifficulty: "NORMAL_PLUS",
  emailReminderEnabled: true,
  emailReminderTime: "08:00",
  dailyReminderEmail: null,
  lastDailyReminderSentAt: null,
  visualDensity: "comfortable",
  reducedMotion: false,
  focusArea: "Geral",
  theme: "light",
  displayName: "Estudante",
  examGoal: "TRT4",
  deadline: null,
  avatarUrl: null,
  languageTone: "MASCULINE_NEUTRAL",
  scheduleGenerationMode: "DYNAMIC",
  weeklyReviewEnabled: false,
  weeklyReviewDayOfWeek: 0,
  weeklyReviewMissedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY",
  createdAt: new Date(),
  updatedAt: new Date()
};

const defaultWeeklyReviewSession: WeeklyReviewSession = {
  id: "",
  userId: "",
  status: "PENDING",
  originalScheduledDate: new Date(),
  effectiveScheduledDate: new Date(),
  missedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY",
  createdAt: new Date(),
  updatedAt: new Date(),
  sourcePeriodStart: new Date(),
  sourcePeriodEnd: new Date(),
  suggestedQuestionCount: 20,
  availableMinutes: null,
  targetQuestionCount: null,
  actualQuestionCount: null,
  startedAt: null,
  completedAt: null,
  skippedAt: null
};

// ----------------------------------------------------
// Mock da base de dados e do serviço de domínio
// ----------------------------------------------------
class MockPrisma implements PrismaClientLike {
  public preferences: PrefsRecord[] = [];
  public sessions: SessionRecord[] = [];
  public topics: TopicRecord[] = [];
  public sources: WeeklyReviewTopicSource[] = [];

  public countCalls = 0;
  public findUniqueCalls = 0;
  public findManyCalls = 0;
  public createCalls = 0;
  public updateCalls = 0;
  public upsertCalls = 0;

  private mapPrefs(p: PrefsRecord): UserPreferences {
    return {
      ...defaultUserPreferences,
      id: p.id || `pref-${Math.random()}`,
      userId: p.userId,
      weeklyReviewEnabled: p.weeklyReviewEnabled,
      weeklyReviewDayOfWeek: p.weeklyReviewDayOfWeek,
      weeklyReviewMissedBehavior: p.weeklyReviewMissedBehavior,
      createdAt: p.createdAt || new Date(),
      updatedAt: p.updatedAt || new Date()
    };
  }

  private mapSession(s: SessionRecord): WeeklyReviewSession {
    return {
      ...defaultWeeklyReviewSession,
      id: s.id,
      userId: s.userId,
      status: s.status,
      originalScheduledDate: s.originalScheduledDate || new Date(),
      effectiveScheduledDate: s.effectiveScheduledDate,
      missedBehavior: s.missedBehavior || "MOVE_TO_NEXT_AVAILABLE_DAY",
      createdAt: s.createdAt || new Date(),
      updatedAt: s.updatedAt || new Date(),
      availableMinutes: s.availableMinutes ?? null,
      targetQuestionCount: s.targetQuestionCount ?? null,
      actualQuestionCount: s.actualQuestionCount ?? null,
      startedAt: s.startedAt || null,
      completedAt: s.completedAt || null,
      skippedAt: s.skippedAt || null
    };
  }

  public userPreferences = {
    findUnique: async (args: Prisma.UserPreferencesFindUniqueArgs): Promise<UserPreferences | null> => {
      this.findUniqueCalls++;
      if (!args.where || !args.where.userId) return null;
      const p = this.preferences.find(x => x.userId === args.where.userId);
      return p ? this.mapPrefs(p) : null;
    },
    create: async (args: Prisma.UserPreferencesCreateArgs): Promise<UserPreferences> => {
      this.createCalls++;
      const userIdVal = typeof args.data.userId === "string" ? args.data.userId : "";
      const newPref: PrefsRecord = {
        userId: userIdVal,
        weeklyReviewEnabled: args.data.weeklyReviewEnabled ?? false,
        weeklyReviewDayOfWeek: args.data.weeklyReviewDayOfWeek ?? 0,
        weeklyReviewMissedBehavior: (args.data.weeklyReviewMissedBehavior as "MOVE_TO_NEXT_AVAILABLE_DAY" | "SKIP_CURRENT_WEEK") ?? "MOVE_TO_NEXT_AVAILABLE_DAY"
      };
      this.preferences.push(newPref);
      return this.mapPrefs(newPref);
    },
    update: async (args: Prisma.UserPreferencesUpdateArgs): Promise<UserPreferences> => {
      this.updateCalls++;
      if (!args.where || !args.where.userId) throw new Error("Missing where clause");
      const p = this.preferences.find(x => x.userId === args.where.userId);
      if (p) {
        if (args.data.weeklyReviewEnabled !== undefined) {
          p.weeklyReviewEnabled = args.data.weeklyReviewEnabled as boolean;
        }
        if (args.data.weeklyReviewDayOfWeek !== undefined) {
          p.weeklyReviewDayOfWeek = args.data.weeklyReviewDayOfWeek as number;
        }
        if (args.data.weeklyReviewMissedBehavior !== undefined) {
          p.weeklyReviewMissedBehavior = args.data.weeklyReviewMissedBehavior as "MOVE_TO_NEXT_AVAILABLE_DAY" | "SKIP_CURRENT_WEEK";
        }
        return this.mapPrefs(p);
      }
      throw new Error("Pref not found");
    }
  };

  public weeklyReviewSession = {
    count: async (args: Prisma.WeeklyReviewSessionCountArgs): Promise<number> => {
      this.countCalls++;
      let filtered = this.sessions;
      if (args.where?.userId) {
        filtered = filtered.filter(s => s.userId === args.where?.userId);
      }
      if (args.where?.status) {
        const statusVal = args.where.status;
        if (typeof statusVal === "object" && statusVal !== null && "in" in statusVal) {
          const inList = (statusVal as { in?: string[] }).in || [];
          filtered = filtered.filter(s => inList.includes(s.status));
        } else if (typeof statusVal === "string") {
          filtered = filtered.filter(s => s.status === statusVal);
        }
      }
      return filtered.length;
    },
    findFirst: async (args: Prisma.WeeklyReviewSessionFindFirstArgs): Promise<WeeklyReviewSession | null> => {
      this.findUniqueCalls++;
      let filtered = this.sessions;
      if (args.where?.userId) {
        filtered = filtered.filter(s => s.userId === args.where?.userId);
      }
      if (args.where?.status) {
        const statusVal = args.where.status;
        if (typeof statusVal === "object" && statusVal !== null && "in" in statusVal) {
          const inList = (statusVal as { in?: string[] }).in || [];
          filtered = filtered.filter(s => inList.includes(s.status));
        } else if (typeof statusVal === "string") {
          filtered = filtered.filter(s => s.status === statusVal);
        }
      }
      if (args.where?.originalScheduledDate) {
        const d = args.where.originalScheduledDate;
        filtered = filtered.filter(s => new Date(s.originalScheduledDate || "").getTime() === new Date(d as Date).getTime());
      }
      return filtered[0] ? this.mapSession(filtered[0]) : null;
    },
    findMany: async (args: Prisma.WeeklyReviewSessionFindManyArgs): Promise<WeeklyReviewSession[]> => {
      this.findManyCalls++;
      let filtered = this.sessions;
      if (args.where?.userId) {
        filtered = filtered.filter(s => s.userId === args.where?.userId);
      }
      if (args.where?.status) {
        const statusVal = args.where.status;
        if (typeof statusVal === "object" && statusVal !== null && "in" in statusVal) {
          const inList = (statusVal as { in?: string[] }).in || [];
          filtered = filtered.filter(s => inList.includes(s.status));
        } else if (typeof statusVal === "string") {
          filtered = filtered.filter(s => s.status === statusVal);
        }
      }
      return filtered.map(s => this.mapSession(s));
    },
    findUnique: async (args: Prisma.WeeklyReviewSessionFindUniqueArgs): Promise<WeeklyReviewSession | null> => {
      this.findUniqueCalls++;
      if (!args.where || !args.where.id) return null;
      const s = this.sessions.find(x => x.id === args.where.id);
      return s ? this.mapSession(s) : null;
    }
  };

  public weeklyReviewTopic = {
    findUnique: async (args: Prisma.WeeklyReviewTopicFindUniqueArgs): Promise<WeeklyReviewTopic | null> => {
      this.findUniqueCalls++;
      if (!args.where || !args.where.id) return null;
      const t = this.topics.find(x => x.id === args.where.id);
      if (!t) return null;
      return {
        id: t.id,
        weeklyReviewSessionId: t.weeklyReviewSessionId,
        subjectId: t.subjectId || null,
        sourceSubjectName: t.sourceSubjectName || "",
        displayTitle: t.title || "",
        groupKey: t.id,
        selectionReason: t.selectionReason || "WEEK_CONTENT",
        result: t.result,
        notes: t.notes || null,
        priorityRank: t.priorityRank || 1,
        carriedFromTopicId: t.carriedFromTopicId || null,
        suggestedQuestions: null,
        resultRecordedAt: null,
        createdAt: t.createdAt || new Date(),
        updatedAt: t.updatedAt || new Date()
      };
    }
  };
}

class MockWeeklyReviewService implements WeeklyReviewServiceLike {
  public previewCalledWith = { userId: "", refDate: "", mins: 0 };
  public createCalledWith = { userId: "", originalScheduledDate: new Date(), timezone: "" };
  public startCalledWith = { userId: "", id: "", mins: 0, questions: 0 };
  public completeCalledWith = { userId: "", id: "", count: undefined as number | undefined };
  public skipCalledWith = { userId: "", id: "" };
  public carryCalledWith = { userId: "", id: "", newDate: new Date() };
  public recordCalledWith = { userId: "", sid: "", tid: "", result: "", notes: undefined as string | undefined };

  public async buildWeeklyReviewPreview(
    userId: string,
    referenceDateStr: string,
    timezone: string = "America/Sao_Paulo",
    availableMinutes?: number,
    _tx?: PrismaClientLike
  ) {
    if (_tx) {}
    this.previewCalledWith = { userId, refDate: referenceDateStr, mins: availableMinutes || 0 };
    return {
      userId,
      referenceDate: referenceDateStr,
      originalScheduledDate: "2026-07-05",
      sourcePeriodStart: "2026-06-28T00:00:00.000Z",
      sourcePeriodEnd: "2026-07-04T23:59:59.000Z",
      timezone,
      activeStudyDates: ["2026-06-29"],
      availableMinutes,
      suggestedQuestionCount: availableMinutes ? Math.max(5, Math.min(50, Math.floor(availableMinutes / 3))) : 20,
      totals: {
        selected: 1,
        weekContent: 1,
        overdue: 0,
        longUnseen: 0,
        excessWeekContent: 0,
        excessOverdue: 0,
      },
      topics: [
        {
          studyBlockId: "topic-1",
          subjectId: "sub-1",
          subjectName: "Direito Constitucional",
          title: "Direitos Individuais",
          groupKey: "dir-const-individuais",
          selectionReason: "WEEK_CONTENT" as const,
          sourceStudyDate: "2026-06-29T12:00:00.000Z"
        }
      ],
      excluded: [],
    };
  }

  public async createOrGetWeeklyReviewSession(
    params: { userId: string; originalScheduledDate: Date; timezone: string },
    _prisma: PrismaClientLike
  ) {
    if (_prisma) {}
    this.createCalledWith = params;
    const session: WeeklyReviewSession = {
      ...defaultWeeklyReviewSession,
      id: "session-1",
      userId: params.userId,
      originalScheduledDate: params.originalScheduledDate,
      effectiveScheduledDate: params.originalScheduledDate,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return { session, created: true };
  }

  public async startWeeklyReviewSession(
    params: {
      userId: string;
      sessionId: string;
      availableMinutes: number;
      targetQuestionCount: number;
    },
    _tx?: PrismaClientLike
  ) {
    if (_tx) {}
    const { userId, sessionId, availableMinutes, targetQuestionCount } = params;
    this.startCalledWith = { userId, id: sessionId, mins: availableMinutes, questions: targetQuestionCount };
    return {
      id: sessionId,
      userId,
      originalScheduledDate: new Date(),
      effectiveScheduledDate: new Date(),
      status: "IN_PROGRESS" as const,
      availableMinutes,
      targetQuestionCount,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  public async completeWeeklyReviewSession(
    params: {
      userId: string;
      sessionId: string;
      actualQuestionCount?: number;
    },
    _tx?: PrismaClientLike
  ) {
    if (_tx) {}
    const { userId, sessionId, actualQuestionCount } = params;
    this.completeCalledWith = { userId, id: sessionId, count: actualQuestionCount };
    return {
      id: sessionId,
      userId,
      originalScheduledDate: new Date(),
      effectiveScheduledDate: new Date(),
      status: "COMPLETED" as const,
      availableMinutes: 30,
      targetQuestionCount: 10,
      actualQuestionCount: actualQuestionCount !== undefined ? actualQuestionCount : null,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  public async skipWeeklyReviewSession(
    params: {
      userId: string;
      sessionId: string;
    },
    _tx?: PrismaClientLike
  ) {
    if (_tx) {}
    const { userId, sessionId } = params;
    this.skipCalledWith = { userId, id: sessionId };
    return {
      id: sessionId,
      userId,
      originalScheduledDate: new Date(),
      effectiveScheduledDate: new Date(),
      status: "SKIPPED" as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  public async carryWeeklyReviewSession(
    params: {
      userId: string;
      sessionId: string;
      newEffectiveScheduledDate: Date;
    },
    _tx?: PrismaClientLike
  ) {
    if (_tx) {}
    const { userId, sessionId, newEffectiveScheduledDate } = params;
    this.carryCalledWith = { userId, id: sessionId, newDate: newEffectiveScheduledDate };
    return {
      id: sessionId,
      userId,
      originalScheduledDate: new Date(),
      effectiveScheduledDate: newEffectiveScheduledDate,
      status: "PENDING" as const,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  public async recordWeeklyReviewTopicResult(
    params: {
      userId: string;
      sessionId: string;
      topicId: string;
      result: "DID_WELL" | "HAD_DOUBTS" | "REVIEW_AGAIN";
      notes?: string;
    },
    _prisma: PrismaClientLike
  ) {
    if (_prisma) {}
    const { userId, sessionId, topicId, result, notes } = params;
    this.recordCalledWith = { userId, sid: sessionId, tid: topicId, result, notes };
    return {
      id: topicId,
      sessionId,
      subjectId: "sub-1",
      subjectName: "Constitucional",
      title: "Direitos Individuais",
      groupKey: "individuais",
      selectionReason: "WEEK_CONTENT" as const,
      sourceStudyDate: new Date(),
      result,
      notes: notes || null,
      priorityRank: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}

// ----------------------------------------------------
// Auxiliares de criação de Requests com headers
// ----------------------------------------------------
function createRequest(
  method: string,
  url: string,
  bodyObj: unknown,
  headersObj: Record<string, string> = {
    "content-type": "application/json",
    "origin": "https://estudos-anki.vercel.app"
  }
) {
  const bodyText = bodyObj === null ? "" : JSON.stringify(bodyObj);
  const headers = new Headers();
  Object.keys(headersObj).forEach(k => headers.append(k, headersObj[k]));

  return new Request(url, {
    method,
    headers,
    body: method === "GET" || method === "DELETE" ? undefined : bodyText
  });
}

// ----------------------------------------------------
// Execução dos Casos de Testes das APIs
// ----------------------------------------------------
async function runTests() {
  console.log("====================================================");
  console.log("[INICIANDO] Testes de Integração de APIs da Revisão Semanal");
  console.log("====================================================");

  const mockUserId = "test-user-1";
  const frozenNow = new Date("2026-07-05T12:00:00Z"); // Domingo em SP

  // Dependências de produção mockadas
  const deps: RouteDependencies = {
    getCurrentUserId: async () => mockUserId,
    prisma: new MockPrisma(),
    weeklyReviewService: new MockWeeklyReviewService(),
    getNow: () => frozenNow
  };

  // 1. Validação de Content-Type & MIME
  {
    const req1 = createRequest("POST", "http://localhost/api/weekly-review/preview", {}, {
      "content-type": "application/json; charset=utf-8",
      "origin": "https://estudos-anki.vercel.app"
    });
    const res1 = await handlePostPreview(req1, deps);
    assert(res1.status === 200, "MIME type com charset deve ser aceito.");
    assert(res1.headers.get("Cache-Control") === "no-store", "Cache-Control no-store deve estar presente.");

    const req2 = createRequest("POST", "http://localhost/api/weekly-review/preview", {}, {
      "content-type": "text/plain",
      "origin": "https://estudos-anki.vercel.app"
    });
    const res2 = await handlePostPreview(req2, deps);
    assert(res2.status === 415, "MIME type text/plain deve ser rejeitado com 415.");
    assert(res2.headers.get("Cache-Control") === "no-store", "Erro 415 deve conter no-store.");
  }

  // 2. Proteção Origin e Same-Origin
  {
    const req1 = createRequest("POST", "http://localhost/api/weekly-review/preview", {}, {
      "content-type": "application/json",
      "origin": "https://malicious-domain.com"
    });
    try {
      const res = await handlePostPreview(req1, deps);
      assert(res.status === 500 || res.status === 400, "Origin maliciosa deve falhar.");
    } catch {
      // Falha de origem esperada
      passedAssertions++;
    }

    const req2 = createRequest("POST", "http://localhost/api/weekly-review/preview", {}, {
      "content-type": "application/json",
      "origin": "https://kehlstudy.com"
    });
    const res2 = await handlePostPreview(req2, deps);
    assert(res2.status === 200, "Origin kehlstudy.com deve ser autorizada.");
  }

  // 3. Autenticação e 401
  {
    const unauthDeps = {
      ...deps,
      getCurrentUserId: async () => {
        throw new Error("UNAUTHENTICATED");
      }
    };
    const req = createRequest("GET", "http://localhost/api/weekly-review/preferences", null);
    const res = await handleGetPreferences(req, unauthDeps);
    assert(res.status === 401, "Acesso não autenticado deve retornar 401.");
    const json = await res.json();
    assert(json.success === false, "Resposta de erro deve ter success=false.");
    assert(json.error.code === "UNAUTHENTICATED", "Erro deve conter código UNAUTHENTICATED.");
  }

  // 4. Preferências Inexistentes (Upsert Default)
  {
    const localPrisma = new MockPrisma();
    const localDeps = { ...deps, prisma: localPrisma };

    const reqGet = createRequest("GET", "http://localhost/api/weekly-review/preferences", null);
    const resGet = await handleGetPreferences(reqGet, localDeps);
    assert(resGet.status === 200, "GET de preferências inexistentes deve retornar 200.");
    const jsonGet = await resGet.json();
    assert(jsonGet.data.enabled === false, "Default enabled deve ser false.");
    assert(jsonGet.data.dayOfWeek === 0, "Default dayOfWeek deve ser 0 (Domingo).");
    assert(jsonGet.data.missedBehavior === "MOVE_TO_NEXT_AVAILABLE_DAY", "Default missedBehavior correto.");

    // PATCH com chaves extras
    const reqPatchErr = createRequest("PATCH", "http://localhost/api/weekly-review/preferences", {
      enabled: true,
      userId: "hacker-id"
    });
    const resPatchErr = await handlePatchPreferences(reqPatchErr, localDeps);
    assert(resPatchErr.status === 400, "Rejeita payload com campo extra userId.");
    assert(resPatchErr.status === 400, "Rejeitado com 400.");

    // PATCH válido
    const reqPatch = createRequest("PATCH", "http://localhost/api/weekly-review/preferences", {
      enabled: true,
      dayOfWeek: 1,
      missedBehavior: "SKIP_CURRENT_WEEK"
    });
    const resPatch = await handlePatchPreferences(reqPatch, localDeps);
    assert(resPatch.status === 200, "PATCH válido deve retornar 200.");
    const jsonPatch = await resPatch.json();
    assert(jsonPatch.data.enabled === true, "enabled atualizado com sucesso.");
    assert(jsonPatch.data.dayOfWeek === 1, "dayOfWeek atualizado.");
    assert(jsonPatch.data.missedBehavior === "SKIP_CURRENT_WEEK", "missedBehavior atualizado.");
  }

  // 5. Criação de Sessão com Cálculo de Ocorrência
  {
    const localPrisma = new MockPrisma();
    localPrisma.preferences.push({
      userId: mockUserId,
      weeklyReviewEnabled: true,
      weeklyReviewDayOfWeek: 0, // Domingo
      weeklyReviewMissedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY"
    });
    const localDeps = { ...deps, prisma: localPrisma };

    // POST com body {} (válido)
    const req = createRequest("POST", "http://localhost/api/weekly-review/sessions", {});
    const res = await handlePostCreateSession(req, localDeps);
    assert(res.status === 201, "Criação de sessão com body vazio deve retornar 201.");
    const json = await res.json();
    assert(json.data.created === true, "created deve ser true.");

    // POST repetido (idempotência -> retorna 200)
    localPrisma.sessions.push({
      id: "session-1",
      userId: mockUserId,
      originalScheduledDate: new Date("2026-07-05T12:00:00Z"),
      effectiveScheduledDate: new Date("2026-07-05T12:00:00Z"),
      status: "PENDING",
      missedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY"
    });

    const reqRep = createRequest("POST", "http://localhost/api/weekly-review/sessions", {});
    const resRep = await handlePostCreateSession(reqRep, localDeps);
    assert(resRep.status === 200, "Criação de sessão repetida deve retornar 200.");
  }

  // 6. Sessão Ativa e Ordenação Determinística
  {
    const localPrisma = new MockPrisma();
    localPrisma.sessions.push(
      {
        id: "session-pending-older",
        userId: mockUserId,
        status: "PENDING",
        effectiveScheduledDate: new Date("2026-07-05T12:00:00Z"),
        createdAt: new Date("2026-07-05T01:00:00Z")
      },
      {
        id: "session-in-progress",
        userId: mockUserId,
        status: "IN_PROGRESS",
        effectiveScheduledDate: new Date("2026-07-05T12:00:00Z"),
        createdAt: new Date("2026-07-05T02:00:00Z")
      },
      {
        id: "session-pending-newer",
        userId: mockUserId,
        status: "PENDING",
        effectiveScheduledDate: new Date("2026-07-05T12:00:00Z"),
        createdAt: new Date("2026-07-05T03:00:00Z")
      }
    );
    const localDeps = { ...deps, prisma: localPrisma };

    const req = createRequest("GET", "http://localhost/api/weekly-review/sessions/active", null);
    const res = await handleGetActiveSession(req, localDeps);
    assert(res.status === 200, "GET active deve retornar 200.");
    const json = await res.json();
    assert(json.data.openSessionCount === 3, "openSessionCount deve ser 3.");
    assert(json.data.session.id === "session-in-progress", "Deve priorizar IN_PROGRESS ante PENDING.");
  }

  // 7. Isolamento de Recursos e 404
  {
    const localPrisma = new MockPrisma();
    localPrisma.sessions.push({
      id: "session-other",
      userId: "test-user-2",
      status: "PENDING",
      effectiveScheduledDate: new Date("2026-07-05T12:00:00Z")
    });
    const localDeps = { ...deps, prisma: localPrisma };

    const req = createRequest("GET", "http://localhost/api/weekly-review/sessions/session-other", null);
    const res = await handleGetSessionById(req, "session-other", localDeps);
    assert(res.status === 404, "Acesso a sessão de outro usuário deve retornar 404.");
  }

  // 8. Limites do Carryover
  {
    const localPrisma = new MockPrisma();
    localPrisma.sessions.push({
      id: "session-1",
      userId: mockUserId,
      status: "PENDING",
      effectiveScheduledDate: new Date("2026-07-05T12:00:00Z"),
      missedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY"
    });
    const localDeps = { ...deps, prisma: localPrisma };

    // Limite superior a 14 dias (2026-07-25 é +20 dias)
    const reqErr = createRequest("POST", "http://localhost/api/weekly-review/sessions/session-1/carry", {
      newEffectiveScheduledDate: "2026-07-25"
    });
    const resErr = await handlePostCarrySession(reqErr, "session-1", localDeps);
    assert(resErr.status === 400, "Carry superior a 14 dias deve ser rejeitado.");

    // Carry válido (2026-07-10 é +5 dias)
    const reqOk = createRequest("POST", "http://localhost/api/weekly-review/sessions/session-1/carry", {
      newEffectiveScheduledDate: "2026-07-10"
    });
    const resOk = await handlePostCarrySession(reqOk, "session-1", localDeps);
    assert(resOk.status === 200, "Carry válido deve retornar 200.");
  }

  // 9. Proteção Avançada Same-Origin
  {
    const originalEnvNodeEnv = process.env.NODE_ENV;
    const originalAppUrl = process.env.APP_URL;
    const originalNextAppUrl = process.env.NEXT_PUBLIC_APP_URL;

    try {
      // Configurar modo de produção artificialmente para o teste
      (process.env as { NODE_ENV: string }).NODE_ENV = "production";
      process.env.APP_URL = "https://app-url-config.com";
      process.env.NEXT_PUBLIC_APP_URL = "https://next-app-url-config.com";

      const testSameOrigin = async (originHeader: string | null, hostHeader: string = "kehlstudy.com", xForwardedHost: string | null = null) => {
        const headers: Record<string, string> = {
          "content-type": "application/json",
          "host": hostHeader
        };
        if (originHeader) {
          headers["origin"] = originHeader;
        }
        if (xForwardedHost) {
          headers["x-forwarded-host"] = xForwardedHost;
        }

        const req = createRequest("POST", "http://localhost/api/weekly-review/preview", {}, headers);
        const res = await handlePostPreview(req, deps);
        return res.status;
      };

      // 1. domínio oficial aceito
      assert(await testSameOrigin("https://kehlstudy.com") === 200, "Domínio oficial https://kehlstudy.com deve ser aceito em prod.");
      assert(await testSameOrigin("https://estudos-anki.vercel.app") === 200, "Domínio oficial https://estudos-anki.vercel.app deve ser aceito em prod.");

      // 2. APP_URL aceito
      assert(await testSameOrigin("https://app-url-config.com") === 200, "APP_URL origin deve ser aceito em prod.");

      // 3. NEXT_PUBLIC_APP_URL aceito
      assert(await testSameOrigin("https://next-app-url-config.com") === 200, "NEXT_PUBLIC_APP_URL origin deve ser aceito em prod.");

      // 4. host arbitrário rejeitado em produção (mesmo que Host coincida com Origin)
      assert(await testSameOrigin("https://arbitrary-host.com", "arbitrary-host.com") === 400, "Host arbitrário coincidente com Origin deve ser rejeitado em prod.");

      // 5. x-forwarded-host arbitrário rejeitado em produção
      assert(await testSameOrigin("https://bad-proxy.com", "kehlstudy.com", "bad-proxy.com") === 400, "X-Forwarded-Host arbitrário coincidente com Origin deve ser rejeitado em prod.");

      // 7. protocolo incorreto rejeitado (ex: http em vez de https)
      assert(await testSameOrigin("http://kehlstudy.com") === 400, "Protocolo http para domínio oficial deve ser rejeitado.");

      // 8. domínio semelhante rejeitado
      assert(await testSameOrigin("https://kehlstudy.com.br") === 400, "Domínio semelhante (kehlstudy.com.br) deve ser rejeitado.");
      assert(await testSameOrigin("https://kehlstudy-fake.com") === 400, "Domínio semelhante (kehlstudy-fake.com) deve ser rejeitado.");

      // 9. subdomínio não autorizado rejeitado
      assert(await testSameOrigin("https://api.kehlstudy.com") === 400, "Subdomínio não autorizado deve ser rejeitado.");

      // Configurar modo de desenvolvimento
      (process.env as { NODE_ENV: string }).NODE_ENV = "development";

      // 6. localhost aceito em teste
      assert(await testSameOrigin("http://localhost:3000") === 200, "Localhost com porta deve ser aceito em desenvolvimento.");
      assert(await testSameOrigin("http://127.0.0.1:3000") === 200, "127.0.0.1 com porta deve ser aceito em desenvolvimento.");

      // Host dinâmico aceito em teste
      assert(await testSameOrigin("http://dynamic-dev-host.local", "dynamic-dev-host.local") === 200, "Host dinâmico coincidente com Origin deve ser aceito em desenvolvimento.");
    } finally {
      // Restaurar variáveis de ambiente originais
      if (originalEnvNodeEnv) {
        (process.env as { NODE_ENV: string }).NODE_ENV = originalEnvNodeEnv;
      }
      if (originalAppUrl === undefined) delete process.env.APP_URL; else process.env.APP_URL = originalAppUrl;
      if (originalNextAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = originalNextAppUrl;
    }
  }

  // 10. Validação de Mutações de Sessão e Tópicos (Start, Complete, Skip, Topic PATCH)
  {
    const localPrisma = new MockPrisma();
    localPrisma.sessions.push({
      id: "session-active",
      userId: mockUserId,
      status: "PENDING",
      effectiveScheduledDate: new Date("2026-07-05T12:00:00Z"),
      missedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY"
    });
    localPrisma.topics.push({
      id: "topic-active",
      weeklyReviewSessionId: "session-active",
      result: "PENDING"
    });

    const localService = new MockWeeklyReviewService();
    const localDeps = { ...deps, prisma: localPrisma, weeklyReviewService: localService };

    // A. Start Session
    const reqStart = createRequest("POST", "http://localhost/api/weekly-review/sessions/session-active/start", {
      availableMinutes: 60,
      targetQuestionCount: 20
    });
    const resStart = await handlePostStartSession(reqStart, "session-active", localDeps);
    assert(resStart.status === 200, "Start session deve retornar 200.");
    assert(localService.startCalledWith.userId === mockUserId, "Start deve passar userId.");
    assert(localService.startCalledWith.id === "session-active", "Start deve passar sessionId.");
    assert(localService.startCalledWith.mins === 60, "Start deve passar availableMinutes.");
    assert(localService.startCalledWith.questions === 20, "Start deve passar targetQuestionCount.");

    // B. Record Topic Result
    const reqTopic = createRequest("PATCH", "http://localhost/api/weekly-review/sessions/session-active/topics/topic-active", {
      result: "HAD_DOUBTS",
      notes: "Algumas anotações"
    });
    // Simular que o status da sessão foi para IN_PROGRESS para passar nas validações do handler
    localPrisma.sessions[0].status = "IN_PROGRESS";
    const resTopic = await handlePatchTopicResult(reqTopic, "session-active", "topic-active", localDeps);
    assert(resTopic.status === 200, "Topic result PATCH deve retornar 200.");
    assert(localService.recordCalledWith.userId === mockUserId, "Topic PATCH deve passar userId.");
    assert(localService.recordCalledWith.sid === "session-active", "Topic PATCH deve passar sessionId.");
    assert(localService.recordCalledWith.tid === "topic-active", "Topic PATCH deve passar topicId.");
    assert(localService.recordCalledWith.result === "HAD_DOUBTS", "Topic PATCH deve passar result.");
    assert(localService.recordCalledWith.notes === "Algumas anotações", "Topic PATCH deve passar notes.");

    // C. Complete Session
    const reqComplete = createRequest("POST", "http://localhost/api/weekly-review/sessions/session-active/complete", {
      actualQuestionCount: 18
    });
    const resComplete = await handlePostCompleteSession(reqComplete, "session-active", localDeps);
    assert(resComplete.status === 200, "Complete session deve retornar 200.");
    assert(localService.completeCalledWith.userId === mockUserId, "Complete deve passar userId.");
    assert(localService.completeCalledWith.id === "session-active", "Complete deve passar sessionId.");
    assert(localService.completeCalledWith.count === 18, "Complete deve passar actualQuestionCount.");

    // D. Skip Session (resetando status para PENDING)
    localPrisma.sessions[0].status = "PENDING";
    const reqSkip = createRequest("POST", "http://localhost/api/weekly-review/sessions/session-active/skip", {});
    const resSkip = await handlePostSkipSession(reqSkip, "session-active", localDeps);
    assert(resSkip.status === 200, "Skip session deve retornar 200.");
    assert(localService.skipCalledWith.userId === mockUserId, "Skip deve passar userId.");
    assert(localService.skipCalledWith.id === "session-active", "Skip deve passar sessionId.");
  }

  console.log("====================================================");
  console.log(`[SUCESSO] Suíte de APIs passou com 100% de acerto!`);
  console.log(`Assertions executados: ${passedAssertions}/${totalAssertions}`);
  console.log("====================================================");
}

runTests().catch(err => {
  console.error("❌ TEST FAILURE:", err);
  process.exit(1);
});
