from fastapi import APIRouter, Depends

from app.data.ops.service import OpsService
from app.schemas.health import HealthDataResponse

router = APIRouter(prefix="/api/health", tags=["Health & Ops"])


def get_ops_service() -> OpsService:
    return OpsService()


@router.get("/data", response_model=HealthDataResponse)
def get_data_layer_health(
    ops_service: OpsService = Depends(get_ops_service),
):
    """
    Data layer health and operational monitoring endpoint.
    Architecture §10.3 and §13.
    Returns:
      - Job statuses, age in hours, and thresholds (mandi > 36h, weather > 12h, reconcile > 36h -> degraded)
      - Database table row counts and estimated storage footprint with 400 MB alert threshold
      - Overall system health: 'ok' | 'degraded'
    """
    return ops_service.evaluate_health()
