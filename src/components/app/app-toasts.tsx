"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Toast } from "@base-ui/react/toast";
import { useReducedMotion } from "framer-motion";
import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { CircleCheck, Info } from "lucide-react";

import { NAV_STROKE } from "@/components/app/icon";
import { bellCentre, flyIntoBell } from "@/components/app/notification-center";
import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";

/** Toasts (user 2026-09-29): only for **new Pending tasks** and **team
 *  changes about you** that arrive while the app is open. Never on load
 *  (the bell covers what was already waiting), never for your own actions,
 *  and several at once collapse into one. Raised from `UpdatesProvider`.
 *
 *  Base UI's Toast (already a dependency), drawn like the app's menus: white,
 *  16px corners. Top right under the topbar, above dialogs (500) and under
 *  tooltips (600).
 *
 *  Drawn like the Librarian's pills (`NotificationCard`) at Ronald's ask
 *  (2026-10-04): black glass, 22px corners, the icon in a white/12 circle
 *  (tick for `type: "success"`), a Söhne title over a dimmer line, a white
 *  button for an action, and a red minus on hover. 360px wide, the
 *  Librarian column's width, so the dot line stays on one line; a press
 *  elsewhere genies them into the bell like the pills. */
export function AppToastProvider({ children }: { children: React.ReactNode }) {
  // No timer: a toast stays until a press elsewhere genies it away, like
  // the Librarian's pills (Ronald 2026-10-04).
  return (
    <Toast.Provider timeout={0} limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed top-[4.5rem] right-4 z-[550] w-[calc(100vw-2rem)] sm:right-6 sm:w-[22.5rem]">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

/** Opens the Notifications dialog from anywhere (the topbar owns it). */
export const OPEN_NOTIFICATIONS_EVENT = "knohow:open-notifications";

/** The toasts' drop-in (`.app-toast`'s 0.5s transform), done before they're
 *  snapshotted for the genie. */
const TOASTS_IN_MS = 550;

function ToastList() {
  const { toasts, close } = Toast.useToastManager();
  const reduced = useReducedMotion();
  const showing = toasts.length > 0;
  /** Snapshots by toast id, taken once they've dropped in, so a press can
   *  start the genie at once (the Librarian pills do the same). */
  const shotsRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  /** Toasts on the genie's canvas, hidden on screen. */
  const [flying, setFlying] = useState<ReadonlySet<string>>(new Set());
  const flyingRef = useRef(false);

  const elementsOf = (ids?: string[]) =>
    [...document.querySelectorAll<HTMLElement>(".app-toast[data-toast-id]")].filter(
      (el) => !ids || ids.includes(el.dataset.toastId!),
    );

  const snapshot = useCallback(async (els: HTMLElement[]) => {
    const fontEmbedCSS = (await getFontEmbedCSS(els[0]).catch(() => "")) || undefined;
    const pixelRatio = window.devicePixelRatio || 1;
    // Drawn flat: the stack's offset and scale come from each rect instead.
    return Promise.all(
      els.map((el) => toCanvas(el, { pixelRatio, fontEmbedCSS, style: { transform: "none" } })),
    );
  }, []);

  const toastKey = toasts.map((t) => t.id).join();
  useEffect(() => {
    shotsRef.current = new Map();
    if (!toastKey || reduced) return;
    const timer = window.setTimeout(() => {
      const els = elementsOf();
      if (!els.length) return;
      snapshot(els)
        .then((shots) => {
          if (flyingRef.current) return;
          shotsRef.current = new Map(els.map((el, i) => [el.dataset.toastId!, shots[i]]));
        })
        .catch(() => {});
    }, TOASTS_IN_MS);
    return () => window.clearTimeout(timer);
  }, [toastKey, reduced, snapshot]);

  /** Genies these toasts (every one when `id` is left out) into the bell,
   *  as the Librarian's pills go (Ronald 2026-10-04). Reduced motion, or no
   *  bell, just closes them. */
  const genie = useCallback(
    async (id?: string) => {
      const shut = () => (id ? close(id) : close());
      if (flyingRef.current) return;
      const to = bellCentre();
      const els = elementsOf(id ? [id] : undefined);
      if (reduced || !to || !els.length) return shut();
      flyingRef.current = true;
      const ids = els.map((el) => el.dataset.toastId!);
      const rects = els.map((el) => el.getBoundingClientRect());
      let shots: HTMLCanvasElement[] | null = ids.map((i) => shotsRef.current.get(i)!);
      if (shots.some((shot) => !shot)) shots = await snapshot(els).catch(() => null);
      if (!shots) {
        flyingRef.current = false;
        return shut();
      }
      setFlying(new Set(ids));
      shut();
      flyIntoBell(
        shots.map((src, i) => ({ src, rect: rects[i] })),
        to,
        () => {
          flyingRef.current = false;
          setFlying(new Set());
        },
        550,
      );
    },
    [close, reduced, snapshot],
  );

  // A press anywhere but a toast genies them all; the press still reaches
  // what was pressed. A toast's own minus genies just that one.
  useEffect(() => {
    if (!showing) return;
    const listener = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest(".app-toast")) return;
      void genie();
    };
    document.addEventListener("pointerdown", listener, true);
    return () => document.removeEventListener("pointerdown", listener, true);
  }, [showing, genie]);

  return toasts.map((toast) => {
    const Icon = toast.type === "success" ? CircleCheck : Info;
    return (
      <Toast.Root
        key={toast.id}
        toast={toast}
        swipeDirection={["up", "right"]}
        data-toast-id={toast.id}
        className="app-toast group"
        style={flying.has(toast.id) ? { visibility: "hidden" } : undefined}
      >
        <Toast.Content
          className={`${satoshi.className} app-toast-content flex items-center gap-3 p-3 text-white`}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/12">
            <Icon aria-hidden size={20} strokeWidth={NAV_STROKE} />
          </span>
          <div className="min-w-0 flex-1">
            {toast.title ? (
              <Toast.Title
                className={`${sohne.className} m-0 text-[1rem] leading-[1.3] tracking-tight text-white`}
              />
            ) : null}
            {/* A div, not Base UI's <p>: a description can hold the dot
                line's avatars, which are divs. */}
            <Toast.Description
              render={<div />}
              className={
                toast.title
                  ? "m-0 text-[0.875rem] leading-[1.4] text-white/70"
                  : `${sohne.className} m-0 text-[1rem] leading-[1.3] tracking-tight text-white`
              }
            />
          </div>
          {toast.actionProps ? (
            <Toast.Action className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white px-3 text-[0.875rem] font-medium text-[#1c1917] transition-[background-color,translate] duration-150 outline-none hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:translate-y-px" />
          ) : null}
        </Toast.Content>
        {/* Notifications' red minus, not an X; it genies like a press
            elsewhere (Ronald 2026-10-04). */}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => void genie(toast.id)}
          className="absolute -top-1.5 -left-1.5 z-10 grid size-[18px] cursor-pointer place-items-center rounded-full bg-[#EA4335] opacity-0 transition-[opacity,background-color] duration-150 outline-none group-hover:opacity-100 hover:bg-[#d93025] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#EA4335]/40"
        >
          <span aria-hidden className="h-[2px] w-2 rounded-full bg-white" />
        </button>
      </Toast.Root>
    );
  });
}
