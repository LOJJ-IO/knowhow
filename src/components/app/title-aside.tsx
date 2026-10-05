"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { CircleHelp } from "lucide-react";

import { satoshi } from "@/components/brand/fonts";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/brand/tooltip";

/** Something a screen puts beside its name in the topbar (Ronald,
 *  2026-10-04: Workspace's `?`). The topbar owns the title, the screen owns
 *  what it knows, so the screen hands the node up through this slot. */
const SetAsideContext = createContext<(node: ReactNode) => void>(() => {});
const AsideContext = createContext<ReactNode>(null);

export function TitleAsideProvider({ children }: { children: ReactNode }) {
  const [aside, setAside] = useState<ReactNode>(null);
  return (
    <SetAsideContext.Provider value={setAside}>
      <AsideContext.Provider value={aside}>{children}</AsideContext.Provider>
    </SetAsideContext.Provider>
  );
}

/** What the current screen put beside the title, if anything. */
export function useTitleAside() {
  return useContext(AsideContext);
}

/** Renders nothing where it sits; shows `children` beside the topbar title
 *  while mounted. */
export function TitleAside({ children }: { children: ReactNode }) {
  const setAside = useContext(SetAsideContext);
  useLayoutEffect(() => {
    setAside(children);
    return () => setAside(null);
  }, [children, setAside]);
  return null;
}

/** A `?` that opens the app's tooltip on click (not hover) and keeps it up
 *  until you click away or press Escape (Ronald, 2026-10-04). */
export function TitleHelp({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip
      open={open}
      onOpenChange={(next, details) => {
        // Hover and focus don't open or close it; only the click does, and a
        // press outside or Escape puts it away.
        if (!next && (details.reason === "outside-press" || details.reason === "escape-key"))
          setOpen(false);
      }}
    >
      <TooltipTrigger
        closeOnClick={false}
        render={
          <button
            type="button"
            aria-label={label}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#44403c] transition-colors duration-150 hover:bg-black/5"
          />
        }
      >
        <CircleHelp size={20} strokeWidth={2} />
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className={`${satoshi.className} flex flex-col gap-1.5 py-2`}>
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
