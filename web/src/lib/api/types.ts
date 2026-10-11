/**
 * webui-ng 前端类型（对齐 .slim/deepwork/gpt-sovits-webui-ng/api-contract.md，冻结契约）。
 * 后端未就绪时这些类型同时用于 mock 降级。
 */

export interface HealthResponse {
  status: string;
}

export interface GpuInfo {
  name?: string;
  index?: number;
  memoryTotal?: number;
  memoryFree?: number;
  driver?: string;
  [key: string]: unknown;
}

export interface SystemResponse {
  device: string;
  is_half: boolean;
  versions: string[];
  gpu?: GpuInfo | null;
}

export interface ModelEntry {
  path: string;
  name: string;
  version: string;
  mtime: number;
}

export interface ModelsResponse {
  sovits: ModelEntry[];
  gpt: ModelEntry[];
}

export interface SwitchRequest {
  sovits_path?: string;
  gpt_path?: string;
}

export interface SwitchResponse {
  ok: boolean;
  version?: string;
}

export interface Reference {
  id: string;
  name: string;
  /** 服务器端文件路径（用于 TTS 的 ref_audio_path）。 */
  path: string;
  peaks: number[];
  duration: number;
  lang?: string;
  text?: string;
  /**
   * 前端便利字段（非冻结契约）：可直接播放的音频 URL。
   * 后端未提供时由前端回退到 `/api/references/{id}/audio`；mock 下为本地生成的 blob URL。
   */
  audioUrl?: string;
}

export type MediaType = "wav" | "raw" | "ogg" | "aac";
export type StreamingMode = boolean | 0 | 1 | 2 | 3;

/** 与 api_v2.py 的 TTS_Request 字段一一对齐。 */
export interface TTSRequest {
  text: string;
  text_lang: string;
  ref_audio_path: string;
  aux_ref_audio_paths?: string[];
  prompt_text?: string;
  prompt_lang: string;
  top_k?: number;
  top_p?: number;
  temperature?: number;
  text_split_method?: string;
  batch_size?: number;
  speed_factor?: number;
  seed?: number;
  parallel_infer?: boolean;
  repetition_penalty?: number;
  sample_steps?: number;
  super_sampling?: boolean;
  streaming_mode?: StreamingMode;
  overlap_length?: number;
  min_chunk_length?: number;
  return_fragment?: boolean;
  media_type?: MediaType;
}

export type JobType =
  | "train_s1"
  | "train_s2"
  | "train_s2_lora"
  | "format"
  | "slice"
  | "uvr5"
  | "asr"
  | "denoise"
  | "label"
  | "tts";

export type JobStatus = "queued" | "running" | "done" | "failed" | "canceled";

export interface Job {
  id: string;
  type: JobType | string;
  status: JobStatus;
  stage?: string;
  stageIndex?: number;
  stageCount?: number;
  progress?: number;
  etaSec?: number;
  params?: Record<string, unknown>;
  error?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

/** ------------------------------------------------------------------ *
 * 训练任务（POST /api/jobs 的 type + params）。
 * 参数对齐经典 webui.py 训练表单，且与后端 `_JobParams` 同名。
 * ------------------------------------------------------------------ */

export type TrainJobType = "train_s1" | "train_s2" | "train_s2_lora";

/** s1（GPT 训练）参数，对齐后端 `TrainS1Params`（webui.py open1Bb 表单）。 */
export interface TrainS1Params {
  exp_name: string;
  version: string;
  batch_size: number;
  total_epoch: number;
  save_every_epoch: number;
  if_dpo: boolean;
  if_save_latest: boolean;
  if_save_every_weights: boolean;
  gpu_numbers: string;
  /** 底模 GPT 权重路径；留空由后端按 version 取默认。 */
  pretrained_s1?: string;
  /** 留空由后端取配置默认值。 */
  learning_rate?: number;
  is_half?: boolean;
}

/** s2 / s2_lora（SoVITS 训练）参数，对齐后端 `TrainS2Params` / `TrainS2LoraParams`。 */
export interface TrainS2Params {
  exp_name: string;
  version: string;
  batch_size: number;
  total_epoch: number;
  save_every_epoch: number;
  text_low_lr_rate: number;
  lora_rank: string;
  if_grad_ckpt: boolean;
  if_save_latest: boolean;
  if_save_every_weights: boolean;
  gpu_numbers: string;
  /** 底模 SoVITS G/D 权重路径；留空由后端按 version 取默认。 */
  pretrained_s2G?: string;
  pretrained_s2D?: string;
  /** 留空由后端取配置默认值。 */
  learning_rate?: number;
  is_half?: boolean;
}

export type TrainParams = TrainS1Params | TrainS2Params;

export type JobEventType =
  | "job.created"
  | "job.stage"
  | "job.progress"
  | "job.log"
  | "job.done"
  | "job.failed"
  | "job.canceled";

export interface JobLog {
  stream: "stdout" | "stderr" | string;
  text: string;
  ansi?: boolean;
}

export interface JobEvent {
  type: JobEventType;
  jobId: string;
  ts: number;
  stage?: string;
  stageIndex?: number;
  stageCount?: number;
  progress?: number;
  etaSec?: number;
  log?: JobLog;
}

export interface AppSettings {
  language: string;
  textLang: string;
  promptLang: string;
  device: string;
  isHalf: boolean;
  backendPort: number;
  theme: "dark" | "light";
  autoSwitchWeights: boolean;
}

export type SseStatus = "connecting" | "open" | "error" | "closed";

/** ------------------------------------------------------------------ *
 * `.list` 标注（每行 `audio_path|speaker|lang|text`）。
 * 对齐后端 label 端点：GET /api/label/lists、GET/PUT /api/label/list。
 * ------------------------------------------------------------------ */

/** 可用的标注文件条目。 */
export interface LabelListEntry {
  /** 绝对路径，作为后续读取/保存的主键。 */
  path: string;
  name: string;
  count: number;
}

/** 单条标注行；idx 仅用于前端定位，保存时不需要。 */
export interface LabelRow {
  idx: number;
  audio_path: string;
  speaker: string;
  lang: string;
  text: string;
}

export interface LabelListResponse {
  path: string;
  rows: LabelRow[];
}

/** PUT /api/label/list 请求体（去掉 idx）。 */
export interface LabelSaveRequest {
  path: string;
  rows: Array<Omit<LabelRow, "idx">>;
}

export interface LabelSaveResponse {
  ok: boolean;
  path: string;
  count: number;
}
