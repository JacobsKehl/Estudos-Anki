import {
  calculateScheduledDate,
  scheduleQuestionReview,
  getTodayQuestionReviews
} from "../src/lib/services/question-review";
import { getTodayRangeSP } from "../src/lib/date-utils";
import { QuestionReviewOrigin } from "@prisma/client";

// Mock Database State
const mockPreferences = {
  userId: "user-1",
  studyDaysOfWeek: "1,2,3,4,5" // Monday to Friday
};

const mockSubjects = [
  { id: "subject-1", name: "Direito Administrativo", studyPriority: "PRIMARY" },
  { id: "subject-2", name: "Direito Constitucional", studyPriority: "PRIMARY" }
];

const mockMaterials = [
  { id: "material-1", fileName: "dir_admin.pdf" }
];

const mockBlocks = [
  {
    id: "block-1",
    userId: "user-1",
    subjectId: "subject-1",
    materialId: "material-1",
    title: "Atos Administrativos",
    pageStart: 10,
    pageEnd: 20,
    status: "NOT_STARTED",
    subject: mockSubjects[0],
    material: mockMaterials[0]
  },
  {
    id: "block-2",
    userId: "user-1",
    subjectId: "subject-1",
    materialId: "material-1",
    title: "Poderes Administrativos",
    pageStart: 21,
    pageEnd: 30,
    status: "NOT_STARTED",
    subject: mockSubjects[0],
    material: mockMaterials[0]
  },
  {
    id: "block-3",
    userId: "user-1",
    subjectId: "subject-1",
    materialId: "material-1",
    title: "Processo Administrativo",
    pageStart: 31,
    pageEnd: 40,
    status: "NOT_STARTED",
    subject: mockSubjects[0],
    material: mockMaterials[0]
  },
  {
    id: "block-4",
    userId: "user-1",
    subjectId: "subject-2",
    materialId: "material-1",
    title: "Direitos Fundamentais",
    pageStart: 1,
    pageEnd: 9,
    status: "NOT_STARTED",
    subject: mockSubjects[1],
    material: mockMaterials[0]
  }
];

let mockTasks: any[] = [];

