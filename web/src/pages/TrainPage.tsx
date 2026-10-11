import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, ListChecks, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

import type { Job, TrainJobType, TrainParams } from "@/lib/api";
import { useApiClient } from "@/hooks/useApi";
import { queryKeys, useSystem } from "@/hooks/queries";
import { versionLabel, type WeightVersion } from "@/lib/versions";
import {
  TRAIN_TABS,
  buildTrainParams,
  defaultTrainForm,
  hasTrainErrors,
  isProVersion,
  trainTabLabel,
  trainVersions,
  validateTrainForm,
  type TrainFieldErrors,
  type TrainFormState,
} from "@/lib/train";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

interface ToggleRowProps {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function ToggleRow({ id, label, hint, checked, onCheckedChange }: ToggleRowProps) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border/60 bg-surface/40 px-3 py-2 transition-colors hover:bg-muted/40"
    >
      <span className="space-y-0.5">
        <span className="block text-xs font-medium text-foreground">{label}</span>
        {hint && <span className="block text-[10px] text-muted-foreground">{hint}</span>}
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

interface TrainFormProps {
  type: TrainJobType;
  versions: string[];
  submitting: boolean;
  onSubmit: (params: TrainParams) => void;
}

function TrainForm({ type, versions, submitting, onSubmit }: TrainFormProps) {
  const [form, setForm] = useState<TrainFormState>(() => defaultTrainForm(type));
  const [errors, setErrors] = useState<TrainFieldErrors>({});
  const isS1 = type === "train_s1";
  const pro = isProVersion(form.version);
  const fieldId = (name: keyof TrainFormState) => `${type}-${name}`;

  const update = <K extends keyof TrainFormState>(key: K, value: TrainFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = validateTrainForm(type, form);
    setErrors(next);
    if (hasTrainErrors(next)) {
      toast.error("请检查表单中的错误");
      return;
    }
    onSubmit(buildTrainParams(type, form));
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 实验 / 数据 */}
        <Card>
          <CardHeader>
            <CardTitle>实验 / 数据</CardTitle>
            <CardDescription>输出目录与版本族</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field id={fieldId("exp_name")} label="实验名称" hint="必填" error={errors.exp_name}>
              <Input
                id={fieldId("exp_name")}
                value={form.exp_name}
                placeholder="如 my_voice"
                autoComplete="off"
                onChange={(e) => update("exp_name", e.target.value)}
              />
            </Field>

            <Field id={fieldId("version")} label="版本" error={errors.version}>
              <Select value={form.version} onValueChange={(v) => update("version", v)}>
                <SelectTrigger id={fieldId("version")}>
                  <SelectValue placeholder="选择版本" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {versionLabel(v as WeightVersion)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {pro && (
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] leading-relaxed text-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Pro 版本需数据集已按 <code className="font-mono">7-sv_cn</code> 音色特征格式化（format 任务已支持）。
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 训练超参 */}
        <Card>
          <CardHeader>
            <CardTitle>训练超参</CardTitle>
            <CardDescription>批大小、轮数与学习率</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field id={fieldId("batch_size")} label="批大小" error={errors.batch_size}>
                <Input
                  id={fieldId("batch_size")}
                  type="number"
                  min={1}
                  max={64}
                  value={form.batch_size}
                  onChange={(e) => update("batch_size", e.target.value)}
                />
              </Field>
              <Field id={fieldId("total_epoch")} label="总轮数" error={errors.total_epoch}>
                <Input
                  id={fieldId("total_epoch")}
                  type="number"
                  min={1}
                  value={form.total_epoch}
                  onChange={(e) => update("total_epoch", e.target.value)}
                />
              </Field>
              <Field id={fieldId("save_every_epoch")} label="每 N 轮保存" error={errors.save_every_epoch}>
                <Input
                  id={fieldId("save_every_epoch")}
                  type="number"
                  min={1}
                  value={form.save_every_epoch}
                  onChange={(e) => update("save_every_epoch", e.target.value)}
                />
              </Field>
              <Field id={fieldId("learning_rate")} label="学习率" hint="留空用默认" error={errors.learning_rate}>
                <Input
                  id={fieldId("learning_rate")}
                  type="number"
                  min={0}
                  max={1}
                  step="0.00001"
                  value={form.learning_rate}
                  onChange={(e) => update("learning_rate", e.target.value)}
                />
              </Field>
            </div>

            {isS1 ? (
              <ToggleRow
                id={fieldId("if_dpo")}
                label="DPO 训练"
                hint="启用偏好优化，提升主观表现"
                checked={form.if_dpo}
                onCheckedChange={(v) => update("if_dpo", v)}
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field id={fieldId("lora_rank")} label="LoRA Rank" error={errors.lora_rank}>
                    <Input
                      id={fieldId("lora_rank")}
                      value={form.lora_rank}
                      placeholder="32"
                      onChange={(e) => update("lora_rank", e.target.value)}
                    />
                  </Field>
                  <Field
                    id={fieldId("text_low_lr_rate")}
                    label="文本层学习率比"
                    error={errors.text_low_lr_rate}
                  >
                    <Input
                      id={fieldId("text_low_lr_rate")}
                      type="number"
                      min={0}
                      max={1}
                      step="0.05"
                      value={form.text_low_lr_rate}
                      onChange={(e) => update("text_low_lr_rate", e.target.value)}
                    />
                  </Field>
                </div>
                <ToggleRow
                  id={fieldId("if_grad_ckpt")}
                  label="梯度检查点"
                  hint="以时间换显存，显存不足时启用"
                  checked={form.if_grad_ckpt}
                  onCheckedChange={(v) => update("if_grad_ckpt", v)}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* 权重 */}
        <Card>
          <CardHeader>
            <CardTitle>权重</CardTitle>
            <CardDescription>底模与保存策略</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isS1 ? (
              <Field id={fieldId("pretrained_s1")} label="GPT 底模" hint="留空按版本取默认">
                <Input
                  id={fieldId("pretrained_s1")}
                  value={form.pretrained_s1}
                  placeholder="GPT_weights_v2/xxx.ckpt"
                  onChange={(e) => update("pretrained_s1", e.target.value)}
                />
              </Field>
            ) : (
              <>
                <Field id={fieldId("pretrained_s2G")} label="SoVITS-G 底模" hint="留空按版本取默认">
                  <Input
                    id={fieldId("pretrained_s2G")}
                    value={form.pretrained_s2G}
                    placeholder="SoVITS_weights_v2/xxx.pth"
                    onChange={(e) => update("pretrained_s2G", e.target.value)}
                  />
                </Field>
                <Field id={fieldId("pretrained_s2D")} label="SoVITS-D 底模" hint="留空按版本取默认">
                  <Input
                    id={fieldId("pretrained_s2D")}
                    value={form.pretrained_s2D}
                    placeholder="SoVITS_weights_v2/xxx.pth"
                    onChange={(e) => update("pretrained_s2D", e.target.value)}
                  />
                </Field>
              </>
            )}

            <div className="grid gap-2">
              <ToggleRow
                id={fieldId("if_save_latest")}
                label="保存最新权重"
                hint="仅保留 latest 权重"
                checked={form.if_save_latest}
                onCheckedChange={(v) => update("if_save_latest", v)}
              />
              <ToggleRow
                id={fieldId("if_save_every_weights")}
                label="每轮保存权重"
                hint="按轮次导出可推理权重"
                checked={form.if_save_every_weights}
                onCheckedChange={(v) => update("if_save_every_weights", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 设备 */}
        <Card>
          <CardHeader>
            <CardTitle>设备</CardTitle>
            <CardDescription>GPU 与计算精度</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field id={fieldId("gpu_numbers")} label="GPU 编号" hint="逗号或短横线分隔，如 0、0,1 或 0-1" error={errors.gpu_numbers}>
              <Input
                id={fieldId("gpu_numbers")}
                value={form.gpu_numbers}
                placeholder="0"
                onChange={(e) => update("gpu_numbers", e.target.value)}
              />
            </Field>
            <ToggleRow
              id={fieldId("is_half")}
              label="半精度 (fp16)"
              hint="显存不足时关闭"
              checked={form.is_half}
              onCheckedChange={(v) => update("is_half", v)}
            />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface/40 px-4 py-3">
        <p className="text-[11px] text-muted-foreground">
          提交后任务进入队列，可在「任务」页查看阶段进度与实时日志。
        </p>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Play />}
          {submitting ? "提交中…" : "开始训练"}
        </Button>
      </div>
    </form>
  );
}

export function TrainPage() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: system } = useSystem();
  const [tab, setTab] = useState<TrainJobType>("train_s1");
  const [lastJob, setLastJob] = useState<Job | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { type: TrainJobType; params: TrainParams }) =>
      api.createTrainJob(input.type, input.params),
    onSuccess: (job) => {
      setLastJob(job);
      toast.success(`已提交训练任务：${job.id}`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "提交训练任务失败"),
  });

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="训练"
        description="配置并提交 s1（GPT）/ s2（SoVITS）/ s2 LoRA 训练任务，提交后可在「任务」页查看进度。"
      />

      {lastJob && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/40 bg-success/10 px-4 py-3 animate-fade-in">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <ListChecks className="size-4 text-success" />
            <span className="text-foreground">已创建训练任务</span>
            <code className="rounded bg-surface/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
              {lastJob.id}
            </code>
            <span className="text-muted-foreground">{trainTabLabel(lastJob.type as TrainJobType)}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate("/jobs")}>
            查看任务 <ArrowRight />
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TrainJobType)}>
        <TabsList>
          {TRAIN_TABS.map((t) => (
            <TabsTrigger key={t.type} value={t.type}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TRAIN_TABS.map((t) => (
          <TabsContent key={t.type} value={t.type} forceMount className="data-[state=inactive]:hidden">
            <TrainForm
              type={t.type}
              versions={trainVersions(t.type, system?.versions)}
              submitting={mutation.isPending && mutation.variables?.type === t.type}
              onSubmit={(params) => mutation.mutate({ type: t.type, params })}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
