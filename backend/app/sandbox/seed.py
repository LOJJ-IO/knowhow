"""Builds (or rebuilds) the sandbox organization from `app.sandbox.data`.

`ensure_seeded` reseeds when the sandbox is missing or older than
RESEED_AFTER, so its "recent" activity always reads as recent; `force`
rebuilds it now. Everything is written in one transaction."""

import re
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.audit.service import GENESIS_HASH, _canonical_content, _compute_entry_hash
from app.google.scopes import DOMAIN_DELEGATION_SCOPES
from app.librarian.rules import classify_workspace
from app.models.audit_log import AuditLogEntry
import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.db import Base
from app.models.delegation_grant import DelegationGrant, DelegationStatus
from app.models.file_index import FileIndex
from app.models.librarian import FolderFile, KnohowFolder, LibrarianCandidate, LibrarianStatus, LibrarianSuggestion
from app.models.org_chart import OrgChart
from app.models.org_member import AuthType, MemberStanding, OrgMember
from app.models.org_membership import OrgMembership, OrgRole
from app.models.organization import Organization
from app.models.person import Person
from app.models.suggested_share import SuggestedShare
from app.models.team import Team
from app.models.team_join_request import TeamJoinRequest, TeamJoinRequestStatus
from app.models.transfer_batch import (
    TransferBatch,
    TransferBatchItem,
    TransferBatchStatus,
    TransferBatchType,
    TransferEligibility,
    TransferItemStatus,
)
from app.models.unresolved_ownership import UnresolvedOwnership, UnresolvedOwnershipReason
from app.sandbox import SANDBOX_DOMAIN, SANDBOX_ORG_ID
from app.sandbox import drive as sandbox_drive
from app.sandbox.data import (
    CUSTOM_FOLDERS,
    FILES,
    FORMER,
    FORMER_FILES,
    JOINERS,
    OWNER_KEY,
    OWNER_UNSORTED,
    ORG_NAME,
    PEOPLE,
    PROPOSALS,
    SUGGESTED,
    TEAMS,
    drive_file_id,
)

RESEED_AFTER = timedelta(hours=12)


def _file_id(title: str) -> str:
    return "acme-file-" + re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")


def owner_member_id(db: Session) -> uuid.UUID | None:
    chart = db.execute(select(OrgChart).where(OrgChart.org_id == SANDBOX_ORG_ID)).scalar_one_or_none()
    return chart.owner_member_id if chart else None


def ensure_seeded(db: Session, force: bool = False) -> uuid.UUID:
    """The sandbox owner's member id, (re)seeding first when needed."""
    org = db.get(Organization, SANDBOX_ORG_ID)
    fresh = org is not None and datetime.now(timezone.utc) - org.created_at < RESEED_AFTER
    if fresh and not force:
        owner = owner_member_id(db)
        if owner is not None:
            return owner
    return seed(db)


# ------------------------------------------------------------------- wipe


def _wipe(db: Session) -> None:
    """Deletes every row that belongs to the sandbox, children first. No
    foreign key cascades in this schema, so the walk is explicit: any row
    pointing at the sandbox org, its members, teams, transfer batches or
    folders goes."""
    org_id = SANDBOX_ORG_ID
    member_ids = list(db.execute(select(OrgMember.id).where(OrgMember.organization_id == org_id)).scalars())
    person_ids = [
        p
        for p in db.execute(select(OrgMember.person_id).where(OrgMember.organization_id == org_id)).scalars()
        if p is not None
    ]
    owned = {
        "organizations": [org_id],
        "org_members": member_ids,
        "teams": list(db.execute(select(Team.id).where(Team.org_id == org_id)).scalars()),
        "transfer_batches": list(db.execute(select(TransferBatch.id).where(TransferBatch.org_id == org_id)).scalars()),
        "knohow_folders": list(db.execute(select(KnohowFolder.id).where(KnohowFolder.org_id == org_id)).scalars()),
    }
    # Leaders and charts point at members; clear those links before deleting.
    db.execute(Team.__table__.update().where(Team.org_id == org_id).values(team_leader_id=None, parent_team_id=None))
    db.flush()
    for table in reversed(Base.metadata.sorted_tables):
        if table.name in ("organizations", "people"):
            continue
        conditions = []
        for column in table.columns:
            for fk in column.foreign_keys:
                ids = owned.get(fk.column.table.name)
                if ids and fk.column.name == "id":
                    conditions.append(column.in_(ids))
        if table.name == "org_members":
            conditions = [table.c.organization_id == org_id]
        if conditions:
            from sqlalchemy import or_

            db.execute(table.delete().where(or_(*conditions)))
    db.execute(delete(Organization).where(Organization.id == org_id))
    if person_ids:
        db.execute(delete(Person).where(Person.id.in_(person_ids)))
    db.flush()


