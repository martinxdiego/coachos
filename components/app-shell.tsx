import Link from "next/link";
import { Dumbbell, LogOut, Plus } from "lucide-react";
import { signOut } from "@/app/actions";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import type { TeamOption } from "@/lib/auth";
import type { Team } from "@/lib/types";

interface AppShellProps {
  activeTeam?: Team | null;
  children: React.ReactNode;
  teamOptions: TeamOption[];
}

export function AppShell({
  activeTeam,
  children,
  teamOptions
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-slate-900/10 bg-slate-950 text-white shadow-[0_18px_60px_rgba(15,23,42,0.18)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between gap-4">
              <Link className="flex items-center gap-3" href="/">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20">
                  <Dumbbell aria-hidden="true" className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-base font-semibold tracking-normal">
                    CoachOS
                  </span>
                  <span className="block text-xs text-slate-300">
                    Staff workspace for football coaches
                  </span>
                </div>
              </Link>
              <form action={signOut} className="lg:hidden">
                <Button
                  aria-label="Sign out"
                  className="text-white hover:bg-white/10 hover:text-white"
                  size="icon"
                  type="submit"
                  variant="ghost"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                </Button>
              </form>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <WorkspaceSwitcher
                activeTeamId={activeTeam?.id}
                teams={teamOptions}
              />
              <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
                <Link href="/workspaces">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Workspace
                </Link>
              </Button>
              <form action={signOut} className="hidden lg:block">
                <Button
                  aria-label="Sign out"
                  className="text-white hover:bg-white/10 hover:text-white"
                  size="icon"
                  type="submit"
                  variant="ghost"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">
                Active workspace
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal">
                {activeTeam?.name ?? "Create or join a workspace"}
              </h1>
              {activeTeam ? (
                <p className="mt-1 text-sm text-slate-300">
                  {activeTeam.season ?? "No season"} ·{" "}
                  {activeTeam.age_group ?? "No age group"}
                </p>
              ) : null}
            </div>
            <AppNav />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
