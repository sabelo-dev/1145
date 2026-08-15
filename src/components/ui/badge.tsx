import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        /** Primary — Recommended, Featured, 1145, Active */
        default:
          "border-transparent bg-surface-selected text-brand",
        primary:
          "border-transparent bg-surface-selected text-brand",
        /** Neutral — categories, secondary status */
        secondary:
          "border-transparent bg-muted text-text-secondary",
        neutral:
          "border-transparent bg-muted text-text-secondary",
        success:
          "border-transparent bg-success/12 text-success",
        warning:
          "border-transparent bg-warning/15 text-[hsl(32_85%_32%)]",
        destructive:
          "border-transparent bg-destructive/12 text-destructive",
        error:
          "border-transparent bg-destructive/12 text-destructive",
        /** Strong emphasis only (counts, critical alerts) */
        solid:
          "border-transparent bg-brand text-brand-foreground",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)


export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
