"use client";

import * as React from "react";
import { Loader2, AlertCircle, ZoomIn, ZoomOut, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PdfBlockViewerProps {
  materialId: string;
  pageStart: number;
  pageEnd: number;
}

export function PdfBlockViewer({ materialId, pageStart, pageEnd }: PdfBlockViewerProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1.5);

  React.useEffect(() => {
    let isMounted = true;
    let renderTask: any = null;

    const renderPdf = async () => {
      setIsLoading(true);
      setError(null);

      // Clear previous render
      if (containerRef.current) containerRef.current.innerHTML = "";

      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;

        const url = `/api/materials/${materialId}/pdf`;
        const loadingTask = pdfjs.getDocument({ url, cMapPacked: true });
        const pdf = await loadingTask.promise;

        if (!isMounted) return;

        const container = containerRef.current;
        if (!container) return;

        const clampedStart = Math.max(1, pageStart);
        const clampedEnd = Math.min(pdf.numPages, pageEnd);

        for (let pageNum = clampedStart; pageNum <= clampedEnd; pageNum++) {
          if (!isMounted) break;

          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale });

          const pageWrapper = document.createElement("div");
          pageWrapper.className = "mb-6 rounded-xl overflow-hidden border border-border/20 shadow-sm bg-white";

          // Page label
          const label = document.createElement("div");
          label.className = "px-4 py-2 bg-muted/20 border-b border-border/10 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest";
          label.textContent = `Página ${pageNum}`;
          pageWrapper.appendChild(label);

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          canvas.style.maxWidth = "100%";
          canvas.style.height = "auto";
          canvas.style.display = "block";

          pageWrapper.appendChild(canvas);
          container.appendChild(pageWrapper);

          renderTask = page.render({ canvasContext: context!, viewport });
          await renderTask.promise;
        }

      } catch (err: any) {
        if (err?.name === "RenderingCancelledException") return;
        console.error("PDF render error:", err);
        if (isMounted) {
          setError(
            err?.message?.includes("fetch")
              ? "Não foi possível carregar o PDF. Verifique sua conexão."
              : "Não foi possível renderizar o PDF. O arquivo pode estar corrompido ou inacessível."
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    renderPdf();

    return () => {
      isMounted = false;
      if (renderTask) renderTask.cancel?.();
    };
  }, [materialId, pageStart, pageEnd, scale, retryCount]);

  const adjustZoom = (delta: number) => {
    setScale(prev => Math.min(Math.max(+(prev + delta).toFixed(2), 0.5), 3.0));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-card/80 backdrop-blur-sm p-2 px-3 rounded-xl border border-border/40 sticky top-2 z-10 shadow-sm">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg disabled:opacity-30"
            onClick={() => adjustZoom(-0.25)}
            disabled={isLoading || scale <= 0.5}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs font-bold text-muted-foreground w-10 text-center tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg disabled:opacity-30"
            onClick={() => adjustZoom(0.25)}
            disabled={isLoading || scale >= 3.0}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          {scale !== 1.5 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-lg text-[10px] font-bold text-muted-foreground hover:text-foreground"
              onClick={() => setScale(1.5)}
            >
              Reset
            </Button>
          )}
        </div>

        <a
          href={`/api/materials/${materialId}/pdf#page=${pageStart}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-accent transition-colors px-2 py-1.5 rounded-lg hover:bg-accent/5"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          PDF Completo
        </a>
      </div>

      {/* Render area */}
      <div className="relative min-h-[300px]">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm z-20 rounded-xl gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-accent" />
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Carregando PDF...</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Páginas {pageStart} a {pageEnd}
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="w-full flex flex-col items-center justify-center py-12 px-8 space-y-4 border border-red-100 bg-red-50/50 rounded-xl text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <div className="space-y-1">
              <h3 className="font-bold text-red-700 text-sm">Erro ao carregar o PDF</h3>
              <p className="text-xs text-red-600/70 max-w-xs">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-red-200 text-red-700 hover:bg-red-100 gap-2"
              onClick={() => setRetryCount(c => c + 1)}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Canvas container */}
        <div
          ref={containerRef}
          className="w-full overflow-x-auto"
          style={{ display: isLoading || error ? "none" : "block" }}
        />
      </div>
    </div>
  );
}
