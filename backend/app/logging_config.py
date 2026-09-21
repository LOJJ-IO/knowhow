import logging
import sys

import structlog

from app.config import get_settings


def configure_logging() -> None:
    """JSON structured logging to stdout, as expected by Railway's log pipeline."""
    settings = get_settings()

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=settings.log_level,
    )

    # APScheduler logs every tick at INFO ("Running job… executed successfully")
    # and "missed by…" at WARNING when the laptop sleeps — drown the terminal
    # without adding signal. Keep ERROR+ so real scheduler failures still show.
    # Our jobs use structlog (`jobs.demo_recovery_sent`, etc.) when something
    # actually happened.
    for name in (
        "apscheduler",
        "apscheduler.scheduler",
        "apscheduler.executors",
        "apscheduler.executors.default",
    ):
        logging.getLogger(name).setLevel(logging.ERROR)

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(settings.log_level)),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
