"use client";

import { useTransition } from "react";
import { toast } from "sonner";

interface ToastFormProps
  extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> {
  action: (formData: FormData) => Promise<unknown> | unknown;
  successMessage: string;
  errorMessage?: string;
  onComplete?: () => void;
}

function isRedirectError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const digest = (err as { digest?: string }).digest;
  return (
    err.message === "NEXT_REDIRECT" ||
    (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT"))
  );
}

export function ToastForm({
  action,
  successMessage,
  errorMessage = "Konnte nicht gespeichert werden.",
  onComplete,
  children,
  ...formProps
}: ToastFormProps) {
  const [, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const formData = new FormData(form);
    startTransition(async () => {
      try {
        await action(formData);
        toast.success(successMessage);
        onComplete?.();
      } catch (err) {
        if (isRedirectError(err)) throw err;
        const message = err instanceof Error ? err.message : errorMessage;
        toast.error(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} {...formProps}>
      {children}
    </form>
  );
}
