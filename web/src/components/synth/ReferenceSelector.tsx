import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Library, Mic, Play, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Reference } from "@/lib/api/types";
import { referenceAudioUrl } from "@/lib/references";
import { useApiClient } from "@/hooks/useApi";
import { queryKeys, useReferences } from "@/hooks/queries";
import { usePlayer } from "@/store/player";
import { Dropzone } from "@/components/audio/Dropzone";
import { AudioRecorder } from "@/components/audio/AudioRecorder";
import { ReferenceCard } from "@/components/audio/ReferenceCard";
import { ReferenceTextDialog } from "@/components/audio/ReferenceTextDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";

interface ReferenceSelectorProps {
  value: string | null;
  refName: string | null;
  onChange: (reference: Reference | null) => void;
  disabled?: boolean;
}

export function ReferenceSelector({ value, refName, onChange, disabled }: ReferenceSelectorProps) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { play } = usePlayer();
  const { data: references } = useReferences();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Reference | null>(null);

  const selected = references?.find((r) => r.id === value) ?? null;

  const filtered = useMemo(() => {
    const list = references ?? [];
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((r) => r.name.toLowerCase().includes(q) || (r.text ?? "").toLowerCase().includes(q));
  }, [references, query]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadReference(file),
    onSuccess: (ref) => {
      queryClient.setQueryData<Reference[]>(queryKeys.references, (prev) => [ref, ...(prev ?? [])]);
      onChange(ref);
      setOpen(false);
      toast.success("已上传参考音频");
    },
    onError: () => toast.error("上传失败"),
  });

  const handleSelect = (ref: Reference) => {
    onChange(ref);
    setOpen(false);
  };

  const handleRecord = async (blob: Blob) => {
    const name = `录音-${new Date().toLocaleTimeString("zh-CN", { hour12: false })}.webm`;
    try {
      const ref = await api.uploadReference(new File([blob], name, { type: blob.type }), { name });
      queryClient.setQueryData<Reference[]>(queryKeys.references, (prev) => [ref, ...(prev ?? [])]);
      onChange(ref);
      setOpen(false);
      toast.success("录音已设为参考音频");
    } catch {
      toast.error("录音上传失败");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/40 p-2.5">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          selected ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Library className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{refName ?? selected?.name ?? "未选择参考音频"}</p>
        <p className="text-[11px] text-muted-foreground">
          {selected ? `时长 ${selected.duration.toFixed(1)}s · ${selected.lang ?? "auto"}` : "参考音频决定音色，建议 3–10 秒"}
        </p>
      </div>

      {selected && referenceAudioUrl(selected) && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="试听"
          onClick={() =>
            play({
              id: selected.id,
              title: selected.name,
              subtitle: selected.text,
              src: referenceAudioUrl(selected)!,
            })
          }
        >
          <Play />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={disabled}>
            选择
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>选择参考音频</DialogTitle>
            <DialogDescription>从音频库选择，或上传 / 录制一段新的参考音频。</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="library">
            <TabsList>
              <TabsTrigger value="library">
                <Library className="size-3.5" /> 音频库
              </TabsTrigger>
              <TabsTrigger value="upload">
                <Upload className="size-3.5" /> 上传
              </TabsTrigger>
              <TabsTrigger value="record">
                <Mic className="size-3.5" /> 录制
              </TabsTrigger>
            </TabsList>

            <TabsContent value="library">
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索名称或文本…"
                  className="pl-8"
                />
              </div>
              {filtered.length === 0 ? (
                <EmptyState icon={<Library />} title="没有匹配的参考音频" description="换一个关键词，或切换到「上传 / 录制」。" />
              ) : (
                <div className="grid max-h-[42vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {filtered.map((ref) => (
                    <ReferenceCard
                      key={ref.id}
                      reference={ref}
                      selected={ref.id === value}
                      onSelect={handleSelect}
                      onEditText={(r) => setEditing(r)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="upload">
              <Dropzone
                onFile={(file) => uploadMutation.mutate(file)}
                hint="支持 wav / mp3 / m4a / flac 等，单个文件"
              />
              {uploadMutation.isPending && <p className="mt-2 text-xs text-muted-foreground">上传中…</p>}
            </TabsContent>

            <TabsContent value="record">
              <AudioRecorder onRecord={handleRecord} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      </div>

      {selected && !selected.text?.trim() && (
        <button
          type="button"
          onClick={() => setEditing(selected)}
          className="flex w-full items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-2.5 py-2 text-left text-[11px] text-warning transition-colors hover:bg-warning/15"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <span>该参考音频还没有文本，v3 / v5 等模型合成需要它，点击补充</span>
        </button>
      )}

      <ReferenceTextDialog
        reference={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={(updated) => {
          if (updated.id === value) onChange(updated);
        }}
      />
    </div>
  );
}
