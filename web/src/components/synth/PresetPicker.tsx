import { Zap } from "lucide-react";
import { PRESETS } from "@/lib/tts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PresetPickerProps {
  activeId: string | null;
  onApply: (presetId: string) => void;
  disabled?: boolean;
}

export function PresetPicker({ activeId, onApply, disabled }: PresetPickerProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Zap className="size-3" /> 预设
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant={activeId === preset.id ? "default" : "outline"}
            size="sm"
            title={preset.hint}
            disabled={disabled}
            onClick={() => onApply(preset.id)}
            className={cn(activeId !== preset.id && "text-muted-foreground")}
          >
            {preset.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
