import { useCallback, useMemo, useRef, useState } from "react";
import { AlertCircle, Radio, Sparkles, Square, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { TTSRequest } from "@/lib/api/types";
import type { WeightVersion } from "@/lib/versions";
import { useApiClient } from "@/hooks/useApi";
import { useReferences } from "@/hooks/queries";
import { useSettings } from "@/store/settings";
import { useVoice } from "@/store/voice";
import { usePlayer } from "@/store/player";
import { DEFAULT_TTS_PARAMS, PRESETS, applyPreset, type ParamTier } from "@/lib/tts";
import {
  newSegment,
  segmentsFromText,
  segmentsToText,
  type Segment,
} from "@/lib/text";
import { newResultId, type SynthResult } from "@/lib/results";
import { consumeStream } from "@/lib/audio/stream";
import { computePeaks, decodeAudioBlob } from "@/lib/audio/wav";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { TextSegmentsEditor } from "@/components/synth/TextSegmentsEditor";
import { ReferenceSelector } from "@/components/synth/ReferenceSelector";
import { ParamPanel } from "@/components/synth/ParamPanel";
import { PresetPicker } from "@/components/synth/PresetPicker";
import { ResultHistory } from "@/components/synth/ResultHistory";
import { WaveformPlayer } from "@/components/audio/WaveformPlayer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export function SynthesizePage() {
  const api = useApiClient();
  const { settings } = useSettings();
  const { selection, setSelection, isLocked, activeVersion } = useVoice();
  const { play } = usePlayer();
  const { data: references } = useReferences();

  const [segments, setSegments] = useState<Segment[]>([newSegment("", settings.textLang)]);
  const [params, setParams] = useState<TTSRequest>({ ...DEFAULT_TTS_PARAMS, text_lang: settings.textLang, prompt_lang: settings.promptLang });
  const [tier, setTier] = useState<ParamTier>("basic");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [results, setResults] = useState<SynthResult[]>([]);
  const [peaksMap, setPeaksMap] = useState<Record<string, number[]>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastUrlAt = useRef(0);

  const version = (activeVersion ?? "unknown") as WeightVersion;
  const selectedRef = useMemo(
    () => references?.find((r) => r.id === selection.referenceId) ?? null,
    [references, selection.referenceId],
  );

  const streaming = params.streaming_mode !== 0 && params.streaming_mode !== false;
  const activeSegments = segments.filter((s) => s.text.trim());
  const canSynthesize = activeSegments.length > 0 && Boolean(selectedRef) && !busy && !isLocked;

  const patchParams = (patch: Partial<TTSRequest>) => {
    setParams((prev) => ({ ...prev, ...patch }));
    setPresetId(null);
  };

  const applyPresetById = (id: string) => {
    setParams((prev) => applyPreset(prev, id));
    setPresetId(id);
    toast.success(`已应用预设「${PRESETS.find((p) => p.id === id)?.name ?? id}」`);
  };

  const buildRequest = useCallback(
    (segment: Segment): TTSRequest => ({
      ...params,
      text: segment.text,
      text_lang: segment.lang,
      prompt_text: selectedRef?.text ?? params.prompt_text ?? "",
      prompt_lang: params.prompt_lang ?? settings.promptLang,
      ref_audio_path: selectedRef?.path ?? "",
    }),
    [params, selectedRef, settings.promptLang],
  );

  const addResult = useCallback(
    async (blob: Blob, url: string, text: string, mediaType: string, streamed: boolean) => {
      let duration = 0;
      let peaks: number[] = [0.25, 0.5, 0.3, 0.6, 0.4];
      try {
        const buffer = await decodeAudioBlob(blob);
        duration = buffer.duration;
        peaks = computePeaks(buffer);
      } catch {
        /* 保留占位 peaks */
      }
      const id = newResultId();
      setPeaksMap((m) => ({ ...m, [id]: peaks }));
      setResults((r) => [{ id, text, url, duration, createdAt: Date.now(), mediaType, streamed }, ...r]);
      play({ id, title: text || "合成结果", subtitle: streamed ? "流式输出" : mediaType, src: url });
    },
    [play],
  );

  const synthesize = async () => {
    if (!selectedRef) {
      toast.error("请先选择参考音频");
      return;
    }
    if (activeSegments.length === 0) {
      toast.error("请输入要合成的文本");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setProgress(0);
    try {
      for (const segment of activeSegments) {
        const request = buildRequest(segment);
        if (streaming) {
          const stream = await api.ttsStream(request, controller.signal);
          if (!stream) {
            throw new Error("后端未返回流式数据");
          }
          const chunks: Uint8Array[] = [];
          const estBytes = Math.max(16000, segment.text.length * 6000);
          const blob = await consumeStream(stream, {
            signal: controller.signal,
            onChunk: (received, chunk) => {
              chunks.push(chunk);
              setProgress(Math.min(0.98, received / estBytes));
              const now = Date.now();
              if (now - lastUrlAt.current > 350) {
                lastUrlAt.current = now;
                setLiveUrl(
                  URL.createObjectURL(new Blob(chunks as unknown as BlobPart[], { type: "audio/wav" })),
                );
              }
            },
          });
          const url = URL.createObjectURL(blob);
          setLiveUrl(url);
          await addResult(blob, url, segment.text, request.media_type ?? "wav", true);
        } else {
          const blob = await api.tts(request);
          const url = URL.createObjectURL(blob);
          setLiveUrl(url);
          await addResult(blob, url, segment.text, request.media_type ?? "wav", false);
        }
      }
      toast.success(activeSegments.length > 1 ? "所有语段合成完成" : "合成完成");
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error(`合成失败：${(error as Error).message}`);
      }
    } finally {
      setBusy(false);
      setProgress(0);
      abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    toast("已取消合成");
  };

  const handleSplit = () => {
    const text = segmentsToText(segments);
    const lang = segments[0]?.lang ?? settings.textLang;
    setSegments(segmentsFromText(text, lang));
    toast.success("已按语义切分");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="语音合成"
        description="输入文本，选择参考音频与参数，实时生成目标音色语音。"
        actions={
          <Badge variant={isLocked ? "warning" : "outline"} className="gap-1">
            {isLocked ? <AlertCircle className="size-3" /> : <Sparkles className="size-3" />}
            {isLocked ? "权重切换中，已锁定" : "就绪"}
          </Badge>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>文本</CardTitle>
            </CardHeader>
            <CardContent>
              <TextSegmentsEditor
                segments={segments}
                onChange={setSegments}
                onSplit={handleSplit}
                disabled={busy}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>参考音频</CardTitle>
            </CardHeader>
            <CardContent>
              <ReferenceSelector
                value={selection.referenceId}
                refName={selection.referenceName}
                onChange={(ref) =>
                  setSelection({ referenceId: ref?.id ?? null, referenceName: ref?.name ?? null })
                }
                disabled={busy}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>参数</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PresetPicker activeId={presetId} onApply={applyPresetById} disabled={busy} />
              <ParamPanel
                params={params}
                version={version}
                tier={tier}
                onTierChange={setTier}
                onChange={patchParams}
                disabled={busy}
              />
            </CardContent>
          </Card>

          <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-lg border border-border bg-card/95 p-3 backdrop-blur">
            {busy ? (
              <Button variant="destructive" onClick={cancel} className="w-32">
                <Square /> 取消
              </Button>
            ) : (
              <Button onClick={synthesize} disabled={!canSynthesize} className="w-32">
                <Wand2 /> 合成
              </Button>
            )}
            {busy && streaming && (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Radio className="size-3.5 shrink-0 animate-pulse text-primary" />
                <Progress value={Math.round(progress * 100)} className="flex-1" />
                <span className="font-mono text-[11px] text-muted-foreground">{Math.round(progress * 100)}%</span>
              </div>
            )}
            {!busy && !canSynthesize && (
              <span className="text-xs text-muted-foreground">
                {isLocked ? "权重切换中，暂不可合成" : !selectedRef ? "请选择参考音频" : "请输入文本"}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {liveUrl && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  实时输出
                  {streaming && <span className="flex items-center gap-1 text-[11px] font-normal text-primary"><Radio className="size-3 animate-pulse" />流式</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WaveformPlayer url={liveUrl} height={64} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                结果历史
                <span className="text-[11px] font-normal text-muted-foreground">{results.length} 条</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <EmptyState
                  icon={<Wand2 />}
                  title="等待第一次合成"
                  description="完成合成后，可在此试听、下载或复用结果。"
                />
              ) : (
                <ResultHistory
                  results={results}
                  peaksMap={peaksMap}
                  onDelete={(id) => setResults((r) => r.filter((x) => x.id !== id))}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
