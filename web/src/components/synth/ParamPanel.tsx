import type { InputHTMLAttributes, ReactNode } from "react";
import type { TTSRequest } from "@/lib/api/types";
import type { WeightVersion } from "@/lib/versions";
import { MEDIA_TYPES, STREAMING_MODES, TEXT_SPLIT_METHODS, type ParamTier } from "@/lib/tts";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ParamPanelProps {
  params: TTSRequest;
  version: WeightVersion;
  tier: ParamTier;
  onTierChange: (tier: ParamTier) => void;
  onChange: (patch: Partial<TTSRequest>) => void;
  disabled?: boolean;
}

const TIERS: Array<{ value: ParamTier; label: string; hint: string }> = [
  { value: "basic", label: "常用", hint: "切分 / 语速 / 输出格式" },
  { value: "advanced", label: "进阶", hint: "采样与批量参数" },
  { value: "expert", label: "专家", hint: "声学模型细粒度参数" },
];

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {hint && <span className="font-mono text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

interface NumberFieldProps {
  value: number | undefined;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

function NumberField({ value, onChange, min, max, step, disabled, inputProps }: NumberFieldProps) {
  const current = value ?? min;
  return (
    <div className="flex items-center gap-3">
      <Slider
        value={[current]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
        className="flex-1"
      />
      <Input
        type="number"
        value={current}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 w-16 px-1.5 text-right font-mono text-xs"
        {...inputProps}
      />
    </div>
  );
}

export function ParamPanel({ params, version, tier, onTierChange, onChange, disabled }: ParamPanelProps) {
  const supportsSampleSteps = ["v3", "v4", "v5", "v5dev", "v5turbo"].includes(version);
  const streamingOn = params.streaming_mode !== 0 && params.streaming_mode !== false;

  return (
    <div className="space-y-4">
      <ToggleGroup
        type="single"
        value={tier}
        onValueChange={(v) => v && onTierChange(v as ParamTier)}
        className="w-full"
      >
        {TIERS.map((t) => (
          <ToggleGroupItem key={t.value} value={t.value} className="h-8 flex-1" title={t.hint} disabled={disabled}>
            {t.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {tier === "basic" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="文本切分方式">
            <Select
              value={params.text_split_method ?? "cut5"}
              onValueChange={(text_split_method) => onChange({ text_split_method })}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEXT_SPLIT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="输出格式">
            <Select
              value={params.media_type ?? "wav"}
              onValueChange={(media_type) => onChange({ media_type: media_type as TTSRequest["media_type"] })}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEDIA_TYPES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="语速" hint={`${(params.speed_factor ?? 1).toFixed(2)}×`} className="sm:col-span-2">
            <NumberField
              value={params.speed_factor ?? 1}
              min={0.5}
              max={2}
              step={0.05}
              disabled={disabled}
              onChange={(speed_factor) => onChange({ speed_factor })}
            />
          </Field>

          <Field label="流式模式" hint="实时播放" className="sm:col-span-2">
            <Select
              value={String(streamingOn ? params.streaming_mode : 0)}
              onValueChange={(v) =>
                onChange({ streaming_mode: Number(v) as TTSRequest["streaming_mode"] })
              }
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STREAMING_MODES.map((m) => (
                  <SelectItem key={String(m.value)} value={String(m.value)}>
                    {m.label} · {m.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}

      {tier === "advanced" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="top_k" hint="采样候选数">
            <NumberField value={params.top_k ?? 15} min={1} max={100} step={1} disabled={disabled} onChange={(top_k) => onChange({ top_k })} />
          </Field>
          <Field label="top_p" hint="核采样">
            <NumberField value={params.top_p ?? 1} min={0} max={1} step={0.05} disabled={disabled} onChange={(top_p) => onChange({ top_p })} />
          </Field>
          <Field label="temperature" hint="随机性">
            <NumberField value={params.temperature ?? 1} min={0} max={2} step={0.05} disabled={disabled} onChange={(temperature) => onChange({ temperature })} />
          </Field>
          <Field label="repetition_penalty" hint="重复惩罚">
            <NumberField value={params.repetition_penalty ?? 1.35} min={1} max={2} step={0.05} disabled={disabled} onChange={(repetition_penalty) => onChange({ repetition_penalty })} />
          </Field>
          <Field label="batch_size" hint="批大小">
            <NumberField value={params.batch_size ?? 1} min={1} max={16} step={1} disabled={disabled} onChange={(batch_size) => onChange({ batch_size })} />
          </Field>
          <Field label="随机种子" hint="-1 为随机">
            <NumberField value={params.seed ?? -1} min={-1} max={999999} step={1} disabled={disabled} onChange={(seed) => onChange({ seed })} />
          </Field>
          <Field label="并行推理" hint="parallel_infer" className="sm:col-span-2">
            <div className="flex h-9 items-center">
              <Switch
                checked={params.parallel_infer ?? true}
                disabled={disabled}
                onCheckedChange={(parallel_infer) => onChange({ parallel_infer })}
              />
            </div>
          </Field>
        </div>
      )}

      {tier === "expert" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="sample_steps"
            hint={supportsSampleSteps ? "声学采样步数" : `当前版本 ${version} 不支持`}
          >
            <NumberField
              value={params.sample_steps ?? 32}
              min={8}
              max={128}
              step={4}
              disabled={disabled || !supportsSampleSteps}
              onChange={(sample_steps) => onChange({ sample_steps })}
            />
          </Field>
          <Field label="超级采样" hint="super_sampling">
            <div className="flex h-9 items-center">
              <Switch
                checked={params.super_sampling ?? false}
                disabled={disabled || !supportsSampleSteps}
                onCheckedChange={(super_sampling) => onChange({ super_sampling })}
              />
            </div>
          </Field>
          <Field label="overlap_length" hint="流式重叠">
            <NumberField value={params.overlap_length ?? 2} min={0} max={20} step={1} disabled={disabled} onChange={(overlap_length) => onChange({ overlap_length })} />
          </Field>
          <Field label="min_chunk_length" hint="最小分块">
            <NumberField value={params.min_chunk_length ?? 16} min={4} max={64} step={1} disabled={disabled} onChange={(min_chunk_length) => onChange({ min_chunk_length })} />
          </Field>
          <Field label="返回分片" hint="return_fragment" className="sm:col-span-2">
            <div className="flex h-9 items-center">
              <Switch
                checked={params.return_fragment ?? false}
                disabled={disabled}
                onCheckedChange={(return_fragment) => onChange({ return_fragment })}
              />
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}
