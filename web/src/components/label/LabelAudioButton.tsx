import { Pause, Play } from "lucide-react";
import { usePlayer } from "@/store/player";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LabelAudioButtonProps {
  /** 全局播放器用 id 去重（此处用音频路径）。 */
  id: string;
  title: string;
  subtitle?: string;
  src: string;
  disabled?: boolean;
}

/** 单行试听按钮：复用全局临时播放器，与参考音频卡片同一交互。 */
export function LabelAudioButton({ id, title, subtitle, src, disabled }: LabelAudioButtonProps) {
  const { track, playing, play, toggle } = usePlayer();
  const active = track?.id === id;
  const isPlaying = active && playing;

  return (
    <Button
      type="button"
      variant={isPlaying ? "default" : "secondary"}
      size="icon-sm"
      disabled={disabled}
      title={isPlaying ? "暂停" : "试听这一行"}
      aria-label={isPlaying ? "暂停试听" : "试听这一行"}
      className={cn("shrink-0", isPlaying && "animate-breathe")}
      onClick={() => (active ? toggle() : play({ id, title, subtitle, src }))}
    >
      {isPlaying ? <Pause /> : <Play />}
    </Button>
  );
}
