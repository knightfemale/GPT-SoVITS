import { Cpu, Database, MonitorCog, Server, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { LANGUAGES } from "@/lib/tts";
import { useHealth, useSystem } from "@/hooks/queries";
import { useSettings } from "@/store/settings";
import { PageHeader } from "@/components/common/PageHeader";
import { SseStatusDot } from "@/components/common/SseStatusDot";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBytes } from "@/lib/format";

const UI_LANGUAGES = LANGUAGES.filter((l) => !l.value.startsWith("all_"));
const DEVICES = [
  { value: "auto", label: "自动（auto）" },
  { value: "cpu", label: "CPU" },
  { value: "cuda:0", label: "CUDA:0" },
  { value: "cuda:1", label: "CUDA:1" },
  { value: "mps", label: "Apple MPS" },
];

export function SettingsPage() {
  const { settings, update } = useSettings();
  const { data: system } = useSystem();
  const { data: health, isError } = useHealth();

  const notify = (label: string) => toast.success(`已更新：${label}`);

  return (
    <div className="space-y-5">
      <PageHeader title="设置" description="语言、设备与后端连接等全局配置。" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <SlidersHorizontal className="size-4" /> 语言与界面
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>界面主题</Label>
              <ThemeToggle />
            </div>
            <div className="space-y-1.5">
              <Label>默认文本语言</Label>
              <Select
                value={settings.textLang}
                onValueChange={(textLang) => {
                  update({ textLang });
                  notify("默认文本语言");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UI_LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>默认提示语言</Label>
              <Select
                value={settings.promptLang}
                onValueChange={(promptLang) => {
                  update({ promptLang });
                  notify("默认提示语言");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UI_LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MonitorCog className="size-4" /> 推理与设备
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>计算设备</Label>
              <Select
                value={settings.device}
                onValueChange={(device) => {
                  update({ device });
                  notify("计算设备");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>半精度推理</Label>
                <p className="text-[11px] text-muted-foreground">节省显存，通常更快</p>
              </div>
              <Switch
                checked={settings.isHalf}
                onCheckedChange={(isHalf) => {
                  update({ isHalf });
                  notify("半精度推理");
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>自动切换权重</Label>
                <p className="text-[11px] text-muted-foreground">合成前按参考音频自动匹配音色版本</p>
              </div>
              <Switch
                checked={settings.autoSwitchWeights}
                onCheckedChange={(autoSwitchWeights) => {
                  update({ autoSwitchWeights });
                  notify("自动切换权重");
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Server className="size-4" /> 后端连接
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>后端端口</Label>
              <Input
                type="number"
                value={settings.backendPort}
                onChange={(e) => update({ backendPort: Number(e.target.value) })}
                className="w-32 font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                开发环境通过 Vite 代理 <code className="font-mono">/api → http://127.0.0.1:{settings.backendPort}</code>
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface/40 px-3 py-2 text-xs">
              <SseStatusDot status={isError ? "error" : health ? "open" : "connecting"} />
              <span className="text-muted-foreground">后端状态</span>
              <span className="ml-auto">
                {isError ? <Badge variant="danger">离线</Badge> : health ? <Badge variant="success">在线</Badge> : <Badge variant="secondary">检测中</Badge>}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cpu className="size-4" /> 系统信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-border/60 py-1.5">
              <span className="text-muted-foreground">设备</span>
              <span className="font-mono">{system?.device ?? "—"}</span>
            </div>
            <div className="flex justify-between border-b border-border/60 py-1.5">
              <span className="text-muted-foreground">半精度</span>
              <span className="font-mono">{system ? String(system.is_half) : "—"}</span>
            </div>
            <div className="flex justify-between border-b border-border/60 py-1.5">
              <span className="text-muted-foreground">GPU</span>
              <span className="font-mono">{system?.gpu?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between border-b border-border/60 py-1.5">
              <span className="text-muted-foreground">显存</span>
              <span className="font-mono">
                {system?.gpu?.memoryFree != null && system.gpu.memoryTotal != null
                  ? `${formatBytes(system.gpu.memoryFree)} / ${formatBytes(system.gpu.memoryTotal)}`
                  : "—"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3 py-1.5">
              <span className="text-muted-foreground">支持版本</span>
              <span className="flex flex-wrap justify-end gap-1">
                {(system?.versions ?? []).map((v) => (
                  <Badge key={v} variant="outline">
                    {v}
                  </Badge>
                ))}
                {!system?.versions?.length && <span className="font-mono">—</span>}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Database className="size-3" />
        所有设置保存在浏览器本地（localStorage），不会上传服务器。
      </p>
    </div>
  );
}
