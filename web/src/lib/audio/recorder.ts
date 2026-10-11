/** MediaRecorder 录音封装（参考音频录制）。 */
export interface RecorderHandle {
  stop: () => void;
  readonly mimeType: string;
}

export interface RecorderOptions {
  onData: (blob: Blob) => void;
  onLevel?: (level: number, durationSec: number) => void;
  onError?: (error: Error) => void;
  /** 录音时长上限（秒）。 */
  maxDuration?: number;
}

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export async function startRecording(opts: RecorderOptions): Promise<RecorderHandle> {
  const { onData, onLevel, onError, maxDuration = 30 } = opts;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error("无法访问麦克风");
    onError?.(e);
    throw e;
  }

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  const startedAt = performance.now();

  // 电平表（可选）
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  let audioCtx: AudioContext | null = null;
  let rafId = 0;
  if (onLevel && AudioCtx) {
    try {
      audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        onLevel(Math.min(1, rms * 3), (performance.now() - startedAt) / 1000);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    } catch {
      /* 电平表非关键 */
    }
  }

  const cleanup = () => {
    cancelAnimationFrame(rafId);
    stream.getTracks().forEach((t) => t.stop());
    audioCtx?.close().catch(() => undefined);
  };

  let autoStopTimer: ReturnType<typeof setTimeout> | null = null;
  const stop = () => {
    if (autoStopTimer) clearTimeout(autoStopTimer);
    if (recorder.state !== "inactive") recorder.stop();
  };

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onerror = () => {
    onError?.(new Error("录音过程中发生错误"));
  };
  recorder.onstop = () => {
    cleanup();
    const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
    onData(blob);
  };

  recorder.start(200);
  autoStopTimer = setTimeout(stop, maxDuration * 1000);

  return { stop, mimeType: recorder.mimeType };
}
