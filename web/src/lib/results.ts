export interface SynthResult {
  id: string;
  text: string;
  url: string;
  duration: number;
  createdAt: number;
  mediaType: string;
  streamed: boolean;
}

let seq = 0;
export function newResultId(): string {
  seq += 1;
  return `res-${Date.now().toString(36)}-${seq}`;
}
