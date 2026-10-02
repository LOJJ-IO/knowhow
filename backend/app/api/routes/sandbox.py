import time

from fastapi import APIRouter, Depends, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.api.routes.auth import set_session_cookies
from app.config import get_settings
from app.sandbox import SANDBOX_ORG_ID
from app.sandbox.seed import ensure_seeded
from app.security.jwt import issue_access_token, issue_refresh_token

router = APIRouter(prefix="/sandbox", tags=["sandbox"])

# A forced reseed rebuilds the whole org; once a minute is plenty.
_FORCE_EVERY_SECONDS = 60
_last_force = [float("-inf")]


@router.get("/enter")
def enter(fresh: bool = False, db: Session = Depends(get_db)) -> RedirectResponse:
    """Signs this browser in to the sales sandbox (Acme) as its owner and
    opens the app. Seeds it first if it's missing or stale; `fresh=1`
    rebuilds it now. Not added to the browser's account picker."""
    force = False
    if fresh and time.monotonic() - _last_force[0] > _FORCE_EVERY_SECONDS:
        _last_force[0] = time.monotonic()
        force = True
    owner_id = ensure_seeded(db, force=force)
    response = RedirectResponse(f"{get_settings().frontend_origin}/home", status_code=status.HTTP_302_FOUND)
    set_session_cookies(
        response,
        issue_access_token(owner_id, SANDBOX_ORG_ID),
        issue_refresh_token(owner_id, SANDBOX_ORG_ID),
    )
    return response
