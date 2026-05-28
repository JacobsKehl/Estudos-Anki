"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLockup } from "@/components/brand/BrandLockup";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Ocorreu um erro ao processar sua solicitação.");
        setIsLoading(false);
        return;
      }

      setIsSubmitted(true);
      toast.success("Solicitação enviada com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro de conexão ao servidor.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-brand-cream px-4 py-12 relative overflow-hidden select-none">
      {/* Decorative background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-sage-light/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-beige-soft/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Brand Logo Lockup */}
        <div className="flex flex-col items-center text-center space-y-2 mb-2">
          <BrandLockup variant="compact" className="scale-110 mb-2" />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            Plataforma de Estudos Premium
          </p>
        </div>

        {/* Card Content */}
        <Card className="rounded-[2.5rem] border-accent/15 bg-card shadow-[0_12px_40px_rgba(111,138,112,0.06)] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/30 via-brand-beige-soft/30 to-accent/30" />
          
          <CardContent className="p-8 md:p-10 space-y-6">
            {!isSubmitted ? (
              <>
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold font-serif text-brand-sage-dark">Recuperar Senha</h2>
                  <p className="text-xs text-muted-foreground">
                    Digite seu e-mail para receber as instruções de redefinição
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      E-mail da sua conta
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/60" />
                      <Input
                        id="email"
                        type="email"
                        required
                        placeholder="estudante@kehl.study"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-11 bg-muted/20 border-border/60 focus:border-accent"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isLoading}
                    className="w-full h-11 rounded-xl text-xs font-bold uppercase tracking-wider mt-4 flex items-center justify-center gap-2 group transition-transform active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando link...
                      </>
                    ) : (
                      "Enviar instruções"
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <div className="text-center space-y-6 py-4 animate-in fade-in zoom-in-95 duration-350">
                <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                  <CheckCircle2 className="w-6 h-6 animate-pulse" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-lg font-bold font-serif text-brand-sage-dark">E-mail de Recuperação</h2>
                  <p className="text-xs text-muted-foreground px-2">
                    Se houver uma conta com o e-mail <span className="font-semibold text-brand-sage-dark">{email}</span>, enviaremos as instruções de recuperação.
                  </p>
                </div>

                <div className="border-t border-border/40 pt-4 text-left rounded-xl bg-brand-beige-soft/10 p-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-brand-sage-dark mb-1">
                    Próximos passos
                  </h4>
                  <ul className="text-[11px] text-muted-foreground list-disc list-inside space-y-1">
                    <li>Verifique sua caixa de entrada e pasta de spam.</li>
                    <li>Clique no link seguro enviado para redefinir sua senha.</li>
                    <li>O link expira em algumas horas.</li>
                  </ul>
                </div>
              </div>
            )}

            <div className="flex justify-center pt-2">
              <Link 
                href="/login" 
                className="text-xs font-bold text-muted-foreground hover:text-accent flex items-center gap-1.5 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                Voltar para o login
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="text-center">
          <p className="text-[11px] text-muted-foreground">
            Acesso exclusivo para estudantes convidados.
          </p>
        </div>

      </div>
    </div>
  );
}
