/** 通用格式化工具：时长 / 字节 / ETA / 相对时间 / 版本。 */

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatEta(seconds: number | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  if (seconds < 1) return "<1s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function formatRelativeTime(ts: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "刚刚";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(ts).toLocaleDateString();
}

export function formatClock(ts: number): string {
  if (!ts) return "--:--:--";
  return new Date(ts).toLocaleTimeString("zh-CN", { hour12: false });
}

/** 归一化权重版本：从路径/文件名推断 v1..v5turbo/v2ProPlus。 */
const VERSION_PATTERNS: Array<[RegExp, string]> = [
  [/v2proplus|v2pro_plus|v2pp/i, "v2ProPlus"],
  [/v2pro/i, "v2Pro"],
  [/v5turbo/i, "v5turbo"],
  [/v5dev/i, "v5dev"],
  [/v5/i, "v5turbo"],
  [/v4|s2Gv4|gsv-v4/i, "v4"],
  [/v3|s2Gv3|s1v3/i, "v3"],
  [/v2|gsv-v2final/i, "v2"],
  [/v1|s2G488k|25hz-2kh/i, "v1"],
];

export function inferVersion(text: string): string {
  for (const [re, name] of VERSION_PATTERNS) {
    if (re.test(text)) return name;
  }
  return "unknown";
}

export function formatVersion(version: string): string {
  if (!version || version === "unknown") return "未知";
  return version.toUpperCase();
}
