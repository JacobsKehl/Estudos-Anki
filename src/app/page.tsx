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

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const userId = await getMockUserId();
  const now = new Date();

  // ─── 1. NEXT BEST ACTION (hero card) ──────────────────────────────────────
  let subjectsCount = 0;
  let materialsCount = 0;
  let blocksCount = 0;
  let pendingReviewsCount = 0;
  let nextAction = {
    type: "DASHBOARD",
    title: "Tudo pronto",
    description: "Vamos começar a estudar.",
    cta: "Ver Matérias",
    href: "/subjects",
  };

  try {
    subjectsCount = await prisma.studySubject.count({ where: { userId } });
    materialsCount = await prisma.studyMaterial.count({ where: { userId } } as any);
    blocksCount = await (prisma as any).studyBlock.count({ where: { userId } });

    pendingReviewsCount = await (prisma as any).flashcard.count({
      where: {
        userId,
        status: "APPROVED",
        nextReviewAt: { lte: now },
        reviewState: { in: ["LEARNING", "REVIEW", "RELEARNING"] }
      }
    });

    const unorganizedMaterial = await prisma.studyMaterial.findFirst({
      where: { userId, organizationStatus: { not: "ORGANIZED" } }
    });

    if (materialsCount === 0) {
      nextAction = { type: "NO_MATERIALS", title: "Importe seus PDFs", description: "Coloque seus arquivos na pasta local e importe-os para a Biblioteca.", cta: "Ir para Biblioteca", href: "/materials" };
    } else if (unorganizedMaterial) {
      nextAction = { type: "NEEDS_ORGANIZATION", title: "Organize seus Estudos", description: "Você tem PDFs aguardando a IA. Organize-os para atualizar seu roteiro.", cta: "Ir para Biblioteca", href: "/materials" };
    } else if (blocksCount === 0) {
      nextAction = { type: "NO_BLOCKS", title: "Crie Matérias", description: "Organize seus PDFs em matérias para gerar os blocos de estudo.", cta: "Ver Matérias", href: "/subjects" };
    } else if (pendingReviewsCount > 0) {
      nextAction = { type: "REVIEW", title: "Hora da Revisão", description: `Você tem ${pendingReviewsCount} flashcards prontos para revisar hoje.`, cta: "Iniciar Revisão", href: "/reviews/session" };
    } else {

      nextAction = { type: "STUDY_TODAY", title: "Foco no Estudo", description: "Siga as tarefas recomendadas abaixo para avançar no seu aprendizado.", cta: "Ver Matérias", href: "/subjects" };
    }
  } catch (error) {
    console.error("Error loading metrics:", error);
  }

  // ─── 2. ESTUDO DO DIA (only theory blocks from schedule / queue) ──────────
  let todayItems: any[] = [];

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    todayItems = await (prisma as any).studyScheduleItem.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        schedule: { status: "ACTIVE" },
        scheduledDate: { gte: todayStart, lt: todayEnd },
      },
      include: {
        subject: true,
        studyBlock: { include: { material: true } },
      },
      orderBy: { priorityScore: "desc" },
    });

    // Fallback to adaptive queue if no schedule
    if (todayItems.length === 0) {
      const queue = await getAdaptiveStudyQueue(userId, 5);
      for (const task of queue) {
        if (task.studyBlockId) {
          const block = await (prisma as any).studyBlock.findUnique({
            where: { id: task.studyBlockId },
            include: { material: true },
          });
          const subject = await prisma.studySubject.findUnique({ where: { id: task.subjectId } });
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
        }
      }
    }
  } catch (error) {
    console.error("Error loading today items:", error);
  }

  // ─── 3. CARDS DO DIA (NEW APPROVED cards from today's blocks) ─────────────
  let todayBlocksWithCards: any[] = [];

  try {
    const todayBlockIds = todayItems
      .filter(item => item.studyBlockId)
      .map(item => item.studyBlockId);

    // Priority: blocks that are in today's schedule
    if (todayBlockIds.length > 0) {
      const scheduledBlocks = await (prisma as any).studyBlock.findMany({
        where: { id: { in: todayBlockIds } },
        include: {
          subject: true,
          flashcards: {
            where: { status: "APPROVED", reviewState: "NEW" },
            select: { id: true }
          }
        }
      });
      todayBlocksWithCards = scheduledBlocks
        .filter((b: any) => b.flashcards.length > 0)
        .map((b: any) => ({
          id: b.id,
          title: b.title,
          subjectName: b.subject.name,
          newCards: b.flashcards.length,
        }));
    }

    // Fallback: all blocks with any NEW APPROVED cards (latest 5)
    if (todayBlocksWithCards.length === 0) {
      const allNew = await (prisma as any).studyBlock.findMany({
        where: { userId },
        include: {
          subject: true,
          flashcards: {
            where: { status: "APPROVED", reviewState: "NEW" },
            select: { id: true }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      todayBlocksWithCards = allNew
        .filter((b: any) => b.flashcards.length > 0)
        .map((b: any) => ({
          id: b.id,
          title: b.title,
          subjectName: b.subject.name,
          newCards: b.flashcards.length,
        }));
    }
  } catch (error) {
    console.error("Error loading today cards:", error);
  }

  // ─── 4. REVISÃO DE CARDS (overdue SRS: LEARNING / REVIEW / RELEARNING) ────
  const reviewStats = { total: 0, learning: 0, review: 0, relearning: 0 };

  try {
    const dueCards = await (prisma as any).flashcard.groupBy({
      by: ["reviewState"],
      where: {
        userId,
        status: "APPROVED",
        nextReviewAt: { lte: now },
        reviewState: { in: ["LEARNING", "REVIEW", "RELEARNING"] },
      },
      _count: { _all: true },
    });

    for (const group of dueCards) {
      const count = group._count._all;
      reviewStats.total += count;
      if (group.reviewState === "LEARNING") reviewStats.learning = count;
      if (group.reviewState === "REVIEW") reviewStats.review = count;
      if (group.reviewState === "RELEARNING") reviewStats.relearning = count;
    }
  } catch (error) {
    console.error("Error loading review stats:", error);
  }

  // Strict filter: only THEORY and REVIEW_BLOCK belong in "Estudo do Dia"
  const theoryTasks = todayItems.filter(item =>
    item.actionType === "THEORY" || item.actionType === "REVIEW_BLOCK"
  );
  const totalMinutes = theoryTasks.reduce((acc, i) => acc + (i.estimatedMinutes ?? 60), 0);

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

      {/* ── Hero: Próxima Ação ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-sage-light/50 to-sage-light/20 border border-sage-light/60 p-7 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <span className="inline-block bg-white/70 text-accent px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-accent/10">
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
            <Button className="w-full md:w-auto gap-2 px-7 rounded-xl h-11 text-sm font-bold transition-all hover:scale-105 bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20">
              {nextAction.cta}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ══ SEÇÃO 1: ESTUDO DO DIA ═══ teoria, blocos, PDF ═══════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b-2 border-blue-100">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-5 bg-blue-400 rounded-full" />
            <BookOpen className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Estudo do Dia</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/60 font-medium">Teoria · PDF · Blocos</span>
            {totalMinutes > 0 && (
              <Badge variant="outline" className="rounded-lg bg-blue-50 text-blue-600 border-blue-100 font-bold px-2.5 py-0.5 text-[10px]">
                ~{totalMinutes}m
              </Badge>
            )}
          </div>
        </div>

        {theoryTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 space-y-3 border border-dashed border-border/50 rounded-2xl bg-muted/5">
            <Calendar className="w-7 h-7 text-muted-foreground/25" />
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              Nenhum conteúdo agendado para hoje.
            </p>
            <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs" asChild>
              <Link href="/materials">Organizar materiais</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {theoryTasks.map((item, idx) => (
              <TodayTaskCard key={item.id} item={item} index={idx + 1} />
            ))}
          </div>
        )}
      </section>

      {/* ══ SEÇÃO 2: CARDS DO DIA ═══ flashcards dos blocos de hoje ══════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b-2 border-sage-light">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-5 bg-accent rounded-full" />
            <Sparkles className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Cards do Dia</h2>
          </div>
          <span className="text-[10px] text-muted-foreground/60 font-medium">Flashcards · Prática imediata</span>
        </div>

        {todayBlocksWithCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 space-y-3 border border-dashed border-border/50 rounded-2xl bg-muted/5">
            <Layers className="w-7 h-7 text-muted-foreground/25" />
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              Nenhum card disponível agora. Eles aparecem quando você organiza um material.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {todayBlocksWithCards.map((block) => (
              <div
                key={block.id}
                className="bg-card border border-border/40 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:shadow-md hover:border-accent/20 transition-all duration-200"
              >
                <div className="space-y-1">
                  <Badge
                    variant="outline"
                    className="bg-sage-light/30 text-accent border-none rounded-md text-[10px] uppercase font-bold tracking-widest"
                  >
                    {block.subjectName}
                  </Badge>
                  <h4 className="font-semibold text-sm leading-snug">{block.title}</h4>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-accent/70">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent/40" />
                    {block.newCards} {block.newCards === 1 ? "card novo" : "cards novos"}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-accent/20 text-accent hover:bg-accent/5 hover:border-accent/30 h-9 px-4 font-bold shrink-0 text-xs transition-all"
                  asChild
                >
                  <Link href={`/practice?blockId=${block.id}`}>
                    <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                    Praticar
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ══ SEÇÃO 3: REVISÃO DE CARDS ═══ cards antigos/vencidos pelo SRS ════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b-2 border-amber-100">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-5 bg-amber-400 rounded-full" />
            <RotateCw className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Revisão de Cards</h2>
          </div>
          <span className="text-[10px] text-muted-foreground/60 font-medium">Cards antigos · SRS</span>
        </div>

        {reviewStats.total === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 space-y-3 border border-dashed border-border/50 rounded-2xl bg-muted/5">
            <CheckCircle2 className="w-7 h-7 text-muted-foreground/25" />
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              Nenhuma revisão pendente. Seus cards voltarão aqui conforme o algoritmo.
            </p>
          </div>
        ) : (
          <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 space-y-4 text-center md:text-left w-full">
              <div>
                <p className="text-4xl font-black text-amber-600 tracking-tighter">{reviewStats.total}</p>
                <p className="text-[11px] font-bold text-amber-700/60 uppercase tracking-widest mt-1">
                  cards para revisar
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {reviewStats.learning > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/70 text-amber-700 rounded-lg px-3 py-1.5 border border-amber-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {reviewStats.learning} aprendendo
                  </span>
                )}
                {reviewStats.review > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/70 text-emerald-700 rounded-lg px-3 py-1.5 border border-emerald-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {reviewStats.review} em revisão
                  </span>
                )}
                {reviewStats.relearning > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/70 text-red-700 rounded-lg px-3 py-1.5 border border-red-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    {reviewStats.relearning} reaprendendo
                  </span>
                )}
              </div>

              <Button size="lg" className="rounded-xl h-11 px-7 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-200 w-full sm:w-auto transition-all hover:scale-[1.02]" asChild>
                <Link href="/reviews/session" className="gap-2">
                  <RotateCw className="w-4 h-4" />
                  Iniciar Revisão
                </Link>
              </Button>

            </div>

            <div className="w-20 h-20 bg-white/60 rounded-full flex items-center justify-center relative shadow-inner shrink-0">
              <RotateCw className="w-10 h-10 text-amber-300/50 animate-[spin_12s_linear_infinite]" />
              <BrainCircuit className="w-6 h-6 text-amber-500 absolute" />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
