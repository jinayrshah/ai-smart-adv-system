from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.market import router as market_router
from app.api.routes.weather import router as weather_router
from app.api.routes.context import router as context_router
from app.api.routes.ops import router as ops_router
from app.api.routes.farmer import router as farmer_router
from app.core.config import get_settings
from app.core.rate_limit import RateLimitMiddleware

settings = get_settings()

app = FastAPI(
    title="Smart Crop Advisory System API",
    description="Mandi market prices, weather fusion, and agricultural advisory backend.",
    version="2.0.0",
)

# Enable CORS for Next.js and frontend dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Per-IP rate limiting (60 requests/min per IP, Architecture §13)
app.add_middleware(RateLimitMiddleware, max_requests=60, window_seconds=60)

app.include_router(market_router)
app.include_router(weather_router)
app.include_router(context_router)
app.include_router(ops_router)
app.include_router(farmer_router)


@app.get("/health")
def health():
    return {"status": "ok"}
