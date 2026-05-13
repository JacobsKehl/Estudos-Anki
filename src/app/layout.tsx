import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Kehl Study - Foco & Performance",
  description: "Plataforma de estudos minimalista com repetição espaçada",
  icons: {
    icon: "/brand/icon.png",
  }
};

import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex flex-1 flex-col md:pl-64 pb-16 md:pb-0">
            <Topbar />
            <main className="flex-1 p-4 md:p-8">
              {children}
            </main>
          </div>
          <MobileNav />
        </div>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
