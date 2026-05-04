import Link from "next/link";
import Image from "next/image";
import { LogOut, Plus } from "lucide-react";
import { signOut } from "@/app/actions";
import { AppNav } from "@/components/app-nav";
import { AppToaster } from "@/components/app-toaster";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { MoreNavProvider } from "@/components/more-nav-provider";
import { PageTransition } from "@/components/page-transition";
import { QuickCreate } from "@/components/quick-create";
import { Button } from "@/components/ui/button";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import type { TeamOption } from "@/lib/auth";
import type { Team } from "@/lib/types";

interface AppShellProps {
  activeTeam?: Team | null;
  children: React.ReactNode;
  quickPlayers?: {
    id: string;
    name: string;
    position: string | null;
  }[];
  teamOptions: TeamOption[];
}

export function AppShell({
  activeTeam,
  children,
  quickPlayers = [],
  teamOptions
}: AppShellProps) {
  return (
    <ConfirmProvider>
    <MoreNavProvider>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/85 text-white shadow-[0_12px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
            <Link className="flex items-center gap-2.5" href="/">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white p-1 shadow-sm">
                <Image
                  alt="SC Emmen"
                  className="h-full w-full object-contain"
                  height={36}
                  priority
                  src="/SCE.jpg"
                  width={36}
                />
              </span>
              <span className="hidden flex-col leading-tight sm:flex">
                <span className="text-[14px] font-semibold tracking-tight">
                  CoachOS
                </span>
                <span className="text-[11px] text-slate-400">
                  {activeTeam?.name ?? "Workspace wählen"}
                </span>
              </span>
            </Link>

            <div className="hidden flex-1 lg:flex lg:justify-center">
              <AppNav />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <WorkspaceSwitcher
                activeTeamId={activeTeam?.id}
                teams={teamOptions}
              />
              <Button
                asChild
                className="hidden bg-white text-slate-950 hover:bg-slate-100 sm:inline-flex"
                size="sm"
              >
                <Link href="/workspaces">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Workspace
                </Link>
              </Button>
              <form action={signOut}>
                <Button
                  aria-label="Abmelden"
                  className="text-white hover:bg-white/10"
                  size="icon"
                  type="submit"
                  variant="ghost"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>

          <div className="border-t border-white/5 px-4 pb-3 pt-2 lg:hidden">
            <AppNav />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-32 pt-6 sm:px-6 sm:pt-8">
          <PageTransition>{children}</PageTransition>
        </main>

        <QuickCreate enabled={Boolean(activeTeam)} players={quickPlayers} />
        <MobileBottomNav enabled={Boolean(activeTeam)} />
        <AppToaster />
      </div>
    </MoreNavProvider>
    </ConfirmProvider>
  );
}
