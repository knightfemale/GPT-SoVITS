import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={<Compass />}
        title="页面不存在"
        description="你访问的地址没有对应页面，返回合成工作台继续创作。"
        action={
          <Button asChild>
            <Link to="/synthesize">返回合成</Link>
          </Button>
        }
      />
    </div>
  );
}
