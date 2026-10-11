import { useCallback, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  onFile: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  className?: string;
  hint?: string;
}

export function Dropzone({ onFile, accept = "audio/*", disabled, className, hint }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-surface/60",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <UploadCloud className="size-5 text-muted-foreground" />
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">点击选择</span> 或拖拽音频文件到此处
      </div>
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
