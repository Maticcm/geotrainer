"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useProgress, useReady, useSettings, useStudyStreak, useT } from "@/lib/hooks";
import { overallStats } from "@/lib/progress";
import { useCloudSync } from "@/lib/cloud-sync";
import { signOutUser } from "@/lib/auth-client";
import {
  Compass,
  Flame,
  Sun,
  Moon,
  Play,
  Menu,
  X,
  User,
  LogOut,
  Settings,
  CloudCheck,
  CloudOff,
  RefreshCw,
} from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang } = useT();
  const [settings, setSettings] = useSettings();
  const progress = useProgress();
  const ready = useReady();
  const { user, status: syncStatus, isAuthLoading } = useCloudSync();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const stats = ready ? overallStats(progress) : null;
  const streak = useStudyStreak(progress.stats.studyDays);
  const masteryPercent = stats ? Math.round(stats.mastery * 100) : 0;

  // Close account menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const links = [
    { href: "/", label: t("nav.home") },
    { href: "/play", label: t("nav.play") },
    { href: "/practice", label: t("nav.practice") },
    { href: "/progress", label: t("nav.progress") },
    { href: "/settings", label: t("nav.settings") },
  ];

  const toggleLang = () => {
    setSettings({ lang: lang === "sl" ? "en" : "sl" });
  };

  const toggleTheme = () => {
    const next = settings.theme === "dark" ? "light" : "dark";
    setSettings({ theme: next });
  };

  const handleSignOut = async () => {
    setAccountMenuOpen(false);
    try {
      await signOutUser();
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[var(--background)]/85 backdrop-blur-md transition-colors">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 z-50 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {t("nav.skip")}
      </a>

      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Compass className="h-4.5 w-4.5" strokeWidth={2.2} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold tracking-tight text-[var(--foreground)]">
                Geo<span className="text-blue-600 dark:text-blue-500">Trainer</span>
              </span>
              <span className="hidden xl:inline text-[10px] font-semibold tracking-wider uppercase text-[var(--muted-foreground)]">
                Slepa karta
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? "bg-[var(--card)] text-[var(--foreground)] shadow-2xs font-semibold border border-[var(--border)]"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/60"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {ready && (
            <div className="hidden sm:flex items-center gap-2 pr-1 border-r border-[var(--border)]">
              {streak > 0 && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold"
                  title={`${streak} ${t("dash.days", { n: streak })}`}
                >
                  <Flame className="h-3.5 w-3.5 fill-current animate-flame" />
                  <span>{streak} d</span>
                </div>
              )}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] text-xs font-medium"
                title={`${t("dash.mastery")}: ${masteryPercent}%`}
              >
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{masteryPercent}%</span>
              </div>
            </div>
          )}

          {/* Language toggle */}
          <button
            type="button"
            onClick={toggleLang}
            title={lang === "sl" ? "Preklopi v angleščino" : "Switch to Slovenian"}
            aria-label="Preklopi jezik"
            className="flex h-9 sm:h-8 items-center gap-0.5 rounded-lg sm:rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 sm:px-2 text-[11px] font-bold text-[var(--foreground)] hover:bg-[var(--muted)] interactive-btn focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          >
            <span className={lang === "sl" ? "text-blue-600 dark:text-blue-400" : "opacity-40"}>SL</span>
            <span className="opacity-30">/</span>
            <span className={lang === "en" ? "text-blue-600 dark:text-blue-400" : "opacity-40"}>EN</span>
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            title="Preklopi temo"
            aria-label="Preklopi temo"
            className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] interactive-btn focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          >
            {!ready ? (
              <span className="h-4 w-4 sm:h-3.5 sm:w-3.5 block" />
            ) : settings.theme === "dark" ? (
              <Sun className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-slate-700" />
            )}
          </button>

          {/* User Account / Auth Button */}
          {!isAuthLoading && (
            <div className="relative" ref={accountMenuRef}>
              {user ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                    aria-expanded={accountMenuOpen}
                    aria-label="Uporabniški meni"
                    className="relative flex h-9 sm:h-8 items-center gap-1.5 rounded-lg sm:rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 sm:px-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] interactive-btn focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white uppercase">
                      {user.name ? user.name.slice(0, 1) : user.email.slice(0, 1)}
                    </div>
                    <span className="hidden sm:inline max-w-[80px] truncate text-[11px]">
                      {user.name || user.email.split("@")[0]}
                    </span>

                    {/* Sync status dot */}
                    <span
                      className={`h-2 w-2 rounded-full ${
                        syncStatus === "synced"
                          ? "bg-emerald-500 ring-2 ring-emerald-500/20"
                          : syncStatus === "syncing"
                          ? "bg-blue-500 animate-pulse ring-2 ring-blue-500/20"
                          : syncStatus === "offline"
                          ? "bg-amber-500"
                          : "bg-slate-400"
                      }`}
                      title={`Sinhronizacija: ${syncStatus}`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {accountMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-lg z-50 animate-in fade-in zoom-in-95">
                      <div className="px-3 py-2 border-b border-[var(--border)]">
                        <p className="text-xs font-bold text-[var(--foreground)] truncate">
                          {user.name || "Uporabnik GeoTrainer"}
                        </p>
                        <p className="text-[11px] text-[var(--muted-foreground)] truncate">
                          {user.email}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          {syncStatus === "syncing" ? (
                            <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                          ) : syncStatus === "offline" ? (
                            <CloudOff className="h-3 w-3 text-amber-500" />
                          ) : (
                            <CloudCheck className="h-3 w-3" />
                          )}
                          <span>
                            {syncStatus === "synced"
                              ? "Neon Cloud: sinhronizirano"
                              : syncStatus === "syncing"
                              ? "Neon Cloud: posodabljanje …"
                              : syncStatus === "offline"
                              ? "Neon Cloud: brez povezave"
                              : "Neon Cloud: pripravljeno"}
                          </span>
                        </div>
                      </div>

                      <div className="py-1">
                        <Link
                          href="/settings/account"
                          onClick={() => setAccountMenuOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                        >
                          <Settings className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                          <span>Nastavitve računa</span>
                        </Link>
                      </div>

                      <div className="pt-1 border-t border-[var(--border)]">
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          <span>Odjava</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-md border border-[var(--border)] bg-[var(--card)] px-3 sm:px-2.5 py-2 sm:py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] interactive-btn focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  title="Prijava z Neon Auth"
                >
                  <User className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="hidden sm:inline">Prijava</span>
                </Link>
              )}
            </div>
          )}

          {/* Primary Play CTA */}
          <Link
            href="/play"
            className="inline-flex items-center gap-1.5 rounded-lg sm:rounded-md bg-blue-600 hover:bg-blue-700 interactive-btn px-3 sm:px-3 py-2 sm:py-1.5 text-xs font-semibold text-white shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Play className="h-3.5 w-3.5 sm:h-3 sm:w-3 fill-current" />
            <span className="hidden sm:inline">{t("nav.play")}</span>
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] active:scale-95 transition-transform"
            aria-expanded={mobileOpen}
            aria-label="Odpri navigacijo"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border)] bg-[var(--card)] px-4 py-3 space-y-1">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          <div className="pt-2 mt-2 border-t border-[var(--border)]">
            {user ? (
              <div className="space-y-1">
                <Link
                  href="/settings/account"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)]"
                >
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    <span>Moj račun ({user.name || user.email})</span>
                  </span>
                  <span className="text-xs text-emerald-600 font-semibold">Neon Sync</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    handleSignOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Odjava</span>
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 text-center rounded-lg border border-[var(--border)] py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"
                >
                  Prijava
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 text-center rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Registracija
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
