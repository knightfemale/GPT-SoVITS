import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/store/theme";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "dark", label: "深色", icon: Moon },
  { value: "light", label: "浅色", icon: Sun },
  { value: "system", label: "跟随系统", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface/50 p-0.5">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded transition-colors",
            theme === value
              ? "bg-card text-foreground shadow-sm ring-1 ring-primary/30"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
