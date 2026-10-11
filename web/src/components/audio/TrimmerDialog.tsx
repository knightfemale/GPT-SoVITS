import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions";
import { Scissors } from "lucide-react";
import { toast } from "sonner";
import type { Reference } from "@/lib/api/types";
import { referenceAudioUrl } from "@/lib/references";
import { computePeaks, trimAudioBlob } from "@/lib/audio/wav";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";

interface TrimmerDialogProps {
  reference: Reference | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (blob: Blob, peaks: number[], duration: number) => void;
}

interface Selection {
  start: number;
  end: number;
}

export function TrimmerDialog({ reference, open, onOpenChange, onApply }: TrimmerDialogProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !reference) return;
    const container = containerRef.current;
    const url = referenceAudioUrl(reference);
    if (!container || !url) return;

    let disposed = false;
    const ws = WaveSurfer.create({
      container,
      height: 96,
      waveColor: "#3a4453",
      progressColor: "#37E0C8",
      cursorColor: "#37E0C8",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      url,
    });
    const regions = ws.registerPlugin(RegionsPlugin.create());
    ws.on("decode", () => {
      regions.enableDragSelection({ color: "rgba(55,224,200,0.14)" });
    });
    regions.on("region-created", (region) => {
      regions.getRegions().forEach((r) => {
        if (r.id !== region.id) r.remove();
      });
      setSelection({ start: region.start, end: region.end });
    });
    regions.on("region-updated", (region) => {
      setSelection({ start: region.start, end: region.end });
    });
    ws.on("ready", () => setLoading(false));
    setLoading(true);

    // 预取原始音频 blob 供裁剪使用
    fetch(url)
      .then((r) => r.blob())
      .then((b) => {
        if (!disposed) blobRef.current = b;
      })
      .catch(() => {
        if (!disposed) blobRef.current = null;
      });

    setSelection(null);
    return () => {
      disposed = true;
      ws.unAll();
      ws.destroy();
    };
  }, [open, reference]);

  const apply = async () => {
    if (!blobRef.current || !selection) {
      toast.error("请先在波形上拖拽选择裁剪区间");
      return;
    }
    setBusy(true);
    try {
      const blob = await trimAudioBlob(blobRef.current, selection.start, selection.end);
      // 重新计算峰值
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      await new Promise<void>((resolve) => {
        audio.addEventListener("loadedmetadata", () => resolve(), { once: true });
        audio.addEventListener("error", () => resolve(), { once: true });
      });
      const duration = audio.duration || selection.end - selection.start;
      // 使用 decode 峰值（若失败则回退到区间截取）
      let peaks: number[] = [];
      try {
        const AudioCtx = window.AudioContext;
        const ctx = new AudioCtx();
        const buf = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
        peaks = computePeaks(buf);
        await ctx.close();
      } catch {
        peaks = reference?.peaks ?? [0.2];
      }
      onApply(blob, peaks, duration);
      toast.success("裁剪完成");
      onOpenChange(false);
    } catch {
      toast.error("裁剪失败，请重试");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="size-4" /> 裁剪参考音频
          </DialogTitle>
          <DialogDescription>
            在波形上拖拽选区以裁剪（建议保留 3–10 秒）。{reference?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="relative rounded-md border border-border bg-surface/40 p-2">
          {loading && <p className="absolute inset-0 z-10 flex items-center justify-center text-xs text-muted-foreground">载入波形…</p>}
          <div ref={containerRef} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {selection
              ? `选区 ${formatDuration(selection.start)} → ${formatDuration(selection.end)}（${(selection.end - selection.start).toFixed(2)}s）`
              : "尚未选择区间"}
          </span>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={apply} disabled={busy || !selection}>
            {busy ? "裁剪中…" : "应用裁剪"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
