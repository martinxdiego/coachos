import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[104px] w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-[15px] text-foreground shadow-sm transition-[box-shadow,border-color] duration-200 ease-smooth placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 [&:not(:placeholder-shown):invalid]:border-destructive/60 [&:not(:placeholder-shown):invalid]:ring-2 [&:not(:placeholder-shown):invalid]:ring-destructive/15",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
