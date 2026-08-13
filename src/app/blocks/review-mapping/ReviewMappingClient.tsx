"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, FileText, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BlockItem {
  id: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  confidence: number | null;
  officialTopicId: string | null;
  officialTopicName: string | null;
  subjectName: string;
  materialFileName: string;
}

interface OfficialTopic {
  id: string;
  subjectName: string;
  topicCode: string;
  title: string;
}

interface ReviewMappingClientProps {
  initialBlocks: BlockItem[];
  allOfficialTopics: OfficialTopic[];
}

export function ReviewMappingClient({
  initialBlocks,
  allOfficialTopics,
}: ReviewMappingClientProps) {
  const [blocks, setBlocks] = useState<BlockItem[]>(initialBlocks);
  const [selectedTopics, setSelectedTopics] = useState<Record<string, string>>({});
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});

  const handleAssignTopic = async (blockId: string) => {
    const topicId = selectedTopics[blockId];
    if (!topicId) {
      toast.error("Selecione um tópico na lista antes de salvar.");
      return;
    }

    setLoadingIds((prev) => ({ ...prev, [blockId]: true }));
    try {
      const res = await fetch(`/api/blocks/${blockId}/assign-topic`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officialTopicId: topicId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atribuir tópico.");

      toast.success(`Tópico atribuído ao bloco "${data.block?.title}" com sucesso!`);
      // Remover bloco atribuído da lista local
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar atribuição.");
    } finally {
      setLoadingIds((prev) => ({ ...prev, [blockId]: false }));
    }
  };

  if (blocks.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed rounded-3xl bg-card">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-xl font-bold">Nenhum bloco pendente de revisão</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Todos os blocos de estudo estão devidamente associados a um tópico confiável do edital.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-bold text-muted-foreground uppercase px-2">
        <span>{blocks.length} blocos requerem atenção</span>
      </div>

      <div className="space-y-4">
        {blocks.map((block) => {
          // Filtrar tópicos da matéria correspondente ao bloco
          const topicsForSubject = allOfficialTopics.filter(
            (t) =>
              t.subjectName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ===
              block.subjectName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          );

          const availableTopics = topicsForSubject.length > 0 ? topicsForSubject : allOfficialTopics;

          return (
            <div
              key={block.id}
              className="p-6 bg-card border border-border/80 rounded-2xl space-y-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-accent px-2.5 py-0.5 rounded-full bg-accent/10">
                      {block.subjectName}
                    </span>
                    <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Confiança: {block.confidence !== null ? `${Math.round(block.confidence * 100)}%` : "Indefinida"}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{block.title}</h3>
                </div>

                <div className="text-right text-xs text-muted-foreground">
                  <div className="flex items-center justify-end gap-1 font-medium">
                    <FileText className="w-3.5 h-3.5" />
                    {block.materialFileName}
                  </div>
                  <div className="flex items-center justify-end gap-1 font-semibold text-foreground mt-0.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    Págs {block.pageStart} a {block.pageEnd}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                <div className="md:col-span-3">
                  <select
                    className="w-full h-11 px-3 bg-background border border-border rounded-xl text-sm font-medium focus:ring-2 focus:ring-accent"
                    value={selectedTopics[block.id] || ""}
                    onChange={(e) =>
                      setSelectedTopics({ ...selectedTopics, [block.id]: e.target.value })
                    }
                  >
                    <option value="">Selecione o tópico oficial do edital...</option>
                    {availableTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.topicCode}] {t.title}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  onClick={() => handleAssignTopic(block.id)}
                  disabled={loadingIds[block.id] || !selectedTopics[block.id]}
                  className="rounded-xl h-11 font-bold"
                >
                  {loadingIds[block.id] ? "Salvando..." : "Confirmar Tópico"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
