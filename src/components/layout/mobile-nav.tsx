"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Target, 
  BookMarked, 
  BrainCircuit,
  RotateCw
} from "lucide-react";
import { cn } from "@/lib/utils";

const mobileItems = [
  { label: "Início", href: "/", icon: LayoutDashboard },
  { label: "Hoje", href: "/today", icon: Target },
  { label: "Matérias", href: "/subjects", icon: BookMarked },
  { label: "Cards", href: "/flashcards", icon: BrainCircuit },
  { label: "Revisar", href: "/reviews", icon: RotateCw },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border bg-background/80 px-4 pb-safe backdrop-blur-lg md:hidden">
      {mobileItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              isActive ? "text-accent" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className={cn(
              "flex h-8 w-12 items-center justify-center rounded-2xl transition-all",
              isActive ? "bg-accent/10" : "bg-transparent"
            )}>
              <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tight">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
