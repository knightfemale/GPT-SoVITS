import { useMemo } from "react";
import type { JobStageInfo } from "@/components/jobs/types";
import { cn } from "@/lib/utils";

interface JobStageStepperProps {
  stages: JobStageInfo[];
  currentIndex: number;
  status: string;
}

export function JobStageStepper({ stages, currentIndex, status }: JobStageStepperProps) {
  const failed = status === "failed";
  const done = status === "done";

  return (
    <ol className="flex items-center gap-1.5">
      {stages.map((stage, index) => {
        const active = index === currentIndex && status === "running";
        const complete = done || index < currentIndex;
        return (
          <li key={`${stage.label}-${index}`} className="flex flex-1 items-center gap-1.5">
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-medium transition-colors",
                complete && "border-primary bg-primary text-primary-foreground",
                active && !complete && "border-primary text-primary",
                !complete && !active && "border-border text-muted-foreground",
                failed && index === currentIndex && "border-destructive text-destructive",
              )}
              title={stage.label}
            >
              {index + 1}
            </span>
            <span
              className={cn(
                "hidden truncate text-[11px] sm:inline",
                complete || active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {stage.label}
            </span>
            {index < stages.length - 1 && (
              <span className={cn("h-px flex-1", complete ? "bg-primary/50" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function useStageInfo(count: number | undefined, currentStage: string | undefined): JobStageInfo[] {
  return useMemo(() => {
    const total = Math.max(count ?? 3, 1);
    return Array.from({ length: total }, (_, i) => ({
      label: i === 0 && currentStage ? currentStage : `阶段 ${i + 1}`,
    }));
  }, [count, currentStage]);
}
