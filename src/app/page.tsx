"use client";

import Link from "next/link";
import { useProgress, useReady, useStudyStreak, useT } from "@/lib/hooks";
import { overallStats } from "@/lib/progress";
import { CATEGORIES } from "@/lib/types";
import { CategoryIcon, CATEGORY_COLORS } from "@/components/CategoryBadge";
import { ModeCard } from "@/components/ModeCard";
import { StatCard } from "@/components/StatCard";
import { SYLLABUS_FEATURES } from "@/data/features";
import { categoryLabelKey, modeTitleKey } from "@/lib/i18n";
import {
  Play,
  ArrowRight,
  Sparkles,
  Trophy,
  Target,
  Flame,
  BookOpen,
  AlertTriangle,
  GraduationCap,
  History,
  Compass,
} from "lucide-react";

export default function DashboardPage() {
  const { t } = useT();
  const progress = useProgress();
  const ready = useReady();

  const stats = ready ? overallStats(progress) : null;
  const streak = useStudyStreak(progress.stats.studyDays);

  const masteryPercent = stats ? Math.round(stats.mastery * 100) : 0;
  const accuracyPercent =
    stats?.accuracy !== null && stats?.accuracy !== undefined
      ? Math.round(stats.accuracy * 100)
      : null;

  // Find lowest mastery categories among those attempted
  const weakCats = stats
    ? [...stats.cats]
        .filter((c) => c.attempts > 0)
        .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
        .slice(0, 3)
    : [];

  const hasHistory = progress.history.length > 0;
  const hasAttempted = stats && stats.attempts > 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-24 md:pb-8 space-y-6 sm:space-y-8">
      {/* 1. Primary Action & Quick Session Launcher */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-r from-blue-900/15 via-[var(--card)] to-[var(--card)] p-5 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2.5 sm:space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Compass className="h-3.5 w-3.5" />
              <span>Syllabus 2026 · 112 lokacij</span>
            </div>

            <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[var(--foreground)]">
              {hasAttempted ? (
                <>
                  Nadaljujte z vadbo <span className="text-blue-600 dark:text-blue-400">slepe karte</span>
                </>
              ) : (
                <>
                  Pripravite se na šolski test <span className="text-blue-600 dark:text-blue-400">geografije</span>
                </>
              )}
            </h1>

            <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
              {hasAttempted
                ? `Uspešno obvladano ${stats.learned} od ${SYLLABUS_FEATURES.length} lokacij. Ponovite neznane točke ali začnite simulacijo šolskega testa.`
                : t("dash.subtitle")}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row w-full lg:w-auto items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0">
            <Link
              href="/play/locate"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 sm:py-3 text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 interactive-btn focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[46px]"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>{hasAttempted ? t("dash.continue") : "Začni vadbo"}</span>
            </Link>

            <Link
              href="/play/exam"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 sm:py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] interactive-btn min-h-[46px]"
            >
              <GraduationCap className="h-4 w-4 text-[var(--muted-foreground)]" />
              <span>{t("mode.exam.title")}</span>
            </Link>

            <Link
              href="/practice"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 sm:py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] interactive-btn min-h-[46px]"
            >
              <BookOpen className="h-4 w-4 text-[var(--muted-foreground)]" />
              <span>{t("nav.practice")}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Compact Statistics Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          icon={<Trophy className="h-4 w-4" />}
          title={t("dash.mastery")}
          value={`${masteryPercent}%`}
          subtitle={`${stats?.learned ?? 0} ${t("dash.of", { n: SYLLABUS_FEATURES.length })} ${t("dash.learned").toLowerCase()}`}
          progress={masteryPercent}
          color="emerald"
        />

        <StatCard
          icon={<Target className="h-4 w-4" />}
          title={t("dash.accuracy")}
          value={accuracyPercent !== null ? `${accuracyPercent}%` : "—"}
          subtitle={`${stats?.attempts ?? 0} ${t("progress.attempts").toLowerCase()}`}
          progress={accuracyPercent ?? 0}
          color="blue"
        />

        <StatCard
          icon={<Flame className="h-4 w-4" />}
          title={t("dash.streak")}
          value={streak > 0 ? `${streak} dni` : "0 dni"}
          subtitle={streak > 0 ? "Ohranite serijo danes!" : "Odigrajte krog danes"}
          color="amber"
        />

        <StatCard
          icon={<History className="h-4 w-4" />}
          title={t("progress.sessions")}
          value={progress.stats.sessions}
          subtitle={progress.stats.bestScore > 0 ? `Najboljši: ${progress.stats.bestScore} t` : "Brez sej"}
          color="purple"
        />
      </section>

      {/* 3. Weak Spots Alert (Shown only when student has attempted sessions & has weak areas) */}
      {weakCats.length > 0 && (
        <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[var(--foreground)]">
                {t("dash.weakest")}
              </h3>
              <p className="text-[11px] sm:text-xs text-[var(--muted-foreground)]">
                Kategorije z nižjo točnostjo. Priporočamo hitro vajo pred preverjanjem znanja:
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {weakCats.map((c) => (
              <Link
                key={c.category}
                href={`/play/locate?cats=${c.category}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-amber-500/10 transition-colors shadow-2xs"
              >
                <CategoryIcon category={c.category} className="h-3.5 w-3.5" />
                <span>{t(categoryLabelKey(c.category))}</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold ml-0.5">
                  {Math.round((c.accuracy ?? 0) * 100)}%
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 4. Category Mastery Grid (10 Syllabus Categories) */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--foreground)]">
              Kategorije učnega načrta
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              10 sklopov z učnega lista z dejanskim napredkom memoriranja.
            </p>
          </div>
          <Link
            href="/practice"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>Prebrskaj atlas</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {CATEGORIES.map((cat) => {
            const count = SYLLABUS_FEATURES.filter((f) => f.category === cat).length;
            const catStat = stats?.cats.find((c) => c.category === cat);
            const mastery = catStat ? Math.round(catStat.mastery * 100) : 0;
            const colorMeta = CATEGORY_COLORS[cat];

            return (
              <Link
                key={cat}
                href={`/practice?cat=${cat}`}
                className="group relative flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5 shadow-2xs transition-all hover:border-[var(--primary)]/40 hover:shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border ${colorMeta.bg} ${colorMeta.text} ${colorMeta.border}`}
                    >
                      <CategoryIcon category={cat} className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                      {count}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-[var(--foreground)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                    {t(categoryLabelKey(cat))}
                  </h4>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60">
                  <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)] mb-1">
                    <span>Obvladano</span>
                    <span className="font-semibold text-[var(--foreground)]">{mastery}%</span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${mastery}%`,
                        backgroundColor: colorMeta.accent,
                      }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 5. Game Modes Selector */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--foreground)]">
              Načini vadbe
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Prilagodite način igranja svojemu slogu učenja.
            </p>
          </div>
          <Link
            href="/play"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>Vsi načini in nastavitve</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <ModeCard mode="locate" />
          <ModeCard mode="speedrun" />
          <ModeCard mode="weak" />
          <ModeCard mode="exam" />
        </div>
      </section>

      {/* 6. Recent Session History or Welcome Empty State */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[var(--muted-foreground)]" />
            <h3 className="text-sm sm:text-base font-bold text-[var(--foreground)]">
              {t("dash.recent")}
            </h3>
          </div>
          {hasHistory && (
            <Link
              href="/progress"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>Vsa zgodovina</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {hasHistory ? (
          <div>
            {/* Mobile Card View (< sm) */}
            <div className="sm:hidden space-y-2.5">
              {progress.history
                .slice(-5)
                .reverse()
                .map((h) => (
                  <div
                    key={h.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5 space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[var(--foreground)]">
                        {t(modeTitleKey(h.mode))}
                      </span>
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {new Date(h.finishedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--border)]/50">
                      <div>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {h.correct}
                        </span>
                        <span className="text-[var(--muted-foreground)]"> / {h.total}</span>
                        <span className="ml-1 text-[10px] text-[var(--muted-foreground)]">
                          ({Math.round((h.correct / Math.max(1, h.total)) * 100)}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[var(--muted-foreground)] font-mono">
                          {(h.avgTimeMs / 1000).toFixed(1)}s/vpr
                        </span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {h.score} t
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Desktop Table View (>= sm) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--border)] text-[var(--muted-foreground)] font-semibold">
                  <tr>
                    <th className="py-2.5 pr-4">Način</th>
                    <th className="py-2.5 px-4">Rezultat</th>
                    <th className="py-2.5 px-4">Točke</th>
                    <th className="py-2.5 px-4">Čas / vprašanje</th>
                    <th className="py-2.5 pl-4 text-right">Datum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/60">
                  {progress.history
                    .slice(-5)
                    .reverse()
                    .map((h) => (
                      <tr key={h.id} className="hover:bg-[var(--muted)]/40 transition-colors">
                        <td className="py-2.5 pr-4 font-semibold text-[var(--foreground)]">
                          {t(modeTitleKey(h.mode))}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {h.correct}
                          </span>
                          <span className="text-[var(--muted-foreground)]"> / {h.total}</span>
                          <span className="ml-1.5 text-[11px] text-[var(--muted-foreground)]">
                            ({Math.round((h.correct / Math.max(1, h.total)) * 100)}%)
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-bold text-blue-600 dark:text-blue-400">
                          {h.score} t
                        </td>
                        <td className="py-2.5 px-4 text-[var(--muted-foreground)] font-mono">
                          {(h.avgTimeMs / 1000).toFixed(1)} s
                        </td>
                        <td className="py-2.5 pl-4 text-right text-[var(--muted-foreground)]">
                          {new Date(h.finishedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-6 sm:p-8 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-[var(--foreground)]">
                Še nimate zabeleženih iger
              </h4>
              <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto">
                Začnite svoj prvi krog v načinu »Poišči na zemljevidu« ali preizkusite šolski test.
              </p>
            </div>
            <Link
              href="/play/locate"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Začni prvo igro</span>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

