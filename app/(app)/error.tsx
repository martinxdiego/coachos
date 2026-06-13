"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] section error", error.digest ?? "");
  }, [error]);

  return (
    <Card className="mx-auto mt-10 max-w-md">
      <CardContent className="space-y-4 p-6 text-center">
        <h1 className="text-lg font-semibold tracking-tight">
          Dieser Bereich konnte nicht geladen werden
        </h1>
        <p className="text-sm text-muted-foreground">
          Es ist ein Fehler aufgetreten. Versuche es erneut — die Navigation
          bleibt erhalten.
        </p>
        <Button onClick={() => reset()} type="button">
          Erneut versuchen
        </Button>
      </CardContent>
    </Card>
  );
}
