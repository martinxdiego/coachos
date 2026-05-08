"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, QrCode as QrIcon, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { QrCode } from "@/components/qr-code";
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
  accessToken: string;
}

export function PlayerModeShare({
  playerId: _playerId,
  playerName,
  accessToken
}: PlayerModeShareProps) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState<string>("");
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const path = `/spieler/${accessToken}`;
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
          Persönlicher Spieler-Bereich
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[13px] leading-6 text-muted-foreground">
          Eigener Link für {playerName} — kein Login nötig. Wellness-Check-in,
          Saisonblatt, Notiz an Trainer und dein Postfach mit Mitteilungen.
        </p>
        <div className="rounded-xl border border-border bg-secondary/30 p-3 text-[12px] break-all text-muted-foreground">
          {fullUrl}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={path} rel="noreferrer" target="_blank">
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
          <Button
            onClick={() => setShowQr((value) => !value)}
            size="sm"
            variant="outline"
          >
            <QrIcon aria-hidden="true" className="h-4 w-4" />
            {showQr ? "QR ausblenden" : "QR-Code zeigen"}
          </Button>
        </div>
        {showQr ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-secondary/30 p-5">
            <QrCode size={220} value={fullUrl} />
            <p className="text-center text-[12px] text-muted-foreground">
              Spieler scannt mit Handy-Kamera → landet direkt im eigenen Bereich.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
