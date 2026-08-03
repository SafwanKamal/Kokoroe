from __future__ import annotations

from dataclasses import dataclass
from email.message import Message
from html.parser import HTMLParser
import time
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import (
    HTTPRedirectHandler,
    Request,
    build_opener,
)
from urllib.robotparser import RobotFileParser

from .contracts import CrawlError, RunConfig, SourceConfig
from .security import URLPolicy


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        return None


@dataclass(frozen=True)
class FetchResponse:
    url: str
    status: int
    headers: Message
    body: bytes

    @property
    def content_type(self) -> str:
        return self.headers.get_content_type().lower()


class RateLimiter:
    def __init__(self) -> None:
        self._last_request: dict[str, float] = {}

    def wait(self, url: str, minimum_delay: float) -> None:
        host = urlsplit(url).hostname or ""
        previous = self._last_request.get(host)
        if previous is not None:
            remaining = minimum_delay - (time.monotonic() - previous)
            if remaining > 0:
                time.sleep(remaining)
        self._last_request[host] = time.monotonic()


class Fetcher:
    def __init__(self, run: RunConfig, rate_limiter: RateLimiter | None = None):
        self.run = run
        self.rate_limiter = rate_limiter or RateLimiter()
        self._opener = build_opener(_NoRedirect())

    def fetch(
        self,
        source: SourceConfig,
        url: str,
        *,
        max_bytes: int,
        accepted_types: Iterable[str],
        allowed_statuses: Iterable[int] = (),
        check_path: bool = True,
        delay_seconds: float | None = None,
    ) -> FetchResponse:
        policy = URLPolicy(source, self.run.allow_private_hosts)
        current = policy.normalize_and_validate(url, check_path=check_path)
        accepted = tuple(value.lower() for value in accepted_types)
        for redirect_count in range(self.run.max_redirects + 1):
            self.rate_limiter.wait(
                current,
                source.delay_seconds if delay_seconds is None else delay_seconds,
            )
            request = Request(
                current,
                headers={
                    "User-Agent": self.run.user_agent,
                    "From": self.run.contact,
                    "Accept": ", ".join(accepted),
                    "Accept-Encoding": "identity",
                },
                method="GET",
            )
            try:
                response = self._opener.open(
                    request, timeout=self.run.request_timeout_seconds
                )
            except HTTPError as exc:
                response = exc
            except (URLError, TimeoutError, OSError) as exc:
                raise CrawlError(f"request failed for {current}: {exc}") from exc
            status = int(response.status)
            if status in {301, 302, 303, 307, 308}:
                if redirect_count >= self.run.max_redirects:
                    raise CrawlError(f"too many redirects for {url}")
                location = response.headers.get("Location")
                if not location:
                    raise CrawlError(f"redirect without Location for {current}")
                current = policy.normalize_and_validate(
                    urljoin(current, location), check_path=check_path
                )
                continue
            if status in set(allowed_statuses):
                body = response.read(max_bytes + 1)
                if len(body) > max_bytes:
                    raise CrawlError(f"response exceeds byte limit: {current}")
                return FetchResponse(
                    url=current, status=status, headers=response.headers, body=body
                )
            if not 200 <= status < 300:
                raise CrawlError(f"HTTP {status} for {current}")
            content_type = response.headers.get_content_type().lower()
            if not any(
                content_type == allowed
                or (allowed.endswith("/*") and content_type.startswith(allowed[:-1]))
                for allowed in accepted
            ):
                raise CrawlError(
                    f"unexpected content type {content_type!r} for {current}"
                )
            content_length = response.headers.get("Content-Length")
            if content_length:
                try:
                    if int(content_length) > max_bytes:
                        raise CrawlError(
                            f"response exceeds byte limit before download: {current}"
                        )
                except ValueError:
                    pass
            body = response.read(max_bytes + 1)
            if len(body) > max_bytes:
                raise CrawlError(f"response exceeds byte limit: {current}")
            return FetchResponse(
                url=current, status=status, headers=response.headers, body=body
            )
        raise CrawlError(f"redirect loop for {url}")


class RobotsGuard:
    def __init__(self, fetcher: Fetcher):
        self.fetcher = fetcher
        self._cache: dict[tuple[str, str], RobotFileParser | bool] = {}

    def can_fetch(self, source: SourceConfig, url: str) -> bool:
        if not self.fetcher.run.respect_robots:
            return True
        parsed = urlsplit(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        cache_key = (source.source_id, origin)
        cached = self._cache.get(cache_key)
        if cached is None:
            robots_url = f"{origin}/robots.txt"
            try:
                response = self.fetcher.fetch(
                    source,
                    robots_url,
                    max_bytes=512_000,
                    accepted_types=("text/plain", "text/*"),
                    allowed_statuses=(401, 403, 404, 410, 429, 500, 502, 503, 504),
                    check_path=False,
                    delay_seconds=0,
                )
                if response.status in {404, 410}:
                    cached = True
                elif response.status in {401, 403}:
                    cached = False
                elif response.status >= 400:
                    cached = not self.fetcher.run.fail_closed_robots
                else:
                    parser = RobotFileParser()
                    parser.set_url(robots_url)
                    parser.parse(
                        response.body.decode("utf-8", errors="replace").splitlines()
                    )
                    cached = parser
            except CrawlError:
                cached = not self.fetcher.run.fail_closed_robots
            self._cache[cache_key] = cached
        if isinstance(cached, bool):
            return cached
        return cached.can_fetch(self.fetcher.run.user_agent, url)


class LinkExtractor(HTMLParser):
    def __init__(self, base_url: str):
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.links: set[str] = set()
        self.images: set[str] = set()

    def handle_starttag(self, tag: str, attrs) -> None:
        values = {key.lower(): value for key, value in attrs if value}
        if tag.lower() == "a" and "href" in values:
            self.links.add(urljoin(self.base_url, values["href"]))
        if tag.lower() == "img":
            candidate = values.get("src") or values.get("data-src")
            if candidate:
                self.images.add(urljoin(self.base_url, candidate))
