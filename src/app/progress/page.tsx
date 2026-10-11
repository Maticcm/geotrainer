"use client";

import Link from "next/link";
import { useProgress, useReady, useStudyStreak, useT } from "@/lib/hooks";
import {
  categoryStats,
  overallStats,
  weakFeatureIds,
} from "@/lib/progress";
import { FEATURE_BY_ID, SYLLABUS_FEATURES, UNRESOLVED_REPORT } from "@/data/features";
import { CategoryIcon, CATEGORY_COLORS } from "@/components/CategoryBadge";
import { StatCard } from "@/components/StatCard";
import { categoryLabelKey, reportStatusKey } from "@/lib/i18n";
import {
  Trophy,
  Target,
  Flame,
  Zap,
  Play,
  ArrowRight,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function ProgressPage() {
  const { t } = useT();
  const progress = useProgress();
  const ready = useReady();

  const stats = ready ? overallStats(progress) : null;
  const streak = useStudyStreak(progress.stats.studyDays);
  const catStats = ready ? categoryStats(progress) : [];
  const weakIds = ready ? weakFeatureIds(progress) : [];

  const masteryPercent = stats ? Math.round(stats.mastery * 100) : 0;
  const accuracyPercent =
    stats?.accuracy !== null && stats?.accuracy !== undefined
      ? Math.round(stats.accuracy * 100)
      : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8 pb-24 md:pb-8 space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          {t("progress.title")}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          {t("progress.subtitle")}
        </p>
      </div>

      {/* Main Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <StatCard
          icon={<Trophy className="h-4 w-4" />}
          title={t("dash.mastery")}
          value={`${masteryPercent}%`}
          subtitle={`${stats?.learned ?? 0} / ${SYLLABUS_FEATURES.length} ${t("dash.learned").toLowerCase()}`}
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
          value={`${streak} dni`}
          subtitle={`${t("progress.longest")}: ${progress.stats.longestStreak} dni`}
          color="amber"
        />

        <StatCard
          icon={<Zap className="h-4 w-4" />}
          title={t("progress.avgTime")}
          value={stats && stats.attempts > 0 ? `${(stats.avgTimeMs / 1000).toFixed(1)} s` : "—"}
          subtitle={progress.stats.bestScore > 0 ? `Najboljši: ${progress.stats.bestScore} t` : "Brez sej"}
          color="purple"
        />
      </div>

      {/* Weak Spots Spotlight */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-2xs space-y-3.5 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>{t("progress.weak")}</span>
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Lokacije, ki ste jih zgrešili ali imajo nižjo stopnjo memoriranja.
            </p>
          </div>

          {weakIds.length > 0 && (
            <Link
              href="/play/weak"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 sm:py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition-colors min-h-[40px] sm:min-h-0"
            >
              <Play className="h-3 w-3 fill-current" />
              <span>{t("progress.practiceWeak")} ({weakIds.length})</span>
            </Link>
          )}
        </div>

        {weakIds.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--muted-foreground)]">
            {t("progress.weakEmpty")}
          </div>
        ) : (
          <div>
            {/* Mobile Card View (< sm) */}
            <div className="sm:hidden space-y-2">
              {weakIds.slice(0, 10).map((id) => {
                const f = FEATURE_BY_ID.get(id);
                const p = progress.features[id];
                if (!f || !p) return null;
                const missRate = Math.round((p.incorrect / Math.max(1, p.attempts)) * 100);

                return (
                  <div
                    key={id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 space-y-2 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-[var(--foreground)]">
                        {f.name}
                        <span className="text-[11px] text-[var(--muted-foreground)] font-normal ml-1">
                          ({f.nameEn})
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
                        <CategoryIcon category={f.category} className="h-3 w-3" />
                        <span>{t(categoryLabelKey(f.category))}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]/50 text-[11px]">
                      <span className="text-[var(--muted-foreground)]">
                        {p.correct} prav / {p.attempts} posk.
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {missRate}% napak
                        </span>
                        {p.lastResult === true ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                        ) : p.lastResult === false ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold">✗</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= sm) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--border)] text-[var(--muted-foreground)] font-semibold">
                  <tr>
                    <th className="py-2.5 pr-4">Lokacija</th>
                    <th className="py-2.5 px-4">Kategorija</th>
                    <th className="py-2.5 px-4">Odgovori</th>
                    <th className="py-2.5 px-4">Delež napak</th>
                    <th className="py-2.5 pl-4 text-right">Zadnji rezultat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/60">
                  {weakIds.slice(0, 10).map((id) => {
                    const f = FEATURE_BY_ID.get(id);
                    const p = progress.features[id];
                    if (!f || !p) return null;
                    const missRate = Math.round((p.incorrect / Math.max(1, p.attempts)) * 100);

                    return (
                      <tr key={id} className="hover:bg-[var(--muted)]/40 transition-colors">
                        <td className="py-2.5 pr-4 font-bold text-[var(--foreground)]">
                          {f.name}
                          <span className="text-[11px] text-[var(--muted-foreground)] font-normal ml-1.5">
                            ({f.nameEn})
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-[var(--muted-foreground)]">
                          <span className="inline-flex items-center gap-1.5">
                            <CategoryIcon category={f.category} className="h-3.5 w-3.5" />
                            <span>{t(categoryLabelKey(f.category))}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-[var(--foreground)]">
                          {p.correct} pravilno / {p.attempts}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-rose-600 dark:text-rose-400">
                          {missRate}%
                        </td>
                        <td className="py-2.5 pl-4 text-right">
                          {p.lastResult === true ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Pravilno
                            </span>
                          ) : p.lastResult === false ? (
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                              <XCircle className="h-3.5 w-3.5" /> Napačno
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Category Mastery Breakdown */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6 shadow-2xs space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-[var(--foreground)]">
          {t("progress.categories")}
        </h2>

        <div className="space-y-3">
          {catStats.map((c) => {
            const mastery = Math.round(c.mastery * 100);
            const acc = c.accuracy !== null ? Math.round(c.accuracy * 100) : null;
            const colorMeta = CATEGORY_COLORS[c.category];

            return (
              <div
                key={c.category}
                className="rounded-lg border border-[var(--border)] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-500/30 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded border ${colorMeta.bg} ${colorMeta.text} ${colorMeta.border}`}
                    >
                      <CategoryIcon category={c.category} className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-bold text-xs sm:text-sm text-[var(--foreground)]">
                      {t(categoryLabelKey(c.category))}
                    </span>
                    <span className="text-[11px] text-[var(--muted-foreground)] font-mono">
                      ({c.total} lokacij)
                    </span>
                  </div>

                  <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-[var(--muted)]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${mastery}%`,
                        backgroundColor: colorMeta.accent,
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-6 text-xs shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--border)]/50">
                  <div className="text-left sm:text-left">
                    <span className="text-[10px] text-[var(--muted-foreground)] block">Obvladano</span>
                    <span className="font-bold text-[var(--foreground)]">{mastery}%</span>
                  </div>

                  <div className="text-left sm:text-left">
                    <span className="text-[10px] text-[var(--muted-foreground)] block">Natančnost</span>
                    <span className="font-bold text-[var(--foreground)]">
                      {acc !== null ? `${acc}%` : "—"}
                    </span>
                  </div>

                  <Link
                    href={`/play/locate?cats=${c.category}`}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-3 py-1.5 text-xs font-semibold hover:bg-blue-500/20 transition-colors ml-auto sm:ml-0 min-h-[36px]"
                  >
                    <span>Vadi</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Syllabus Fidelity & Data Provenance Report */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6 shadow-2xs space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--muted-foreground)]" />
            <span>{t("progress.report")}</span>
          </h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            Pregled geografskih virov, licenc in razrešitve pojmov iz učnega lista za geografijo.
          </p>
        </div>

        <div className="space-y-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
          <p>
            Vsi vektorski podatki (države, obale, reke, jezera, gore, puščave) temeljijo na mednarodnem naboru <strong>Natural Earth Vector (1:50m, Public Domain)</strong>. Vsi poligoni in rečne linije so predpakirani v aplikaciji, zato igra ne potrebuje zunanjih geokodirnih strežnikov.
          </p>
          <p>
            {t("progress.reportDesc")}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border)] text-[var(--muted-foreground)] font-semibold">
              <tr>
                <th className="py-2.5 pr-4">Pojem na učnem listu</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 pl-4">Opis razrešitve v aplikaciji</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/60">
              {UNRESOLVED_REPORT.map((r) => (
                <tr key={r.term} className="hover:bg-[var(--muted)]/40 transition-colors">
                  <td className="py-2.5 pr-4 font-bold text-[var(--foreground)]">
                    {r.term}
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.status === "approximate"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                          : r.status === "interpreted"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {t(reportStatusKey(r.status))}
                    </span>
                  </td>
                  <td className="py-2.5 pl-4 text-[var(--muted-foreground)]">
                    {r.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