# ------------------------------------------------------------------- seed


def seed(db: Session) -> uuid.UUID:
    _wipe(db)
    now = datetime.now(timezone.utc)
    ago = lambda days: now - timedelta(days=days)  # noqa: E731

    org = Organization(
        id=SANDBOX_ORG_ID,
        name=ORG_NAME,
        observed_domain=None,
        verified_domain=None,
        auto_accept_workspace_members=True,
        setup_step="done",
        setup_completed_at=ago(400),
        created_at=now,
    )
    db.add(org)
    db.flush()

    # People ---------------------------------------------------------------
    members: dict[str, OrgMember] = {}

    def add_member(p, standing=MemberStanding.APPROVED) -> OrgMember:
        person = Person(id=uuid.uuid4(), display_name=p.name, created_at=ago(p.joined_days_ago))
        db.add(person)
        m = OrgMember(
            id=uuid.uuid4(),
            organization_id=SANDBOX_ORG_ID,
            person_id=person.id,
            email=p.email,
            display_name=p.name,
            auth_type=AuthType.PERSONAL_OAUTH if p.personal else AuthType.DOMAIN_DELEGATED,
            standing=standing,
            join_placement_completed_at=ago(p.joined_days_ago),
            created_at=ago(p.joined_days_ago),
        )
        db.add(m)
        members[p.key] = m
        return m

    for p in PEOPLE + FORMER:
        add_member(p)
    for p, _team in JOINERS:
        add_member(p, MemberStanding.AUTO_AFFILIATED)
    db.flush()

    owner = members[OWNER_KEY]
    owner.super_admin_verified_at = ago(399)
    # Last opened Home a day and a half ago, so the latest updates read as new.
    owner.dashboard_seen_at = ago(1.5)

    db.add(OrgChart(id=uuid.uuid4(), org_id=SANDBOX_ORG_ID, initiator_member_id=owner.id, owner_member_id=owner.id))
    db.add(
        DelegationGrant(
            id=uuid.uuid4(),
            organization_id=SANDBOX_ORG_ID,
            status=DelegationStatus.APPROVED,
            verified_domain=SANDBOX_DOMAIN,
            approving_admin_email=owner.email,
            approved_at=ago(399),
            granted_scopes=list(DOMAIN_DELEGATION_SCOPES),
        )
    )

    # Teams ----------------------------------------------------------------
    teams: dict[str, Team] = {}
    for key, name in TEAMS:
        lead = next(p for p in PEOPLE if p.team == key and p.lead)
        teams[key] = Team(
            id=uuid.uuid4(),
            org_id=SANDBOX_ORG_ID,
            name=name,
            team_leader_id=members[lead.key].id,
            # Marketing reviews ownership moves by hand; everyone else is automatic.
            auto_own_enabled=key != "marketing",
            created_at=ago(390),
        )
        db.add(teams[key])
    db.flush()

    db.add(OrgMembership(org_id=SANDBOX_ORG_ID, team_id=None, user_id=owner.id, role=OrgRole.TOP_LEADER, created_at=ago(400)))
    for p in PEOPLE:
        if p.team is None:
            continue
        db.add(
            OrgMembership(
                org_id=SANDBOX_ORG_ID,
                team_id=teams[p.team].id,
                user_id=members[p.key].id,
                role=OrgRole.TEAM_LEADER if p.lead else OrgRole.MEMBER,
                created_at=ago(p.joined_days_ago),
            )
        )
    for p, team_key in JOINERS:
        db.add(
            TeamJoinRequest(
                org_id=SANDBOX_ORG_ID,
                team_id=teams[team_key].id,
                member_id=members[p.key].id,
                status=TeamJoinRequestStatus.PENDING,
                created_at=ago(p.joined_days_ago + 0.1),
            )
        )

    # Company files + folders ----------------------------------------------
    folders: dict[str, KnohowFolder] = {}
    for key, name in TEAMS:
        folders[key] = KnohowFolder(org_id=SANDBOX_ORG_ID, team_id=teams[key].id, name=name, created_at=ago(390))
        db.add(folders[key])
    for name in CUSTOM_FOLDERS:
        folders[name] = KnohowFolder(org_id=SANDBOX_ORG_ID, team_id=None, name=name, created_at=ago(30))
        db.add(folders[name])
    db.flush()

    file_ids: dict[str, str] = {}
    for spec in FILES + FORMER_FILES:
        fid = _file_id(spec.title)
        file_ids[spec.title] = fid
        modified = ago(spec.modified_days_ago)
        db.add(
            FileIndex(
                file_id=fid,
                org_id=SANDBOX_ORG_ID,
                owner_user_id=members[spec.owner].id,
                team_id=teams[spec.team].id if spec.team else None,
                file_type=spec.mime,
                title=spec.title,
                created_at=modified - timedelta(days=12),
                modified_at=modified,
                sharing_state={"private": True} if spec.private else {},
                last_synced_at=now,
            )
        )
    db.flush()
    for spec in FILES + FORMER_FILES:
        fid = file_ids[spec.title]
        targets = ([folders[spec.team]] if spec.team else []) + [folders[n] for n in spec.folders]
        for folder in targets:
            db.add(FolderFile(folder_id=folder.id, file_id=fid, added_by=members[spec.owner].id))

    # The librarian --------------------------------------------------------
    sandbox_drive.reset_state(now)
    owner_drive = sandbox_drive.SandboxDrive(owner.email, owner.display_name)
    for f in OWNER_UNSORTED:
        described = owner_drive._describe(
            drive_file_id(f.key),
            f.title,
            f.mime,
            owner.email,
            {members[k].email for k in f.shared_with},
            created=ago(f.modified_days_ago + 3),
            modified=ago(f.modified_days_ago),
        )
        verdict = classify_workspace(described, SANDBOX_DOMAIN)
        db.add(
            LibrarianCandidate(
                org_id=SANDBOX_ORG_ID,
                member_id=owner.id,
                file_id=drive_file_id(f.key),
                suggestion=verdict.suggestion,
                reasons=verdict.reasons,
                status=LibrarianStatus.SUGGESTED,
                created_at=ago(f.modified_days_ago / 2),
            )
        )
    for f in PROPOSALS:
        proposer = members[f.owner]
        db.add(
            LibrarianCandidate(
                org_id=SANDBOX_ORG_ID,
                member_id=proposer.id,
                file_id=drive_file_id(f.key),
                suggestion=LibrarianSuggestion.COMPANY,
                reasons={"coworkers_shared": len(f.shared_with)} if f.shared_with else {},
                status=LibrarianStatus.PROPOSED,
                proposed_at=ago(f.modified_days_ago / 2),
                created_at=ago(f.modified_days_ago),
            )
        )

    # Sharing --------------------------------------------------------------
    for f, recipients in SUGGESTED:
        db.add(
            SuggestedShare(
                id=uuid.uuid4(),
                org_id=SANDBOX_ORG_ID,
                file_id=drive_file_id(f.key),
                creator_user_id=owner.id,
                proposed_recipients=[str(members[k].id) for k in recipients],
                detected_via="drive_activity",
                created_at=ago(f.modified_days_ago),
            )
        )

    # Ownership ------------------------------------------------------------
    moved = TransferBatch(
        id=uuid.uuid4(),
        org_id=SANDBOX_ORG_ID,
        batch_type=TransferBatchType.BULK,
        status=TransferBatchStatus.EXECUTED,
        created_by_member_id=members["ben"].id,
        reason="Pricing files to the Sales lead",
        created_at=ago(3.2),
        confirmed_at=ago(3),
        executed_at=ago(3),
    )
    planned = TransferBatch(
        id=uuid.uuid4(),
        org_id=SANDBOX_ORG_ID,
        batch_type=TransferBatchType.BULK,
        status=TransferBatchStatus.PLANNED,
        created_by_member_id=members["marcus"].id,
        reason="Engineering records to the team lead",
        created_at=ago(0.8),
    )
    db.add_all([moved, planned])
    db.flush()
    for title in ("Enterprise pricing sheet", "Discount approval matrix"):
        db.add(
            TransferBatchItem(
                id=uuid.uuid4(),
                batch_id=moved.id,
                file_id=file_ids[title],
                current_owner_member_id=members["isabella"].id,
                proposed_owner_member_id=members["ben"].id,
                eligibility=TransferEligibility.ELIGIBLE,
                status=TransferItemStatus.TRANSFERRED,
                created_at=ago(3.2),
            )
        )
    for title in ("Tech debt register", "Security review checklist", "Incident postmortem: Sept 14 outage"):
        db.add(
            TransferBatchItem(
                id=uuid.uuid4(),
                batch_id=planned.id,
                file_id=file_ids[title],
                current_owner_member_id=members["ethan"].id,
                proposed_owner_member_id=members["marcus"].id,
                eligibility=TransferEligibility.ELIGIBLE,
                status=TransferItemStatus.PENDING,
                created_at=ago(0.8),
            )
        )
    for title in ("Icon set v2 spec", "Pricing page wireframes"):
        db.add(
            UnresolvedOwnership(
                id=uuid.uuid4(),
                org_id=SANDBOX_ORG_ID,
                file_id=file_ids[title],
                current_owner_member_id=members["riley"].id,
                intended_recipient_member_id=members["maya"].id,
                reason=UnresolvedOwnershipReason.PERSONAL_ACCOUNT_OWNER,
                detail=(
                    f"'{title}' is owned by a personal Google account. Google doesn't let ownership "
                    "move from a personal account into Acme's Workspace."
                ),
                created_at=ago(4),
            )
        )

    db.flush()
    _history(db, members, teams, file_ids, moved, planned, now)
    db.commit()
    return owner.id


