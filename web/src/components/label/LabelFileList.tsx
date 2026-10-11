import { FileText } from "lucide-react";
import type { LabelListEntry } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LabelFileListProps {
  entries: LabelListEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  isLoading?: boolean;
}

/** 左侧 `.list` 选择器。 */
export function LabelFileList({ entries, selectedPath, onSelect, isLoading }: LabelFileListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-surface/30 px-3 py-6 text-center text-xs text-muted-foreground">
        未发现 .list 标注文件
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {entries.map((entry) => {
        const active = entry.path === selectedPath;
        return (
          <li key={entry.path}>
            <button
              type="button"
              onClick={() => onSelect(entry.path)}
              aria-current={active}
              className={cn(
                "group flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors",
                active
                  ? "border-primary/50 bg-primary/10"
                  : "border-transparent hover:border-border hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                  active
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-surface/60 text-muted-foreground group-hover:text-foreground",
                )}
              >
                <FileText className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">{entry.name}</span>
                <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground/80">
                  {entry.path}
                </span>
              </span>
              <Badge variant={active ? "default" : "outline"} className="tabular shrink-0">
                {entry.count}
              </Badge>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
