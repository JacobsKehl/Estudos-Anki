"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { 
  FolderSearch, 
  FilePlus2, 
  RefreshCcw, 
  CheckCircle2, 
  Loader2,
  FileText,
  Import,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface InboxFile {
  fileName: string;
  fullPath: string;
  size: number;
  modifiedAt: string;
  status: string;
  isImported: boolean;
  materialId?: string;
  subjectName?: string;
}

export function InboxPanel() {
  const [inboxDir, setInboxDir] = useState<string>("");
  const [files, setFiles] = useState<InboxFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [organizingId, setOrganizingId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const router = useRouter();

  const fetchInbox = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/inbox");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInboxDir(data.inboxDir);
      setFiles(data.files);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, []);

  const handleToggleSelect = (path: string) => {
    setSelectedFiles(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const handleSelectAll = () => {
    const unimportedFiles = files.filter(f => !f.isImported).map(f => f.fullPath);
    if (selectedFiles.length === unimportedFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(unimportedFiles);
    }
  };

  const handleImportSelected = async () => {
    if (selectedFiles.length === 0) return;
    
    setIsImporting(true);
    const toastId = toast.loading(`Importando ${selectedFiles.length} arquivos...`);
    
    try {
      const filesToImport = files.filter(f => selectedFiles.includes(f.fullPath));
      const res = await fetch("/api/inbox/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: filesToImport.map(f => ({ fullPath: f.fullPath, fileName: f.fileName })) })
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Erro na importação");

      const results = data.results || [];
      const success = results.filter((r: any) => r.status === "SUCCESS");

      if (success.length > 0) {
        toast.success(`${success.length} PDF(s) importado(s).`, { id: toastId });
      } else {
        toast.error(`Falha ao importar os arquivos.`, { id: toastId });
      }
      
      fetchInbox();
      setSelectedFiles([]);
      router.refresh(); // Refresh the materials list below
    } catch (error: any) {
      toast.error(error.message || "Erro na importação", { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  const handleOrganize = async (materialId: string) => {
    setOrganizingId(materialId);
    const toastId = toast.loading("Analisando estrutura e criando blocos...");
    
    try {
      const res = await fetch(`/api/materials/${materialId}/organize`, {
        method: "POST"
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      toast.success(data.message || "Material organizado com sucesso!", { id: toastId });
      fetchInbox();
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Erro ao organizar material", { id: toastId });
    } finally {
      setOrganizingId(null);
    }
  };

  const getStatusBadge = (file: InboxFile) => {
    if (!file.isImported) return <Badge variant="outline" className="rounded-full bg-accent/5 text-accent border-accent/20">Novo Arquivo</Badge>;
    
    switch (file.status) {
      case "ORGANIZED":
        return <Badge className="rounded-full bg-sage-light text-accent border-none font-bold">Organizado</Badge>;
      case "ANALYZING":
        return <Badge className="rounded-full bg-blue-50 text-blue-600 border-none font-bold">Processando</Badge>;
      case "IMPORTED":
        return <Badge variant="secondary" className="rounded-full bg-accent/10 text-accent font-bold">Aguardando IA</Badge>;
      case "ERROR":
        return <Badge variant="destructive" className="rounded-full font-bold">Erro</Badge>;
      default:
        return <Badge variant="secondary" className="rounded-full font-bold">Importado</Badge>;
    }
  };

  return (
    <div className="bg-card rounded-[2.5rem] border border-border/40 p-6 md:p-8 shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h3 className="font-extrabold text-lg flex items-center gap-2">
            <FolderSearch className="w-5 h-5 text-accent" />
            Scanner da Inbox
          </h3>
          <p className="text-sm text-muted-foreground">
            Buscando em: <code className="text-accent font-mono text-xs">{inboxDir || "..."}</code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {files.filter(f => !f.isImported).length > 0 && (
            <Button 
              variant="ghost" 
              className="rounded-xl h-10 px-4 text-muted-foreground hover:text-accent text-[10px] font-bold uppercase tracking-wider"
              onClick={handleSelectAll}
            >
              {selectedFiles.length === files.filter(f => !f.isImported).length ? "Desmarcar Todos" : "Selecionar Todos"}
            </Button>
          )}
          
          <Button 
            variant="outline" 
            className="rounded-xl h-10 px-4 border-border text-muted-foreground hover:bg-muted/50 text-xs font-bold uppercase tracking-wider flex-1 md:flex-none"
            onClick={fetchInbox}
            disabled={isLoading}
          >
            <RefreshCcw className={`w-3.5 h-3.5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Escanear
          </Button>
          
          <Button 
            className="rounded-xl h-10 px-6 bg-accent text-white hover:bg-accent/90 shadow-sm disabled:opacity-50 text-xs font-bold uppercase tracking-wider flex-1 md:flex-none"
            disabled={selectedFiles.length === 0 || isImporting}
            onClick={handleImportSelected}
          >
            {isImporting ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <FilePlus2 className="w-3.5 h-3.5 mr-2" />}
            Importar ({selectedFiles.length})
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-accent/50" />
          </div>
        ) : files.length === 0 ? (
          <div className="py-10 text-center space-y-2 border border-dashed border-border/40 rounded-3xl bg-muted/20">
            <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm font-bold">Pasta vazia</p>
            <p className="text-xs text-muted-foreground">Nenhum PDF encontrado na pasta local configurada.</p>
          </div>
        ) : (
          <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-accent/20">
            {files.map((file) => (
              <div 
                key={file.fullPath}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                  selectedFiles.includes(file.fullPath) 
                    ? 'border-accent/40 bg-accent/5' 
                    : 'border-border/40 bg-background hover:border-accent/30'
                } ${file.isImported ? '' : 'cursor-pointer'}`}
                onClick={() => !file.isImported && handleToggleSelect(file.fullPath)}
              >
                <div className="flex items-center gap-4 truncate">
                  {!file.isImported && (
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      selectedFiles.includes(file.fullPath) 
                        ? 'bg-accent border-accent text-white' 
                        : 'border-border/60'
                    }`}>
                      {selectedFiles.includes(file.fullPath) && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                  )}
                  <div className="truncate">
                    <h5 className="font-semibold text-sm leading-tight truncate pr-4">{file.fileName}</h5>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                  {getStatusBadge(file)}
                  
                  {file.isImported && file.status !== "ORGANIZED" && file.materialId && (
                    <Button 
                      size="sm" 
                      variant="secondary"
                      className="rounded-xl h-8 text-xs font-bold bg-accent/10 text-accent hover:bg-accent/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOrganize(file.materialId!);
                      }}
                      disabled={organizingId === file.materialId}
                    >
                      {organizingId === file.materialId ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                      ) : (
                        <Sparkles className="w-3 h-3 mr-1.5" />
                      )}
                      IA
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
