"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signUpWithEmail } from "@/lib/auth-client";
import { flushSyncQueue, migrateLocalProgressToCloud } from "@/lib/cloud-sync";
import {
  Compass,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

function SignupForm() {
  const searchParams = useSearchParams();

  const rawRedirect = searchParams.get("redirect") || "/";
  const redirectUrl =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail || !password) {
      setError("Prosimo, izpolnite vsa obvezna polja.");
      return;
    }

    if (password.length < 8) {
      setError("Geslo mora vsebovati vsaj 8 znakov.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Gesli se ne ujemata.");
      return;
    }

    setLoading(true);
    try {
      const res = await signUpWithEmail({
        email: cleanEmail,
        password,
        name: cleanName,
      });

      if (res?.error) {
        let msg = res.error.message || "Registracija ni uspela. Preverite podatke in poskusite znova.";
        if (
          res.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
          res.error.message?.includes("already exists") ||
          res.error.status === 422
        ) {
          msg = "Uporabnik s tem e-poštnim naslovom že obstaja. Prijavite se z obstoječim računom.";
        }
        setError(msg);
        setLoading(false);
        return;
      }

      if (res?.data) {
        // If email verification is required by Neon Auth
        if ((res.data as Record<string, unknown>).emailVerificationRequired) {
          setVerificationSent(true);
          setLoading(false);
          return;
        }

        // Successfully registered and authenticated: migrate anonymous progress to cloud
        migrateLocalProgressToCloud().catch(() => {});
        flushSyncQueue().catch(() => {});
        window.location.href = redirectUrl;
        return;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Prišlo je do nepričakovane napake pri registraciji.";
      setError(msg);
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="w-full max-w-md mx-auto space-y-6 animate-slide-up-fade">
        <div className="rounded-2xl border border-emerald-500/30 bg-[var(--card)] p-8 text-center space-y-4 shadow-xs">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-extrabold text-[var(--foreground)]">
            Potrdite svoj e-poštni naslov
          </h2>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
            Na vaš naslov <strong className="text-[var(--foreground)]">{email}</strong> smo poslali potrditveno povezavo. Prosimo, kliknite nanjo za aktivacijo računa.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 interactive-btn"
            >
              <span>Nadaljuj na prijavo</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/20 mb-1">
          <Compass className="h-6 w-6" strokeWidth={2.2} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          Ustvarite račun za <span className="text-blue-600 dark:text-blue-400">GeoTrainer</span>
        </h1>
        <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
          Brezplačen račun omogoča varno shranjevanje znanja in uvrstitev na lestvici.
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
              Ime ali vzdevek <span className="text-[var(--muted-foreground)] font-normal">(neobvezno)</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)] pointer-events-none" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Janez Novak"
                autoComplete="name"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
              />
            </div>
          </div>

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
            <label className="text-xs font-semibold text-[var(--foreground)] block">
              Geslo <span className="text-[var(--muted-foreground)] font-normal">(vsaj 8 znakov)</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)] pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
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

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)] block">
              Ponovite geslo
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)] pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 sm:py-3 min-h-[48px] text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 interactive-btn focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none mt-2 touch-manipulation"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>Ustvari račun</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer link to Login */}
      <div className="text-center text-xs text-[var(--muted-foreground)]">
        Že imate račun?{" "}
        <Link
          href={`/login${redirectUrl !== "/" ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""}`}
          className="font-bold text-blue-600 dark:text-blue-400 hover:underline p-1"
        >
          Prijavite se
        </Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-3.5 sm:px-4 py-8 sm:py-12 pb-24 md:pb-12">
      <Suspense fallback={<div className="text-xs text-[var(--muted-foreground)]">Nalagam obrazec za registracijo …</div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
