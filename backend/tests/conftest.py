import pytest

from app.core.rate_limit import reset_rate_limits
from app.domain.advisory.ratelimit import advisory_rate_limiter


@pytest.fixture(autouse=True)
def _fresh_rate_limits():
    """Every test starts with empty rate-limit windows (the suite shares one TestClient IP)."""
    reset_rate_limits()
    advisory_rate_limiter.reset()
    yield
