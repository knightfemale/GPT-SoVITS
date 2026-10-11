import { Download, Play, Trash2 } from "lucide-react";
import type { SynthResult } from "@/lib/results";
import { usePlayer } from "@/store/player";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { MiniWave } from "@/components/audio/MiniWave";
import { History } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";

interface ResultHistoryProps {
  results: SynthResult[];
  peaksMap: Record<string, number[]>;
  onDelete?: (id: string) => void;
}

export function ResultHistory({ results, peaksMap, onDelete }: ResultHistoryProps) {
  const { play } = usePlayer();

  if (results.length === 0) {
    return (
      <EmptyState
        icon={<History />}
        title="还没有合成结果"
        description="完成一次合成后，结果会出现在这里，可反复试听与下载。"
      />
    );
  }

  return (
    <div className="space-y-2">
      {results.map((result) => (
        <div key={result.id} className="rounded-lg border border-border bg-surface/40 p-3 transition-colors hover:border-primary/30">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-foreground">{result.text || "（空文本）"}</p>
            <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelativeTime(result.createdAt)}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <MiniWave peaks={peaksMap[result.id] ?? [0.2, 0.5, 0.3, 0.6, 0.4]} className="h-6 flex-1" />
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{result.duration.toFixed(1)}s</span>
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="播放"
                onClick={() =>
                  play({ id: result.id, title: result.text || "合成结果", subtitle: result.mediaType, src: result.url })
                }
              >
                <Play />
              </Button>
              <Button asChild variant="ghost" size="icon-sm" title="下载">
                <a href={result.url} download={`tts-${result.id}.${result.mediaType === "raw" ? "pcm" : result.mediaType}`}>
                  <Download />
                </a>
              </Button>
              {onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  title="删除"
                  onClick={() => onDelete(result.id)}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
