#!/usr/bin/env python3
"""PreInvocation hook: inject second-brain Current-Context into every model turn."""
from __future__ import annotations

import json
import os
import sys

MAX_CHARS = 14_000


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError:
        data = {}

    paths = data.get("workspacePaths") or []
    if paths:
        root = paths[0]
    else:
        # hooks.json cwd is .agents/ — repo root is parent
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

    ctx_path = os.path.join(root, "second-brain", "Current", "Current-Context.md")
    try:
        with open(ctx_path, encoding="utf-8") as f:
            body = f.read()
    except OSError as exc:
        body = f"(FAILED to read {ctx_path}: {exc})\nYou MUST still find and read second-brain/ before acting."

    if len(body) > MAX_CHARS:
        body = (
            body[:MAX_CHARS]
            + "\n\n…[truncated by second-brain PreInvocation hook — read the full file if you need more]…"
        )

    msg = (
        "SECOND-BRAIN IS MANDATORY MEMORY FOR KNOWHOW — not optional.\n"
        f"Vault root: {os.path.join(root, 'second-brain')}/\n"
        f"Entry file (injected below): {ctx_path}\n\n"
        "RULES:\n"
        "1. Treat the vault as more authoritative than chat memory.\n"
        "2. Before non-trivial work: use Current-Context; open matching ADR / Known-Issues / FEAT as needed.\n"
        "3. After any durable change (code, architecture, bug, feature, lesson, priority): "
        "WRITE BACK the same turn — Current-Context.md and any matching ADR / Known-Issues / "
        "Lessons-Learned / FEAT-*.md. Skill: update-second-brain.\n"
        "4. Do NOT end the turn until the vault matches what just became true "
        "(skip only pure Q&A with no durable facts).\n"
        "5. Link with [[Note-Name]]; keep YAML frontmatter; bump updated.\n\n"
        "=== second-brain/Current/Current-Context.md ===\n"
        f"{body}"
    )

    json.dump({"injectSteps": [{"ephemeralMessage": msg}]}, sys.stdout)


if __name__ == "__main__":
    main()
