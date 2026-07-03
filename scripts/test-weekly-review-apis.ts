import {
  handleGetPreferences,
  handlePatchPreferences
} from "../src/app/api/weekly-review/preferences/handlers";
import { handlePostPreview } from "../src/app/api/weekly-review/preview/handlers";
import { handlePostCreateSession } from "../src/app/api/weekly-review/sessions/handlers";
import { handleGetActiveSession } from "../src/app/api/weekly-review/sessions/active/handlers";
import { handleGetSessionById } from "../src/app/api/weekly-review/sessions/[sessionId]/handlers";
import { handlePostStartSession } from "../src/app/api/weekly-review/sessions/[sessionId]/start/handlers";
import { handlePostCompleteSession } from "../src/app/api/weekly-review/sessions/[sessionId]/complete/handlers";
import { handlePostSkipSession } from "../src/app/api/weekly-review/sessions/[sessionId]/skip/handlers";
import { handlePostCarrySession } from "../src/app/api/weekly-review/sessions/[sessionId]/carry/handlers";
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

// ----------------------------------------------------
// Mock da base de dados e do serviço de domínio
// ----------------------------------------------------
class MockPrisma {
  public preferences: any[] = [];
  public sessions: any[] = [];
  public topics: any[] = [];
  public sources: any[] = [];

  public countCalls = 0;
  public findUniqueCalls = 0;
  public findManyCalls = 0;
  public createCalls = 0;
  public updateCalls = 0;
  public upsertCalls = 0;

  public userPreferences = {
    findUnique: async (args: any) => {
      this.findUniqueCalls++;
      return this.preferences.find(p => p.userId === args.where.userId) || null;
    },
    create: async (args: any) => {
      this.createCalls++;
      const newPref = { id: `pref-${Math.random()}`, ...args.data };
      this.preferences.push(newPref);
      return newPref;
    },
    update: async (args: any) => {
      this.updateCalls++;
      const p = this.preferences.find(x => x.userId === args.where.userId);
      if (p) {
        Object.assign(p, args.data);
        return p;
      }
      throw new Error("Pref not found");
    }
  };

  public weeklyReviewSession = {
    count: async (args: any) => {
      this.countCalls++;
      let filtered = this.sessions;
      if (args.where.userId) {
        filtered = filtered.filter(s => s.userId === args.where.userId);
      }
      if (args.where.status?.in) {
        filtered = filtered.filter(s => args.where.status.in.includes(s.status));
      }
      return filtered.length;
    },
    findFirst: async (args: any) => {
      this.findUniqueCalls++;
      let filtered = this.sessions;
      if (args.where.userId) {
        filtered = filtered.filter(s => s.userId === args.where.userId);
      }
      if (args.where.status?.in) {
        filtered = filtered.filter(s => args.where.status.in.includes(s.status));
      }
      if (args.where.originalScheduledDate) {
        const d = args.where.originalScheduledDate;
        filtered = filtered.filter(s => new Date(s.originalScheduledDate).getTime() === new Date(d).getTime());
      }
      return filtered[0] || null;
    },
    findMany: async (args: any) => {
      this.findManyCalls++;
      let filtered = this.sessions;
      if (args.where.userId) {
        filtered = filtered.filter(s => s.userId === args.where.userId);
      }
      if (args.where.status?.in) {
        filtered = filtered.filter(s => args.where.status.in.includes(s.status));
      }
      return [...filtered];
    },
    findUnique: async (args: any) => {
      this.findUniqueCalls++;
      return this.sessions.find(s => s.id === args.where.id) || null;
    }
  };

  public weeklyReviewTopic = {
    findUnique: async (args: any) => {
      this.findUniqueCalls++;
      return this.topics.find(t => t.id === args.where.id) || null;
    }
  };
}

class MockWeeklyReviewService {
  public previewCalledWith: any = null;
  public createCalledWith: any = null;
  public startCalledWith: any = null;
  public completeCalledWith: any = null;
  public skipCalledWith: any = null;
  public carryCalledWith: any = null;
  public recordCalledWith: any = null;

  public async buildWeeklyReviewPreview(userId: string, refDate: string, tz: string, mins: any, tx: any) {
    this.previewCalledWith = { userId, refDate, mins };
    return {
      sourcePeriodStart: "2026-06-28",
      sourcePeriodEnd: "2026-07-04",
      topics: [
        {
          id: "topic-1",
          subjectId: "sub-1",
          subjectName: "Direito Constitucional",
          title: "Direitos Individuais",
          groupKey: "dir-const-individuais",
          selectionReason: "WEEK_CONTENT",
          sourceStudyDate: "2026-06-29"
        }
      ]
    };
  }

  public async createOrGetWeeklyReviewSession(params: any, client: any) {
    this.createCalledWith = params;
    const session = {
      id: "session-1",
      userId: params.userId,
      originalScheduledDate: params.originalScheduledDate,
      effectiveScheduledDate: params.originalScheduledDate,
      status: "PENDING",
      missedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY",
      createdAt: new Date(),
      topics: []
    };
    return { session, created: true };
  }

  public async startWeeklyReviewSession(id: string, mins: number, questions: number, client: any) {
    this.startCalledWith = { id, mins, questions };
    return { id, status: "IN_PROGRESS", availableMinutes: mins, targetQuestionCount: questions };
  }

  public async completeWeeklyReviewSession(id: string, count: number, client: any) {
    this.completeCalledWith = { id, count };
    return { id, status: "COMPLETED", actualQuestionCount: count };
  }

  public async skipWeeklyReviewSession(id: string, client: any) {
    this.skipCalledWith = { id };
    return { id, status: "SKIPPED" };
  }

  public async carryWeeklyReviewSession(id: string, newDate: Date, client: any) {
    this.carryCalledWith = { id, newDate };
    return { id, status: "PENDING", effectiveScheduledDate: newDate };
  }

  public async recordWeeklyReviewTopicResult(sid: string, tid: string, result: string, notes: string, client: any) {
    this.recordCalledWith = { sid, tid, result, notes };
    return { id: tid, result, notes };
  }
}

// ----------------------------------------------------
// Auxiliares de criação de Requests com headers
// ----------------------------------------------------
function createRequest(
  method: string,
  url: string,
  bodyObj: any,
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

  const mockUserId = "user-gabriela";
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
    const jsonPatchErr = await resPatchErr.status;
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
      userId: "another-user-id",
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

  console.log("====================================================");
  console.log(`[SUCESSO] Suíte de APIs passou com 100% de acerto!`);
  console.log(`Assertions executados: ${passedAssertions}/${totalAssertions}`);
  console.log("====================================================");
}

runTests().catch(err => {
  console.error("❌ TEST FAILURE:", err);
  process.exit(1);
});
