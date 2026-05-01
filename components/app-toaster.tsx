"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      closeButton
      duration={3500}
      position="top-right"
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-2xl !border !border-border/70 !bg-card !text-foreground !shadow-elevated !backdrop-blur",
          title: "!text-[14px] !font-semibold !tracking-tight",
          description: "!text-[13px] !text-muted-foreground",
          success: "!border-emerald-200/60",
          error: "!border-red-200/60",
          actionButton:
            "!rounded-full !bg-foreground !text-background !text-[12px]",
          cancelButton: "!rounded-full !bg-secondary !text-foreground"
        }
      }}
    />
  );
}
