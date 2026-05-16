"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { Upload, Loader2, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function CloudUploadButton() {
  const [isUploading, setIsUploading] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    
    // Validar se todos são PDFs
    const invalidFiles = fileList.filter(f => !f.name.toLowerCase().endsWith(".pdf"));
    if (invalidFiles.length > 0) {
      toast.error(`${invalidFiles.length} arquivo(s) não são PDFs e serão ignorados.`);
    }

    const validFiles = fileList.filter(f => f.name.toLowerCase().endsWith(".pdf"));
    if (validFiles.length === 0) return;

    setIsUploading(true);
    setTotalFiles(validFiles.length);
    const toastId = toast.loading(`Preparando upload de ${validFiles.length} arquivo(s)...`);

    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        setCurrentFileIndex(i + 1);
        
        toast.loading(`Subindo (${i + 1}/${validFiles.length}): ${file.name}`, { id: toastId });

        try {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch("/api/materials/upload", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Erro no upload");
          
          successCount++;
        } catch (err: any) {
          console.error(`Erro ao subir ${file.name}:`, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} arquivo(s) salvos na nuvem!`, { id: toastId });
      } else {
        toast.error("Falha ao subir os arquivos.", { id: toastId });
      }

      if (errorCount > 0) {
        toast.error(`${errorCount} arquivo(s) falharam.`);
      }
      
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (error: any) {
      toast.error("Erro crítico no processo de upload", { id: toastId });
    } finally {
      setIsUploading(false);
      setCurrentFileIndex(0);
      setTotalFiles(0);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[280px]">
      <input
        type="file"
        accept=".pdf"
        multiple
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
            <span className="text-sm">{currentFileIndex} / {totalFiles}</span>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
            <span>Adicionar Materiais</span>
          </div>
        )}
      </Button>
      
      <div className="flex items-center gap-1.5 opacity-40">
         <FileText className="w-3 h-3 text-white" />
         <p className="text-[9px] text-white uppercase tracking-widest font-bold">
           PDF • MÁULTIPLOS ARQUIVOS
         </p>
      </div>
    </div>
  );
}
