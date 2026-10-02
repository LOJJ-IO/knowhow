"""The librarian (ADR-0022): rules, the propose → confirm chain, folders, and
the privacy guarantees (no names stored before confirmation, Personal leaves
nothing behind)."""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal
from app.librarian import service
from app.librarian.rules import classify, contradicts
from app.models.file_index import FileIndex
from app.models.librarian import (
    FolderFile,
    KnohowFolder,
    LibrarianCandidate,
    LibrarianPersonalMark,
    LibrarianStatus,
    LibrarianSuggestion,
)
from app.models.org_chart import OrgChart
from app.models.org_member import AuthType, MemberStanding, OrgMember
from app.models.org_membership import OrgMembership, OrgRole
from app.models.organization import Organization
from app.models.team import Team

D = "acme.com"


def _perm(email, role="writer", kind="user"):
    return {"type": kind, "role": role, "emailAddress": email}


def _file(fid="f1", perms=(), editor_me=True, editor=None, mime="application/vnd.google-apps.document", **extra):
    return {
        "id": fid,
        "mimeType": mime,
        "owners": [{"me": True}],
        "lastModifyingUser": {"me": editor_me, "emailAddress": editor},
        "permissions": [_perm(f"me@{D}", role="owner"), *perms],
        **extra,
    }


# ------------------------------------------------------------------ rules


def test_shared_with_coworkers_suggests_company():
    v = classify(_file(perms=[_perm(f"a@{D}"), _perm(f"b@{D}")]), D)
    assert v.suggestion == LibrarianSuggestion.COMPANY
    assert v.reasons == {"coworkers_shared": 2}


def test_owner_permission_is_not_counted():
    v = classify(_file(), D)
    assert v.suggestion == LibrarianSuggestion.UNSURE and v.reasons == {}


def test_domain_share_and_coworker_edit_are_company_signals():
    v = classify(_file(perms=[{"type": "domain", "role": "reader", "domain": D}], editor_me=False, editor=f"x@{D}"), D)
    assert v.suggestion == LibrarianSuggestion.COMPANY
    assert v.reasons == {"domain_shared": 1, "edited_by_coworker": 1}


def test_only_personal_contacts_suggests_personal():
    v = classify(_file(perms=[_perm("mum@gmail.com")]), D)
    assert v.suggestion == LibrarianSuggestion.PERSONAL
    assert v.reasons == {"personal_contacts_shared": 1}


def test_conflicting_evidence_is_unsure_with_both_reasons():
    # Shared with a gmail friend, but last edited by a coworker: no winner.
    v = classify(_file(perms=[_perm("friend@gmail.com")], editor_me=False, editor=f"x@{D}"), D)
    assert v.suggestion == LibrarianSuggestion.UNSURE
    assert v.reasons == {"edited_by_coworker": 1, "personal_contacts_shared": 1}


def test_folders_shortcuts_and_shared_drive_files_are_skipped():
    assert classify(_file(mime="application/vnd.google-apps.folder"), D) is None
    assert classify(_file(mime="application/vnd.google-apps.shortcut"), D) is None
    assert classify(_file(driveId="shared-drive-1"), D) is None


def test_reasons_never_hold_names_or_addresses():
    v = classify(_file(perms=[_perm(f"a@{D}"), _perm("mum@gmail.com")], name="Divorce lawyer.pdf"), D)
    assert all(isinstance(value, int) for value in v.reasons.values())
    assert "Divorce" not in repr(v) and "gmail" not in repr(v)


def test_contradiction_rule():
    assert contradicts(LibrarianSuggestion.COMPANY, "personal")
    assert contradicts(LibrarianSuggestion.PERSONAL, "company")
    assert not contradicts(LibrarianSuggestion.UNSURE, "personal")
    assert not contradicts(LibrarianSuggestion.COMPANY, "company")


def test_workspace_files_are_always_company():
    from app.librarian.rules import classify_workspace

    # Shared only with a personal contact, or with nobody — still Company,
    # because a Workspace account's files are the org's (ADR-0023).
    assert classify_workspace(_file(perms=[_perm("mum@gmail.com")]), D).suggestion == LibrarianSuggestion.COMPANY
    assert classify_workspace(_file(), D).suggestion == LibrarianSuggestion.COMPANY
    # Company reasons are still kept as context.
    assert classify_workspace(_file(perms=[_perm(f"a@{D}")]), D).reasons == {"coworkers_shared": 1}
    # Same skips as classify.
    assert classify_workspace(_file(mime="application/vnd.google-apps.folder"), D) is None
    assert classify_workspace(_file(driveId="sd1"), D) is None


