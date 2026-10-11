/**
 * 训练表单领域逻辑：Tab 定义、版本族过滤、默认值、校验与参数构建。
 * 参数与后端 `_JobParams`（TrainS1Params / TrainS2Params）同名同义，
 * 提交走 `ApiClient.createTrainJob`（POST /api/jobs）。
 */

import type { TrainJobType, TrainParams, TrainS1Params, TrainS2Params } from "@/lib/api";

export interface TrainTab {
  type: TrainJobType;
  label: string;
  /** 侧栏/Tab 说明。 */
  hint: string;
}

export const TRAIN_TABS: TrainTab[] = [
  { type: "train_s1", label: "s1 · GPT", hint: "GPT 语言模型（s1）" },
  { type: "train_s2", label: "s2 · SoVITS", hint: "SoVITS 声学模型（s2）" },
  { type: "train_s2_lora", label: "s2 LoRA", hint: "SoVITS LoRA（v3/v4）" },
];

/**
 * 各训练族可用版本（对齐后端 `_V3V4SET`/`_PRO_SET` 与经典 webui 表单）：
 * - s1（GPT）：v1 / v2 / v3 / v4 / v2Pro / v2ProPlus
 * - s2（SoVITS 全量/微调）：v1 / v2 / v3 / v4 / v2Pro / v2ProPlus
 * - s2_lora：仅 LoRA（v3 / v4 / v5dev / v5turbo，即后端 `_V3V4SET`）
 */
export const TRAIN_VERSION_FAMILIES: Record<TrainJobType, readonly string[]> = {
  train_s1: ["v1", "v2", "v3", "v4", "v2Pro", "v2ProPlus"],
  train_s2: ["v1", "v2", "v3", "v4", "v2Pro", "v2ProPlus"],
  train_s2_lora: ["v3", "v4", "v5dev", "v5turbo"],
};

/** 按族过滤可用版本；与后端 /api/system 返回的 versions 求交（缺失时用族内全集）。 */
export function trainVersions(type: TrainJobType, systemVersions?: string[]): string[] {
  const family = TRAIN_VERSION_FAMILIES[type];
  if (!systemVersions || systemVersions.length === 0) return [...family];
  const available = new Set(systemVersions);
  const filtered = family.filter((v) => available.has(v));
  return filtered.length > 0 ? filtered : [...family];
}

/** Pro 系列（v2Pro / v2ProPlus）需要数据集携带 7-sv_cn 音色特征。 */
export function isProVersion(version: string): boolean {
  return version === "v2Pro" || version === "v2ProPlus";
}

export function trainTabLabel(type: TrainJobType): string {
  return TRAIN_TABS.find((t) => t.type === type)?.label ?? type;
}

/* ------------------------------------------------------------------ *
 * 受控表单状态（数值以字符串承接输入，构建时再解析）。
 * ------------------------------------------------------------------ */

export interface TrainFormState {
  exp_name: string;
  version: string;
  batch_size: string;
  total_epoch: string;
  save_every_epoch: string;
  learning_rate: string;
  if_dpo: boolean;
  if_grad_ckpt: boolean;
  lora_rank: string;
  text_low_lr_rate: string;
  gpu_numbers: string;
  pretrained_s1: string;
  pretrained_s2G: string;
  pretrained_s2D: string;
  if_save_latest: boolean;
  if_save_every_weights: boolean;
  is_half: boolean;
}

export function defaultTrainForm(type: TrainJobType): TrainFormState {
  const s1 = type === "train_s1";
  return {
    exp_name: "",
    version: s1 ? "v2" : type === "train_s2_lora" ? "v3" : "v2",
    batch_size: "1",
    total_epoch: s1 ? "15" : "8",
    save_every_epoch: s1 ? "5" : "1",
    learning_rate: "",
    if_dpo: false,
    if_grad_ckpt: false,
    lora_rank: "32",
    text_low_lr_rate: "0.4",
    gpu_numbers: "0",
    pretrained_s1: "",
    pretrained_s2G: "",
    pretrained_s2D: "",
    if_save_latest: true,
    if_save_every_weights: true,
    is_half: true,
  };
}

