import type { MediaType, StreamingMode, TTSRequest } from "@/lib/api/types";

export interface LanguageOption {
  value: string;
  label: string;
}

/** 语言代码（与 api_v2.py 支持集合对齐：zh/en/ja/ko/yue/auto 等，含多语种）。 */
export const LANGUAGES: LanguageOption[] = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "yue", label: "粤语" },
  { value: "auto", label: "自动识别" },
  { value: "all_zh", label: "多语种·中文优先" },
  { value: "all_ja", label: "多语种·日语优先" },
  { value: "all_yue", label: "多语种·粤语优先" },
  { value: "all_ko", label: "多语种·韩语优先" },
];

export const TEXT_SPLIT_METHODS: Array<{ value: string; label: string }> = [
  { value: "cut0", label: "不切分" },
  { value: "cut1", label: "四句一切" },
  { value: "cut2", label: "五十字一切" },
  { value: "cut3", label: "中文句号切分" },
  { value: "cut4", label: "英文句号切分" },
  { value: "cut5", label: "按标点智能切分" },
];

export const MEDIA_TYPES: Array<{ value: MediaType; label: string }> = [
  { value: "wav", label: "WAV" },
  { value: "ogg", label: "OGG" },
  { value: "aac", label: "AAC" },
  { value: "raw", label: "RAW PCM" },
];

export const STREAMING_MODES: Array<{ value: StreamingMode; label: string; hint: string }> = [
  { value: 0, label: "关闭", hint: "一次性返回完整音频" },
  { value: 1, label: "按标点", hint: "按标点切分流式返回" },
  { value: 2, label: "逐步", hint: "以标点+逐步方式返回" },
  { value: 3, label: "连续", hint: "最低延迟，连续返回片段" },
];

/** 三档参数复杂度的默认可见性。 */
export type ParamTier = "basic" | "advanced" | "expert";

export const DEFAULT_TTS_PARAMS: TTSRequest = {
  text: "",
  text_lang: "zh",
  ref_audio_path: "",
  prompt_text: "",
  prompt_lang: "zh",
  top_k: 15,
  top_p: 1,
  temperature: 1,
  text_split_method: "cut5",
  batch_size: 1,
  speed_factor: 1,
  seed: -1,
  parallel_infer: true,
  repetition_penalty: 1.35,
  sample_steps: 32,
  super_sampling: false,
  streaming_mode: 0,
  overlap_length: 2,
  min_chunk_length: 16,
  media_type: "wav",
};

export interface Preset {
  id: string;
  name: string;
  hint: string;
  patch: Partial<TTSRequest>;
}

export const PRESETS: Preset[] = [
  {
    id: "fast",
    name: "快速预览",
    hint: "低采样步数、单批，适合快速试听",
    patch: { sample_steps: 8, batch_size: 1, parallel_infer: true, streaming_mode: 0, top_k: 15 },
  },
  {
    id: "balanced",
    name: "均衡",
    hint: "默认质量与速度平衡",
    patch: {
      sample_steps: 32,
      batch_size: 1,
      parallel_infer: true,
      temperature: 1,
      top_k: 15,
      top_p: 1,
    },
  },
  {
    id: "hifi",
    name: "高保真",
    hint: "高采样步数 + 超级采样，离线精修",
    patch: { sample_steps: 64, super_sampling: true, batch_size: 1, temperature: 0.8 },
  },
  {
    id: "stream",
    name: "实时流式",
    hint: "最低延迟，流式播放",
    patch: { streaming_mode: 3, text_split_method: "cut5", sample_steps: 16, batch_size: 1 },
  },
];

export function applyPreset(params: TTSRequest, presetId: string): TTSRequest {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) return params;
  return { ...params, ...preset.patch };
}
