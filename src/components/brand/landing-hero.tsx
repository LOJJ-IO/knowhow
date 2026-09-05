"use client";

import { useState } from "react";
import { LogoMark, sohne } from "@/components/brand/logo-mark";
import { Draggable } from "@/components/brand/draggable";

const LOGO_FONT_SIZE = "clamp(3.5rem,12.5vw,12.5rem)";

const DRAGGABLE_IDS = ["landing-logo-text", "landing-logo-mark", "landing-logo-tm"] as const;

function readCurrentConfig() {
  const config: Record<string, { x: number; y: number } | null> = {};
  for (const id of DRAGGABLE_IDS) {
    const saved = localStorage.getItem(`draggable:${id}`);
    config[id] = saved ? JSON.parse(saved) : null;
  }
  return config;
}

const EDITOR_ENABLED = process.env.NEXT_PUBLIC_LOGO_EDITOR_ENABLED === "true";

function LandingHero() {
  const [editMode, setEditMode] = useState<boolean>(() => {
    if (!EDITOR_ENABLED || typeof window === "undefined") return false;
    return localStorage.getItem("draggable:editMode") === "1";
  });
  const [configText, setConfigText] = useState<string | null>(null);

  function toggleEditMode() {
    setEditMode((v) => {
      const next = !v;
      localStorage.setItem("draggable:editMode", next ? "1" : "0");
      if (!next) setConfigText(null);
      return next;
    });
  }

  async function copyConfig() {
    const config = readCurrentConfig();
    const text = JSON.stringify(config, null, 2);
    setConfigText(text);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard permission denied — the text is still shown on-page to copy manually
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <video
        className="absolute inset-0 -z-10 size-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        poster="/hero/onboarding-loop-poster.jpg"
      >
        <source src="/hero/onboarding-loop.webm" type="video/webm" />
        <source src="/hero/onboarding-loop.mp4" type="video/mp4" />
      </video>

      <Draggable id="landing-logo-text" initial={{ x: 9.875, y: -10.21875 }} locked={!editMode}>
        <span
          className={`${sohne.className} inline-flex items-center gap-2 leading-none tracking-tight text-[#1c1917]`}
          style={{ fontSize: LOGO_FONT_SIZE }}
        >
          Kn
          <span className="inline-block w-[0.62em]" />
          how
        </span>
      </Draggable>

      <Draggable id="landing-logo-mark" initial={{ x: 241.3046875, y: -50.18359375 }} locked={!editMode}>
        <div style={{ fontSize: LOGO_FONT_SIZE }}>
          <LogoMark className="h-[0.71em] w-[0.62em]" />
        </div>
      </Draggable>

      <Draggable id="landing-logo-tm" initial={{ x: 696.19921875, y: -107.63671875 }} locked={!editMode}>
        <span
          className={`${sohne.className} leading-none tracking-tight text-[#1c1917]`}
          style={{ fontSize: LOGO_FONT_SIZE }}
        >
          <span className="text-[0.16em] leading-none">™</span>
        </span>
      </Draggable>

      {EDITOR_ENABLED && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
          {configText && (
            <pre className="max-w-sm overflow-auto rounded-lg bg-black/85 p-3 font-mono text-[11px] text-white">
              {configText}
            </pre>
          )}
          <div className="flex gap-2">
            {editMode && (
              <button
                type="button"
                onClick={copyConfig}
                className="rounded-full bg-black/80 px-4 py-2 text-sm text-white shadow"
              >
                Copy config
              </button>
            )}
            <button
              type="button"
              onClick={toggleEditMode}
              className="rounded-full bg-black/80 px-4 py-2 text-sm text-white shadow"
            >
              {editMode ? "Done editing" : "Edit positions"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { LandingHero };
