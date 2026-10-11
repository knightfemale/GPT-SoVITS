import { API_BASE } from "@/lib/api";
import type { Reference } from "@/lib/api/types";

/** 解析参考音频的可播放 URL（优先 audioUrl，其次本地路径/远端端点）。 */
export function referenceAudioUrl(ref: Reference): string | null {
  if (ref.audioUrl) return ref.audioUrl;
  if (/^(blob:|data:|https?:)/i.test(ref.path)) return ref.path;
  return `${API_BASE}/references/${encodeURIComponent(ref.id)}/audio`;
}

export function isPlayable(ref: Reference): boolean {
  return referenceAudioUrl(ref) !== null;
}
