import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import type { PairingResult } from "@/lib/versions";
import { cn } from "@/lib/utils";

interface PairingGuardProps {
  pairing: PairingResult;
  switching: boolean;
  error: string | null;
  className?: string;
}

export function PairingGuard({ pairing, switching, error, className }: PairingGuardProps) {
  if (switching) {
    return (
      <div className={cn("flex items-center gap-2 rounded-md border border-primary/30 bg-primary/8 px-3 py-2 text-xs text-foreground", className)}>
        <Loader2 className="size-3.5 animate-spin text-primary" />
        正在切换权重，期间已全局锁定合成与任务操作…
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive", className)}>
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (pairing.ok) {
    return (
      <div className={cn("flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-success", className)}>
        <CheckCircle2 className="size-3.5" />
        版本配对校验通过，可以应用切换
      </div>
    );
  }

  return (
    <div className={cn("flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning", className)}>
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{pairing.reason ?? "请选择版本匹配的 SoVITS / GPT 权重"}</span>
    </div>
  );
}
