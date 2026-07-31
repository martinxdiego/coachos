import Link from "next/link";
import Image from "next/image";
import {
  Bell,
  CreditCard,
  LifeBuoy,
  LogOut,
  Plus,
  UserRound
} from "lucide-react";
import { signOut } from "@/app/actions";
import { AppNav } from "@/components/app-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AppToaster } from "@/components/app-toaster";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { MobileAccountMenu } from "@/components/mobile-account-menu";
import { MoreNavProvider } from "@/components/more-nav-provider";
import { PageTransition } from "@/components/page-transition";
import { QuickCreate } from "@/components/quick-create";
import { Button } from "@/components/ui/button";
import type { TeamOption } from "@/lib/auth";
import type { Workspace } from "@prisma/client";

interface AppShellProps {
  activeTeam?: Workspace | null;
  children: React.ReactNode;
  quickPlayers?: {
    id: string;
    name: string;
    position: string | null;
  }[];
  attentionCount?: number;
  teamOptions: TeamOption[];
}

export function AppShell({
  activeTeam,
  attentionCount = 0,
  children,
  quickPlayers = [],
  teamOptions
}: AppShellProps) {
  return (
    <ConfirmProvider>
    <MoreNavProvider>
      <div className="min-h-dvh bg-background">
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-[calc(env(safe-area-inset-top)+1rem)] focus:z-[70] focus:rounded-lg focus:bg-emerald-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg"
          href="#main-content"
        >
          Zum Hauptinhalt springen
        </a>
        <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/85 pt-[env(safe-area-inset-top)] text-white shadow-[0_12px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6 md:gap-4">
            <Link
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 md:flex-none"
              href="/"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm">
                <Image
                  alt="SC Emmen"
                  className="h-full w-full object-contain"
                  height={36}
                  priority
                  src="/SCE.jpg"
                  width={36}
                />
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="text-[14px] font-semibold tracking-tight">
                  CoachOS
                </span>
                <span className="max-w-[140px] truncate text-[11px] text-slate-400 sm:max-w-[160px] lg:max-w-[200px]">
                  {activeTeam?.name ?? "Workspace wählen"}
                </span>
              </span>
            </Link>

            {activeTeam ? (
              <Button
                aria-label={
                  attentionCount > 0
                    ? `${attentionCount} offene Hinweise`
                    : "Aufmerksamkeitszentrale"
                }
                asChild
                className="relative h-11 w-11 shrink-0 text-white hover:bg-white/10"
                size="icon"
                variant="ghost"
              >
                <Link href="/notifications">
                  <Bell aria-hidden="true" className="h-4.5 w-4.5" />
                  {attentionCount > 0 ? (
                    <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-slate-950">
                      {attentionCount > 9 ? "9+" : attentionCount}
                    </span>
                  ) : null}
                </Link>
              </Button>
            ) : null}

            <MobileAccountMenu
              activeTeamId={activeTeam?.id}
              activeTeamName={activeTeam?.name}
              teams={teamOptions}
            />

            <div className="hidden flex-1 lg:flex lg:justify-center">
              <AppNav />
            </div>

            <div className="ml-auto hidden items-center gap-2 md:flex">
              <Button
                asChild
                className="h-11 bg-white text-slate-950 hover:bg-slate-100 lg:h-8"
                size="sm"
              >
                <Link href="/workspaces">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Workspace
                </Link>
              </Button>
              <LanguageSwitcher />
              <Button
                aria-label="Tarife und Abonnement"
                asChild
                className="h-11 w-11 text-white hover:bg-white/10 lg:h-10 lg:w-10"
                size="icon"
                variant="ghost"
              >
                <Link href="/pricing">
                  <CreditCard aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                aria-label="Konto und Sicherheit"
                asChild
                className="h-11 w-11 text-white hover:bg-white/10 lg:h-10 lg:w-10"
                size="icon"
                variant="ghost"
              >
                <Link href="/account">
                  <UserRound aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                aria-label="Hilfe und Support"
                asChild
                className="h-11 w-11 text-white hover:bg-white/10 lg:h-10 lg:w-10"
                size="icon"
                variant="ghost"
              >
                <Link href="/support">
                  <LifeBuoy aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
              <form action={signOut}>
                <Button
                  aria-label="Abmelden"
                  className="h-11 w-11 text-white hover:bg-white/10 lg:h-10 lg:w-10"
                  size="icon"
                  type="submit"
                  variant="ghost"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>

          <div className="hidden border-t border-white/5 px-4 pb-3 pt-2 md:flex md:justify-center lg:hidden">
            <AppNav />
          </div>
        </header>

        <main
          className="mx-auto max-w-7xl px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-8 md:pb-32"
          id="main-content"
          tabIndex={-1}
        >
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
