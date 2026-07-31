"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCheck, Inbox, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { markCoachMessageRead } from "@/app/actions-public";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  coachMessageCategoryAccent,
  coachMessageCategoryEmoji
} from "@/lib/coach-messages";
import { cn, formatDateTime } from "@/lib/utils";
import type { CoachMessage } from "@/lib/types";

interface PublicCoachInboxProps {
  messages: CoachMessage[];
}

export function PublicCoachInbox({ messages }: PublicCoachInboxProps) {
  const t = useTranslations("inbox");
  const tCat = useTranslations("coachmsg");
  const [showRead, setShowRead] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const unread = messages.filter((msg) => !msg.read_at);
  const read = messages.filter((msg) => msg.read_at);
  const visible = showRead ? messages : unread;

  function handleMarkRead(id: string) {
    setPendingId(id);
    startTransition(async () => {
      try {
        await markCoachMessageRead(id);
        toast.success(t("toast_read"));
      } catch (err) {
        const message = err instanceof Error ? err.message : t("error_generic");
        toast.error(message);
      } finally {
        setPendingId(null);
      }
    });
  }

  if (messages.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Inbox aria-hidden="true" className="h-4.5 w-4.5 text-primary" />
            {t("title")}
            {unread.length > 0 ? (
              <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                {unread.length}
              </span>
            ) : null}
          </CardTitle>
          {read.length > 0 ? (
            <Button
              onClick={() => setShowRead((value) => !value)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {showRead ? t("only_unread") : t("all_count", { count: messages.length })}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-[13px] text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          visible.map((msg) => {
            const tone = coachMessageCategoryAccent[msg.category];
            const label = tCat(`cat_${msg.category}`);
            const emoji = coachMessageCategoryEmoji[msg.category];
            const isRead = Boolean(msg.read_at);
            return (
              <div
                className={cn(
                  "rounded-2xl border p-4 transition",
                  isRead ? "border-border bg-secondary/30 opacity-80" : tone
                )}
                key={msg.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">
                      <span aria-hidden="true">{emoji}</span> {label}
                    </p>
                    {msg.title ? (
                      <p className="mt-1 text-[15px] font-semibold tracking-tight">
                        {msg.title}
                      </p>
                    ) : null}
                    <p className="mt-1 whitespace-pre-wrap text-[14px] leading-6">
                      {msg.body}
                    </p>
                    <p className="mt-2 text-[11px] opacity-70">
                      {formatDateTime(msg.created_at)}
                      {msg.read_at
                        ? t("read_suffix", { date: formatDateTime(msg.read_at) })
                        : ""}
                    </p>
                  </div>
                  {!isRead ? (
                    <Button
                      className="shrink-0"
                      disabled={pendingId === msg.id}
                      onClick={() => handleMarkRead(msg.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {pendingId === msg.id ? (
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCheck aria-hidden="true" className="h-4 w-4" />
                      )}
                      {t("mark_read")}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
