from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app.include_router(market_router)
app.include_router(weather_router)
app.include_router(context_router)
app.include_router(ops_router)
app.include_router(farmer_router)
app.include_router(advisory_router)


@app.get("/health")
def health():
    return {"status": "ok"}
