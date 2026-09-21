from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select

from app.activity.reconciliation import reconcile_organization
from app.activity.watch_channels import renew_expiring_channels
from app.auth.delegation import check_delegation
from app.db import SessionLocal
from app.demo.service import send_due_recovery_emails
from app.logging_config import get_logger
from app.models.delegation_grant import DelegationGrant, DelegationStatus
from app.models.organization import Organization
from app.models.pending_reassignment import PendingReassignment, ReassignmentStatus
from app.models.suggested_share import SuggestedShare, SuggestedShareStatus

logger = get_logger(__name__)

STALE_THRESHOLD = timedelta(days=14)


def run_reconciliation_sweeps() -> None:
    """Periodic full reconciliation sweep, per organization — see
    app/activity/reconciliation.py. One organization's failure (a revoked
    delegation, a Google outage) must not abort the sweep for every other
    organization, hence the broad catch here specifically (job-loop
    boundary) — google_api_call inside the sweep itself still only retries
    the specific transient errors it's meant to."""
    db = SessionLocal()
    try:
        org_ids = db.execute(select(Organization.id)).scalars().all()
        for org_id in org_ids:
            try:
                result = reconcile_organization(org_id, db)
                logger.info("jobs.reconciliation_swept", **result)
            except Exception:
                logger.exception("jobs.reconciliation_failed", org_id=str(org_id))
    finally:
        db.close()


def run_channel_renewal() -> None:
    db = SessionLocal()
    try:
        renewed = renew_expiring_channels(db)
        logger.info("jobs.watch_channels_renewed", count=renewed)
    finally:
        db.close()


def expire_stale_pending_state() -> None:
    """PendingReassignment/SuggestedShare rows nobody ever confirmed or
    declined eventually auto-decline, so they don't accumulate forever as
    silent unresolved prompts."""
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - STALE_THRESHOLD

        stale_reassignments = db.execute(
            select(PendingReassignment).where(
                PendingReassignment.status == ReassignmentStatus.PENDING_CONFIRMATION,
                PendingReassignment.created_at < cutoff,
            )
        ).scalars().all()
        for r in stale_reassignments:
            r.status = ReassignmentStatus.DECLINED
            r.resolved_at = datetime.now(timezone.utc)

        stale_shares = db.execute(
            select(SuggestedShare).where(
                SuggestedShare.status == SuggestedShareStatus.PENDING, SuggestedShare.created_at < cutoff
            )
        ).scalars().all()
        for s in stale_shares:
            s.status = SuggestedShareStatus.DECLINED
            s.resolved_at = datetime.now(timezone.utc)

        db.commit()
        logger.info(
            "jobs.stale_state_expired",
            reassignments=len(stale_reassignments),
            suggested_shares=len(stale_shares),
        )
    finally:
        db.close()


def check_pending_delegations() -> None:
    """Delegation detection: nobody has to tell Knohow the Admin console
    step is done — pending grants are checked every few minutes and approved
    once an impersonated call succeeds (app/auth/delegation.py)."""
    db = SessionLocal()
    try:
        org_ids = db.execute(
            select(DelegationGrant.organization_id).where(DelegationGrant.status == DelegationStatus.PENDING)
        ).scalars().all()
        for org_id in org_ids:
            try:
                result = check_delegation(org_id, db)
                logger.info("jobs.delegation_checked", org_id=str(org_id), status=result.status)
            except Exception:
                logger.exception("jobs.delegation_check_failed", org_id=str(org_id))
    finally:
        db.close()


def run_demo_recovery_emails() -> None:
    """Abandoned Book a Demo — one Resend after the configured idle window."""
    db = SessionLocal()
    try:
        sent = send_due_recovery_emails(db)
        if sent:
            logger.info("jobs.demo_recovery_sent", count=sent)
    except Exception:
        logger.exception("jobs.demo_recovery_failed")
    finally:
        db.close()


def create_scheduler() -> BackgroundScheduler:
    # coalesce: after sleep/wake, run each job once instead of replaying a
    # backlog of missed minutes (those were the "missed by 0:0x:xx" lines).
    scheduler = BackgroundScheduler(
        job_defaults={
            "coalesce": True,
            "max_instances": 1,
            "misfire_grace_time": 30,
        }
    )
    scheduler.add_job(
        run_reconciliation_sweeps, "interval", hours=6, id="reconciliation_sweep", replace_existing=True
    )
    scheduler.add_job(
        run_channel_renewal, "interval", hours=1, id="watch_channel_renewal", replace_existing=True
    )
    scheduler.add_job(
        check_pending_delegations, "interval", minutes=5, id="delegation_detection", replace_existing=True
    )
    scheduler.add_job(
        expire_stale_pending_state, "interval", hours=12, id="expire_stale_pending_state", replace_existing=True
    )
    scheduler.add_job(
        run_demo_recovery_emails, "interval", minutes=1, id="demo_recovery_emails", replace_existing=True
    )
    return scheduler
