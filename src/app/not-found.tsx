"use client";

import Link from "next/link";
import { useT } from "@/lib/hooks";

export default function NotFound() {
  const { t } = useT();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
      <span className="text-6xl">🧭</span>
      <h1 className="text-2xl font-extrabold text-[var(--foreground)]">
        404 — {t("common.notFound")}
      </h1>
      <p className="text-xs text-[var(--muted-foreground)] max-w-sm">
        {t("common.notFoundDesc")}
      </p>
      <Link
        href="/"
        className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
      >
        {t("game.result.home")}
      </Link>
    </div>
  );
}
