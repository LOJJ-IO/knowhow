"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { satoshi } from "@/components/brand/fonts";
import { cn } from "@/lib/utils";

function CopyIcon({ copied }: { copied: boolean }) {
  return (
    <span className="relative flex size-4 shrink-0 items-center justify-center">
      <AnimatePresence mode="popLayout" initial={false}>
        {!copied ? (
          <motion.span
            key="copy"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 25 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Copy className="size-4" aria-hidden />
          </motion.span>
        ) : (
          <motion.span
            key="check"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 600, damping: 25 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Check className="size-4" aria-hidden />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** A read-only link with Copy sitting inside the same pill. Copying doesn't
 *  move the screen on; the screen's own Continue does that. */
export function SetupCopyLink({
  url,
  label,
}: {
  url: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  return (
    <div
      className={cn(
        satoshi.className,
        "flex h-12 w-full items-center gap-2 rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white p-1 pl-3 focus-within:border-[#1c1917]",
      )}
    >
      <input
        readOnly
        value={url}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className="h-full min-w-0 flex-1 truncate bg-transparent text-[0.85rem] text-[#1c1917]/70 outline-none"
      />
      <button
        type="button"
        onClick={() => {
          void (async () => {
            try {
              await navigator.clipboard.writeText(url);
            } catch {
              /* the URL is in the field to select */
            }
            setCopied(true);
          })();
        }}
        className="inline-flex h-full shrink-0 cursor-pointer items-center gap-2 rounded-[calc(var(--login-button-radius)-4px)] bg-black px-4 text-[0.95rem] font-bold tracking-tight text-white transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1917]"
      >
        <CopyIcon copied={copied} />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