def test_collaborator_emails_are_org_domain_only():
    from app.librarian.rules import org_collaborator_emails

    f = _file(perms=[_perm(f"a@{D}"), _perm("mum@gmail.com")], editor_me=False, editor=f"b@{D}")
    assert set(org_collaborator_emails(f, D)) == {f"a@{D}", f"b@{D}"}
    # The owner permission and a `me` editor are never collaborators.
    assert org_collaborator_emails(_file(), D) == []


# ------------------------------------------------------------- the chain


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        session.execute(text("select 1 from alembic_version"))
    except OperationalError:
        pytest.skip("test database not reachable")
    tables = session.execute(
        text("select tablename from pg_tables where schemaname = 'public' and tablename != 'alembic_version'")
    ).scalars().all()
    session.execute(text(f"truncate {', '.join(tables)} restart identity cascade"))
    session.commit()
    try:
        yield session
    finally:
        session.close()


class _FakeDrive:
    """Just enough of the Drive client: files().list and files().get."""

    def __init__(self, files):
        self.files_by_id = {f["id"]: f for f in files}

    def files(self):
        return self

    def list(self, **_kw):
        items = list(self.files_by_id.values())
        return _Exec({"files": items})

    def get(self, fileId, fields):
        from googleapiclient.errors import HttpError

        f = self.files_by_id.get(fileId)
        if f is None:
            class _Resp(dict):
                status = 404
                reason = "not found"
            raise HttpError(_Resp(), b"not found")
        return _Exec({**f, "modifiedTime": "2026-09-20T10:00:00Z", "createdTime": "2026-09-01T10:00:00Z"})


class _Exec:
    def __init__(self, value):
        self.value = value

    def execute(self):
        return self.value


def _member(db, org, email, **kw):
    m = OrgMember(
        id=uuid.uuid4(),
        organization_id=org.id,
        email=email,
        display_name=email.split("@")[0].title(),
        auth_type=AuthType.DOMAIN_DELEGATED,
        standing=MemberStanding.APPROVED,
        **kw,
    )
    db.add(m)
    db.flush()
    return m


def _org(db):
    org = Organization(
        id=uuid.uuid4(), name="Acme", observed_domain=D, verified_domain=D,
        setup_step="done", setup_completed_at=datetime.now(timezone.utc),
    )
    db.add(org)
    db.flush()
    lead = _member(db, org, f"lead@{D}")
    worker = _member(db, org, f"worker@{D}")
    db.add(OrgChart(id=uuid.uuid4(), org_id=org.id, initiator_member_id=lead.id, owner_member_id=None))
    team = Team(id=uuid.uuid4(), org_id=org.id, name="Design", team_leader_id=lead.id)
    db.add(team)
    db.flush()
    db.add(OrgMembership(org_id=org.id, team_id=team.id, user_id=lead.id, role=OrgRole.TEAM_LEADER))
    db.add(OrgMembership(org_id=org.id, team_id=team.id, user_id=worker.id, role=OrgRole.MEMBER))
    db.commit()
    return org, lead, worker, team


@pytest.fixture
def drive(monkeypatch):
    files = [
        {**_file("work", perms=[_perm(f"lead@{D}")]), "name": "Q3 plan"},
        {**_file("holiday", perms=[_perm("mum@gmail.com")]), "name": "Holiday photos"},
        {**_file("draft"), "name": "Notes"},
    ]
    fake = _FakeDrive(files)
    monkeypatch.setattr(service, "get_drive_client_for_user", lambda *_a, **_k: fake)
    monkeypatch.setattr(service, "record_audit_entry", lambda **_k: None)
    return fake


def test_scan_stores_ids_and_counts_only(db, drive):
    org, _lead, worker, _team = _org(db)
    result = service.scan_member_drive(worker, db)
    assert result.suggested == 3

    rows = {c.file_id: c for c in db.execute(select(LibrarianCandidate)).scalars()}
    # Every Workspace file defaults to Company now (ADR-0023) — no more
    # personal/unsure guesses for an account the org already owns.
    assert rows["work"].suggestion == LibrarianSuggestion.COMPANY
    assert rows["holiday"].suggestion == LibrarianSuggestion.COMPANY
    assert rows["draft"].suggestion == LibrarianSuggestion.COMPANY
    # No names anywhere in what was stored.
    stored = repr([(c.file_id, c.reasons) for c in rows.values()])
    assert "Q3" not in stored and "Holiday" not in stored
    assert db.execute(select(FileIndex)).first() is None


