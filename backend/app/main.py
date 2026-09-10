from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import audit, auth, delegation, health, offboard
from app.config import get_settings
from app.exceptions import (
    CrossOrgAccessDenied,
    DelegationNotApproved,
    KnohowError,
    MemberNotProvisioned,
    OwnershipTransferNotPermitted,
    PersonalAccountNotConsented,
)
from app.logging_config import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)

app = FastAPI(title="Knohow Auth & Identity Service")

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
}


@app.exception_handler(KnohowError)
def handle_knohow_error(request: Request, exc: KnohowError) -> JSONResponse:
    status_code = _ERROR_STATUS.get(type(exc), 400)
    logger.warning("request.knohow_error", error_type=type(exc).__name__, detail=str(exc))
    return JSONResponse(status_code=status_code, content={"detail": str(exc), "error_type": type(exc).__name__})


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(delegation.router)
app.include_router(offboard.router)
app.include_router(audit.router)
