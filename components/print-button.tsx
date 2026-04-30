"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Drucken" }: { label?: string }) {
  return (
    <Button onClick={() => window.print()} size="sm" type="button" variant="outline">
      <Printer aria-hidden="true" className="h-4 w-4" />
      {label}
    </Button>
  );
}
