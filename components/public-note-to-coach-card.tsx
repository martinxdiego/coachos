"use client";

import { useState, useTransition } from "react";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { submitPlayerNoteToCoach } from "@/app/actions-public";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const moodScale = [
  { value: 2, label: "😞", description: "Schlecht" },
  { value: 4, label: "😐", description: "Naja" },
  { value: 6, label: "🙂", description: "Ok" },
  { value: 8, label: "😊", description: "Gut" },
  { value: 10, label: "🤩", description: "Top" }
];

export function PublicNoteToCoachCard({ accessToken }: { accessToken: string }) {
  const [mood, setMood] = useState(8);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const formId = "public-note-to-coach";

  function handle(formData: FormData) {
    startTransition(async () => {
      try {
        await submitPlayerNoteToCoach(accessToken, formData);
        toast.success("Notiz an Trainer gesendet");
        setBody("");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Konnte nicht senden.";
        toast.error(message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquarePlus
            aria-hidden="true"
            className="h-4.5 w-4.5 text-primary"
          />
          Notiz an den Trainer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handle} className="space-y-3" id={formId}>
          <input name="rating" type="hidden" value={mood} />
          <p className="text-[12px] font-medium tracking-tight text-muted-foreground">
            Wie geht es dir gerade?
          </p>
          <div className="grid grid-cols-5 gap-2">
            {moodScale.map((item) => {
              const active = item.value === mood;
              return (
                <button
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-medium transition",
                    active
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                  key={item.value}
                  onClick={() => setMood(item.value)}
                  type="button"
                >
                  <span aria-hidden="true" className="text-2xl">
                    {item.label}
                  </span>
                  {item.description}
                </button>
              );
            })}
          </div>
          <Textarea
            name="body"
            onChange={(event) => setBody(event.target.value)}
            placeholder="Z.B. Habe Knieprobleme nach dem letzten Training. Bitte heute schonen."
            required
            value={body}
          />
          <Button
            className="h-11 w-full"
            disabled={isPending || body.trim().length === 0}
            type="submit"
          >
            {isPending ? (
              <>
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Sende…
              </>
            ) : (
              "An Trainer senden"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
