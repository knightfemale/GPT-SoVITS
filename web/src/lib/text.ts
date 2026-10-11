/** 文本分语段与切分工具。 */

export interface Segment {
  id: string;
  text: string;
  lang: string;
}

let counter = 0;
export function newSegment(text = "", lang = "zh"): Segment {
  counter += 1;
  return { id: `seg-${Date.now().toString(36)}-${counter}`, text, lang };
}

const SENTENCE_END = /([。！？!?；;\n]+)/;

/** 按句末标点把长文本切成若干语段，单段超长时按 maxLen 再切。 */
export function splitText(text: string, maxLen = 80): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const parts: string[] = [];
  for (const line of normalized.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const chunks = trimmed.split(SENTENCE_END).reduce<string[]>((acc, piece, idx, arr) => {
      if (idx % 2 === 0) {
        const punctuation = arr[idx + 1] ?? "";
        acc.push((piece + punctuation).trim());
      }
      return acc;
    }, []);
    for (const chunk of chunks) {
      if (!chunk) continue;
      if (chunk.length <= maxLen) parts.push(chunk);
      else for (let i = 0; i < chunk.length; i += maxLen) parts.push(chunk.slice(i, i + maxLen));
    }
  }
  return parts.filter(Boolean);
}

export function segmentsFromText(text: string, lang: string, maxLen = 80): Segment[] {
  const parts = splitText(text, maxLen);
  if (parts.length === 0) return [newSegment("", lang)];
  return parts.map((p) => newSegment(p, lang));
}

export function segmentsToText(segments: Segment[]): string {
  return segments.map((s) => s.text).join("");
}
