import { useRouter } from "next/navigation";
import { BookOpen, Blocks, Sparkles, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SubjectHealth } from "@/lib/services/subject-metrics";
import { TRT4_STRATEGY } from "@/lib/strategies/trt4";
import { SubjectActions } from "./SubjectActions";

interface SubjectCardProps {
  subject: {
    id: string;
    name: string;
    description: string | null;
    progress: number;
    metrics?: {
      totalBlocks: number;
      completedBlocks: number;
      approvedFlashcards: number;
      dueReviews: number;
      health: SubjectHealth;
    };
    _count: {
      materials: number;
      studyBlocks: number;
    };
    createdAt: string | Date;
  };
}

const HEALTH_CONFIG = {
  EXCELLENT: { label: "Excelente", class: "bg-green-100 text-green-700" },
  GOOD: { label: "Boa", class: "bg-blue-100 text-blue-700" },
  ATTENTION: { label: "Atenção", class: "bg-orange-100 text-orange-700" },
  CRITICAL: { label: "Crítica", class: "bg-red-100 text-red-700" },
};

export function SubjectCard({ subject }: SubjectCardProps) {
  const router = useRouter();
  const health = subject.metrics?.health || 'GOOD';
  const config = HEALTH_CONFIG[health];

  // Regra TRT4: verificar se está no ciclo
  const strategySub = TRT4_STRATEGY.subjects.find(s => s.name === subject.name);
  const now = new Date();
  const createdAt = new Date(subject.createdAt);
  const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const isWaitingCycle = strategySub?.cycleStartAfterDays && daysSinceCreated < strategySub.cycleStartAfterDays;

  return (
    <div 
      onClick={() => router.push(`/subjects/${subject.id}`)}
      className="group bg-card p-6 rounded-[2rem] border border-border/50 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/5 transition-all duration-500 flex flex-col gap-5 h-full cursor-pointer"
    >
      <div className="flex justify-between items-start">
        <div className="w-12 h-12 rounded-2xl bg-sage-light/30 text-accent flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
          <BookOpen className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {isWaitingCycle ? (
            <Badge className="bg-slate-100 text-slate-500 border-none px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm">
              <Clock className="w-3 h-3 mr-1" />
              Aguardando Ciclo
            </Badge>
          ) : (
            <Badge className={`border-none px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm ${config.class}`}>
              {config.label}
            </Badge>
          )}
          <SubjectActions subject={subject} />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-bold tracking-tight group-hover:text-accent transition-colors">
          {subject.name}
        </h3>
        <p className="text-muted-foreground text-sm line-clamp-2 leading-relaxed">
          {subject.description || "Nenhuma descrição adicionada."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="bg-muted/30 p-3 rounded-2xl border border-border/30">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Blocks className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Blocos</span>
          </div>
          <p className="text-sm font-bold">
            {subject.metrics?.completedBlocks ?? 0}/{subject.metrics?.totalBlocks ?? subject._count.studyBlocks}
          </p>
        </div>
        <div className="bg-muted/30 p-3 rounded-2xl border border-border/30">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Sparkles className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Cards</span>
          </div>
          <p className="text-sm font-bold">
            {subject.metrics?.approvedFlashcards ?? 0} aprovados
          </p>
        </div>
      </div>

      <div className="space-y-2 mt-auto">
        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span>Progresso</span>
          <span>{Math.round(subject.progress)}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-accent transition-all duration-700 ease-out rounded-full" 
            style={{ width: `${subject.progress}%` }}
          />
        </div>
      </div>
      
      {subject.metrics && subject.metrics.dueReviews > 0 && (
        <div className="flex items-center gap-2 text-xs font-semibold text-orange-600 bg-orange-50/50 p-2 rounded-xl border border-orange-100">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          {subject.metrics.dueReviews} revisões pendentes
        </div>
      )}
    </div>
  );
}
