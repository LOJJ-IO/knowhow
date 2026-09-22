"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { satoshi } from "@/components/brand/fonts";
import { cn } from "@/lib/utils";
import { CTA_CLASS } from "@/components/ui/tokens";

/** The invite-link screen's one action: Copy, with Copy → Check on click. */
export function SetupShareAction({
  onClick,
}: {
  onClick: () => boolean | void | Promise<boolean | void>;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-6 flex justify-end">
      <motion.button
        type="button"
        onClick={() => {
          void (async () => {
            const ok = await onClick();
            if (ok === false) return;
            setCopied(true);
          })();
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.96 }}
        className={cn(
          CTA_CLASS,
          satoshi.className,
          "gap-2.5 bg-black px-6",
        )}
      >
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
        <span className="text-[1rem] font-bold tracking-tight">
          {copied ? "Copied" : "Copy"}
        </span>
      </motion.button>
    </div>
  );
}
