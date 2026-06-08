"use client";

import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Sliders, Mail, Calendar, Loader2 } from "lucide-react";
import { StudyPreferences } from "@/hooks/useStudyPreferences";
import { getUserCopy } from "@/lib/user-copy";

interface ProfileEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: StudyPreferences;
  onSave: (newPrefs: Partial<StudyPreferences>) => Promise<boolean>;
}

export function ProfileEditModal({
  open,
  onOpenChange,
  preferences,
  onSave
}: ProfileEditModalProps) {
  const copy = getUserCopy(preferences.languageTone);
  const [activeTab, setActiveTab] = useState<"identidade" | "rotina">("identidade");
  const [isSaving, setIsSaving] = useState(false);

  // States correspondentes às preferências
  const [displayName, setDisplayName] = useState(preferences.displayName);
  const [focusArea, setFocusArea] = useState(preferences.focusArea);
  const [examGoal, setExamGoal] = useState(preferences.examGoal);
  const [deadline, setDeadline] = useState(preferences.deadline || "");
  const [avatarUrl, setAvatarUrl] = useState(preferences.avatarUrl || "");
  const [languageTone, setLanguageTone] = useState(preferences.languageTone || "MASCULINE_NEUTRAL");
  const [dailyReminderEmail, setDailyReminderEmail] = useState(preferences.dailyReminderEmail || "");
  const [scheduleGenerationMode, setScheduleGenerationMode] = useState(preferences.scheduleGenerationMode || "DYNAMIC");

  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(preferences.dailyGoalMinutes);
  const [studyResetTime, setStudyResetTime] = useState(preferences.studyResetTime || "00:00");
  const [studyDaysOfWeek, setStudyDaysOfWeek] = useState(preferences.studyDaysOfWeek || "1,2,3,4,5");
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(preferences.emailReminderEnabled);
  const [emailReminderTime, setEmailReminderTime] = useState(preferences.emailReminderTime || "08:00");

  const getActiveDaysCount = (daysStr: string) => {
    if (!daysStr) return 5;
    const count = daysStr.split(",").map(d => d.trim()).filter(Boolean).length;
    if (count <= 3) return 3;
    if (count <= 5) return 5;
    return 7;
  };

  const handleSelectDaysCount = (count: number) => {
    if (count === 3) {
      setStudyDaysOfWeek("1,3,5"); // Seg, Qua, Sex
    } else if (count === 5) {
      setStudyDaysOfWeek("1,2,3,4,5"); // Seg a Sex
    } else {
      setStudyDaysOfWeek("0,1,2,3,4,5,6"); // Todos os dias
    }
  };

  // Atualiza estados locais quando modal abre ou preferences mudam
  useEffect(() => {
    if (open) {
      setDisplayName(preferences.displayName);
      setFocusArea(preferences.focusArea);
      setExamGoal(preferences.examGoal);
      setDeadline(preferences.deadline || "");
      setAvatarUrl(preferences.avatarUrl || "");
      setDailyGoalMinutes(preferences.dailyGoalMinutes);
      setStudyResetTime(preferences.studyResetTime || "00:00");
      setStudyDaysOfWeek(preferences.studyDaysOfWeek || "1,2,3,4,5");
      setEmailReminderEnabled(preferences.emailReminderEnabled);
      setEmailReminderTime(preferences.emailReminderTime || "08:00");
      setLanguageTone(preferences.languageTone || "MASCULINE_NEUTRAL");
      setDailyReminderEmail(preferences.dailyReminderEmail || "");
      setScheduleGenerationMode(preferences.scheduleGenerationMode || "DYNAMIC");
      setActiveTab("identidade"); // Inicia na primeira aba
    }
  }, [open, preferences]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const success = await onSave({
        displayName,
        name: displayName, // Sincroniza com o campo herdado name
        focusArea,
        studyFocus: focusArea, // Sincroniza com o campo herdado studyFocus
        examGoal,
        deadline: deadline || null,
        avatarUrl: avatarUrl || null,
        dailyGoalMinutes,
        studyResetTime,
        studyDaysOfWeek,
        emailReminderEnabled,
        emailReminderTime,
        languageTone,
        dailyReminderEmail: dailyReminderEmail || "",
        scheduleGenerationMode: scheduleGenerationMode as any
      });

      if (success) {
        onOpenChange(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-brand-cream border-accent/20">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold font-serif text-brand-sage-dark">
            Editar Perfil de Estudos
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {copy.studentDetails}
          </p>
        </DialogHeader>

        {/* Abas */}
        <div className="flex border-b border-border/60 mb-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("identidade")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
              activeTab === "identidade" 
                ? "border-accent text-accent" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="w-4 h-4" />
            Identidade
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab("rotina")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
              activeTab === "rotina" 
                ? "border-accent text-accent" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sliders className="w-4 h-4" />
            Rotina & Metas
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* ABA 1: IDENTIDADE */}
          {activeTab === "identidade" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Nome de Exibição
                  </Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    placeholder="Ex: Nome completo"
                    className="bg-card h-11 border-border/60 focus:border-accent"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avatarUrl" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    URL da Foto (Avatar)
                  </Label>
                  <Input
                    id="avatarUrl"
                    type="text"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="URL da imagem (opcional)"
                    className="bg-card h-11 border-border/60 focus:border-accent"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="focusArea" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Foco / Área de Estudos
                  </Label>
                  <Input
                    id="focusArea"
                    type="text"
                    value={focusArea}
                    onChange={(e) => setFocusArea(e.target.value)}
                    required
                    placeholder="Ex: Ciência da Computação, Direito Constitucional"
                    className="bg-card h-11 border-border/60 focus:border-accent"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="examGoal" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Objetivo / Prova
                  </Label>
                  <Input
                    id="examGoal"
                    type="text"
                    value={examGoal}
                    onChange={(e) => setExamGoal(e.target.value)}
                    required
                    placeholder="Ex: Certificação Security+"
                    className="bg-card h-11 border-border/60 focus:border-accent"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deadline" className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground/60" />
                    Prazo do Cronograma
                  </Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="bg-card h-11 border-border/60 focus:border-accent cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="languageTone" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Tom de Linguagem
                  </Label>
                  <select
                    id="languageTone"
                    value={languageTone}
                    onChange={(e) => setLanguageTone(e.target.value as any)}
                    className="bg-card w-full h-11 px-3 rounded-xl border border-border/60 focus:border-accent text-sm"
                  >
                    <option value="MASCULINE_NEUTRAL">Masculino/Neutro</option>
                    <option value="FEMININE">Feminino</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: ROTINA & METAS */}
          {activeTab === "rotina" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Meta de Estudo Diário (minutos)
                  </Label>
                  <div className="grid grid-cols-4 gap-2">
                    {[30, 60, 120, 180].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDailyGoalMinutes(mins)}
                        className={`h-10 rounded-xl text-xs font-bold transition-all border ${
                          dailyGoalMinutes === mins
                            ? "bg-accent border-accent text-accent-foreground shadow-sm"
                            : "bg-card border-border/60 text-foreground hover:bg-muted/30"
                        }`}
                      >
                        {mins} min
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Dias de Estudo por Semana
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[3, 5, 7].map((daysCount) => {
                      const isActive = getActiveDaysCount(studyDaysOfWeek) === daysCount;
                      return (
                        <button
                          key={daysCount}
                          type="button"
                          onClick={() => handleSelectDaysCount(daysCount)}
                          className={`h-10 rounded-xl text-xs font-bold transition-all border ${
                            isActive
                              ? "bg-accent border-accent text-accent-foreground shadow-sm"
                              : "bg-card border-border/60 text-foreground hover:bg-muted/30"
                          }`}
                        >
                          {daysCount} dias {daysCount === 5 ? "(Seg–Sex)" : daysCount === 7 ? "(Todos)" : "(Alternados)"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="studyResetTime" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Horário de Reset do Dia
                  </Label>
                  <Input
                    id="studyResetTime"
                    type="time"
                    value={studyResetTime}
                    onChange={(e) => setStudyResetTime(e.target.value)}
                    required
                    className="bg-card h-11 border-border/60 focus:border-accent cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailReminderTime" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Horário de Envio do E-mail
                  </Label>
                  <Input
                    id="emailReminderTime"
                    type="time"
                    value={emailReminderTime}
                    onChange={(e) => setEmailReminderTime(e.target.value)}
                    disabled={!emailReminderEnabled}
                    className="bg-card h-11 border-border/60 focus:border-accent cursor-pointer"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="scheduleGenerationMode" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Modo do cronograma
                  </Label>
                  <select
                    id="scheduleGenerationMode"
                    value={scheduleGenerationMode}
                    onChange={(e) => setScheduleGenerationMode(e.target.value as any)}
                    className="bg-card w-full h-11 px-3 rounded-xl border border-border/60 focus:border-accent text-sm"
                  >
                    <option value="DYNAMIC">Dinâmico — recomendado para objetivos personalizados</option>
                    <option value="LEGACY_TRT4">Legado TRT4 — fluxo original da Gabriela</option>
                  </select>
                </div>

                {/* Switch de lembrete diário */}
                <div className="flex items-center justify-between p-4 rounded-2xl border border-border/50 bg-card md:col-span-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-accent" />
                      Ativar lembrete diário por e-mail
                    </span>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      Receba o resumo de estudos e cards pendentes pela manhã.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={emailReminderEnabled}
                      onChange={(e) => setEmailReminderEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-muted-foreground/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                  </label>
                </div>

                {/* Campo de e-mail de lembrete condicional */}
                {emailReminderEnabled && (
                  <div className="space-y-2 md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <Label htmlFor="dailyReminderEmail" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      E-mail para lembrete
                    </Label>
                    <Input
                      id="dailyReminderEmail"
                      type="email"
                      value={dailyReminderEmail}
                      onChange={(e) => setDailyReminderEmail(e.target.value)}
                      placeholder="Ex: seu-email@dominio.com"
                      className="bg-card h-11 border-border/60 focus:border-accent"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-8 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-11 text-xs font-bold border-border/60 hover:bg-muted"
            >
              Cancelar
            </Button>
            
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving}
              className="rounded-xl h-11 text-xs font-bold px-6"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}
