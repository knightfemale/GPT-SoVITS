import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AudioWaveform, Eraser, FileStack, Play, Scissors, Wand2 } from "lucide-react";
import { toast } from "sonner";

import type { Job } from "@/lib/api";
import { useApiClient } from "@/hooks/useApi";
import { queryKeys } from "@/hooks/queries";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** 数据集 / 工具类任务（slice / format / uvr5 / asr / denoise）的真实创建入口。
 *  参数严格对齐后端 `src/webui_ng/models.py` 的 *Params 模型。 */

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function TextField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <Field id={props.id} label={props.label} hint={props.hint}>
      <Input
        id={props.id}
        type={props.type ?? "text"}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        className="font-mono"
      />
    </Field>
  );
}

function useCreateJob(type: string) {
  const api = useApiClient();
  const qc = useQueryClient();
  const nav = useNavigate();
  return useMutation<Job, Error, Record<string, unknown>>({
    mutationFn: (params) => api.createJob(type, params),
    onSuccess: (job) => {
      toast.success(`已创建任务 ${job.id.slice(0, 8)}`);
      void qc.invalidateQueries({ queryKey: queryKeys.jobs });
      nav("/jobs");
    },
    onError: (e) => toast.error(`创建失败：${e.message}`),
  });
}

function SubmitBar({ pending }: { pending: boolean }) {
  return (
    <div className="flex justify-end pt-1">
      <Button type="submit" disabled={pending}>
        <Play /> {pending ? "创建中…" : "创建任务"}
      </Button>
    </div>
  );
}

