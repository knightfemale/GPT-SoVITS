import { cn } from "@/lib/utils";
import type { SseStatus } from "@/lib/api/types";

const LABELS: Record<SseStatus, string> = {
  connecting: "连接中",
  open: "实时",
  error: "重连中",
  closed: "离线",
};

const COLORS: Record<SseStatus, string> = {
  connecting: "bg-info",
  open: "bg-success",
  error: "bg-warning",
  closed: "bg-muted-foreground",
};

export function SseStatusDot({ status, label }: { status: SseStatus; label?: string }) {
  const breathe = status === "open" || status === "connecting";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground" title={`SSE ${LABELS[status]}`}>
      <span className="relative flex size-2">
        {breathe && (
          <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", COLORS[status])} />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", COLORS[status])} />
      </span>
      {label ?? LABELS[status]}
    </span>
  );
}
