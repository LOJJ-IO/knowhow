from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import (
    audit,
    auth,
    delegation,
    demo,
    files,
    health,
    offboard,
    onboarding,
    org_chart,
    reassignments,
    search,
    suggested_share,
    transfer_batches,
    webhooks,
)
from app.config import get_settings
from app.exceptions import (
    CrossOrgAccessDenied,
    DelegationNotApproved,
    KnohowError,
    MemberNotProvisioned,
    OwnershipTransferNotPermitted,
    PersonalAccountNotConsented,
    WebhookTokenMismatch,
)
from app.jobs.scheduler import create_scheduler
from app.logging_config import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = create_scheduler()
    scheduler.start()
    logger.info("app.scheduler_started")
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        logger.info("app.scheduler_stopped")


app = FastAPI(title="Knohow Backend", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_ERROR_STATUS = {
    CrossOrgAccessDenied: 403,
    DelegationNotApproved: 409,
    PersonalAccountNotConsented: 409,
    OwnershipTransferNotPermitted: 409,
    MemberNotProvisioned: 404,
    WebhookTokenMismatch: 403,
}


@app.exception_handler(KnohowError)
def handle_knohow_error(request: Request, exc: KnohowError) -> JSONResponse:
    status_code = _ERROR_STATUS.get(type(exc), 400)
    logger.warning("request.knohow_error", error_type=type(exc).__name__, detail=str(exc))
    return JSONResponse(status_code=status_code, content={"detail": str(exc), "error_type": type(exc).__name__})


@app.exception_handler(ValueError)
def handle_value_error(request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": str(exc)})


# Auth/identity module (backend/auth-foundation)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(delegation.router)
app.include_router(offboard.router)
app.include_router(audit.router)

# Org-engine module (backend/org-engine) — imports from the above, does not
# duplicate it.
app.include_router(onboarding.router)
app.include_router(demo.router)
app.include_router(org_chart.router)
app.include_router(files.router)
app.include_router(search.router)
app.include_router(suggested_share.router)
app.include_router(reassignments.router)
app.include_router(transfer_batches.router)
app.include_router(webhooks.router)
