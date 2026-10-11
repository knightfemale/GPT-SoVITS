import { useEffect, useState } from "react";
import type { JobEvent, SseStatus } from "@/lib/api/types";
import { useApiClient } from "@/hooks/useApi";

/** 订阅单个任务的 SSE 事件流（自动重连 + Last-Event-ID）。 */
export function useJobEvents(jobId: string | null) {
  const api = useApiClient();
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [status, setStatus] = useState<SseStatus>("closed");

  useEffect(() => {
    if (!jobId) {
      setEvents([]);
      setStatus("closed");
      return;
    }
    setEvents([]);
    const unsubscribe = api.subscribe(jobId, (event) => setEvents((prev) => [...prev, event]), setStatus);
    return () => unsubscribe();
  }, [api, jobId]);

  return { events, status };
}
