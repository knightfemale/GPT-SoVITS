import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Collapsible = CollapsiblePrimitive.Root;

export const CollapsibleTrigger = React.forwardRef<
  React.ComponentRef<typeof CollapsiblePrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger> & { hideChevron?: boolean }
>(({ className, children, hideChevron, ...props }, ref) => (
  <CollapsiblePrimitive.Trigger
    ref={ref}
    className={cn(
      "group flex w-full items-center justify-between gap-2 text-left transition-colors focus-visible:outline-none",
      className,
    )}
    {...props}
  >
    {children}
    {!hideChevron && (
      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
    )}
  </CollapsiblePrimitive.Trigger>
));
CollapsibleTrigger.displayName = "CollapsibleTrigger";

export const CollapsibleContent = React.forwardRef<
  React.ComponentRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <CollapsiblePrimitive.Content ref={ref} className="overflow-hidden" {...props}>
    <div className={cn("collapsible-anim pt-3", className)}>{children}</div>
  </CollapsiblePrimitive.Content>
));
CollapsibleContent.displayName = "CollapsibleContent";
