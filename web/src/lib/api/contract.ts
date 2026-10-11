import type {
  AppSettings,
  HealthResponse,
  Job,
  JobEvent,
  LabelListEntry,
  LabelListResponse,
  LabelSaveRequest,
  LabelSaveResponse,
  ModelsResponse,
  Reference,
  SseStatus,
  SwitchRequest,
  SwitchResponse,
  SystemResponse,
  TrainJobType,
  TrainParams,
  TTSRequest,
} from "./types";

/**
 * 前后端统一接口。真实实现走 fetch + EventSource；
 * mock 实现在后端未就绪时提供完全相同的能力（含合成音频与假 job 事件流）。
 */
export interface ApiClient {
  readonly mode: "real" | "mock";

  health(signal?: AbortSignal): Promise<HealthResponse>;
  system(signal?: AbortSignal): Promise<SystemResponse>;
  models(signal?: AbortSignal): Promise<ModelsResponse>;
  switchModel(req: SwitchRequest, signal?: AbortSignal): Promise<SwitchResponse>;

  references(signal?: AbortSignal): Promise<Reference[]>;
  uploadReference(file: File, name?: string): Promise<Reference>;

  /** 非流式合成，解析为单个音频 Blob。 */
  tts(req: TTSRequest, signal?: AbortSignal): Promise<Blob>;
  /** 流式合成，返回可增量消费的字节流（audio/wav）。 */
  ttsStream(req: TTSRequest, signal?: AbortSignal): Promise<ReadableStream<Uint8Array> | null>;

  jobs(signal?: AbortSignal): Promise<Job[]>;
  createJob(type: string, params: Record<string, unknown>): Promise<Job>;
  /** 类型化封装：提交训练任务（train_s1 / train_s2 / train_s2_lora）。 */
  createTrainJob(type: TrainJobType, params: TrainParams): Promise<Job>;
  cancelJob(id: string): Promise<{ ok: boolean }>;

  getSettings(): Promise<AppSettings>;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;

  /** 列出可编辑的 `.list` 标注文件。 */
  labelLists(signal?: AbortSignal): Promise<LabelListEntry[]>;
  /** 读取单个标注文件的所有行。 */
  labelList(path: string, signal?: AbortSignal): Promise<LabelListResponse>;
  /** 覆盖保存标注文件，返回最终行数。 */
  saveLabelList(req: LabelSaveRequest, signal?: AbortSignal): Promise<LabelSaveResponse>;
  /** 构造某行音频的试听 URL（GET /api/label/audio?path=...）。 */
  labelAudioUrl(audioPath: string): string;

  /** 订阅 job 事件；jobId=null 表示全局。返回取消订阅函数。 */
  subscribe(
    jobId: string | null,
    onEvent: (event: JobEvent) => void,
    onStatus?: (status: SseStatus) => void,
  ): () => void;
}
