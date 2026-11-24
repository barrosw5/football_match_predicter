"""Shared HTTP session with retries, polite throttling and a tiny on-disk cache."""

from __future__ import annotations

import logging
import time
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from ..config import HTTP_USER_AGENT

log = logging.getLogger(__name__)

_session: requests.Session | None = None
_last_request: dict[str, float] = {}


def session() -> requests.Session:
    global _session
    if _session is None:
        s = requests.Session()
        retry = Retry(
            total=4,
            backoff_factor=1.5,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET",),
        )
        s.mount("https://", HTTPAdapter(max_retries=retry))
        s.mount("http://", HTTPAdapter(max_retries=retry))
        s.headers["User-Agent"] = HTTP_USER_AGENT
        _session = s
    return _session


def get(
    url: str, *, params: dict | None = None, min_interval: float = 0.25, timeout: float = 30
) -> requests.Response:
    """GET with per-host throttling. Raises for HTTP errors."""
    host = url.split("/")[2]
    wait = _last_request.get(host, 0) + min_interval - time.monotonic()
    if wait > 0:
        time.sleep(wait)
    resp = session().get(url, params=params, timeout=timeout)
    _last_request[host] = time.monotonic()
    resp.raise_for_status()
    return resp


def cached_download(url: str, dest: Path, *, refresh: bool) -> Path | None:
    """Download ``url`` to ``dest`` unless it is already cached and ``refresh`` is False.

    Returns the local path, or ``None`` when the resource does not exist (HTTP 404).
    A failed refresh falls back to the cached copy so a flaky source never breaks the pipeline.
    """
    if dest.exists() and not refresh:
        return dest
    try:
        resp = get(url)
    except requests.HTTPError as exc:
        if exc.response is not None and exc.response.status_code == 404:
            return None
        if dest.exists():
            log.warning("Refresh failed for %s (%s); using cached copy", url, exc)
            return dest
        raise
    except requests.RequestException as exc:
        if dest.exists():
            log.warning("Refresh failed for %s (%s); using cached copy", url, exc)
            return dest
        raise
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(resp.content)
    return dest
