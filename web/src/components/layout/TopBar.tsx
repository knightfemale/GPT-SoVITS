import { Link } from "react-router-dom";
import { Activity, AudioWaveform, Cpu, Menu } from "lucide-react";
import { ActiveVoiceChip } from "@/components/common/ActiveVoiceChip";
import { LocaleSwitcher } from "@/components/common/LocaleSwitcher";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { SseStatusDot } from "@/components/common/SseStatusDot";
import { useSystem, useJobs } from "@/hooks/queries";
import { useTasks } from "@/store/tasks";
import { cn } from "@/lib/utils";

export function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const { data: system } = useSystem();
  const { data: jobs } = useJobs();
  const { setDrawerOpen, sseStatus } = useTasks();

  const active = jobs?.filter((j) => j.status === "running" || j.status === "queued").length ?? 0;

  return (
    <header className="flex h-12 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="打开导航"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        <Menu className="size-4" />
      </button>
      <Link to="/synthesize" className="flex items-center gap-2 pr-1">
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
          <AudioWaveform className="size-4" />
        </span>
        <span className="hidden font-display text-sm font-semibold tracking-tight sm:inline">
          GPT-SoVITS
          <span className="ml-1.5 font-mono text-[11px] font-normal text-muted-foreground">webui-ng</span>
        </span>
      </Link>

      <ActiveVoiceChip />

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-md border border-border bg-surface/40 px-2.5 py-1 text-[11px] text-muted-foreground lg:flex">
          <Cpu className="size-3.5" />
          <span className="font-mono text-foreground">{system?.device ?? "—"}</span>
          {system?.gpu?.memoryFree != null && system?.gpu?.memoryTotal != null && (
            <span className="font-mono">
              {Math.round(system.gpu.memoryFree / 1024)}/{Math.round(system.gpu.memoryTotal / 1024)} GB
            </span>
          )}
        </div>

        <div className="hidden sm:block">
          <SseStatusDot status={sseStatus} />
        </div>

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={cn(
            "relative inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface/50 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active > 0 && "border-primary/40 text-foreground",
          )}
          title="任务中心"
          aria-label={active > 0 ? `任务中心，${active} 个进行中` : "任务中心"}
        >
          <Activity className={cn("size-4", active > 0 && "text-primary")} />
          {active > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {active}
            </span>
          )}
        </button>

        <div className="hidden sm:block">
          <LocaleSwitcher />
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
