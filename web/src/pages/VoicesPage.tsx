import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Cpu, RefreshCw, Zap } from "lucide-react";
import type { ModelEntry } from "@/lib/api/types";
import { checkPairing, versionLabel, versionOf } from "@/lib/versions";
import { useModels } from "@/hooks/queries";
import { useVoice } from "@/store/voice";
import { PageHeader } from "@/components/common/PageHeader";
import { VersionBadge } from "@/components/common/VersionBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { WeightList } from "@/components/models/WeightList";
import { PairingGuard } from "@/components/models/PairingGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function VoicesPage() {
  const { data, isLoading, isError, refetch } = useModels();
  const { selection, switchWeights, isSwitching, switchError } = useVoice();

  const [sovits, setSovits] = useState<ModelEntry | null>(null);
  const [gpt, setGpt] = useState<ModelEntry | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!data) return;
    setSovits((prev) => (prev ? data.sovits.find((e) => e.path === prev.path) ?? prev : data.sovits.find((e) => e.path === selection.sovitsPath) ?? data.sovits[0] ?? null));
    setGpt((prev) => (prev ? data.gpt.find((e) => e.path === prev.path) ?? prev : data.gpt.find((e) => e.path === selection.gptPath) ?? data.gpt[0] ?? null));
  }, [data, selection.sovitsPath, selection.gptPath]);

  const sovitsVersion = sovits ? versionOf(sovits) : null;
  const gptVersion = gpt ? versionOf(gpt) : null;
  const pairing = useMemo(() => checkPairing(sovitsVersion, gptVersion), [sovitsVersion, gptVersion]);

  const sovitsIncompatible = (entry: ModelEntry) =>
    Boolean(gpt) && !checkPairing(versionOf(entry), gptVersion).ok;
  const gptIncompatible = (entry: ModelEntry) =>
    Boolean(sovits) && !checkPairing(sovitsVersion, versionOf(entry)).ok;

  const dirty =
    sovits?.path !== selection.sovitsPath || gpt?.path !== selection.gptPath;

  const apply = async () => {
    const ok = await switchWeights(sovits, gpt);
    if (ok) setConfirmOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="音色库"
        description="管理 SoVITS 与 GPT 权重、检查版本配对并切换到当前音色。"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={isLoading ? "animate-spin" : ""} /> 刷新
          </Button>
        }
      />

      {isError ? (
        <EmptyState
          icon={<Cpu />}
          title="无法读取权重目录"
          description="请确认后端服务已启动并可访问，然后重试。"
          action={<Button onClick={() => refetch()}>重试</Button>}
        />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 pt-5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowLeftRight className="size-3.5" />
                当前选择
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">SoVITS</span>
                {sovits ? <VersionBadge version={sovitsVersion!} /> : <span className="text-xs">—</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">GPT</span>
                {gpt ? <VersionBadge version={gptVersion!} /> : <span className="text-xs">—</span>}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  disabled={!dirty || !pairing.ok || isSwitching}
                  onClick={() => setConfirmOpen(true)}
                >
                  <Zap /> {isSwitching ? "切换中…" : "应用切换"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <PairingGuard pairing={pairing} switching={isSwitching} error={switchError} />

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  SoVITS 权重
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {data?.sovits.length ?? 0} 个 · 决定音色
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-40" />
                ) : (
                  <WeightList
                    entries={data?.sovits ?? []}
                    kind="sovits"
                    selectedPath={sovits?.path ?? null}
                    onSelect={setSovits}
                    isIncompatible={sovitsIncompatible}
                    disabled={isSwitching}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  GPT 权重
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {data?.gpt.length ?? 0} 个 · 决定发音韵律
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-40" />
                ) : (
                  <WeightList
                    entries={data?.gpt ?? []}
                    kind="gpt"
                    selectedPath={gpt?.path ?? null}
                    onSelect={setGpt}
                    isIncompatible={gptIncompatible}
                    disabled={isSwitching}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            提示：SoVITS 与 GPT 权重必须版本匹配才能组合使用（例如 v3 需要搭配 s1v3 的 GPT）。
            不合版本的候选项会灰显，以避免运行期报错。当前激活版本：{versionLabel(sovitsVersion ?? "unknown")}。
          </p>
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认切换权重？</DialogTitle>
            <DialogDescription>
              切换期间将全局锁定合成与任务操作，失败会自动回滚到之前的音色。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between rounded-md border border-border bg-surface/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">SoVITS</span>
              <span className="font-mono text-foreground">{sovits?.name ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-surface/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">GPT</span>
              <span className="font-mono text-foreground">{gpt?.name ?? "—"}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isSwitching}>
              取消
            </Button>
            <Button onClick={apply} disabled={isSwitching}>
              {isSwitching ? "切换中…" : "确认切换"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
