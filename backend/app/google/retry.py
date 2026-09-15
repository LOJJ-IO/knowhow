import random
import time
from collections.abc import Callable
from typing import ParamSpec, TypeVar

from googleapiclient.errors import HttpError

from app.logging_config import get_logger

logger = get_logger(__name__)

P = ParamSpec("P")
T = TypeVar("T")

RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
MAX_ATTEMPTS = 6
BASE_DELAY_SECONDS = 1.0
MAX_DELAY_SECONDS = 60.0


def _retry_after_seconds(error: HttpError) -> float | None:
    # error.resp is an httplib2.Response, which IS the header dict (lowercased
    # keys) rather than exposing a separate `.headers` attribute.
    resp = error.resp
    if resp is None:
        return None
    retry_after = resp.get("retry-after")
    if retry_after is None:
        return None
    try:
        return float(retry_after)
    except (TypeError, ValueError):
        return None


def _backoff_delay(attempt: int, retry_after: float | None) -> float:
    if retry_after is not None:
        return min(retry_after, MAX_DELAY_SECONDS)
    # Exponential backoff with full jitter (attempt is 1-indexed).
    exponential = min(BASE_DELAY_SECONDS * (2 ** (attempt - 1)), MAX_DELAY_SECONDS)
    return random.uniform(0, exponential)


def google_api_call(fn: Callable[P, T], *args: P.args, **kwargs: P.kwargs) -> T:
    """Shared retry/backoff wrapper for every outbound Google API call in this
    codebase. Exponential backoff with jitter on 429/5xx, honoring Retry-After
    when Google sends one, capped at MAX_ATTEMPTS. This is centralized here
    (rather than left to each call site) because the org-engine module's
    full-org reconciliation sweeps will make quota exhaustion routine, not
    exceptional — every caller gets the same behavior for free.

    `fn` is typically a bound `.execute` call, e.g.:
        google_api_call(drive.files().get(fileId=file_id).execute)
    """
    last_error: HttpError | None = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return fn(*args, **kwargs)
        except HttpError as error:
            status = error.resp.status if error.resp is not None else None
            if status not in RETRYABLE_STATUS_CODES or attempt == MAX_ATTEMPTS:
                raise

            last_error = error
            delay = _backoff_delay(attempt, _retry_after_seconds(error))
            logger.warning(
                "google_api_call.retry",
                attempt=attempt,
                max_attempts=MAX_ATTEMPTS,
                status=status,
                delay_seconds=round(delay, 2),
            )
            time.sleep(delay)

    # Unreachable: the loop either returns or raises on the final attempt.
    assert last_error is not None
    raise last_error
