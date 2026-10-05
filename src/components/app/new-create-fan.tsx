"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** Fanned Forms · Sheets · Slides · Docs cluster for the topbar New control,
 *  all Google's product marks (`public/create/`). Forms took Upload's place
 *  2026-10-02 (Ronald), matching what the menu creates. */
export function NewCreateFan({ className }: { className?: string }) {
  // Plays the hover spread once when the page loads, the way the bell rings
  // when its count arrives (Ronald, 2026-10-04): out shortly after the page
  // shows, then back. Reduced motion skips it.
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const out = window.setTimeout(() => setIntro(true), INTRO_DELAY_MS);
    const back = window.setTimeout(() => setIntro(false), INTRO_DELAY_MS + INTRO_HOLD_MS);
    return () => {
      window.clearTimeout(out);
      window.clearTimeout(back);
    };
  }, []);

  return (
    <span
      aria-hidden
      data-intro={intro ? "" : undefined}
      className={cn("group/fan relative inline-flex h-[2.205rem] w-[4.9rem] shrink-0", className)}
    >
      {TILES.map((tile, i) => (
        <span
          key={tile.key}
          className="absolute top-1/2 size-[2.205rem]"
          style={{
            left: `${i * 15.68}px`,
            zIndex: i + 1,
            transform: `translateY(calc(-50% + ${tile.y}px)) rotate(${tile.rotate}deg)`,
            ["--spread-x" as string]: `${tile.spreadX}px`,
            ["--spread-r" as string]: `${tile.spreadR}deg`,
          }}
        >
          {/* Hover or open the New button and the marks push away from each
              other: each slides out from the fan's middle and tips further
              its own way, and grows (Ronald, 2026-10-04; they all used to
              tip left together). */}
          <Image
            src={tile.src}
            alt=""
            width={96}
            height={96}
            className="size-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.22)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:translate-x-(--spread-x) group-hover:rotate-(--spread-r) group-hover:scale-110 group-data-[popup-open]:translate-x-(--spread-x) group-data-[popup-open]:rotate-(--spread-r) group-data-[popup-open]:scale-110 group-data-[intro]/fan:translate-x-(--spread-x) group-data-[intro]/fan:rotate-(--spread-r) group-data-[intro]/fan:scale-110 motion-reduce:transition-none"
            priority
          />
        </span>
      ))}
    </span>
  );
}

const INTRO_DELAY_MS = 400;
const INTRO_HOLD_MS = 450;

const TILES: {
  key: string;
  src: string;
  rotate: number;
  y: number;
  /** Hover: how far it moves away from the fan's middle, and how much more
   *  it tips its own way. */
  spreadX: number;
  spreadR: number;
}[] = [
  { key: "form", src: "/create/forms.png", rotate: -14, y: 2.5, spreadX: -5, spreadR: -8 },
  { key: "sheet", src: "/create/sheets.png", rotate: -3, y: -3, spreadX: -2, spreadR: -4 },
  { key: "slide", src: "/create/slides.png", rotate: 3, y: -3, spreadX: 2, spreadR: 4 },
  { key: "doc", src: "/create/docs.png", rotate: 8, y: 2.5, spreadX: 5, spreadR: 8 },
];
