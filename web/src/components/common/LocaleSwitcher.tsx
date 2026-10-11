import { Languages } from "lucide-react";
import { LANGUAGES } from "@/lib/tts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/store/settings";

export function LocaleSwitcher() {
  const { settings, update } = useSettings();
  return (
    <Select value={settings.language} onValueChange={(language) => update({ language })}>
      <SelectTrigger className="h-8 w-auto gap-1.5 border-border bg-surface/50 px-2 text-xs [&>span]:truncate">
        <Languages className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="min-w-36">
        {LANGUAGES.filter((l) => !l.value.startsWith("all_")).map((l) => (
          <SelectItem key={l.value} value={l.value}>
            {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
