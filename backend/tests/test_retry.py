import httplib2
import pytest
from googleapiclient.errors import HttpError

from app.google import retry as retry_module
from app.google.retry import google_api_call


def _http_error(status: int, retry_after: str | None = None) -> HttpError:
    headers = {"status": str(status)}
    if retry_after is not None:
        headers["retry-after"] = retry_after
    return HttpError(httplib2.Response(headers), b"error body")


def test_retries_on_429_then_succeeds(monkeypatch):
    monkeypatch.setattr(retry_module.time, "sleep", lambda _seconds: None)

    calls = {"count": 0}

    def flaky():
        calls["count"] += 1
        if calls["count"] < 3:
            raise _http_error(429, retry_after="0")
        return "ok"

    assert google_api_call(flaky) == "ok"
    assert calls["count"] == 3


def test_does_not_retry_on_404(monkeypatch):
    monkeypatch.setattr(retry_module.time, "sleep", lambda _seconds: None)

    def not_found():
        raise _http_error(404)

    with pytest.raises(HttpError):
        google_api_call(not_found)


def test_gives_up_after_max_attempts(monkeypatch):
    monkeypatch.setattr(retry_module.time, "sleep", lambda _seconds: None)
    monkeypatch.setattr(retry_module, "MAX_ATTEMPTS", 3)

    calls = {"count": 0}

    def always_503():
        calls["count"] += 1
        raise _http_error(503)

    with pytest.raises(HttpError):
        google_api_call(always_503)
    assert calls["count"] == 3


def test_honors_retry_after_header(monkeypatch):
    sleeps: list[float] = []
    monkeypatch.setattr(retry_module.time, "sleep", sleeps.append)

    calls = {"count": 0}

    def flaky():
        calls["count"] += 1
        if calls["count"] < 2:
            raise _http_error(429, retry_after="12")
        return "ok"

    assert google_api_call(flaky) == "ok"
    assert sleeps == [12.0]
