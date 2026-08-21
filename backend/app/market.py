"""Market data fetching.

Runs server-side, so the public CORS proxies (allorigins / codetabs) the
original browser app depended on are no longer needed. Yahoo Finance is the
primary source with Alpha Vantage as a fallback, mirroring the original
fallback chain.
"""

from datetime import datetime, timezone
from typing import Any

import httpx

from .config import settings

YAHOO_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,text/plain,*/*",
}

YAHOO_HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]


def _round(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return None


async def _yahoo_get(client: httpx.AsyncClient, path: str, params: dict) -> dict | None:
    for host in YAHOO_HOSTS:
        try:
            res = await client.get(f"{host}{path}", params=params, headers=YAHOO_HEADERS)
            if res.status_code == 200:
                return res.json()
        except (httpx.HTTPError, ValueError):
            continue
    return None


def _parse_chart(data: dict | None) -> list[dict] | None:
    results = (data or {}).get("chart", {}).get("result") or []
    if not results:
        return None
    result = results[0]
    timestamps = result.get("timestamp") or []
    quote_blocks = result.get("indicators", {}).get("quote") or [{}]
    quote = quote_blocks[0]
    closes = quote.get("close") or []

    history = []
    for i, ts in enumerate(timestamps):
        close = _round(closes[i] if i < len(closes) else None)
        if close is None:
            continue
        date = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
        history.append(
            {
                "date": date,
                "open": _round((quote.get("open") or [None])[i] if i < len(quote.get("open") or []) else None) or close,
                "high": _round((quote.get("high") or [None])[i] if i < len(quote.get("high") or []) else None) or close,
                "low": _round((quote.get("low") or [None])[i] if i < len(quote.get("low") or []) else None) or close,
                "close": close,
                "volume": (quote.get("volume") or [0] * len(timestamps))[i] or 0,
                "isMock": False,
            }
        )
    return history or None


def _validate(history: list[dict] | None) -> list[dict] | None:
    """Reject sparse/corrupted series, matching the original client check."""
    if not history or len(history) < 2:
        return history
    ordered = sorted(history, key=lambda d: d["date"])
    last = datetime.strptime(ordered[-1]["date"], "%Y-%m-%d")
    prev = datetime.strptime(ordered[-2]["date"], "%Y-%m-%d")
    if (last - prev).days > 30:
        return None
    return ordered


async def _alpha_vantage_history(symbol: str, api_key: str) -> list[dict] | None:
    if not api_key:
        return None
    async with httpx.AsyncClient(timeout=settings.http_timeout) as client:
        try:
            res = await client.get(
                "https://www.alphavantage.co/query",
                params={
                    "function": "TIME_SERIES_DAILY",
                    "symbol": symbol,
                    "outputsize": "full",
                    "apikey": api_key,
                },
            )
            series = res.json().get("Time Series (Daily)")
        except (httpx.HTTPError, ValueError, AttributeError):
            return None
    if not series:
        return None
    history = [
        {
            "date": date,
            "open": _round(day["1. open"]),
            "high": _round(day["2. high"]),
            "low": _round(day["3. low"]),
            "close": _round(day["4. close"]),
            "volume": int(day["5. volume"]),
            "isMock": False,
        }
        for date, day in sorted(series.items())
    ]
    return history[-600:] or None


async def fetch_history(symbol: str, alpha_vantage_key: str = "") -> list[dict] | None:
    async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
        data = await _yahoo_get(
            client, f"/v8/finance/chart/{symbol}", {"range": "2y", "interval": "1d"}
        )
        history = _validate(_parse_chart(data))
        if history:
            return history

    return await _alpha_vantage_history(symbol, alpha_vantage_key or settings.alpha_vantage_key)


async def fetch_quote(symbol: str) -> dict | None:
    async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
        data = await _yahoo_get(
            client, f"/v8/finance/chart/{symbol}", {"range": "1d", "interval": "1d"}
        )
        results = (data or {}).get("chart", {}).get("result") or []
        if not results:
            return None
        meta = results[0].get("meta") or {}
        price = meta.get("regularMarketPrice")
        if price is None:
            return None

        prev_close = meta.get("chartPreviousClose") or meta.get("previousClose")
        change = change_pct = None
        if prev_close:
            change = price - prev_close
            change_pct = (change / prev_close) * 100

        name = meta.get("longName") or meta.get("shortName") or symbol
        if name == symbol:
            search = await _yahoo_get(client, "/v1/finance/search", {"q": symbol})
            for quote in (search or {}).get("quotes", []):
                if quote.get("symbol", "").upper() == symbol.upper():
                    name = quote.get("longname") or quote.get("shortname") or symbol
                    break

        return {
            "name": name,
            "price": price,
            "change": change if change is not None else 0,
            "changePct": change_pct if change_pct is not None else 0,
        }


async def search_symbols(query: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
        data = await _yahoo_get(
            client, "/v1/finance/search", {"q": query, "quotesCount": 15, "newsCount": 0}
        )
    results = []
    for quote in (data or {}).get("quotes", []):
        symbol = quote.get("symbol")
        if not symbol or quote.get("quoteType") not in ("EQUITY", "ETF", "INDEX"):
            continue
        results.append(
            {
                "symbol": symbol,
                "name": quote.get("longname") or quote.get("shortname") or symbol,
                "exchange": quote.get("exchDisp", ""),
            }
        )
    return results
