import pytest

from app.core.rate_limit import reset_rate_limits
from app.domain.advisory.ratelimit import advisory_rate_limiter


@pytest.fixture(autouse=True)
def _fresh_rate_limits():
    """Every test starts with empty rate-limit windows (the suite shares one TestClient IP)."""
    reset_rate_limits()
    advisory_rate_limiter.reset()
    yield


# CI runs with a dummy SUPABASE_URL, which makes FarmerRepository treat Supabase as the
# persistent store and answer 503 when the (unreachable) write fails. Tests use its
# in-memory fallback instead.
from app.data.farmer.repository import FarmerRepository  # noqa: E402

_orig_farmer_init = FarmerRepository.__init__


def _test_farmer_init(self, *args, **kwargs):
    _orig_farmer_init(self, *args, **kwargs)
    self._persistent = False


FarmerRepository.__init__ = _test_farmer_init
