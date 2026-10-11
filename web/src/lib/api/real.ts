import { connectSse } from "@/lib/sse/client";
import type { ApiClient } from "./contract";
import { API_BASE, ApiError, http } from "./client";
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
  TTSRequest,
} from "./types";

async function postRaw(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
      credentials: "same-origin",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("无法连接到后端服务", 0, err);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(text || `${res.status} ${res.statusText}`, res.status, text);
  }
  return res;
}

export function createRealClient(): ApiClient {
  return {
    mode: "real",

    health: (signal) => http.get<HealthResponse>("/api/health", signal),
    system: (signal) => http.get<SystemResponse>("/api/system", signal),
    models: (signal) => http.get<ModelsResponse>("/api/models", signal),
    switchModel: (req: SwitchRequest, signal) =>
      http.post<SwitchResponse>("/api/models/switch", req, signal),

    references: (signal) => http.get<Reference[]>("/api/references", signal),
    uploadReference: async (file: File, opts?: { name?: string; text?: string; lang?: string }) => {
      const form = new FormData();
      form.append("file", file);
      if (opts?.name) form.append("name", opts.name);
      if (opts?.text) form.append("text", opts.text);
      if (opts?.lang) form.append("lang", opts.lang);
      return http.post<Reference>("/api/references", form);
      // 注意：http.post 对 formData 走 multipart（见 client.ts）
    },
    updateReference: (id: string, patch: { name?: string; text?: string; lang?: string }) =>
      http.patch<Reference>(`/api/references/${encodeURIComponent(id)}`, patch),
    deleteReference: (id: string) =>
      http.del<void>(`/api/references/${encodeURIComponent(id)}`),

    tts: async (req: TTSRequest, signal) => {
      const res = await postRaw("/api/tts", req, signal);
      return res.blob();
    },
    ttsStream: async (req: TTSRequest, signal) => {
      const res = await postRaw("/api/tts", req, signal);
      return res.body as ReadableStream<Uint8Array> | null;
    },

    jobs: (signal) => http.get<Job[]>("/api/jobs", signal),
    createJob: (type, params) => http.post<Job>("/api/jobs", { type, params }),
    createTrainJob: (type, params) => http.post<Job>("/api/jobs", { type, params }),
    cancelJob: (id) => http.post<{ ok: boolean }>(`/api/jobs/${encodeURIComponent(id)}/cancel`),

    getSettings: () => http.get<AppSettings>("/api/settings"),
    updateSettings: (patch) => http.put<AppSettings>("/api/settings", patch),

    labelLists: (signal) => http.get<LabelListEntry[]>("/api/label/lists", signal),
    labelList: (path, signal) =>
      http.get<LabelListResponse>(`/api/label/list?path=${encodeURIComponent(path)}`, signal),
    saveLabelList: (req: LabelSaveRequest, signal) =>
      http.put<LabelSaveResponse>("/api/label/list", req, signal),
    labelAudioUrl: (audioPath) => `${API_BASE}/api/label/audio?path=${encodeURIComponent(audioPath)}`,

    subscribe: (jobId, onEvent, onStatus) => {
      const url = jobId
        ? `${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/events`
        : `${API_BASE}/api/jobs/events`;
      const conn = connectSse({
        url,
        onStatus: (s: SseStatus) => onStatus?.(s),
        onEvent: (event) => {
          try {
            const parsed = JSON.parse(event.data) as JobEvent;
            onEvent(parsed);
          } catch {
            /* 忽略无法解析的事件 */
          }
        },
      });
      return () => conn.close();
    },
  };
}
