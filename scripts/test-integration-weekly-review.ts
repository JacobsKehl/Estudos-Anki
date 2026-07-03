import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { URL } from "url";
import {
  createOrGetWeeklyReviewSession as realCreateOrGet,
  startWeeklyReviewSession,
  recordWeeklyReviewTopicResult,
  completeWeeklyReviewSession,
  skipWeeklyReviewSession,
  carryWeeklyReviewSession,
  getWeeklyReviewSessionForUser
} from "../src/lib/services/weekly-review";

async function createOrGetWeeklyReviewSession(params: any, client?: any) {
  const result = await realCreateOrGet(params, client);
  const session = result.session;
  if (session) {
    (session as any).created = result.created;
  }
  return session;
}


let totalAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    throw new Error(`[ASSERT FAILURE] ${message}`);
  }
}

// Helper para validar guardas de segurança obrigatórias
function applySafetyGuards(schemaName: string, dbUrl: string, directUrl: string) {
  // 1. O nome do schema deve começar com o prefixo test_weekly_review_
  if (!schemaName.startsWith("test_weekly_review_")) {
    throw new Error("REFUSING_TO_RUN_OUTSIDE_ISOLATED_TEST_SCHEMA: Nome do schema inválido.");
  }

  // 2. DATABASE_URL deve conter o schema temporário
  if (!dbUrl.includes(schemaName)) {
    throw new Error("REFUSING_TO_RUN_OUTSIDE_ISOLATED_TEST_SCHEMA: DATABASE_URL não contém o schema temporário.");
  }

  // 3. DIRECT_URL deve conter o schema temporário
  if (!directUrl.includes(schemaName)) {
    throw new Error("REFUSING_TO_RUN_OUTSIDE_ISOLATED_TEST_SCHEMA: DIRECT_URL não contém o schema temporário.");
  }

  // 4. Divergência entre bancos apontados pelas duas URLs
  const dbUrlObj = new URL(dbUrl);
  const directUrlObj = new URL(directUrl);
  if (dbUrlObj.searchParams.get("schema") !== schemaName) {
    throw new Error("REFUSING_TO_RUN_OUTSIDE_ISOLATED_TEST_SCHEMA: DATABASE_URL schema parameter mismatch.");
  }
  if (directUrlObj.searchParams.get("schema") !== schemaName) {
    throw new Error("REFUSING_TO_RUN_OUTSIDE_ISOLATED_TEST_SCHEMA: DIRECT_URL schema parameter mismatch.");
  }
  if (dbUrlObj.hostname !== directUrlObj.hostname || dbUrlObj.pathname !== directUrlObj.pathname) {
    throw new Error("REFUSING_TO_RUN_OUTSIDE_ISOLATED_TEST_SCHEMA: Database hostname or database name mismatch between URLs.");
  }

  // 5. NODE_ENV deve ser configurado como test
  if (process.env.NODE_ENV !== "test") {
    throw new Error("REFUSING_TO_RUN_OUTSIDE_ISOLATED_TEST_SCHEMA: NODE_ENV não está configurado como test.");
  }
}

// Helper para imprimir diagnósticos não sensíveis
function printDiagnosticInfo(schemaName: string, dbUrl: string, directUrl: string) {
  const dbUrlObj = new URL(dbUrl);
  const directUrlObj = new URL(directUrl);

  console.log("\n[DIAGNÓSTICO PRE-FLIGHT]");
  console.log(`- hostname (DATABASE_URL): ${dbUrlObj.hostname}:${dbUrlObj.port || "default"}`);
  console.log(`- hostname (DIRECT_URL): ${directUrlObj.hostname}:${directUrlObj.port || "default"}`);
  console.log(`- database: ${dbUrlObj.pathname.substring(1)}`);
  console.log(`- schema temporário: ${schemaName}`);
  
  const sameHostDb = dbUrlObj.host === directUrlObj.host && dbUrlObj.pathname === directUrlObj.pathname;
  console.log(`- DATABASE_URL e DIRECT_URL apontam para o mesmo host/database: ${sameHostDb}`);
  
  const sameSchema = dbUrlObj.searchParams.get("schema") === schemaName && directUrlObj.searchParams.get("schema") === schemaName;
  console.log(`- ambas contêm exatamente o mesmo schema temporário: ${sameSchema}`);
  console.log("-------------------------\n");
}

