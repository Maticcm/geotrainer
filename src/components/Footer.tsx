"use client";

import Link from "next/link";
import { useT } from "@/lib/hooks";

export function Footer() {
  const { t } = useT();

  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--card)] py-8 transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white shadow-2xs">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity="0.3" />
              </svg>
            </div>
            <span className="text-xs font-bold text-[var(--foreground)] tracking-tight">
              GeoTrainer
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              · {t("app.tagline")}
            </span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--muted-foreground)]">
            <Link href="/" className="hover:text-[var(--foreground)] transition-colors">
              {t("nav.home")}
            </Link>
            <Link href="/play" className="hover:text-[var(--foreground)] transition-colors">
              {t("nav.play")}
            </Link>
            <Link href="/practice" className="hover:text-[var(--foreground)] transition-colors">
              {t("nav.practice")}
            </Link>
            <Link href="/progress" className="hover:text-[var(--foreground)] transition-colors">
              {t("nav.progress")}
            </Link>
            <Link href="/settings" className="hover:text-[var(--foreground)] transition-colors">
              {t("nav.settings")}
            </Link>
          </nav>
        </div>

        <div className="mt-6 border-t border-[var(--border)] pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[var(--muted-foreground)]">
          <p>
            Viri podatkov: <strong>Natural Earth Vector (1:50m, Public Domain)</strong> · Slovenski učni načrt za geografijo (10 kategorij, 112 lokacij).
          </p>
          <p>
            Vsi podatki se shranjujejo lokalno v brskalniku brez zbiranja podatkov ali prijave.
          </p>
        </div>
      </div>
    </footer>
  );
}
