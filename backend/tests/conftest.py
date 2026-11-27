import os

# Tests must never touch the real network. Without this, every call to the dummy Supabase
# URL or a weather API waited for its own timeout on CI runners (over a minute per test,
# so the job hit its 10-minute limit). A dead local proxy makes those calls fail at once,
# and the code under test takes its offline fallback, as designed.
for _var in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"):
    os.environ[_var] = "http://127.0.0.1:9"
os.environ["NO_PROXY"] = os.environ["no_proxy"] = "localhost,127.0.0.1,testserver"

# supabase-py (postgrest) retries failed GETs with exponential back-off, which made each
# offline Supabase read take over a minute. Tests keep the retries but skip the waiting.
import postgrest._sync.request_builder as _pg_rb  # noqa: E402

_pg_rb.get_retry_delay = lambda *_args, **_kwargs: 0

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
