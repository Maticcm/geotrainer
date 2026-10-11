"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProgress, useT } from "@/lib/hooks";
import { CATEGORIES, type Difficulty, type GeographyCategory } from "@/lib/types";
import { GAME_MODES, type GameMode } from "@/lib/progress";
import { CategoryIcon, CATEGORY_COLORS } from "@/components/CategoryBadge";
import { FEATURES, SYLLABUS_FEATURES } from "@/data/features";
import {
  categoryLabelKey,
  diffDescKey,
  difficultyKey,
  modeDescKey,
  modeTitleKey,
} from "@/lib/i18n";
import Link from "next/link";
import {
  Crosshair,
  Zap,
  Target,
  GraduationCap,
  Play,
  Check,
  Lock,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

const MODE_ICONS: Record<GameMode, LucideIcon> = {
  locate: Crosshair,
  speedrun: Zap,
  weak: Target,
  exam: GraduationCap,
};

export default function PlaySetupPage() {
  const router = useRouter();
  const { t } = useT();
  const progress = useProgress();

  const { data: authSession, isPending: authPending } = authClient.useSession();
  const user = authSession?.user ?? null;

  const [selectedMode, setSelectedMode] = useState<GameMode>("locate");
  const [selectedCats, setSelectedCats] = useState<GeographyCategory[]>([...CATEGORIES]);
  const [difficulty, setDifficulty] = useState<Difficulty>(progress.settings.difficulty);
  const [questionCount, setQuestionCount] = useState<number>(progress.settings.questionCount);
  const [speedrunDuration, setSpeedrunDuration] = useState<number>(progress.settings.speedrunDuration);
  const [speedMultiplier, setSpeedMultiplier] = useState<boolean>(progress.settings.speedrunMultiplier);

  const toggleCategory = (cat: GeographyCategory) => {
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const selectAllCats = () => setSelectedCats([...CATEGORIES]);
  const selectNoCats = () => setSelectedCats([]);

  // Calculate matching questions
  const availableFeatures = FEATURES.filter(
    (f) =>
      selectedCats.includes(f.category) &&
      (selectedMode === "exam" ? f.syllabus : true)
  );

  const handleStart = () => {
    if (selectedCats.length === 0) return;

    const params = new URLSearchParams();
    params.set("cats", selectedCats.join(","));
    params.set("count", String(questionCount));
    params.set("diff", difficulty);
    if (selectedMode === "speedrun") {
      params.set("dur", String(speedrunDuration));
      params.set("mult", speedMultiplier ? "1" : "0");
    }

    const targetUrl = `/play/${selectedMode}?${params.toString()}`;

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
      return;
    }

    router.push(targetUrl);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8 pb-28 md:pb-8 space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          {t("setup.title")}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          {t("setup.subtitle")}
        </p>
      </div>

      {/* 1. Mode Selector */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 shadow-2xs space-y-3">
        <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">
          1. {t("setup.mode")}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
          {GAME_MODES.map((mode) => {
            const active = selectedMode === mode;
            const Icon = MODE_ICONS[mode];
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setSelectedMode(mode)}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all min-h-[76px] touch-manipulation active:scale-[0.98] ${
                  active
                    ? "border-blue-600 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold ring-1 ring-blue-500 shadow-2xs"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border mb-2 ${
                    active
                      ? "border-blue-500/30 bg-blue-600 text-white"
                      : "border-[var(--border)] bg-[var(--muted)]/60 text-[var(--muted-foreground)]"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <span className="text-xs font-bold text-[var(--foreground)]">{t(modeTitleKey(mode))}</span>
                <span className="text-[11px] text-[var(--muted-foreground)] mt-0.5 line-clamp-1">
                  {t(modeDescKey(mode))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Category Selector */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">
            2. {t("setup.categories")} ({selectedCats.length} / 10)
          </label>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={selectAllCats}
              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              {t("setup.all")}
            </button>
            <span className="text-[var(--border)]">|</span>
            <button
              type="button"
              onClick={selectNoCats}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              {t("setup.none")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {CATEGORIES.map((cat) => {
            const count = SYLLABUS_FEATURES.filter((f) => f.category === cat).length;
            const checked = selectedCats.includes(cat);
            const colorMeta = CATEGORY_COLORS[cat];

            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`flex items-center gap-2 rounded-lg border p-2.5 sm:p-2 text-xs text-left min-h-[48px] transition-all touch-manipulation active:scale-[0.98] ${
                  checked
                    ? "border-blue-600/50 bg-blue-500/10 text-[var(--foreground)] font-semibold shadow-2xs"
                    : "border-[var(--border)] bg-[var(--muted)]/40 text-[var(--muted-foreground)] opacity-60 hover:opacity-100"
                }`}
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${colorMeta.bg} ${colorMeta.text} ${colorMeta.border}`}
                >
                  <CategoryIcon category={cat} className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-xs">{t(categoryLabelKey(cat))}</div>
                  <div className="text-[10px] text-[var(--muted-foreground)] font-mono">
                    {count}
                  </div>
                </div>
                {checked && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        {selectedCats.length === 0 && (
          <p className="text-xs text-rose-500 font-semibold">
            {t("setup.needCategory")}
          </p>
        )}
      </div>

      {/* 3. Difficulty & Question Count */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Difficulty */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xs space-y-3">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">
            3. {t("setup.difficulty")}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["easy", "normal", "hard"] as Difficulty[]).map((d) => {
              const active = difficulty === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`rounded-lg border py-2 text-center text-xs transition-all ${
                    active
                      ? "border-blue-600 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-2xs"
                      : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                  }`}
                >
                  <div>{t(difficultyKey(d))}</div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            {t(diffDescKey(difficulty))}
          </p>
        </div>

        {/* Count or Speedrun settings */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xs space-y-3">
          {selectedMode === "speedrun" ? (
            <>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">
                {t("setup.duration")}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[30, 60, 90, 120].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSpeedrunDuration(sec)}
                    className={`rounded-lg border py-2 text-xs text-center font-bold transition-all ${
                      speedrunDuration === sec
                        ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "border-[var(--border)] hover:bg-[var(--muted)]"
                    }`}
                  >
                    {t("setup.seconds", { n: sec })}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 pt-1 text-xs text-[var(--foreground)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={speedMultiplier}
                  onChange={(e) => setSpeedMultiplier(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>{t("setup.multiplier")} (x1.5, x2, x2.5, x3)</span>
              </label>
            </>
          ) : (
            <>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block">
                {t("setup.count")}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 20, Math.min(50, availableFeatures.length)].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setQuestionCount(cnt)}
                    className={`rounded-lg border py-2 text-xs text-center font-bold transition-all ${
                      questionCount === cnt
                        ? "border-blue-600 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "border-[var(--border)] hover:bg-[var(--muted)]"
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {t("setup.available", { n: availableFeatures.length })}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Launch Action */}
      <div className="pt-2 space-y-3">
        {!authPending && !user && (
          <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-[var(--foreground)]">
              <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                Za začetek igre se morate najprej prijaviti.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/login?redirect=${encodeURIComponent(
                  `/play/${selectedMode}?cats=${selectedCats.join(",")}&count=${questionCount}&diff=${difficulty}`
                )}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 font-bold text-white hover:bg-blue-700"
              >
                <span>Prijava</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={`/signup?redirect=${encodeURIComponent(
                  `/play/${selectedMode}?cats=${selectedCats.join(",")}&count=${questionCount}&diff=${difficulty}`
                )}`}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <span>Registracija</span>
              </Link>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleStart}
          disabled={selectedCats.length === 0 || availableFeatures.length === 0}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 sm:py-3.5 min-h-[50px] text-base sm:text-sm font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 touch-manipulation"
        >
          {user ? (
            <>
              <Play className="h-4.5 w-4.5 fill-current" />
              <span>{t("setup.start")}</span>
              <span className="text-blue-200 text-xs font-normal">
                ({Math.min(questionCount, availableFeatures.length)} vprašanj)
              </span>
            </>
          ) : (
            <>
              <Lock className="h-4.5 w-4.5" />
              <span>Prijavite se za začetek igre</span>
              <ArrowRight className="h-4.5 w-4.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

