from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.market import router as market_router
from app.core.config import get_settings

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

app.include_router(market_router)


@app.get("/health")
def health():
    return {"status": "ok"}
