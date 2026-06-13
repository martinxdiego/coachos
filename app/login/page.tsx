"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, ShieldCheck, UsersRound } from "lucide-react";
import { signIn, signUp } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Inline-Transition-Helper ─────────────────────────────────────────────────
// Erzeugt ein vollständiges CSSProperties-Objekt für state-gesteuerte Reveals.
function rx(
  visible: boolean,
  delayMs: number,
  from: { y?: number; x?: number } = { y: 22 }
): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible
      ? "translate(0,0)"
      : `translate(${from.x ?? 0}px,${from.y ?? 0}px)`,
    transition: [
      `opacity .65s cubic-bezier(.22,1,.36,1) ${delayMs}ms`,
      `transform .65s cubic-bezier(.22,1,.36,1) ${delayMs}ms`,
    ].join(", "),
  };
}

// ─── Feature-Daten ────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: UsersRound, label: "01", key: "feature1" },
  { icon: KeyRound, label: "02", key: "feature2" },
  { icon: ShieldCheck, label: "03", key: "feature3" },
] as const;

// ─── Komponente ───────────────────────────────────────────────────────────────
export default function LoginPage() {
  const t = useTranslations("auth");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // Prefers-reduced-motion: Intro überspringen
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRevealed(true);
      return;
    }
    const t = setTimeout(() => setRevealed(true), 1900);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-10 text-white">

      {/* ── Intro-Overlay ─────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950"
        style={{
          opacity: revealed ? 0 : 1,
          pointerEvents: revealed ? "none" : undefined,
          transition: "opacity .75s cubic-bezier(.22,1,.36,1) 0ms",
        }}
      >
        {/* Äusserer Glow-Ring */}
        <div className="animate-glow-breathe absolute h-56 w-56 rounded-full bg-emerald-500/18 blur-3xl" />

        {/* Logo-Kachel */}
        <div className="animate-logo-intro relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-emerald-400/25 bg-slate-900 shadow-[0_0_48px_rgba(52,211,153,.28)]">
          {/* Drehender Rahmen */}
          <div
            className="animate-spin-slow absolute inset-[-1px] rounded-2xl"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 60%, rgba(52,211,153,.55) 80%, transparent 100%)",
            }}
          />
          <ShieldCheck className="relative z-10 h-8 w-8 text-emerald-400" />
        </div>

        {/* Wortmarke */}
        <p
          className="mt-5 text-xl font-semibold tracking-tight text-white"
          style={{ animation: "fade-up .6s cubic-bezier(.22,1,.36,1) .7s both" }}
        >
          CoachOS
        </p>
        <p
          className="mt-1 text-[13px] text-emerald-400/80"
          style={{ animation: "fade-up .6s cubic-bezier(.22,1,.36,1) .95s both" }}
        >
          {t("wordmark_tagline")}
        </p>
      </div>

      {/* ── Animierte Hintergrund-Blobs ───────────────────────────── */}
      <div
        aria-hidden="true"
        className="animate-blob pointer-events-none absolute -left-40 -top-40 h-[680px] w-[680px] rounded-full bg-emerald-500/[.14] blur-[130px]"
        style={{ animationDelay: "0s" }}
      />
      <div
        aria-hidden="true"
        className="animate-blob pointer-events-none absolute -bottom-48 right-0 h-[560px] w-[560px] rounded-full bg-indigo-500/[.12] blur-[110px]"
        style={{ animationDelay: "3.5s" }}
      />
      <div
        aria-hidden="true"
        className="animate-blob pointer-events-none absolute right-1/4 top-1/3 h-[380px] w-[380px] rounded-full bg-teal-400/[.09] blur-[90px]"
        style={{ animationDelay: "6s" }}
      />

      {/* ── Dezentes Grid ─────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px)," +
            "linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* ── Inhalt ────────────────────────────────────────────────── */}
      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-12 lg:grid-cols-[1.15fr_.85fr] lg:items-center">

        {/* ── Linke Seite: Hero ───────────────────────────────────── */}
        <section className="space-y-10">

          {/* Badge */}
          <div style={rx(revealed, 0)}>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3.5 py-1.5 text-[13px] font-medium text-emerald-300 backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t("badge")}
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1
              className="max-w-[14ch] text-[2.75rem] font-bold leading-[1.1] tracking-tight sm:text-[3.5rem] lg:text-[4rem]"
              style={rx(revealed, 100)}
            >
              {t("headline_pre")}{" "}
              <span
                className="bg-gradient-to-r from-emerald-300 via-emerald-200 to-teal-300 bg-clip-text text-transparent"
              >
                {t("headline_accent")}
              </span>{" "}
              {t("headline_post")}
            </h1>
            <p
              className="max-w-[48ch] text-[1.05rem] leading-relaxed text-slate-400"
              style={rx(revealed, 220)}
            >
              {t("subtitle")}
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.key}
                className="group relative overflow-hidden rounded-2xl border border-white/[.07] bg-white/[.04] p-5 backdrop-blur-sm transition-all duration-300 hover:border-emerald-400/30 hover:bg-white/[.07] hover:shadow-[0_0_28px_rgba(52,211,153,.07)]"
                style={rx(revealed, 340 + i * 80)}
              >
                {/* Nummer-Label oben rechts */}
                <span className="absolute right-4 top-4 text-[11px] font-semibold tabular-nums text-white/20 transition-colors group-hover:text-emerald-400/50">
                  {f.label}
                </span>
                <f.icon
                  aria-hidden="true"
                  className="h-5 w-5 text-emerald-400 transition-transform duration-300 group-hover:scale-110"
                />
                <p className="mt-3 font-semibold leading-snug">
                  {t(`${f.key}_title`)}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                  {t(`${f.key}_body`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Rechte Seite: Forms ─────────────────────────────────── */}
        <section className="space-y-4">

          {/* Login Card */}
          <div style={rx(revealed, 180, { x: 20 })}>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_24px_64px_rgba(0,0,0,.55),0_0_0_1px_rgba(255,255,255,.05)] backdrop-blur-md">
              <div className="border-b border-slate-100 px-6 pb-4 pt-6">
                <p className="text-[17px] font-semibold text-slate-900">{t("signin_title")}</p>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {t("signin_subtitle")}
                </p>
              </div>
              <div className="px-6 py-5">
                <form action={signIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-slate-700" htmlFor="signin-email">{t("email")}</Label>
                    <Input
                      autoComplete="email"
                      className="border-slate-200 bg-slate-50 text-slate-900 transition-shadow placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(16,185,129,.12)] focus:ring-0"
                      id="signin-email"
                      name="email"
                      placeholder="coach@team.ch"
                      required
                      type="email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-700" htmlFor="signin-password">{t("password")}</Label>
                    <Input
                      autoComplete="current-password"
                      className="border-slate-200 bg-slate-50 text-slate-900 transition-shadow placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(16,185,129,.12)] focus:ring-0"
                      id="signin-password"
                      name="password"
                      required
                      type="password"
                    />
                  </div>
                  <Button
                    className="relative w-full overflow-hidden bg-emerald-600 text-white shadow-[0_2px_12px_rgba(16,185,129,.35)] transition-all duration-200 hover:bg-emerald-500 hover:shadow-[0_4px_20px_rgba(16,185,129,.45)] active:scale-[.98]"
                    type="submit"
                  >
                    {t("signin_button")}
                  </Button>
                </form>
              </div>
            </div>
          </div>

          {/* Register Card */}
          <div style={rx(revealed, 320, { x: 20 })}>
            <div className="overflow-hidden rounded-2xl border border-white/[.09] bg-white/[.06] shadow-[0_12px_40px_rgba(0,0,0,.3)] backdrop-blur-xl">
              <div className="border-b border-white/10 px-6 pb-4 pt-6">
                <p className="text-[17px] font-semibold text-white">{t("signup_title")}</p>
                <p className="mt-0.5 text-[13px] text-slate-400">
                  {t("signup_subtitle")}
                </p>
              </div>
              <div className="px-6 py-5">
                <form action={signUp} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-slate-300" htmlFor="signup-email">{t("email")}</Label>
                    <Input
                      autoComplete="email"
                      className="border-white/10 bg-white/10 text-white placeholder:text-slate-500 focus:border-emerald-400/50 focus:bg-white/15 focus:shadow-[0_0_0_3px_rgba(16,185,129,.1)] focus:ring-0"
                      id="signup-email"
                      name="email"
                      placeholder="coach@team.ch"
                      required
                      type="email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-300" htmlFor="signup-password">{t("password")}</Label>
                    <Input
                      autoComplete="new-password"
                      className="border-white/10 bg-white/10 text-white placeholder:text-slate-500 focus:border-emerald-400/50 focus:bg-white/15 focus:shadow-[0_0_0_3px_rgba(16,185,129,.1)] focus:ring-0"
                      id="signup-password"
                      minLength={10}
                      name="password"
                      required
                      type="password"
                    />
                  </div>
                  <Button
                    className="w-full border border-white/15 bg-white/10 text-white transition-all duration-200 hover:bg-white/18 active:scale-[.98]"
                    type="submit"
                    variant="ghost"
                  >
                    {t("signup_button")}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
