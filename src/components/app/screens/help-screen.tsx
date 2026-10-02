"use client";

import { ChevronDown, LifeBuoy } from "lucide-react";

import { NAV_STROKE } from "@/components/app/icon";
import { Bar, Window } from "@/components/app/screen-kit";
import { useSession } from "@/components/app/session";
import { AppPage } from "@/components/app/shell";
import { satoshi } from "@/components/brand/fonts";
import { sohne } from "@/components/brand/logo-mark";

type Topic = { title: string; questions: [string, string][] };

const TOPICS: Topic[] = [
  {
    title: "Getting started",
    questions: [
      [
        "How does Knohow connect to Google?",
        "Your Google Workspace Super Admin approves Knohow once in Google Admin. After that, Knohow can see who owns which files and move ownership when you ask it to. Until then, anyone can connect their own Drive from Workspace.",
      ],
      [
        "Who can see what?",
        "Everyone sees files from their own teams, and leads also see the teams under theirs. The owner and top leaders see everything. A file marked Private is hidden from coworkers but not from leads.",
      ],
    ],
  },
  {
    title: "Workspace and your librarian",
    questions: [
      [
        "What does Sort my Drive do?",
        "Your librarian goes through the newest files you own and lists them as company work. You confirm each one, a lead confirms it too, and it lands in the right team folder. Your Drive itself is never reorganised.",
      ],
      [
        "Which folder does a file go in?",
        "The team most of its collaborators are on. If nobody else is on it, it goes to your own team.",
      ],
      [
        "What if a file is personal?",
        "Mark it personal. Knohow keeps only a fingerprint of it so it won't ask again, and nobody else ever sees it.",
      ],
    ],
  },
  {
    title: "Ownership",
    questions: [
      [
        "Why does ownership matter?",
        "In Google Drive a file belongs to whoever made it, so when they leave, their work can leave with them. Knohow keeps ownership with the company.",
      ],
      ["Can I undo a move?", "Yes. Every recent move on Ownership has Undo."],
      [
        "Why can't some files move?",
        "Google doesn't let ownership move from a personal Google account, like a contractor's Gmail, into your Workspace. Ask the owner to share the file with its new owner as an editor, or to make a copy.",
      ],
    ],
  },
  {
    title: "Sharing",
    questions: [
      [
        "Who gets access to a new file?",
        "Everyone on the team that made it, plus your top leaders, the moment it's created in Knohow. Files made outside Knohow come to you as a suggestion first.",
      ],
      [
        "What does “Ownership moves automatically” mean?",
        "When it's on, a team's new file is owned by the team straight away. When it's off, the move waits for someone to review it on Ownership.",
      ],
    ],
  },
  {
    title: "Offboarding",
    questions: [
      [
        "What happens when I offboard someone?",
        "Their files move to whoever you pick, they're taken off their teams, and if they led a team, that person takes over. Nothing is deleted.",
      ],
      [
        "Who can offboard people?",
        "The owner, a verified Super Admin, or the lead of the person's team.",
      ],
    ],
  },
  {
    title: "Privacy",
    questions: [
      [
        "What does Knohow keep?",
        "For company files: the name, type, owner, team and dates. Never what's inside. Search reads contents live from Google and keeps nothing.",
      ],
      [
        "Is every action recorded?",
        "Yes. Every ownership, sharing and team change is written to a log that can't be edited without it showing.",
      ],
    ],
  },
];

/** Help: how each part of Knohow works, in plain words. */
export function HelpScreen() {
  const { chrome } = useSession();
  return (
    <AppPage>
      <Window>
        <div className="p-8">
          <Bar
            icon={<LifeBuoy size={20} strokeWidth={NAV_STROKE} />}
            title="How Knohow works"
            body={`Short answers about each part of the app. Still stuck? Ask whoever set up ${chrome.name}.`}
          />
          <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(22rem,1fr))] gap-3">
            {TOPICS.map((topic) => (
              <section key={topic.title} className="rounded-[24px] border border-[var(--app-border)] p-5">
                <h2 className={`${sohne.className} text-[1rem] tracking-tight text-[#1c1917]`}>{topic.title}</h2>
                <div className="mt-3 flex flex-col">
                  {topic.questions.map(([q, a]) => (
                    <details
                      key={q}
                      className={`${satoshi.className} group border-t border-[var(--app-border)] first:border-t-0`}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-[0.9375rem] text-[#1c1917] outline-none focus-visible:underline [&::-webkit-details-marker]:hidden">
                        {q}
                        <ChevronDown
                          size={16}
                          strokeWidth={NAV_STROKE}
                          className="shrink-0 text-[var(--app-dim)] transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                        />
                      </summary>
                      <p className="pb-4 text-[0.875rem] leading-[1.6] text-[var(--app-dim)]">{a}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </Window>
    </AppPage>
  );
}
