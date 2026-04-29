import { Dumbbell, LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Dumbbell aria-hidden="true" className="h-4 w-4" />
              </div>
              <span className="text-base font-semibold tracking-normal">
                CoachOS
              </span>
            </div>
            <form action={signOut}>
              <Button aria-label="Sign out" size="icon" type="submit" variant="ghost">
                <LogOut aria-hidden="true" className="h-4 w-4" />
              </Button>
            </form>
          </div>
          <AppNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
