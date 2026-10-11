"use client";

import type { ReactNode } from "react";

export function StatCard({
  icon,
  title,
  value,
  subtitle,
  progress,
  color = "blue",
}: {
  icon: ReactNode;
  title: string;
  value: string | number;
  subtitle?: string;
  progress?: number; // 0..100
  color?: "blue" | "emerald" | "amber" | "purple" | "teal";
}) {
  const colorStyles = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/15",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/15",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/15",
    teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/15",
  }[color];

  const progressColor = {
    blue: "bg-blue-600",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    purple: "bg-purple-500",
    teal: "bg-teal-500",
  }[color];

  return (
    <div className="flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 shadow-xs interactive-card hover:border-blue-500/40">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-[var(--muted-foreground)] uppercase">
          {title}
        </span>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${colorStyles} transition-transform duration-300 group-hover:scale-105`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-2.5">
        <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          {value}
        </div>
        {subtitle && (
          <div className="mt-1 text-[11px] text-[var(--muted-foreground)] truncate">
            {subtitle}
          </div>
        )}
      </div>

      {typeof progress === "number" && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