// Mock Prisma Client
const mockTx: any = {
  userPreferences: {
    findUnique: async () => mockPreferences
  },
  studyBlock: {
    findUnique: async ({ where }: any) => mockBlocks.find(b => b.id === where.id) || null
  },
  questionReviewTask: {
    count: async ({ where }: any) => {
      const gte = where.scheduledDate?.gte;
      const lt = where.scheduledDate?.lt;
      return mockTasks.filter(t => {
        const matchesUser = t.userId === where.userId;
        const matchesStatus = t.status === where.status;
        const matchesDate = (!gte || t.scheduledDate >= gte) && (!lt || t.scheduledDate < lt);
        return matchesUser && matchesStatus && matchesDate;
      }).length;
    },
    findFirst: async ({ where }: any) => {
      return mockTasks.find(t => t.userId === where.userId && t.studyBlockId === where.studyBlockId) || null;
    },
    create: async ({ data }: any) => {
      const newTask = {
        id: `task-${mockTasks.length + 1}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockTasks.push(newTask);
      return newTask;
    }
  }
};

async function runTests() {
  console.log("=========================================");
  console.log("[OFFLINE TEST] Iniciando Testes da Revisão por Questões");
  console.log("=========================================");

  try {
    mockTasks = []; // Reset tasks

    // 1. Testar calculateScheduledDate
    // Base: Quarta-feira, 01/07/2026. D+15 deve ser Quinta-feira, 16/07/2026.
    const baseDate = new Date("2026-07-01T12:00:00.000Z");
    const date1 = await calculateScheduledDate(mockTx, "user-1", baseDate);
    console.log("✓ calculateScheduledDate (sem colisão) retornou dia útil:", date1.toISOString().split("T")[0]);
    if (date1.getUTCDay() === 0 || date1.getUTCDay() === 6) {
      throw new Error("Erro: Data agendada caiu em fim de semana, mas o usuário só estuda de Seg a Sex!");
    }

    // 2. Agendar revisão para block-1 (Atos Administrativos)
    const task1 = await scheduleQuestionReview(mockTx, "user-1", "block-1", baseDate, QuestionReviewOrigin.AUTOMATIC);
    if (!task1) throw new Error("Tarefa 1 não pôde ser criada");
    console.log("✓ scheduleQuestionReview criado com snapshots corretos:");
    console.log("  - sourceBlockTitle:", task1.sourceBlockTitle);
    console.log("  - sourceMaterialName:", task1.sourceMaterialName);
    console.log("  - sourceSubjectName:", task1.sourceSubjectName);
    
    if (task1.sourceBlockTitle !== "Atos Administrativos") throw new Error("Erro no snapshot de título");
    if (task1.sourceSubjectName !== "Direito Administrativo") throw new Error("Erro no snapshot de matéria");
    if (task1.sourceMaterialName !== "dir_admin.pdf") throw new Error("Erro no snapshot de material");

    // 3. Testar idempotência
    const duplicate = await scheduleQuestionReview(mockTx, "user-1", "block-1", baseDate, QuestionReviewOrigin.AUTOMATIC);
    if (duplicate !== null) {
      throw new Error("Erro: Permitido criar tarefa duplicada para o mesmo bloco!");
    }
    console.log("✓ Idempotência de agendamento validada.");

    // 4. Testar limite diário de 2 e overflow automático
    // Agendar tarefa para block-2 no mesmo dia base
    const task2 = await scheduleQuestionReview(mockTx, "user-1", "block-2", baseDate, QuestionReviewOrigin.AUTOMATIC);
    if (!task2) throw new Error("Tarefa 2 não pôde ser criada");

    // Agendar tarefa para block-3 no mesmo dia base (deve estourar o limite de 2 e ir para o próximo dia útil)
    const task3 = await scheduleQuestionReview(mockTx, "user-1", "block-3", baseDate, QuestionReviewOrigin.AUTOMATIC);
    if (!task3) throw new Error("Tarefa 3 não pôde ser criada");

    console.log("✓ Overflow automático verificado:");
    console.log("  - Task 1 (D+15):", task1.scheduledDate.toISOString().split("T")[0]);
    console.log("  - Task 2 (D+15):", task2.scheduledDate.toISOString().split("T")[0]);
    console.log("  - Task 3 (Overflow -> D+16):", task3.scheduledDate.toISOString().split("T")[0]);

    if (task1.scheduledDate.getTime() !== task2.scheduledDate.getTime()) {
      throw new Error("Erro: Task 1 e Task 2 deveriam estar no mesmo dia.");
    }
    if (task3.scheduledDate.getTime() === task1.scheduledDate.getTime()) {
      throw new Error("Erro: Task 3 devia ter sido movida de dia devido ao overflow de limite 2.");
    }
    
    // Como D+15 é Quinta (16/07), o dia seguinte D+16 é Sexta (17/07), que é dia útil.
    const expectedD16Str = "2026-07-17";
    const actualD16Str = task3.scheduledDate.toISOString().split("T")[0];
    if (actualD16Str !== expectedD16Str) {
      throw new Error(`Erro: Esperado que Task 3 fosse para ${expectedD16Str}, mas foi para ${actualD16Str}`);
    }

    // 5. Testar overflow pulando fim de semana (D+17 seria Sábado, deve ir para Segunda-feira)
    // Vamos agendar uma 4ª tarefa (block-4) que colidiria com a Task 3 na Sexta 17/07.
    // E uma 5ª tarefa que iria para o Sábado 18/07, mas deve ir para Segunda 20/07.
    const task4 = await scheduleQuestionReview(mockTx, "user-1", "block-4", baseDate, QuestionReviewOrigin.AUTOMATIC);
    // Agora o dia 17/07 (Sexta) já tem 2 tarefas (Task 3 e Task 4).
    // Próxima tarefa para o mesmo dia base deve tentar cair no dia 16/07 (cheio), 17/07 (cheio), 18/07 (fim de semana -> pula), 19/07 (fim de semana -> pula), 20/07 (Segunda-feira).
    const block5 = {
      id: "block-5",
      userId: "user-1",
      subjectId: "subject-1",
      materialId: "material-1",
      title: "Conselho Nacional de Justiça",
      pageStart: 41,
      pageEnd: 50,
      status: "NOT_STARTED",
      subject: mockSubjects[0],
      material: mockMaterials[0]
    };
    mockBlocks.push(block5);

    const task5 = await scheduleQuestionReview(mockTx, "user-1", "block-5", baseDate, QuestionReviewOrigin.AUTOMATIC);
    if (!task5) throw new Error("Tarefa 5 não pôde ser criada");

    console.log("✓ Overflow pulando fim de semana verificado:");
    console.log("  - Task 4 (D+16):", task4?.scheduledDate.toISOString().split("T")[0]);
    console.log("  - Task 5 (D+19 -> Segunda-feira):", task5.scheduledDate.toISOString().split("T")[0]);

    const expectedSegundaStr = "2026-07-20";
    const actualSegundaStr = task5.scheduledDate.toISOString().split("T")[0];
    if (actualSegundaStr !== expectedSegundaStr) {
      throw new Error(`Erro: Esperado que Task 5 fosse agendada para Segunda ${expectedSegundaStr}, mas foi para ${actualSegundaStr}`);
    }

    console.log("=========================================");
    console.log("✓ TODOS OS TESTES UNITÁRIOS PASSARAM COM SUCESSO!");
    console.log("=========================================");
    process.exit(0);

  } catch (error: any) {
    console.error("❌ ERRO NOS TESTES UNITÁRIOS:", error.message);
    console.error(error);
    process.exit(1);
  }
}

runTests();
