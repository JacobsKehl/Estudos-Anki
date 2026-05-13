"use client";

import { 
  Trophy, 
  Target, 
  BrainCircuit, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { SubjectMetrics, SubjectHealth } from "@/lib/services/subject-metrics";
import { Badge } from "@/components/ui/badge";

interface SubjectPerformancePanelProps {
  metrics: SubjectMetrics;
}

const HEALTH_CONFIG = {
  EXCELLENT: { 
    label: "Excelente", 
    class: "bg-green-100 text-green-700 border-green-200", 
    description: "Você está dominando esta matéria!",
    icon: Trophy
  },
  GOOD: { 
    label: "Boa", 
    class: "bg-blue-100 text-blue-700 border-blue-200", 
    description: "Ritmo constante. Continue assim.",
    icon: TrendingUp
  },
  ATTENTION: { 
    label: "Atenção", 
    class: "bg-orange-100 text-orange-700 border-orange-200", 
    description: "Algumas revisões estão acumulando.",
    icon: AlertCircle
  },
  CRITICAL: { 
    label: "Crítica", 
    class: "bg-red-100 text-red-700 border-red-200", 
    description: "Muitas revisões pendentes ou taxa de acerto baixa.",
    icon: AlertCircle
  },
};

export function SubjectPerformancePanel({ metrics }: SubjectPerformancePanelProps) {
  const config = HEALTH_CONFIG[metrics.health];
  const HealthIcon = config.icon;

  return (
    <div className="space-y-6">
      {/* Main Health Card */}
      <div className={`p-6 md:p-8 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row items-center gap-6 ${config.class}`}>
        <div className="w-16 h-16 rounded-3xl bg-white/50 flex items-center justify-center shrink-0 shadow-sm border border-white/20">
          <HealthIcon className="w-8 h-8" />
        </div>
        <div className="flex-1 text-center md:text-left space-y-1">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <h2 className="text-2xl font-bold">Saúde da Matéria: {config.label}</h2>
            <Badge variant="outline" className="w-fit mx-auto md:mx-0 bg-white/40 border-white/20 text-current">
              {metrics.accuracyRate}% de Precisão
            </Badge>
          </div>
          <p className="text-current opacity-80 font-medium">
            {config.description}
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard 
          icon={CheckCircle2}
          label="Concluído"
          value={`${metrics.completedBlocks}/${metrics.totalBlocks}`}
          sublabel="Blocos de estudo"
          color="bg-green-50 text-green-600"
        />
        <MetricCard 
          icon={Sparkles}
          label="Aprovados"
          value={metrics.approvedFlashcards}
          sublabel="Flashcards"
          color="bg-accent/5 text-accent"
        />
        <MetricCard 
          icon={Clock}
          label="Pendentes"
          value={metrics.dueReviews}
          sublabel="Revisões hoje"
          color={metrics.dueReviews > 0 ? "bg-orange-50 text-orange-600" : "bg-muted text-muted-foreground"}
        />
        <MetricCard 
          icon={Target}
          label="Aprovação"
          value={`${metrics.accuracyRate}%`}
          sublabel="Taxa de acerto"
          color="bg-blue-50 text-blue-600"
        />
      </div>
    </div>
  );
}

function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  sublabel, 
  color 
}: { 
  icon: any, 
  label: string, 
  value: string | number, 
  sublabel: string, 
  color: string 
}) {
  return (
    <div className="bg-card p-5 rounded-3xl border border-border/40 space-y-3 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-[10px] font-medium text-muted-foreground">{sublabel}</p>
      </div>
    </div>
  );
}
