"use client";

import * as React from "react";
import { Sparkles, CheckCircle2, XCircle, ArrowRightLeft, Loader2, Info, Folder } from "lucide-react";
import { OFFICIAL_TOPICS, OfficialTopic } from "@/lib/constants/official-topics";
import { toast } from "sonner";

export interface FlaggedBlockItem {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  originalFileName: string;
  officialTopicId?: string | null;
  officialTopicName?: string | null;
}

interface FlaggedBlocksPanelProps {
  initialBlocks?: FlaggedBlockItem[];
}

export function FlaggedBlocksPanel({ initialBlocks }: FlaggedBlocksPanelProps) {
  const [blocks, setBlocks] = React.useState<FlaggedBlockItem[]>(initialBlocks || []);
  const [loading, setLoading] = React.useState(!initialBlocks);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);
  const [reassignBlock, setReassignBlock] = React.useState<FlaggedBlockItem | null>(null);
  const [selectedTopicId, setSelectedTopicId] = React.useState<string>("");
  const [isReassigning, setIsReassigning] = React.useState(false);

  const fetchBlocks = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/flagged-blocks");
      if (res.ok) {
        const data = await res.json();
        setBlocks(data.blocks || []);
      }
    } catch (err) {
      console.error("Erro ao buscar blocos sinalizados:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!initialBlocks) {
      fetchBlocks();
    }
  }, [initialBlocks, fetchBlocks]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleConfirmSingle = async (id: string) => {
    try {
      setActionLoadingId(id);
      const res = await fetch(`/api/blocks/${id}/confirm-studied`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CONFIRM" })
      });
      if (res.ok) {
        toast.success("Bloco confirmado como estudado!");
        setBlocks(prev => prev.filter(b => b.id !== id));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        toast.error("Erro ao confirmar bloco.");
      }
    } catch (err) {
      toast.error("Erro na comunicação com o servidor.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDismissSingle = async (id: string) => {
    try {
      setActionLoadingId(id);
      const res = await fetch(`/api/blocks/${id}/confirm-studied`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DISMISS" })
      });
      if (res.ok) {
        toast.info("Bloco mantido na fila de leitura pendente.");
        setBlocks(prev => prev.filter(b => b.id !== id));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        toast.error("Erro ao atualizar bloco.");
      }
    } catch (err) {
      toast.error("Erro na comunicação com o servidor.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBatchConfirm = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setLoading(true);
    let successCount = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/blocks/${id}/confirm-studied`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "CONFIRM" })
        });
        if (res.ok) successCount++;
      } catch (err) {
        console.error(err);
      }
    }
    toast.success(`${successCount} blocos confirmados como já estudados!`);
    setSelectedIds(new Set());
    fetchBlocks();
  };

  const handleReassignTopicSubmit = async () => {
    if (!reassignBlock || !selectedTopicId) return;
    try {
      setIsReassigning(true);
      const res = await fetch(`/api/blocks/${reassignBlock.id}/assign-topic`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officialTopicId: selectedTopicId })
      });
      if (res.ok) {
        toast.success("Matéria e tópico reatribuídos com sucesso!");
        setReassignBlock(null);
        setSelectedTopicId("");
        fetchBlocks();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erro ao reatribuir tópico.");
      }
    } catch (err) {
      toast.error("Erro ao enviar reatribuição.");
    } finally {
      setIsReassigning(false);
    }
  };

  if (loading && blocks.length === 0) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 text-center text-sm text-amber-900 dark:text-amber-200">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-600" />
        Carregando painel de confirmação de blocos...
      </div>
    );
  }

  if (blocks.length === 0) {
    return null; // Nada a exibir se todos os blocos foram confirmados
  }

  return (
    <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 border border-amber-500/30 rounded-3xl p-6 space-y-5 text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in duration-300">
      {/* Cabeçalho do Painel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-amber-500/20">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-800 dark:text-amber-200 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold leading-tight text-amber-950 dark:text-amber-100">
              Painel de Confirmação de Blocos ({blocks.length} pendentes)
            </h3>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              Estes blocos podem já ter sido estudados por você. Confirme individualmente abaixo ou marque os checkboxes para lote.
            </p>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <button
            onClick={handleBatchConfirm}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirmar {selectedIds.size} Selecionado(s)
          </button>
        )}
      </div>

      {/* Lista Itemizada dos Blocos Sinalizados */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {blocks.map((block) => {
          const isChecked = selectedIds.has(block.id);
          const isBlockLoading = actionLoadingId === block.id;

          return (
            <div
              key={block.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isChecked
                  ? "bg-amber-500/20 border-amber-500/40"
                  : "bg-white/60 dark:bg-slate-900/60 border-amber-500/20 hover:border-amber-500/40"
              }`}
            >
              {/* Checkbox + Informações do Bloco */}
              <div className="flex items-start gap-3 min-w-0">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleSelect(block.id)}
                  className="mt-1 w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200">
                      {block.subjectName}
                    </span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Folder className="w-3 h-3" />
                      {block.originalFileName}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {block.title}
                  </h4>
                </div>
              </div>

              {/* Ações Individuais (3 Opções) */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                {/* 1. Já estudei */}
                <button
                  disabled={isBlockLoading}
                  onClick={() => handleConfirmSingle(block.id)}
                  title="Marcar como já estudado (Concluído)"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                >
                  {isBlockLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Já estudei
                </button>

                {/* 2. Ainda não */}
                <button
                  disabled={isBlockLoading}
                  onClick={() => handleDismissSingle(block.id)}
                  title="Manter como pendente para estudar do zero"
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Ainda não
                </button>

                {/* 3. Este bloco não é desta matéria */}
                <button
                  disabled={isBlockLoading}
                  onClick={() => {
                    setReassignBlock(block);
                    setSelectedTopicId(block.officialTopicId || "");
                  }}
                  title="Reatribuir a matéria/tópico correto"
                  className="px-3 py-1.5 bg-sky-100 dark:bg-sky-950/60 hover:bg-sky-200 text-sky-800 dark:text-sky-300 border border-sky-300/40 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Não é desta matéria
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal / Dialog de Reatribuição de Matéria (Opção 3) */}
      {reassignBlock && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Reatribuir Tópico / Matéria do Bloco
              </h4>
              <button
                onClick={() => setReassignBlock(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <p><strong>Bloco:</strong> {reassignBlock.title}</p>
              <p><strong>Matéria Atual:</strong> {reassignBlock.subjectName}</p>
              <p><strong>Arquivo de Origem:</strong> {reassignBlock.originalFileName}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Selecione o Tópico Oficial Correto:
              </label>
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-amber-500"
              >
                <option value="">-- Selecione o Tópico --</option>
                {OFFICIAL_TOPICS.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    [{topic.subjectName}] {topic.topicCode} — {topic.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setReassignBlock(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                disabled={!selectedTopicId || isReassigning}
                onClick={handleReassignTopicSubmit}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                {isReassigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Salvar Reatribuição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
