import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-tight transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/95 text-primary-foreground",
        secondary:
          "border-border/60 bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        success:
          "border-emerald-200/70 bg-emerald-50 text-emerald-700",
        destructive:
          "border-red-200/70 bg-red-50 text-red-700"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
