"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { satoshi } from "@/components/brand/fonts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/brand/tooltip";

/** How anything copyable looks, everywhere in the app (user, 2026-09-27):
 *  a read-only field with its copy icon inside it and a Copy tooltip. Copies
 *  with the clipboard API and falls back to selecting the text and
 *  `execCommand`, and says so (icon → check, tooltip → "Copied") so a failed
 *  copy is never silent. */
export function CopyField({
  label,
  value,
  multiline,
  showLabel = true,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  /** Off where the screen's heading already says what the field is. */
  showLabel?: boolean;
}) {
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      const el = fieldRef.current;
      if (el) {
        el.focus();
        el.select();
        try {
          ok = document.execCommand("copy");
        } catch {
          ok = false;
        }
      }
    }
    setFailed(!ok);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 1500);
  }

  const fieldClass = `${satoshi.className} w-full min-w-0 rounded-[var(--login-button-radius)] border border-[#d9d9de] bg-white pl-3 pr-11 text-[0.8rem] text-[#1c1917]/80 outline-none`;
  return (
    <div className={`${satoshi.className} flex flex-col gap-1.5`}>
      {showLabel ? (
        <span className="text-[0.75rem] font-medium text-[#1c1917]/70">
          {label}
        </span>
      ) : null}
      <div className="relative">
        {multiline ? (
          <textarea
            ref={fieldRef}
            readOnly
            value={value}
            aria-label={label}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            className={`${fieldClass} resize-none py-2 leading-[1.4]`}
          />
        ) : (
          <input
            ref={fieldRef}
            readOnly
            value={value}
            aria-label={label}
            onFocus={(e) => e.currentTarget.select()}
            className={`${fieldClass} h-10`}
          />
        )}
        <TooltipProvider delay={0}>
          <Tooltip>
            <TooltipTrigger
              // Stays open on click so "Copied" is seen where the eye already is.
              closeOnClick={false}
              render={
                <button
                  type="button"
                  aria-label={copied ? `${label} copied` : `Copy ${label}`}
                  onClick={() => void copy()}
                  className="absolute top-1.5 right-1.5 flex size-8 cursor-pointer items-center justify-center rounded-[10px] text-[#1c1917]/70 outline-none hover:bg-black/5 hover:text-[#1c1917] focus-visible:outline-2 focus-visible:outline-[#1c1917] active:translate-y-px"
                />
              }
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {failed
                ? "Couldn’t copy. Select the text and copy it."
                : copied
                  ? "Copied"
                  : "Copy"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
