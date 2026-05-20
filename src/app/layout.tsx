import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Kehl Study - Foco & Performance",
  description: "Plataforma de estudos minimalista com repetição espaçada",
  icons: {
    icon: [
      { url: "/brand/favicon.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

import { Toaster } from "sonner";
import { StudyPreferencesProvider } from "@/hooks/useStudyPreferences";
import { StudyTimer } from "@/components/study/study-timer";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const prefsStr = localStorage.getItem('kehl_study_preferences');
                  let isDark = false;
                  if (prefsStr) {
                    const prefs = JSON.parse(prefsStr);
                    if (prefs.displayDensity === 'compact') document.documentElement.classList.add('density-compact');
                    if (prefs.animations === 'reduced') document.documentElement.classList.add('motion-reduce');
                    if (prefs.theme === 'dark' || (prefs.theme === 'system' || !prefs.theme) && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                      isDark = true;
                    }
                  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    isDark = true;
                  }
                  if (isDark) document.documentElement.classList.add('dark');
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground">
        <StudyPreferencesProvider>
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
          <Toaster position="top-center" richColors />
        </StudyPreferencesProvider>
      </body>
    </html>
  );
}
