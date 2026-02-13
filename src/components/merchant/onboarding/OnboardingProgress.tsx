import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface OnboardingStep {
  id: number;
  name: string;
  shortName: string;
}

interface OnboardingProgressProps {
  steps: OnboardingStep[];
  currentStep: number;
}

const OnboardingProgress: React.FC<OnboardingProgressProps> = ({ steps, currentStep }) => {
  const percentage = Math.round(((currentStep - 1) / (steps.length - 1)) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          Step {currentStep} of {steps.length}
        </span>
        <span className="text-muted-foreground">{percentage}% complete</span>
      </div>
      <Progress value={percentage} className="h-2" />
      <div className="hidden md:flex justify-between">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              step.id < currentStep && "text-primary",
              step.id === currentStep && "text-foreground font-medium",
              step.id > currentStep && "text-muted-foreground"
            )}
          >
            {step.id < currentStep ? (
              <Check className="h-3.5 w-3.5 text-primary" />
            ) : (
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium border",
                  step.id === currentStep
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30"
                )}
              >
                {step.id}
              </span>
            )}
            <span className="hidden lg:inline">{step.shortName}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OnboardingProgress;
