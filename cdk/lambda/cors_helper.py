"""
CORS origin helper for Python Lambda functions.

Reads ALLOWED_ORIGINS from environment (comma-separated list, supports
wildcard subdomains like "https://*.amplifyapp.com").

Returns the matching origin to echo back in the Access-Control-Allow-Origin
header, or falls back to the first allowed origin if none match.
If ALLOWED_ORIGINS is not set or equals "*", returns "*" (backwards-compatible).
"""

import os
import re

_raw = os.environ.get("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = [s.strip() for s in _raw.split(",") if s.strip()]


def get_cors_origin(event):
    """Return the appropriate Access-Control-Allow-Origin value for this request."""
    if not ALLOWED_ORIGINS or "*" in ALLOWED_ORIGINS:
        return "*"

    headers = event.get("headers") or {}
    origin = headers.get("origin") or headers.get("Origin") or ""

    if not origin:
        return ALLOWED_ORIGINS[0]

    for pattern in ALLOWED_ORIGINS:
        if "*" in pattern:
            # Escape regex special chars except *, then replace * with [^.]+ for subdomain matching
            escaped = re.escape(pattern).replace(r"\*", "[^.]+")
            if re.match("^" + escaped + "$", origin):
                return origin
        elif pattern == origin:
            return origin

    return ALLOWED_ORIGINS[0]


def get_cors_headers(event):
    """Build standard CORS headers dict for a response."""
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": get_cors_origin(event),
        "Access-Control-Allow-Methods": "*",
    }
