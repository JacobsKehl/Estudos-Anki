"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  BookOpen, 
  Calendar, 
  Target,
  BookMarked,
  Blocks,
  BrainCircuit,
  RotateCw,
  Heart,
  Settings,
  FolderDown,
  Trophy
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";

const navItems = [
  { label: "Hoje", href: "/", icon: Target },
  { label: "Desempenho", href: "/stats", icon: Trophy },
  { label: "Biblioteca", href: "/materials", icon: BookOpen },
  { label: "Matérias", href: "/subjects", icon: BookMarked },
  { label: "Cronograma", href: "/schedule", icon: Calendar },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 hidden h-full w-64 flex-col border-r border-border bg-card/50 backdrop-blur-md md:flex">
      <div className="flex h-20 items-center px-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/50 backdrop-blur-sm shadow-sm border border-accent/5 group-hover:scale-105 transition-transform duration-300">
            <Logo size={28} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-lg font-extrabold tracking-tight text-foreground">Kehl</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent/80">Study</span>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-6 space-y-2 scrollbar-hide">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:bg-accent/10 hover:text-accent",
              pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/")
                ? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_rgba(var(--accent),0.1)]"
                : "text-muted-foreground"
            )}
          >
            <item.icon className={cn(
              "h-5 w-5 transition-transform group-hover:scale-110",
              pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/") ? "text-accent" : "text-muted-foreground"
            )} />
            {item.label}
          </Link>
        ))}
      </div>

      <div className="mt-auto border-t border-border p-4">
        <Link
          href="/settings"
          className={cn(
            "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:bg-muted/80",
            pathname === "/settings"
              ? "bg-muted text-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
              : "text-muted-foreground"
          )}
        >
          <Settings className={cn(
            "h-5 w-5 transition-transform group-hover:rotate-45",
            pathname === "/settings" ? "text-foreground" : "text-muted-foreground"
          )} />
          Configurações
        </Link>
      </div>
    </aside>
  );
}
