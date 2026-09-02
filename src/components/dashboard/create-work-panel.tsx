"use client";

import { ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createDocument } from "@/app/(app)/dashboard/actions";
import { DocTypeIcon, type DocTypeKey } from "@/components/dashboard/doc-type-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TILES: { type: DocTypeKey; label: string }[] = [
  { type: "DOC", label: "New Google Doc" },
  { type: "SHEET", label: "New Google Sheet" },
  { type: "SLIDE", label: "New Google Slide" },
];

const MEMBER_SHARE_OPTIONS = [
  { value: "POLICY", label: "Auto — follow team sharing policy" },
  { value: "LEADER", label: "Team leader only" },
  { value: "OWNER", label: "Organization owner only" },
  { value: "PRIVATE", label: "Only me" },
];

const OWNER_SHARE_OPTIONS = [
  { value: "EVERYONE", label: "Everyone in the organization" },
  { value: "LEADER", label: "All team leaders" },
  { value: "PRIVATE", label: "Only me" },
];

type Receipt = { folder: string; sharedWith: string[]; title: string };

export function CreateWorkPanel({ isOwner }: { isOwner: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeType, setActiveType] = useState<DocTypeKey | null>(null);
  const [title, setTitle] = useState("");
  const shareOptions = isOwner ? OWNER_SHARE_OPTIONS : MEMBER_SHARE_OPTIONS;
  const [share, setShare] = useState(shareOptions[0].value);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  function submit() {
    if (!activeType) return;
    const formData = new FormData();
    formData.set("title", title);
    formData.set("type", activeType);
    formData.set("share", share);

    startTransition(async () => {
      setError(null);
      const result = await createDocument(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setReceipt({ folder: result.folder, sharedWith: result.sharedWith, title });
      setActiveType(null);
      setTitle("");
      setShare(shareOptions[0].value);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TILES.map((tile) => (
          <button
            key={tile.type}
            type="button"
            onClick={() => {
              setActiveType(activeType === tile.type ? null : tile.type);
              setReceipt(null);
            }}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors hover:bg-muted",
              activeType === tile.type ? "border-ring ring-2 ring-ring/30" : "border-border"
            )}
          >
            <DocTypeIcon type={tile.type} className="size-9 rounded-lg [&_svg]:size-5" />
            <span className="text-xs font-medium text-foreground">{tile.label}</span>
          </button>
        ))}
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center opacity-50">
          <span className="flex size-9 items-center justify-center rounded-lg bg-muted-foreground text-white">
            <ListChecks className="size-5" />
          </span>
          <span className="text-xs font-medium text-foreground">New Form/Other</span>
        </div>
      </div>

      {activeType ? (
        <form
          action={submit}
          className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="min-w-48 flex-1">
            <label htmlFor="new-doc-title" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Title
            </label>
            <Input
              id="new-doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                activeType === "DOC"
                  ? "e.g. Q4 Campaign Brief"
                  : activeType === "SHEET"
                    ? "e.g. Q4 Budget Tracker"
                    : "e.g. Q4 Kickoff Deck"
              }
              autoFocus
              required
            />
          </div>
          <div className="min-w-56">
            <label htmlFor="new-doc-share" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Share with
            </label>
            <select
              id="new-doc-share"
              value={share}
              onChange={(e) => setShare(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
            >
              {shareOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={pending || !title.trim()}>
            {pending ? "Creating…" : "Create"}
          </Button>
          {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
        </form>
      ) : null}

      {receipt ? (
        <div className="mt-3 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-foreground">
          <span className="font-medium">“{receipt.title}”</span> filed in{" "}
          <span className="font-medium">Drive › {receipt.folder}</span>
          {receipt.sharedWith.length > 0 ? (
            <> — auto-shared with {receipt.sharedWith.join(" and ")}.</>
          ) : (
            <> — not shared with anyone.</>
          )}
        </div>
      ) : null}
    </div>
  );
}
