import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ListChecks, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Job, JobStatus } from "@/lib/api/types";
import { useApiClient } from "@/hooks/useApi";
import { queryKeys, useJobs } from "@/hooks/queries";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { JobCard } from "@/components/jobs/JobCard";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";

type Filter = "all" | JobStatus;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "running", label: "运行中" },
  { value: "queued", label: "排队" },
  { value: "done", label: "已完成" },
  { value: "failed", label: "失败" },
];

export function JobsPage() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useJobs();
  const [filter, setFilter] = useState<Filter>("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const jobs = useMemo(() => {
    const list = data ?? [];
    return filter === "all" ? list : list.filter((j) => j.status === filter);
  }, [data, filter]);

  const counts = useMemo(() => {
    const list = data ?? [];
    return {
      active: list.filter((j) => j.status === "running" || j.status === "queued").length,
      total: list.length,
    };
  }, [data]);

  const cancelMutation = useMutation({
    mutationFn: (job: Job) => {
      setCancellingId(job.id);
      return api.cancelJob(job.id);
    },
    onSuccess: () => {
      toast("任务已取消");
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
    onError: () => toast.error("取消失败"),
    onSettled: () => setCancellingId(null),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="任务"
        description="查看训练与数据处理任务的阶段进度、ETA 与实时日志。"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={isLoading ? "animate-spin" : ""} /> 刷新
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup type="single" value={filter} onValueChange={(v) => v && setFilter(v as Filter)}>
          {FILTERS.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value} className="h-7 px-3 text-xs">
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="text-[11px] text-muted-foreground">
          共 {counts.total} 个任务 · {counts.active} 个进行中
        </span>
      </div>

      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title={filter === "all" ? "还没有任务" : "没有符合条件的任务"}
          description={
            filter === "all"
              ? "训练或数据处理任务会显示在这里，并实时推送阶段与日志。"
              : "切换筛选条件查看其它任务。"
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              cancelling={cancellingId === job.id}
              onCancel={
                job.status === "running" || job.status === "queued"
                  ? (j) => cancelMutation.mutate(j)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
