import { FileText, Headphones, Pencil, Play, Trash2 } from "lucide-react";
import type { Reference } from "@/lib/api/types";
import { referenceAudioUrl } from "@/lib/references";
import { usePlayer } from "@/store/player";
import { MiniWave } from "@/components/audio/MiniWave";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReferenceCardProps {
  reference: Reference;
  selected?: boolean;
  onSelect?: (reference: Reference) => void;
  onDelete?: (reference: Reference) => void;
  onTrim?: (reference: Reference) => void;
  onEditText?: (reference: Reference) => void;
}

export function ReferenceCard({
  reference,
  selected,
  onSelect,
  onDelete,
  onTrim,
  onEditText,
}: ReferenceCardProps) {
  const { play } = usePlayer();
  const url = referenceAudioUrl(reference);
  const playable = Boolean(url);

  const handlePlay = () => {
    if (!url) return;
    play({
      id: reference.id,
      title: reference.name,
      subtitle: reference.text ?? reference.lang,
      src: url,
    });
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border bg-card p-3 transition-colors",
        selected ? "border-primary/60 ring-1 ring-primary/30" : "border-border hover:border-primary/40",
      )}
      onClick={() => onSelect?.(reference)}
      role={onSelect ? "button" : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">{reference.name}</p>
          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{reference.duration.toFixed(1)}s</span>
            {reference.lang && <Badge variant="outline">{reference.lang}</Badge>}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          disabled={!playable}
          onClick={(e) => {
            e.stopPropagation();
            handlePlay();
          }}
          title={playable ? "试听" : "暂无可播放音频"}
        >
          <Play />
        </Button>
      </div>

      <MiniWave peaks={reference.peaks} />

      {reference.text ? (
        <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{reference.text}</p>
      ) : onEditText ? (
        <button
          type="button"
          className="flex items-center gap-1 text-left text-[11px] text-primary/80 transition-colors hover:text-primary"
          onClick={(e) => {
            e.stopPropagation();
            onEditText(reference);
          }}
        >
          <FileText className="size-3" />
          未填写参考文本，点击补充
        </button>
      ) : null}

      <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Headphones className="size-3" />
          {selected ? "已选为参考" : "参考音频"}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {onEditText && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="编辑参考文本"
              onClick={(e) => {
                e.stopPropagation();
                onEditText(reference);
              }}
            >
              <FileText />
            </Button>
          )}
          {onTrim && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="裁剪"
              onClick={(e) => {
                e.stopPropagation();
                onTrim(reference);
              }}
            >
              <Pencil />
            </Button>
          )}
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="删除"
              className="text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(reference);
              }}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
