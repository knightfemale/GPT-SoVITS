import { useEffect, useMemo, useRef } from "react";
import type { LabelRow } from "@/lib/api/types";
import { useApiClient } from "@/hooks/useApi";
import { LANGUAGES } from "@/lib/tts";
import { LabelAudioButton } from "@/components/label/LabelAudioButton";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LabelTableProps {
  rows: LabelRow[];
  onUpdate: (idx: number, patch: Partial<LabelRow>) => void;
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** 随内容自动增高的文本域（多行标注文本保持完整可见）。 */
function AutoTextarea({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  return (
    <Textarea
      ref={ref}
      rows={1}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-8 resize-none overflow-hidden py-1.5 text-xs leading-relaxed"
    />
  );
}

/** 可编辑标注表格：每行可试听、可改 speaker/lang/text。audio_path 只读。 */
export function LabelTable({ rows, onUpdate }: LabelTableProps) {
  const api = useApiClient();

  // 语言下拉：以内置语言表为准，并补全数据中出现的自定义值。
  const langOptions = useMemo(() => {
    const options = LANGUAGES.map((l) => ({ value: l.value, label: l.label }));
    const known = new Set(options.map((o) => o.value));
    for (const row of rows) {
      if (row.lang && !known.has(row.lang)) {
        options.push({ value: row.lang, label: row.lang });
        known.add(row.lang);
      }
    }
    return options;
  }, [rows]);

  return (
    <div className="max-h-[70vh] overflow-auto rounded-md border border-border">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <colgroup>
          <col className="w-10" />
          <col className="w-64" />
          <col className="w-36" />
          <col className="w-36" />
          <col />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
          <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="px-3 py-2 font-medium">#</th>
            <th scope="col" className="px-2 py-2 font-medium">音频</th>
            <th scope="col" className="px-2 py-2 font-medium">speaker</th>
            <th scope="col" className="px-2 py-2 font-medium">lang</th>
            <th scope="col" className="px-3 py-2 font-medium">text</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.idx}
              className="border-b border-border/50 transition-colors last:border-b-0 hover:bg-muted/30"
            >
              <td className="px-3 py-2 align-top text-[11px] tabular text-muted-foreground">{i + 1}</td>
              <td className="px-2 py-2 align-top">
                <div className="flex items-center gap-2">
                  <LabelAudioButton
                    id={row.audio_path}
                    title={baseName(row.audio_path)}
                    subtitle={row.text}
                    src={api.labelAudioUrl(row.audio_path)}
                  />
                  <span
                    className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground"
                    title={row.audio_path}
                  >
                    {baseName(row.audio_path)}
                  </span>
                </div>
              </td>
              <td className="px-2 py-2 align-top">
                <Input
                  value={row.speaker}
                  aria-label={`第 ${i + 1} 行 speaker`}
                  onChange={(e) => onUpdate(row.idx, { speaker: e.target.value })}
                  className="h-8 text-xs"
                  placeholder="speaker"
                />
              </td>
              <td className="px-2 py-2 align-top">
                <Select value={row.lang} onValueChange={(lang) => onUpdate(row.idx, { lang })}>
                  <SelectTrigger aria-label={`第 ${i + 1} 行 lang`} className="h-8 text-xs">
                    <SelectValue placeholder="lang" />
                  </SelectTrigger>
                  <SelectContent>
                    {langOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>
              <td className="px-3 py-2 align-top">
                <AutoTextarea
                  value={row.text}
                  ariaLabel={`第 ${i + 1} 行 text`}
                  onChange={(text) => onUpdate(row.idx, { text })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
