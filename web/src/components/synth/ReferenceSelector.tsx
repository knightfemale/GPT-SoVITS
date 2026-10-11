import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Library, Mic, Play, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Reference } from "@/lib/api/types";
import { referenceAudioUrl } from "@/lib/references";
import { decodeAudioBlob, computePeaks } from "@/lib/audio/wav";
import { useApiClient } from "@/hooks/useApi";
import { queryKeys, useReferences } from "@/hooks/queries";
import { usePlayer } from "@/store/player";
import { Dropzone } from "@/components/audio/Dropzone";
import { AudioRecorder } from "@/components/audio/AudioRecorder";
import { ReferenceCard } from "@/components/audio/ReferenceCard";
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
    let peaks: number[] = [0.3];
    let duration = 0;
    try {
      const buffer = await decodeAudioBlob(blob);
      peaks = computePeaks(buffer);
      duration = buffer.duration;
    } catch {
      /* 解码失败保留占位 peaks */
    }
    const local: Reference = {
      id: `ref-rec-${Date.now().toString(36)}`,
      name: `录音-${new Date().toLocaleTimeString("zh-CN", { hour12: false })}.webm`,
      path: `recordings/rec-${Date.now()}.webm`,
      audioUrl: URL.createObjectURL(blob),
      peaks,
      duration,
      lang: "zh",
    };
    queryClient.setQueryData<Reference[]>(queryKeys.references, (prev) => [local, ...(prev ?? [])]);
    onChange(local);
    setOpen(false);
    toast.success("录音已设为参考音频");
  };

  return (
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
  );
}