def test_rescan_does_not_duplicate(db, drive):
    _org_, _lead, worker, _team = _org(db)
    service.scan_member_drive(worker, db)
    again = service.scan_member_drive(worker, db)
    assert again.suggested == 0 and again.already_known == 3


def test_review_titles_are_live_and_company_first(db, drive):
    _o, _lead, worker, _team = _org(db)
    service.scan_member_drive(worker, db)
    queue = service.review_queue(worker, db)
    assert [i["name"] for i in queue["items"]][0] == "Q3 plan"
    assert queue["total"] == 3


def test_personal_answer_leaves_no_trace_and_is_not_asked_again(db, drive):
    _o, _lead, worker, _team = _org(db)
    service.scan_member_drive(worker, db)
    holiday = db.execute(select(LibrarianCandidate).where(LibrarianCandidate.file_id == "holiday")).scalar_one()

    # A Workspace file defaults to Company (ADR-0023), so calling it personal
    # goes against the suggestion and is asked once more before it counts.
    assert service.decide(worker, holiday.id, "personal", False, db) == {"result": "ask_again"}
    assert service.decide(worker, holiday.id, "personal", True, db) == {"result": "personal"}
    assert db.execute(select(LibrarianCandidate).where(LibrarianCandidate.file_id == "holiday")).first() is None
    mark = db.execute(select(LibrarianPersonalMark)).scalar_one()
    assert "holiday" not in mark.file_hash

    service.scan_member_drive(worker, db)
    assert db.execute(select(LibrarianCandidate).where(LibrarianCandidate.file_id == "holiday")).first() is None


def test_answer_against_strong_suggestion_asks_again_once(db, drive):
    _o, _lead, worker, _team = _org(db)
    service.scan_member_drive(worker, db)
    work = db.execute(select(LibrarianCandidate).where(LibrarianCandidate.file_id == "work")).scalar_one()

    assert service.decide(worker, work.id, "personal", False, db) == {"result": "ask_again"}
    assert db.get(LibrarianCandidate, work.id).status == LibrarianStatus.SUGGESTED
    assert service.decide(worker, work.id, "personal", True, db) == {"result": "personal"}


def test_proposal_waits_for_lead_then_lands_in_team_folder(db, drive):
    org, lead, worker, team = _org(db)
    service.scan_member_drive(worker, db)
    work = db.execute(select(LibrarianCandidate).where(LibrarianCandidate.file_id == "work")).scalar_one()

    assert service.decide(worker, work.id, "company", False, db) == {"result": "proposed"}
    assert db.execute(select(FileIndex)).first() is None  # not company until confirmed

    # The proposer can't confirm their own file.
    assert service.proposals_for(worker, db)["items"] == []
    with pytest.raises(PermissionError):
        service.confirm(worker, work.id, db)

    queue = service.proposals_for(lead, db)
    assert [i["name"] for i in queue["items"]] == ["Q3 plan"]
    service.confirm(lead, work.id, db)

    row = db.get(FileIndex, "work")
    assert row.title == "Q3 plan" and row.team_id == team.id and row.owner_user_id == worker.id
    folder = db.execute(select(KnohowFolder).where(KnohowFolder.team_id == team.id)).scalar_one()
    assert folder.name == "Design"
    assert db.execute(select(FolderFile).where(FolderFile.folder_id == folder.id)).scalar_one().file_id == "work"

    listed = service.list_folders(worker, db)
    design = next(f for f in listed if f["team_id"] == str(team.id))
    assert design["file_count"] == 1 and design["preview"][0]["name"] == "Q3 plan"


