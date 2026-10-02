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


def _skipped(file: dict) -> bool:
    """The librarian doesn't sort these: containers, pointers, Shared Drive
    files (the organization's in Google itself, rule 5), or files the member
    doesn't own."""
    if file.get("mimeType") in SKIPPED_MIME_TYPES:
        return True
    if file.get("driveId"):
        return True
    owners = file.get("owners") or []
    return bool(owners) and not any(o.get("me") for o in owners)


def _evidence(file: dict, org_domain: str) -> tuple[dict[str, int], dict[str, int]]:
    """Company and personal reason counts from one file's sharing metadata."""
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
            domain = _domain(perm.get("emailAddress"))
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

    return company, personal


def classify(file: dict, org_domain: str) -> Verdict | None:
    """Company vs personal for a file whose ownership is genuinely in question
    — a **personal Gmail** account's Drive (ADR-0023). Returns None for files
    the librarian skips. Not used for Workspace accounts; see
    `classify_workspace`."""
    if _skipped(file):
        return None
    company, personal = _evidence(file, org_domain.lower())
    if company and personal:
        return Verdict(LibrarianSuggestion.UNSURE, {**company, **personal})
    if company:
        return Verdict(LibrarianSuggestion.COMPANY, company)
    if personal:
        return Verdict(LibrarianSuggestion.PERSONAL, personal)
    return Verdict(LibrarianSuggestion.UNSURE, {})


def classify_workspace(file: dict, org_domain: str) -> Verdict | None:
    """A file in a **Workspace** account is the organization's — Google makes
    the org its owner — so it is Company, with no company-vs-personal guess
    (ADR-0023). Skips the same non-files `classify` does. The company reason
    counts are kept as context for the review screen, never as a verdict."""
    if _skipped(file):
        return None
    company, _personal = _evidence(file, org_domain.lower())
    return Verdict(LibrarianSuggestion.COMPANY, company)


def org_collaborator_emails(file: dict, org_domain: str) -> list[str]:
    """The org-domain people a file is shared with or was last edited by, for
    routing a confirmed file to the team most of its collaborators are on
    (ADR-0023). Emails are mapped to teams in memory and never stored."""
    org_domain = org_domain.lower()
    emails: list[str] = []
    for perm in file.get("permissions") or []:
        if perm.get("role") == "owner":
            continue
        if perm.get("type") in ("user", "group"):
            email = (perm.get("emailAddress") or "").lower()
            if email and _domain(email) == org_domain:
                emails.append(email)
    editor = file.get("lastModifyingUser") or {}
    if not editor.get("me"):
        email = (editor.get("emailAddress") or "").lower()
        if email and _domain(email) == org_domain:
            emails.append(email)
    return emails


def contradicts(suggestion: LibrarianSuggestion, label: str) -> bool:
    """The owner's answer goes against a strong suggestion: ask once more
    before accepting it (decision table, AskAgain)."""
    return (suggestion == LibrarianSuggestion.COMPANY and label == "personal") or (
        suggestion == LibrarianSuggestion.PERSONAL and label == "company"
    )
