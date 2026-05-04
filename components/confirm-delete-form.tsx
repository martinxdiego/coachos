"use client";

import { useTransition } from "react";
import { useConfirm, type ConfirmOptions } from "@/components/confirm-dialog";
import { toastDeleted, toastError } from "@/lib/toast";

interface ConfirmDeleteFormProps
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> {
  action: (formData: FormData) => Promise<unknown> | unknown;
  confirm: ConfirmOptions;
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
  confirm: confirmOptions,
  successMessage,
  errorMessage,
  onComplete,
  children,
  ...formProps
}: ConfirmDeleteFormProps) {
  const confirm = useConfirm();
  const [, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const ok = await confirm({
      destructive: true,
      confirmLabel: "Löschen",
      cancelLabel: "Abbrechen",
      ...confirmOptions
    });
    if (!ok) return;

    startTransition(async () => {
      try {
        await action(formData);
        toastDeleted(successMessage);
        onComplete?.();
      } catch (err) {
        if (isRedirectError(err)) {
          throw err;
        }
        toastError(err, errorMessage);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} {...formProps}>
      {children}
    </form>
  );
}
