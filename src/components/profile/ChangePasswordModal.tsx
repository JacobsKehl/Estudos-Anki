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
import { Lock, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ChangePasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordModal({
  open,
  onOpenChange
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Limpa estados locais ao abrir/fechar
  useEffect(() => {
    if (open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrorMessage("");
      setSuccessMessage("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!currentPassword) {
      setErrorMessage("Por favor, informe sua senha atual.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("A nova senha deve conter pelo menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("A nova senha e a confirmação não coincidem.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Ocorreu um erro ao alterar sua senha.");
        setIsSaving(false);
        return;
      }

      setSuccessMessage("Sua senha foi alterada com sucesso!");
      toast.success("Senha alterada com sucesso!");
      
      // Fecha o modal após 1.5s
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);

    } catch (err) {
      console.error(err);
      setErrorMessage("Erro de conexão ao servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-brand-cream border-accent/20">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold font-serif text-brand-sage-dark flex items-center gap-2">
            <Lock className="w-5 h-5 text-accent" />
            Alterar Senha de Acesso
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Sua senha deve conter no mínimo 8 caracteres.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Mensagem de Erro (Rose Suave) */}
          {errorMessage && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-xs font-medium animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mensagem de Sucesso (Sage Suave) */}
          {successMessage && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-medium animate-in fade-in slide-in-from-top-1 duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Senha Atual
              </Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Informe sua senha atual"
                disabled={isSaving || !!successMessage}
                className="bg-card h-11 border-border/60 focus:border-accent"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Nova Senha (mín. 8 caracteres)
              </Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Informe a nova senha"
                disabled={isSaving || !!successMessage}
                className="bg-card h-11 border-border/60 focus:border-accent"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Confirmar Nova Senha
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repita a nova senha"
                disabled={isSaving || !!successMessage}
                className="bg-card h-11 border-border/60 focus:border-accent"
              />
            </div>
          </div>

          <DialogFooter className="mt-6 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving || !!successMessage}
              className="rounded-xl h-11 text-xs font-bold border-border/60 hover:bg-muted"
            >
              Cancelar
            </Button>
            
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving || !!successMessage}
              className="rounded-xl h-11 text-xs font-bold px-6"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Alterar Senha"
              )}
            </Button>
          </DialogFooter>

        </form>
      </DialogContent>
    </Dialog>
  );
}
