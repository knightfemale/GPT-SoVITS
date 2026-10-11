import { ArrowDown, ArrowUp, Copy, Plus, Scissors, Trash2 } from "lucide-react";
import type { Segment } from "@/lib/text";
import { LANGUAGES } from "@/lib/tts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TextSegmentsEditorProps {
  segments: Segment[];
  onChange: (segments: Segment[]) => void;
  onSplit: () => void;
  disabled?: boolean;
}

export function TextSegmentsEditor({ segments, onChange, onSplit, disabled }: TextSegmentsEditorProps) {
  const totalChars = segments.reduce((sum, s) => sum + s.text.length, 0);

  const update = (id: string, patch: Partial<Segment>) =>
    onChange(segments.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const remove = (id: string) => onChange(segments.filter((s) => s.id !== id));

  const duplicate = (id: string) => {
    const index = segments.findIndex((s) => s.id === id);
    if (index < 0) return;
    const src = segments[index];
    const copy: Segment = { ...src, id: `seg-${Date.now().toString(36)}` };
    onChange([...segments.slice(0, index + 1), copy, ...segments.slice(index + 1)]);
  };

  const move = (id: string, dir: -1 | 1) => {
    const index = segments.findIndex((s) => s.id === id);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= segments.length) return;
    const next = [...segments];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const add = () => {
    const last = segments[segments.length - 1];
    onChange([...segments, { id: `seg-${Date.now().toString(36)}`, text: "", lang: last?.lang ?? "zh" }]);
  };

  const merge = () => {
    // 合并所有语段为单段
    onChange([{ id: `seg-${Date.now().toString(36)}`, text: segments.map((s) => s.text).join(""), lang: segments[0]?.lang ?? "zh" }]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{segments.length} 个语段</span>
          <span>·</span>
          <span className="font-mono">{totalChars} 字</span>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onSplit} disabled={disabled}>
            <Scissors /> 智能切分
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={merge} disabled={disabled || segments.length < 2}>
            合并
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={add} disabled={disabled}>
            <Plus /> 添加
          </Button>
        </div>
      </div>

      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {segments.map((segment, index) => (
          <div
            key={segment.id}
            className={cn(
              "group rounded-lg border border-border bg-surface/40 p-2 transition-colors hover:border-primary/30",
            )}
          >
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded bg-muted font-mono text-[10px] text-muted-foreground">
                {index + 1}
              </span>
              <Select
                value={segment.lang}
                onValueChange={(lang) => update(segment.id, { lang })}
                disabled={disabled}
              >
                <SelectTrigger className="h-6 w-auto gap-1 border-transparent bg-transparent px-1.5 text-[11px] shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">{segment.text.length}</span>
              <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(segment.id, -1)} disabled={disabled || index === 0} title="上移">
                  <ArrowUp />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(segment.id, 1)} disabled={disabled || index === segments.length - 1} title="下移">
                  <ArrowDown />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => duplicate(segment.id)} disabled={disabled} title="复制">
                  <Copy />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => remove(segment.id)}
                  disabled={disabled || segments.length === 1}
                  title="删除"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            <Textarea
              value={segment.text}
              onChange={(e) => update(segment.id, { text: e.target.value })}
              disabled={disabled}
              placeholder="输入该语段的文本…"
              className="min-h-[52px] resize-y border-transparent bg-transparent px-1.5 py-1 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
