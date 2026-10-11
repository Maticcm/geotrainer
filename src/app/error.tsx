"use client";

import { useEffect } from "react";
import { useT } from "@/lib/hooks";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
      <span className="text-5xl">⚠️</span>
      <h1 className="text-2xl font-extrabold text-[var(--foreground)]">
        {t("common.error")}
      </h1>
      <p className="text-xs text-[var(--muted-foreground)] max-w-sm">
        {error.message || "Nepričakovana napaka."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
      >
        {t("common.tryAgain")}
      </button>
    </div>
  );
}
