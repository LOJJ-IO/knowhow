import type { LabelHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-sm font-medium text-foreground select-none",
        className
      )}
      {...props}
    />
  );
}

export { Label };
