import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex min-h-[72px] w-full rounded-2xl border-0 bg-muted px-4 py-3 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
