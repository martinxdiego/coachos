import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function legalOperator() {
  return {
    name: process.env.LEGAL_OPERATOR_NAME?.trim(),
    address: process.env.LEGAL_OPERATOR_ADDRESS?.trim(),
    email:
      process.env.LEGAL_CONTACT_EMAIL?.trim() ||
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim()
  };
}

export function LegalCard({
  title,
  updated = "30. Juli 2026",
  children
}: Readonly<{
  title: string;
  updated?: string;
  children: React.ReactNode;
}>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">Stand: {updated}</p>
      </CardHeader>
      <CardContent className="space-y-6 text-sm leading-7 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </CardContent>
    </Card>
  );
}

export function MissingLegalConfig() {
  const operator = legalOperator();
  if (operator.name && operator.address && operator.email) return null;
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
      role="alert"
    >
      <AlertTriangle
        aria-hidden="true"
        className="mt-1 h-5 w-5 shrink-0"
      />
      <p>
        Vor der Veröffentlichung müssen Betreibername, ladungsfähige Adresse
        und Kontakt-E-Mail über die vorgesehenen Umgebungsvariablen
        vervollständigt und die Texte juristisch geprüft werden.
      </p>
    </div>
  );
}

export function OperatorAddress() {
  const operator = legalOperator();
  return (
    <address className="not-italic">
      {operator.name ?? "[Betreibername ergänzen]"}
      <br />
      <span className="whitespace-pre-line">
        {operator.address ?? "[Ladungsfähige Adresse ergänzen]"}
      </span>
      <br />
      E-Mail: {operator.email ?? "[Kontakt-E-Mail ergänzen]"}
    </address>
  );
}