def test_confirm_routes_to_the_collaborators_team(db, monkeypatch):
    """A file a Design member owns but shares with Sales lands in the Sales
    folder — routed by who it's shared with, not who proposed it (ADR-0023)."""
    org, lead, worker, design = _org(db)  # worker is on Design
    sales = Team(id=uuid.uuid4(), org_id=org.id, name="Sales", team_leader_id=None)
    db.add(sales)
    db.flush()
    seller = _member(db, org, f"seller@{D}")
    db.add(OrgMembership(org_id=org.id, team_id=sales.id, user_id=seller.id, role=OrgRole.MEMBER))
    db.commit()

    f = {**_file("deal", perms=[_perm(f"seller@{D}")]), "name": "Deal deck"}
    fake = _FakeDrive([f])
    monkeypatch.setattr(service, "get_drive_client_for_user", lambda *_a, **_k: fake)
    monkeypatch.setattr(service, "record_audit_entry", lambda **_k: None)

    service.scan_member_drive(worker, db)
    cand = db.execute(select(LibrarianCandidate).where(LibrarianCandidate.file_id == "deal")).scalar_one()
    assert service.decide(worker, cand.id, "company", False, db) == {"result": "proposed"}
    service.confirm(lead, cand.id, db)  # Design's lead confirms their member's file

    row = db.get(FileIndex, "deal")
    assert row.team_id == sales.id and row.owner_user_id == worker.id  # routed to Sales, not Design
    folder = db.execute(select(KnohowFolder).where(KnohowFolder.team_id == sales.id)).scalar_one()
    filed = set(db.execute(select(FolderFile.file_id).where(FolderFile.folder_id == folder.id)).scalars())
    assert filed == {"deal"}


def test_super_admin_confirms_own_proposal(db, drive):
    _o, lead, _worker, _team = _org(db)
    lead.super_admin_verified_at = datetime.now(timezone.utc)
    db.commit()
    service.scan_member_drive(lead, db)
    work = db.execute(select(LibrarianCandidate).where(LibrarianCandidate.file_id == "work")).scalar_one()
    assert service.decide(lead, work.id, "company", False, db) == {"result": "confirmed"}
    assert db.get(FileIndex, "work") is not None


def test_someone_outside_the_team_cannot_confirm(db, drive):
    org, _lead, worker, _team = _org(db)
    outsider = _member(db, org, f"outsider@{D}")
    db.commit()
    service.scan_member_drive(worker, db)
    work = db.execute(select(LibrarianCandidate).where(LibrarianCandidate.file_id == "work")).scalar_one()
    service.decide(worker, work.id, "company", False, db)
    assert service.proposals_for(outsider, db)["items"] == []
    with pytest.raises(PermissionError):
        service.confirm(outsider, work.id, db)


def test_custom_folders_and_team_folder_rules(db, drive):
    _o, lead, worker, team = _org(db)
    made = service.create_folder(worker, "  Launch  ", db)
    assert made["name"] == "Launch"
    team_folder = service._team_folder(team.org_id, team.id, db)
    db.commit()
    with pytest.raises(service.LibrarianError):
        service.delete_folder(lead, team_folder.id, db)
    with pytest.raises(PermissionError):
        service.delete_folder(lead, uuid.UUID(made["id"]), db)
    service.delete_folder(worker, uuid.UUID(made["id"]), db)
    assert all(f["id"] != made["id"] for f in service.list_folders(worker, db))


# ------------------------------------------------- import from personal Drive


class _PersonalDrive:
    """Records the share/unshare dance on the person's picked files."""

    def __init__(self, fail_copy=()):
        self.shared = []
        self.unshared = []

    def permissions(self):
        return self

    def create(self, fileId, body, sendNotificationEmail, fields):
        self.shared.append((fileId, body["emailAddress"]))
        return _Exec({"id": f"perm-{fileId}"})

    def delete(self, fileId, permissionId):
        self.unshared.append((fileId, permissionId))
        return _Exec({})


class _OrgCopyDrive:
    def __init__(self, fail=()):
        self.copied = []
        self.fail = set(fail)

    def files(self):
        return self

    def copy(self, fileId, fields):
        if fileId in self.fail:
            from googleapiclient.errors import HttpError

            class _R(dict):
                status = 403
                reason = "cannot copy"

            raise HttpError(_R(), b"nope")
        self.copied.append(fileId)
        return _Exec(
            {
                "id": f"copy-{fileId}",
                "name": f"Copy of {fileId}",
                "mimeType": "application/vnd.google-apps.document",
                "createdTime": "2026-09-01T10:00:00Z",
                "modifiedTime": "2026-09-20T10:00:00Z",
            }
        )


