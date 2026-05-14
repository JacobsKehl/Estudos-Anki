"use client";

import * as React from "react";
import { 
  BarChart3, 
  Calendar, 
  Target, 
  Zap, 
  Trophy, 
  TrendingUp,
  BookMarked,
  BrainCircuit,
  CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StudyStatsProps {
  data: any;
}

export function StudyStats({ data }: StudyStatsProps) {
  const { summary, heatmap, mastery, subjects } = data;

  // Process Heatmap for rendering
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const dateStr = d.toISOString().split('T')[0];
    return {
      date: dateStr,
      count: heatmap[dateStr] || 0,
      label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    };
  });

  const maxActivity = Math.max(...last30Days.map(d => d.count), 1);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* ── Summary Grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="Matérias" 
          value={summary.totalSubjects} 
          icon={BookMarked} 
          color="text-blue-500" 
          bgColor="bg-blue-50" 
        />
        <StatsCard 
          title="Blocos Estudados" 
          value={`${summary.completedBlocks}/${summary.totalBlocks}`} 
          icon={CheckCircle2} 
          color="text-emerald-500" 
          bgColor="bg-emerald-50" 
        />
        <StatsCard 
          title="Cards Ativos" 
          value={summary.approvedFlashcards} 
          icon={BrainCircuit} 
          color="text-purple-500" 
          bgColor="bg-purple-50" 
        />
        <StatsCard 
          title="Precisão Média" 
          value={`${summary.averageAccuracy}%`} 
          icon={Target} 
          color="text-amber-500" 
          bgColor="bg-amber-50" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Heatmap: Atividade Recente ────────────────────────────────────── */}
        <Card className="rounded-[2.5rem] border-border/40 shadow-sm overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-bold flex items-center gap-3">
              <Calendar className="w-5 h-5 text-accent" />
              Consistência (Últimos 30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <div className="flex items-end gap-1.5 h-32 w-full pt-8">
              {last30Days.map((day, i) => {
                const height = (day.count / maxActivity) * 100;
                return (
                  <div key={day.date} className="flex-1 group relative flex flex-col items-center">
                    <div 
                      className={`w-full rounded-t-md transition-all duration-500 ${
                        day.count > 0 ? 'bg-accent/80 group-hover:bg-accent' : 'bg-muted/30'
                      }`}
                      style={{ height: `${Math.max(height, 5)}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute -top-10 scale-0 group-hover:scale-100 transition-transform bg-foreground text-background text-[10px] font-bold px-2 py-1 rounded shadow-lg z-10 whitespace-nowrap">
                      {day.count} cards em {day.label}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
              <span>{last30Days[0].label}</span>
              <span>Hoje</span>
            </div>
          </CardContent>
        </Card>

        {/* ── Mastery Breakdown: SRS States ──────────────────────────────────── */}
        <Card className="rounded-[2.5rem] border-border/40 shadow-sm overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-bold flex items-center gap-3">
              <Zap className="w-5 h-5 text-amber-500" />
              Domínio de Conhecimento (SRS)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-6">
            <div className="h-4 w-full bg-muted rounded-full flex overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${(mastery.REVIEW / summary.approvedFlashcards) * 100}%` }} title="Dominado" />
              <div className="bg-blue-500 h-full" style={{ width: `${(mastery.LEARNING / summary.approvedFlashcards) * 100}%` }} title="Aprendendo" />
              <div className="bg-amber-500 h-full" style={{ width: `${(mastery.RELEARNING / summary.approvedFlashcards) * 100}%` }} title="Reaprendendo" />
              <div className="bg-slate-300 h-full" style={{ width: `${(mastery.NEW / summary.approvedFlashcards) * 100}%` }} title="Novo" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <MasteryItem label="Dominado (Review)" value={mastery.REVIEW} color="bg-emerald-500" />
              <MasteryItem label="Aprendendo" value={mastery.LEARNING} color="bg-blue-500" />
              <MasteryItem label="Reaprendendo" value={mastery.RELEARNING} color="bg-amber-500" />
              <MasteryItem label="Não Iniciado (New)" value={mastery.NEW} color="bg-slate-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Subjects Progress List ────────────────────────────────────────── */}
      <Card className="rounded-[2.5rem] border-border/40 shadow-sm overflow-hidden">
        <CardHeader className="p-8 pb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-accent" />
            Progresso por Disciplina
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 pt-0">
          <div className="space-y-6">
            {subjects.map((subject: any) => (
              <div key={subject.id} className="space-y-2">
                <div className="flex justify-between items-end">
                  <div>
                    <h4 className="font-bold text-sm">{subject.name}</h4>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      {subject.metrics.completedBlocks} de {subject.metrics.totalBlocks} blocos concluídos
                    </p>
                  </div>
                  <span className="text-xs font-black text-accent">{subject.metrics.progress}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all duration-1000 ease-out" 
                    style={{ width: `${subject.metrics.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCard({ title, value, icon: Icon, color, bgColor }: any) {
  return (
    <Card className="rounded-3xl border-border/40 shadow-sm overflow-hidden">
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl ${bgColor} ${color} flex items-center justify-center shrink-0`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
          <p className="text-2xl font-black tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MasteryItem({ label, value, color }: any) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">{label}</span>
        <span className="text-sm font-black leading-none">{value} cards</span>
      </div>
    </div>
  );
}
