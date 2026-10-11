import type { SseStatus } from "@/lib/api/types";

export interface SseClientOptions {
  /** 相对或绝对 URL；会自动附加 last_event_id 查询参数以支持服务端重放。 */
  url: string;
  onEvent: (event: MessageEvent<string>) => void;
  onStatus?: (status: SseStatus) => void;
  withCredentials?: boolean;
  /** 是否在连接错误时自动重连（默认 true）。 */
  reconnect?: boolean;
}

export interface SseConnection {
  close: () => void;
  readonly lastEventId: string | null;
}

function withLastEventId(url: string, lastEventId: string | null): string {
  if (!lastEventId) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}last_event_id=${encodeURIComponent(lastEventId)}`;
}

/**
 * 轻量 SSE 客户端：自动重连 + Last-Event-ID 续传。
 *
 * 原生 EventSource 在自动重连时会带上 Last-Event-ID 头，但当我们需要主动
 * 重建连接（例如切换任务/退避）时只能通过 URL 传递，故这里额外拼接查询参数，
 * 由后端二选一读取（契约：`id:` 单调 + 每 job 环形缓冲重放）。
 */
export function connectSse(opts: SseClientOptions): SseConnection {
  const { url, onEvent, onStatus, withCredentials = false, reconnect = true } = opts;

  let source: EventSource | null = null;
  let closed = false;
  let attempt = 0;
  let lastEventId: string | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (s: SseStatus) => onStatus?.(s);

  const open = () => {
    if (closed) return;
    setStatus("connecting");
    source = new EventSource(withLastEventId(url, lastEventId), { withCredentials });

    source.onopen = () => {
      attempt = 0;
      setStatus("open");
    };

    source.onmessage = (event: MessageEvent<string>) => {
      if (event.lastEventId) lastEventId = event.lastEventId;
      // 心跳/空注释帧忽略
      if (event.data) onEvent(event);
    };

    source.onerror = () => {
      setStatus("error");
      source?.close();
      source = null;
      if (closed || !reconnect) {
        setStatus("closed");
        return;
      }
      // 指数退避 + 抖动
      const delay = Math.min(1000 * 2 ** attempt, 15000) + Math.random() * 400;
      attempt += 1;
      retryTimer = setTimeout(open, delay);
    };
  };

  open();

  return {
    close: () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
      source = null;
      setStatus("closed");
    },
    get lastEventId() {
      return lastEventId;
    },
  };
}
