"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  Printer,
  QrCode as QrIcon,
  RefreshCw,
  UsersRound
} from "lucide-react";
import { toast } from "sonner";
import { rotateTeamSignupCode } from "@/app/actions";
import { createQrCodeDataUrl, QrCode } from "@/components/qr-code";
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

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPE_MAP[character] ?? character
  );
}

export function TeamSignupShare({
  teamSignupToken,
  teamName
}: TeamSignupShareProps) {
  const [copied, setCopied] = useState(false);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [origin, setOrigin] = useState<string>("");
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const path = `/join/${teamSignupToken}`;
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

  async function printQr() {
    if (isPreparingPrint) {
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Bitte Pop-up zulassen");
      return;
    }

    setIsPreparingPrint(true);
    printWindow.opener = null;

    const safeTeamName = escapeHtml(teamName);
    printWindow.document.write(`
      <!doctype html>
      <html lang="de">
        <head>
          <meta charset="utf-8" />
          <title>Team-Beitritt · ${safeTeamName}</title>
          <style>
            body {
              display: grid;
              min-height: 80vh;
              place-items: center;
              font-family: ui-sans-serif, system-ui, sans-serif;
              color: #0f172a;
            }
            p { color: #475569; }
          </style>
        </head>
        <body>
          <main aria-live="polite">
            <h1>${safeTeamName}</h1>
            <p>QR-Code wird lokal erstellt …</p>
          </main>
        </body>
      </html>
    `);
    printWindow.document.close();

    try {
      const urlToPrint = `${window.location.origin}${path}`;
      const qrSrc = await createQrCodeDataUrl(urlToPrint, 640);

      if (printWindow.closed) {
        return;
      }

      const safeUrl = escapeHtml(urlToPrint);
      printWindow.document.open();
      printWindow.document.write(`
        <!doctype html>
        <html lang="de">
          <head>
            <meta charset="utf-8" />
            <title>Team-Beitritt · ${safeTeamName}</title>
            <style>
              @page { margin: 16mm; }
              * { box-sizing: border-box; }
              body {
                display: grid;
                min-height: 80vh;
                margin: 0;
                place-items: center;
                font-family: ui-sans-serif, system-ui, sans-serif;
                color: #0f172a;
                text-align: center;
              }
              main { max-width: 680px; }
              h1 { margin: 0 0 8px; font-size: 32px; }
              p { margin: 8px 0 24px; color: #475569; }
              img { width: 320px; height: 320px; }
              .url {
                margin-top: 24px;
                color: #64748b;
                font-size: 12px;
                overflow-wrap: anywhere;
              }
            </style>
          </head>
          <body>
            <main>
              <h1>${safeTeamName}</h1>
              <p>Scanne den QR-Code, trag dich ein, du bist im Team.</p>
              <img
                alt="QR-Code für den Team-Beitritt"
                data-team-signup-qr
                height="320"
                src="${qrSrc}"
                width="320"
              />
              <p class="url">${safeUrl}</p>
            </main>
          </body>
        </html>
      `);
      printWindow.document.close();

      const image = printWindow.document.querySelector<HTMLImageElement>(
        "img[data-team-signup-qr]"
      );
      const openPrintDialog = () => {
        if (!printWindow.closed) {
          printWindow.focus();
          printWindow.print();
        }
      };

      if (image?.complete) {
        printWindow.setTimeout(openPrintDialog, 150);
      } else {
        image?.addEventListener("load", openPrintDialog, { once: true });
        image?.addEventListener(
          "error",
          () => toast.error("QR-Code konnte nicht geladen werden"),
          { once: true }
        );
      }
    } catch {
      if (!printWindow.closed) {
        printWindow.document.open();
        printWindow.document.write(`
          <!doctype html>
          <html lang="de">
            <head><meta charset="utf-8" /><title>QR-Code-Fehler</title></head>
            <body style="font-family: ui-sans-serif, system-ui, sans-serif; padding: 40px;">
              <h1>QR-Code konnte nicht erstellt werden</h1>
              <p>Schließe dieses Fenster und versuche es erneut.</p>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
      toast.error("QR-Code konnte nicht erstellt werden");
    } finally {
      setIsPreparingPrint(false);
    }
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
            aria-controls="team-signup-qr"
            aria-expanded={showQr}
            onClick={() => setShowQr((value) => !value)}
            size="sm"
            variant="outline"
          >
            <QrIcon aria-hidden="true" className="h-4 w-4" />
            {showQr ? "QR ausblenden" : "QR-Code zeigen"}
          </Button>
          <Button
            aria-busy={isPreparingPrint}
            disabled={isPreparingPrint}
            onClick={printQr}
            size="sm"
            variant="outline"
          >
            {isPreparingPrint ? (
              <LoaderCircle
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <Printer aria-hidden="true" className="h-4 w-4" />
            )}
            {isPreparingPrint ? "QR wird erstellt …" : "QR drucken"}
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
          <div
            className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-white/70 p-5"
            id="team-signup-qr"
          >
            <QrCode
              alt="QR-Code für den Team-Beitritt"
              size={240}
              value={fullUrl}
            />
            <p className="text-center text-[12px] text-muted-foreground">
              QR-Code mit Handy-Kamera scannen → Anmeldeformular öffnet sich.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
