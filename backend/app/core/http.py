import asyncio
from typing import Any
import httpx


class ProviderError(Exception):
    """Base class for all provider-related errors."""
    pass


class ProviderTimeout(ProviderError):
    """Provider call timed out."""
    pass


class ProviderHTTPError(ProviderError):
    """Provider responded with non-2xx status code."""
    def __init__(self, status_code: int, message: str = ""):
        super().__init__(f"HTTP {status_code}: {message}")
        self.status_code = status_code


class ProviderSchemaError(ProviderError):
    """Provider returned unexpected JSON payload or missing required columns."""
    pass


class ProviderQuotaError(ProviderError):
    """Provider rate limit or quota exceeded (e.g. demo key capped at 10 rows)."""
    pass


async def fetch_with_retry(
    client: httpx.AsyncClient,
    url: str,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    retries: int = 3,
    backoff_factor: float = 1.0,
    timeout: float = 30.0,
) -> dict[str, Any]:
    """
    Perform an async GET request with retry backoff and convert exceptions
    to the system error taxonomy.
    """
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            resp = await client.get(url, params=params, headers=headers, timeout=timeout)
            if resp.status_code == 429:
                raise ProviderQuotaError("Provider rate limit reached (HTTP 429)")
            if resp.status_code >= 400:
                raise ProviderHTTPError(resp.status_code, resp.text[:200])
            return resp.json()
        except (httpx.TimeoutException, asyncio.TimeoutError) as exc:
            last_err = ProviderTimeout(f"Request to {url} timed out after {timeout}s: {exc}")
        except httpx.ConnectError as exc:
            last_err = ProviderError(f"Failed to connect to {url}: {exc}")
        except (ProviderHTTPError, ProviderQuotaError) as exc:
            last_err = exc
            if isinstance(exc, ProviderQuotaError):
                raise exc  # Do not retry quota errors
        except httpx.HTTPError as exc:
            last_err = ProviderError(f"HTTP client error: {exc}")
        except Exception as exc:
            last_err = ProviderError(f"Unexpected provider error: {exc}")

        if attempt < retries:
            await asyncio.sleep(backoff_factor * (2 ** (attempt - 1)))

    if last_err:
        raise last_err
    raise ProviderError("Failed to fetch data after all retries")
