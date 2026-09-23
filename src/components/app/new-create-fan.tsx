import Image from "next/image";

import { cn } from "@/lib/utils";

/** Fanned Docs · Sheets · Slides · Upload cluster for the topbar New control.
 *
 *  Docs/Sheets/Slides use Google's product marks (`public/create/`). Those PNGs
 *  already carry transparent padding around the mark — so Upload is drawn the
 *  same way (inset squircle in a matching box) rather than a plate that fills
 *  the tile edge-to-edge, which was reading ~1.5× larger. */
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
          {tile.src ? (
            <Image
              src={tile.src}
              alt=""
              width={96}
              height={96}
              className="size-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.22)]"
              priority
            />
          ) : (
            <UploadMark />
          )}
        </span>
      ))}
    </span>
  );
}

const TILES: {
  key: string;
  src?: string;
  rotate: number;
  y: number;
}[] = [
  { key: "upload", rotate: -14, y: 2.5 },
  { key: "sheet", src: "/create/sheets.png", rotate: -3, y: -3 },
  { key: "slide", src: "/create/slides.png", rotate: 3, y: -3 },
  { key: "doc", src: "/create/docs.png", rotate: 8, y: 2.5 },
];

/** Same footprint as the Google marks: padding around a rounded square so it
 *  doesn't look larger than Sheets/Slides next to it. */
function UploadMark() {
  return (
    <svg
      viewBox="0 0 48 48"
      width="100%"
      height="100%"
      className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.22)]"
      aria-hidden
    >
      <rect x="4" y="4" width="40" height="40" rx="9" fill="#5f6368" />
      <path
        d="M24 14v14M24 14l-5 5M24 14l5 5"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 32.5v4h17v-4"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
