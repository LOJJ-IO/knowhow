"use client";

import { Toast } from "@base-ui/react/toast";

import { satoshi } from "@/components/brand/fonts";

/** Toasts (user 2026-09-29): only for **new Pending tasks** and **team
 *  changes about you** that arrive while the app is open. Never on load
 *  (the bell covers what was already waiting), never for your own actions,
 *  and several at once collapse into one. Raised from `UpdatesProvider`.
 *
 *  Base UI's Toast (already a dependency), drawn like the app's menus: white,
 *  16px corners, the menu shadow. Bottom right, above dialogs (500) and
 *  under tooltips (600). */
export function AppToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider timeout={8000} limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-4 z-[550] w-[calc(100vw-2rem)] sm:right-6 sm:bottom-6 sm:w-[22rem]">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

/** Opens the Notifications dialog from anywhere (the topbar owns it). */
export const OPEN_NOTIFICATIONS_EVENT = "knohow:open-notifications";

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} className="app-toast">
      <Toast.Content
        className={`${satoshi.className} app-toast-content flex items-center gap-3 p-3 pl-4`}
      >
        <Toast.Description className="m-0 min-w-0 flex-1 text-[0.9375rem] leading-[1.4] text-[#1c1917]" />
        <Toast.Action className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--app-border)] bg-white px-3 text-[0.875rem] font-medium text-[#1c1917] transition-[border-color,translate] duration-150 outline-none hover:border-[#d9d9de] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1c1917] active:translate-y-px" />
      </Toast.Content>
    </Toast.Root>
  ));
}
