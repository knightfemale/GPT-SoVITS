/** 把 fetch 返回的字节流增量消费为一个 Blob，并回报进度。 */
export interface StreamConsumeOptions {
  onChunk?: (receivedBytes: number, chunk: Uint8Array) => void;
  onProgress?: (receivedBytes: number) => void;
  signal?: AbortSignal;
  /** 若提供 content-length，可用于估算进度（0-1）。 */
  totalBytes?: number;
}

export async function consumeStream(
  stream: ReadableStream<Uint8Array>,
  opts: StreamConsumeOptions = {},
): Promise<Blob> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let received = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (value) {
        parts.push(value);
        received += value.byteLength;
        opts.onChunk?.(received, value);
        opts.onProgress?.(received);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return new Blob(parts as BlobPart[], { type: "audio/wav" });
}
