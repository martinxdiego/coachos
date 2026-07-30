"use client";

import { useState, useTransition } from "react";
import { Check, HelpCircle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { submitAvailability } from "@/app/actions-public";
import { cn } from "@/lib/utils";

type AvailabilityStatus = "YES" | "MAYBE" | "NO";

interface PublicAvailabilityButtonsProps {
  eventId: string;
  eventType: "TRAINING" | "MATCH";
  initialStatus?: AvailabilityStatus | null;
}

const choices = [
  { status: "YES" as const, label: "Dabei", icon: Check, active: "bg-emerald-600 text-white" },
  { status: "MAYBE" as const, label: "Vielleicht", icon: HelpCircle, active: "bg-amber-500 text-white" },
  { status: "NO" as const, label: "Abwesend", icon: X, active: "bg-red-600 text-white" }
];

export function PublicAvailabilityButtons({
  eventId,
  eventType,
  initialStatus
}: PublicAvailabilityButtonsProps) {
  const [status, setStatus] = useState<AvailabilityStatus | null>(
    initialStatus ?? null
  );
  const [pending, startTransition] = useTransition();

  function respond(nextStatus: AvailabilityStatus) {
    const formData = new FormData();
    formData.set("event_id", eventId);
    formData.set("event_type", eventType);
    formData.set("status", nextStatus);
    startTransition(async () => {
      try {
        await submitAvailability(formData);
        setStatus(nextStatus);
        toast.success("Teilnahme gespeichert");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Antwort konnte nicht gespeichert werden."
        );
      }
    });
  }

  return (
    <div
      aria-label="Teilnahme"
      className="mt-3 grid grid-cols-3 gap-1.5 border-t border-current/10 pt-3"
      role="group"
    >
      {choices.map((choice) => {
        const Icon = pending && status === choice.status ? Loader2 : choice.icon;
        return (
          <button
            aria-pressed={status === choice.status}
            className={cn(
              "flex min-h-10 items-center justify-center gap-1 rounded-xl bg-white/75 px-2 text-[11px] font-semibold shadow-sm transition disabled:opacity-60",
              status === choice.status && choice.active
            )}
            disabled={pending}
            key={choice.status}
            onClick={() => respond(choice.status)}
            type="button"
          >
            <Icon
              aria-hidden="true"
              className={cn("h-3.5 w-3.5", pending && "animate-spin")}
            />
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
