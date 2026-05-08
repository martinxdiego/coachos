"use client";

import { useState } from "react";
import { CheckCircle2, MessageSquarePlus, Send, Trash2 } from "lucide-react";
import { createCoachMessage, deleteCoachMessage } from "@/app/actions";
import { ToastForm } from "@/components/toast-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  coachMessageCategoryAccent,
  coachMessageCategoryEmoji,
  coachMessageCategoryLabel
} from "@/lib/coach-messages";
import { cn, formatDateTime } from "@/lib/utils";
import type { CoachMessage, CoachMessageCategory } from "@/lib/types";

interface CoachMessagesCardProps {
  playerId: string;
  playerName: string;
  messages: CoachMessage[];
}

const categories: { value: CoachMessageCategory; label: string; emoji: string }[] = [
  { value: "training_goal", label: "Trainingsziel", emoji: "🎯" },
  { value: "match_goal", label: "Spielziel", emoji: "⚽️" },
  { value: "note", label: "Notiz", emoji: "📝" },
  { value: "praise", label: "Lob", emoji: "🏆" }
];

export function CoachMessagesCard({
  playerId,
  playerName,
  messages
}: CoachMessagesCardProps) {
  const [category, setCategory] = useState<CoachMessageCategory>("training_goal");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquarePlus
            aria-hidden="true"
            className="h-4.5 w-4.5 text-primary"
          />
          Mitteilung an {playerName.split(" ")[0]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ToastForm
          action={createCoachMessage}
          className="space-y-3"
          successMessage="Mitteilung gesendet"
        >
          <input name="player_id" type="hidden" value={playerId} />
          <input name="category" type="hidden" value={category} />

          <div>
            <p className="mb-2 text-[12px] font-medium tracking-tight text-muted-foreground">
              Kategorie
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {categories.map((item) => {
                const active = category === item.value;
                return (
                  <button
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[12px] font-medium transition",
                      active
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    )}
                    key={item.value}
                    onClick={() => setCategory(item.value)}
                    type="button"
                  >
                    <span aria-hidden="true" className="text-lg">
                      {item.emoji}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            name="title"
            placeholder='Titel (optional, z.B. „Heute zwei Tore")'
          />
          <Textarea
            name="body"
            placeholder="Was soll der Spieler sehen oder umsetzen?"
            required
          />

          <Button type="submit">
            <Send aria-hidden="true" className="h-4 w-4" />
            An Spieler senden
          </Button>
        </ToastForm>

        <div className="space-y-2 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Verlauf ({messages.length})
          </p>
          {messages.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-[13px] text-muted-foreground">
              Noch keine Mitteilungen verschickt.
            </p>
          ) : (
            messages.slice(0, 8).map((msg) => {
              const tone = coachMessageCategoryAccent[msg.category];
              const label = coachMessageCategoryLabel[msg.category];
              const emoji = coachMessageCategoryEmoji[msg.category];
              const isRead = Boolean(msg.read_at);
              return (
                <div
                  className={cn("rounded-2xl border p-3.5", tone)}
                  key={msg.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-80">
                        <span aria-hidden="true">{emoji}</span> {label}
                      </p>
                      {msg.title ? (
                        <p className="mt-1 text-[14px] font-semibold tracking-tight">
                          {msg.title}
                        </p>
                      ) : null}
                      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-6">
                        {msg.body}
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] opacity-70">
                        {formatDateTime(msg.created_at)}
                        {isRead ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <CheckCircle2
                              aria-hidden="true"
                              className="h-3 w-3 text-emerald-700"
                            />
                            gelesen {formatDateTime(msg.read_at!)}
                          </>
                        ) : (
                          <span className="text-amber-700">
                            · noch nicht gelesen
                          </span>
                        )}
                      </p>
                    </div>
                    <form action={deleteCoachMessage}>
                      <input name="id" type="hidden" value={msg.id} />
                      <input name="player_id" type="hidden" value={playerId} />
                      <Button
                        aria-label="Mitteilung löschen"
                        size="icon"
                        type="submit"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
