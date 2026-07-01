/* eslint-disable @typescript-eslint/no-explicit-any */
export const dynamic = "force-dynamic";
import { Calendar, Layers, CheckCircle2, Clock, Play } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getMockUserId } from "@/lib/auth-mock";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { GenerateScheduleCTA } from "@/components/schedule/GenerateScheduleCTA";
import { PageHeader } from "@/components/ui/page-header";
import { ReorganizeScheduleButton } from "@/components/schedule/ReorganizeScheduleButton";
import { reorganizeActiveSchedule } from "@/lib/scheduler";
import { ActivateSecondaryModal } from "@/components/schedule/ActivateSecondaryModal";

export default async function SchedulePage() {
  const mockUserId = await getMockUserId();
  let schedule: any = null;
  
  // ─── 1. FETCH PREFERENCES, SUBJECTS, AND BLOCKS ───
  let dailyGoalMinutes = 120;
  let primarySubjects: any[] = [];
  let activeSecondarySubjects: any[] = [];
  let secondarySubjects: any[] = [];
  let excludedSubjects: any[] = [];
  
  let remainingDays = 0;
  let totalRequiredHours = 0;
  let totalAvailableTheoryHours = 0;
  let isViable = true;
  let deficitHours = 0;
  let suggestedDailyGoal = 120;
  let dailyTheoryMinutes = 90;
  let deadlineStr = "";
  let isDefaultDeadline = false;

  try {
    const userPrefs = await prisma.userPreferences.findUnique({
      where: { userId: mockUserId }
    });
    dailyGoalMinutes = userPrefs?.dailyGoalMinutes || 120;
    dailyTheoryMinutes = dailyGoalMinutes - 30; // 30 mins SRS

    const subjects = await prisma.studySubject.findMany({
      where: { userId: mockUserId },
      orderBy: { name: "asc" }
    });

    primarySubjects = subjects.filter(s => s.studyPriority === "PRIMARY");
    activeSecondarySubjects = subjects.filter(s => s.studyPriority === "ACTIVE");
    secondarySubjects = subjects.filter(s => s.studyPriority === "SECONDARY");
    excludedSubjects = subjects.filter(s => s.studyPriority === "EXCLUDED");

    // Obter deadline das preferências do usuário ou usar fallback de 30 dias
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let deadline = userPrefs?.deadline ? new Date(userPrefs.deadline) : null;
    
    if (!deadline) {
      deadline = new Date(today);
      deadline.setDate(today.getDate() + 30);
      deadline.setHours(23, 59, 59, 999);
      isDefaultDeadline = true;
    }

    deadlineStr = `${String(deadline.getDate()).padStart(2, "0")}/${String(deadline.getMonth() + 1).padStart(2, "0")}/${deadline.getFullYear()}`;
    
    if (today < deadline) {
      const diffTime = deadline.getTime() - today.getTime();
      remainingDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    const totalAvailableTheoryMinutes = remainingDays * dailyTheoryMinutes;
    totalAvailableTheoryHours = Math.ceil(totalAvailableTheoryMinutes / 60);

    // Blocos pendentes teóricos (ignora materiais de apoio) das matérias PRIMARY e ACTIVE
    const activeSubjectIds = [...primarySubjects, ...activeSecondarySubjects].map(s => s.id);
    const pendingBlocks = await prisma.studyBlock.findMany({
      where: {
        userId: mockUserId,
        subjectId: { in: activeSubjectIds },
        status: { not: "COMPLETED" },
        material: {
          materialRole: { not: "SUPPORT_MATERIAL" }
        }
      },
      include: {
        subject: { select: { name: true } }
      }
    });

    let totalRequiredMinutes = 0;
    for (const block of pendingBlocks) {
      if (block.estimatedStudyMinutes && block.estimatedStudyMinutes > 0) {
        totalRequiredMinutes += block.estimatedStudyMinutes;
      } else {
        const pageCount = block.pageEnd - block.pageStart + 1;
        const isDense = ["direito", "processo", "processual", "regimento", "deficiência", "legislação"].some(k => block.subject.name.toLowerCase().includes(k));
        const minPerPage = isDense ? 4 : 3;
        totalRequiredMinutes += pageCount * minPerPage;
      }
    }

    totalRequiredHours = Math.ceil(totalRequiredMinutes / 60);
    isViable = totalRequiredMinutes <= totalAvailableTheoryMinutes;

    if (!isViable) {
      const deficitMinutes = totalRequiredMinutes - totalAvailableTheoryMinutes;
      deficitHours = Math.ceil(deficitMinutes / 60);

      if (remainingDays > 0) {
        const neededDailyTheory = Math.ceil(totalRequiredMinutes / remainingDays);
        suggestedDailyGoal = neededDailyTheory + 30; // +30 srs
      }
    }
  } catch (error) {
    console.error("Failed to calculate viability stats:", error);
  }

  // ─── 2. ACTIVE SCHEDULE RUN REORGANIZATION & FETCH ───
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    schedule = await (prisma as any).studySchedule.findFirst({
      where: { userId: mockUserId, status: "ACTIVE" },
      include: {
        items: {
          include: {
            subject: true,
            studyBlock: {
              include: {
                supportMaterials: {
                  include: { material: true }
                },
                material: true
              }
            },
            material: true
          },
          orderBy: { dayNumber: "asc" }
        }
      }
    });

    if (schedule && schedule.items) {
      const schedTodayStr = getTodayRangeSP(schedule.updatedAt).dateString;
      const nowTodayStr = getTodayRangeSP(new Date()).dateString;

      if (schedTodayStr !== nowTodayStr) {
        console.log("Auto-reorganizando cronograma (primeiro acesso do dia na página de cronograma)...");
        await reorganizeActiveSchedule(mockUserId, 30);

        schedule = await (prisma as any).studySchedule.findFirst({
          where: { userId: mockUserId, status: "ACTIVE" },
          include: {
            items: {
              include: {
                subject: true,
                studyBlock: {
                  include: {
                    supportMaterials: {
                      include: { material: true }
                    },
                    material: true
                  }
                },
                material: true
              },
              orderBy: { dayNumber: "asc" }
            }
          }
        });
      }
    }
  } catch (error) {
    console.error("Failed to fetch schedule:", error);
  }

  if (!schedule) {
    return <GenerateScheduleCTA />;
  }

  // Helper label data
  function getScheduleDayLabel(date: Date | string): { label: string; dateLabel: string } {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffMs = d.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const dateLabel = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

    if (diffDays === 0) return { label: "Hoje", dateLabel };
    if (diffDays === 1) return { label: "Amanhã", dateLabel };
    if (diffDays < 0) return { label: `D${diffDays}`, dateLabel };
    return { label: `D+${diffDays}`, dateLabel };
  }

  const allItems = schedule.items.filter(
    (item: any) => item.actionType !== "REVIEW_FLASHCARDS" && item.actionType !== "PRACTICE_CARDS"
  );

  // Proteção defensiva: não exibir tarefas pendentes/em andamento de matérias excluídas (EXCLUDED)
  const activeItems = allItems.filter(
    (item: any) => item.status !== "COMPLETED" && item.subject?.studyPriority !== "EXCLUDED"
  );
  const completedItems = allItems.filter((item: any) => item.status === "COMPLETED");

  const groupedActive = activeItems.reduce((acc: any, item: any) => {
    const dateKey = item.scheduledDate
      ? new Date(item.scheduledDate).toISOString().split("T")[0]
      : `day-${item.dayNumber}`;
    if (!acc[dateKey]) acc[dateKey] = { date: item.scheduledDate, items: [] };
    acc[dateKey].items.push(item);
    return acc;
  }, {});

  const sortedDateKeys = Object.keys(groupedActive).sort((a, b) => {
    const dateA = groupedActive[a].date ? new Date(groupedActive[a].date).getTime() : 0;
    const dateB = groupedActive[b].date ? new Date(groupedActive[b].date).getTime() : 0;
    return dateA - dateB;
  });

  const ACTION_LABELS: Record<string, string> = {
    THEORY: "Teoria",
    REVIEW_BLOCK: "Revisão de conteúdo",
    PRACTICE_CARDS: "Praticar cards",
    QUESTIONS: "Questões",
    REINFORCEMENT: "Reforço",
  };

  return (
    <div className="space-y-8 max-w-6xl animate-in fade-in duration-700 slide-in-from-bottom-4 pb-20">
      <PageHeader
        icon={Calendar}
        title="Roteiro de Estudo"
        description="Visualize sua jornada de aprendizado completa organizada por blocos teóricos."
      >
        <div className="flex flex-wrap items-center gap-3">
          <ActivateSecondaryModal secondarySubjects={secondarySubjects} />
          <ReorganizeScheduleButton />
          <Link href="/">
            <Button variant="outline" className="rounded-xl">Voltar ao Hoje</Button>
          </Link>
        </div>
      </PageHeader>

      {/* ─── VIABILITY PANEL ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Viability Main Alert Card */}
        <div className={cn(
          "lg:col-span-2 border rounded-[2rem] p-6 shadow-sm flex flex-col justify-between gap-4",
          isViable 
            ? "bg-accent/5 border-accent/25 text-foreground" 
            : "bg-amber-50/20 border-amber-200/50 text-foreground"
        )}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                isViable ? "bg-accent/15 text-accent" : "bg-amber-100/50 text-amber-700"
              )}>
                {isViable ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              </div>
              <h3 className={cn(
                "text-sm font-bold uppercase tracking-wider",
                isViable ? "text-accent" : "text-amber-800"
              )}>
                {isViable ? "Cronograma Viável" : "Viabilidade do Cronograma"}
              </h3>
            </div>
            
            {isViable ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                🎉 <strong>Seu plano de estudos é viável!</strong> Todo o conteúdo das matérias ativas cabe no prazo estabelecido (até {deadlineStr}{isDefaultDeadline ? " - estimativa padrão" : ""}) com a sua meta diária atual de <strong>{dailyGoalMinutes} min/dia</strong>.
              </p>
            ) : (
              <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                <p>
                  ⚠️ <strong>Atenção:</strong> o conteúdo principal não cabe integralmente até <strong>{deadlineStr}</strong> com a carga diária atual.
                </p>
                <p>
                  Com a meta atual de <strong>{dailyGoalMinutes} min/dia</strong>, faltam aproximadamente <strong className="text-amber-800 font-bold">{deficitHours} horas</strong> para cobrir todo o conteúdo teórico.
                </p>
                <p className="text-xs bg-amber-50/60 border border-amber-200 p-3 rounded-xl text-amber-850 font-medium leading-relaxed">
                  💡 Para concluir todo o conteúdo dentro do prazo, a meta diária sugerida seria de aproximadamente <strong>{suggestedDailyGoal} minutos</strong>.
                </p>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground/60 border-t border-border/40 pt-4">
            <span>Prazo Final: <strong>{deadlineStr}{isDefaultDeadline ? " (estimativa)" : ""}</strong></span>
            <span>Dias Restantes: <strong>{remainingDays} dias</strong></span>
          </div>
        </div>

        {/* Carga Horária Stats Card */}
        <div className="bg-card border border-border/40 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Análise de Carga Teórica
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs py-1 border-b border-border/20">
                <span className="text-muted-foreground">Total Necessário (Teoria)</span>
                <span className="font-semibold text-foreground">{totalRequiredHours} horas</span>
              </div>
              <div className="flex justify-between items-center text-xs py-1 border-b border-border/20">
                <span className="text-muted-foreground">Total Disponível (Teoria)</span>
                <span className="font-semibold text-foreground">{totalAvailableTheoryHours} horas</span>
              </div>
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-muted-foreground">Carga Diária Atual (Teoria)</span>
                <span className="font-semibold text-foreground">{dailyTheoryMinutes} min/dia</span>
              </div>
            </div>
          </div>

          <div className="bg-muted/30 border border-border/30 rounded-2xl p-4 mt-4 text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Matérias no Ciclo Principal</span>
            <span className="text-lg font-black text-accent mt-1 block">
              {primarySubjects.length + activeSecondarySubjects.length} ativas
            </span>
            {secondarySubjects.length > 0 && (
              <div className="mt-3 text-xs bg-muted/40 border border-border/30 p-3 rounded-xl flex justify-between items-center">
                <span className="text-muted-foreground text-[10px]">Secundárias aguardando:</span>
                <Badge variant="outline" className="bg-accent/5 text-accent border-accent/20 rounded-md font-bold text-[9px] py-0">
                  {secondarySubjects.length} matérias
                </Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── ACTIVE SCHEDULE (Pending/Future items) ─── */}
      {sortedDateKeys.length > 0 ? (
        <div className="space-y-10 relative before:absolute before:left-[19px] before:top-2 before:h-[calc(100%-16px)] before:w-[2px] before:bg-border/40">
          {sortedDateKeys.map((dateKey, index) => {
            const group = groupedActive[dateKey];
            const dayLabel = group.date
              ? getScheduleDayLabel(group.date)
              : { label: `Dia ${index + 1}`, dateLabel: "" };
            const isToday = dayLabel.label === "Hoje";

            return (
              <div key={dateKey} className="relative pl-12 space-y-4">
                <div
                  className={cn(
                    "absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background z-10 transition-colors",
                    isToday
                      ? "border-accent text-accent shadow-[0_0_15px_rgba(134,151,116,0.3)]"
                      : "border-border text-muted-foreground"
                  )}
                >
                  <Calendar className="w-4 h-4" />
                </div>

                <div className="flex items-center gap-3">
                  <div>
                    <h2
                      className={cn(
                        "text-xl font-bold",
                        isToday ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {dayLabel.label}
                      {isToday && (
                        <span className="ml-2 text-xs font-bold bg-sage-light text-accent px-2 py-0.5 rounded-lg uppercase tracking-wider">
                          Ativo
                        </span>
                      )}
                    </h2>
                    {dayLabel.dateLabel && (
                      <p className="text-xs text-muted-foreground mt-0.5">{dayLabel.dateLabel}</p>
                    )}
                  </div>
                  <div className="h-px flex-1 bg-border/30" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.items.map((item: any) => (
                    <div
                      key={item.id}
                      className="group bg-card p-5 rounded-2xl border border-border/40 hover:border-accent/30 transition-all flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className="bg-sage-light/20 text-accent border-none rounded-lg text-[10px] py-0"
                          >
                            {item.subject.name}
                          </Badge>
                          <h3 className="font-semibold text-base leading-tight">
                            {item.studyBlock?.title || "Bloco de Estudo"}
                          </h3>
                        </div>
                        <div className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-muted text-muted-foreground">
                          Pendente
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {item.studyBlock
                            ? `Págs ${item.studyBlock.pageStart}-${item.studyBlock.pageEnd}`
                            : ACTION_LABELS[item.actionType] || item.actionType}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.estimatedMinutes} min
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 pt-1 border-t border-border/40">
                        {(() => {
                          const supports = item.studyBlock?.supportMaterials || [];
                          if (supports.length === 0) return null;

                          const questionsCount = supports.filter((s: any) =>
                            ["QUESTIONS", "COMMENTED_QUESTIONS", "SIMULATED_EXAM"].includes(s.supportType)
                          ).length;
                          const summaryCount = supports.filter((s: any) =>
                            ["SUMMARY", "BIZU", "MIND_MAP", "CHECKLIST", "REVIEW"].includes(s.supportType)
                          ).length;
                          const answerKeyCount = supports.filter((s: any) =>
                            s.supportType === "ANSWER_KEY"
                          ).length;
                          const otherCount = supports.length - (questionsCount + summaryCount + answerKeyCount);

                          return (
                            <div className="text-[10px] text-muted-foreground flex flex-col gap-1 mt-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-muted-foreground uppercase tracking-wider">
                                  Materiais de Apoio
                                </span>
                                <Link
                                  href={`/blocks/${item.studyBlock.id}?scheduleItemId=${item.id}&returnTo=/schedule`}
                                  className="text-accent hover:underline font-bold"
                                >
                                  Visualizar
                                </Link>
                              </div>
                              <div className="flex flex-wrap gap-1.5 mt-0.5">
                                {summaryCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1.5 py-0 bg-accent/5 text-accent border-accent/20 rounded-md"
                                  >
                                    {summaryCount} Resumo{summaryCount > 1 ? "s" : ""}
                                  </Badge>
                                )}
                                {questionsCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1.5 py-0 bg-muted/60 text-foreground border-border/50 rounded-md"
                                  >
                                    {questionsCount} Lista{questionsCount > 1 ? "s" : ""} de Questões
                                  </Badge>
                                )}
                                {answerKeyCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1.5 py-0 bg-amber-50 text-amber-600 border-amber-200 rounded-md"
                                  >
                                    {answerKeyCount} Gabarito{answerKeyCount > 1 ? "s" : ""}
                                  </Badge>
                                )}
                                {otherCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1.5 py-0 bg-gray-50 text-gray-600 border-gray-200 rounded-md"
                                  >
                                    {otherCount} Outro{otherCount > 1 ? "s" : ""}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="pt-2 flex gap-2">
                        <Link href="/" className="flex-1">
                          <Button variant="primary" size="sm" className="w-full rounded-xl gap-2 font-bold">
                            <Play className="w-3 h-3 fill-current" />
                            {ACTION_LABELS[item.actionType] || "Começar agora"}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-accent/40" />
          <p className="text-lg font-medium">Todas as tarefas foram concluídas!</p>
          <p className="text-sm mt-1">Parabéns pelo seu progresso. 🎉</p>
        </div>
      )}

      {/* ─── COMPLETED BLOCKS SECTION ─── */}
      {completedItems.length > 0 && (
        <div className="mt-16 pt-8 border-t border-border/30">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-muted-foreground">Blocos concluídos</h2>
              <p className="text-xs text-muted-foreground/60">
                {completedItems.length} bloco{completedItems.length !== 1 ? "s" : ""} finalizado{completedItems.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {completedItems.map((item: any) => (
              <div
                key={item.id}
                className="bg-muted/15 p-4 rounded-2xl border border-border/20 flex flex-col gap-2 opacity-70 hover:opacity-90 transition-opacity"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <Badge
                      variant="outline"
                      className="bg-accent/5 text-accent/70 border-none rounded-lg text-[9px] py-0"
                    >
                      {item.subject.name}
                    </Badge>
                    <h3 className="font-medium text-sm leading-tight text-muted-foreground">
                      {item.studyBlock?.title || "Bloco de Estudo"}
                    </h3>
                  </div>
                  <div className="text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-accent/10 text-accent">
                    Concluído
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                  {item.studyBlock && (
                    <span className="flex items-center gap-1">
                      <Layers className="w-2.5 h-2.5" />
                      Págs {item.studyBlock.pageStart}-{item.studyBlock.pageEnd}
                    </span>
                  )}
                  {item.studyBlock?.material?.fileName && (
                    <span className="truncate max-w-[120px]">
                      {item.studyBlock.material.fileName}
                    </span>
                  )}
                  {item.completedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(item.completedAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
