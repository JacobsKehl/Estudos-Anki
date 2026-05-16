"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { Upload, Loader2, FileText, Plus } from "lucide-react";
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
      
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer upload", { id: toastId });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[280px]">
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
        className="w-full rounded-2xl h-14 bg-white text-accent hover:bg-white/90 shadow-xl shadow-black/5 transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden border-none font-bold"
      >
        {isUploading ? (
          <div className="flex items-center justify-center">
            <Loader2 className="w-5 h-5 mr-3 animate-spin" />
            <span className="text-sm">{progress}%</span>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
            <span>Adicionar Material</span>
          </div>
        )}
      </Button>
      
      <div className="flex items-center gap-1.5 opacity-40">
         <FileText className="w-3 h-3 text-white" />
         <p className="text-[9px] text-white uppercase tracking-widest font-bold">
           PDF • MÁX 10MB
         </p>
      </div>
    </div>
  );
}
