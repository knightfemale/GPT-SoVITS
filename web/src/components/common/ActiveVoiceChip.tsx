import { Link } from "react-router-dom";
import { AudioWaveform, ChevronDown } from "lucide-react";
import { useVoice } from "@/store/voice";
import { useModels } from "@/hooks/queries";
import { versionOf, versionLabel } from "@/lib/versions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ActiveVoiceChip() {
  const { selection } = useVoice();
  const { data } = useModels();

  const sovits = data?.sovits.find((m) => m.path === selection.sovitsPath) ?? null;
  const gpt = data?.gpt.find((m) => m.path === selection.gptPath) ?? null;
  const version = sovits ? versionOf(sovits) : gpt ? versionOf(gpt) : "unknown";

  const title = selection.referenceName ?? sovits?.name ?? "未选择音色";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex h-8 max-w-[260px] items-center gap-2 rounded-full border border-border bg-surface/60 pl-1.5 pr-2.5 text-xs",
            "transition-colors hover:border-primary/40 hover:bg-surface",
          )}
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary">
            <AudioWaveform className="size-3" />
          </span>
          <span className="truncate font-medium text-foreground">{title}</span>
          {sovits && <Badge variant="outline" className="font-mono">{versionLabel(version)}</Badge>}
          <ChevronDown className="size-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>当前音色</DropdownMenuLabel>
        <div className="space-y-1 px-2 pb-2 text-xs">
          <Row label="参考音频" value={selection.referenceName ?? "未选择"} />
          <Row label="SoVITS" value={sovits?.name ?? "未选择"} />
          <Row label="GPT" value={gpt?.name ?? "未选择"} />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/voices">管理权重与音色</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/voices/references">参考音频库</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  );
}
