"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ShieldAlert, 
  Mail, 
  KeyRound, 
  Calendar, 
  LogIn, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  Lock,
  LogOut
} from "lucide-react";
import { toast } from "sonner";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { useLogout } from "@/hooks/useLogout";

interface AccountSecurityCardProps {
  email: string;
  emailVerified: boolean;
  provider?: string;
  createdAt?: string | Date;
  lastLoginAt?: string | Date | null;
}

export function AccountSecurityCard({
  email,
  emailVerified,
  provider = "E-mail e Senha",
  createdAt,
  lastLoginAt
}: AccountSecurityCardProps) {
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { performLogout, isLoggingOut } = useLogout();

  // Carregar/gerenciar cooldown persistido no localStorage
  useEffect(() => {
    const checkCooldown = () => {
      const savedTimestamp = localStorage.getItem("kehl_resend_verification_timestamp");
      if (savedTimestamp) {
        const elapsed = Date.now() - parseInt(savedTimestamp, 10);
        if (elapsed < 60000) {
          setCooldown(Math.ceil((60000 - elapsed) / 1000));
        } else {
          localStorage.removeItem("kehl_resend_verification_timestamp");
        }
      }
    };

    checkCooldown();

    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            localStorage.removeItem("kehl_resend_verification_timestamp");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  const handleResendVerification = async () => {
    if (cooldown > 0) return;
    setIsResending(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erro ao reenviar e-mail de confirmação.");
        setIsResending(false);
        return;
      }

      toast.success(data.message || "Link de confirmação enviado para seu e-mail!");
      
      // Iniciar cooldown de 60 segundos
      localStorage.setItem("kehl_resend_verification_timestamp", Date.now().toString());
      setCooldown(60);

    } catch (err) {
      console.error(err);
      toast.error("Erro de conexão ao servidor.");
    } finally {
      setIsResending(false);
    }
  };

  // Formatar datas de forma legível
  const formatDate = (dateValue?: string | Date | null) => {
    if (!dateValue) return "Não disponível";
    try {
      const dateObj = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
      return dateObj.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "Formato inválido";
    }
  };

  return (
    <Card className="rounded-[2.5rem] border-accent/10 bg-card/65 backdrop-blur-md shadow-[0_12px_30px_rgba(111,138,112,0.04)] select-none">
      <CardContent className="p-8 space-y-6">
        
        {/* Título e ícone */}
        <div className="flex items-center gap-3 pb-2 border-b border-border/40">
          <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-brand-sage-dark">
              Conta & Segurança
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Gerencie suas credenciais e verifique os acessos da estudante.
            </p>
          </div>
        </div>

        {/* Informações detalhadas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 py-2">
          
          {/* E-mail */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-2 rounded-xl bg-brand-beige-soft/20 text-brand-sage-dark/80">
              <Mail className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                E-mail de Acesso
              </span>
              <span className="text-xs font-semibold text-foreground break-all">
                {email}
              </span>
              
              {/* Badge de Verificação */}
              <div className="pt-1 flex items-center gap-1.5">
                {emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100/50">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Confirmado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100/50">
                    <AlertTriangle className="w-3 h-3 text-amber-600 animate-pulse" />
                    Confirmação Pendente
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Método de Login */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-2 rounded-xl bg-brand-beige-soft/20 text-brand-sage-dark/80">
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Método de Autenticação
              </span>
              <span className="text-xs font-semibold text-foreground">
                {provider}
              </span>
            </div>
          </div>

          {/* Criação da Conta */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-2 rounded-xl bg-brand-beige-soft/20 text-brand-sage-dark/80">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Conta Criada em
              </span>
              <span className="text-xs font-semibold text-foreground">
                {formatDate(createdAt)}
              </span>
            </div>
          </div>

          {/* Último Login */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-2 rounded-xl bg-brand-beige-soft/20 text-brand-sage-dark/80">
              <LogIn className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Último Acesso
              </span>
              <span className="text-xs font-semibold text-foreground">
                {formatDate(lastLoginAt)}
              </span>
            </div>
          </div>

        </div>

        {/* Ações de Segurança */}
        <div className="flex flex-wrap gap-3 pt-3 border-t border-border/40">
          
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsChangeModalOpen(true)}
            className="rounded-xl h-10 text-xs font-bold border-border/60 hover:bg-muted/30 flex items-center gap-2 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            Alterar Senha
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isLoggingOut}
            onClick={performLogout}
            className="rounded-xl h-10 text-xs font-bold border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            {isLoggingOut ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LogOut className="w-3.5 h-3.5" />
            )}
            Sair da Conta
          </Button>

          {!emailVerified && (
            <Button
              type="button"
              variant="outline"
              disabled={isResending || cooldown > 0}
              onClick={handleResendVerification}
              className={`rounded-xl h-10 text-xs font-bold border-accent/20 bg-accent/5 hover:bg-accent/10 text-accent flex items-center gap-2 cursor-pointer transition-all ${
                cooldown > 0 ? "opacity-70 pointer-events-none" : ""
              }`}
            >
              {isResending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Enviando...
                </>
              ) : cooldown > 0 ? (
                <>
                  Reenviar em {cooldown}s
                </>
              ) : (
                <>
                  Reenviar Confirmação
                </>
              )}
            </Button>
          )}

        </div>

      </CardContent>

      {/* Modal de Alteração de Senha */}
      <ChangePasswordModal 
        open={isChangeModalOpen} 
        onOpenChange={setIsChangeModalOpen} 
      />
    </Card>
  );
}
