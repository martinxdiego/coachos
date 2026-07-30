import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { resetPassword } from "@/app/forgot-password/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ResetPasswordPageProps {
  params: Promise<{ token: string }>;
}

export default async function ResetPasswordPage({
  params
}: ResetPasswordPageProps) {
  const { token } = await params;
  const plausible = token.length >= 32 && token.length <= 128;

  return (
    <main className="grid min-h-dvh place-items-center bg-secondary/30 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
            <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          </div>
          <CardTitle>Neues Passwort setzen</CardTitle>
        </CardHeader>
        <CardContent>
          {plausible ? (
            <form action={resetPassword} className="space-y-4">
              <input name="token" type="hidden" value={token} />
              <div className="space-y-2">
                <Label htmlFor="password">Neues Passwort</Label>
                <Input
                  autoComplete="new-password"
                  id="password"
                  maxLength={128}
                  minLength={10}
                  name="password"
                  required
                  type="password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-confirmation">Passwort bestätigen</Label>
                <Input
                  autoComplete="new-password"
                  id="password-confirmation"
                  maxLength={128}
                  minLength={10}
                  name="password_confirmation"
                  required
                  type="password"
                />
              </div>
              <Button className="w-full" type="submit">
                Passwort speichern
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>Dieser Link ist ungültig.</p>
              <Button asChild>
                <Link href="/forgot-password">Neuen Link anfordern</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
