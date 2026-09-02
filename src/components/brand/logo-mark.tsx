import { cn } from "@/lib/utils";

/** Stacked-layer mark from the Knowhow deck, redrawn in CSS: blue top face,
 * green/yellow middle band, red base — the Google Workspace palette. */
function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("relative inline-block size-5", className)}
      aria-hidden="true"
    >
      <span className="absolute inset-x-0 top-0 h-[38%] rounded-[3px] bg-gblue" />
      <span className="absolute top-[44%] left-0 h-[24%] w-[48%] rounded-l-xs bg-ggreen" />
      <span className="absolute top-[44%] right-0 h-[24%] w-[48%] rounded-r-xs bg-gyellow" />
      <span className="absolute inset-x-0 bottom-0 h-[24%] rounded-xs bg-gred" />
    </span>
  );
}

/** Wordmark inherits its text color, so it works on both the light auth card
 * (navy foreground) and the navy sidebar (white). */
function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-bold tracking-tight text-inherit", className)}>
      Kn
      <LogoMark />
      how
    </span>
  );
}

export { Logo, LogoMark };
