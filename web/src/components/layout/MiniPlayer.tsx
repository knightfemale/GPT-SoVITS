import { Link } from "react-router-dom";
import { usePlayer } from "@/store/player";
import { useVoice } from "@/store/voice";
import { formatClock } from "@/lib/format";
import { Pause, Play, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export function MiniPlayer() {
  const { track, playing, currentTime, duration, volume, toggle, stop, seek, setVolume } = usePlayer();
  const { isLocked } = useVoice();

  if (!track) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        "flex h-14 items-center gap-3 border-t border-border bg-surface/70 px-3 backdrop-blur",
        isLocked && "opacity-60",
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
        <span className="waveform-bars flex items-end gap-0.5">
          {[0.4, 0.8, 0.5, 1, 0.6].map((h, i) => (
            <span
              key={i}
              className="w-0.5 rounded-full bg-current"
              style={{ height: `${h * 16}px`, animationDelay: `${i * 120}ms` }}
            />
          ))}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-medium text-foreground">{track.title}</p>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {formatClock(currentTime)} / {formatClock(duration)}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            style={{
              background: `linear-gradient(to right, var(--primary) ${progress}%, var(--muted) ${progress}%)`,
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" onClick={toggle} title={playing ? "暂停" : "播放"}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={stop} title="停止">
          <Square />
        </Button>
        <div className="hidden w-24 items-center gap-2 pl-1 md:flex">
          <Volume2 className="size-4 shrink-0 text-muted-foreground" />
          <Slider value={[volume * 100]} max={100} step={1} onValueChange={([v]) => setVolume(v / 100)} />
        </div>
        <Button asChild variant="ghost" size="icon-sm" title="前往合成">
          <Link to="/synthesize">＋</Link>
        </Button>
      </div>
    </div>
  );
}
