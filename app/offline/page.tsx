import Link from "next/link";
import { CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <CloudOff aria-hidden="true" className="h-6 w-6" />
          </span>
          <CardTitle className="mt-2">Du bist offline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Sobald die Verbindung wieder da ist, kannst du CoachOS wie gewohnt
            nutzen. Persönliche und medizinische Seiten legt CoachOS aus
            Datenschutzgründen nicht im Offline-Cache der App ab.
          </p>
          <Button asChild className="w-full">
            <Link href="/">
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Erneut versuchen
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
