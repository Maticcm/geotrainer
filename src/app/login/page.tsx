"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signInWithEmail } from "@/lib/auth-client";
import { flushSyncQueue, migrateLocalProgressToCloud } from "@/lib/cloud-sync";
import { Compass, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();

  // Validate internal redirect only
  const rawRedirect = searchParams.get("redirect") || searchParams.get("callbackUrl") || "/";
  const redirectUrl =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Prosimo, vnesite e-poštni naslov in geslo.");
      return;
    }

    setLoading(true);
    try {
      const res = await signInWithEmail({
        email: cleanEmail,
        password,
      });

      if (res?.error) {
        let msg = res.error.message || "Neveljaven e-poštni naslov ali geslo.";
        if (
          res.error.code === "INVALID_EMAIL_OR_PASSWORD" ||
          res.error.status === 401 ||
          res.error.message?.includes("Invalid email or password")
        ) {
          msg = "Napačen e-poštni naslov ali geslo. Preverite vnos in poskusite znova.";
        }
        setError(msg);
        setLoading(false);
        return;
      }

      // Successfully signed in
      migrateLocalProgressToCloud().catch(() => {});
      flushSyncQueue().catch(() => {});
      // Full navigation ensures fresh session cookies are picked up by all server components & navbar
      window.location.href = redirectUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Prišlo je do nepričakovane napake pri prijavi.";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/20 mb-1">
          <Compass className="h-6 w-6" strokeWidth={2.2} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          Prijava v <span className="text-blue-600 dark:text-blue-400">GeoTrainer</span>
        </h1>
        <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
          Prijavite se z Neon računom za sinhronizacijo napredka in dosežkov med napravami.
        </p>
      </div>

      {/* Main Card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 shadow-xs space-y-5">
        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2.5 animate-slide-up-fade">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)] block">
              E-poštni naslov
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)] pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ime@primer.si"
                autoComplete="email"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--foreground)] block">
                Geslo
              </label>
              <Link
                href="/forgot-password"
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Pozabljeno geslo?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)] pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 sm:py-3 min-h-[48px] text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 interactive-btn focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none touch-manipulation"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>Prijavi se</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer link to Register */}
      <div className="text-center text-xs text-[var(--muted-foreground)]">
        Še nimate računa?{" "}
        <Link
          href={`/signup${redirectUrl !== "/" ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""}`}
          className="font-bold text-blue-600 dark:text-blue-400 hover:underline p-1"
        >
          Ustvarite nov račun
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-3.5 sm:px-4 py-8 sm:py-12 pb-24 md:pb-12">
      <Suspense fallback={<div className="text-xs text-[var(--muted-foreground)]">Nalagam obrazec za prijavo …</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
