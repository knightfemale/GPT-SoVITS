import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Save, Tags, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { LabelRow } from "@/lib/api/types";
import { useApiClient } from "@/hooks/useApi";
import { queryKeys, useLabelList, useLabelLists } from "@/hooks/queries";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { LabelFileList } from "@/components/label/LabelFileList";
import { LabelTable } from "@/components/label/LabelTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const serialize = (rows: LabelRow[]) => JSON.stringify(rows);

export function LabelPage() {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const lists = useLabelLists();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const listQuery = useLabelList(selectedPath);

  const [rows, setRows] = useState<LabelRow[]>([]);
  const [baseline, setBaseline] = useState("");
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const dirty = serialize(rows) !== baseline;

  // 首次加载后默认选中第一个文件。
  useEffect(() => {
    if (selectedPath || !lists.data || lists.data.length === 0) return;
    setSelectedPath(lists.data[0].path);
  }, [lists.data, selectedPath]);

  // 载入文件数据到本地编辑态。
  useEffect(() => {
    if (!listQuery.data) return;
    setRows(listQuery.data.rows);
    setBaseline(serialize(listQuery.data.rows));
  }, [listQuery.data]);

  const save = useMutation({
    mutationFn: () => {
      if (!selectedPath) throw new Error("未选择标注文件");
      return api.saveLabelList({
        path: selectedPath,
        rows: rows.map(({ audio_path, speaker, lang, text }) => ({ audio_path, speaker, lang, text })),
      });
    },
    onSuccess: (res) => {
      setBaseline(serialize(rows));
      toast.success(`已保存 ${res.count} 行标注`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.labelLists });
      if (selectedPath) void queryClient.invalidateQueries({ queryKey: queryKeys.labelList(selectedPath) });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "保存失败，请稍后重试"),
  });

  const updateRow = useCallback((idx: number, patch: Partial<LabelRow>) => {
    setRows((prev) => prev.map((row) => (row.idx === idx ? { ...row, ...patch } : row)));
  }, []);

  const revert = () => {
    if (!listQuery.data) return;
    setRows(listQuery.data.rows);
    setBaseline(serialize(listQuery.data.rows));
  };

  const selectFile = (path: string) => {
    if (path === selectedPath) return;
    if (dirty) {
      setPendingPath(path);
      return;
    }
    setSelectedPath(path);
  };

  // Ctrl/Cmd+S 保存。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && selectedPath && !save.isPending) save.mutate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, selectedPath, save]);

  // 关闭标签页前提醒未保存改动。
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const selectedEntry = useMemo(
    () => lists.data?.find((l) => l.path === selectedPath) ?? null,
    [lists.data, selectedPath],
  );

  const refresh = () => {
    void lists.refetch();
    void listQuery.refetch();
  };

  const statusBadge = save.isPending ? (
    <Badge variant="info">
      <Loader2 className="size-3 animate-spin" /> 保存中
    </Badge>
  ) : dirty ? (
    <Badge variant="warning">未保存改动</Badge>
  ) : selectedPath ? (
    <Badge variant="success">已保存</Badge>
  ) : null;

  const tableBody = (() => {
    if (!selectedPath) {
      return (
        <EmptyState icon={<Tags />} title="选择一个标注文件" description="从左侧选择 .list 文件以开始编辑。" />
      );
    }
    if (listQuery.isLoading) {
      return (
        <div className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      );
    }
    if (listQuery.isError) {
      return (
        <EmptyState
          title="读取失败"
          description="无法读取该标注文件，请重试。"
          action={<Button onClick={() => void listQuery.refetch()}>重试</Button>}
        />
      );
    }
    if (rows.length === 0) {
      return <EmptyState title="暂无标注行" description="该 .list 文件为空。" />;
    }
    return <LabelTable rows={rows} onUpdate={updateRow} />;
  })();

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="标注编辑"
        description="浏览并编辑 .list 标注文件（audio_path | speaker | lang | text），逐行试听与校对。"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={lists.isFetching || listQuery.isFetching}
          >
            <RefreshCw className={lists.isFetching || listQuery.isFetching ? "animate-spin" : ""} /> 刷新
          </Button>
        }
      />

      {lists.isError ? (
        <EmptyState
          icon={<Tags />}
          title="无法读取标注目录"
          description="请确认后端服务已启动并可访问，然后重试。"
          action={<Button onClick={() => void lists.refetch()}>重试</Button>}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                标注文件
                <span className="text-[11px] font-normal text-muted-foreground">
                  {lists.data?.length ?? 0} 个
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LabelFileList
                entries={lists.data ?? []}
                selectedPath={selectedPath}
                onSelect={selectFile}
                isLoading={lists.isLoading}
              />
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <CardTitle className="truncate text-sm">{selectedEntry?.name ?? "标注表格"}</CardTitle>
                <p className="truncate font-mono text-[10px] text-muted-foreground/80">
                  {selectedPath ?? "请选择左侧文件"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {statusBadge}
                {dirty && !save.isPending && (
                  <Button variant="ghost" size="sm" onClick={revert}>
                    <Undo2 /> 还原
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => save.mutate()}
                  disabled={!dirty || !selectedPath || save.isPending}
                >
                  {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                  {save.isPending ? "保存中…" : "保存"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>{tableBody}</CardContent>
          </Card>
        </div>
      )}

      <Dialog open={pendingPath !== null} onOpenChange={(open) => !open && setPendingPath(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>放弃未保存的改动？</DialogTitle>
            <DialogDescription>切换到其他标注文件会丢失当前编辑内容。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPath(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingPath) setSelectedPath(pendingPath);
                setPendingPath(null);
              }}
            >
              放弃并切换
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