# ---------------------------------------------------------------- history


def _history(db, members, teams, file_ids, moved, planned, now) -> None:
    """Backdated audit entries, oldest first, chained exactly as
    `record_audit_entry` would chain them."""
    m = lambda k: str(members[k].id)  # noqa: E731
    t = lambda k: str(teams[k].id)  # noqa: E731
    f = lambda title: file_ids[title]  # noqa: E731

    events: list[tuple[float, str | None, str, str | None, dict]] = [
        # days ago, actor, action, target, details
        (9.0, m("ben"), "offboard.completed", m("sam"),
         {"transfer_to_user_id": m("ben"), "files_affected": 2, "unresolved_count": 0}),
        (9.0, m("ben"), "offboard.file.ownership_transferred", f("Fabrikam account plan"),
         {"file_name": "Fabrikam account plan", "detail": None}),
        (9.0, m("ben"), "offboard.file.ownership_transferred", f("Q3 forecast (Sam)"),
         {"file_name": "Q3 forecast (Sam)", "detail": None}),
        (9.0, m("alex"), "org_chart.member_offboarded", m("sam"),
         {"transfer_to_user_id": m("ben"), "teams_led_reassigned": [], "teams_left_leaderless": []}),
        (6.0, m("alex"), "org_chart.team.leader_assigned", t("finance"),
         {"new_leader_id": m("daniel"), "team_id": t("finance")}),
        (5.0, m("olivia"), "org_chart.membership.upserted", m("chloe"),
         {"user_id": m("chloe"), "team_id": t("marketing"), "role": "member"}),
        (4.0, m("maya"), "sharing.suggested_share_confirmed", f("Brand guidelines 2026"), {"recipient_count": 3}),
        (3.2, m("ben"), "transfer_batch.created", str(moved.id),
         {"reason": moved.reason, "item_count": 2, "file_id": f("Enterprise pricing sheet")}),
        (3.0, m("ben"), "transfer_batch.executed", str(moved.id),
         {"transferred": 2, "failed": 0, "skipped_ineligible": 0, "file_id": f("Enterprise pricing sheet")}),
        (2.0, m("marcus"), "org_chart.membership.upserted", m("nora"),
         {"user_id": m("nora"), "team_id": t("eng"), "role": "member"}),
        (1.2, m("alex"), "librarian.confirmed_company", f("Customer story: Northwind"),
         {"proposer_id": m("chloe"), "team_id": t("marketing")}),
        (1.0, m("olivia"), "document.created", f("Q4 launch plan"), {"kind": "doc"}),
        (0.8, m("marcus"), "transfer_batch.created", str(planned.id),
         {"reason": planned.reason, "item_count": 3, "file_id": f("Tech debt register")}),
        (0.5, m("ben"), "document.created", f("Q4 pipeline review"), {"kind": "sheet"}),
        (0.3, m("lucas"), "document.created", f("Sprint 42 planning"), {"kind": "doc"}),
        (0.12, m("priya"), "org_chart.membership.upserted", m("mia"),
         {"user_id": m("mia"), "team_id": t("cs"), "role": "member"}),
        (0.05, m("owen"), "sharing.file_created_handled", f("Churn risk tracker"), {"action": "indexed"}),
    ]
    prev_hash, sequence = GENESIS_HASH, 0
    for days_ago, actor, action, target, details in events:
        sequence += 1
        created_at = now - timedelta(days=days_ago)
        actor_id = uuid.UUID(actor) if actor else None
        content = _canonical_content(SANDBOX_ORG_ID, actor_id, action, target, details, sequence, created_at)
        entry_hash = _compute_entry_hash(prev_hash, content)
        db.add(
            AuditLogEntry(
                org_id=SANDBOX_ORG_ID,
                actor_user_id=actor_id,
                action_type=action,
                target_resource_id=target,
                details=details,
                created_at=created_at,
                prev_hash=prev_hash,
                entry_hash=entry_hash,
                sequence=sequence,
            )
        )
        prev_hash = entry_hash
    db.flush()
    assert db.execute(select(func.count()).select_from(AuditLogEntry).where(AuditLogEntry.org_id == SANDBOX_ORG_ID)).scalar_one() == sequence
