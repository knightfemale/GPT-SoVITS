import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { MiniPlayer } from "@/components/layout/MiniPlayer";
import { TaskDrawer } from "@/components/layout/TaskDrawer";

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // 路由切换时主内容区滚动归顶（侧栏/播放器固定不动）。
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr_auto] grid-cols-1 overflow-hidden bg-background text-foreground">
      <TopBar onOpenNav={() => setNavOpen(true)} />
      <div className="grid min-h-0 grid-cols-1 md:grid-cols-[auto_1fr]">
        <Sidebar />
        <main ref={mainRef} className="min-w-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-5">
            <Outlet />
          </div>
        </main>
      </div>
      <MiniPlayer />
      <TaskDrawer />
      <MobileNav open={navOpen} onOpenChange={setNavOpen} />
    </div>
  );
}

