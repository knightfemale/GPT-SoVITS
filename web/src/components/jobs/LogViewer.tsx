import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { useJobEvents } from "@/hooks/useJobEvents";
import { SseStatusDot } from "@/components/common/SseStatusDot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogViewerProps {
  jobId: string;
  className?: string;
  height?: string;
}

export function LogViewer({ jobId, className, height = "h-64" }: LogViewerProps) {
  const { events, status } = useJobEvents(jobId);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [clearedCount, setClearedCount] = useState(0);

  const logs = events.filter((e) => e.log).slice(clearedCount);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <div className={cn("overflow-hidden rounded-md border border-border bg-[#070a0e]", className)}>
      <div className="flex items-center justify-between border-b border-border/60 px-2.5 py-1.5">
        <SseStatusDot status={status} />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="清空显示"
          onClick={() => setClearedCount(events.filter((e) => e.log).length)}
          className="text-muted-foreground"
        >
          <Eraser />
        </Button>
      </div>
      <div ref={scrollRef} className={cn("overflow-y-auto p-2.5 font-mono text-[11px] leading-relaxed", height)}>
        {logs.length === 0 ? (
          <p className="text-muted-foreground/60">等待日志…</p>
        ) : (
          logs.map((event, i) => (
            <div
              key={`${event.ts}-${i}`}
              className={cn("whitespace-pre-wrap break-all", event.log?.stream === "stderr" ? "text-destructive" : "text-[#9fb3c8]")}
            >
              {event.log?.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
