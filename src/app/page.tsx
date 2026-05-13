/* eslint-disable @typescript-eslint/no-explicit-any */
import { 
  BookOpen, 
  CheckCircle2, 
  ArrowRight,
  BrainCircuit,
  Layers,
  Blocks,
  RotateCw,
  Play,
  Calendar,
  Plus,
  Upload,
  TrendingUp,
  Sparkles,
  Clock,
  BookMarked,
  Import
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TODAY_SCHEDULE } from "@/lib/mocks";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getAllSubjectsMetrics } from "@/lib/services/subject-metrics";
import { Logo } from "@/components/ui/logo";

export default async function Dashboard() {
  const userId = "cm39k012x0001k93jqwerty12"; // Mock user for MVP

  let subjectsCount = 0;
  let materialsCount = 0;
  let blocksCount = 0;
  let subjects: any[] = [];
  let scheduleProgress = 0;
  let pendingReviewsCount = 0;

  try {
    subjectsCount = await prisma.studySubject.count({ where: { userId } });
    materialsCount = await prisma.studyMaterial.count({ where: { userId } } as any);
    blocksCount = await (prisma as any).studyBlock.count({ where: { userId } });

    const subjectsWithMetrics = await getAllSubjectsMetrics(userId);
    
    // Sort for the dashboard: Critical/Attention first
    subjects = [...subjectsWithMetrics]
      .sort((a, b) => {
        const score = { CRITICAL: 0, ATTENTION: 1, GOOD: 2, EXCELLENT: 3 };
        return (score[a.metrics.health as keyof typeof score] ?? 2) - (score[b.metrics.health as keyof typeof score] ?? 2);
      })
      .slice(0, 4);

    // Flashcard reviews
    pendingReviewsCount = await (prisma as any).flashcard.count({
      where: { 
        userId, 
        status: "APPROVED",
        nextReviewAt: { lte: new Date() }
      }
    });

    // Current Study Item
    const currentStudyItem = await (prisma as any).studyScheduleItem.findFirst({
      where: {
        userId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        schedule: { status: "ACTIVE" }
      },
      include: {
        subject: true,
        studyBlock: true
      },
      orderBy: { dayNumber: "asc" }
    });

    // Schedule Progress
    const totalScheduleItems = await (prisma as any).studyScheduleItem.count({
      where: { userId, schedule: { status: "ACTIVE" } }
    });
    const completedScheduleItems = await (prisma as any).studyScheduleItem.count({
      where: { userId, status: "COMPLETED", schedule: { status: "ACTIVE" } }
    });
    scheduleProgress = totalScheduleItems > 0 ? (completedScheduleItems / totalScheduleItems) * 100 : 0;

    // --- NEXT BEST ACTION LOGIC ---
    let nextAction = {
      type: "DASHBOARD",
      title: "Foco no Progresso",
      description: "Você está no caminho certo. Vamos continuar estudando?",
      cta: "Explorar Matérias",
      href: "/subjects",
      icon: "BrainCircuit"
    };

    if (subjectsCount === 0) {
      nextAction = {
        type: "NO_SUBJECTS",
        title: "Comece sua Jornada",
        description: "Você ainda não tem matérias. Crie sua primeira disciplina para organizar seus materiais.",
        cta: "Criar Minha Primeira Matéria",
        href: "/subjects",
        icon: "Plus"
      };
    } else {
      // Check for materials needing organization
      const unorganizedMaterial = await prisma.studyMaterial.findFirst({
        where: { userId, organizationStatus: { not: "ORGANIZED" } }
      });

      if (materialsCount === 0) {
        nextAction = {
          type: "NO_MATERIALS",
          title: "Importe seus Materiais",
          description: "Sua jornada começa aqui. Busque os PDFs na sua pasta local para que o Kehl possa organizar tudo.",
          cta: "Ir para Biblioteca de PDFs",
          href: "/materials",
          icon: "Import"
        };
      } else if (unorganizedMaterial) {
        nextAction = {
          type: "NEEDS_ORGANIZATION",
          title: "Organize seus Estudos",
          description: "Você tem novos materiais importados! Vamos usar a IA para fatiar o conteúdo e atualizar seu cronograma?",
          cta: "Organizar meus estudos",
          href: "/materials",
          icon: "Sparkles"
        };
      } else if (blocksCount === 0) {
        nextAction = {
          type: "NO_BLOCKS",
          title: "Prepare seu Cronograma",
          description: "Materiais importados e analisados! Agora, vamos ver o que estudar primeiro?",
          cta: "Ver Matérias",
          href: "/subjects",
          icon: "BookMarked"
        };
      } else {
        const schedule = await (prisma as any).studySchedule.findFirst({
          where: { userId, status: "ACTIVE" }
        });
        if (!schedule) {
          nextAction = {
            type: "NO_SCHEDULE",
            title: "Organize seu Tempo",
            description: "Seus blocos estão prontos. Vamos gerar um cronograma automático para você?",
            cta: "Gerar Meu Cronograma",
            href: "/schedule",
            icon: "Calendar"
          };
        } else if (currentStudyItem) {
          nextAction = {
            type: "STUDY_TODAY",
            title: currentStudyItem.studyBlock.title,
            description: `Hoje é dia de estudar ${currentStudyItem.subject.name}. Faltam ${Math.round(currentStudyItem.estimatedMinutes)} minutos para concluir a meta.`,
            cta: "Começar Estudo de Hoje",
            href: "/today",
            icon: "Play"
          };
        } else {
          const pendingApprovalCards = await (prisma as any).flashcard.count({
            where: { userId, status: "PENDING_APPROVAL" }
          });
          if (pendingApprovalCards > 0) {
            nextAction = {
              type: "CURATION",
              title: "Refine seus Flashcards",
              description: `Você tem ${pendingApprovalCards} flashcards gerados pela IA aguardando sua aprovação.`,
              cta: "Revisar Flashcards Novos",
              href: "/flashcards",
              icon: "CheckCircle2"
            };
          } else if (pendingReviewsCount > 0) {
            nextAction = {
              type: "REVIEW",
              title: "Consolide o Aprendizado",
              description: `Você tem ${pendingReviewsCount} flashcards prontos para revisão. Não deixe o conhecimento escapar!`,
              cta: "Iniciar Revisão Diária",
              href: "/reviews",
              icon: "RotateCw"
            };
          } else {
            nextAction = {
              type: "ALL_DONE",
              title: "Tudo em Dia!",
              description: "Você concluiu todas as suas metas de hoje. Que tal avançar um pouco mais?",
              cta: "Ver Meu Progresso",
              href: "/subjects",
              icon: "TrendingUp"
            };
          }
        }
      }
    }

    return (
      <div className="space-y-10 max-w-6xl animate-in fade-in duration-700 slide-in-from-bottom-4 pb-20">
        {/* Hero / Next Best Action */}
        <section className="relative overflow-hidden rounded-3xl md:rounded-[2.5rem] border-none bg-sage-light/40 p-6 md:p-12 shadow-sm">
          <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="space-y-4">
              <Badge variant="secondary" className="mb-2 bg-white/60 backdrop-blur-sm text-accent px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider">
                Próximo Passo
              </Badge>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-5xl max-w-xl leading-[1.2] md:leading-[1.1]">
                {nextAction.title}
              </h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-lg leading-relaxed">
                {nextAction.description}
              </p>
              <div className="flex flex-wrap gap-4 pt-2 md:pt-4">
                <Link href={nextAction.href} className="w-full md:w-auto">
                  <Button className="w-full md:w-auto gap-2 px-8 rounded-2xl shadow-xl shadow-accent/20 h-12 md:h-14 text-base md:text-lg transition-transform hover:scale-[1.02]">
                    {nextAction.cta}
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="hidden lg:block opacity-40 transform rotate-12 transition-all hover:rotate-6 hover:scale-105 duration-700 bg-white/10 backdrop-blur-sm p-12 rounded-[4rem] shadow-2xl border border-white/20">
              <Logo size={220} className="filter drop-shadow-2xl" />
            </div>
          </div>
        </section>

        {/* Quick Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Matérias", value: subjectsCount, icon: BookOpen, sub: "disciplinas ativas", href: "/subjects" },
            { label: "Materiais", value: materialsCount, icon: Layers, sub: "pdfs vinculados", href: "/materials" },
            { label: "Blocos", value: blocksCount, icon: Blocks, sub: "fatias de conteúdo", href: "/blocks" },
            { label: "Progresso", value: `${Math.round(scheduleProgress)}%`, icon: CheckCircle2, sub: "do plano concluído", href: "/schedule" },
          ].map((stat, i) => (
            <Link key={i} href={stat.href}>
              <Card className="hover:border-accent/50 hover:shadow-md transition-all cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-accent" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Study Plan Timeline */}
          <Card className="lg:col-span-2 rounded-[2rem] border-border/40 shadow-sm overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Cronograma do Dia</CardTitle>
                <Link href="/schedule">
                  <Button variant="ghost" size="sm" className="text-xs">
                    Ver completo
                  </Button>
                </Link>
              </div>
              <CardDescription>Siga seu roteiro de estudos personalizado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8 relative before:absolute before:left-[17px] before:top-2 before:h-[calc(100%-16px)] before:w-[1px] before:bg-border">
                {TODAY_SCHEDULE.map((item) => (
                  <div key={item.id} className="relative flex gap-6 pl-10">
                    <div className={cn(
                      "absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border bg-background z-10",
                      item.status === "COMPLETED" ? "border-green-500 text-green-500" : 
                      item.status === "CURRENT" ? "border-accent text-accent animate-pulse" : "border-border text-muted-foreground"
                    )}>
                      {item.status === "COMPLETED" ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{item.topic}</p>
                        <span className="text-xs font-medium text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-sm">
                          {item.time}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {item.subject}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Subjects Health Progress */}
          <div className="space-y-6">
            <Card className="rounded-[2rem] border-border/40 shadow-sm overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-accent" />
                  <CardTitle className="text-lg">Saúde das Matérias</CardTitle>
                </div>
                <CardDescription>Onde focar seus esforços</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {subjects.length === 0 ? (
                  <div className="text-sm text-center text-muted-foreground py-8 border border-dashed rounded-[1.5rem]">
                    Nenhuma matéria cadastrada.
                  </div>
                ) : (
                  subjects.map((s) => (
                    <Link key={s.id} href={`/subjects/${s.id}`} className="block group">
                      <div className="space-y-2 p-3 rounded-2xl hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold group-hover:text-accent transition-colors">{s.name}</span>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-widest",
                              s.metrics.health === 'CRITICAL' ? "bg-red-100 text-red-700" :
                              s.metrics.health === 'ATTENTION' ? "bg-orange-100 text-orange-700" :
                              s.metrics.health === 'GOOD' ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                            )}>
                              {s.metrics.health === 'CRITICAL' ? 'Crítica' : 
                               s.metrics.health === 'ATTENTION' ? 'Atenção' : 
                               s.metrics.health === 'GOOD' ? 'Boa' : 'Excelente'}
                            </span>
                            <span className="text-muted-foreground font-medium">{s.metrics.progress}%</span>
                          </div>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full transition-all duration-700",
                              s.metrics.health === 'CRITICAL' ? "bg-red-400" :
                              s.metrics.health === 'ATTENTION' ? "bg-orange-400" :
                              "bg-accent"
                            )}
                            style={{ width: `${s.metrics.progress}%` }}
                          />
                        </div>
                        {s.metrics.dueReviews > 0 && (
                          <p className="text-[10px] text-orange-600 font-bold flex items-center gap-1">
                            <RotateCw className="w-2 h-2" />
                            {s.metrics.dueReviews} revisões pendentes
                          </p>
                        )}
                      </div>
                    </Link>
                  ))
                )}
                
                <Link href="/subjects" className="w-full mt-2 inline-block">
                  <Button variant="outline" className="w-full rounded-xl border-border/50 text-muted-foreground hover:text-foreground" size="sm">
                    Ver Todas as Matérias
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-accent to-[#6a8455] text-accent-foreground border-none rounded-2xl shadow-lg shadow-accent/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Logo size={20} className="opacity-90 invert brightness-0" />
                  Dica de Foco
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm opacity-95 leading-relaxed text-white">
                  &quot;O cérebro aprende melhor em blocos de 25-50 minutos. Faça uma pausa de 5 minutos agora para consolidar o que acabou de ler.&quot;
                </p>
                <Button variant="ghost" className="text-xs text-white hover:bg-white/20 hover:text-white px-3 h-8 rounded-xl w-full">
                  Ver mais dicas
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Dashboard Error:", error);
    return (
      <div className="p-10 text-center">
        <h2 className="text-xl font-bold">Erro ao carregar dashboard</h2>
        <p className="text-muted-foreground">Tente atualizar a página.</p>
      </div>
    );
  }
}
