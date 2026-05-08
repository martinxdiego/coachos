"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

interface PlayerModeShareProps {
  playerId: string;
  playerName: string;
}

export function PlayerModeShare({ playerId, playerName }: PlayerModeShareProps) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const path = `/player-mode?player=${playerId}`;
  const fullUrl = origin ? `${origin}${path}` : path;

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success("Link kopiert");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Konnte Link nicht kopieren");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCircle2 aria-hidden="true" className="h-4.5 w-4.5 text-primary" />
          Spieler-Modus
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[13px] leading-6 text-muted-foreground">
          Persönliche App-Sicht für {playerName}: Heute-Check-in, Termine,
          Feedback und Saisonblatt.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={path}>
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              Vorschau öffnen
            </Link>
          </Button>
          <Button onClick={copy} size="sm" variant="outline">
            {copied ? (
              <Check aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Copy aria-hidden="true" className="h-4 w-4" />
            )}
            {copied ? "Kopiert" : "Link kopieren"}
          </Button>
        </div>
        <details className="rounded-xl border border-dashed border-border bg-secondary/30 p-3 text-[12px] text-muted-foreground">
          <summary className="cursor-pointer font-medium">
            Wie kommt der Spieler an seinen Bereich?
          </summary>
          <p className="mt-2 leading-6">
            Aktuell brauchen Spieler ein Login mit derselben E-Mail, die unter
            Kontakte → „Spieler-Login E-Mail&ldquo; hinterlegt ist. Sobald der
            Spieler eingeloggt ist, landet er direkt auf seinem Bereich. Du als
            Trainer kannst die Vorschau jederzeit über den Link oben öffnen.
          </p>
        </details>
      </CardContent>
    </Card>
  );
}
