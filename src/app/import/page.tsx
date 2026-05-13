"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  FolderSearch, 
  FilePlus2, 
  RefreshCcw, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  FileText,
  Import,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";

interface InboxFile {
  fileName: string;
  fullPath: string;
  size: number;
  modifiedAt: string;
  status: string; // NEW, ANALYZING, ORGANIZED, etc.
  isImported: boolean;
  materialId?: string;
  subjectName?: string;
}

export default function InboxPage() {
  const [inboxDir, setInboxDir] = useState<string>("");
  const [files, setFiles] = useState<InboxFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [organizingId, setOrganizingId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

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
      
      const successCount = data.results.filter((r: any) => r.status === "SUCCESS" || r.status === "ALREADY_IMPORTED").length;
      toast.success(`${successCount} arquivos processados com sucesso!`, { id: toastId });
      
      fetchInbox();
      setSelectedFiles([]);
    } catch (error: any) {
      toast.error("Erro ao importar arquivos", { id: toastId });
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
    } catch (error: any) {
      toast.error(error.message || "Erro ao organizar material", { id: toastId });
    } finally {
      setOrganizingId(null);
    }
  };

  const getStatusBadge = (file: InboxFile) => {
    if (!file.isImported) return <Badge variant="outline" className="rounded-full">Novo</Badge>;
    
    switch (file.status) {
      case "ORGANIZED":
        return <Badge className="rounded-full bg-green-500 text-white border-none">Organizado</Badge>;
      case "ANALYZING":
        return <Badge className="rounded-full bg-blue-500 text-white border-none">Aguardando Organização</Badge>;
      case "ERROR":
        return <Badge variant="destructive" className="rounded-full">Erro</Badge>;
      default:
        return <Badge variant="secondary" className="rounded-full">Importado</Badge>;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="space-y-8 max-w-6xl animate-in fade-in duration-700">
      <PageHeader 
        icon={FolderSearch}
        title="Inbox de Estudos"
        description="A aplicação monitora sua pasta local para encontrar novos materiais automaticamente."
      />

      <div className="bg-card rounded-[2.5rem] border border-border/40 p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Import className="w-4 h-4" />
              Pasta Configurada
            </h3>
            <code className="text-sm bg-muted px-4 py-2 rounded-xl block w-fit border border-border/20 text-accent font-medium">
              {inboxDir || "Carregando..."}
            </code>
            <p className="text-xs text-muted-foreground italic">
              Coloque seus PDFs nesta pasta e o Kehl encontrará os arquivos para organizar seus estudos.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="rounded-2xl h-12 px-4 border-border/60 text-muted-foreground hover:bg-muted/50"
              onClick={async () => {
                try {
                  await fetch("/api/inbox/open", { method: "POST" });
                } catch (e) {
                  toast.error("Não foi possível abrir a pasta.");
                }
              }}
            >
              <FolderSearch className="w-4 h-4" />
              <span className="sr-only md:not-sr-only md:ml-2">Abrir Pasta</span>
            </Button>

            <Button 
              variant="outline" 
              className="rounded-2xl h-12 px-6 border-accent/20 text-accent hover:bg-accent/5"
              onClick={fetchInbox}
              disabled={isLoading}
            >
              <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Buscar Novos
            </Button>
            
            <Button 
              className="rounded-2xl h-12 px-8 bg-accent text-white hover:bg-accent/90 shadow-md disabled:opacity-50"
              disabled={selectedFiles.length === 0 || isImporting}
              onClick={handleImportSelected}
            >
              {isImporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FilePlus2 className="w-4 h-4 mr-2" />
              )}
              Importar Selecionados ({selectedFiles.length})
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-lg flex items-center gap-2">
              Arquivos na Pasta
              {files.length > 0 && (
                <Badge variant="secondary" className="rounded-full bg-accent/5 text-accent border-accent/10">
                  {files.length}
                </Badge>
              )}
            </h4>
            {files.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs text-muted-foreground hover:text-accent"
                onClick={() => setSelectedFiles(files.filter(f => !f.isImported).map(f => f.fullPath))}
              >
                Selecionar Todos os Novos
              </Button>
            )}
          </div>

          <div className="grid gap-3">
            {isLoading ? (
              <div className="py-20 text-center space-y-4">
                <Loader2 className="w-10 h-10 animate-spin mx-auto text-accent/20" />
                <p className="text-muted-foreground text-sm font-medium">Escaneando sua pasta de entrada...</p>
              </div>
            ) : files.length === 0 ? (
              <div className="py-20 text-center space-y-6 border-2 border-dashed border-border/40 rounded-[2rem]">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                  <FileText className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-lg">Nenhum PDF encontrado</p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    Coloque seus materiais de estudo na pasta configurada acima para começar a organizar.
                  </p>
                </div>
              </div>
            ) : (
              files.map((file) => (
                <div 
                  key={file.fullPath}
                  className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${
                    selectedFiles.includes(file.fullPath) 
                      ? 'border-accent bg-accent/5 shadow-sm' 
                      : 'border-border/40 bg-card hover:border-accent/30'
                  } ${file.isImported ? '' : 'cursor-pointer'}`}
                  onClick={() => !file.isImported && handleToggleSelect(file.fullPath)}
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      file.isImported ? 'bg-accent/10 text-accent' : 'bg-muted'
                    }`}>
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-foreground leading-tight">{file.fileName}</h5>
                        {getStatusBadge(file)}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatSize(file.size)}</span>
                        <span>•</span>
                        <span>{new Date(file.modifiedAt).toLocaleDateString()}</span>
                        {file.subjectName && (
                          <span className="flex items-center gap-1 text-accent font-bold ml-2">
                            <ArrowRight className="w-3 h-3" />
                            {file.subjectName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {!file.isImported && (
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selectedFiles.includes(file.fullPath) 
                          ? 'bg-accent border-accent text-white' 
                          : 'border-border/60'
                      }`}>
                        {selectedFiles.includes(file.fullPath) && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                    )}
                    
                    {file.isImported && file.status !== "ORGANIZED" && file.materialId && (
                      <Button 
                        size="sm" 
                        className="rounded-xl h-9 bg-accent text-white hover:bg-accent/90 gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOrganize(file.materialId!);
                        }}
                        disabled={organizingId === file.materialId}
                      >
                        {organizingId === file.materialId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        Organizar com IA
                      </Button>
                    )}

                    {file.status === "ORGANIZED" && (
                      <Button 
                        variant="secondary"
                        size="sm" 
                        className="rounded-xl h-9 gap-2"
                        asChild
                      >
                        <Link href="/materials">
                          Ver na Biblioteca
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-accent/5 p-8 rounded-[2rem] border border-accent/10 space-y-4">
          <h4 className="font-bold text-accent flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            O que acontece após importar?
          </h4>
          <ul className="space-y-3 text-sm text-accent/80 font-medium">
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-[10px] shrink-0">1</span>
              A IA identifica a matéria principal do PDF.
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-[10px] shrink-0">2</span>
              O material é vinculado ou cria uma nova matéria.
            </li>
            <li className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-[10px] shrink-0">3</span>
              Você poderá organizar e criar blocos automaticamente.
            </li>
          </ul>
        </div>
        
        <div className="bg-muted/30 p-8 rounded-[2rem] border border-border/40 flex flex-col justify-between gap-6">
          <div className="space-y-2">
            <h4 className="font-bold flex items-center gap-2">
              <RefreshCcw className="w-5 h-5 text-muted-foreground" />
              Pronto para estudar?
            </h4>
            <p className="text-sm text-muted-foreground">
              Vá para a sua biblioteca para ver todos os materiais já organizados.
            </p>
          </div>
          <Button variant="outline" className="w-fit rounded-xl gap-2 border-border/60" asChild>
            <Link href="/materials">
              Ver Biblioteca
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
