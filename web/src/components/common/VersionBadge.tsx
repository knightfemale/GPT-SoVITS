import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { versionLabel, type WeightVersion } from "@/lib/versions";

const VARIANT_BY_VERSION: Record<WeightVersion, "default" | "info" | "success" | "warning" | "danger" | "secondary" | "outline"> = {
  v1: "outline",
  v2: "secondary",
  v2Pro: "info",
  v2ProPlus: "info",
  v3: "success",
  v4: "success",
  v5: "default",
  v5dev: "warning",
  v5turbo: "default",
  unknown: "outline",
};

export function VersionBadge({ version, className }: { version: WeightVersion; className?: string }) {
  return (
    <Badge variant={VARIANT_BY_VERSION[version]} className={cn("font-mono", className)}>
      {versionLabel(version)}
    </Badge>
  );
}
