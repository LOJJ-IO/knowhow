import Image from "next/image";

import { cn } from "@/lib/utils";

/** Fanned Forms · Sheets · Slides · Docs cluster for the topbar New control,
 *  all Google's product marks (`public/create/`). Forms took Upload's place
 *  2026-10-02 (Ronald), matching what the menu creates. */
export function NewCreateFan({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex h-[2.205rem] w-[4.9rem] shrink-0", className)}
    >
      {TILES.map((tile, i) => (
        <span
          key={tile.key}
          className="absolute top-1/2 size-[2.205rem]"
          style={{
            left: `${i * 15.68}px`,
            zIndex: i + 1,
            transform: `translateY(calc(-50% + ${tile.y}px)) rotate(${tile.rotate}deg)`,
          }}
        >
          {/* The lifetime dropdown's calendar move, on top of each tile's
              resting tilt: hover or open the New button and every mark tips
              and grows (Ronald, 2026-10-02). */}
          <Image
            src={tile.src}
            alt=""
            width={96}
            height={96}
            className="size-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.22)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-rotate-12 group-hover:scale-110 group-data-[popup-open]:-rotate-12 group-data-[popup-open]:scale-110 motion-reduce:transition-none"
            priority
          />
        </span>
      ))}
    </span>
  );
}

const TILES: {
  key: string;
  src: string;
  rotate: number;
  y: number;
}[] = [
  { key: "form", src: "/create/forms.png", rotate: -14, y: 2.5 },
  { key: "sheet", src: "/create/sheets.png", rotate: -3, y: -3 },
  { key: "slide", src: "/create/slides.png", rotate: 3, y: -3 },
  { key: "doc", src: "/create/docs.png", rotate: 8, y: 2.5 },
];
