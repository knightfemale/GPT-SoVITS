import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Reference } from "@/lib/api/types";
import { LANGUAGES } from "@/lib/tts";
import { useApiClient } from "@/hooks/useApi";
import { queryKeys } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReferenceTextDialogProps {
  reference: Reference | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (reference: Reference) => void;
}

/** 编辑参考音频的转写文本与语言；v3/v5 等模型合成时需要文本作为提示。 */
export function ReferenceTextDialog({
  reference,
  open,
  onOpenChange,
  onSaved,
}: ReferenceTextDialogProps) {
  const api = useApiClient();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [lang, setLang] = useState("auto");

  useEffect(() => {
    if (open) {
      setText(reference?.text ?? "");
      setLang(reference?.lang ?? "auto");
    }
  }, [open, reference]);

  const save = useMutation({
    mutationFn: () => {
      if (!reference) throw new Error("未选择参考音频");
      return api.updateReference(reference.id, { text, lang });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Reference[]>(queryKeys.references, (prev) =>
        (prev ?? []).map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
      );
      onSaved?.(updated);
      toast.success("已保存参考文本");
      onOpenChange(false);
    },
    onError: () => toast.error("保存失败"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>编辑参考文本</DialogTitle>
          <DialogDescription>
            填写这段参考音频对应的文字，尽量与音频内容一致。v3 / v4 / v5 等模型合成时会用它作为提示。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>参考文本</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="请输入参考音频里说出的文字…"
              rows={4}
            />
          </div>
          <div className="space-y-1.5">
            <Label>语言</Label>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "保存中…" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
