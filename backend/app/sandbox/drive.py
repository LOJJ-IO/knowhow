"""An in-memory stand-in for the Drive v3 client, for sandbox members only.

It answers the handful of calls the backend makes (files list/get/create/
copy/update, permissions list/create/delete, about, changes) from:
- the sandbox's `FileIndex` rows (company files: owner, team, title), and
- the fixture files in `app.sandbox.data` that live only in someone's Drive
  (the owner's unsorted files, proposals, suggested shares),
plus whatever was created or transferred since the last seed, kept in this
process. Nothing here ever calls Google."""

import json
import uuid
from datetime import datetime, timedelta, timezone

import httplib2
from googleapiclient.errors import HttpError
from sqlalchemy import select

from app.db import SessionLocal
from app.models.file_index import FileIndex
from app.models.org_member import OrgMember
from app.models.org_membership import OrgMembership
from app.sandbox import SANDBOX_ORG_ID
from app.sandbox.data import ALL_DRIVE_FILES, FILES, FORMER, FORMER_FILES, JOINERS, PEOPLE, drive_file_id

# Process-local state since the last seed (`reset_state` clears it).
_CREATED: dict[str, dict] = {}
_TRASHED: set[str] = set()
_OWNER_OVERRIDES: dict[str, str] = {}
# When the fixture files' clock starts; set by the seed.
_SEEDED_AT: list[datetime] = [datetime.now(timezone.utc)]

_NEW_FILE_LINKS = {
    "application/vnd.google-apps.document": "https://docs.new",
    "application/vnd.google-apps.spreadsheet": "https://sheets.new",
    "application/vnd.google-apps.presentation": "https://slides.new",
}

_CONTENT_BY_TITLE = {f.title: f.content for f in FILES + FORMER_FILES}
_EMAIL_BY_KEY = {p.key: p.email for p in PEOPLE + FORMER + [j for j, _ in JOINERS]}
_NAME_BY_EMAIL = {p.email: p.name for p in PEOPLE + FORMER + [j for j, _ in JOINERS]}


def reset_state(seeded_at: datetime) -> None:
    _CREATED.clear()
    _TRASHED.clear()
    _OWNER_OVERRIDES.clear()
    _SEEDED_AT[0] = seeded_at


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _not_found(file_id: str) -> HttpError:
    resp = httplib2.Response({"status": "404"})
    resp.reason = "Not Found"
    body = json.dumps({"error": {"code": 404, "message": f"File not found: {file_id}."}}).encode()
    return HttpError(resp, body)


class _Call:
    def __init__(self, fn):
        self._fn = fn

    def execute(self, *_args, **_kwargs):
        return self._fn()


def _perm(email: str, role: str) -> dict:
    return {
        "id": f"perm-{email}",
        "type": "user",
        "role": role,
        "emailAddress": email,
        "domain": email.rsplit("@", 1)[-1],
    }


