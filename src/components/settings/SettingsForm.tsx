"use client";

import React, { useState, useEffect } from "react";
import { 
  User, 
  Target, 
  Sliders, 
  Mail, 
  Wrench, 
  ShieldAlert, 
  Loader2, 
  Info,
  ChevronDown,
  ChevronUp,
  Layout,
  Settings,
  Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RepairSupportsButton } from "@/components/materials/RepairSupportsButton";
import { OrganizeAllButton } from "@/components/materials/OrganizeAllButton";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";
import { toast } from "sonner";

interface SettingsFormProps {
  unorganizedCount: number;
}

export function SettingsForm({ unorganizedCount }: SettingsFormProps) {
  const { preferences, updatePreferences, isLoading, syncWithServer } = useStudyPreferences();
  
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

  const [isSaving, setIsSaving] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);

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
  }, [preferences]);

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
    const toastId = toast.loading(`Preparando e-mail de lembrete diário para Henrique...`);

    try {
      // Disparar endpoint de cron enviando manual_key
      const response = await fetch("/api/cron/reminder?manual_key=kehl2025manual");
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
                <p className="text-xs text-muted-foreground">Ajuste o nível de cobrança da inteligência artificial para os flashcards.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Dificuldade das Questões e Flashcards
                </label>
                <select
                  value={flashcardDifficulty}
                  onChange={(e) => setFlashcardDifficulty(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition-all cursor-pointer"
                >
                  <option value="NORMAL_PLUS">Mais desafiadora (TRT/Concursos - Foco em Exceções, Prazos & Consequências)</option>
                  <option value="MEDIUM">Normal (Equilibrado com microcopy enxuto)</option>
                  <option value="EASY">Básica (Fixação de conceitos diretos)</option>
                </select>
                <p className="text-[11px] text-muted-foreground">
                  A opção <strong>Mais desafiadora</strong> instrui o gerador a construir clozes inteligentes sobre requisitos legais, regras rígidas, exceções e prazos de concursos reais, com respostas extremamente concisas.
                </p>
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
                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                  <Wrench className="w-5 h-5 text-rose-600" />
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
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50/50 border border-rose-100 text-rose-800 text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Use apenas se algo parecer fora do lugar</p>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Estas ações perigosas e administrativas manipulam dados importantes da sua biblioteca diretamente. Use com extrema cautela.
                  </p>
                </div>
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
      </div>
    </div>
  );
}
