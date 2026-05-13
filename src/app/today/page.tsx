/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/prisma";
import { BookOpen, RotateCw, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { TodayTaskCard } from "@/components/today/TodayTaskCard";
import { getAdaptiveStudyQueue } from "@/lib/recommendations/adaptive-scheduler";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await prisma.user.findFirst();
  const userId = user?.id ?? "";

  const now = new Date();
  let todayItems: any[] = [];
  let pendingReviewsCount = 0;

  try {
    // 1. Buscar itens do cronograma ativo para hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    todayItems = await (prisma as any).studyScheduleItem.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        schedule: { status: "ACTIVE" },
        scheduledDate: { gte: today, lt: tomorrow },
      },
      include: {
        subject: true,
        studyBlock: { include: { material: true } },
      },
      orderBy: { priorityScore: "desc" },
    });

    // 2. Se não há itens de cronograma para hoje, gerar da fila adaptativa
    if (todayItems.length === 0) {
      const queue = await getAdaptiveStudyQueue(userId, 5);
      // Enriquecer com dados do bloco
      for (const task of queue) {
        if (task.studyBlockId) {
          const block = await (prisma as any).studyBlock.findUnique({
            where: { id: task.studyBlockId },
            include: { material: true },
          });
          const subject = await prisma.studySubject.findUnique({
            where: { id: task.subjectId },
          });
          if (block && subject) {
            todayItems.push({
              id: `queue-${task.studyBlockId}`,
              actionType: task.type,
              reason: task.reason,
              priorityScore: task.priorityScore,
              estimatedMinutes: task.estimatedMinutes,
              subject,
              studyBlock: block,
              studyBlockId: task.studyBlockId,
              status: "PENDING",
              _fromQueue: true,
            });
          }
        } else {
          // Tarefa sem bloco (ex: REVIEW_FLASHCARDS)
          const subject = await prisma.studySubject.findUnique({
            where: { id: task.subjectId },
          });
          if (subject) {
            todayItems.push({
              id: `queue-${task.type}-${task.subjectId}`,
              actionType: task.type,
              reason: task.reason,
              priorityScore: task.priorityScore,
              estimatedMinutes: task.estimatedMinutes,
              subject,
              studyBlock: null,
              status: "PENDING",
              _fromQueue: true,
            });
          }
        }
      }
    }

    // 3. Flashcards pendentes
    pendingReviewsCount = await (prisma as any).flashcard.count({
      where: {
        userId,
        status: "APPROVED",
        nextReviewAt: { lte: now },
      },
    });
  } catch (error) {
    console.error("[TODAY PAGE] Erro:", error);
  }

  // ─── Estado vazio ─────────────────────────────────────────────────────────
  if (todayItems.length === 0 && pendingReviewsCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 md:py-32 px-6 space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <div className="text-center space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold">Tudo em dia!</h1>
          <p className="text-muted-foreground text-base max-w-md leading-relaxed">
            Suas revisões e estudos do dia foram concluídos. Descanse ou explore o cronograma.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/schedule">
            <Button variant="outline" className="rounded-2xl">Ver Cronograma</Button>
          </Link>
          <Link href="/reviews">
            <Button className="rounded-2xl gap-2">
              <RotateCw className="w-4 h-4" />
              Revisar Flashcards
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ─── Separar tipos de tarefa ──────────────────────────────────────────────
  const mainTasks = todayItems.filter(
    (i) => i.actionType !== "REVIEW_FLASHCARDS"
  );
  const flashcardReviewTasks = todayItems.filter(
    (i) => i.actionType === "REVIEW_FLASHCARDS"
  );
  const totalMinutes = todayItems.reduce((acc, i) => acc + (i.estimatedMinutes ?? 0), 0);

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-700 slide-in-from-bottom-4 pb-20">
      <PageHeader
        icon={BookOpen}
        title="Estudo de Hoje"
        description={`${todayItems.length} tarefa(s) · ~${totalMinutes} minutos`}
      />

      {/* Tarefas principais do dia */}
      <div className="space-y-4">
        {mainTasks.map((item, idx) => (
          <TodayTaskCard key={item.id} item={item} index={idx + 1} />
        ))}
      </div>

      {/* Revisões de flashcards */}
      {(flashcardReviewTasks.length > 0 || pendingReviewsCount > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center">
              <RotateCw className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 dark:text-amber-200">Revisões de Flashcards</h3>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {pendingReviewsCount} card(s) pendentes hoje
              </p>
            </div>
          </div>

          {flashcardReviewTasks.map((item) => (
            <div key={item.id} className="text-sm text-amber-800 dark:text-amber-300 italic pl-13">
              <Sparkles className="w-3 h-3 inline mr-1" />
              {item.reason}
            </div>
          ))}

          <Link href="/reviews">
            <Button className="w-full rounded-2xl bg-amber-600 hover:bg-amber-700 text-white gap-2 mt-2">
              <RotateCw className="w-4 h-4" />
              Revisar {pendingReviewsCount} card(s) agora
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
