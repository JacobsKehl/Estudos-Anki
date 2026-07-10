"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";
import { StudyTimerProvider } from "@/contexts/StudyTimerContext";
import { UserGlobalTimerProvider } from "@/contexts/UserGlobalTimerContext";
import { StudyTimer } from "@/components/study/study-timer";

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password", "/auth/callback"];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isPublic = React.useMemo(() => {
    return PUBLIC_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    );
  }, [pathname]);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <StudyTimerProvider>
      <UserGlobalTimerProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col md:pl-64 pb-16 md:pb-0">
            <Topbar />
            <main className="flex-1 p-4 md:p-8">
              {children}
            </main>
          </div>
          <MobileNav />
          <StudyTimer />
        </div>
      </UserGlobalTimerProvider>
    </StudyTimerProvider>
  );
}
