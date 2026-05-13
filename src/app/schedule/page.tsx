/* eslint-disable @typescript-eslint/no-explicit-any */
import { Calendar, Layers, CheckCircle2, Clock, Play, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { GenerateScheduleCTA } from "@/components/schedule/GenerateScheduleCTA";

import { PageHeader } from "@/components/ui/page-header";

export default async function SchedulePage() {
  const mockUserId = "cm39k012x0001k93jqwerty12";

  // 1. Fetch active schedule
  let schedule: any = null;
  try {
    schedule = await (prisma as any).studySchedule.findFirst({
      where: { userId: mockUserId, status: "ACTIVE" },
      include: {
        items: {
          include: {
            subject: true,
            studyBlock: true,
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

  // Group items by day
  const groupedItems = schedule.items.reduce((acc: any, item: any) => {
    const day = item.dayNumber;
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-8 max-w-6xl animate-in fade-in duration-700 slide-in-from-bottom-4 pb-20">
      <PageHeader 
        icon={Calendar}
        title="Cronograma de Estudo"
        description="Seu roteiro personalizado baseado nos blocos de conteúdo extraídos."
      >
        <Button variant="outline" className="rounded-xl">Configurar</Button>
        <Button className="rounded-xl gap-2">
          <Plus className="w-4 h-4" />
          Adicionar Bloco
        </Button>
      </PageHeader>

      <div className="space-y-10 relative before:absolute before:left-[19px] before:top-2 before:h-[calc(100%-16px)] before:w-[2px] before:bg-border/40">
        {Object.keys(groupedItems).map((dayStr) => {
          const day = parseInt(dayStr);
          const items = groupedItems[day];
          const isToday = day === 1; // Simplified logic for MVP

          return (
            <div key={day} className="relative pl-12 space-y-4">
              <div className={cn(
                "absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background z-10 transition-colors",
                isToday ? "border-accent text-accent shadow-[0_0_15px_rgba(134,151,116,0.3)]" : "border-border text-muted-foreground"
              )}>
                <span className="text-sm font-bold">{day}</span>
              </div>

              <div className="flex items-center gap-3">
                <h2 className={cn(
                  "text-xl font-bold",
                  isToday ? "text-foreground" : "text-muted-foreground"
                )}>
                  Dia {day} {isToday && <span className="ml-2 text-xs font-bold bg-sage-light text-accent px-2 py-0.5 rounded-lg uppercase tracking-wider">Hoje</span>}
                </h2>
                <div className="h-px flex-1 bg-border/30" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item: any) => (
                  <div 
                    key={item.id} 
                    className={cn(
                      "group bg-card p-5 rounded-2xl border border-border/40 hover:border-accent/30 transition-all flex flex-col gap-3",
                      item.status === "COMPLETED" && "opacity-60 bg-muted/20"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <Badge variant="outline" className="bg-sage-light/20 text-accent border-none rounded-lg text-[10px] py-0">
                          {item.subject.name}
                        </Badge>
                        <h3 className="font-semibold text-base leading-tight">{item.studyBlock.title}</h3>
                      </div>
                      <div className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider",
                        item.status === "COMPLETED" ? "bg-green-50 text-green-600" : "bg-muted text-muted-foreground"
                      )}>
                        {item.status === "COMPLETED" ? "Concluído" : "Pendente"}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        Págs {item.studyBlock.pageStart}-{item.studyBlock.pageEnd}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.estimatedMinutes} min
                      </span>
                    </div>

                    <div className="pt-2 flex gap-2">
                      {item.status === "COMPLETED" ? (
                        <div className="flex items-center gap-2 text-green-600 text-xs font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Estudo finalizado
                        </div>
                      ) : (
                        <Link href="/today" className="flex-1">
                          <Button size="sm" className="w-full rounded-xl gap-2 h-9">
                            <Play className="w-3 h-3 fill-current" />
                            Começar agora
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
