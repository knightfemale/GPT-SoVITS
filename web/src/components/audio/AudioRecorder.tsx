import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startRecording, type RecorderHandle } from "@/lib/audio/recorder";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AudioRecorderProps {
  onRecord: (blob: Blob) => void;
  maxDuration?: number;
  className?: string;
}

export function AudioRecorder({ onRecord, maxDuration = 15, className }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const handleRef = useRef<RecorderHandle | null>(null);

  useEffect(() => {
    return () => handleRef.current?.stop();
  }, []);

  const stop = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
  }, []);

  const start = useCallback(async () => {
    try {
      const handle = await startRecording({
        maxDuration,
        onData: (blob) => {
          setRecording(false);
          setLevel(0);
          setElapsed(0);
          onRecord(blob);
          toast.success("录音完成");
        },
        onLevel: (lvl, dur) => {
          setLevel(lvl);
          setElapsed(dur);
        },
        onError: (err) => {
          setRecording(false);
          setLevel(0);
          toast.error(err.message || "录音失败");
        },
      });
      handleRef.current = handle;
      setRecording(true);
    } catch {
      toast.error("无法访问麦克风，请检查浏览器权限");
    }
  }, [maxDuration, onRecord]);

  return (
    <div className={cn("flex items-center gap-3 rounded-lg border border-border bg-surface/40 p-3", className)}>
      <Button
        type="button"
        variant={recording ? "destructive" : "secondary"}
        size="icon"
        onClick={recording ? stop : start}
        title={recording ? "停止录音" : "开始录音"}
        className="relative shrink-0"
      >
        {recording ? <Square /> : <Mic />}
        {recording && <span className="absolute inset-0 animate-ping rounded-md bg-destructive/30" />}
      </Button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{recording ? "正在录音…" : "录制参考音频（3–10 秒最佳）"}</span>
          <span className="font-mono">
            {formatDuration(elapsed)} / {formatDuration(maxDuration)}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full bg-primary transition-[width] duration-75", !recording && "opacity-40")}
            style={{ width: `${Math.round(level * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
