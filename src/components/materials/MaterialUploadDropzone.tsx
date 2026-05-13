"use client";

import * as React from "react";
import { UploadCloud, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface MaterialUploadDropzoneProps {
  subjects: { id: string, name: string }[];
}


export function MaterialUploadDropzone({ subjects }: MaterialUploadDropzoneProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadSuccess, setUploadSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  const [subjectId, setSubjectId] = React.useState(subjects[0]?.id || "");

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Apenas arquivos PDF são permitidos.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("O arquivo excede o limite de 50MB.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subjectId", subjectId); // Default subject for MVP

      const response = await fetch("/api/materials/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar arquivo");
      }

      setUploadSuccess(true);
      router.refresh(); // Refresh the Server Component to show new data
      setTimeout(() => setUploadSuccess(false), 3000);
      
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || "Falha na conexão.");
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Subject Selection (Simplified MVP) */}
      <div className="flex items-center gap-4 bg-sage-light/20 p-4 rounded-2xl border border-sage-light/50">
        <span className="text-sm font-medium">Matéria de destino:</span>
        <select 
          className="h-9 rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          {subjects.length > 0 ? (
            subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))
          ) : (
            <option value="">Nenhuma matéria encontrada</option>
          )}
        </select>
      </div>

      <div
        className={cn(
          "relative flex flex-col items-center justify-center w-full h-64 rounded-3xl border-2 border-dashed transition-all duration-300 ease-in-out overflow-hidden",
          isDragging
            ? "border-accent bg-sage-light/30 shadow-[0_0_40px_-10px_rgba(120,148,97,0.3)]"
            : "border-border hover:border-accent/50 hover:bg-muted/30 cursor-pointer",
          isUploading && "opacity-80 pointer-events-none"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isUploading) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={isUploading ? undefined : onDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="application/pdf"
          onChange={onFileSelect}
        />

        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <UploadCloud className="w-96 h-96" />
        </div>
        
        <div className="relative z-10 flex flex-col items-center gap-4 text-center p-6">
          <div className={cn(
            "flex items-center justify-center w-16 h-16 rounded-full transition-all duration-500",
            isDragging || uploadSuccess ? "bg-accent text-white scale-110" : "bg-muted text-muted-foreground",
            isUploading && "bg-sage-light text-accent"
          )}>
            {isUploading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : uploadSuccess ? (
              <CheckCircle2 className="w-8 h-8" />
            ) : isDragging ? (
              <UploadCloud className="w-8 h-8" />
            ) : (
              <FileText className="w-8 h-8" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-foreground">
              {isUploading ? "Enviando arquivo..." : uploadSuccess ? "Upload concluído!" : isDragging ? "Solte para enviar" : "Envie seu material"}
            </h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              {isUploading ? "Aguarde enquanto salvamos o documento." : "Arraste um arquivo PDF para cá ou clique para procurar no seu computador."}
            </p>
          </div>
          
          {!isUploading && !uploadSuccess && (
            <div className="mt-2 flex gap-2">
              <span className="px-3 py-1 rounded-full bg-muted text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                PDF
              </span>
              <span className="px-3 py-1 rounded-full bg-muted text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Max 50MB
              </span>
            </div>
          )}

          {error && (
            <div className="mt-2 text-sm text-error-text bg-error-bg px-4 py-2 rounded-xl">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
