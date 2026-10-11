import { apiClient } from "@/lib/api";
import type { ApiClient } from "@/lib/api";

/** 返回真实后端客户端。 */
export function useApiClient(): ApiClient {
  return apiClient;
}
