import type { ModelEntry } from "@/lib/api/types";

/** 规范化的版本标识。 */
export type WeightVersion =
  | "v1"
  | "v2"
  | "v2Pro"
  | "v2ProPlus"
  | "v3"
  | "v4"
  | "v5"
  | "v5dev"
  | "v5turbo"
  | "unknown";

const VERSION_PATTERNS: Array<[RegExp, WeightVersion]> = [
  [/(v2proplus|v2pro_plus|pro_plus)/i, "v2ProPlus"],
  [/(v2pro|v2_pro|_pro\b)/i, "v2Pro"],
  [/(v5turbo|v5_turbo|turbo)/i, "v5turbo"],
  [/(v5dev|v5_dev|dev)/i, "v5dev"],
  [/(v5|s2v5)/i, "v5"],
  [/(v4|s2v4)/i, "v4"],
  [/(v3|s2v3)/i, "v3"],
  [/(v2|s2v2)/i, "v2"],
  [/(v1|s2v1)/i, "v1"],
];

/** 从权重文件名 / 路径推断版本。 */
export function inferVersion(input: string): WeightVersion {
  const name = input.split(/[\\/]/).pop() ?? input;
  for (const [re, version] of VERSION_PATTERNS) {
    if (re.test(name)) return version;
  }
  return "unknown";
}

export function versionOf(entry: Pick<ModelEntry, "name" | "version" | "path">): WeightVersion {
  const fromField = entry.version ? normalizeVersion(entry.version) : "unknown";
  return fromField !== "unknown" ? fromField : inferVersion(entry.name || entry.path);
}

function normalizeVersion(raw: string): WeightVersion {
  const v = raw.trim().toLowerCase();
  const direct: Record<string, WeightVersion> = {
    v1: "v1",
    v2: "v2",
    v3: "v3",
    v4: "v4",
    v5: "v5",
    v5dev: "v5dev",
    v5turbo: "v5turbo",
    v2pro: "v2Pro",
    v2proplus: "v2ProPlus",
  };
  return direct[v] ?? inferVersion(raw);
}

/** 人类可读的版本徽标文本。 */
export function versionLabel(version: WeightVersion): string {
  const labels: Record<WeightVersion, string> = {
    v1: "v1",
    v2: "v2",
    v2Pro: "v2Pro",
    v2ProPlus: "v2Pro+",
    v3: "v3",
    v4: "v4",
    v5: "v5",
    v5dev: "v5dev",
    v5turbo: "v5-turbo",
    unknown: "未知",
  };
  return labels[version];
}

/**
 * 版本配对分组：同一分组内的 SoVITS / GPT 权重可互相配对。
 * 参考 config.py：v3 / v4 / v5 系列 / v2Pro 系列的 GPT 权重同为 `s1v3.ckpt` 家族。
 */
const FAMILY: Record<WeightVersion, string> = {
  v1: "s2v1",
  v2: "s2v2",
  v2Pro: "s2v2pro",
  v2ProPlus: "s2v2pro",
  v3: "s2v3+",
  v4: "s2v3+",
  v5: "s2v3+",
  v5dev: "s2v3+",
  v5turbo: "s2v3+",
  unknown: "unknown",
};

export interface PairingResult {
  ok: boolean;
  reason?: string;
}

/** 版本配对守卫：判断选定的一组权重是否兼容。 */
export function checkPairing(
  sovits: WeightVersion | null,
  gpt: WeightVersion | null,
): PairingResult {
  if (!sovits || !gpt) {
    return { ok: false, reason: "需同时选择 SoVITS 与 GPT 权重" };
  }
  if (sovits === "unknown" || gpt === "unknown") {
    return { ok: true, reason: "版本未知，交由后端校验" };
  }
  if (FAMILY[sovits] === FAMILY[gpt]) return { ok: true };
  return {
    ok: false,
    reason: `版本不匹配：SoVITS ${versionLabel(sovits)} 需搭配 ${versionLabel(gpt)} 风格的 GPT 权重`,
  };
}

export function partitionByVersion(entries: ModelEntry[]): Map<WeightVersion, ModelEntry[]> {
  const map = new Map<WeightVersion, ModelEntry[]>();
  for (const entry of entries) {
    const v = versionOf(entry);
    const list = map.get(v) ?? [];
    list.push(entry);
    map.set(v, list);
  }
  return map;
}
