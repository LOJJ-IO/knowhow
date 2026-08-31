import { cn } from "@/lib/utils";

/** Stacked-layer mark from the Knowhow deck, redrawn in CSS. */
function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("relative inline-block size-5", className)}
      aria-hidden="true"
    >
      <span className="absolute inset-x-0 top-0 h-2 rounded-[2px] bg-[oklch(0.65_0.19_255)]" />
      <span className="absolute inset-x-0 top-[35%] h-2 rounded-[2px] bg-[oklch(0.72_0.19_145)]" />
      <span className="absolute inset-x-0 top-[65%] h-2 rounded-[2px] bg-[oklch(0.68_0.19_35)]" />
    </span>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-semibold tracking-tight text-foreground", className)}>
      Kn
      <LogoMark />
      how
    </span>
  );
}

export { Logo, LogoMark };
