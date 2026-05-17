"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { Upload, Loader2, FileText, Plus, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface UploadResult {
  name: string;
  status: "success" | "error" | "duplicate";
  message: string;
}

export function CloudUploadButton() {
  const [isUploading, setIsUploading] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  
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
    setUploadResults([]);
    
    const toastId = toast.loading(`Preparando upload de ${validFiles.length} arquivo(s)...`);
    const results: UploadResult[] = [];

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
          
          if (res.status === 409 && data.error === "duplicate") {
            results.push({
              name: file.name,
              status: "duplicate",
              message: data.message || "Arquivo duplicado detectado"
            });
          } else if (!res.ok) {
            results.push({
              name: file.name,
              status: "error",
              message: data.message || data.error || "Erro desconhecido no servidor"
            });
          } else {
            results.push({
              name: file.name,
              status: "success",
              message: "Upload realizado com sucesso"
            });
          }
        } catch (err: any) {
          console.error(`Erro ao subir ${file.name}:`, err);
          results.push({
            name: file.name,
            status: "error",
            message: "Erro de conexão de rede ou interrupção do envio"
          });
        }
      }

      const successCount = results.filter(r => r.status === "success").length;
      const duplicateCount = results.filter(r => r.status === "duplicate").length;
      const errorCount = results.filter(r => r.status === "error").length;

      if (successCount === validFiles.length) {
        toast.success(`Todos os ${successCount} PDFs foram salvos com sucesso!`, { id: toastId });
      } else {
        toast.error(`Upload completo: ${successCount} salvos, ${duplicateCount} duplicados, ${errorCount} erros`, { id: toastId });
      }

      setUploadResults(results);
      setShowReport(true);
      
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: any) {
      toast.error("Erro crítico no processo de upload", { id: toastId });
    } finally {
      setIsUploading(false);
      setCurrentFileIndex(0);
      setTotalFiles(0);
    }
  };

  const handleCloseReport = () => {
    setShowReport(false);
    setUploadResults([]);
    router.refresh();
  };

  const successCount = uploadResults.filter(r => r.status === "success").length;
  const duplicateCount = uploadResults.filter(r => r.status === "duplicate").length;
  const errorCount = uploadResults.filter(r => r.status === "error").length;

  return (
    <>
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
              <Loader2 className="w-5 h-5 mr-3 animate-spin text-accent" />
              <span className="text-sm font-bold text-accent">{currentFileIndex} / {totalFiles}</span>
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

      {/* Upload recap dialog */}
      <Dialog open={showReport} onOpenChange={handleCloseReport}>
        <DialogContent className="max-w-2xl w-full max-h-[85vh] flex flex-col p-8 overflow-hidden bg-card border border-border/80 shadow-2xl rounded-[2.5rem]">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <span>Recibo de Envio de Arquivos</span>
            </DialogTitle>
          </DialogHeader>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-3 mb-6 bg-muted/20 p-4 rounded-2xl border border-border/40">
            <div className="text-center space-y-1">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Salvos</p>
              <p className="text-2xl font-extrabold text-emerald-500">{successCount}</p>
            </div>
            <div className="text-center space-y-1 border-x border-border/40">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Duplicados</p>
              <p className="text-2xl font-extrabold text-amber-500">{duplicateCount}</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Erros</p>
              <p className="text-2xl font-extrabold text-rose-500">{errorCount}</p>
            </div>
          </div>

          {/* Scrollable File List */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[40vh] custom-scrollbar scrollbar-thin">
            {uploadResults.map((result, idx) => (
              <div 
                key={idx}
                className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl border transition-colors ${
                  result.status === "success" 
                    ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-800" 
                    : result.status === "duplicate"
                    ? "bg-amber-500/5 border-amber-500/10 text-amber-800"
                    : "bg-rose-500/5 border-rose-500/10 text-rose-800"
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {result.status === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
                  {result.status === "duplicate" && <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
                  {result.status === "error" && <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />}
                  
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{result.name}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{result.message}</p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                    result.status === "success" 
                      ? "bg-emerald-100 text-emerald-700" 
                      : result.status === "duplicate"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-rose-100 text-rose-700"
                  }`}>
                    {result.status === "success" ? "Concluído" : result.status === "duplicate" ? "Duplicado" : "Falhou"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="mt-8">
            <Button 
              onClick={handleCloseReport}
              className="w-full sm:w-auto px-8 rounded-xl h-12 text-sm font-bold bg-accent text-white hover:bg-accent/90 transition-all shadow-md shadow-accent/10"
            >
              Ok, Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
