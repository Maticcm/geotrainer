"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "@/lib/auth-client";
import { Compass, Mail, ArrowRight, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Prosimo, vnesite e-poštni naslov.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail({
        email: cleanEmail,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Prišlo je do napake pri pošiljanju zahteve.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-3.5 sm:px-4 py-8 sm:py-12 pb-24 md:pb-12">
      <div className="w-full max-w-md mx-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/20 mb-1">
            <Compass className="h-6 w-6" strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
            Pozabljeno geslo
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
            Vnesite svoj e-poštni naslov in poslali vam bomo povezavo za ponastavitev gesla.
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 shadow-xs space-y-5">
          {submitted ? (
            <div className="text-center space-y-4 py-2 animate-slide-up-fade">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                Preverite svojo e-pošto
              </h2>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Če račun z naslovom <strong className="text-[var(--foreground)]">{email}</strong> obstaja, smo vam poslali navodila za ponastavitev gesla.
              </p>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 interactive-btn"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Nazaj na prijavo</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2.5 animate-slide-up-fade">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

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

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 interactive-btn focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Pošlji navodila</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer link to Login */}
        <div className="text-center text-xs text-[var(--muted-foreground)]">
          Se spomnite gesla?{" "}
          <Link href="/login" className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
            Nazaj na prijavo
          </Link>
        </div>
      </div>
    </div>
  );
}
