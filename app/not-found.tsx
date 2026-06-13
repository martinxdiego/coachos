import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          404
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          Seite nicht gefunden
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Diese Seite gibt es nicht (mehr). Vielleicht wurde der Link geändert.
        </p>
        <div className="mt-5 flex justify-center">
          <Button asChild>
            <Link href="/">Zur Startseite</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
