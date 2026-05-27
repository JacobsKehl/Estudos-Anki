"use client";

import * as React from "react";
import Link from "next/link";
import { User, LogOut, Loader2 } from "lucide-react";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";
import { useLogout } from "@/hooks/useLogout";
import { cn } from "@/lib/utils";

interface UserMenuDropdownProps {
  initials: string;
}

export function UserMenuDropdown({ initials }: UserMenuDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { preferences } = useStudyPreferences();
  const { performLogout, isLoggingOut } = useLogout();
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Fechar o menu ao clicar fora dele
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  const handleItemClick = () => {
    setIsOpen(false);
  };

  const displayName = preferences.displayName || preferences.name || "Gabriela Furtado";
  const userEmail = preferences.dailyReminderEmail || "gabriela.furtado.p@gmail.com";

  return (
    <div className="relative select-none" ref={dropdownRef}>
      {/* Gatilho: Avatar do usuário */}
      <button
        onClick={toggleDropdown}
        className={cn(
          "transition-all hover:scale-105 active:scale-95 block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer",
          isOpen ? "ring-2 ring-accent/30 scale-105" : ""
        )}
        aria-label="Abrir menu de usuário"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {preferences.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preferences.avatarUrl}
            alt={displayName}
            className="h-8 w-8 rounded-xl object-cover shadow-sm border border-accent/15"
          />
        ) : (
          <div className="h-8 w-8 rounded-xl bg-sage-light text-accent flex items-center justify-center font-bold text-xs shadow-sm border border-accent/10">
            {initials}
          </div>
        )}
      </button>

      {/* Menu Dropdown - Soft Premium Style */}
      {isOpen && (
        <div 
          className={cn(
            "absolute right-0 mt-2.5 w-60 rounded-2xl border border-accent/10 bg-card p-1.5 shadow-lg shadow-brand-sage-dark/5 backdrop-blur-md z-50",
            "animate-in fade-in slide-in-from-top-3 duration-200 origin-top-right"
          )}
          role="menu"
        >
          {/* Cabeçalho do usuário */}
          <div className="px-3.5 py-3 border-b border-border/40 select-none">
            <p className="text-xs font-bold text-brand-sage-dark truncate font-serif">
              {displayName}
            </p>
            <p className="text-[10px] text-muted-foreground truncate font-medium">
              {userEmail}
            </p>
          </div>

          <div className="py-1 space-y-0.5">
            {/* Opção: Perfil */}
            <Link
              href="/profile"
              onClick={handleItemClick}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-brand-sage-dark hover:bg-accent/5 transition-all outline-none"
              role="menuitem"
            >
              <User className="h-3.5 w-3.5 text-muted-foreground/80 group-hover:text-accent" />
              Ver Perfil
            </Link>

            {/* Opção: Sair (Rose Suave) */}
            <button
              onClick={() => {
                handleItemClick();
                performLogout();
              }}
              disabled={isLoggingOut}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all outline-none cursor-pointer",
                "text-rose-600 dark:text-rose-400 hover:bg-rose-500/5 dark:hover:bg-rose-500/10 active:scale-[0.98]",
                "disabled:opacity-50"
              )}
              role="menuitem"
            >
              {isLoggingOut ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-600 dark:text-rose-400" />
              ) : (
                <LogOut className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              )}
              Sair da Conta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
