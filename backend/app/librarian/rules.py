"""The librarian's first layer: deterministic rules on Drive metadata
(ADR-0022, FEAT-drive-file-classification layer 1).

Pure functions over one file's metadata, so they can be tested without
Google. They **read** the metadata in memory and **return** only a
suggestion plus structured reason codes (counts), never a name, path or
address. That return value is all that is ever stored.

Rules (each one is a count, so the review screen can say *why*):

Company signals
- `coworkers_shared`: shared with people at the organization's domain.
- `domain_shared`: shared with the whole organization's domain.
- `edited_by_coworker`: last edited by someone else at the domain.

Personal signals
- `personal_contacts_shared`: shared only with personal mail accounts
  (gmail.com and similar) and nobody at the domain.

Both kinds present is a conflict and never picks a winner (rule 7): the
suggestion is `unsure` with both sets of reasons shown. Neither is `unsure`
with no reasons ("we don't have enough evidence").
"""

from dataclasses import dataclass, field

from app.models.librarian import LibrarianSuggestion

FREE_EMAIL_DOMAINS = frozenset(
    {"gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com"}
)

# Things the librarian doesn't sort: containers and pointers, not work.
SKIPPED_MIME_TYPES = frozenset(
    {"application/vnd.google-apps.folder", "application/vnd.google-apps.shortcut"}
)

# Asked of Drive per file. Nothing else is requested.
DRIVE_FIELDS = "id,mimeType,driveId,owners(me),lastModifyingUser(me,emailAddress),permissions(type,role,emailAddress,domain)"


@dataclass
class Verdict:
    suggestion: LibrarianSuggestion
    reasons: dict[str, int] = field(default_factory=dict)


def _domain(email: str | None) -> str:
    return email.rsplit("@", 1)[-1].lower() if email and "@" in email else ""


def classify(file: dict, org_domain: str) -> Verdict | None:
    """Returns None for files the librarian skips (folders, shortcuts,
    Shared Drive files, files the member doesn't own)."""
    if file.get("mimeType") in SKIPPED_MIME_TYPES:
        return None
    # Shared Drive files are the organization's in Google itself (rule 5)
    # and have no member owner; they aren't the librarian's to ask about.
    if file.get("driveId"):
        return None
    owners = file.get("owners") or []
    if owners and not any(o.get("me") for o in owners):
        return None

    org_domain = org_domain.lower()
    company: dict[str, int] = {}
    personal: dict[str, int] = {}

    coworkers = 0
    personal_contacts = 0
    for perm in file.get("permissions") or []:
        if perm.get("role") == "owner":
            continue  # the file's own owner says nothing about who it's for
        kind = perm.get("type")
        if kind == "domain" and (perm.get("domain") or "").lower() == org_domain:
            company["domain_shared"] = 1
        elif kind in ("user", "group"):
            email = perm.get("emailAddress")
            domain = _domain(email)
            if domain == org_domain:
                coworkers += 1
            elif domain in FREE_EMAIL_DOMAINS:
                personal_contacts += 1
    if coworkers:
        company["coworkers_shared"] = coworkers

    editor = file.get("lastModifyingUser") or {}
    if not editor.get("me") and _domain(editor.get("emailAddress")) == org_domain:
        company["edited_by_coworker"] = 1

    if personal_contacts and not coworkers and "domain_shared" not in company:
        personal["personal_contacts_shared"] = personal_contacts

    if company and personal:
        return Verdict(LibrarianSuggestion.UNSURE, {**company, **personal})
    if company:
        return Verdict(LibrarianSuggestion.COMPANY, company)
    if personal:
        return Verdict(LibrarianSuggestion.PERSONAL, personal)
    return Verdict(LibrarianSuggestion.UNSURE, {})


def contradicts(suggestion: LibrarianSuggestion, label: str) -> bool:
    """The owner's answer goes against a strong suggestion: ask once more
    before accepting it (decision table, AskAgain)."""
    return (suggestion == LibrarianSuggestion.COMPANY and label == "personal") or (
        suggestion == LibrarianSuggestion.PERSONAL and label == "company"
    )
