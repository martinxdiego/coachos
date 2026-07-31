"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import {
  requestPasswordReset,
  type PasswordResetRequestState
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<
    PasswordResetRequestState,
    FormData
  >(requestPasswordReset, null);

  return (
    <main className="grid min-h-dvh place-items-center bg-secondary/30 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
            <KeyRound aria-hidden="true" className="h-5 w-5" />
          </div>
          <CardTitle>Passwort vergessen?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state?.status === "success" ? (
            <div className="space-y-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">
              {state.developmentUrl ? (
                <>
                  <p>
                    Der E-Mail-Versand ist in dieser Vorschau nicht
                    konfiguriert. Nutze den sicheren Testlink:
                  </p>
                  <Link
                    className="inline-flex min-h-11 items-center font-semibold underline"
                    href={state.developmentUrl}
                  >
                    Testlink zum Zurücksetzen öffnen
                  </Link>
                </>
              ) : (
                <p>
                  Falls ein Konto existiert, wurde ein Link zum Zurücksetzen
                  versendet.
                </p>
              )}
            </div>
          ) : (
            <form action={action} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">E-Mail</Label>
                <Input
                  autoComplete="email"
                  id="reset-email"
                  maxLength={254}
                  name="email"
                  required
                  type="email"
                />
              </div>
              <Button className="w-full" disabled={pending} type="submit">
                {pending ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : null}
                Link anfordern
              </Button>
            </form>
          )}
          <Button asChild className="w-full" variant="ghost">
            <Link href="/login">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Zur Anmeldung
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
