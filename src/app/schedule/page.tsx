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

export default async function SchedulePage() {
  const mockUserId = await getMockUserId();
  let schedule: any = null;
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Auto-reorganizar se houverem tarefas pendentes no passado
    const hasPastPending = await (prisma as any).studyScheduleItem.findFirst({
      where: {
        userId: mockUserId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        schedule: { status: "ACTIVE" },
        scheduledDate: { lt: todayStart }
      }
    });

    if (hasPastPending) {
      console.log("Auto-reorganizando cronograma devido a tarefas pendentes no passado...");
      await reorganizeActiveSchedule(mockUserId, 30);
    }

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
  } catch (error) {
    console.error("Failed to fetch schedule:", error);
  }

  if (!schedule) {
    return <GenerateScheduleCTA />;
  }

  // --- HELPER: Get human-readable day label ---
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

  // --- Separate active items from completed items ---
  const allItems = schedule.items.filter(
    (item: any) => item.actionType !== "REVIEW_FLASHCARDS" && item.actionType !== "PRACTICE_CARDS"
  );

  const activeItems = allItems.filter((item: any) => item.status !== "COMPLETED");
  const completedItems = allItems.filter((item: any) => item.status === "COMPLETED");

  // Group ACTIVE items by scheduledDate
  const groupedActive = activeItems.reduce((acc: any, item: any) => {
    const dateKey = item.scheduledDate
      ? new Date(item.scheduledDate).toISOString().split("T")[0]
      : `day-${item.dayNumber}`;
    if (!acc[dateKey]) acc[dateKey] = { date: item.scheduledDate, items: [] };
    acc[dateKey].items.push(item);
    return acc;
  }, {});

  // Sort date groups chronologically
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
        <div className="flex items-center gap-3">
          <ReorganizeScheduleButton />
          <Link href="/">
            <Button variant="outline" className="rounded-xl">Voltar ao Hoje</Button>
          </Link>
        </div>
      </PageHeader>

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
                {/* Timeline node */}
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

                {/* Day header */}
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

                {/* Items grid */}
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

                      {/* Support materials */}
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
                                  href={`/blocks/${item.studyBlock.id}`}
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

                      {/* Action button */}
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
