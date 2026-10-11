import { cn } from "@/lib/utils";

interface MiniWaveProps {
  peaks: number[];
  className?: string;
  bars?: number;
}

/** 由峰值数组渲染的静态迷你波形（卡片场景，避免大量 wavesurfer 实例）。 */
export function MiniWave({ peaks, className, bars = 56 }: MiniWaveProps) {
  const step = Math.max(1, Math.floor(peaks.length / bars));
  const sampled: number[] = [];
  for (let i = 0; i < peaks.length && sampled.length < bars; i += step) {
    let max = 0;
    for (let j = i; j < Math.min(i + step, peaks.length); j++) max = Math.max(max, peaks[j]);
    sampled.push(Math.max(0.06, Math.min(1, max)));
  }
  if (sampled.length === 0) sampled.push(0.1);

  return (
    <div className={cn("flex h-8 items-center gap-px", className)} aria-hidden>
      {sampled.map((v, i) => (
        <span
          key={i}
          className="min-w-px flex-1 rounded-full bg-primary/50"
          style={{ height: `${Math.round(v * 100)}%` }}
        />
      ))}
    </div>
  );
}
