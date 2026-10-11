"use client";

import Link from "next/link";
import { useState } from "react";
import { useSettings, useT } from "@/lib/hooks";
import { defaultProgress, type ThemePref } from "@/lib/progress";
import { updateProgress } from "@/lib/store";
import { playSound } from "@/lib/sound";
import { useCloudSync } from "@/lib/cloud-sync";
import type { Difficulty, Lang } from "@/lib/types";
import { difficultyKey } from "@/lib/i18n";
import {
  Monitor,
  Sun,
  Moon,
  Volume2,
  CheckCircle2,
  RotateCcw,
  Cloud,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default function SettingsPage() {
  const { t } = useT();
  const [settings, setSettings] = useSettings();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const { user } = useCloudSync();

  const handleTestSound = () => {
    playSound("correct", true);
  };

  const handleResetProgress = () => {
    updateProgress(() => defaultProgress());
    setConfirmReset(false);
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 3000);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8 pb-24 md:pb-8 space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          {t("settings.title")}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Prilagodite jezik, izgled in pravila igre.
        </p>
      </div>

      {/* Account & Cloud Sync Banner */}
      <div className="rounded-xl border border-[var(--border)] bg-gradient-to-r from-blue-600/5 via-[var(--card)] to-[var(--card)] p-4 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[var(--foreground)]">
                  {user ? (user.name || user.email) : "Sinhronizacija v oblaku"}
                </h2>
                {user && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="h-3 w-3" />
                    Neon Auth
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {user
                  ? `Prijavljeni ste. Napredek se samodejno sinhronizira z vašim Neon računom.`
                  : "Ustvarite račun ali se prijavite za varno shranjevanje napredka med napravami."}
              </p>
            </div>
          </div>
          <Link
            href="/settings/account"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2.5 sm:py-2 text-xs font-semibold text-white shadow-xs transition-colors shrink-0 min-h-[40px]"
          >
            <span>{user ? "Upravljaj račun" : "Prijava / Registracija"}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-2xs space-y-5">
        {/* Language */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[var(--border)]">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-[var(--foreground)]">
              {t("settings.language")}
            </h2>
            <p className="text-[11px] sm:text-xs text-[var(--muted-foreground)]">
              Jezik uporabniškega vmesnika (imena lokacij se ohranijo po učnem listu).
            </p>
          </div>
          <div className="w-full sm:w-auto grid grid-cols-2 sm:flex items-center gap-1.5 bg-[var(--muted)]/50 p-1 rounded-lg border border-[var(--border)]">
            {(["sl", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setSettings({ lang: l })}
                className={`rounded-md px-3 py-2 sm:py-1.5 text-xs font-semibold transition-all text-center min-h-[38px] sm:min-h-0 ${
                  settings.lang === l
                    ? "bg-[var(--card)] text-[var(--foreground)] shadow-xs"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {l === "sl" ? "Slovenščina" : "English"}
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[var(--border)]">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-[var(--foreground)]">
              {t("settings.theme")}
            </h2>
            <p className="text-[11px] sm:text-xs text-[var(--muted-foreground)]">
              Svetla ali temna vizualna tema za zemljevid in vmesnik.
            </p>
          </div>
          <div className="w-full sm:w-auto grid grid-cols-3 sm:flex items-center gap-1.5 bg-[var(--muted)]/50 p-1 rounded-lg border border-[var(--border)]">
            {(
              [
                { id: "system" as const, label: t("settings.theme.system"), icon: Monitor },
                { id: "light" as const, label: t("settings.theme.light"), icon: Sun },
                { id: "dark" as const, label: t("settings.theme.dark"), icon: Moon },
              ] satisfies { id: ThemePref; label: string; icon: typeof Monitor }[]
            ).map((th) => {
              const Icon = th.icon;
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => setSettings({ theme: th.id })}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 sm:py-1.5 text-xs font-semibold transition-all min-h-[38px] sm:min-h-0 ${
                    settings.theme === th.id
                      ? "bg-[var(--card)] text-[var(--foreground)] shadow-xs"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{th.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sounds */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[var(--border)]">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-[var(--foreground)]">
              {t("settings.sound")}
            </h2>
            <p className="text-[11px] sm:text-xs text-[var(--muted-foreground)]">
              {t("settings.soundDesc")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTestSound}
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              <Volume2 className="h-3.5 w-3.5" />
              <span>Preizkusi zvok</span>
            </button>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={(e) => setSettings({ sound: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>
        </div>

        {/* Default Difficulty */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[var(--border)]">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-[var(--foreground)]">
              {t("settings.difficulty")}
            </h2>
            <p className="text-[11px] sm:text-xs text-[var(--muted-foreground)]">
              Privzeta toleranca razdalje in način odgovarjanja.
            </p>
          </div>
          <div className="w-full sm:w-auto grid grid-cols-3 sm:flex items-center gap-1.5 bg-[var(--muted)]/50 p-1 rounded-lg border border-[var(--border)]">
            {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSettings({ difficulty: d })}
                className={`rounded-md px-3 py-2 sm:py-1.5 text-xs font-semibold transition-all text-center min-h-[38px] sm:min-h-0 ${
                  settings.difficulty === d
                    ? "bg-[var(--card)] text-[var(--foreground)] shadow-xs"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {t(difficultyKey(d))}
              </button>
            ))}
          </div>
        </div>

        {/* Reset Progress Section */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
              {t("settings.reset")}
            </h2>
            <p className="text-[11px] sm:text-xs text-[var(--muted-foreground)]">
              {t("settings.resetDesc")}
            </p>
          </div>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 px-3.5 py-1.5 text-xs font-bold hover:bg-rose-500/10 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{t("settings.reset")}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetProgress}
                className="rounded-lg bg-rose-600 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-rose-700 shadow-xs transition-colors"
              >
                {t("common.yes")}, izbriši!
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"
              >
                {t("common.cancel")}
              </button>
            </div>
          )}
        </div>

        {resetSuccess && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold text-center flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            <span>{t("settings.resetDone")}</span>
          </div>
        )}
      </div>

      <div className="text-center text-[11px] text-[var(--muted-foreground)]">
        {t("settings.storageNote")}
      </div>
    </div>
  );
}

