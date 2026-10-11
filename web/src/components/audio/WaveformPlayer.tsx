import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

interface WaveformPlayerProps {
  url: string;
  peaks?: number[];
  duration?: number;
  height?: number;
  compact?: boolean;
  className?: string;
}

export function WaveformPlayer({
  url,
  peaks,
  duration,
  height = 56,
  compact = false,
  className,
}: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const total = duration ?? 0;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ws = WaveSurfer.create({
      container,
      height,
      waveColor: "#3a4453",
      progressColor: "#37E0C8",
      cursorColor: "#37E0C8",
      cursorWidth: 1,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      url,
      ...(peaks ? { peaks: [peaks], duration } : {}),
    });
    wsRef.current = ws;

    const onReady = () => setReady(true);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = (t: number) => setTime(t);
    const onFinish = () => setPlaying(false);

    ws.on("ready", onReady);
    ws.on("play", onPlay);
    ws.on("pause", onPause);
    ws.on("timeupdate", onTime);
    ws.on("finish", onFinish);

    return () => {
      ws.unAll();
      ws.destroy();
      wsRef.current = null;
    };
  }, [url, peaks, duration, height]);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Button
        type="button"
        variant="secondary"
        size={compact ? "icon-sm" : "icon"}
        disabled={!ready}
        onClick={() => wsRef.current?.playPause()}
        title={playing ? "暂停" : "播放"}
        className="shrink-0"
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <div className="relative min-w-0 flex-1">
        {!ready && <Skeleton className="absolute inset-0" style={{ height }} />}
        <div ref={containerRef} className={cn("w-full transition-opacity", ready ? "opacity-100" : "opacity-0")} />
      </div>
      {!compact && (
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
          {formatDuration(time)}/{total ? formatDuration(total) : "--:--"}
        </span>
      )}
    </div>
  );
}
