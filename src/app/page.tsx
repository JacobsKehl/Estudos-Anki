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

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const userId = await getMockUserId();
  const now = new Date();

  // ─── 1. LOAD UNIFIED CARDS (needed for metrics and hero) ──────────────────
  const unifiedData = await getUnifiedTodayCards(userId);
  const { cards: todayCards, stats: todayStats } = unifiedData;

  // ─── 2. NEXT BEST ACTION (hero card) ──────────────────────────────────────
  let subjectsCount = 0;
  let materialsCount = 0;
  let blocksCount = 0;
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

    const unorganizedMaterial = await prisma.studyMaterial.findFirst({
      where: { userId, organizationStatus: { not: "ORGANIZED" } }
    });

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
  } catch (error) {
    console.error("Error loading metrics:", error);
  }

  // ─── 3. ESTUDO DO DIA (only theory blocks from schedule / queue) ──────────
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
        studyBlock: { 
          include: { 
            material: true,
            supportMaterials: {
              include: { material: true }
            },
            _count: {
              select: { flashcards: true }
            }
          } 
        },
      },
      orderBy: { priorityScore: "desc" },
    });

    // Fallback to adaptive queue if no schedule
    if (todayItems.length === 0) {
      const queue = await getAdaptiveStudyQueue(userId, 2);
      for (const task of queue) {
        if (task.studyBlockId) {
          const block = await (prisma as any).studyBlock.findUnique({
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

      {/* ══ SEÇÃO 2: CARDS DO DIA ═══ unified: today contents + spaced review ══ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b-2 border-sage-light">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-5 bg-accent rounded-full" />
            <Sparkles className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Cards do Dia</h2>
          </div>
          <span className="text-[10px] text-muted-foreground/60 font-medium">Flashcards · Prática unificada</span>
        </div>

        {todayStats.total === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 space-y-3 border border-dashed border-border/50 rounded-2xl bg-muted/5">
            <Layers className="w-7 h-7 text-muted-foreground/25" />
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              Tudo em dia! Nenhum card para praticar agora.
            </p>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-white to-sage-light/5 border border-sage-light/60 rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-all duration-300">
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
                    <span className="flex items-center gap-1.5 bg-sage-light/20 text-accent px-2 py-0.5 rounded-md">
                      {todayStats.fromTodayBlocks} dos conteúdos de hoje
                    </span>
                  )}
                  {todayStats.fromSpacedReview > 0 && (
                    <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">
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
                      <Badge key={s} variant="outline" className="bg-white/80 text-[9px] font-bold uppercase tracking-wider px-2 py-0">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="shrink-0">
                <Button 
                  size="lg" 
                  className="rounded-2xl h-14 px-10 text-base font-black bg-accent text-white shadow-xl shadow-accent/20 hover:scale-105 transition-all gap-3"
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
    </div>
  );
}
