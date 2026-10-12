import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { ThemeListener } from "@/components/ThemeListener";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { BottomNav } from "@/components/BottomNav";

const sansFont = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GeoTrainer — Interaktivni kviz slepe karte / Geography Learning Game",
  description:
    "Interaktivna izobraževalna igra za učenje geografskih lokacij na slepem zemljevidu. 10 kategorij iz učnega načrta: oceani, reke, jezera, gorovja, države, otoki, puščave, polotoki.",
  applicationName: "GeoTrainer",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GeoTrainer",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  keywords: [
    "geografija",
    "slepa karta",
    "zemljevid",
    "kviz",
    "nema karta",
    "geotrainer",
    "geoguessr",
    "reke",
    "gore",
    "jezera",
  ],
  authors: [{ name: "GeoTrainer" }],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

import { MobileViewportLock } from "@/components/MobileViewportLock";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sl"
      suppressHydrationWarning
      className={`${sansFont.variable} ${monoFont.variable} h-full antialiased font-sans overscroll-none`}
    >
      <body
        suppressHydrationWarning
        className="h-[100dvh] min-h-[100dvh] max-h-[100dvh] flex flex-col bg-[var(--background)] text-[var(--foreground)] selection:bg-blue-500 selection:text-white overflow-hidden touch-manipulation overscroll-none"
      >
        <ThemeListener />
        <MobileViewportLock />
        <ServiceWorkerRegister />
        <Suspense fallback={<header className="h-14 border-b border-[var(--border)] bg-[var(--card)] pt-[env(safe-area-inset-top,0px)]" />}>
          <Navbar />
        </Suspense>
        <main id="main-content" className="flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain">
          {children}
        </main>
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </body>
    </html>
  );
}
