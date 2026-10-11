"use client";

import Link from "next/link";
import type { GameMode } from "@/lib/progress";
import { useT } from "@/lib/hooks";
import { modeDescKey, modeTitleKey } from "@/lib/i18n";
import {
  Crosshair,
  Zap,
  Target,
  GraduationCap,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

const MODE_META: Record<
  GameMode,
  {
    icon: LucideIcon;
    color: string;
    iconBg: string;
    tag?: string;
  }
> = {
  locate: {
    icon: Crosshair,
    color: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-500/10 border-blue-500/20",
    tag: "Glavni način",
  },
  speedrun: {
    icon: Zap,
    color: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/20",
    tag: "Časovni izziv",
  },
  weak: {
    icon: Target,
    color: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-500/10 border-rose-500/20",
    tag: "Pametno ponavljanje",
  },
  exam: {
    icon: GraduationCap,
    color: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-500/10 border-violet-500/20",
    tag: "Šolski test",
  },
};

export function ModeCard({
  mode,
  compact = false,
}: {
  mode: GameMode;
  compact?: boolean;
}) {
  const { t } = useT();
  const meta = MODE_META[mode];
  const title = t(modeTitleKey(mode));
  const desc = t(modeDescKey(mode));
  const Icon = meta.icon;

  return (
    <Link
      href={`/play/${mode}`}
      className="group relative flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xs interactive-card hover:border-blue-500/50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
    >
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg border ${meta.iconBg} ${meta.color} transition-transform duration-300 group-hover:scale-110`}
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
          {meta.tag && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] transition-colors group-hover:border-blue-500/30">
              {meta.tag}
            </span>
          )}
        </div>

        <h3 className="text-base font-bold text-[var(--foreground)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {title}
        </h3>
        <p className={`mt-1 text-xs text-[var(--muted-foreground)] leading-relaxed ${compact ? "line-clamp-2" : ""}`}>
          {desc}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between pt-3 border-t border-[var(--border)]/60 text-xs font-semibold text-blue-600 dark:text-blue-400">
        <span>Začni igro</span>
        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1.5" strokeWidth={2.2} />
      </div>
    </Link>
  );
}

