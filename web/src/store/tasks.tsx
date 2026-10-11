import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { JobEvent, SseStatus } from "@/lib/api/types";
import { useApiClient } from "@/hooks/useApi";
import { queryKeys } from "@/hooks/queries";

export interface JobLogEntry {
  id: number;
  jobId: string;
  ts: number;
  stream: string;
  text: string;
}

interface TasksContextValue {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  sseStatus: SseStatus;
  recentEvents: JobEvent[];
  logs: JobLogEntry[];
  clearLogs: (jobId?: string) => void;
}

const TasksContext = createContext<TasksContextValue | null>(null);

const MAX_EVENTS = 500;
const MAX_LOGS = 2000;

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sseStatus, setSseStatus] = useState<SseStatus>("connecting");
  const [recentEvents, setRecentEvents] = useState<JobEvent[]>([]);
  const [logs, setLogs] = useState<JobLogEntry[]>([]);
  const logSeq = useRef(0);

  useEffect(() => {
    const handle = api.subscribe(
      null,
      (event) => {
        setRecentEvents((prev) => [...prev.slice(-(MAX_EVENTS - 1)), event]);
        if (event.log) {
          const entry: JobLogEntry = {
            id: logSeq.current++,
            jobId: event.jobId,
            ts: event.ts,
            stream: event.log.stream,
            text: event.log.text,
          };
          setLogs((prev) => [...prev.slice(-(MAX_LOGS - 1)), entry]);
        }
        if (
          event.type === "job.created" ||
          event.type === "job.done" ||
          event.type === "job.failed" ||
          event.type === "job.canceled"
        ) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.jobs });
        }
      },
      setSseStatus,
    );
    return () => handle();
  }, [api, queryClient]);

  const clearLogs = useCallback((jobId?: string) => {
    setLogs((prev) => (jobId ? prev.filter((l) => l.jobId !== jobId) : []));
  }, []);

  const value = useMemo<TasksContextValue>(
    () => ({ drawerOpen, setDrawerOpen, sseStatus, recentEvents, logs, clearLogs }),
    [drawerOpen, sseStatus, recentEvents, logs, clearLogs],
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks 必须在 TasksProvider 内使用");
  return ctx;
}
