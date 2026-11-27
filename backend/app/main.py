import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.market import router as market_router
from app.api.routes.weather import router as weather_router
from app.api.routes.context import router as context_router
from app.api.routes.ops import router as ops_router
from app.api.routes.farmer import router as farmer_router
from app.api.routes.advisory import router as advisory_router
from app.core.config import get_settings
from app.core.rate_limit import RateLimitMiddleware

settings = get_settings()

app = FastAPI(
    title="Smart Crop Advisory System API",
    description="Mandi market prices, weather fusion, and agricultural advisory backend.",
    version="2.0.0",
)

# CORS: browsers normally reach FastAPI through the Express proxy (same origin), so only
# explicitly configured origins are allowed. A wildcard origin combined with credentials
# would let any website make authenticated calls, so credentials are only enabled when
# the origin list is explicit.
_cors_origins = settings.cors_origins
_wildcard = "*" in _cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _wildcard else _cors_origins,
    allow_credentials=not _wildcard,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Per-IP rate limiting (60 requests/min per IP, Architecture §13). X-Forwarded-For is
# trusted only from the local Express proxy so callers cannot pick their own bucket.
app.add_middleware(
    RateLimitMiddleware,
    max_requests=settings.RATE_LIMIT_PER_MINUTE,
    window_seconds=60,
    trusted_proxies=settings.trusted_proxies,
)

logger = logging.getLogger("app")


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Tag every request with an id (kept from X-Request-ID when the Express proxy sends one) for log tracing."""
    rid = (request.headers.get("x-request-id") or "")[:64] or uuid.uuid4().hex[:16]
    request.state.request_id = rid
    response = await call_next(request)
    response.headers["X-Request-ID"] = rid
    return response


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    """Unexpected errors: log the details, return a plain message (no stack traces or internals)."""
    rid = getattr(request.state, "request_id", None) or uuid.uuid4().hex[:16]
    logger.exception(f"Unhandled error on {request.method} {request.url.path} [request_id={rid}]: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on our side. Please try again.", "request_id": rid},
        headers={"X-Request-ID": rid},
    )


app.include_router(market_router)
app.include_router(weather_router)
app.include_router(context_router)
app.include_router(ops_router)
app.include_router(farmer_router)
app.include_router(advisory_router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/ready")
def ready():
    """What is configured, without making network or paid calls."""
    from app.domain.advisory.disease_detector import get_disease_detector

    checks = {
        "supabase": bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY),
        "llm": bool(settings.groq_api_keys or settings.gemini_api_keys),
        "auth": bool((settings.SUPABASE_JWT_SECRET or settings.JWT_SECRET).strip()),
        "disease_model": get_disease_detector().available,
        "translation": bool(settings.BHASHINI_USER_ID and settings.BHASHINI_API_KEY),
    }
    required = ("supabase", "llm", "auth")
    ok = all(checks[k] for k in required)
    return JSONResponse(status_code=200 if ok else 503, content={"status": "ok" if ok else "degraded", "checks": checks})
