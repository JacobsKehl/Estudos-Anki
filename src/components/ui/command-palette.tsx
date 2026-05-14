"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Target, BookOpen, BookMarked, RotateCw, Trophy,
  Sparkles, Search, Settings, X, Calendar
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon: React.ElementType;
  keywords?: string[];
}

const COMMANDS: CommandItem[] = [
  { id: "hoje", label: "Hoje", description: "Seu painel de estudos do dia", href: "/", icon: Target, keywords: ["home", "dashboard", "início"] },
  { id: "desempenho", label: "Desempenho", description: "Estatísticas e progresso", href: "/stats", icon: Trophy, keywords: ["stats", "métricas", "progresso"] },
  { id: "biblioteca", label: "Biblioteca", description: "Seus PDFs e materiais", href: "/materials", icon: BookOpen, keywords: ["materiais", "pdfs", "arquivos"] },
  { id: "materias", label: "Matérias", description: "Gerenciar disciplinas", href: "/subjects", icon: BookMarked, keywords: ["disciplinas", "subjects"] },
  { id: "cronograma", label: "Cronograma", description: "Visualize seu roteiro completo", href: "/schedule", icon: Calendar, keywords: ["schedule", "roteiro", "agenda"] },
  { id: "flashcards", label: "Repositório de Flashcards", description: "Gerenciar todos os cards", href: "/flashcards", icon: Sparkles, keywords: ["cards", "flashcard", "anki"] },
  { id: "configuracoes", label: "Configurações", description: "Ajustes da aplicação", href: "/settings", icon: Settings, keywords: ["settings", "config"] },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.keywords?.some(k => k.includes(q))
    );
  }, [query]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleSelect = (item: CommandItem) => {
    router.push(item.href);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (filtered[selectedIndex]) handleSelect(filtered[selectedIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-foreground/10 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-lg bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40">
          <Search className="w-4 h-4 text-muted-foreground/60 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar seção..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/40"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground/40 border border-border/40 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="py-2 max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhum resultado para &quot;{query}&quot;
            </div>

          ) : (
            filtered.map((item, i) => {
              const Icon = item.icon;
              const isSelected = i === selectedIndex;
              return (
                <button
                  key={item.id}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isSelected ? "bg-accent/8 text-foreground" : "text-foreground hover:bg-muted/40"
                  }`}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => handleSelect(item)}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-accent/10 text-accent" : "bg-muted/50 text-muted-foreground"
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold truncate">{item.label}</span>
                    {item.description && (
                      <span className="text-[11px] text-muted-foreground truncate">{item.description}</span>
                    )}
                  </div>
                  {isSelected && (
                    <kbd className="ml-auto text-[10px] text-muted-foreground/50 border border-border/40 px-1.5 py-0.5 rounded-md font-bold hidden sm:block">
                      ↵
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border/40 px-4 py-2 flex items-center gap-3 text-[10px] text-muted-foreground/50 font-medium">
          <span>↑↓ navegar</span>
          <span>↵ selecionar</span>
          <span>esc fechar</span>
        </div>
      </div>
    </div>
  );
}
