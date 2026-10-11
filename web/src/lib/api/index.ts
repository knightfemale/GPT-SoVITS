import type { ApiClient } from "./contract";
import { createRealClient } from "./real";

export type { ApiClient } from "./contract";
export * from "./types";

/** 单一真实后端客户端（已移除 mock 降级）。 */
export const apiClient: ApiClient = createRealClient();

export function getApiClient(): ApiClient {
  return apiClient;
}

export { ApiError, API_BASE } from "./client";
