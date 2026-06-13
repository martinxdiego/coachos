"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for monitoring (Sentry hook lands in S4.3).
    console.error("[app] unhandled error", error.digest ?? "");
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Etwas ist schiefgelaufen
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Es ist ein unerwarteter Fehler aufgetreten. Du kannst es erneut
          versuchen.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => reset()} type="button">
            Erneut versuchen
          </Button>
        </div>
      </div>
    </div>
  );
}