export type TrainFieldErrors = Partial<Record<keyof TrainFormState, string>>;

const INT_RE = /^\d+(,\d+)*$/;
/** GPU 编号列表：允许逗号或短横线分隔（如 `0`、`0,1`、`0-1`）。 */
const GPU_RE = /^\d+([,-]\d+)*$/;

/** 校验表单；返回逐字段错误（空对象表示通过）。 */
export function validateTrainForm(type: TrainJobType, f: TrainFormState): TrainFieldErrors {
  const errors: TrainFieldErrors = {};
  const asInt = (s: string) => {
    const n = Number(s);
    return Number.isInteger(n) ? n : NaN;
  };

  const name = f.exp_name.trim();
  if (!name) errors.exp_name = "请填写实验名称";
  else if (!/^[^\s/\\]+$/.test(name)) errors.exp_name = "不能包含空格或斜杠";

  const bs = asInt(f.batch_size);
  if (!(bs >= 1 && bs <= 64)) errors.batch_size = "需为 1–64 的整数";

  const te = asInt(f.total_epoch);
  if (!(te >= 1 && te <= 10000)) errors.total_epoch = "需为 1–10000 的整数";

  const se = asInt(f.save_every_epoch);
  if (!(se >= 1)) errors.save_every_epoch = "需为不小于 1 的整数";
  else if (Number.isInteger(te) && se > te) errors.save_every_epoch = "不能大于总轮数";

  if (f.learning_rate.trim()) {
    const lr = Number(f.learning_rate);
    if (!Number.isFinite(lr) || lr <= 0 || lr > 1) errors.learning_rate = "需为 0–1 之间的小数";
  }

  if (!GPU_RE.test(f.gpu_numbers.trim())) errors.gpu_numbers = "格式如 0、0,1 或 0-1";

  if (type !== "train_s1") {
    if (f.lora_rank.trim() && !INT_RE.test(f.lora_rank.trim())) errors.lora_rank = "格式如 32 或 8,16";
    if (f.text_low_lr_rate.trim()) {
      const r = Number(f.text_low_lr_rate);
      if (!Number.isFinite(r) || r < 0 || r > 1) errors.text_low_lr_rate = "需为 0–1 之间的小数";
    }
  }

  return errors;
}

export function hasTrainErrors(errors: TrainFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** 由表单状态构建提交给后端的 params（空字符串字段省略，交由后端取默认）。 */
export function buildTrainParams(type: TrainJobType, f: TrainFormState): TrainParams {
  const num = (s: string, fallback: number) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  };
  const optStr = (s: string) => (s.trim() ? s.trim() : undefined);
  const optNum = (s: string) => {
    const t = s.trim();
    if (!t) return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  };

  const common = {
    exp_name: f.exp_name.trim(),
    version: f.version,
    batch_size: Math.trunc(num(f.batch_size, 1)),
    total_epoch: Math.trunc(num(f.total_epoch, type === "train_s1" ? 15 : 8)),
    save_every_epoch: Math.trunc(num(f.save_every_epoch, type === "train_s1" ? 5 : 1)),
    if_save_latest: f.if_save_latest,
    if_save_every_weights: f.if_save_every_weights,
    gpu_numbers: f.gpu_numbers.trim() || "0",
    is_half: f.is_half,
    learning_rate: optNum(f.learning_rate),
  };

  if (type === "train_s1") {
    const params: TrainS1Params = {
      ...common,
      if_dpo: f.if_dpo,
      pretrained_s1: optStr(f.pretrained_s1),
    };
    return params;
  }

  const params: TrainS2Params = {
    ...common,
    if_grad_ckpt: f.if_grad_ckpt,
    lora_rank: f.lora_rank.trim() || "32",
    text_low_lr_rate: num(f.text_low_lr_rate, 0.4),
    pretrained_s2G: optStr(f.pretrained_s2G),
    pretrained_s2D: optStr(f.pretrained_s2D),
  };
  return params;
}
