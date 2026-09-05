import localFont from "next/font/local";
import { cn } from "@/lib/utils";

export const sohne = localFont({
  src: "../../fonts/sohne/TestSohne-Dreiviertelfett.otf",
  weight: "700",
  style: "normal",
});

/** Three stacked hexagons (blue / green+yellow / red) in the Google
 * palette, overlapping so each tip nests into the plate below —
 * proportions and colors measured directly from the user's reference. */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 137"
      className={cn("inline-block size-5", className)}
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      <path
        d="M60,66 L120,90 L120,111 L60,137 L0,111 L0,90 Z"
        fill="#EA4335"
        stroke="none"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <path
        d="M60,33 L120,57 L120,78 L60,104 L0,78 L0,57 Z"
        fill="none"
        stroke="none"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <path d="M60,33 L0,57 L0,78 L60,104 Z" fill="#34A853" />
      <path d="M60,33 L120,57 L120,78 L60,104 Z" fill="#FBBC05" />
      <path
        d="M60,0 L120,24 L120,45 L60,71 L0,45 L0,24 Z"
        fill="#4285F4"
        stroke="none"
        strokeWidth="8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Wordmark inherits its text color, so it works on both the light auth card
 * (navy foreground) and the navy sidebar (white). */
function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(sohne.className, "inline-flex items-center gap-1 tracking-tight text-inherit", className)}
    >
      Kn
      <LogoMark />
      how
    </span>
  );
}

export { Logo, LogoMark };
