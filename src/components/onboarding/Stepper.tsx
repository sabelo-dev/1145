import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  steps: string[];
  current: number; // 0-based
}

const Stepper: React.FC<Props> = ({ steps, current }) => (
  <ol className="flex flex-wrap items-center gap-2 md:gap-3 mb-6">
    {steps.map((label, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <li key={label} className="flex items-center gap-2">
          <span
            className={cn(
              "grid h-7 w-7 place-items-center rounded-full text-xs font-semibold border transition-colors",
              done && "bg-foreground text-background border-foreground",
              active && "border-foreground text-foreground bg-background",
              !done && !active && "border-border text-muted-foreground bg-background"
            )}
          >
            {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span
            className={cn(
              "text-xs md:text-sm",
              active ? "font-semibold text-foreground" : "text-muted-foreground"
            )}
          >
            {label}
          </span>
          {i < steps.length - 1 && (
            <span className="hidden md:inline-block h-px w-6 bg-border" />
          )}
        </li>
      );
    })}
  </ol>
);

export default Stepper;
