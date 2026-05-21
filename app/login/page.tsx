"use client";

import { KeyRound, ShieldCheck, UsersRound } from "lucide-react";
import { signIn, signUp } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const features = [
  {
    icon: UsersRound,
    title: "Workspace zuerst",
    body: "Mehrere Teams, klare Trennung, schneller Wechsel.",
  },
  {
    icon: KeyRound,
    title: "Co-Trainer einladen",
    body: "Staff-Zugriff über einfache Invite-Codes.",
  },
  {
    icon: ShieldCheck,
    title: "Privat by default",
    body: "Keine Spieler- oder Elternaccounts in dieser Version.",
  },
];

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-white">

      {/* ── Animated background blobs ─────────────────────────────── */}
      <div
        aria-hidden="true"
        className="animate-blob pointer-events-none absolute -left-32 -top-32 h-[600px] w-[600px] rounded-full bg-emerald-500/20 blur-[120px]"
        style={{ animationDelay: "0s" }}
      />
      <div
        aria-hidden="true"
        className="animate-blob pointer-events-none absolute -bottom-40 -right-20 h-[500px] w-[500px] rounded-full bg-indigo-500/15 blur-[100px]"
        style={{ animationDelay: "3s" }}
      />
      <div
        aria-hidden="true"
        className="animate-blob pointer-events-none absolute right-1/3 top-1/4 h-[360px] w-[360px] rounded-full bg-emerald-400/10 blur-[90px]"
        style={{ animationDelay: "5.5s" }}
      />

      {/* ── Subtle grid overlay ───────────────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">

        {/* Left — hero copy */}
        <section className="space-y-8">
          {/* Badge */}
          <div
            className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-sm text-emerald-300 backdrop-blur-sm"
            style={{ animationDelay: "0ms" }}
          >
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            Private Trainerplattform
          </div>

          {/* Headline */}
          <div
            className="animate-fade-up"
            style={{ animationDelay: "80ms" }}
          >
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Ein Workspace für{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-emerald-200 to-teal-300 bg-clip-text text-transparent">
                Trainerteam, Planung, Taktik
              </span>{" "}
              und Spieltag.
            </h1>
            <p
              className="animate-fade-up mt-5 max-w-2xl text-base leading-7 text-slate-300"
              style={{ animationDelay: "160ms" }}
            >
              CoachOS bündelt Spieler, Trainingsphasen, Spiele, Material,
              Aufgaben und Taktikboards in einem professionellen Staff-Tool.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid gap-3 md:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="animate-fade-up group rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all duration-300 hover:border-emerald-400/30 hover:bg-white/10 hover:shadow-[0_0_24px_rgba(52,211,153,0.08)]"
                style={{ animationDelay: `${240 + i * 80}ms` }}
              >
                <f.icon
                  aria-hidden="true"
                  className="h-5 w-5 text-emerald-300 transition-transform duration-300 group-hover:scale-110"
                />
                <p className="mt-3 font-semibold">{f.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Right — auth forms */}
        <section className="space-y-4">
          {/* Login card */}
          <div
            className="animate-slide-right"
            style={{ animationDelay: "120ms" }}
          >
            <Card className="border-white/10 bg-white shadow-2xl">
              <CardHeader>
                <CardTitle className="text-slate-900">Einloggen</CardTitle>
                <CardDescription>
                  Zurück in deinen aktiven Trainer-Workspace.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={signIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">E-Mail</Label>
                    <Input
                      autoComplete="email"
                      className="transition-shadow focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
                      id="signin-email"
                      name="email"
                      required
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Passwort</Label>
                    <Input
                      autoComplete="current-password"
                      className="transition-shadow focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
                      id="signin-password"
                      name="password"
                      required
                      type="password"
                    />
                  </div>
                  <Button
                    className="relative w-full overflow-hidden bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98]"
                    type="submit"
                  >
                    Einloggen
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Register card */}
          <div
            className="animate-slide-right"
            style={{ animationDelay: "240ms" }}
          >
            <Card className="border-white/10 bg-white/90 shadow-xl backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">Account erstellen</CardTitle>
                <CardDescription>
                  Danach erstellst du einen Workspace oder trittst per Code bei.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={signUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-Mail</Label>
                    <Input
                      autoComplete="email"
                      className="transition-shadow focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
                      id="signup-email"
                      name="email"
                      required
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Passwort</Label>
                    <Input
                      autoComplete="new-password"
                      className="transition-shadow focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
                      id="signup-password"
                      minLength={8}
                      name="password"
                      required
                      type="password"
                    />
                  </div>
                  <Button
                    className="w-full active:scale-[0.98]"
                    type="submit"
                    variant="secondary"
                  >
                    Account erstellen
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
