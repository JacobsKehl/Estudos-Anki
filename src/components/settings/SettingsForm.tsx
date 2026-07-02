"use client";

import React, { useState, useEffect } from "react";
import { 
  User, 
  Sliders, 
  Mail, 
  Wrench, 
  ShieldAlert, 
  Loader2, 
  Info,
  ChevronDown,
  Layout,
  Trash2,
  UploadCloud,
  Sparkles,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RepairSupportsButton } from "@/components/materials/RepairSupportsButton";
import { OrganizeAllButton } from "@/components/materials/OrganizeAllButton";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";
import { toast } from "sonner";

interface SettingsFormProps {
  unorganizedCount: number;
  isAdmin?: boolean;
}

export function SettingsForm({ unorganizedCount, isAdmin = false }: SettingsFormProps) {
  const { preferences, updatePreferences, isLoading } = useStudyPreferences();
  
  // Local edit states synced with hook preferences on load
  const [name, setName] = useState(preferences.name);
  const [studyFocus, setStudyFocus] = useState(preferences.studyFocus);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(preferences.dailyGoalMinutes);
  const [flashcardDifficulty, setFlashcardDifficulty] = useState(preferences.flashcardDifficulty);
  const [emailReminderEnabled, setEmailReminderEnabled] = useState(preferences.emailReminderEnabled);
  const [emailReminderTime, setEmailReminderTime] = useState(preferences.emailReminderTime);
  const [dailyReminderEmail, setDailyReminderEmail] = useState(preferences.dailyReminderEmail);
  const [displayDensity, setDisplayDensity] = useState(preferences.displayDensity);
  const [animations, setAnimations] = useState(preferences.animations);
  const [theme, setTheme] = useState(preferences.theme);
  const [languageTone, setLanguageTone] = useState(preferences.languageTone || "MASCULINE_NEUTRAL");

  // New preference states
  const [studyResetTime, setStudyResetTime] = useState(preferences.studyResetTime || "00:00");
  const [studyDaysOfWeek, setStudyDaysOfWeek] = useState(preferences.studyDaysOfWeek || "1,2,3,4,5");
  const [defaultBlockDurationMinutes, setDefaultBlockDurationMinutes] = useState(preferences.defaultBlockDurationMinutes || 30);
  const [maxNewCardsPerDay, setMaxNewCardsPerDay] = useState(preferences.maxNewCardsPerDay || 20);

  // Diagnostics states
  const [diagnosticsData, setDiagnosticsData] = useState<{
    summary?: {
      duplicateBlockGroups: number;
      totalDuplicateBlocks: number;
      orphanedFlashcards: number;
    };
  } | null>(null);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);
  const [isFixingDiagnostics, setIsFixingDiagnostics] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  // States for Flashcard Reset & Import
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    skippedDuplicates: number;
    failedRows: number;
    bySubject: Record<string, number>;
  } | null>(null);

  // Admin Invitation State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("E-mail é obrigatório.");
      return;
    }

    setIsSendingInvite(true);
    const toastId = toast.loading("Enviando convite...");

    try {
      const response = await fetch("/api/auth/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Convite processado com sucesso!", { id: toastId });
        setInviteEmail("");
        setInviteName("");
      } else {
        toast.error(data.error || "Erro ao processar convite.", { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro de conexão ao enviar convite.", { id: toastId });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleResetFlashcards = async () => {
    if (resetConfirmText !== "APAGAR") {
      toast.error("Digite APAGAR para confirmar a exclusão.");
      return;
    }

    setIsResetting(true);
    const toastId = toast.loading("Apagando todos os flashcards...");
    try {
      const response = await fetch("/api/flashcards/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE_ALL_FLASHCARDS" }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Todos os flashcards foram excluídos com sucesso.", { id: toastId });
        setResetConfirmText("");
      } else {
        toast.error(data.error || "Erro ao apagar flashcards.", { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro de conexão ao apagar flashcards.", { id: toastId });
    } finally {
      setIsResetting(false);
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportSummary(null);
    const toastId = toast.loading("Importando flashcards do arquivo CSV...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/flashcards/import-csv", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        toast.success("Importação concluída!", { id: toastId });
        setImportSummary(data);
      } else {
        toast.error(data.error || "Erro ao importar arquivo CSV.", { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro de conexão ao importar flashcards.", { id: toastId });
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const activeDays = studyDaysOfWeek ? studyDaysOfWeek.split(",").map(Number) : [];
  
  const toggleDay = (dayNum: number) => {
    let newDays;
    if (activeDays.includes(dayNum)) {
      newDays = activeDays.filter((d) => d !== dayNum);
    } else {
      newDays = [...activeDays, dayNum];
    }
    newDays.sort((a, b) => a - b);
    setStudyDaysOfWeek(newDays.join(","));
  };

  const fetchDiagnostics = async () => {
    setIsLoadingDiagnostics(true);
    try {
      const response = await fetch("/api/diagnostics");
      if (response.ok) {
        const data = await response.json();
        setDiagnosticsData(data);
      }
    } catch (err) {
      console.error("Erro ao carregar diagnósticos:", err);
    } finally {
      setIsLoadingDiagnostics(false);
    }
  };

  const handleFixDiagnostics = async (action: "fix_duplicates" | "fix_orphans" | "fix_all") => {
    setIsFixingDiagnostics(true);
    const toastId = toast.loading("Executando correções no banco de dados...");
    try {
      const response = await fetch("/api/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, confirm: "RUN_DIAGNOSTICS_FIX" }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success(
          `Sucesso: ${data.fixedDuplicates} blocos duplicados corrigidos, ${data.deletedOrphans} cards órfãos limpos.`,
          { id: toastId }
        );
        fetchDiagnostics();
      } else {
        toast.error(`Erro ao corrigir dados: ${data.error || "Erro desconhecido."}`, { id: toastId });
      }
    } catch (err: any) {
      console.error("Erro ao executar diagnóstico:", err);
      toast.error(`Erro: ${err.message || "Erro de conexão."}`, { id: toastId });
    } finally {
      setIsFixingDiagnostics(false);
    }
  };

  // Sync state from hook when preferences load
  useEffect(() => {
    setName(preferences.name);
    setStudyFocus(preferences.studyFocus);
    setDailyGoalMinutes(preferences.dailyGoalMinutes);
    setFlashcardDifficulty(preferences.flashcardDifficulty);
    setEmailReminderEnabled(preferences.emailReminderEnabled);
    setEmailReminderTime(preferences.emailReminderTime);
    setDailyReminderEmail(preferences.dailyReminderEmail);
    setDisplayDensity(preferences.displayDensity);
    setAnimations(preferences.animations);
    setTheme(preferences.theme);
    setLanguageTone(preferences.languageTone || "MASCULINE_NEUTRAL");
    setStudyResetTime(preferences.studyResetTime || "00:00");
    setStudyDaysOfWeek(preferences.studyDaysOfWeek || "1,2,3,4,5");
    setDefaultBlockDurationMinutes(preferences.defaultBlockDurationMinutes || 30);
    setMaxNewCardsPerDay(preferences.maxNewCardsPerDay || 20);
  }, [preferences]);

  useEffect(() => {
    if (isToolsOpen) {
      fetchDiagnostics();
    }
  }, [isToolsOpen]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const success = await updatePreferences({
        name,
        studyFocus,
        dailyGoalMinutes,
        flashcardDifficulty,
        emailReminderEnabled,
        emailReminderTime,
        dailyReminderEmail,
        displayDensity,
        animations,
        theme,
        studyResetTime,
        studyDaysOfWeek,
        defaultBlockDurationMinutes,
        maxNewCardsPerDay,
        languageTone,
      });

      if (success) {
        toast.success("Configurações salvas e sincronizadas com sucesso!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Ocorreu um erro ao salvar as configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerEmailTest = async () => {
    setIsSendingEmail(true);
    const toastId = toast.loading(`Preparando e-mail de lembrete diário para ${name || "seu perfil"}...`);

    try {
      // Disparar endpoint de cron enviando manual_key e o userId específico
      const response = await fetch(`/api/cron/reminder?manual_key=kehl2025manual&userId=${preferences.userId || ""}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha ao disparar o e-mail.");
      }

      if (data.skipped) {
        toast.warning(
          <div className="space-y-1 py-1 text-card-foreground">
            <p className="font-bold text-sm text-amber-800">Envio Ignorado</p>
            <p className="text-xs text-amber-700">{data.reason}</p>
          </div>,
          { id: toastId, duration: 6000 }
        );
      } else {
        toast.success(
          <div className="space-y-1 py-1 text-card-foreground">
            <p className="font-bold text-sm text-foreground">Lembrete enviado!</p>
            <p className="text-xs">
              O cronograma foi enviado com sucesso para <span className="font-semibold text-accent">{data.recipient}</span>.
            </p>
          </div>,
          { id: toastId, duration: 6000 }
        );
      }
    } catch (err: any) {
      console.error(err);
      toast.error(
        `Falha no disparo: ${err.message || "Erro desconhecido."}`,
        { id: toastId }
      );
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-sm text-muted-foreground">Carregando preferências reais...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-16">
      {/* Sidebar Navigation */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-card border border-border/40 rounded-[2rem] p-6 space-y-2 shadow-sm">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-3 mb-3">
            Menu de Ajustes
          </h3>
          <a href="#perfil" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-muted/40 transition-colors text-accent bg-sage-light/20">
            <User className="w-4 h-4 text-accent" />
            Perfil & Metas
          </a>
          <a href="#srs" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground">
            <Sliders className="w-4 h-4 text-muted-foreground" />
            Preferências de Estudo
          </a>
          <a href="#visual" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground">
            <Layout className="w-4 h-4 text-muted-foreground" />
            Densidade & Visual
          </a>
          <a href="#personalizacao" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            Personalização
          </a>
          <a href="#email" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground">
            <Mail className="w-4 h-4 text-muted-foreground" />
            Lembrete Diário
          </a>
        </div>

        {/* Informative Tip Card */}
        <div className="bg-accent/5 border border-accent/20 rounded-[2rem] p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-accent">
            <Info className="w-4 h-4" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Preferências Ativas</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Seus ajustes são gravados síncronamente no seu navegador e salvos no banco de dados do servidor para afetar dinamicamente o cronograma e o envio automático de lembretes.
          </p>
        </div>
      </div>

      {/* Main Settings Form */}
      <div className="lg:col-span-8 space-y-8">
        <form onSubmit={handleSaveProfile} className="space-y-8">
          {/* PROFILE & FOCUS */}
          <div id="perfil" className="bg-card border border-border/40 rounded-[2.5rem] p-8 space-y-6 shadow-sm scroll-mt-6">
            <div className="flex items-center gap-3 border-b border-border/30 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-sage-light flex items-center justify-center">
                <User className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Perfil & Metas</h2>
                <p className="text-xs text-muted-foreground">Configure seus dados de estudante e meta de estudo diário.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Nome de Exibição
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition-all"
                  placeholder="Nome do Estudante"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Foco ou Área de Estudo
                </label>
                <input
                  type="text"
                  value={studyFocus}
                  onChange={(e) => setStudyFocus(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition-all"
                  placeholder="Ex: Ciência da Computação, Direito Constitucional"
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Meta de Estudo Diário
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {[30, 60, 120, 180].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDailyGoalMinutes(mins)}
                      className={`h-11 rounded-xl text-xs font-bold transition-all border ${
                        dailyGoalMinutes === mins
                          ? "bg-accent border-accent text-accent-foreground shadow-sm shadow-accent/25"
                          : "bg-background border-border/50 text-foreground hover:bg-muted/30 hover:border-border"
                      }`}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* STUDY & SRS PREFERENCES */}
          <div id="srs" className="bg-card border border-border/40 rounded-[2.5rem] p-8 space-y-6 shadow-sm scroll-mt-6">
            <div className="flex items-center gap-3 border-b border-border/30 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-sage-light flex items-center justify-center">
                <Sliders className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Preferências do SRS & Flashcards</h2>
                <p className="text-xs text-muted-foreground">Ajuste o nível de cobrança da inteligência artificial para os flashcards e comportamento do cronograma.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Dificuldade das Questões e Flashcards
                </label>
                <select
                  value={flashcardDifficulty}
                  onChange={(e) => setFlashcardDifficulty(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition-all cursor-pointer"
                >
                  <option value="NORMAL_PLUS">Mais desafiadora (Foco em Exceções, Prazos, Conceitos Avançados & Casos Complexos)</option>
                  <option value="MEDIUM">Normal (Equilibrado com microcopy enxuto)</option>
                  <option value="EASY">Básica (Fixação de conceitos diretos)</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  A opção <strong>Mais desafiadora</strong> instrui o gerador a construir clozes inteligentes sobre requisitos complexos, regras rígidas, exceções, prazos e detalhes técnicos minuciosos, com respostas extremamente concisas.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Duração Padrão do Bloco (minutos)
                </label>
                <input
                  type="number"
                  min="5"
                  max="360"
                  value={defaultBlockDurationMinutes}
                  onChange={(e) => setDefaultBlockDurationMinutes(parseInt(e.target.value, 10))}
                  className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Limite de Novos Cards por Bloco
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={maxNewCardsPerDay}
                  onChange={(e) => setMaxNewCardsPerDay(parseInt(e.target.value, 10))}
                  className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition-all"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Horário de Reset do Estudo Diário
                </label>
                <input
                  type="time"
                  value={studyResetTime}
                  onChange={(e) => setStudyResetTime(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition-all cursor-pointer"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Horário de Brasília em que as metas diárias e limites de revisão são zerados.
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Dias da Semana Disponíveis para Estudo
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Dom", value: 0 },
                    { label: "Seg", value: 1 },
                    { label: "Ter", value: 2 },
                    { label: "Qua", value: 3 },
                    { label: "Qui", value: 4 },
                    { label: "Sex", value: 5 },
                    { label: "Sáb", value: 6 },
                  ].map((day) => {
                    const isSelected = activeDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                          isSelected
                            ? "bg-accent border-accent text-accent-foreground shadow-sm shadow-accent/25"
                            : "bg-background border-border/50 text-foreground hover:bg-muted/30 hover:border-border"
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* DENSITY & VISUALS */}
          <div id="visual" className="bg-card border border-border/40 rounded-[2.5rem] p-8 space-y-6 shadow-sm scroll-mt-6">
            <div className="flex items-center gap-3 border-b border-border/30 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-sage-light flex items-center justify-center">
                <Layout className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Densidade & Visual</h2>
                <p className="text-xs text-muted-foreground">Customize o layout e comportamento visual para o seu monitor.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Densidade de Tela
                </label>
                <select
                  value={displayDensity}
                  onChange={(e) => setDisplayDensity(e.target.value as any)}
                  className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition-all cursor-pointer"
                >
                  <option value="comfortable">Confortável (Design espaçado)</option>
                  <option value="compact">Compacta (Maximiza área)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Tema (Modo Noturno)
                </label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                  className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition-all cursor-pointer"
                >
                  <option value="light">☀️ Claro (Padrão)</option>
                  <option value="dark">🌙 Escuro (Agradável aos olhos)</option>
                  <option value="system">💻 Sistema (Automático)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Transições & Efeitos
                </label>
                <select
                  value={animations}
                  onChange={(e) => setAnimations(e.target.value as any)}
                  className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition-all cursor-pointer"
                >
                  <option value="normal">Normais (Premium suavizado)</option>
                  <option value="reduced">Reduzidas (Foco em performance)</option>
                </select>
              </div>
            </div>
          </div>

          {/* PERSONALIZAÇÃO */}
          <div id="personalizacao" className="bg-card border border-border/40 rounded-[2.5rem] p-8 space-y-6 shadow-sm scroll-mt-6">
            <div className="flex items-center gap-3 border-b border-border/30 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-sage-light flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Personalização</h2>
                <p className="text-xs text-muted-foreground">Ajuste como a plataforma se comunica com você.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Gênero de tratamento
                </label>
                <select
                  value={languageTone}
                  onChange={(e) => setLanguageTone(e.target.value as any)}
                  className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition-all cursor-pointer"
                >
                  <option value="FEMININE">Feminino</option>
                  <option value="MASCULINE_NEUTRAL">Masculino/neutro</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Escolha como você prefere que a plataforma se comunique com você.
                </p>
              </div>
            </div>
          </div>
          
          {/* EMAIL NOTIFICATIONS */}
          <div id="email" className="bg-card border border-border/40 rounded-[2.5rem] p-8 space-y-6 shadow-sm scroll-mt-6">
            <div className="flex items-center gap-3 border-b border-border/30 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-sage-light flex items-center justify-center">
                <Mail className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Lembretes Diários por E-mail</h2>
                <p className="text-xs text-muted-foreground">Fique em dia com seu cronograma matinal de forma automatizada.</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl border border-border/40 bg-background/50">
                <div className="space-y-0.5">
                  <span className="text-sm font-bold text-foreground">Receber Lembretes Matinais</span>
                  <p className="text-xs text-muted-foreground">
                    Ative para que o Vercel Cron envie seu resumo de ontem e pendências às primeiras horas do dia.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailReminderEnabled}
                    onChange={(e) => setEmailReminderEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                </label>
              </div>

              {emailReminderEnabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl border border-accent/20 bg-accent/5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Destinatário do E-mail
                    </label>
                    <input
                      type="email"
                      value={dailyReminderEmail}
                      onChange={(e) => setDailyReminderEmail(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition-all"
                      placeholder="e-mail de envio"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Horário Preferencial
                    </label>
                    <input
                      type="time"
                      value={emailReminderTime}
                      onChange={(e) => setEmailReminderTime(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition-all cursor-pointer"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 rounded-2xl border border-border/30 bg-muted/10 gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Canal de Envio</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Testar envio atual: <span className="font-semibold text-foreground">{dailyReminderEmail}</span>.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={handleTriggerEmailTest}
                  disabled={isSendingEmail}
                  className="rounded-xl border-accent/30 text-accent font-extrabold hover:bg-accent/5 text-xs h-11 active:scale-[0.98] shrink-0 w-full md:w-auto"
                >
                  {isSendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Disparando lembrete...
                    </>
                  ) : (
                    "Disparar e-mail de teste agora"
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* FORM ACTION SUBMIT */}
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="rounded-2xl px-8 font-bold shadow-md hover:scale-[1.01] transition-transform"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando no Banco...
                </>
              ) : (
                "Salvar Ajustes & Preferências"
              )}
            </Button>
          </div>
        </form>

        {/* SYSTEM / ADVANCED TOOLS COLLAPSIBLE ACCORDION */}
        <div className="bg-card border border-border/40 rounded-[2.5rem] shadow-sm relative overflow-hidden">
          <details 
            className="group" 
            open={isToolsOpen} 
            onToggle={(e) => setIsToolsOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary className="flex items-center justify-between p-8 cursor-pointer select-none list-none">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-muted border border-border flex items-center justify-center shrink-0">
                  <Wrench className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Ferramentas avançadas do sistema</h2>
                  <p className="text-xs text-muted-foreground">Ferramentas de diagnóstico e reconstrução de biblioteca.</p>
                </div>
              </div>
              <div className="text-muted-foreground group-open:rotate-180 transition-transform duration-200">
                <ChevronDown className="w-5 h-5" />
              </div>
            </summary>

            <div className="px-8 pb-8 space-y-6 border-t border-border/20 pt-6">
              {/* Warning Banner */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/40 border border-border/40 text-foreground text-xs">
                <ShieldAlert className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Use apenas se algo parecer fora do lugar</p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Estas ações avançadas e administrativas manipulam dados importantes da sua biblioteca diretamente. Use com cautela.
                  </p>
                </div>
              </div>

              {/* Integrity Diagnostics Panel */}
              <div className="border border-border/40 bg-background rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border/20 pb-3">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-foreground">Diagnóstico de Integridade</h3>
                    <p className="text-xs text-muted-foreground">Analise inconsistências do banco (blocos duplicados e cards órfãos).</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchDiagnostics}
                    disabled={isLoadingDiagnostics}
                    className="rounded-xl h-9 text-xs"
                  >
                    {isLoadingDiagnostics ? "Analisando..." : "Analisar Agora"}
                  </Button>
                </div>

                {diagnosticsData?.summary ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
                    <div className="bg-muted/20 border border-border/30 rounded-xl p-4 text-center">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Grupos Duplicados</span>
                      <span className="text-2xl font-black text-foreground mt-1 block">
                        {diagnosticsData.summary.duplicateBlockGroups}
                      </span>
                    </div>
                    <div className="bg-muted/20 border border-border/30 rounded-xl p-4 text-center">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Total Blocos Duplicados</span>
                      <span className={`text-2xl font-black mt-1 block ${diagnosticsData.summary.totalDuplicateBlocks > 0 ? "text-accent" : "text-foreground"}`}>
                        {diagnosticsData.summary.totalDuplicateBlocks}
                      </span>
                    </div>
                    <div className="bg-muted/20 border border-border/30 rounded-xl p-4 text-center">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Cards Órfãos</span>
                      <span className={`text-2xl font-black mt-1 block ${diagnosticsData.summary.orphanedFlashcards > 0 ? "text-accent" : "text-foreground"}`}>
                        {diagnosticsData.summary.orphanedFlashcards}
                      </span>
                    </div>
                  </div>
                ) : isLoadingDiagnostics ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">Clique em Analisar Agora para checar a saúde dos dados.</p>
                )}

                {diagnosticsData?.summary && (
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                    {(diagnosticsData.summary.totalDuplicateBlocks > 0 || diagnosticsData.summary.orphanedFlashcards > 0) ? (
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => handleFixDiagnostics("fix_all")}
                        disabled={isFixingDiagnostics}
                        className="rounded-xl text-xs h-10 px-5 bg-accent border-accent text-accent-foreground hover:scale-[1.01] transition-transform"
                      >
                        {isFixingDiagnostics ? "Executando Correções..." : "Corrigir Todas Inconsistências"}
                      </Button>
                    ) : (
                      <div className="text-xs font-bold text-foreground flex items-center bg-sage-light/10 px-3 py-2 rounded-xl border border-accent/20">
                        ✓ Nenhum erro ou duplicidade encontrado. Dados íntegros!
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Gerenciamento de Flashcards */}
              <div className="border border-border/40 bg-background rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border/20 pb-3">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-foreground">Gerenciamento de Flashcards</h3>
                    <p className="text-xs text-muted-foreground">Importe históricos ou limpe a base de cards do sistema.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Reset Section */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Resetar Flashcards</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Apague de forma irreversível todos os flashcards e revisões geradas, sem afetar seu cronograma de estudos ou blocos teóricos concluídos.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={resetConfirmText}
                        onChange={(e) => setResetConfirmText(e.target.value)}
                        placeholder="Digite APAGAR para confirmar"
                        className="flex-1 h-10 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent transition-all"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleResetFlashcards}
                        disabled={isResetting}
                        className="rounded-xl h-10 text-xs px-4 border-rose-200/50 hover:bg-rose-50 hover:text-rose-600 dark:border-rose-900/30 dark:hover:bg-rose-950/20 text-rose-500 font-bold active:scale-[0.98] transition-all"
                      >
                        {isResetting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Apagar Tudo
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Import Section */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Importar Histórico CSV</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Importe flashcards a partir de um arquivo CSV. O sistema detectará automaticamente a matéria e removerá duplicados.
                    </p>
                    <div>
                      <label className="inline-flex items-center justify-center rounded-xl h-10 text-xs px-4 font-bold border border-accent/30 text-accent hover:bg-accent/5 active:scale-[0.98] cursor-pointer transition-all w-full sm:w-auto">
                        {isImporting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                            Importando...
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-3.5 h-3.5 mr-2" />
                            Selecionar CSV e Importar
                          </>
                        )}
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleImportCSV}
                          disabled={isImporting}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Import Summary Results */}
                {importSummary && (
                  <div className="mt-4 p-4 rounded-xl border border-accent/20 bg-accent/5 space-y-3">
                    <div className="flex items-center justify-between border-b border-accent/15 pb-2">
                      <span className="text-xs font-bold text-accent">Resumo da Importação</span>
                      <span className="text-[10px] text-muted-foreground">Concluído</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 bg-background rounded-lg border border-border/30">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Importados</span>
                        <span className="text-base font-black text-foreground">{importSummary.imported}</span>
                      </div>
                      <div className="p-2 bg-background rounded-lg border border-border/30">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Duplicados</span>
                        <span className="text-base font-black text-foreground">{importSummary.skippedDuplicates}</span>
                      </div>
                      <div className="p-2 bg-background rounded-lg border border-border/30">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Falhas</span>
                        <span className="text-base font-black text-foreground">{importSummary.failedRows}</span>
                      </div>
                    </div>

                    {importSummary.bySubject && Object.keys(importSummary.bySubject).length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Distribuição por Disciplina</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          {Object.entries(importSummary.bySubject).map(([subj, count]) => (
                            <div key={subj} className="flex justify-between items-center py-1 px-2 bg-background/50 rounded-lg border border-border/20">
                              <span className="text-muted-foreground truncate mr-2">{subj}</span>
                              <span className="font-bold text-foreground">{count} cards</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Advanced tool 1 */}
                <div className="border border-border/40 bg-background rounded-2xl p-5 flex flex-col justify-between h-40">
                  <div className="space-y-1">
                    <span className="text-xs font-extrabold text-foreground">Restaurar Estrutura de Apoios</span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Varre materiais integrados e regenera gabaritos ou resumos ocultos.
                    </p>
                  </div>
                  <div>
                    <RepairSupportsButton />
                  </div>
                </div>

                {/* Advanced tool 2 */}
                <div className="border border-border/40 bg-background rounded-2xl p-5 flex flex-col justify-between h-40">
                  <div className="space-y-1">
                    <span className="text-xs font-extrabold text-foreground">Reorganização Estrita</span>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Força a desestruturação total e regenera cronogramas a partir de seus PDFs originais.
                    </p>
                  </div>
                  <div className="flex items-center">
                    <OrganizeAllButton unorganizedCount={unorganizedCount} force={true} />
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* SEÇÃO DE ADMINISTRAÇÃO / CONVITES */}
        {isAdmin && (
          <div className="bg-card border border-border/40 rounded-[2.5rem] p-8 space-y-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-border/30 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-muted border border-border flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Administração</h2>
                <p className="text-xs text-muted-foreground">Gerencie o acesso de convidados na plataforma.</p>
              </div>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Nome de Exibição (Opcional)
                  </label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Ex: Nome completo"
                    className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    E-mail de Cadastro (Obrigatório)
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    placeholder="Ex: henrique.j.kehl@gmail.com"
                    className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={isSendingInvite}
                  className="rounded-xl text-xs h-10 px-5 bg-accent border-accent text-accent-foreground hover:scale-[1.01] transition-transform font-bold active:scale-[0.98]"
                >
                  {isSendingInvite ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar convite"
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
