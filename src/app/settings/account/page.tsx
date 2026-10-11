"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  ShieldCheck,
  Cloud,
  CloudCheck,
  CloudOff,
  RefreshCw,
  ArrowRight,
  LogOut,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Database,
  Calendar,
  Sparkles,
} from "lucide-react";
import { useCloudSync } from "@/lib/cloud-sync";
import { signOutUser } from "@/lib/auth-client";
import { useProgress } from "@/lib/hooks";
import { overallStats } from "@/lib/progress";

export default function AccountSettingsPage() {
  const router = useRouter();
  const {
    user,
    isAuthLoading,
    status: syncStatus,
    pendingCount,
    hasAnonymousData,
    isMigrating,
    migrate,
  } = useCloudSync();

  const localProgress = useProgress();
  const localStats = overallStats(localProgress);

  const [displayName, setDisplayName] = useState<string | null>(null);
  const effectiveDisplayName = displayName !== null ? displayName : (user?.name || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [migrationSuccess, setMigrationSuccess] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [cloudStats, setCloudStats] = useState<{
    totalAnswered: number;
    sessionsCount: number;
    masteredCount: number;
  } | null>(null);

  // Fetch cloud stats
  useEffect(() => {
    if (!user) return;
    let isCancelled = false;

    async function fetchCloudData() {
      try {
        const res = await fetch("/api/progress");
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && data.progress) {
            const features = Object.values(data.progress.features || {}) as Array<{
              attempts?: number;
              correct?: number;
              intervalDays?: number;
            }>;
            const answered = features.reduce((acc, f) => acc + (f.attempts || 0), 0);
            const mastered = features.filter((f) => (f.intervalDays || 0) >= 21).length;
            setCloudStats({
              totalAnswered: answered,
              sessionsCount: data.progress.history?.length || 0,
              masteredCount: mastered,
            });
          }
        }
      } catch {
        // network failure
      }
    }

    fetchCloudData();
    return () => {
      isCancelled = true;
    };
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: effectiveDisplayName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Napaka pri posodabljanju profila");
      }

      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3500);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Napaka pri shranjevanju.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleMigrate = async () => {
    setMigrationError(null);
    setMigrationSuccess(false);

    const ok = await migrate();
    if (ok) {
      setMigrationSuccess(true);
      setTimeout(() => setMigrationSuccess(false), 4000);
    } else {
      setMigrationError("Napaka pri uvozu lokalnega napredka. Poskusite znova.");
    }
  };

  const handleSignOut = async () => {
    if (!confirm("Ali se res želite odjaviti iz računa?")) return;
    setIsLoggingOut(true);
    try {
      await signOutUser();
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Sign out error:", err);
      setIsLoggingOut(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-12">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-[var(--muted-foreground)]">Nalaganje profila …</p>
        </div>
      </div>
    );
  }

  // Anonymous user state
  if (!user) {
    return (
      <div className="mx-auto w-full max-w-3xl px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8 pb-24 md:pb-8 space-y-5 sm:space-y-6">
        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <Link href="/settings" className="hover:text-[var(--foreground)] transition-colors">
            Nastavitve
          </Link>
          <span>/</span>
          <span className="text-[var(--foreground)] font-semibold">Uporabniški račun</span>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-8 shadow-xs text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
            <Cloud className="h-7 w-7" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--foreground)]">
              Igrajte kjerkoli z računom GeoTrainer
            </h1>
            <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
              Brez računa se vaš napredek shranjuje le v tem brskalniku. Ustvarite brezplačen račun
              z Neon Auth za varno sinhronizacijo na vseh napravah.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              <Sparkles className="h-4 w-4" />
              <span>Ustvari nov račun</span>
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-6 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors min-h-[44px]"
            >
              <span>Prijava z obstoječim računom</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {hasAnonymousData && (
            <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-left max-w-lg mx-auto">
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[var(--foreground)]">
                    Zaznan lokalni napredek: {localStats.attempts} poskusov
                  </p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    Brez skrbi! Ob prijavi ali registraciji se ves vaš dosedanji napredek samodejno
                    ohrani in prenese v oblak.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Authenticated state
  return (
    <div className="mx-auto w-full max-w-3xl px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8 pb-24 md:pb-8 space-y-5 sm:space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <Link href="/settings" className="hover:text-[var(--foreground)] transition-colors">
          Nastavitve
        </Link>
        <span>/</span>
        <span className="text-[var(--foreground)] font-semibold">Uporabniški račun</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          Uporabniški račun
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Upravljajte svojo identiteto in varno shranjevanje v Neon bazi podatkov.
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xl shadow-xs">
              {user.name ? (
                user.name.slice(0, 2).toUpperCase()
              ) : (
                <User className="h-7 w-7" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[var(--foreground)]">
                  {user.name || "Uporabnik GeoTrainer"}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="h-3 w-3" />
                  Neon Auth
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] mt-0.5">
                <Mail className="h-3.5 w-3.5" />
                <span>{user.email}</span>
                {user.emailVerified && (
                  <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                    (Preverjeno)
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isLoggingOut}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--muted)]/50 px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{isLoggingOut ? "Odjavljanje …" : "Odjava"}</span>
          </button>
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="displayName"
              className="text-xs font-semibold text-[var(--foreground)]"
            >
              Prikazano ime
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="displayName"
                type="text"
                value={effectiveDisplayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Vaše ime ali vzdevek"
                maxLength={80}
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3.5 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <button
                type="submit"
                disabled={isSavingProfile}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-60 transition-colors shrink-0"
              >
                {isSavingProfile ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Shranjevanje …</span>
                  </>
                ) : (
                  <span>Shrani spremembe</span>
                )}
              </button>
            </div>
          </div>

          {profileSuccess && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Profil je bil uspešno posodobljen.</span>
            </div>
          )}

          {profileError && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-600 dark:text-rose-400 font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          <div className="pt-2 text-[11px] text-[var(--muted-foreground)] flex items-center justify-between">
            <span>
              Identifikator računa: <code className="font-mono text-[10px]">{user.id}</code>
            </span>
            <Link
              href="/forgot-password"
              className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              <KeyRound className="h-3 w-3" />
              <span>Ponastavi geslo</span>
            </Link>
          </div>
        </form>
      </div>

      {/* Cloud Synchronization Status Card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Neon PostgreSQL Cloud sinhronizacija</span>
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Napredek se v realnem času shranjuje v brezstrežno bazo Neon.
            </p>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-1.5">
            {syncStatus === "synced" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CloudCheck className="h-3.5 w-3.5" />
                <span>Sinhronizirano</span>
              </span>
            )}
            {syncStatus === "syncing" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Sinhroniziram …</span>
              </span>
            )}
            {syncStatus === "offline" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <CloudOff className="h-3.5 w-3.5" />
                <span>Brez povezave</span>
              </span>
            )}
            {(syncStatus === "error" || syncStatus === "idle") && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 border border-slate-500/20 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <Cloud className="h-3.5 w-3.5" />
                <span>Pripravljeno</span>
              </span>
            )}
          </div>
        </div>

        {/* Cloud statistics grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3.5">
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
              Odgovorjenih v oblaku
            </span>
            <div className="mt-1 text-xl font-extrabold text-[var(--foreground)]">
              {cloudStats?.totalAnswered ?? localStats.attempts}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3.5">
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
              Obvladane lokacije
            </span>
            <div className="mt-1 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {cloudStats?.masteredCount ?? localStats.learned}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3.5">
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
              Odigrane seje
            </span>
            <div className="mt-1 text-xl font-extrabold text-[var(--foreground)]">
              {cloudStats?.sessionsCount ?? localProgress.history.length}
            </div>
          </div>
        </div>

        {pendingCount > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                V čakalni vrsti za prenos: <strong>{pendingCount}</strong> neshranjenih dogodkov.
              </span>
            </div>
            <span className="text-[11px] font-semibold">Samodejno ob povezavi</span>
          </div>
        )}
      </div>

      {/* Migration Card (Local to Cloud) */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Uvoz lokalnega napredka v oblak</span>
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Če ste prej igrali brez prijave, lahko z enim klikom združite vse lokalne podatke v
              svoj Neon račun.
            </p>
          </div>

          <button
            type="button"
            onClick={handleMigrate}
            disabled={isMigrating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-60 transition-colors shrink-0"
          >
            {isMigrating ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Uvažam …</span>
              </>
            ) : (
              <>
                <Database className="h-3.5 w-3.5" />
                <span>Uvozi zdaj</span>
              </>
            )}
          </button>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-xs text-[var(--muted-foreground)] space-y-1.5">
          <p className="font-semibold text-[var(--foreground)]">
            Deterministična strategija združevanja:
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px]">
            <li>Števci poskusov, pravilnih in napačnih odgovorov se seštejejo / posodobijo na najvišjo vrednost.</li>
            <li>Urnik ponavljanja (SRS interval) se ohrani za lokacije z novejšim datumom vadbe.</li>
            <li>Seje iger se uvozijo brez podvajanja obstoječih ID-jev sej.</li>
          </ul>
        </div>

        {migrationSuccess && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Lokalni napredek je bil uspešno združen z vašim Neon računom!</span>
          </div>
        )}

        {migrationError && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-600 dark:text-rose-400 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{migrationError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
