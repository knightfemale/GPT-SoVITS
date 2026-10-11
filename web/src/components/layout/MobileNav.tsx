import { AudioWaveform } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/Sidebar";

/** 移动端导航抽屉（< md 显示由 TopBar 汉堡触发）。 */
export function MobileNav({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="flex items-center gap-2 font-display text-sm">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary">
              <AudioWaveform className="size-3.5" />
            </span>
            GPT-SoVITS
          </SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto p-2">
          <SidebarNav showLabels onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
