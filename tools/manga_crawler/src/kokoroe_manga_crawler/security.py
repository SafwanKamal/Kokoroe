from __future__ import annotations

import ipaddress
import posixpath
import socket
from dataclasses import dataclass
from urllib.parse import SplitResult, unquote, urlsplit, urlunsplit

from .contracts import PolicyError, SourceConfig


def _is_public_address(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _normalized_path(parsed: SplitResult) -> str:
    decoded = unquote(parsed.path or "/")
    normalized = posixpath.normpath(decoded)
    if not normalized.startswith("/"):
        normalized = f"/{normalized}"
    if decoded.endswith("/") and not normalized.endswith("/"):
        normalized += "/"
    return normalized


@dataclass(frozen=True)
class URLPolicy:
    source: SourceConfig
    allow_private_hosts: bool = False

    def normalize_and_validate(
        self, url: str, *, check_network: bool = True, check_path: bool = True
    ) -> str:
        parsed = urlsplit(url)
        if parsed.scheme not in {"http", "https"}:
            raise PolicyError(f"unsupported URL scheme for {url!r}")
        if parsed.username or parsed.password:
            raise PolicyError("URL credentials are forbidden")
        if not parsed.hostname:
            raise PolicyError(f"URL has no hostname: {url!r}")
        hostname = parsed.hostname.rstrip(".").encode("idna").decode("ascii").lower()
        if hostname not in self.source.allowed_domains:
            raise PolicyError(
                f"host {hostname!r} is not allowlisted for {self.source.source_id!r}"
            )
        port = parsed.port
        if port is not None and port not in {80, 443}:
            raise PolicyError(f"non-standard port {port} is not allowed")
        path = _normalized_path(parsed)
        if check_path and not any(
            path.startswith(prefix) for prefix in self.source.allowed_path_prefixes
        ):
            raise PolicyError(
                f"path {path!r} is outside the source allowlisted prefixes"
            )
        if check_network and not self.allow_private_hosts:
            try:
                records = socket.getaddrinfo(
                    hostname,
                    port or (443 if parsed.scheme == "https" else 80),
                    type=socket.SOCK_STREAM,
                )
            except socket.gaierror as exc:
                raise PolicyError(f"DNS resolution failed for {hostname!r}") from exc
            addresses = {record[4][0] for record in records}
            if not addresses or any(
                not _is_public_address(address) for address in addresses
            ):
                raise PolicyError(
                    f"host {hostname!r} resolves to a non-public address"
                )
        netloc = hostname
        if port:
            netloc = f"{netloc}:{port}"
        return urlunsplit((parsed.scheme.lower(), netloc, path, parsed.query, ""))


def endpoint_is_local(endpoint: str) -> bool:
    parsed = urlsplit(endpoint)
    hostname = parsed.hostname
    if not hostname:
        return False
    if hostname.lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(hostname).is_loopback
    except ValueError:
        return False
