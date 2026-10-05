"use client";

import { Menu } from "@base-ui/react/menu";
import { FolderInput, FolderMinus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { FormDialog } from "@/components/app/dialog";
import { NAV_STROKE } from "@/components/app/icon";
import { MENU_ITEM, MENU_LAYER, MENU_POPUP } from "@/components/app/profile-menu";
import { satoshi } from "@/components/brand/fonts";
import { cn } from "@/lib/utils";

/** Where the menu opens: the point that was right-clicked, or an element
 *  (the keyboard's way in). */
export type MenuAnchor = Element | { getBoundingClientRect: () => DOMRect };

/** Where a right click's menu opens: at the cursor, or under the element
 *  when the keyboard's menu key sent it (no pointer position). */
export function menuAnchor(e: React.MouseEvent): MenuAnchor {
  const { clientX: x, clientY: y } = e;
  if (x === 0 && y === 0) return e.currentTarget;
  return { getBoundingClientRect: () => new DOMRect(x, y, 0, 0) };
}

/** What a right click on a file or folder opens (Ronald, 2026-10-04: right
 *  click, not left): Rename and Delete, each with its icon, at the cursor.
 *  A file in a folder also gets Remove from folder and Move to folder. One
 *  instance per screen. Someone who can't change it sees them greyed out. */
export function ItemMenu({
  anchor,
  canManage,
  onOpenChange,
  onRename,
  onDelete,
  onRemove,
  onMove,
}: {
  /** The right-clicked point or element; null closes the menu. */
  anchor: MenuAnchor | null;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onDelete: () => void;
  onRemove?: () => void;
  onMove?: () => void;
}) {
  return (
    <Menu.Root open={anchor !== null} onOpenChange={onOpenChange}>
      <Menu.Portal>
        <Menu.Positioner
          anchor={anchor}
          side="bottom"
          align="start"
          sideOffset={4}
          className={MENU_LAYER}
        >
          <Menu.Popup className={cn(satoshi.className, MENU_POPUP, "w-[13rem]")}>
            <Menu.Item disabled={!canManage} onClick={onRename} className={MENU_ITEM}>
              <Pencil size={18} strokeWidth={NAV_STROKE} />
              Rename
            </Menu.Item>
            {onMove ? (
              <Menu.Item onClick={onMove} className={MENU_ITEM}>
                <FolderInput size={18} strokeWidth={NAV_STROKE} />
                Move to folder
              </Menu.Item>
            ) : null}
            {onRemove ? (
              <Menu.Item onClick={onRemove} className={MENU_ITEM}>
                <FolderMinus size={18} strokeWidth={NAV_STROKE} />
                Remove from folder
              </Menu.Item>
            ) : null}
            <Menu.Item
              disabled={!canManage}
              onClick={onDelete}
              // Notifications' destructive red (Ronald, 2026-10-04).
              className={cn(MENU_ITEM, "text-[#EA4335] data-[highlighted]:text-[#EA4335]")}
            >
              <Trash2 size={18} strokeWidth={NAV_STROKE} />
              Delete
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

const INPUT_CLASS =
  "h-10 w-full rounded-[10px] border border-[var(--app-border)] bg-white px-3 text-[0.9375rem] text-[#1c1917] outline-none focus:border-[#1c1917]";

/** Rename's own dialog: the current name, selected, and Save. Mounted per
 *  rename (keyed by the caller) so it always opens on the current name. */
export function RenameDialog({
  title,
  name,
  maxLength,
  onClose,
  onRename,
}: {
  title: string;
  name: string;
  maxLength: number;
  onClose: () => void;
  onRename: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = value.trim();

  return (
    <FormDialog
      open
      size="sm"
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={title}
      submitLabel="Rename"
      busy={busy}
      disabled={!next || next === name}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onRename(next);
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className={`${satoshi.className} flex flex-col gap-1.5`}>
        <span className="text-[0.875rem] text-[#1c1917]">Name</span>
        <input
          autoFocus
          type="text"
          value={value}
          maxLength={maxLength}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setValue(e.target.value)}
          className={INPUT_CLASS}
        />
      </label>
      {error ? <p className={`${satoshi.className} mt-3 text-[0.875rem] text-[#EA4335]`}>{error}</p> : null}
    </FormDialog>
  );
}
