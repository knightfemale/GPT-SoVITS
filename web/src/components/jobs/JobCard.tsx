import { useState } from "react";
import { Ban, ChevronDown, Clock, Loader2 } from "lucide-react";
import type { Job, JobStatus } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { JobStageStepper, useStageInfo } from "@/components/jobs/JobStageStepper";
import { LogViewer } from "@/components/jobs/LogViewer";
import { formatEta, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_META: Record<JobStatus, { label: string; variant: "default" | "success" | "warning" | "danger" | "secondary" }> = {
  queued: { label: "排队中", variant: "secondary" },
  running: { label: "运行中", variant: "warning" },
  done: { label: "已完成", variant: "success" },
  failed: { label: "失败", variant: "danger" },
  canceled: { label: "已取消", variant: "secondary" },
};

const JOB_TYPE_LABEL: Record<string, string> = {
  train_s1: "训练 SoVITS",
  train_s2: "训练 GPT",
  train_s2_lora: "训练 GPT-LoRA",
  format: "格式化数据",
  slice: "音频切片",
  uvr5: "人声分离",
  asr: "语音识别",
  denoise: "降噪",
  label: "打标",
  tts: "语音合成",
};

interface JobCardProps {
  job: Job;
  onCancel?: (job: Job) => void;
  cancelling?: boolean;
}

export function JobCard({ job, onCancel, cancelling }: JobCardProps) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[job.status];
  const stages = useStageInfo(job.stageCount, job.stage);
  const active = job.status === "running" || job.status === "queued";
  const progress = Math.round((job.progress ?? 0) * 100);

  return (
    <div className={cn("rounded-lg border border-border bg-card p-3 transition-colors", active && "border-warning/30")}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-medium text-foreground">
              {JOB_TYPE_LABEL[job.type] ?? job.type}
            </span>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {job.id} · {formatRelativeTime(job.createdAt)}
          </p>
        </div>
        {active && (
          <>
            <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
              <Clock className="size-3" />
              {formatEta(job.etaSec)}
            </span>
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="取消任务"
                className="text-destructive hover:text-destructive"
                disabled={cancelling}
                onClick={() => onCancel(job)}
              >
                {cancelling ? <Loader2 className="animate-spin" /> : <Ban />}
              </Button>
            )}
          </>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <JobStageStepper stages={stages} currentIndex={job.stageIndex ?? 0} status={job.status} />
        <div className="flex items-center gap-2">
          <Progress value={progress} className="flex-1" />
          <span className="w-9 shrink-0 text-right font-mono text-[11px] text-muted-foreground">{progress}%</span>
        </div>
        {job.stage && active && (
          <p className="text-[11px] text-muted-foreground">
            当前阶段：<span className="text-foreground">{job.stage}</span>
          </p>
        )}
        {job.error && (
          <p className="rounded border border-destructive/30 bg-destructive/10 px-2 py-1 font-mono text-[10px] text-destructive">
            {job.error}
          </p>
        )}
      </div>

      <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
        <CollapsibleTrigger className="flex w-full items-center justify-center gap-1 rounded-md py-1 text-[11px] text-muted-foreground hover:text-foreground">
          实时日志 <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <LogViewer jobId={job.id} className="mt-2" height="h-48" />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
