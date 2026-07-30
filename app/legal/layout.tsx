import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function LegalLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-dvh bg-secondary/30 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Button asChild size="sm" variant="ghost">
            <Link href="/">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Zur App
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <Scale aria-hidden="true" className="h-4 w-4" />
            CoachOS Rechtliches
          </div>
        </div>
        <nav
          aria-label="Rechtliche Seiten"
          className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2"
        >
          <Button asChild size="sm" variant="ghost">
            <Link href="/legal/privacy">Datenschutz</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/legal/imprint">Impressum</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/legal/terms">Nutzungsbedingungen</Link>
          </Button>
        </nav>
        {children}
      </div>
    </main>
  );
}
