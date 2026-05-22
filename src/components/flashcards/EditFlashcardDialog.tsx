"use client";

import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  type: string;
}

interface EditFlashcardDialogProps {
  flashcard: Flashcard | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, question: string, answer: string, type: string) => void;
}

export function EditFlashcardDialog({ 
  flashcard, 
  isOpen, 
  onClose, 
  onSave 
}: EditFlashcardDialogProps) {
  const [question, setQuestion] = useState(flashcard?.question || "");
  const [answer, setAnswer] = useState(flashcard?.answer || "");
  const [type, setType] = useState(flashcard?.type || "QUESTION_ANSWER");
  const [isSaving, setIsSaving] = useState(false);

  // Update local state when flashcard changes
  useEffect(() => {
    if (flashcard) {
      setQuestion(flashcard.question);
      setAnswer(flashcard.answer);
      setType(flashcard.type);
    }
  }, [flashcard]);

  const handleSave = async () => {
    if (!flashcard) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/flashcards/${flashcard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer, type }),
      });

      if (!response.ok) throw new Error("Erro ao salvar");

      onSave(flashcard.id, question, answer, type);
      onClose();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar alterações.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] rounded-3xl">
        <DialogHeader>
          <DialogTitle>Editar Flashcard</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Card</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="QUESTION_ANSWER">Pergunta & Resposta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="question">
              {type === 'CLOZE' ? 'Texto com Lacuna' : 'Pergunta'}
            </Label>
            <Textarea 
              id="question" 
              value={question} 
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuestion(e.target.value)}
              className="rounded-xl min-h-[100px]"
              placeholder={type === 'CLOZE' ? "Use {{c1::palavra}} para omitir um termo" : "Sua pergunta aqui..."}
            />
            {type === 'CLOZE' && (
              <p className="text-[10px] text-muted-foreground">
                Dica: O termo dentro de <code className="bg-muted px-1 rounded">{"{{c1::...}}"}</code> será ocultado durante a revisão.
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="answer">
              {type === 'CLOZE' ? 'Resposta da Lacuna (opcional)' : 'Resposta'}
            </Label>
            <Textarea 
              id="answer" 
              value={answer} 
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAnswer(e.target.value)}
              className="rounded-xl min-h-[100px]"
              placeholder="Resposta ou termo omitido..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="rounded-xl bg-accent text-accent-foreground">
            {isSaving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