def test_import_personal_copies_into_org_and_leaves_original(db, monkeypatch):
    from app.librarian import import_personal as imp

    _o, _lead, worker, team = _org(db)
    personal = _PersonalDrive()
    orgdrive = _OrgCopyDrive()
    monkeypatch.setattr(imp, "build", lambda *a, **k: personal)
    monkeypatch.setattr(imp, "get_drive_client_for_user", lambda *a, **k: orgdrive)
    monkeypatch.setattr(imp, "record_audit_entry", lambda **k: None)

    result = imp.import_picked_files(worker, "tok-123", ["fileA", "fileB"], db)

    assert result.imported == ["copy-fileA", "copy-fileB"] and result.failed == []
    # Each original was shared with the importing member, then unshared.
    assert personal.shared == [("fileA", worker.email), ("fileB", worker.email)]
    assert personal.unshared == [("fileA", "perm-fileA"), ("fileB", "perm-fileB")]
    # The copies are org files owned by the importer, in the team folder.
    rowA = db.get(FileIndex, "copy-fileA")
    assert rowA.owner_user_id == worker.id and rowA.team_id == team.id
    folder = db.execute(select(KnohowFolder).where(KnohowFolder.team_id == team.id)).scalar_one()
    filed = set(db.execute(select(FolderFile.file_id).where(FolderFile.folder_id == folder.id)).scalars())
    assert filed == {"copy-fileA", "copy-fileB"}


def test_import_personal_skips_a_file_that_fails_to_copy(db, monkeypatch):
    from app.librarian import import_personal as imp

    _o, _lead, worker, _team = _org(db)
    personal = _PersonalDrive()
    orgdrive = _OrgCopyDrive(fail=["fileB"])
    monkeypatch.setattr(imp, "build", lambda *a, **k: personal)
    monkeypatch.setattr(imp, "get_drive_client_for_user", lambda *a, **k: orgdrive)
    monkeypatch.setattr(imp, "record_audit_entry", lambda **k: None)

    result = imp.import_picked_files(worker, "tok", ["fileA", "fileB"], db)

    assert result.imported == ["copy-fileA"] and result.failed == ["fileB"]
    # Even the failed file is unshared, so the member isn't left on the original.
    assert ("fileB", "perm-fileB") in personal.unshared
    assert db.get(FileIndex, "copy-fileB") is None


def test_import_personal_rejects_empty_and_oversize(db, monkeypatch):
    from app.librarian import import_personal as imp

    _o, _lead, worker, _team = _org(db)
    monkeypatch.setattr(imp, "build", lambda *a, **k: _PersonalDrive())
    monkeypatch.setattr(imp, "get_drive_client_for_user", lambda *a, **k: _OrgCopyDrive())
    with pytest.raises(imp.LibrarianError):
        imp.import_picked_files(worker, "tok", [], db)
    with pytest.raises(imp.LibrarianError):
        imp.import_picked_files(worker, "", ["x"], db)
    with pytest.raises(imp.LibrarianError):
        imp.import_picked_files(worker, "tok", [f"f{i}" for i in range(imp.MAX_IMPORT + 1)], db)


# ------------------------------------------------------- New button: create doc


class _CreateDrive:
    def __init__(self):
        self.created = []

    def files(self):
        return self

    def create(self, body, fields):
        self.created.append(body)
        return _Exec(
            {
                "id": f"new-{len(self.created)}",
                "name": body["name"],
                "mimeType": body["mimeType"],
                "webViewLink": f"https://docs.google.com/d/new-{len(self.created)}",
                "createdTime": "2026-09-29T10:00:00Z",
                "modifiedTime": "2026-09-29T10:00:00Z",
            }
        )


def test_create_document_makes_a_file_and_files_it(db, monkeypatch):
    from app.documents import service as docsvc

    _o, _lead, worker, team = _org(db)
    drive = _CreateDrive()
    monkeypatch.setattr(docsvc, "get_drive_client_for_user", lambda *a, **k: drive)
    monkeypatch.setattr(docsvc, "record_audit_entry", lambda **k: None)

    out = docsvc.create_document(worker, "sheet", db)

    assert drive.created == [{"name": "Untitled spreadsheet", "mimeType": "application/vnd.google-apps.spreadsheet"}]
    assert out["url"] == "https://docs.google.com/d/new-1" and out["name"] == "Untitled spreadsheet"
    row = db.get(FileIndex, out["id"])
    assert row.owner_user_id == worker.id and row.team_id == team.id
    folder = db.execute(select(KnohowFolder).where(KnohowFolder.team_id == team.id)).scalar_one()
    filed = set(db.execute(select(FolderFile.file_id).where(FolderFile.folder_id == folder.id)).scalars())
    assert out["id"] in filed


def test_create_document_rejects_unknown_kind(db, monkeypatch):
    from app.documents import service as docsvc

    _o, _lead, worker, _team = _org(db)
    monkeypatch.setattr(docsvc, "get_drive_client_for_user", lambda *a, **k: _CreateDrive())
    with pytest.raises(docsvc.LibrarianError):
        docsvc.create_document(worker, "form", db)
