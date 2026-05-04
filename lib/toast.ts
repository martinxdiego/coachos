import { toast } from "sonner";

const DEFAULT_ERROR = "Etwas ist schiefgelaufen. Bitte versuche es erneut.";

export function toastSaved(message = "Gespeichert") {
  return toast.success(message);
}

export function toastDeleted(
  message: string,
  options?: { undo?: () => void | Promise<void> }
) {
  if (options?.undo) {
    return toast.success(message, {
      action: {
        label: "Rückgängig",
        onClick: () => {
          void options.undo?.();
        }
      },
      duration: 6000
    });
  }
  return toast.success(message);
}

export function toastError(error: unknown, fallback = DEFAULT_ERROR) {
  const message =
    error instanceof Error && error.message ? error.message : fallback;
  return toast.error(message);
}

export function toastInfo(message: string, description?: string) {
  return toast(message, description ? { description } : undefined);
}
