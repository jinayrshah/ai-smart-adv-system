import time
from collections import defaultdict
from threading import Lock
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Sliding window per-IP rate limiter middleware.
    Architecture §13: 60 requests per minute per IP.
    """
    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)
        self.lock = Lock()
        self.last_cleanup = time.time()

    def _cleanup(self, now: float):
        """Remove IPs that have no timestamps in the window."""
        if now - self.last_cleanup > 300: # Every 5 minutes
            for ip in list(self.requests.keys()):
                self.requests[ip] = [t for t in self.requests[ip] if now - t < self.window_seconds]
                if not self.requests[ip]:
                    del self.requests[ip]
            self.last_cleanup = now

    async def dispatch(self, request: Request, call_next):
        # Exclude internal health and root endpoints from rate limiting
        if request.url.path in ("/health", "/docs", "/redoc", "/openapi.json"):
            return await call_next(request)

        # Extract client IP (handling reverse proxy X-Forwarded-For if available)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"

        now = time.time()

        with self.lock:
            self._cleanup(now)
            timestamps = self.requests[client_ip]
            # Keep only requests within the active window
            valid_timestamps = [t for t in timestamps if now - t < self.window_seconds]
            self.requests[client_ip] = valid_timestamps

            if len(valid_timestamps) >= self.max_requests:
                oldest = valid_timestamps[0]
                retry_after = int(self.window_seconds - (now - oldest)) + 1
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "Rate limit exceeded",
                        "message": f"Maximum {self.max_requests} requests per minute allowed. Try again in {retry_after}s.",
                    },
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(self.max_requests),
                        "X-RateLimit-Remaining": "0",
                    },
                )

            valid_timestamps.append(now)
            remaining = self.max_requests - len(valid_timestamps)

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
