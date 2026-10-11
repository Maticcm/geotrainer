"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useProgress, useT } from "@/lib/hooks";
import { CATEGORIES, type Difficulty, type GeographyCategory, type LatLng } from "@/lib/types";
import { GAME_MODES, type GameMode } from "@/lib/progress";
import { FEATURE_BY_ID } from "@/data/features";
import { generateQuestions } from "@/lib/questions";
import {
  createSession,
  currentQuestion,
  finishSession,
  nextQuestion,
  retryQuestion,
  submitAnswer,
  summarize,
  type SessionConfig,
  type SessionState,
} from "@/lib/session";
import { evaluateClick } from "@/lib/evaluation";
import { getGeometry, loadCategories } from "@/lib/geometry";
import { recordAnswer, recordSession } from "@/lib/progress";
import { updateProgress } from "@/lib/store";
import { queueCloudAnswer, queueCloudSession } from "@/lib/cloud-sync";
import { playSound } from "@/lib/sound";
import { InteractiveMap } from "@/components/Map/InteractiveMap";
import { CategoryBadge, CategoryIcon } from "@/components/CategoryBadge";
import { categoryLabelKey, directionKey } from "@/lib/i18n";
import {
  X,
  Check,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Timer,
  Flame,
  Trophy,
  MapPin,
  Compass,
  AlertCircle,
  Home,
  Sliders,
  HelpCircle,
  CornerDownLeft,
  Lock,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

function GamePlayContent() {
  const router = useRouter();
  const rawParams = useParams();
  const searchParams = useSearchParams();
  const { t, lang } = useT();
  const progress = useProgress();

  const mode = (
    Array.isArray(rawParams.mode) ? rawParams.mode[0] : rawParams.mode
  ) as GameMode;

  // Query parameters with fallbacks
  const catsParam = searchParams.get("cats");
  const selectedCats: GeographyCategory[] = useMemo(() => {
    if (!catsParam) return [...CATEGORIES];
    return catsParam
      .split(",")
      .filter((c): c is GeographyCategory => CATEGORIES.includes(c as GeographyCategory));
  }, [catsParam]);

  const difficulty = (searchParams.get("diff") || progress.settings.difficulty) as Difficulty;
  const count = Number(searchParams.get("count")) || progress.settings.questionCount;
  const durationSec = Number(searchParams.get("dur")) || progress.settings.speedrunDuration;
  const speedMultiplier = searchParams.get("mult") !== "0";

  // Game loading and state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);

  // Answering controls state
  const [userGuess, setUserGuess] = useState<LatLng | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [autoAdvanceMs, setAutoAdvanceMs] = useState<number | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const [showExitDialog, setShowExitDialog] = useState(false);

  // Speedrun timer
  useEffect(() => {
    if (!session || session.phase === "finished" || session.config.mode !== "speedrun" || !session.endsAt) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((session.endsAt! - now) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        setSession((prev) => (prev ? finishSession(prev) : null));
      }
    }, 250);

    return () => clearInterval(interval);
  }, [session]);

  // Optional authentication for cloud synchronization
  const { data: authSession } = authClient.useSession();
  const user = authSession?.user ?? null;

  const progressFeaturesRef = useRef(progress.features);
  progressFeaturesRef.current = progress.features;

  // Load GeoJSON data and initialize session asynchronously
  useEffect(() => {
    if (!GAME_MODES.includes(mode)) {
      router.push("/play");
      return;
    }

    let active = true;

    loadCategories(selectedCats.length ? selectedCats : CATEGORIES)
      .then(() => {
        if (!active) return;

        const questions = generateQuestions({
          mode,
          categories: selectedCats.length ? selectedCats : CATEGORIES,
          count,
          difficulty,
          progress: progressFeaturesRef.current,
          now: Date.now(),
          includeExtras: mode !== "exam",
        });

        if (questions.length === 0) {
          setLoading(false);
          return;
        }

        const cfg: SessionConfig = {
          mode,
          categories: selectedCats,
          count,
          difficulty,
          durationSec: mode === "speedrun" ? durationSec : undefined,
          speedMultiplier,
        };

        const newSession = createSession(cfg, questions, Date.now());
        setSession(newSession);
        setUserGuess(null);
        setHintUsed(false);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "Failed to load map data";
        setLoadError(msg);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, catsParam, difficulty, count, durationSec, speedMultiplier, router, restartKey]);

  const curQ = session ? currentQuestion(session) : undefined;
  const curMeta = curQ ? FEATURE_BY_ID.get(curQ.featureId) : undefined;
  const curGeom = curQ ? getGeometry(curQ.featureId) : undefined;
  const isReview = session?.phase === "review";
  const fitTargetTrigger = session ? (isReview ? (session.index + 1) * 10 : 0) : 0;

  // Handle Map Click
  const handleMapClick = (p: LatLng) => {
    if (!session || session.phase !== "answering") return;
    setUserGuess(p);
  };

  // Submit Answer
  const handleConfirmAnswer = () => {
    if (!session || !curQ || !curMeta || session.phase !== "answering") return;

    const now = Date.now();

    if (curQ.kind === "locate") {
      if (!userGuess) return;
      try {
        const evaluation = evaluateClick(curMeta, curGeom, userGuess, session.config.difficulty);
        const isCorrect = evaluation.correct;

        playSound(isCorrect ? "correct" : "wrong", progress.settings.sound);

        if (!session.retried) {
          const answerPayload = {
            featureId: curMeta.id,
            correct: isCorrect,
            accuracy: evaluation.accuracy,
            timeMs: now - session.questionStartedAt,
            now,
          };
          updateProgress((d) => recordAnswer(d, answerPayload));
          queueCloudAnswer(answerPayload, String(session.questionStartedAt));
        }

        const nextState = submitAnswer(
          session,
          {
            correct: isCorrect,
            accuracy: evaluation.accuracy,
            basePoints: evaluation.basePoints,
            guess: userGuess,
            evaluation,
            hintUsed,
          },
          now
        );

        setSession(nextState);
      } catch (err) {
        console.error("Napaka pri preverjanju odgovora:", err);
      }
    }
  };

  // Next Question
  const handleNext = () => {
    if (!session || session.phase !== "review") return;
    setAutoAdvanceMs(null);

    const now = Date.now();
    const nextState = nextQuestion(session, now);
    setSession(nextState);

    setUserGuess(null);
    setHintUsed(false);

    if (nextState.phase === "finished") {
      playSound("finish", progress.settings.sound);
      const sum = summarize(nextState);
      const sessionPayload = {
        id: String(now),
        mode: nextState.config.mode,
        categories: nextState.config.categories,
        finishedAt: now,
        score: sum.score,
        correct: sum.correct,
        total: sum.total,
        avgTimeMs: sum.avgTimeMs,
      };
      updateProgress((d) => recordSession(d, sessionPayload));
      queueCloudSession(sessionPayload);
    }
  };

  // Retry (Practice Retry)
  const handleRetry = () => {
    if (!session || session.phase !== "review") return;
    setAutoAdvanceMs(null);
    setSession(retryQuestion(session, Date.now()));
    setUserGuess(null);
  };

  // Auto-advance countdown timer during review phase
  useEffect(() => {
    if (!session || session.phase !== "review" || !session.current) {
      setAutoAdvanceMs(null);
      return;
    }

    const isCorrect = session.current.correct;
    const duration = isCorrect ? 2400 : 3800;
    const start = Date.now();
    setAutoAdvanceMs(duration);

    const interval = setInterval(() => {
      const remaining = Math.max(0, duration - (Date.now() - start));
      setAutoAdvanceMs(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        handleNext();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [session?.phase, session?.index, session?.current?.correct]);

  const reviewEnteredAtRef = useRef(0);

  // Keyboard shortcut listener (Enter = Confirm or Next)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showExitDialog) {
        if (e.key === "Escape") setShowExitDialog(false);
        return;
      }

      if (e.key === "Enter") {
        if (session?.phase === "answering") {
          reviewEnteredAtRef.current = Date.now();
          handleConfirmAnswer();
        } else if (session?.phase === "review") {
          if (Date.now() - reviewEnteredAtRef.current > 500) {
            handleNext();
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const choiceHighlights: [] = [];


  // Loading state
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
        <div className="h-10 w-10 rounded-full border-3 border-blue-500/20 border-t-blue-600 animate-spin" />
        <h2 suppressHydrationWarning className="text-sm font-semibold text-[var(--foreground)]">
          {t("game.loading")}
        </h2>
      </div>
    );
  }

  // Load error
  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3 max-w-md mx-auto text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-base font-bold text-[var(--foreground)]">{t("game.loadError")}</h2>
        <p className="text-xs text-[var(--muted-foreground)]">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setRestartKey((k) => k + 1);
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          {t("game.retryLoad")}
        </button>
      </div>
    );
  }

  // No questions state
  if (!session || session.questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3 max-w-md mx-auto text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-500/10 text-[var(--muted-foreground)]">
          <HelpCircle className="h-6 w-6" />
        </div>
        <h2 className="text-base font-bold text-[var(--foreground)]">
          {mode === "weak" ? t("game.weakEmpty") : t("game.noQuestions")}
        </h2>
        <Link
          href="/play"
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          {t("common.back")}
        </Link>
      </div>
    );
  }

  // Finished Results Screen
  if (session.phase === "finished") {
    const sum = summarize(session);
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-slide-up-fade">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-1 animate-pop-in">
            <Trophy className="h-6 w-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
            {t("game.result.title")}
          </h1>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("game.result.saved")}
          </p>
        </div>

        {/* Results Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-center interactive-card">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted-foreground)] tracking-wider">
              {t("game.result.score")}
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
              {sum.score}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-center interactive-card">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted-foreground)] tracking-wider">
              {t("game.result.accuracy")}
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {Math.round(sum.accuracy * 100)}%
            </div>
            <div className="text-[11px] text-[var(--muted-foreground)]">
              {sum.correct} / {sum.total}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-center interactive-card">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted-foreground)] tracking-wider">
              {t("game.result.bestStreak")}
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 flex items-center justify-center gap-1">
              <Flame className="h-5 w-5 fill-current" />
              <span>{sum.bestStreak}</span>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-center interactive-card">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted-foreground)] tracking-wider">
              {t("game.result.avgTime")}
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">
              {(sum.avgTimeMs / 1000).toFixed(1)} s
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        {sum.byCategory.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider text-[var(--muted-foreground)]">
              {t("game.result.breakdown")}
            </h3>
            <div className="space-y-3">
              {sum.byCategory.map((b) => {
                const pct = Math.round((b.correct / Math.max(1, b.total)) * 100);
                return (
                  <div key={b.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-[var(--foreground)]">
                        <CategoryIcon category={b.category} className="h-3.5 w-3.5" />
                        <span>{t(categoryLabelKey(b.category))}</span>
                      </span>
                      <span className="font-semibold text-[var(--foreground)]">
                        {b.correct} / {b.total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Missed Features List */}
        {sum.missed.length > 0 && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 sm:p-5 space-y-3">
            <h3 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              <span>{t("game.result.missed")} ({sum.missed.length})</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {sum.missed.map((id) => {
                const f = FEATURE_BY_ID.get(id);
                if (!f) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] shadow-2xs"
                  >
                    <CategoryIcon category={f.category} className="h-3 w-3" />
                    <span>{f.name}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setRestartKey((k) => k + 1);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t("game.result.again")}</span>
          </button>

          <Link
            href="/play"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            <Sliders className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <span>{t("setup.title")}</span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
          >
            <Home className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <span>{t("game.result.home")}</span>
          </Link>
        </div>
      </div>
    );
  }

  // Active Question HUD
  const reviewResult = session.current;
  const progressPercent = Math.round(((session.index + 1) / Math.max(1, session.questions.length)) * 100);

  return (
    <div className="flex-1 flex flex-col h-[calc(100dvh-3.5rem)] overflow-hidden relative">
      {/* Exit Confirmation Dialog */}
      {showExitDialog && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--foreground)]">
                Zapusti igro?
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Vaš trenutni krog bo prekinjen. Že rešeni odgovori bodo ohranjeni v statistiki.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExitDialog(false)}
                className="rounded-lg border border-[var(--border)] px-3.5 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors min-h-[38px]"
              >
                Nadaljuj z igro
              </button>
              <button
                type="button"
                onClick={() => router.push("/play")}
                className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition-colors min-h-[38px]"
              >
                Zapusti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Bar (Sleek HUD strip) */}
      <div className="h-12 border-b border-[var(--border)] bg-[var(--card)] px-3 sm:px-6 flex items-center justify-between z-10 shrink-0 relative">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => setShowExitDialog(true)}
            className="flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-lg sm:rounded-md border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors text-xs touch-manipulation active:scale-95"
            title={t("game.quit")}
            aria-label={t("game.quit")}
          >
            <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-xs font-semibold text-[var(--foreground)]">
              {t("game.question", { n: session.index + 1, total: session.questions.length })}
            </span>
            {curMeta && <CategoryBadge category={curMeta.category} size="sm" />}
          </div>
        </div>

        {/* Progress bar in center */}
        <div className="hidden sm:block w-36 lg:w-48">
          <div className="h-1 w-full rounded-full bg-[var(--muted)] overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Stats on top bar: Timer, Streak, Score */}
        <div className="flex items-center gap-2.5">
          {session.config.mode === "speedrun" && timeLeft !== null && (
            <div
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold ${
                timeLeft <= 10
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 animate-pulse border border-rose-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              }`}
            >
              <Timer className="h-3.5 w-3.5" />
              <span>{timeLeft}s</span>
            </div>
          )}

          {session.streak > 0 && (
            <div className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              <Flame className="h-3.5 w-3.5 fill-current animate-flame" />
              <span>{session.streak}</span>
            </div>
          )}

          <div className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-md border border-blue-500/20">
            <span>{session.score} t</span>
          </div>
        </div>

        {/* Sleek edge progress bar on mobile */}
        <div className="sm:hidden absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--muted)] overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Gameplay Screen: Map Dominant with Responsive Layout */}
      <div className="flex-1 flex flex-col lg:flex-row landscape:flex-row overflow-hidden relative">
        {/* Interactive Map Canvas */}
        <div className="flex-1 h-full min-h-0 relative">
          {/* Floating On-Map Review Feedback Card (Visible immediately on desktop & mobile) */}
          {isReview && reviewResult && (
            <div
              data-map-control="true"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="absolute top-2.5 sm:top-5 left-1/2 -translate-x-1/2 z-30 w-[95%] sm:w-[94%] max-w-lg pointer-events-auto animate-slide-up-fade"
            >
              <div
                className={`rounded-2xl p-3 sm:p-4.5 shadow-2xl border backdrop-blur-md flex flex-col gap-2 ${
                  reviewResult.correct
                    ? "bg-emerald-950/95 border-emerald-500/70 text-emerald-100 shadow-emerald-950/70"
                    : "bg-rose-950/95 border-rose-500/70 text-rose-100 shadow-rose-950/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2.5 sm:gap-3">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div
                      className={`flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl font-black ${
                        reviewResult.correct
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/40"
                          : "bg-rose-500 text-white shadow-lg shadow-rose-500/40"
                      }`}
                    >
                      {reviewResult.correct ? (
                        <Check className="h-5 w-5 sm:h-6 sm:w-6 stroke-[3]" />
                      ) : (
                        <X className="h-5 w-5 sm:h-6 sm:w-6 stroke-[3]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-sm sm:text-lg font-black tracking-tight uppercase">
                          {reviewResult.correct ? "✓ PRAVILNO!" : "✗ NAPAČNO"}
                        </span>
                        {reviewResult.score?.total > 0 && !reviewResult.practice && (
                          <span className="text-[11px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            +{reviewResult.score.total} t
                          </span>
                        )}
                        {session.streak > 1 && reviewResult.correct && (
                          <span className="text-[11px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                            <Flame className="h-3 w-3 fill-current" />
                            <span>{session.streak}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-200 truncate mt-0.5">
                        {reviewResult.correct ? (
                          "Točen zadetek na lokacijo!"
                        ) : (
                          <>
                            Pravi cilj: <strong className="text-white font-extrabold">{curMeta?.name}</strong>{" "}
                            {reviewResult.evaluation &&
                              `(${Math.round(reviewResult.evaluation.distanceKm)} km ${t(directionKey(reviewResult.evaluation.direction || "N"))})`}
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {!reviewResult.correct && (
                      <button
                        type="button"
                        onClick={handleRetry}
                        className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs active:scale-95 transition-all cursor-pointer"
                        title="Poskusi znova"
                      >
                        Ponovi
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white text-slate-900 font-extrabold text-xs shadow-md hover:bg-slate-100 active:scale-95 transition-all shrink-0 cursor-pointer"
                    >
                      <span>{session.index + 1 >= session.questions.length ? t("game.finish") : "Naprej"}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Auto-advance timer bar */}
                {autoAdvanceMs !== null && (
                  <div className="w-full pt-1.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300 font-medium">
                    <span>
                      Naslednji krog čez{" "}
                      <strong className="text-white font-bold">
                        {(autoAdvanceMs / 1000).toFixed(1)}s
                      </strong>{" "}
                      …
                    </span>
                    <div className="w-24 sm:w-36 h-1.5 rounded-full bg-white/20 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-100 ${
                          reviewResult.correct ? "bg-emerald-400" : "bg-rose-400"
                        }`}
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(
                              100,
                              (1 - autoAdvanceMs / (reviewResult.correct ? 2400 : 3800)) * 100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <InteractiveMap
            interactive={session.phase === "answering" && curQ?.kind === "locate"}
            userGuess={userGuess}
            onMapClick={handleMapClick}
            targetGeometry={isReview ? curGeom : null}
            targetFeatureMeta={isReview ? curMeta : null}
            nearestPoint={isReview ? reviewResult?.evaluation?.nearest : null}
            highlights={choiceHighlights}
            showReview={isReview}
            isCorrect={reviewResult ? reviewResult.correct : null}
            showLabels={isReview}
            fitTargetTrigger={fitTargetTrigger}
            resetTrigger={session.index}
          />
        </div>

        {/* Compact Question HUD Drawer (Desktop Sidebar / Mobile Bottom Sheet) */}
        <div className="w-full lg:w-80 xl:w-96 landscape:w-72 landscape:lg:w-80 max-h-[38vh] sm:max-h-[42vh] lg:max-h-none landscape:max-h-none border-t lg:border-t-0 lg:border-l landscape:border-t-0 landscape:border-l border-[var(--border)] bg-[var(--card)] p-3 sm:p-4 lg:p-5 flex flex-col justify-between overflow-hidden z-10 shrink-0 shadow-lg pb-safe">
          <div className="overflow-y-auto min-h-0 flex-1 pr-1 space-y-2.5 sm:space-y-4">
            {/* Question Phase */}
            {!isReview ? (
              <div className="space-y-2 sm:space-y-3.5">
                <div>
                  <span className="text-[10px] font-bold tracking-wider text-[var(--muted-foreground)] uppercase block mb-0.5 sm:mb-1">
                    POIŠČI TO LOKACIJO
                  </span>

                  <h2 className="text-lg sm:text-2xl font-black text-[var(--foreground)] tracking-tight">
                    {curMeta?.name}
                  </h2>

                  {curMeta?.nameEn && lang === "sl" && (
                    <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                      angl. <span className="font-medium text-[var(--foreground)]">{curMeta.nameEn}</span>
                    </div>
                  )}
                </div>

                {/* Sub-prompt based on mode */}
                {curQ?.kind === "locate" && (
                  <div className="rounded-lg bg-[var(--muted)]/50 border border-[var(--border)] p-2.5 sm:p-3 text-xs text-[var(--muted-foreground)] flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <span>
                      {userGuess
                        ? "Oznaka je postavljena. Za oddajo kliknite spodnji gumb ali pritisnite Enter."
                        : t("game.clickMap")}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              /* Review Phase Feedback Panel */
              <div className="space-y-3 animate-slide-up-fade">
                {/* Result Status Header */}
                <div
                  className={`rounded-xl border p-3 animate-pop-in ${
                    reviewResult?.correct
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {reviewResult?.correct ? (
                      <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4.5 w-4.5 shrink-0" />
                    )}
                    <h3 className="text-sm sm:text-base font-extrabold">
                      {reviewResult?.correct ? t("game.correct") : t("game.incorrect")}
                    </h3>
                  </div>

                  {reviewResult?.score && !reviewResult.practice && (
                    <div className="mt-1 text-xs font-semibold text-[var(--foreground)]">
                      +{reviewResult.score.total} {t("game.score").toLowerCase()}
                      {reviewResult.score.speed > 0 && ` (hitrost +${reviewResult.score.speed})`}
                      {reviewResult.score.streak > 0 && ` (serija +${reviewResult.score.streak})`}
                      {reviewResult.score.multiplier > 1 && ` [x${reviewResult.score.multiplier}]`}
                    </div>
                  )}

                  {reviewResult?.practice && (
                    <div className="mt-1 text-xs text-blue-600 dark:text-blue-400 font-semibold">
                      {t("game.practiceDone")}
                    </div>
                  )}
                </div>

                {/* Spatial Accuracy Breakdown */}
                {reviewResult?.evaluation && (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-2.5 text-xs space-y-1">
                    {reviewResult.evaluation.inside ? (
                      <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5" />
                        <span>{t("game.inside")}</span>
                      </div>
                    ) : (
                      <div className="text-[var(--muted-foreground)] flex items-center gap-1.5">
                        <Compass className="h-3.5 w-3.5 text-amber-500" />
                        <span>
                          {t("game.distance", {
                            km: Math.round(reviewResult.evaluation.distanceKm),
                            dir: t(directionKey(reviewResult.evaluation.direction || "N")),
                          })}
                        </span>
                      </div>
                    )}
                    {reviewResult.evaluation.approximate && (
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 pt-0.5">
                        {t("game.approx", { km: Math.round(reviewResult.evaluation.toleranceKm) })}
                      </div>
                    )}
                  </div>
                )}

                {/* Correct Name & Syllabus Fact */}
                <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5 sm:p-3 space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] block">
                      {t("game.answerWas")}:
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-[var(--foreground)]">
                      {curMeta?.name}
                    </span>
                    {curMeta?.aliases && curMeta.aliases.length > 0 && (
                      <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                        Tudi: {curMeta.aliases.join(", ")}
                      </div>
                    )}
                  </div>

                  {curMeta?.fact && (
                    <div className="border-t border-[var(--border)] pt-2 text-[var(--foreground)] text-xs leading-relaxed">
                      <strong>{t("game.facts")}:</strong> {curMeta.fact[lang]}
                    </div>
                  )}

                  {curMeta?.note && (
                    <div className="text-[10px] text-[var(--muted-foreground)] italic">
                      Opomba: {curMeta.note}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Controls (Always pinned at bottom, never clipped) */}
          <div className="pt-2 sm:pt-3 border-t border-[var(--border)] shrink-0 space-y-1.5 sm:space-y-2">
            {!isReview ? (
              <button
                type="button"
                onClick={handleConfirmAnswer}
                disabled={!userGuess}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 sm:py-2.5 min-h-[44px] sm:min-h-[42px] text-sm sm:text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 interactive-btn disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 touch-manipulation active:scale-[0.99]"
              >
                <Check className="h-4.5 w-4.5 sm:h-4 sm:w-4" />
                <span>{t("game.confirm")}</span>
              </button>
            ) : (
              <div className="flex gap-2">
                {!reviewResult?.correct && !reviewResult?.practice && (
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--muted)]/50 py-2.5 sm:py-2 min-h-[44px] sm:min-h-[38px] text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors touch-manipulation active:scale-[0.99]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{t("game.retry")}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 sm:py-2.5 min-h-[44px] sm:min-h-[42px] text-sm sm:text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 interactive-btn focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 touch-manipulation active:scale-[0.99]"
                >
                  <span>
                    {session.index + 1 >= session.questions.length
                      ? t("game.finish")
                      : t("game.next")}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="hidden sm:flex items-center justify-center gap-1 text-[10px] text-[var(--muted-foreground)]">
              <CornerDownLeft className="h-3 w-3" />
              <span>{t("game.keyboardHint")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GamePlayPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[var(--muted-foreground)]">Nalagam …</div>}>
      <GamePlayContent />
    </Suspense>
  );
}

