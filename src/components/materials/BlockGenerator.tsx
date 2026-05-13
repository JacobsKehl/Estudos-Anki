"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Check, X, Edit2, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from "@/components/ui/dialog";

interface SuggestedBlock {
  title: string;
  description: string;
  pageStart: number;
  pageEnd: number;
  estimatedStudyMinutes: number;
  confidence: number;
}

interface BlockGeneratorProps {
  materialId: string;
  hasExistingBlocks: boolean;
  mode?: "inline" | "dialog";
}

export function BlockGenerator({ materialId, hasExistingBlocks, mode = "inline" }: BlockGeneratorProps) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<SuggestedBlock[]>([]);
  const [isApproving, setIsApproving] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const router = useRouter();

  const handleGenerate = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/materials/${materialId}/suggest-blocks`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Erro ao gerar sugestões");
      
      setSuggestions(data.suggestions);
      if (mode === "dialog") setIsDialogOpen(true);
      toast.success("Sugestões geradas com sucesso!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApproveAll = async () => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/materials/${materialId}/approve-blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: suggestions }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar blocos");
      
      if (data.count > 0) {
        toast.success(`${data.count} blocos de estudo criados com sucesso!`);
        setSuggestions([]);
        setIsDialogOpen(false);
        router.refresh();
      } else {
        toast.error("Nenhum bloco válido foi encontrado para salvar.");
      }
    } catch (error: any) {
      console.error("Erro na aprovação:", error);
      toast.error(error.message || "Não conseguimos salvar os blocos sugeridos. Tente novamente em instantes.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleRemoveSuggestion = (index: number) => {
    setSuggestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateSuggestion = (index: number, updated: SuggestedBlock) => {
    const newSuggestions = [...suggestions];
    newSuggestions[index] = updated;
    setSuggestions(newSuggestions);
    setEditingIndex(null);
  };

  const renderCuration = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-accent/5 p-6 rounded-3xl border border-accent/20">
        <div className="space-y-1">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            Sugestões da IA
          </h3>
          <p className="text-sm text-muted-foreground">
            Revise os blocos sugeridos antes de salvá-los no seu cronograma.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => { setSuggestions([]); setIsDialogOpen(false); }} disabled={isApproving}>
            Descartar
          </Button>
          <Button className="rounded-xl bg-accent hover:bg-accent/90" onClick={handleApproveAll} disabled={isApproving}>
            {isApproving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            Aprovar Todos
          </Button>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${mode === "dialog" ? "max-h-[60vh] overflow-y-auto px-1" : "md:grid-cols-2"} gap-4 pb-4`}>
        {suggestions.map((block, index) => (
          <Card key={index} className="p-6 rounded-[2rem] border-border/50 relative group overflow-hidden">
            {editingIndex === index ? (
              <div className="space-y-4">
                <Input 
                  value={block.title} 
                  onChange={(e) => handleUpdateSuggestion(index, { ...block, title: e.target.value })}
                  className="font-bold"
                  placeholder="Título do bloco"
                />
                <Textarea 
                  value={block.description} 
                  onChange={(e) => handleUpdateSuggestion(index, { ...block, description: e.target.value })}
                  className="text-sm min-h-[80px]"
                  placeholder="Descrição curta"
                />
                <div className="flex gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Pág. Inicial</label>
                    <Input 
                      type="number" 
                      value={block.pageStart} 
                      onChange={(e) => handleUpdateSuggestion(index, { ...block, pageStart: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Pág. Final</label>
                    <Input 
                      type="number" 
                      value={block.pageEnd} 
                      onChange={(e) => handleUpdateSuggestion(index, { ...block, pageEnd: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <Button size="sm" className="w-full rounded-xl" onClick={() => setEditingIndex(null)}>
                  Pronto
                </Button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-3">
                  <div className="px-3 py-1 bg-sage-light/20 text-accent rounded-full text-[10px] font-bold uppercase tracking-wider">
                    Páginas {block.pageStart} - {block.pageEnd}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEditingIndex(index)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleRemoveSuggestion(index)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <h4 className="font-bold text-lg mb-2 leading-tight">{block.title}</h4>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                  {block.description}
                </p>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/40">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Loader2 className="w-3 h-3" />
                    {block.estimatedStudyMinutes} min de estudo
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-accent/60">
                    <CheckCircle2 className="w-3 h-3" />
                    {(block.confidence * 100).toFixed(0)}% confiança
                  </div>
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );

  const renderTrigger = () => (
    <div className="flex flex-col gap-4">
      {hasExistingBlocks && mode === "inline" && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-4 py-2 rounded-xl border border-amber-100">
          <AlertTriangle className="w-3.5 h-3.5" />
          Este material já possui blocos de estudo criados.
        </div>
      )}
      <Button 
        onClick={handleGenerate} 
        disabled={isGenerating}
        className={`${mode === "inline" ? "h-12 px-6 rounded-2xl" : "h-7 text-[10px] px-3 rounded-lg font-bold"} bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20 transition-all hover:scale-[1.02] active:scale-95 gap-2`}
      >
        {isGenerating ? (
          <>
            <Loader2 className={`w-4 h-4 animate-spin`} />
            {mode === "inline" ? "Analisando conteúdo..." : "Analisando..."}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Sugerir blocos com IA
          </>
        )}
      </Button>
    </div>
  );

  if (mode === "dialog") {
    return (
      <>
        {renderTrigger()}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0 rounded-[2.5rem]">
            <div className="p-8 overflow-y-auto">
              <DialogHeader className="mb-6">
                <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  Sugestões de Estudo
                </DialogTitle>
              </DialogHeader>
              {suggestions.length > 0 ? renderCuration() : (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-accent mb-4" />
                  <p className="text-muted-foreground">Aguarde, a IA está analisando seu material...</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (suggestions.length > 0) {
    return renderCuration();
  }

  return renderTrigger();
}
