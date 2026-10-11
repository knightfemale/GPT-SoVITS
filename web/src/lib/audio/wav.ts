/** 将 AudioBuffer 编码为 16-bit PCM WAV Blob。 */
export function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const bufferSize = 44 + dataSize;
  const out = new ArrayBuffer(bufferSize);
  const view = new DataView(out);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([out], { type: "audio/wav" });
}

/** 解码任意可播放音频为 AudioBuffer。 */
export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) throw new Error("当前浏览器不支持 Web Audio");
  const ctx = new AudioCtx();
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    void ctx.close();
  }
}

/** 裁剪音频区间 [start, end]（秒），返回新的 WAV Blob。 */
export async function trimAudioBlob(blob: Blob, start: number, end: number): Promise<Blob> {
  const decoded = await decodeAudioBlob(blob);
  const from = Math.max(0, Math.floor(start * decoded.sampleRate));
  const to = Math.min(decoded.length, Math.ceil(end * decoded.sampleRate));
  const length = Math.max(1, to - from);
  const AudioCtx =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!AudioCtx) throw new Error("当前浏览器不支持 OfflineAudioContext");
  const offline = new AudioCtx(decoded.numberOfChannels, length, decoded.sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0, from / decoded.sampleRate, length / decoded.sampleRate);
  const rendered = await offline.startRendering();
  return encodeWav(rendered);
}

/** 生成降采样峰值数组（用于迷你波形）。 */
export function computePeaks(buffer: AudioBuffer, buckets = 160): number[] {
  const channel = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(channel.length / buckets));
  const peaks: number[] = [];
  for (let i = 0; i < channel.length; i += step) {
    let max = 0;
    for (let j = i; j < Math.min(i + step, channel.length); j++) {
      const v = Math.abs(channel[j]);
      if (v > max) max = v;
    }
    peaks.push(Math.min(1, max));
  }
  return peaks.length ? peaks : [0.1];
}
