import { ShieldCheck } from "lucide-react";
import { signIn, signUp } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginPageProps {
  searchParams?: Promise<{
    message?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const message = resolvedSearchParams?.message;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-4xl space-y-6">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-normal">CoachOS</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Team management for football coaches.
          </p>
        </div>

        {message ? (
          <div className="mx-auto max-w-md rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Continue with your coach account.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={signIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    autoComplete="email"
                    id="signin-email"
                    name="email"
                    required
                    type="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    autoComplete="current-password"
                    id="signin-password"
                    name="password"
                    required
                    type="password"
                  />
                </div>
                <Button className="w-full" type="submit">
                  Sign in
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create account</CardTitle>
              <CardDescription>Set up a new private workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={signUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    autoComplete="email"
                    id="signup-email"
                    name="email"
                    required
                    type="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    autoComplete="new-password"
                    id="signup-password"
                    minLength={8}
                    name="password"
                    required
                    type="password"
                  />
                </div>
                <Button className="w-full" type="submit" variant="secondary">
                  Create account
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
