"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type Resolver = (value: boolean) => void;

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

interface ActiveConfirm {
  options: ConfirmOptions;
  resolve: Resolver;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveConfirm | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setActive({ options, resolve });
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      if (!active) return;
      active.resolve(result);
      setActive(null);
    },
    [active]
  );

  useEffect(() => {
    if (!active) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
      } else if (event.key === "Enter") {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener("keydown", handleKey);
    const focusTimer = window.setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);
    return () => {
      document.removeEventListener("keydown", handleKey);
      window.clearTimeout(focusTimer);
    };
  }, [active, close]);

  const options = active?.options;
  const destructive = options?.destructive ?? false;

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {active && options ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <button
            aria-label="Schließen"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => close(false)}
            type="button"
          />
          <div
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="relative mx-3 mb-3 w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-elevated animate-slide-up sm:mb-0"
            role="alertdialog"
          >
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                  destructive
                    ? "bg-destructive/10 text-destructive"
                    : "bg-secondary text-foreground"
                )}
              >
                {destructive ? (
                  <Trash2 className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <h2
                  className="text-[17px] font-semibold tracking-tight"
                  id="confirm-dialog-title"
                >
                  {options.title}
                </h2>
                {options.description ? (
                  <p className="mt-1.5 text-[14px] leading-6 text-muted-foreground">
                    {options.description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                onClick={() => close(false)}
                size="default"
                type="button"
                variant="ghost"
              >
                {options.cancelLabel ?? "Abbrechen"}
              </Button>
              <Button
                onClick={() => close(true)}
                ref={confirmButtonRef}
                size="default"
                type="button"
                variant={destructive ? "destructive" : "default"}
              >
                {options.confirmLabel ?? "Bestätigen"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx.confirm;
}
