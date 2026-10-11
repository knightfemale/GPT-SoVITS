import { Link } from "react-router-dom";
import { useJobs } from "@/hooks/queries";
import { useTasks } from "@/store/tasks";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { SseStatusDot } from "@/components/common/SseStatusDot";
import { formatEta } from "@/lib/format";
import { ListChecks } from "lucide-react";
import type { JobStatus } from "@/lib/api/types";

const STATUS_VARIANT: Record<JobStatus, "secondary" | "info" | "success" | "danger" | "outline"> = {
  queued: "secondary",
  running: "info",
  done: "success",
  failed: "danger",
  canceled: "outline",
};

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "排队",
  running: "运行中",
  done: "完成",
  failed: "失败",
  canceled: "已取消",
};

export function TaskDrawer() {
  const { drawerOpen, setDrawerOpen, sseStatus } = useTasks();
  const { data: jobs } = useJobs();

  const active = jobs?.filter((j) => j.status === "running" || j.status === "queued") ?? [];
  const recent = jobs?.filter((j) => j.status !== "running" && j.status !== "queued").slice(0, 8) ?? [];

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>任务中心</SheetTitle>
            <SseStatusDot status={sseStatus} />
          </div>
          <SheetDescription>实时阶段、进度与日志，切换音色期间全局锁定。</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-3">
          <section className="space-y-2">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              进行中 · {active.length}
            </h3>
            {active.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                暂无进行中的任务
              </p>
            ) : (
              active.map((job) => (
                <JobRow
                  key={job.id}
                  type={job.type}
                  status={job.status}
                  stage={job.stage}
                  stageIndex={job.stageIndex}
                  stageCount={job.stageCount}
                  progress={job.progress}
                  etaSec={job.etaSec}
                />
              ))
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">最近</h3>
            {recent.length === 0 ? (
              <EmptyState icon={<ListChecks />} title="还没有历史任务" className="py-8" />
            ) : (
              recent.map((job) => (
                <JobRow key={job.id} type={job.type} status={job.status} progress={job.progress} compact />
              ))
            )}
          </section>
        </div>

        <div className="border-t border-border p-5 pt-3">
          <Button asChild variant="outline" className="w-full" onClick={() => setDrawerOpen(false)}>
            <Link to="/jobs">查看全部任务</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface JobRowProps {
  type: string;
  status: JobStatus;
  stage?: string;
  stageIndex?: number;
  stageCount?: number;
  progress?: number;
  etaSec?: number;
  compact?: boolean;
}

function JobRow({ type, status, stage, stageIndex, stageCount, progress, etaSec, compact }: JobRowProps) {
  return (
    <div className="rounded-md border border-border bg-surface/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-xs text-foreground">{type}</span>
        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
      </div>
      {!compact && (
        <>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="truncate">
              {stage ?? "—"}
              {stageIndex != null && stageCount != null && ` (${stageIndex}/${stageCount})`}
            </span>
            <span className="shrink-0 font-mono">{etaSec != null ? `ETA ${formatEta(etaSec)}` : ""}</span>
          </div>
          <Progress className="mt-2" value={(progress ?? 0) * 100} />
        </>
      )}
    </div>
  );
}