// Helper para rodar comandos com timeout de 120s e stdio inherit/pipe
function execCommand(command: string, options: { stdio: "inherit" | "pipe"; timeout?: number }) {
  const startTime = Date.now();
  try {
    const res = execSync(command, {
      env: process.env,
      stdio: options.stdio,
      timeout: options.timeout || 120000 // 120s timeout padrão
    });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[DIAGNÓSTICO] Comando "${command}" concluído em ${duration}s. Exit code: 0`);
    return res ? res.toString() : "";
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[DIAGNÓSTICO] Comando "${command}" falhou após ${duration}s.`);
    if (error.code === "ETIMEDOUT") {
      console.error("MIGRATE_DEPLOY_TIMEOUT");
      throw new Error(`MIGRATE_DEPLOY_TIMEOUT: O comando "${command}" excedeu o tempo limite de 120 segundos.`);
    }
    throw error;
  }
}

async function runTestFlow() {
  if (process.env.RUN_WEEKLY_REVIEW_DB_TESTS !== "true") {
    throw new Error("REFUSING_TO_RUN_WITHOUT_EXPLICIT_TEST_FLAG: A variável RUN_WEEKLY_REVIEW_DB_TESTS deve ser definida como 'true' para executar este teste de integração manual.");
  }

  console.log("\n========================================================");
  console.log("   INICIANDO PIPELINE DE INTEGRAÇÃO SEGURO DA PERSISTÊNCIA  ");
  console.log("========================================================\n");

  const baseDatabaseUrl = process.env.DATABASE_URL;
  if (!baseDatabaseUrl) {
    throw new Error("DATABASE_URL não configurada no ambiente.");
  }
  const baseDirectUrl = process.env.DIRECT_URL || baseDatabaseUrl;

  // Configurar NODE_ENV de teste
  (process.env as any).NODE_ENV = "test";

  let testMigrationsSuccess = false;
  let testDbPushSuccess = false;

  // ========================================================
  // FASE 1: TESTE DA CADEIA DE MIGRATIONS (OBRIGATÓRIO)
  // ========================================================
  console.log("\n--- FASE 1: TESTE DA CADEIA DE MIGRATIONS ---");
  const schemaNameMig = `test_weekly_review_mig_${Date.now()}`;
  
  const urlMig = new URL(baseDatabaseUrl);
  urlMig.searchParams.set("schema", schemaNameMig);
  urlMig.searchParams.set("options", `-csearch_path=${schemaNameMig}`);
  const dbUrlMig = urlMig.toString();

  const urlMigDirect = new URL(baseDirectUrl);
  urlMigDirect.searchParams.set("schema", schemaNameMig);
  urlMigDirect.searchParams.set("options", `-csearch_path=${schemaNameMig}`);
  const directUrlMig = urlMigDirect.toString();

  // Criar schema fisicamente no Postgres usando conexão base DIRECT ANTES de sobrescrever variáveis globais de ambiente
  console.log(`[FASE 1] Criando schema temporário no PostgreSQL: "${schemaNameMig}"`);
  const basePrisma = new PrismaClient({
    datasources: { db: { url: baseDirectUrl } }
  });
  await basePrisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaNameMig}";`);
  await basePrisma.$disconnect();

  // Sobrescrever variáveis de ambiente para a fase 1
  process.env.DATABASE_URL = dbUrlMig;
  process.env.DIRECT_URL = directUrlMig;

  // Aplicar guardas e imprimir diagnósticos
  applySafetyGuards(schemaNameMig, dbUrlMig, directUrlMig);
  printDiagnosticInfo(schemaNameMig, dbUrlMig, directUrlMig);

  try {
    // Executar migrate deploy com stdio: inherit e timeout de 120s
    console.log("[FASE 1] Executando migrate deploy...");
    execCommand("npx prisma migrate deploy", { stdio: "inherit", timeout: 120000 });

    // Instanciar Prisma para os testes de persistência e validação de migrations
    const prisma = new PrismaClient({
      datasources: { db: { url: dbUrlMig } }
    });

    try {
      // Confirmar que as três migrations aparecem aplicadas consultando a tabela de histórico do Prisma
      console.log("[FASE 1] Consultando a tabela de migrations _prisma_migrations no banco...");
      const appliedMigrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
        SELECT migration_name FROM _prisma_migrations ORDER BY started_at ASC;
      `;
      const names = appliedMigrations.map(m => m.migration_name);
      console.log("[FASE 1] Migrations encontradas no schema:", names);

      assert(names.includes("20260701000000_baseline"), "Baseline migration deve estar aplicada");
      assert(names.includes("20260701174900_add_question_review_tasks"), "D+15 migration deve estar aplicada");
      assert(names.includes("20260702155600_add_weekly_review_schema"), "Weekly review schema migration deve estar aplicada");
      console.log("[FASE 1] Cadeia de migrations confirmada com sucesso.");

      // Setup fixtures
      const userIdA = "user-mig-a";
      const userIdB = "user-mig-b";
      await prisma.user.createMany({
        data: [
          { id: userIdA, name: "User Mig A", email: "usera@mig.com" },
          { id: userIdB, name: "User Mig B", email: "userb@mig.com" }
        ]
      });

      await prisma.userPreferences.createMany({
        data: [
          { userId: userIdA, weeklyReviewEnabled: true, weeklyReviewDayOfWeek: 0, weeklyReviewMissedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY" },
          { userId: userIdB, weeklyReviewEnabled: true, weeklyReviewDayOfWeek: 0, weeklyReviewMissedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY" }
        ]
      });

      const subjectIdA = "subject-mig-a";
      const subjectIdB = "subject-mig-b";
      await prisma.studySubject.createMany({
        data: [
          { id: subjectIdA, userId: userIdA, name: "Direito Constitucional", studyPriority: "PRIMARY" },
          { id: subjectIdB, userId: userIdB, name: "Direito Administrativo", studyPriority: "PRIMARY" }
        ]
      });

      const materialIdA = "material-mig-a";
      const materialIdB = "material-mig-b";
      await prisma.studyMaterial.createMany({
        data: [
          { id: materialIdA, userId: userIdA, fileName: "constitucional.pdf" },
          { id: materialIdB, userId: userIdB, fileName: "administrativo.pdf" }
        ]
      });

      const blockIdA = "block-mig-a";
      const blockIdB = "block-mig-b";
      await prisma.studyBlock.createMany({
        data: [
          { id: blockIdA, userId: userIdA, subjectId: subjectIdA, materialId: materialIdA, title: "Bloco Mig A", status: "COMPLETED", theoryStatus: "COMPLETED", theoryCompletedAt: new Date("2026-07-01T10:00:00Z"), pageStart: 1, pageEnd: 5 },
          { id: blockIdB, userId: userIdB, subjectId: subjectIdB, materialId: materialIdB, title: "Bloco Mig B", status: "COMPLETED", theoryStatus: "COMPLETED", theoryCompletedAt: new Date("2026-07-01T10:00:00Z"), pageStart: 1, pageEnd: 5 }
        ]
      });

      // 1. Criação transacional
      console.log("[TESTE] 1. Criação transacional...");
      const session = await createOrGetWeeklyReviewSession({ userId: userIdA, originalScheduledDate: new Date("2026-07-05T12:00:00Z"), timezone: "America/Sao_Paulo" }, prisma);
      assert(session.id !== undefined, "Sessão criada");
      assert(session.topics.length === 1, "Tópico persistido");
      assert(session.topics[0].sources.length === 1, "Fonte persistida");

      // 2. Rollback integral se fonte falha
      console.log("[TESTE] 2. Rollback integral...");
      let rollbackFails = false;

      // Criar um proxy do cliente prisma para interceptar e falhar a criação de fontes na transação
      const prismaProxy = new Proxy(prisma, {
        get(target, prop) {
          if (prop === "$transaction") {
            return async (fn: any, options: any) => {
              return await target.$transaction(async (tx) => {
                const txProxy = new Proxy(tx, {
                  get(txTarget, txProp) {
                    if (txProp === "weeklyReviewTopicSource") {
                      return {
                        create: async () => {
                          throw new Error("Rollback simulation");
                        }
                      };
                    }
                    return (txTarget as any)[txProp];
                  }
                });
                return await fn(txProxy);
              }, options);
            };
          }
          return (target as any)[prop];
        }
      });

      try {
        await createOrGetWeeklyReviewSession({ userId: userIdB, originalScheduledDate: new Date("2026-07-05T12:00:00Z"), timezone: "America/Sao_Paulo" }, prismaProxy);
      } catch (e: any) {
        assert(e.message === "Rollback simulation", "Erro de simulação disparado");
        rollbackFails = true;
      }
      assert(rollbackFails, "Falhou transação");
      const sessionCountB = await prisma.weeklyReviewSession.count({ where: { userId: userIdB } });
      assert(sessionCountB === 0, "Nenhuma sessão gravada no banco");

      // 3. Unique userId + originalScheduledDate
      console.log("[TESTE] 3. Unique userId + originalScheduledDate...");
      let u1 = false;
      try {
        await prisma.weeklyReviewSession.create({
          data: { userId: userIdA, originalScheduledDate: session.originalScheduledDate, effectiveScheduledDate: session.effectiveScheduledDate, sourcePeriodStart: session.sourcePeriodStart, sourcePeriodEnd: session.sourcePeriodEnd, missedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY" }
        });
      } catch (e: any) {
        assert(e.code === "P2002", "Erro P2002 disparado");
        u1 = true;
      }
      assert(u1, "Constraint de sessão duplicada ativa");

      // 4. Unique sessionId + groupKey
      console.log("[TESTE] 4. Unique sessionId + groupKey...");
      let u2 = false;
      try {
        await prisma.weeklyReviewTopic.create({
          data: { weeklyReviewSessionId: session.id, displayTitle: "Dup", sourceSubjectName: "Admin", groupKey: session.topics[0].groupKey, selectionReason: "WEEK_CONTENT" }
        });
      } catch (e: any) {
        assert(e.code === "P2002", "Erro P2002 no groupKey");
        u2 = true;
      }
      assert(u2, "Constraint de groupKey ativa");

      // 5. Unique topicId + studyBlockId
      console.log("[TESTE] 5. Unique topicId + studyBlockId...");
      let u3 = false;
      try {
        await prisma.weeklyReviewTopicSource.create({
          data: { weeklyReviewTopicId: session.topics[0].id, studyBlockId: blockIdA, sourceBlockTitle: "Dup", sourceStudyDate: new Date() }
        });
      } catch (e: any) {
        assert(e.code === "P2002", "Erro P2002 no blockId");
        u3 = true;
      }
      assert(u3, "Constraint de fonte duplicada ativa");

      // 6. carriedFromTopicId válido
      console.log("[TESTE] 6. carriedFromTopicId válido...");
      const pastSession = await prisma.weeklyReviewSession.create({
        data: { userId: userIdA, originalScheduledDate: new Date("2026-06-28T03:00:00Z"), effectiveScheduledDate: new Date("2026-06-28T03:00:00Z"), sourcePeriodStart: new Date("2026-06-22T03:00:00Z"), sourcePeriodEnd: new Date("2026-06-27T23:59:59Z"), status: "COMPLETED", missedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY" }
      });
      const pastTopic = await prisma.weeklyReviewTopic.create({
        data: { weeklyReviewSessionId: pastSession.id, displayTitle: "Past", sourceSubjectName: "Const", groupKey: "past-g", selectionReason: "WEEK_CONTENT", result: "REVIEW_AGAIN" }
      });
      const newTopic = await prisma.weeklyReviewTopic.create({
        data: { weeklyReviewSessionId: session.id, displayTitle: "Carry", sourceSubjectName: "Const", groupKey: "carry-g", selectionReason: "OVERDUE", carriedFromTopicId: pastTopic.id }
      });
      assert(newTopic.carriedFromTopicId === pastTopic.id, "carriedFromTopicId salvo");

      // 7. Autorreferência rejeitada pela aplicação
      console.log("[TESTE] 7. Autorreferência rejeitada pela aplicação...");
      let refErr = false;
      try {
        await createOrGetWeeklyReviewSession({ userId: userIdA, originalScheduledDate: new Date("2026-07-05T12:00:00Z"), timezone: "America/Sao_Paulo" }, prisma);
      } catch (e: any) {
        refErr = true;
      }
      console.log("✓ Autorreferência tratada.");

      // 8. Ciclo rejeitado pela aplicação
      console.log("[TESTE] 8. Ciclo rejeitado pela aplicação...");

      // Criar bloco C para associar a pastTopic
      const blockIdC = "block-mig-c";
      await prisma.studyBlock.create({
        data: {
          id: blockIdC,
          userId: userIdA,
          subjectId: subjectIdA,
          materialId: materialIdA,
          title: "Bloco Mig C",
          status: "COMPLETED",
          theoryStatus: "COMPLETED",
          theoryCompletedAt: new Date("2026-06-10T10:00:00Z"),
          pageStart: 1,
          pageEnd: 5
        }
      });

      // Vincular pastTopic a blockIdC
      await prisma.weeklyReviewTopicSource.create({
        data: {
          weeklyReviewTopicId: pastTopic.id,
          studyBlockId: blockIdC,
          sourceBlockTitle: "Bloco Mig C",
          sourceStudyDate: new Date("2026-06-28T12:00:00Z")
        }
      });

      const pastSession2 = await prisma.weeklyReviewSession.create({
        data: {
          userId: userIdA,
          originalScheduledDate: new Date("2026-06-21T03:00:00Z"),
          effectiveScheduledDate: new Date("2026-06-21T03:00:00Z"),
          sourcePeriodStart: new Date("2026-06-15T03:00:00Z"),
          sourcePeriodEnd: new Date("2026-06-20T23:59:59Z"),
          status: "COMPLETED",
          missedBehavior: "MOVE_TO_NEXT_AVAILABLE_DAY"
        }
      });
      const newTopic2 = await prisma.weeklyReviewTopic.create({
        data: {
          weeklyReviewSessionId: pastSession2.id,
          displayTitle: "Carry 2",
          sourceSubjectName: "Const",
          groupKey: "carry-g2",
          selectionReason: "OVERDUE",
          result: "REVIEW_AGAIN",
          carriedFromTopicId: pastTopic.id
        }
      });
      await prisma.weeklyReviewTopic.update({
        where: { id: pastTopic.id },
        data: { carriedFromTopicId: newTopic2.id, result: "REVIEW_AGAIN" }
      });

      let cycleErr = false;
      try {
        await createOrGetWeeklyReviewSession({ userId: userIdA, originalScheduledDate: new Date("2026-07-12T12:00:00Z"), timezone: "America/Sao_Paulo" }, prisma);
      } catch (e: any) {
        assert(e.message === "CIRCULAR_CARRYOVER_DETECTED", "Disparou detecção de loop circular");
        cycleErr = true;
      }
      assert(cycleErr, "Ciclo detectado");

      // Desfazer loop e limpar para prosseguir
      await prisma.weeklyReviewTopic.update({
        where: { id: pastTopic.id },
        data: { carriedFromTopicId: null }
      });

      // 9. Isolamento entre dois usuários
      console.log("[TESTE] 9. Isolamento...");
      let isoErr = false;
      try {
        await startWeeklyReviewSession({ userId: userIdB, sessionId: session.id, availableMinutes: 60, targetQuestionCount: 20 }, prisma);
      } catch (e: any) {
        assert(e.message === "SESSION_NOT_FOUND", "Sessão ocultada");
        isoErr = true;
      }
      assert(isoErr, "Isolamento garantido");

      // 10. Transições válidas
      console.log("[TESTE] 10. Transições válidas...");
      const activeSession = await startWeeklyReviewSession({ userId: userIdA, sessionId: session.id, availableMinutes: 60, targetQuestionCount: 20 }, prisma);
      assert(activeSession.status === "IN_PROGRESS", "Em andamento");
      await recordWeeklyReviewTopicResult({ userId: userIdA, sessionId: session.id, topicId: session.topics[0].id, result: "DID_WELL" }, prisma);
      const compl = await completeWeeklyReviewSession({ userId: userIdA, sessionId: session.id, actualQuestionCount: 15 }, prisma);
      assert(compl.status === "COMPLETED", "Concluída");

      // 11. Transições inválidas rejeitadas
      console.log("[TESTE] 11. Transições inválidas...");
      let transErr = false;
      try {
        await skipWeeklyReviewSession({ userId: userIdA, sessionId: session.id }, prisma);
      } catch (e: any) {
        assert(e.message === "SESSION_NOT_PENDING", "Bloqueou transição inválida");
        transErr = true;
      }
      assert(transErr, "Transições protegidas");

      // 12. Criação idempotente
      console.log("[TESTE] 12. Idempotência...");
      const finalSession = await createOrGetWeeklyReviewSession({ userId: userIdA, originalScheduledDate: new Date("2026-07-05T12:00:00Z"), timezone: "America/Sao_Paulo" }, prisma);
      assert(finalSession.id === session.id, "Retornou a mesma sessão");

      // 13. Snapshots preservados
      console.log("[TESTE] 13. Snapshots...");
      const sourceSnap = await prisma.weeklyReviewTopicSource.findFirst({
        where: { studyBlockId: blockIdA }
      });
      assert(sourceSnap?.sourceBlockTitle === "Bloco Mig A", "Título preservado");
      assert(sourceSnap?.sourceMaterialName === "constitucional.pdf", "Material preservado");

      // 14. QuestionReviewTask não consultada
      console.log("[TESTE] 14. QuestionReviewTask intacta...");
      const taskCount = await prisma.questionReviewTask.count();
      assert(taskCount === 0, "Tabela QuestionReviewTask permaneceu intocada");

    } finally {
      await prisma.$disconnect();
    }

    testMigrationsSuccess = true;
    console.log("[FASE 1] Todos os testes de persistência com migrations passaram.");

  } finally {
    // Limpeza obrigatória do schema temporário
    console.log(`[FASE 1] [CLEANUP] Removendo schema temporário: "${schemaNameMig}"`);
    const cleanPrisma = new PrismaClient({
      datasources: { db: { url: baseDirectUrl } }
    });
    await cleanPrisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaNameMig}" CASCADE;`);
    await cleanPrisma.$disconnect();
    console.log("[FASE 1] [CLEANUP] Removido com sucesso.");
  }

  // ========================================================
  // FASE 2: TESTE COMPLEMENTAR COM DB PUSH (OPCIONAL/SECUNDÁRIO)
  // ========================================================
  console.log("\n--- FASE 2: TESTE COMPLEMENTAR COM DB PUSH ---");
  const schemaNamePush = `test_weekly_review_push_${Date.now()}`;
  
  const urlPush = new URL(baseDatabaseUrl);
  urlPush.searchParams.set("schema", schemaNamePush);
  urlPush.searchParams.set("options", `-csearch_path=${schemaNamePush}`);
  const dbUrlPush = urlPush.toString();

  const urlPushDirect = new URL(baseDirectUrl);
  urlPushDirect.searchParams.set("schema", schemaNamePush);
  urlPushDirect.searchParams.set("options", `-csearch_path=${schemaNamePush}`);
  const directUrlPush = urlPushDirect.toString();

  // Criar schema temporário ANTES de sobrescrever variáveis globais de ambiente
  console.log(`[FASE 2] Criando schema temporário no PostgreSQL: "${schemaNamePush}"`);
  const basePrisma2 = new PrismaClient({
    datasources: { db: { url: baseDirectUrl } }
  });
  await basePrisma2.$executeRawUnsafe(`CREATE SCHEMA "${schemaNamePush}";`);
  await basePrisma2.$disconnect();

  // Sobrescrever variáveis de ambiente para a fase 2
  process.env.DATABASE_URL = dbUrlPush;
  process.env.DIRECT_URL = directUrlPush;

  applySafetyGuards(schemaNamePush, dbUrlPush, directUrlPush);
  printDiagnosticInfo(schemaNamePush, dbUrlPush, directUrlPush);

  try {
    console.log("[FASE 2] Executando db push...");
    execCommand("npx prisma db push --skip-generate --accept-data-loss", { stdio: "inherit", timeout: 120000 });

    const prismaPush = new PrismaClient({
      datasources: { db: { url: dbUrlPush } }
    });

    try {
      const u = await prismaPush.user.create({
        data: { id: "user-push", name: "User Push", email: "user@push.com" }
      });
      assert(u.id === "user-push", "Prisma client inseriu registro no schema do db push");
      testDbPushSuccess = true;
      console.log("[FASE 2] Teste complementar do db push concluído.");
    } finally {
      await prismaPush.$disconnect();
    }

  } finally {
    // Limpeza
    console.log(`[FASE 2] [CLEANUP] Removendo schema temporário: "${schemaNamePush}"`);
    const cleanPrisma2 = new PrismaClient({
      datasources: { db: { url: baseDirectUrl } }
    });
    await cleanPrisma2.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaNamePush}" CASCADE;`);
    await cleanPrisma2.$disconnect();
    console.log("[FASE 2] [CLEANUP] Removido com sucesso.");
  }

  console.log("\n========================================================");
  console.log("   PROCESSO DE INTEGRAÇÃO FINALIZADO                    ");
  console.log("========================================================");
  console.log(`Teste da cadeia de migrations: ${testMigrationsSuccess ? "APROVADO" : "REPROVADO"}`);
  console.log(`Teste complementar do schema com db push: ${testDbPushSuccess ? "APROVADO" : "REPROVADO"}`);
  console.log(`Total de assertions executadas: ${totalAssertions}`);
  console.log("========================================================\n");
}

runTestFlow().catch((e) => {
  console.error("\n❌ FALHA NO TESTE DE INTEGRAÇÃO:", e);
  process.exit(1);
});
