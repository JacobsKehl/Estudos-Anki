"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  FileText,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SimpleMaterial {
  id: string;
  fileName: string;
  provider: string;
  totalPages: number | null;
}

interface HybridBlockWizardProps {
  subjectId: string;
  cfcMaterials: SimpleMaterial[];
  estrategiaMaterials: SimpleMaterial[];
}

export function HybridBlockWizard({
  subjectId,
  cfcMaterials,
  estrategiaMaterials,
}: HybridBlockWizardProps) {
  const router = useRouter();

  // Estados do formulário
  const [selectedCfcId, setSelectedCfcId] = React.useState("");
  const [selectedEstrategiaIds, setSelectedEstrategiaIds] = React.useState<string[]>([]);
  const [targetTheme, setTargetTheme] = React.useState("");
  const [availableMinutes, setAvailableMinutes] = React.useState(90);
  const [goal, setGoal] = React.useState("");

  // Estados de processamento
  const [generationRunId, setGenerationRunId] = React.useState("");
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false);
  const [isLoadingConfirm, setIsLoadingConfirm] = React.useState(false);
  const [previewData, setPreviewData] = React.useState<any | null>(null);
  const [previewToken, setPreviewToken] = React.useState("");
  const [tokenError, setTokenError] = React.useState("");

  // Inicializa generationRunId uma única vez
  React.useEffect(() => {
    setGenerationRunId("run-" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36));
  }, []);

  const handleEstrategiaToggle = (id: string) => {
    setSelectedEstrategiaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGeneratePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCfcId || selectedEstrategiaIds.length === 0 || !targetTheme.trim()) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setIsLoadingPreview(true);
    setPreviewData(null);
    setPreviewToken("");
    setTokenError("");

    try {
      const res = await fetch("/api/hybrid-blocks/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId,
          generationRunId,
          cfcMaterialId: selectedCfcId,
          estrategiaMaterialIds: selectedEstrategiaIds,
          targetTheme,
          goal,
          availableMinutes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "HYBRID_ENGINE_NOT_CONFIGURED") {
          throw new Error("O motor híbrido ainda não está configurado no servidor.");
        }
        throw new Error(data.error || "Erro ao gerar preview.");
      }

      setPreviewData(data.preview);
      setPreviewToken(data.previewToken);
      toast.success("Preview gerado com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro desconhecido ao gerar preview.");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleConfirmBlock = async () => {
    if (!previewData || !previewToken) return;

    setIsLoadingConfirm(true);
    try {
      const res = await fetch("/api/hybrid-blocks/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: previewData,
          previewToken,
          subjectId,
          availableMinutes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "INVALID_PREVIEW_TOKEN" && data.error.includes("expirado")) {
          setTokenError("O token de preview expirou (validade de 30 minutos). Por favor, gere o preview novamente.");
          toast.error("Token expirado. Gere um novo preview.");
        } else {
          throw new Error(data.error || "Erro ao confirmar bloco.");
        }
        return;
      }

      toast.success("Bloco Híbrido 80/20 criado e salvo com sucesso!");
      router.push(`/subjects/${subjectId}`);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro desconhecido ao confirmar bloco.");
    } finally {
      setIsLoadingConfirm(false);
    }
  };

  const hasBlockingWarnings = previewData?.blockingWarnings?.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {/* Coluna 1: Configuração */}
      <Card className="rounded-3xl border border-border/80 bg-card/50 backdrop-blur-md shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent animate-pulse" />
            Configuração do Bloco
          </CardTitle>
          <CardDescription>
            Selecione as fontes e defina o tema do seu bloco híbrido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGeneratePreview} className="space-y-6">
            {/* CFC Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                1. Material de Ancoragem (CFC) <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                value={selectedCfcId}
                onChange={(e) => setSelectedCfcId(e.target.value)}
              >
                <option value="">Selecione o CFC...</option>
                {cfcMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    📌 {m.fileName} ({m.totalPages || 0} págs)
                  </option>
                ))}
              </select>
            </div>

            {/* Estratégia Selection (Múltiplos) */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                2. Materiais de Aprofundamento (Estratégia) <span className="text-red-500">*</span>
              </label>
              <div className="max-h-48 overflow-y-auto border border-border rounded-xl p-3 space-y-2 bg-background/50">
                {estrategiaMaterials.length === 0 ? (
                  <span className="text-xs text-muted-foreground block py-2">
                    Nenhum material Estratégia encontrado nesta disciplina.
                  </span>
                ) : (
                  estrategiaMaterials.map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer select-none transition-colors ${
                        selectedEstrategiaIds.includes(m.id)
                          ? "bg-accent/5 border-accent text-accent-foreground"
                          : "border-transparent hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-input focus:ring-accent accent-accent"
                        checked={selectedEstrategiaIds.includes(m.id)}
                        onChange={() => handleEstrategiaToggle(m.id)}
                      />
                      <span className="text-xs font-medium line-clamp-2">
                        📚 {m.fileName} ({m.totalPages || 0} págs)
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Tema */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                3. Tema Focado <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="text"
                className="w-full h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Ex: Atos Administrativos: Requisitos e Atributos"
                value={targetTheme}
                onChange={(e) => setTargetTheme(e.target.value)}
              />
            </div>

            {/* Tempo Disponível */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                4. Tempo Máximo de Estudo (Minutos)
              </label>
              <div className="flex gap-4 items-center">
                <input
                  type="number"
                  min={30}
                  max={480}
                  className="w-24 h-11 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  value={availableMinutes}
                  onChange={(e) => setAvailableMinutes(parseInt(e.target.value) || 90)}
                />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Mínimo de 30 minutos recomendados.
                </span>
              </div>
            </div>

            {/* Meta Opcional */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                5. Objetivo de Estudo (Opcional)
              </label>
              <textarea
                className="w-full min-h-[80px] rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                placeholder="Ex: Focar nas regras de invalidação e decadência administrativa..."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={isLoadingPreview || isLoadingConfirm}
              className="w-full h-12 rounded-xl bg-accent text-white hover:bg-accent/90 font-bold gap-2"
            >
              {isLoadingPreview ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analisando Estrutura...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Gerar Análise Híbrida 80/20
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Coluna 2: Preview & Confirmação */}
      <Card className="rounded-3xl border border-border/80 bg-card/50 backdrop-blur-md shadow-xl min-h-[400px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            Análise e Preview Híbrido
          </CardTitle>
          <CardDescription>
            Aqui aparecerá o resultado da divisão 80/20 após a análise.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col justify-center">
          {isLoadingPreview && (
            <div className="flex flex-col items-center justify-center space-y-4 py-20">
              <Loader2 className="w-10 h-10 animate-spin text-accent" />
              <p className="text-sm font-medium text-muted-foreground animate-pulse">
                A IA está cruzando os materiais e mapeando as relevâncias...
              </p>
            </div>
          )}

          {!isLoadingPreview && !previewData && (
            <div className="text-center py-20 space-y-4 text-muted-foreground">
              <HelpCircle className="w-12 h-12 mx-auto stroke-[1.5]" />
              <p className="text-sm max-w-xs mx-auto">
                Selecione as fontes e clique em &quot;Gerar Análise Híbrida&quot; para visualizar os blocos.
              </p>
            </div>
          )}

          {tokenError && (
            <div className="p-4 rounded-2xl bg-red-500/[0.04] border border-red-500/20 text-red-600 text-xs font-medium space-y-3 mb-6">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{tokenError}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full text-red-600 border-red-500/20 hover:bg-red-50"
                onClick={handleGeneratePreview}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Gerar Novo Preview
              </Button>
            </div>
          )}

          {!isLoadingPreview && previewData && (
            <div className="space-y-6 flex-grow flex flex-col">
              {/* Avisos */}
              {previewData.blockingWarnings.length > 0 && (
                <div className="p-4 rounded-2xl bg-red-500/[0.04] border border-red-500/20 text-red-600 text-xs font-medium space-y-2">
                  <span className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Erros Bloqueantes (Criação Impedida):
                  </span>
                  <ul className="list-disc list-inside space-y-1">
                    {previewData.blockingWarnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {previewData.warnings.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20 text-amber-700 text-xs font-medium space-y-2">
                  <span className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Avisos da IA:
                  </span>
                  <ul className="list-disc list-inside space-y-1">
                    {previewData.warnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Resultado da divisão */}
              <div className="space-y-4 flex-grow">
                <div className="space-y-1">
                  <h4 className="font-black text-sm text-foreground">{previewData.title}</h4>
                  <p className="text-xs text-muted-foreground">Método: 80/20 Híbrido</p>
                </div>

                <div className="space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Segmentos de Páginas Selecionados:
                  </h5>
                  <div className="space-y-2">
                    {previewData.sources.map((s: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-border/80 bg-background/50 space-y-2"
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-foreground line-clamp-1">
                            {s.sourceRole === "ANCHOR_8020" ? "📌 CFC (Âncora)" : "📚 Estratégia"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{s.fileName}</span>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {s.segments.map((seg: any, sIdx: number) => (
                            <span
                              key={sIdx}
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                seg.disposition === "READ"
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                                  : seg.disposition === "CONSULT"
                                  ? "bg-sky-500/10 border-sky-500/20 text-sky-600"
                                  : "bg-muted border-border text-muted-foreground"
                              }`}
                            >
                              pág. {seg.pageStart}-{seg.pageEnd} ({seg.disposition})
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {previewData.flashcardSeeds.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      Flashcards Criados (PENDING_APPROVAL): {previewData.flashcardSeeds.length} cards
                    </span>
                  </div>
                )}
              </div>

              {/* Botão de Confirmação Final */}
              <div className="pt-4 border-t border-border/30 mt-auto">
                <Button
                  onClick={handleConfirmBlock}
                  disabled={isLoadingConfirm || hasBlockingWarnings || !previewToken}
                  className="w-full h-12 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold gap-2 shadow-lg shadow-emerald-500/10"
                >
                  {isLoadingConfirm ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando Bloco no Cronograma...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Confirmar e Iniciar Estudo 80/20
                    </>
                  )}
                </Button>
                {hasBlockingWarnings && (
                  <p className="text-[10px] text-red-500 text-center mt-2 font-medium">
                    Corrija as pendências bloqueantes antes de confirmar.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