function SliceForm() {
  const m = useCreateJob("slice");
  const [inp, setInp] = useState("");
  const [optRoot, setOptRoot] = useState("");
  const [threshold, setThreshold] = useState("-34");
  const [minLength, setMinLength] = useState("4000");
  const [minInterval, setMinInterval] = useState("300");
  const [hopSize, setHopSize] = useState("10");
  const [maxSilKept, setMaxSilKept] = useState("500");
  const [maxAmplitude, setMaxAmplitude] = useState("0.9");
  const [alpha, setAlpha] = useState("0.25");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate({
      inp,
      opt_root: optRoot || undefined,
      threshold: Number(threshold),
      min_length: Number(minLength),
      min_interval: Number(minInterval),
      hop_size: Number(hopSize),
      max_sil_kept: Number(maxSilKept),
      max_amplitude: Number(maxAmplitude),
      alpha: Number(alpha),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField id="slice-inp" label="输入音频/目录" value={inp} onChange={setInp} placeholder="dataset/raw" />
      <TextField id="slice-out" label="输出目录" value={optRoot} onChange={setOptRoot} placeholder="dataset/sliced" />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField id="slice-th" label="静音阈值(dB)" type="number" value={threshold} onChange={setThreshold} />
        <TextField id="slice-minlen" label="最小片段(ms)" type="number" value={minLength} onChange={setMinLength} />
        <TextField id="slice-minint" label="最小间隔(ms)" type="number" value={minInterval} onChange={setMinInterval} />
        <TextField id="slice-hop" label="hop_size" type="number" value={hopSize} onChange={setHopSize} />
        <TextField id="slice-sil" label="保留静音(ms)" type="number" value={maxSilKept} onChange={setMaxSilKept} />
        <TextField id="slice-max" label="最大振幅" type="number" value={maxAmplitude} onChange={setMaxAmplitude} />
        <TextField id="slice-alpha" label="alpha" type="number" value={alpha} onChange={setAlpha} />
      </div>
      <SubmitBar pending={m.isPending} />
    </form>
  );
}

function FormatForm() {
  const m = useCreateJob("format");
  const [inpText, setInpText] = useState("");
  const [inpWav, setInpWav] = useState("");
  const [expName, setExpName] = useState("my_voice");
  const [optDir, setOptDir] = useState("");
  const [version, setVersion] = useState("");
  const [s2g, setS2g] = useState("");
  const [sv, setSv] = useState("");
  const [isHalf, setIsHalf] = useState(true);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate({
      inp_text: inpText,
      inp_wav_dir: inpWav,
      exp_name: expName,
      opt_dir: optDir || undefined,
      version: version || undefined,
      pretrained_s2G: s2g || undefined,
      sv_path: sv || undefined,
      is_half: isHalf,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField id="fmt-text" label="标注文件(.list)" value={inpText} onChange={setInpText} placeholder="dataset/raw/xx.list" />
      <TextField id="fmt-wav" label="音频目录" value={inpWav} onChange={setInpWav} placeholder="dataset/sliced" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="fmt-exp" label="实验名" value={expName} onChange={setExpName} />
        <TextField id="fmt-out" label="输出目录(可选)" value={optDir} onChange={setOptDir} />
        <TextField id="fmt-ver" label="版本(可选)" value={version} onChange={setVersion} placeholder="v2Pro" />
        <TextField id="fmt-s2g" label="s2G 权重(可选)" value={s2g} onChange={setS2g} />
        <TextField id="fmt-sv" label="SV 权重(Pro 可选)" value={sv} onChange={setSv} />
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border/60 bg-surface/40 px-3 py-2">
        <span className="text-xs font-medium">半精度(fp16)</span>
        <Switch checked={isHalf} onCheckedChange={setIsHalf} />
      </label>
      <SubmitBar pending={m.isPending} />
    </form>
  );
}

function Uvr5Form() {
  const m = useCreateJob("uvr5");
  const [inputDir, setInputDir] = useState("");
  const [vocal, setVocal] = useState("");
  const [ins, setIns] = useState("");
  const [model, setModel] = useState("");
  const [agg, setAgg] = useState("10");
  const [format, setFormat] = useState("flac");
  const [isHalf, setIsHalf] = useState(true);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate({
      input_dir: inputDir,
      output_vocal: vocal || undefined,
      output_ins: ins || undefined,
      model_name: model || undefined,
      agg: Number(agg),
      format,
      is_half: isHalf,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField id="uvr-in" label="输入目录" value={inputDir} onChange={setInputDir} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="uvr-vocal" label="人声输出(可选)" value={vocal} onChange={setVocal} />
        <TextField id="uvr-ins" label="伴奏输出(可选)" value={ins} onChange={setIns} />
        <TextField id="uvr-model" label="模型名(可选)" value={model} onChange={setModel} placeholder="HP2_all_vocals" />
        <TextField id="uvr-agg" label="agg" type="number" value={agg} onChange={setAgg} />
      </div>
      <Field id="uvr-format" label="输出格式">
        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger id="uvr-format" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["flac", "wav", "mp3"].map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border/60 bg-surface/40 px-3 py-2">
        <span className="text-xs font-medium">半精度(fp16)</span>
        <Switch checked={isHalf} onCheckedChange={setIsHalf} />
      </label>
      <SubmitBar pending={m.isPending} />
    </form>
  );
}

function AsrForm() {
  const m = useCreateJob("asr");
  const [inpDir, setInpDir] = useState("");
  const [optDir, setOptDir] = useState("");
  const [modelSize, setModelSize] = useState("large-v3");
  const [language, setLanguage] = useState("auto");
  const [precision, setPrecision] = useState("float32");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate({
      inp_dir: inpDir,
      opt_dir: optDir || undefined,
      model_size: modelSize,
      language,
      precision,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField id="asr-in" label="输入目录" value={inpDir} onChange={setInpDir} />
      <TextField id="asr-out" label="输出目录(可选)" value={optDir} onChange={setOptDir} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField id="asr-size" label="模型" value={modelSize} onChange={setModelSize} placeholder="large-v3" />
        <TextField id="asr-lang" label="语言" value={language} onChange={setLanguage} placeholder="auto" />
        <TextField id="asr-prec" label="精度" value={precision} onChange={setPrecision} />
      </div>
      <SubmitBar pending={m.isPending} />
    </form>
  );
}

function DenoiseForm() {
  const m = useCreateJob("denoise");
  const [inpDir, setInpDir] = useState("");
  const [optDir, setOptDir] = useState("");
  const [precision, setPrecision] = useState("float16");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate({ inp_dir: inpDir, opt_dir: optDir || undefined, precision });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField id="dn-in" label="输入目录" value={inpDir} onChange={setInpDir} />
      <TextField id="dn-out" label="输出目录(可选)" value={optDir} onChange={setOptDir} />
      <TextField id="dn-prec" label="精度" value={precision} onChange={setPrecision} hint="float16 | float32" />
      <SubmitBar pending={m.isPending} />
    </form>
  );
}

const TABS = [
  { value: "slice", label: "切片", icon: Scissors, render: () => <SliceForm /> },
  { value: "format", label: "格式化", icon: FileStack, render: () => <FormatForm /> },
  { value: "uvr5", label: "人声分离", icon: AudioWaveform, render: () => <Uvr5Form /> },
  { value: "asr", label: "语音识别", icon: Wand2, render: () => <AsrForm /> },
  { value: "denoise", label: "降噪", icon: Eraser, render: () => <DenoiseForm /> },
];

export function ToolsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="数据集工具"
        description="切片、格式化、人声分离、语音识别与降噪——创建后实时推送到「任务」页。"
      />
      <Tabs defaultValue="slice" className="space-y-4">
        <TabsList className="flex flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              <t.icon className="size-4" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            <Card>
              <CardContent className="pt-6">{t.render()}</CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
