"use client";

import { useRef, useTransition } from "react";
import { toastDeleted, toastError } from "@/lib/toast";

interface ConfirmDeleteFormProps
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> {
  action: (formData: FormData) => Promise<unknown> | unknown;
  confirm: { title: string; description?: string };
  successMessage: string;
  errorMessage?: string;
  onComplete?: () => void;
  children: React.ReactNode;
}

function isRedirectError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const digest = (err as { digest?: string }).digest;
  return (
    err.message === "NEXT_REDIRECT" ||
    (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT"))
  );
}

export function ConfirmDeleteForm({
  action,
  successMessage,
  errorMessage,
  onComplete,
  children,
  ...formProps
}: ConfirmDeleteFormProps) {
  const [, startTransition] = useTransition();
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    cancelledRef.current = false;

    timerRef.current = setTimeout(() => {
      if (cancelledRef.current) return;
      startTransition(async () => {
        try {
          await action(formData);
          onComplete?.();
        } catch (err) {
          if (isRedirectError(err)) throw err;
          toastError(err, errorMessage);
        }
      });
    }, 5000);

    toastDeleted(successMessage, {
      undo: () => {
        cancelledRef.current = true;
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} {...formProps}>
      {children}
    </form>
  );
}