class SandboxDrive:
    def __init__(self, email: str, display_name: str | None = None):
        self.email = email.lower()
        self.display_name = display_name or _NAME_BY_EMAIL.get(self.email, self.email)

    # ------------------------------------------------------------ catalogue

    def _catalogue(self) -> dict[str, dict]:
        """Every file in the sandbox, as Drive would describe it to this member."""
        out: dict[str, dict] = {}
        with SessionLocal() as db:
            members = db.execute(
                select(OrgMember).where(OrgMember.organization_id == SANDBOX_ORG_ID)
            ).scalars().all()
            email_of = {m.id: m.email.lower() for m in members}
            team_emails: dict[uuid.UUID, list[str]] = {}
            for team_id, user_id in db.execute(
                select(OrgMembership.team_id, OrgMembership.user_id).where(
                    OrgMembership.org_id == SANDBOX_ORG_ID, OrgMembership.team_id.is_not(None)
                )
            ).all():
                if user_id in email_of:
                    team_emails.setdefault(team_id, []).append(email_of[user_id])
            rows = db.execute(select(FileIndex).where(FileIndex.org_id == SANDBOX_ORG_ID)).scalars().all()

            for row in rows:
                owner = _OWNER_OVERRIDES.get(row.file_id) or email_of.get(row.owner_user_id, "")
                shared = set(team_emails.get(row.team_id, [])) if row.team_id else set()
                for member_id in (row.sharing_state or {}).get("shared_with_member_ids", []):
                    try:
                        shared.add(email_of[uuid.UUID(member_id)])
                    except (KeyError, ValueError):
                        pass
                out[row.file_id] = self._describe(
                    row.file_id,
                    row.title,
                    row.file_type,
                    owner,
                    shared - {owner},
                    created=row.created_at,
                    modified=row.modified_at,
                    content=_CONTENT_BY_TITLE.get(row.title, ""),
                    link=_CREATED.get(row.file_id, {}).get("webViewLink"),
                )

        seeded_at = _SEEDED_AT[0]
        for f in ALL_DRIVE_FILES:
            file_id = drive_file_id(f.key)
            if file_id in out:
                continue
            owner = _OWNER_OVERRIDES.get(file_id) or _EMAIL_BY_KEY[f.owner]
            modified = seeded_at - timedelta(days=f.modified_days_ago)
            out[file_id] = self._describe(
                file_id,
                f.title,
                f.mime,
                owner,
                {_EMAIL_BY_KEY[k] for k in f.shared_with} - {owner},
                created=modified - timedelta(days=3),
                modified=modified,
                content=f.content,
            )

        for file_id, created in _CREATED.items():
            if file_id not in out:
                out[file_id] = created

        return {k: v for k, v in out.items() if k not in _TRASHED}

    def _describe(
        self,
        file_id: str,
        name: str,
        mime: str,
        owner: str,
        shared: set[str],
        *,
        created: datetime,
        modified: datetime,
        content: str = "",
        link: str | None = None,
    ) -> dict:
        editor = owner
        return {
            "id": file_id,
            "name": name,
            "mimeType": mime,
            "createdTime": _iso(created),
            "modifiedTime": _iso(modified),
            "owners": [
                {"emailAddress": owner, "displayName": _NAME_BY_EMAIL.get(owner, owner), "me": owner == self.email}
            ],
            "lastModifyingUser": {
                "emailAddress": editor,
                "displayName": _NAME_BY_EMAIL.get(editor, editor),
                "me": editor == self.email,
            },
            "permissions": [_perm(owner, "owner"), *(_perm(e, "writer") for e in sorted(shared))],
            "webViewLink": link,
            "driveId": None,
            "trashed": False,
            "_content": content,
        }

    @staticmethod
    def _public(f: dict) -> dict:
        return {k: v for k, v in f.items() if not k.startswith("_")}

    def _can_see(self, f: dict) -> bool:
        return any(p.get("emailAddress") == self.email for p in f["permissions"])

    # ------------------------------------------------------------- Drive API

    def files(self):
        return self

    def permissions(self):
        return _Permissions(self)

    def about(self):
        return _About(self)

    def changes(self):
        return _Changes()

    def list(self, q: str = "", orderBy: str | None = None, pageSize: int = 100, **_kwargs):
        def run():
            files = list(self._catalogue().values())
            if "'me' in owners" in q:
                files = [f for f in files if f["owners"][0]["emailAddress"] == self.email]
            if "fullText contains '" in q:
                term = q.split("fullText contains '", 1)[1].rsplit("'", 1)[0]
                term = term.replace("\\'", "'").replace("\\\\", "\\").lower()
                files = [
                    f
                    for f in files
                    if self._can_see(f) and (term in f["name"].lower() or term in f["_content"].lower())
                ]
            files.sort(key=lambda f: f["modifiedTime"], reverse=True)
            return {"files": [self._public(f) for f in files[: max(pageSize, 1) * 10]]}

        return _Call(run)

    def get(self, fileId: str, **_kwargs):
        def run():
            f = self._catalogue().get(fileId)
            if f is None:
                raise _not_found(fileId)
            return self._public(f)

        return _Call(run)

    def create(self, body: dict | None = None, **_kwargs):
        body = body or {}

        def run():
            now = datetime.now(timezone.utc)
            mime = body.get("mimeType", "application/vnd.google-apps.document")
            file_id = f"acme-new-{uuid.uuid4().hex[:16]}"
            f = self._describe(
                file_id,
                body.get("name", "Untitled"),
                mime,
                self.email,
                set(),
                created=now,
                modified=now,
                link=_NEW_FILE_LINKS.get(mime),
            )
            _CREATED[file_id] = f
            return self._public(f)

        return _Call(run)

    def copy(self, fileId: str, body: dict | None = None, **_kwargs):
        def run():
            source = self._catalogue().get(fileId)
            if source is None:
                raise _not_found(fileId)
            return self.create({"name": (body or {}).get("name", source["name"]), "mimeType": source["mimeType"]}).execute()

        return _Call(run)

    def update(self, fileId: str, body: dict | None = None, **_kwargs):
        def run():
            if (body or {}).get("trashed"):
                _TRASHED.add(fileId)
                return {"id": fileId, "trashed": True}
            f = self._catalogue().get(fileId)
            if f is None:
                raise _not_found(fileId)
            return self._public(f)

        return _Call(run)


class _Permissions:
    def __init__(self, drive: SandboxDrive):
        self.drive = drive

    def list(self, fileId: str, **_kwargs):
        def run():
            f = self.drive._catalogue().get(fileId)
            if f is None:
                raise _not_found(fileId)
            return {"permissions": f["permissions"]}

        return _Call(run)

    def create(self, fileId: str, body: dict | None = None, transferOwnership: bool = False, **_kwargs):
        body = body or {}

        def run():
            email = (body.get("emailAddress") or "").lower()
            if body.get("role") == "owner" or transferOwnership:
                _OWNER_OVERRIDES[fileId] = email
            return {"id": f"perm-{email}"}

        return _Call(run)

    def delete(self, fileId: str, permissionId: str, **_kwargs):
        return _Call(lambda: {})


class _About:
    def __init__(self, drive: SandboxDrive):
        self.drive = drive

    def get(self, **_kwargs):
        return _Call(
            lambda: {"user": {"emailAddress": self.drive.email, "displayName": self.drive.display_name}}
        )


class _Changes:
    def getStartPageToken(self, **_kwargs):
        return _Call(lambda: {"startPageToken": "1"})

    def list(self, **_kwargs):
        return _Call(lambda: {"changes": [], "newStartPageToken": "1"})

    def watch(self, **_kwargs):
        return _Call(lambda: {"id": "sandbox", "resourceId": "sandbox", "expiration": "0"})
