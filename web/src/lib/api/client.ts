import type {
  AppSettings,
  HealthResponse,
  Job,
  JobEvent,
  ModelsResponse,
  Reference,
  SwitchRequest,
  SwitchResponse,
  SystemResponse,
} from "./types";

/** 运行时 API 基础前缀；dev 由 Vite proxy 处理，prod 同源。 */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  /** 允许返回原始 Response（例如音频流）。 */
  raw?: boolean;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: unknown = undefined;
  let message = `${res.status} ${res.statusText}`;
  try {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await res.json();
      const detail =
        (body as { detail?: unknown; message?: unknown })?.detail ??
        (body as { message?: unknown })?.message;
      if (typeof detail === "string") message = detail;
    } else {
      const text = await res.text();
      if (text) {
        body = text;
        message = text.slice(0, 300);
      }
    }
  } catch {
    /* 忽略解析错误 */
  }
  return new ApiError(message, res.status, body);
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, formData, signal } = opts;
  const headers: Record<string, string> = {};
  let payload: BodyInit | undefined;

  if (formData) {
    payload = formData;
  } else if (body instanceof FormData) {
    // 直接传 FormData（multipart）时不能 JSON 序列化，也不设 Content-Type，
    // 由浏览器自动带上 multipart boundary。
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: payload,
      signal,
      credentials: "same-origin",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("无法连接到后端服务", 0, err);
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const http = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "POST", body, signal }),
  put: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "PUT", body, signal }),
  del: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, { method: "DELETE", signal }),
};

export type {
  AppSettings,
  HealthResponse,
  Job,
  JobEvent,
  ModelsResponse,
  Reference,
  SwitchRequest,
  SwitchResponse,
  SystemResponse,
};
