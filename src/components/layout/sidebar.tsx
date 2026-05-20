"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  BookOpen, 
  Calendar, 
  Target,
  BookMarked,
  Settings,
  Trophy
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLockup } from "@/components/brand/BrandLockup";

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
      <div className="px-4 pt-5 pb-5">
        <Link href="/" className="group outline-none block">
          <BrandLockup variant="sidebar" className="transition-opacity hover:opacity-90" />
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
