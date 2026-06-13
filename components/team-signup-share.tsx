"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, QrCode as QrIcon, RefreshCw, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { rotateTeamSignupCode } from "@/app/actions";
import { QrCode, qrCodeUrl } from "@/components/qr-code";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

interface TeamSignupShareProps {
  teamSignupToken: string;
  teamName: string;
}

export function TeamSignupShare({
  teamSignupToken,
  teamName
}: TeamSignupShareProps) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState<string>("");
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const path = `/beitreten/${teamSignupToken}`;
  const fullUrl = origin ? `${origin}${path}` : path;

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success("Beitritts-Link kopiert");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Konnte Link nicht kopieren");
    }
  }

  function printQr() {
    const qrSrc = qrCodeUrl(fullUrl, 600);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Bitte Pop-up zulassen");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Team-Beitritt · ${teamName}</title>
          <style>
            body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 40px; text-align: center; }
            h1 { font-size: 32px; margin-bottom: 8px; }
            p { color: #475569; margin: 8px 0 24px; }
            img { width: 320px; height: 320px; }
            .url { font-size: 12px; word-break: break-all; color: #64748b; margin-top: 24px; }
          </style>
        </head>
        <body>
          <h1>${teamName}</h1>
          <p>Scanne den QR-Code, trag dich ein, du bist im Team.</p>
          <img alt="QR-Code Beitritt" src="${qrSrc}" />
          <p class="url">${fullUrl}</p>
          <script>setTimeout(() => window.print(), 250);</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <Card className="border-emerald-300 bg-gradient-to-br from-emerald-500/10 via-emerald-500/0 to-emerald-500/0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UsersRound aria-hidden="true" className="h-4.5 w-4.5 text-emerald-700" />
          Spieler einladen — ohne Login
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[13px] leading-6 text-muted-foreground">
          Teile den Link oder QR-Code mit deinen Spielern. Sie tragen sich
          selbst ein und erhalten danach automatisch ihren persönlichen Bereich
          mit Heute-Check-in, Saisonblatt und Trainer-Postfach.
        </p>
        <div className="rounded-xl border border-border bg-white/70 p-3 text-[12px] break-all text-muted-foreground">
          {fullUrl}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={copy} size="sm">
            {copied ? (
              <Check aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Copy aria-hidden="true" className="h-4 w-4" />
            )}
            {copied ? "Kopiert" : "Link kopieren"}
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={path} rel="noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              Vorschau öffnen
            </a>
          </Button>
          <Button
            onClick={() => setShowQr((value) => !value)}
            size="sm"
            variant="outline"
          >
            <QrIcon aria-hidden="true" className="h-4 w-4" />
            {showQr ? "QR ausblenden" : "QR-Code zeigen"}
          </Button>
          <Button onClick={printQr} size="sm" variant="outline">
            <Download aria-hidden="true" className="h-4 w-4" />
            QR drucken
          </Button>
          <form
            action={rotateTeamSignupCode}
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Neuen Beitritts-Link erzeugen? Der bisherige Link und QR-Code werden sofort ungültig."
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <Button size="sm" type="submit" variant="outline">
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Link erneuern
            </Button>
          </form>
        </div>
        {showQr ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-white/70 p-5">
            <QrCode size={240} value={fullUrl} />
            <p className="text-center text-[12px] text-muted-foreground">
              QR-Code mit Handy-Kamera scannen → Anmeldeformular öffnet sich.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
