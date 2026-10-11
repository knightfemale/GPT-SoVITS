import { Check, FileAudio2, FileText } from "lucide-react";
import type { ModelEntry } from "@/lib/api/types";
import { versionOf } from "@/lib/versions";
import { VersionBadge } from "@/components/common/VersionBadge";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface WeightListProps {
  entries: ModelEntry[];
  kind: "sovits" | "gpt";
  selectedPath: string | null;
  onSelect: (entry: ModelEntry) => void;
  isIncompatible?: (entry: ModelEntry) => boolean;
  disabled?: boolean;
}

export function WeightList({ entries, kind, selectedPath, onSelect, isIncompatible, disabled }: WeightListProps) {
  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
        暂无{kind === "sovits" ? " SoVITS " : " GPT "}权重
      </p>
    );
  }

  const Icon = kind === "sovits" ? FileAudio2 : FileText;

  return (
    <div className="space-y-1.5">
      {entries.map((entry) => {
        const version = versionOf(entry);
        const selected = entry.path === selectedPath;
        const incompatible = isIncompatible?.(entry) ?? false;
        return (
          <button
            key={entry.path}
            type="button"
            disabled={disabled || incompatible}
            onClick={() => onSelect(entry)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors",
              selected
                ? "border-primary/60 bg-primary/8 ring-1 ring-primary/25"
                : "border-border bg-surface/40 hover:border-primary/40",
              incompatible && "cursor-not-allowed opacity-45",
            )}
            title={incompatible ? "与当前选择版本不匹配" : entry.path}
          >
            <Icon className={cn("size-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{entry.name}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                {formatRelativeTime(entry.mtime)}
              </p>
            </div>
            <VersionBadge version={version} />
            {selected && <Check className="size-4 shrink-0 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}
