import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/store/theme";

export function Toaster(props: ToasterProps) {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group border border-border bg-card text-card-foreground shadow-xl shadow-black/40 rounded-lg",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
        },
      }}
      {...props}
    />
  );
}
