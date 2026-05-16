"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { Upload, Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function CloudUploadButton() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Por favor, selecione apenas arquivos PDF.");
      return;
    }

    setIsUploading(true);
    setProgress(10);
    const toastId = toast.loading(`Subindo "${file.name}" para a nuvem...`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      setProgress(30);
      const res = await fetch("/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      setProgress(80);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro no upload");

      setProgress(100);
      toast.success("PDF salvo na nuvem com sucesso!", { id: toastId });
      
      // Limpar o input
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      // Atualizar a página para mostrar o novo material
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer upload", { id: toastId });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <input
        type="file"
        accept=".pdf"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileSelect}
        disabled={isUploading}
      />
      
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="rounded-2xl h-14 px-8 bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95 group relative overflow-hidden"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
            Subindo... {progress}%
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 mr-3 group-hover:-translate-y-1 transition-transform" />
            Adicionar PDF (Nuvem)
          </>
        )}
      </Button>
      
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">
        Limite de 10MB por arquivo no plano grátis
      </p>
    </div>
  );
}
