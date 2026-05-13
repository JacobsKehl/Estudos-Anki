"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderSearch, Import, RefreshCcw, Loader2, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { toast } from "sonner";

interface InboxFile {
  name: string;
  isImported: boolean;
}

export function InboxSummaryCard() {
  const [inboxInfo, setInboxInfo] = useState<{ count: number, path: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInboxSummary = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/inbox");
      const data = await res.json();
      const newFiles = (data.files as InboxFile[])?.filter((f: InboxFile) => !f.isImported) || [];
      setInboxInfo({ count: newFiles.length, path: data.inboxDir });
    } catch (error) {
      console.error("Erro ao buscar resumo da inbox");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInboxSummary();
  }, []);

  return (
    <Card className="rounded-[2rem] border-border/40 shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/30 pb-4">
        <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Import className="w-4 h-4" />
          Pasta de Entrada
        </CardTitle>
        <CardDescription className="text-xs truncate" title={inboxInfo?.path}>
          {inboxInfo?.path || "Carregando caminho..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Novos PDFs:</span>
              <Badge variant={inboxInfo?.count ? "default" : "secondary"} className="rounded-full">
                {inboxInfo?.count || 0}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <Button variant="outline" className="w-full rounded-xl h-10 text-xs" asChild>
                <Link href="/import">
                  Ver arquivos na pasta
                  <ArrowRight className="w-3 h-3 ml-2" />
                </Link>
              </Button>
              <Button 
                variant="ghost" 
                className="w-full rounded-xl h-10 text-xs text-muted-foreground"
                onClick={fetchInboxSummary}
              >
                <RefreshCcw className="w-3 h-3 mr-2" />
                Atualizar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
