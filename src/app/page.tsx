/* eslint-disable @typescript-eslint/no-explicit-any */
import { 
  CheckCircle2, 
  ArrowRight,
  BrainCircuit,
  RotateCw,
  Play,
  BookOpen,
  Sparkles,
  Target,
  Layers,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import Link from "next/link";
import { TodayTaskCard } from "@/components/today/TodayTaskCard";
import { getAdaptiveStudyQueue } from "@/lib/recommendations/adaptive-scheduler";
import { PageHeader } from "@/components/ui/page-header";
import { getUnifiedTodayCards } from "@/lib/srs/srs-utils";
import { reorganizeOverdueSchedule } from "@/lib/scheduler";
import { DailyGoalAlert } from "@/components/today/DailyGoalAlert";
import { NextDayStudySession } from "@/components/today/NextDayStudySession";
import { getTodayRangeSP } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const userId = await getMockUserId();
  const now = new Date();

  // ─── PARALLEL INITIAL QUERIES ─────────────────────────────────────────────
  const todayRange = getTodayRangeSP(now);
  const todayStart = todayRange.start;
  const todayEnd = todayRange.end;

  let unifiedData;
  let subjectsCount = 0;
  let materialsCount = 0;
  let blocksCount = 0;
  let unorganizedMaterial = null;
  let hasPastPending = null;
  let initialTodayItems: any[] = [];
  let activeSchedule = null;
  let reorganizedToday = false;

  try {
    const [
      unifiedDataRes,
      subjectsCountRes,
      materialsCountRes,
      blocksCountRes,
      unorganizedMaterialRes,
      hasPastPendingRes,
      todayItemsRes,
      activeScheduleRes
    ] = await Promise.all([
      getUnifiedTodayCards(userId),
      prisma.studySubject.count({ where: { userId } }),
      prisma.studyMaterial.count({ where: { userId } } as any),
      (prisma as any).studyBlock.count({ where: { userId } }),
      prisma.studyMaterial.findFirst({
        where: { userId, organizationStatus: { not: "ORGANIZED" } }
      }),
      (prisma as any).studyScheduleItem.findFirst({
        where: {
          userId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          schedule: { status: "ACTIVE" },
          scheduledDate: { lt: todayStart }
        }
      }),
      (prisma as any).studyScheduleItem.findMany({
        where: {
          userId,
          schedule: { status: "ACTIVE" },
          scheduledDate: { gte: todayStart, lt: todayEnd },
        },
        include: {
          subject: true,
          studyBlock: { 
            include: { 
              material: true,
              supportMaterials: {
                include: { material: true }
              },
              _count: {
                select: { flashcards: true }
              },
              flashcards: {
                where: {
                  status: "APPROVED",
                  reviewState: { in: ["NEW", "LEARNING", "REVIEW", "RELEARNING"] }
                },
                select: { id: true }
              }
            } 
          },
        },
        orderBy: { priorityScore: "desc" },
      }),
      (prisma as any).studySchedule.findFirst({
        where: { userId, status: "ACTIVE" }
      })
    ]);

    unifiedData = unifiedDataRes;
    subjectsCount = subjectsCountRes;
    materialsCount = materialsCountRes;
    blocksCount = blocksCountRes;
    unorganizedMaterial = unorganizedMaterialRes;
    hasPastPending = hasPastPendingRes;
    initialTodayItems = todayItemsRes;
    activeSchedule = activeScheduleRes;
  } catch (error) {
    console.error("Error loading dashboard pre-fetch:", error);
    // Fallback if anything fails
    unifiedData = await getUnifiedTodayCards(userId);
  }

  const { stats: todayStats } = unifiedData;

  // ─── NEXT BEST ACTION (hero card) ──────────────────────────────────────
  let nextAction = {
    type: "DASHBOARD",
    title: "Tudo pronto",
    description: "Vamos começar a estudar.",
    cta: "Ver Matérias",
    href: "/subjects",
  };

  if (materialsCount === 0) {
    nextAction = { type: "NO_MATERIALS", title: "Suba seus PDFs", description: "Envie seus arquivos para a nuvem para começar a organizar seus estudos com IA.", cta: "Ir para Biblioteca", href: "/materials" };
  } else if (unorganizedMaterial) {
    nextAction = { type: "NEEDS_ORGANIZATION", title: "Organize seus Estudos", description: "Você tem PDFs aguardando a IA. Organize-os para atualizar seu roteiro.", cta: "Ir para Biblioteca", href: "/materials" };
  } else if (blocksCount === 0) {
    nextAction = { type: "NO_BLOCKS", title: "Crie Matérias", description: "Organize seus PDFs em matérias para gerar os blocos de estudo.", cta: "Ver Matérias", href: "/subjects" };
  } else if (todayStats.total > 0) {
    nextAction = { type: "REVIEW", title: "Cards do Dia", description: `Você tem ${todayStats.total} flashcards para praticar hoje.`, cta: "Iniciar Revisão", href: "/practice?source=today" };
  } else {
    nextAction = { type: "STUDY_TODAY", title: "Foco no Estudo", description: "Siga as tarefas recomendadas abaixo para avançar no seu aprendizado.", cta: "Ver Matérias", href: "/subjects" };
  }

  // ─── ESTUDO DO DIA (only theory blocks from schedule / queue) ──────────
  let todayItems: any[] = [];

  try {
    // reorganizedToday will only be set to true if a rollover actually takes place and makes changes.

    let shouldReorganize = false;
    if (hasPastPending) {
      if (activeSchedule) {
        const scheduleTodayStr = getTodayRangeSP(activeSchedule.updatedAt).dateString;
        const todayStr = todayRange.dateString;
        if (scheduleTodayStr !== todayStr) {
          shouldReorganize = true;
        } else {
          console.log(`[Dashboard] Skip auto-reorganization: already ran today (${todayStr})`);
        }
      } else {
        shouldReorganize = true;
      }
    }

    if (shouldReorganize) {
      console.log("Auto-reorganizando cronograma devido a tarefas pendentes no passado (primeiro carregamento do dia)...");
      const rolloverResult = await reorganizeOverdueSchedule(userId, false, false, now);
      if (rolloverResult.success && rolloverResult.changes.length > 0) {
        reorganizedToday = true;
      }
      
      // Re-fetch since it has been reorganized
      todayItems = await (prisma as any).studyScheduleItem.findMany({
        where: {
          userId,
          schedule: { status: "ACTIVE" },
          scheduledDate: { gte: todayStart, lt: todayEnd },
        },
        include: {
          subject: true,
          studyBlock: { 
            include: { 
              material: true,
              supportMaterials: {
                include: { material: true }
              },
              _count: {
                select: { flashcards: true }
              },
              flashcards: {
                where: {
                  status: "APPROVED",
                  reviewState: { in: ["NEW", "LEARNING", "REVIEW", "RELEARNING"] }
                },
                select: { id: true }
              }
            } 
          },
        },
        orderBy: { priorityScore: "desc" },
      });
    } else {
      todayItems = initialTodayItems;
    }

    // Fallback to adaptive queue if no schedule
    if (todayItems.length === 0) {
      const queue = await getAdaptiveStudyQueue(userId, 2);
      const queueItemsDetails = await Promise.all(
        queue.map(async (task) => {
          if (!task.studyBlockId) return null;
          const [block, subject] = await Promise.all([
            (prisma as any).studyBlock.findUnique({
              where: { id: task.studyBlockId },
              include: { 
                material: true,
                supportMaterials: {
                  include: { material: true }
                },
                _count: {
                  select: { flashcards: true }
                }
              },
            }),
            prisma.studySubject.findUnique({ where: { id: task.subjectId } })
          ]);
          return { task, block, subject };
        })
      );

      for (const details of queueItemsDetails) {
        if (details && details.block && details.subject) {
          const { task, block, subject } = details;
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
      }
    }
  } catch (error) {
    console.error("Error loading today items:", error);
  }

  // Separate tasks: only THEORY blocks represent the main study session, while REVIEW_BLOCK with active flashcards represents content reviews.
  const studyTasks = todayItems.filter(item => item.actionType === "THEORY");

  const reviewTasks = todayItems.filter(item => {
    if (item.actionType === "REVIEW_BLOCK") {
      const activeCards = item.studyBlock?.flashcards || [];
      return activeCards.length > 0;
    }
    return false;
  });
  
  const pendingStudyTasks = studyTasks.filter(item =>
    item.status === "PENDING" || item.status === "IN_PROGRESS"
  );

  const completedStudyTasks = studyTasks.filter(item =>
    item.status === "COMPLETED"
  );

  const pendingReviewTasks = reviewTasks.filter(item =>
    item.status === "PENDING" || item.status === "IN_PROGRESS"
  );

  const completedMinutes = completedStudyTasks.reduce((acc, i) => acc + (i.estimatedMinutes ?? 60), 0);
  const totalMinutes = studyTasks.reduce((acc, i) => acc + (i.estimatedMinutes ?? 60), 0);

  const isDayCompleted = studyTasks.length === 0 && reviewTasks.length === 0 && todayStats.total === 0;

  return (
    <div className="space-y-10 max-w-4xl mx-auto animate-in fade-in duration-700 slide-in-from-bottom-4 pb-24">
      <PageHeader
        icon={Target}
        title="Estudo de Hoje"
        description="Foque apenas no que importa agora."
      >
        <Link href="/schedule">
          <Button variant="outline" className="rounded-xl h-10 px-4 text-xs font-bold uppercase tracking-wider">
            Ver Roteiro Completo
          </Button>
        </Link>
      </PageHeader>

      {reorganizedToday && (
        <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/5 dark:to-emerald-950/10 border border-emerald-500/20 dark:border-emerald-500/10 rounded-2xl p-4 flex items-start gap-3.5 shadow-sm animate-in fade-in slide-in-from-top-3 duration-500">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
              Cronograma Reorganizado
            </h4>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 leading-relaxed">
              Suas pendências do passado foram realocadas automaticamente para hoje e o cronograma futuro foi reajustado de forma fluida para manter seu ritmo de estudos em dia!
            </p>
          </div>
        </div>
      )}

      {isDayCompleted ? (
        <NextDayStudySession userId={userId} />
      ) : (
        <>
          {/* ── Hero: Próxima Ação ─────────────────────────────────────────────── */}
          <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-sage-light/50 to-sage-light/20 dark:from-accent/10 dark:to-accent/5 border border-sage-light/60 dark:border-accent/15 p-7 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <span className="inline-block bg-white/70 dark:bg-accent/15 text-accent px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-accent/10 dark:border-accent/20">
              Próxima Ação
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl max-w-xl">
              {nextAction.title}
            </h1>
            <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
              {nextAction.description}
            </p>
          </div>
          <Link href={nextAction.href}>
            <Button variant="primary" size="md" className="w-full md:w-auto gap-2 px-7 rounded-xl font-bold transition-all hover:scale-105 shadow-lg shadow-accent/20">
              {nextAction.cta}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Daily progress against minutes target */}
      <DailyGoalAlert completedMinutes={completedMinutes} totalMinutes={totalMinutes} />

      {/* ══ SEÇÃO 1: ESTUDO DO DIA ═══ teoria, PDF ═══════════════════════════ */}
      <section className="space-y-4">
        <div className="flex flex-col gap-1 pb-3 border-b-2 border-sage-light/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-5 bg-accent rounded-full" />
              <BookOpen className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Estudo do Dia</h2>
            </div>
            <div className="flex items-center gap-2">
              {totalMinutes > 0 && (
                <Badge variant="outline" className="rounded-lg bg-sage-light/20 text-accent border-sage-light/40 font-bold px-2.5 py-0.5 text-[10px]">
                  ~{totalMinutes}m
                </Badge>
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/80 font-medium">
            Conteúdos principais para avançar no cronograma.
          </p>
        </div>

        {studyTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 space-y-3 border border-dashed border-border/50 rounded-2xl bg-muted/5">
            <Calendar className="w-7 h-7 text-muted-foreground/25" />
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              Nenhum conteúdo teórico pendente para hoje.
            </p>
            <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs" asChild>
              <Link href="/materials">Organizar materiais</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {studyTasks.map((item, idx) => (
              <TodayTaskCard key={item.id} item={item} index={idx + 1} variant="study" />
            ))}
          </div>
        )}
      </section>

      {/* ══ SEÇÃO 2: REVISÕES DE CONTEÚDO ═══ checklist compacto ═══════════════ */}
      {reviewTasks.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col gap-1 pb-3 border-b-2 border-sage-light/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-5 bg-accent rounded-full" />
                <RotateCw className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Revisões de Conteúdo</h2>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/80 font-medium">
              Materiais de apoio relacionados aos cards ainda ativos.
            </p>
          </div>

          <div className="space-y-3">
            {reviewTasks.map((item, idx) => (
              <TodayTaskCard key={item.id} item={item} index={idx + 1} variant="review" />
            ))}
          </div>
        </section>
      )}

      {/* ══ SEÇÃO 3: CARDS DO DIA ═══ unified: today contents + spaced review ══ */}
      <section className="space-y-4">
        <div className="flex flex-col gap-1 pb-3 border-b-2 border-sage-light">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-5 bg-accent rounded-full" />
              <Sparkles className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Cards do Dia</h2>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/80 font-medium">
            Flashcards novos e revisões espaçadas para praticar.
          </p>
        </div>

        {todayStats.total === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 space-y-3 border border-dashed border-border/50 rounded-2xl bg-muted/5">
            <Layers className="w-7 h-7 text-muted-foreground/25" />
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              Tudo em dia! Nenhum card para praticar agora.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-card border border-sage-light/60 dark:border-accent/15 rounded-[2rem] p-8 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:shadow-md transition-shadow duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="space-y-5 flex-1">
                <div className="space-y-1">
                  <p className="text-4xl font-black text-accent tracking-tighter">{todayStats.total}</p>
                  <p className="text-xs font-bold text-accent/60 uppercase tracking-widest">
                    cards para praticar hoje
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-bold text-muted-foreground/70">
                  {todayStats.fromTodayBlocks > 0 && (
                    <span className="flex items-center gap-1.5 bg-sage-light/20 dark:bg-accent/10 text-accent px-2 py-0.5 rounded-md">
                      {todayStats.fromTodayBlocks} dos conteúdos de hoje
                    </span>
                  )}
                  {todayStats.fromSpacedReview > 0 && (
                    <span className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md">
                      {todayStats.fromSpacedReview} de revisão espaçada
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  {todayStats.breakdown.new > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      <span className="text-xs font-bold text-foreground/70">{todayStats.breakdown.new} novos</span>
                    </div>
                  )}
                  {todayStats.breakdown.learning > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-xs font-bold text-foreground/70">{todayStats.breakdown.learning} aprendendo</span>
                    </div>
                  )}
                  {(todayStats.breakdown.review > 0 || todayStats.breakdown.relearning > 0) && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-foreground/70">{todayStats.breakdown.review + todayStats.breakdown.relearning} revisões</span>
                    </div>
                  )}
                </div>

                {(todayStats.subjects as string[]).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(todayStats.subjects as string[]).map((s: string) => (
                      <Badge key={s} variant="outline" className="bg-white/80 dark:bg-white/5 dark:border-border/40 dark:text-muted-foreground text-[9px] font-bold uppercase tracking-wider px-2 py-0">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="shrink-0">
                <Button 
                  variant="primary"
                  size="lg" 
                  className="rounded-2xl px-10 font-black shadow-xl shadow-accent/20 dark:shadow-accent/10 hover:scale-105 transition-all gap-3"
                  asChild
                >
                  <Link href="/practice?source=today">
                    <Play className="w-5 h-5 fill-current" />
                    Praticar Cards do Dia
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Next Day Advancement section if today's study tasks are completed */}
      {studyTasks.length > 0 && pendingStudyTasks.length === 0 && (
        <div className="pt-6 border-t border-sage-light/60 dark:border-accent/15">
          <NextDayStudySession userId={userId} />
        </div>
      )}
      </>
      )}
    </div>
  );
}
