import { NavLink } from "react-router-dom";
import {
  AudioLines,
  Dumbbell,
  Library,
  ListChecks,
  Settings,
  Sparkles,
  Tags,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSystem } from "@/hooks/queries";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const NAV: NavItem[] = [
  { to: "/synthesize", label: "合成", icon: Sparkles },
  { to: "/voices", label: "音色", icon: AudioLines, end: true },
  { to: "/voices/references", label: "参考音频", icon: Library },
  { to: "/label", label: "标注", icon: Tags },
  { to: "/train", label: "训练", icon: Dumbbell },
  { to: "/tools", label: "数据集", icon: Wrench },
  { to: "/jobs", label: "任务", icon: ListChecks },
  { to: "/settings", label: "设置", icon: Settings },
];

/** 导航列表：`showLabels` 为真时始终显示文字（移动抽屉），否则仅在 md+ 展开（侧栏）。 */
export function SidebarNav({
  showLabels = false,
  onNavigate,
  className,
}: {
  showLabels?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              showLabels ? "justify-start" : "justify-center md:justify-start",
              isActive && "bg-primary/10 text-foreground",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              />
              <Icon className="size-4 shrink-0" />
              <span className={cn(showLabels ? "inline" : "hidden md:inline")}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const { data } = useSystem();
  return (
    <aside className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-background/60 py-3 md:flex md:w-52 md:items-stretch md:px-2">
      <SidebarNav />
      <div className="mt-auto hidden rounded-md border border-border bg-surface/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground md:block">
        <div className="flex items-center justify-between gap-2">
          <span>设备</span>
          <span className="font-mono text-foreground">{data?.device ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>精度</span>
          <span className="font-mono text-foreground">{data?.is_half ? "fp16" : "fp32"}</span>
        </div>
      </div>
    </aside>
  );
}
