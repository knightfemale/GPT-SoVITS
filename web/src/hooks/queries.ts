import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/hooks/useApi";

export const queryKeys = {
  health: ["health"] as const,
  system: ["system"] as const,
  models: ["models"] as const,
  references: ["references"] as const,
  jobs: ["jobs"] as const,
  settings: ["settings"] as const,
  labelLists: ["label", "lists"] as const,
  labelList: (path: string) => ["label", "list", path] as const,
};

export function useHealth() {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.health(),
    refetchInterval: 30_000,
  });
}

export function useSystem() {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.system,
    queryFn: () => api.system(),
    staleTime: 60_000,
  });
}

export function useModels() {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.models,
    queryFn: () => api.models(),
    staleTime: 30_000,
  });
}

export function useReferences() {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.references,
    queryFn: () => api.references(),
    staleTime: 30_000,
  });
}

export function useJobs() {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.jobs,
    queryFn: () => api.jobs(),
    refetchInterval: 5_000,
  });
}

export function useLabelLists() {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.labelLists,
    queryFn: () => api.labelLists(),
    staleTime: 30_000,
  });
}

export function useLabelList(path: string | null) {
  const api = useApiClient();
  return useQuery({
    queryKey: queryKeys.labelList(path ?? ""),
    queryFn: () => api.labelList(path as string),
    enabled: Boolean(path),
    staleTime: 10_000,
  });
}
