import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const solidDisabled =
  "disabled:bg-disabled-surface disabled:text-disabled-foreground disabled:opacity-100 disabled:shadow-none disabled:border-transparent"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 ease-spring active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground shadow-soft hover:bg-brand-hover active:bg-brand-pressed ${solidDisabled}`,
        destructive:
          `bg-destructive text-destructive-foreground hover:bg-destructive/90 ${solidDisabled}`,
        outline:
          "border border-border bg-background text-foreground hover:bg-surface-hover hover:text-brand hover:border-border active:bg-surface-pressed disabled:bg-disabled-surface disabled:text-disabled-foreground disabled:opacity-100",
        secondary:
          `bg-surface-input text-foreground hover:bg-surface-hover hover:text-brand active:bg-surface-pressed ${solidDisabled}`,
        ghost: "text-foreground hover:bg-surface-hover hover:text-brand active:bg-surface-pressed disabled:text-disabled-foreground disabled:opacity-100",
        link: "text-foreground underline underline-offset-4 decoration-current hover:text-brand active:text-brand-pressed disabled:text-disabled-foreground",
        /** Primary CTA — black surface, always white text */
        cta: `bg-cta text-cta-foreground shadow-soft hover:bg-brand hover:text-brand-foreground active:bg-brand-pressed ${solidDisabled}`,
        /** 1145 secondary action — brand outline on light surfaces */
        cyanOutline:
          `border border-brand bg-transparent text-brand hover:bg-surface-selected active:bg-surface-pressed ${solidDisabled}`,
        /** High-contrast navy action */
        dark: `bg-navy-900 text-white hover:bg-navy-800 ${solidDisabled}`,
        /** Premium / value actions only (upgrade, elite, gold-backed) */
        premium: `bg-gold text-gold-foreground shadow-soft hover:bg-gold/90 ${solidDisabled}`,

      },

      size: {
        default: "h-11 px-5 py-2 md:h-10 md:px-4",
        sm: "h-9 rounded-lg px-3.5",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
        pill: "h-11 rounded-full px-6 md:h-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
