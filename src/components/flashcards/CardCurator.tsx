"use client";

import { useState } from "react";
import { 
  Check, 
  Archive, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Undo2,
  Sparkles,
  HelpCircle,
  Brain,
  Trash2,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  type: string;
  difficulty: string;
  status: string;
}

interface CardCuratorProps {
  blockId: string;
  initialCards: Flashcard[];
  onCurationComplete: () => void;
}

export function CardCurator({ blockId, initialCards, onCurationComplete }: CardCuratorProps) {
  const [cards, setCards] = useState<Flashcard[]>(initialCards);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [savingCardId, setSavingCardId] = useState<string | null>(null);
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // Local form state for the card currently being edited
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");

  const handleStartEdit = (card: Flashcard) => {
    setEditingCardId(card.id);
    setEditQuestion(card.question);
    setEditAnswer(card.answer);
  };

  const handleCancelEdit = () => {
    setEditingCardId(null);
  };

  const handleUpdateCardText = async (cardId: string) => {
    setSavingCardId(cardId);
    try {
      const response = await fetch(`/api/flashcards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: editQuestion,
          answer: editAnswer,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar alterações do card.");
      }

      const updatedCard = await response.json();
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, question: updatedCard.question, answer: updatedCard.answer } : c))
      );
      setEditingCardId(null);
      toast.success("Card atualizado!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar card.");
    } finally {
      setSavingCardId(null);
    }
  };

  const handleApprove = async (cardId: string, customQuestion?: string, customAnswer?: string) => {
    setSavingCardId(cardId);
    try {
      const body: any = { status: "APPROVED" };
      if (customQuestion !== undefined) body.question = customQuestion;
      if (customAnswer !== undefined) body.answer = customAnswer;

      const response = await fetch(`/api/flashcards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Erro ao aprovar o card.");
      }

      const updatedCard = await response.json();
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, status: "APPROVED", question: updatedCard.question, answer: updatedCard.answer } : c))
      );
      setEditingCardId(null);
      toast.success("Card aprovado e adicionado ao seu deck!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao aprovar card.");
    } finally {
      setSavingCardId(null);
    }
  };

  const handleArchive = async (cardId: string) => {
    setSavingCardId(cardId);
    try {
      const response = await fetch(`/api/flashcards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });

      if (!response.ok) {
        throw new Error("Erro ao arquivar o card.");
      }

      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, status: "ARCHIVED" } : c))
      );
      toast.success("Card arquivado e ocultado.");
    } catch (error: any) {
      toast.error(error.message || "Erro ao arquivar card.");
    } finally {
      setSavingCardId(null);
    }
  };

  const handleRevert = async (cardId: string) => {
    setSavingCardId(cardId);
    try {
      const response = await fetch(`/api/flashcards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PENDING_APPROVAL" }),
      });

      if (!response.ok) {
        throw new Error("Erro ao reverter o card.");
      }

      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, status: "PENDING_APPROVAL" } : c))
      );
      toast.success("Card movido de volta para aprovação.");
    } catch (error: any) {
      toast.error(error.message || "Erro ao reverter card.");
    } finally {
      setSavingCardId(null);
    }
  };

  const handleApproveAll = async () => {
    const pendingIds = cards
      .filter((c) => c.status === "PENDING_APPROVAL")
      .map((c) => c.id);

    if (pendingIds.length === 0) return;

    setIsBulkApproving(true);
    const toastId = toast.loading("Aprovando todos os cards...");
    try {
      const response = await fetch(`/api/flashcards/bulk`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: pendingIds,
          status: "APPROVED",
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao aprovar todos os cards.");
      }

      setCards((prev) =>
        prev.map((c) =>
          pendingIds.includes(c.id) ? { ...c, status: "APPROVED" } : c
        )
      );
      toast.success("Todos os cards foram aprovados com sucesso!", { id: toastId });
    } catch (error: any) {
      toast.error(error.message || "Erro ao aprovar todos os cards.", { id: toastId });
    } finally {
      setIsBulkApproving(false);
    }
  };

  const pendingCards = cards.filter((c) => c.status === "PENDING_APPROVAL");
  const approvedCards = cards.filter((c) => c.status === "APPROVED");
  const archivedCards = cards.filter((c) => c.status === "ARCHIVED");

  const totalCount = cards.length;
  const approvedCount = approvedCards.length;
  const pendingCount = pendingCards.length;

  return (
    <div className="bg-card rounded-[2.5rem] border border-border/40 p-8 shadow-sm space-y-8 animate-in fade-in duration-500">
      {/* Curation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent/10 text-accent">
              <Brain className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Curadoria de Flashcards</h2>
            <Badge variant="secondary" className="bg-accent/10 text-accent border-none rounded-full px-2.5">
              {pendingCount} pendentes
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Revise, edite e aprove os flashcards gerados por IA antes de enviá-los ao seu deck ativo de estudos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <Button
              variant="outline"
              onClick={handleApproveAll}
              disabled={isBulkApproving}
              className="rounded-xl border-accent/20 text-accent hover:bg-accent/5 font-bold gap-2"
            >
              {isBulkApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Aprovar Todos os {pendingCount}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={onCurationComplete}
            disabled={pendingCount > 0}
            className="rounded-xl font-bold gap-2 shadow-sm"
          >
            Concluir Curadoria
          </Button>
        </div>
      </div>

      {/* Progress Stats Summary */}
      <div className="grid grid-cols-3 gap-4 p-4 rounded-2xl bg-muted/30 border border-border/20 text-center">
        <div>
          <span className="block text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Aprovados</span>
          <span className="text-xl font-black text-accent">{approvedCount}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Pendentes</span>
          <span className="text-xl font-black text-amber-600">{pendingCount}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">Arquivados</span>
          <span className="text-xl font-black text-muted-foreground/80">{archivedCards.length}</span>
        </div>
      </div>

      {/* Cards List */}
      {totalCount === 0 ? (
        <div className="py-12 text-center text-muted-foreground space-y-3">
          <HelpCircle className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="font-medium text-sm">Nenhum flashcard encontrado neste bloco de estudo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card) => {
            const isEditing = editingCardId === card.id;
            const isSaving = savingCardId === card.id;

            return (
              <div
                key={card.id}
                className={`relative flex flex-col justify-between rounded-3xl border p-6 transition-all duration-300 ${
                  card.status === "APPROVED"
                    ? "bg-accent/[0.02] border-accent/20 shadow-[0_4px_20px_rgba(120,148,97,0.03)]"
                    : card.status === "ARCHIVED"
                    ? "bg-muted/10 border-border/30 opacity-60"
                    : "bg-white border-border/40 shadow-sm hover:shadow-md hover:border-accent/15"
                }`}
              >
                {/* Card Top Information */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] font-bold tracking-wide uppercase px-2 py-0.5 rounded bg-muted/40 border-none text-muted-foreground">
                      {card.type === "CLOZE" ? "Ocultamento (Cloze)" : "Pergunta e Resposta"}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] font-bold tracking-wide uppercase px-2 py-0.5 rounded bg-muted/40 border-none text-muted-foreground">
                      {card.difficulty === "HARD" ? "Difícil" : card.difficulty === "EASY" ? "Fácil" : "Médio"}
                    </Badge>
                  </div>
                  
                  {/* Status Banner */}
                  {card.status === "APPROVED" && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-accent uppercase tracking-wider">
                      <CheckCircle2 className="w-3.5 h-3.5 fill-accent/10" />
                      Aprovado
                    </span>
                  )}
                  {card.status === "ARCHIVED" && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      <Archive className="w-3.5 h-3.5" />
                      Arquivado
                    </span>
                  )}
                </div>

                {/* Edit Form or Read View */}
                {isEditing ? (
                  <div className="space-y-4 flex-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pergunta / Frente</label>
                      <textarea
                        className="w-full text-sm p-3 rounded-xl border border-border bg-muted/30 focus:outline-none focus:border-accent/50 min-h-[70px] resize-none font-medium leading-relaxed"
                        value={editQuestion}
                        onChange={(e) => setEditQuestion(e.target.value)}
                        placeholder="Edite a pergunta..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resposta / Verso</label>
                      <textarea
                        className="w-full text-sm p-3 rounded-xl border border-border bg-muted/30 focus:outline-none focus:border-accent/50 min-h-[50px] resize-none font-medium leading-relaxed"
                        value={editAnswer}
                        onChange={(e) => setEditAnswer(e.target.value)}
                        placeholder="Edite a resposta..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 flex-1">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 block">Frente</span>
                      <p className="text-sm font-semibold text-foreground/90 leading-relaxed">
                        {card.question}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 block">Verso</span>
                      <p className="text-sm font-medium text-foreground/75 leading-relaxed italic">
                        {card.answer}
                      </p>
                    </div>
                  </div>
                )}

                {/* Card Actions Footer */}
                <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-between gap-4">
                  {isEditing ? (
                    <div className="flex items-center gap-2 w-full justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEdit}
                        className="rounded-lg text-xs"
                      >
                        Cancelar
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleUpdateCardText(card.id)}
                        disabled={isSaving || !editQuestion.trim() || !editAnswer.trim()}
                        className="rounded-lg text-xs font-bold bg-muted hover:bg-muted/80 text-foreground"
                      >
                        {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                        Salvar
                      </Button>
                      {card.status === "PENDING_APPROVAL" && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApprove(card.id, editQuestion, editAnswer)}
                          disabled={isSaving || !editQuestion.trim() || !editAnswer.trim()}
                          className="rounded-lg text-xs font-bold"
                        >
                          {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                          Salvar & Aprovar
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      {card.status === "PENDING_APPROVAL" ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(card)}
                            className="rounded-lg text-xs text-muted-foreground hover:text-foreground font-medium"
                          >
                            Editar Card
                          </Button>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchive(card.id)}
                              disabled={isSaving}
                              className="rounded-lg text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Archive className="w-3.5 h-3.5 mr-1" />
                              Arquivar
                            </Button>
                            <Button
                              variant="soft"
                              size="sm"
                              onClick={() => handleApprove(card.id)}
                              disabled={isSaving}
                              className="rounded-lg text-xs font-bold bg-accent/10 text-accent hover:bg-accent/20"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Aprovar
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-muted-foreground">
                            {card.status === "APPROVED" ? "Pronto para estudo SRS" : "Card descartado"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevert(card.id)}
                            disabled={isSaving}
                            className="rounded-lg text-xs text-muted-foreground hover:text-foreground gap-1 font-medium"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            Desfazer
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
