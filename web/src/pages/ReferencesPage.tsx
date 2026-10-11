import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Library, Mic, Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Reference } from "@/lib/api/types";
import { useApiClient } from "@/hooks/useApi";
import { queryKeys, useReferences } from "@/hooks/queries";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ReferenceCard } from "@/components/audio/ReferenceCard";
import { Dropzone } from "@/components/audio/Dropzone";
import { AudioRecorder } from "@/components/audio/AudioRecorder";
import { TrimmerDialog } from "@/components/audio/TrimmerDialog";
import { ReferenceTextDialog } from "@/components/audio/ReferenceTextDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ReferencesPage() {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { data, isLoading } = useReferences();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [trimming, setTrimming] = useState<Reference | null>(null);
  const [editing, setEditing] = useState<Reference | null>(null);

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((r) => r.name.toLowerCase().includes(q) || (r.text ?? "").toLowerCase().includes(q));
  }, [data, query]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadReference(file),
    onSuccess: (ref) => {
      queryClient.setQueryData<Reference[]>(queryKeys.references, (prev) => [ref, ...(prev ?? [])]);
      setAddOpen(false);
      toast.success("已添加参考音频");
    },
    onError: () => toast.error("上传失败"),
  });

  const handleRecord = async (blob: Blob) => {
    const name = `录音-${new Date().toLocaleTimeString("zh-CN", { hour12: false })}.webm`;
    try {
      const ref = await api.uploadReference(new File([blob], name, { type: blob.type }), { name });
      queryClient.setQueryData<Reference[]>(queryKeys.references, (prev) => [ref, ...(prev ?? [])]);
      setAddOpen(false);
      toast.success("录音已加入音频库");
    } catch {
      toast.error("录音上传失败");
    }
  };

  const remove = async (reference: Reference) => {
    try {
      await api.deleteReference(reference.id);
      queryClient.setQueryData<Reference[]>(queryKeys.references, (prev) =>
        (prev ?? []).filter((r) => r.id !== reference.id),
      );
      toast.success("已删除参考音频");
    } catch {
      toast.error("删除失败");
    }
  };

  const applyTrim = async (reference: Reference, blob: Blob, _peaks: number[], _duration: number) => {
    const trimName = reference.name.replace(/(\.[^.]+)?$/, "-trim$1") || reference.name;
    try {
      const created = await api.uploadReference(new File([blob], trimName, { type: blob.type }), {
        name: trimName,
        text: reference.text,
        lang: reference.lang,
      });
      await api.deleteReference(reference.id);
      queryClient.setQueryData<Reference[]>(queryKeys.references, (prev) =>
        (prev ?? []).map((r) => (r.id === reference.id ? created : r)),
      );
      toast.success("已保存裁剪结果");
    } catch {
      toast.error("裁剪保存失败");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="参考音频库"
        description="管理用于音色克隆的参考音频：上传、录制、试听与裁剪。"
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus /> 添加音频
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索名称或文本…"
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Library />}
          title={query ? "没有匹配的参考音频" : "音频库还是空的"}
          description={query ? "换一个关键词试试。" : "上传或录制一段 3–10 秒的清晰人声作为参考。"}
          action={
            !query ? (
              <Button onClick={() => setAddOpen(true)}>
                <Plus /> 添加音频
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((reference) => (
            <ReferenceCard
              key={reference.id}
              reference={reference}
              onDelete={remove}
              onTrim={(ref) => setTrimming(ref)}
              onEditText={(ref) => setEditing(ref)}
            />
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>添加参考音频</DialogTitle>
            <DialogDescription>上传音频文件，或直接录制一段。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Upload className="size-3.5" /> 上传文件
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Dropzone onFile={(file) => uploadMutation.mutate(file)} hint="支持 wav / mp3 / m4a / flac" />
                {uploadMutation.isPending && <p className="mt-2 text-xs text-muted-foreground">上传中…</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Mic className="size-3.5" /> 录制
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AudioRecorder onRecord={handleRecord} />
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <TrimmerDialog
        reference={trimming}
        open={Boolean(trimming)}
        onOpenChange={(open) => !open && setTrimming(null)}
        onApply={(blob, peaks, duration) => trimming && applyTrim(trimming, blob, peaks, duration)}
      />

      <ReferenceTextDialog
        reference={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  );
}
