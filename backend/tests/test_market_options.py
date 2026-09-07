import asyncio
import time

import pytest
from fastapi import HTTPException

from app import main, market
from app.auth import AuthUser


def yahoo_payload():
    expiry = 1789689600  # 2026-09-18 UTC
    return {
        "optionChain": {
            "result": [{
                "underlyingSymbol": "AAPL",
                "expirationDates": [expiry],
                "quote": {"regularMarketPrice": 255.0},
                "options": [{
                    "expirationDate": expiry,
                    "calls": [{
                        "contractSymbol": "AAPL260918C00250000",
                        "strike": 250,
                        "bid": 8,
                        "ask": 10,
                        "lastPrice": 8.5,
                        "volume": 20,
                        "openInterest": 300,
                        "impliedVolatility": 0.31,
                        "inTheMoney": True,
                        "expiration": expiry,
                    }],
                    "puts": [{
                        "contractSymbol": "AAPL260918P00250000",
                        "strike": 250,
                        "bid": None,
                        "ask": None,
                        "lastPrice": 4.25,
                        "impliedVolatility": 0.29,
                        "expiration": expiry,
                    }],
                }],
            }]
        }
    }


def test_parses_expirations_and_option_chain():
    payload = yahoo_payload()
    metadata = market._parse_option_expirations(payload, "AAPL")
    chain = market._parse_option_chain(payload, "AAPL", "2026-09-18")

    assert metadata["expirations"] == ["2026-09-18"]
    assert metadata["_expirationTimestamps"]["2026-09-18"] == 1789689600
    assert chain["underlyingPrice"] == 255.0
    assert chain["calls"][0] == {
        "contractSymbol": "AAPL260918C00250000",
        "optionType": "call",
        "strike": 250.0,
        "expiry": "2026-09-18",
        "bid": 8.0,
        "ask": 10.0,
        "mark": 9.0,
        "last": 8.5,
        "volume": 20,
        "openInterest": 300,
        "iv": 0.31,
        "inTheMoney": True,
        "lastTradeAt": None,
        "quoteStale": False,
        "illiquid": False,
    }
    assert chain["puts"][0]["mark"] == 4.25
    assert chain["puts"][0]["quoteStale"] is True


def test_rejects_empty_results_and_abnormal_iv():
    assert market._parse_option_chain({}, "AAPL", "2026-09-18") is None
    contract = market._map_option_contract(
        {
            "strike": float("nan"),
            "impliedVolatility": 99,
            "lastPrice": float("inf"),
            "volume": "not-a-number",
            "openInterest": float("nan"),
        },
        "call",
    )
    assert contract["iv"] is None
    assert contract["illiquid"] is True
    assert contract["strike"] is None
    assert contract["last"] is None
    assert contract["volume"] == 0
    assert contract["openInterest"] == 0


def test_yahoo_get_falls_back_to_second_host(monkeypatch):
    class Response:
        def __init__(self, status):
            self.status_code = status

        def json(self):
            return {"ok": True}

    class Client:
        def __init__(self):
            self.calls = 0

        async def get(self, *_args, **_kwargs):
            self.calls += 1
            return Response(500 if self.calls == 1 else 200)

    client = Client()
    result = asyncio.run(market._yahoo_get(client, "/test", {}))
    assert result == {"ok": True}
    assert client.calls == 2


def test_yahoo_get_retries_with_cookie_and_crumb():
    class Response:
        def __init__(self, status, body="", payload=None):
            self.status_code = status
            self.text = body
            self._payload = payload

        def json(self):
            return self._payload

    class Client:
        def __init__(self):
            self.urls = []

        async def get(self, url, params=None, **_kwargs):
            self.urls.append((url, params))
            if url == "https://fc.yahoo.com":
                return Response(404)
            if url.endswith("/v1/test/getcrumb"):
                return Response(200, body="crumb-value")
            if params and params.get("crumb") == "crumb-value":
                return Response(200, payload={"optionChain": {"result": []}})
            return Response(401)

    client = Client()
    result = asyncio.run(market._yahoo_get(client, "/v7/finance/options/AAPL", {}))
    assert result == {"optionChain": {"result": []}}
    assert client.urls[-1][1]["crumb"] == "crumb-value"


def test_cache_returns_fresh_then_stale(monkeypatch):
    documents = {}

    monkeypatch.setattr(
        main.store,
        "get_doc",
        lambda collection, doc_id, user_id: documents.get((user_id, doc_id)),
    )

    def set_doc(collection, doc_id, data, merge=False, user_id=None):
        documents[(user_id, doc_id)] = data
        return data

    monkeypatch.setattr(main.store, "set_doc", set_doc)

    async def fresh():
        return {"symbol": "AAPL", "expirations": ["2026-09-18"]}

    first = asyncio.run(main._cached_option_payload("u1", "key", 60, fresh))
    assert first["cacheHit"] is False
    second = asyncio.run(main._cached_option_payload("u1", "key", 60, fresh))
    assert second["cacheHit"] is True

    documents[("u1", "key")]["fetchedAt"] = int(time.time() * 1000) - 120_000

    async def unavailable():
        return None

    stale = asyncio.run(main._cached_option_payload("u1", "key", 60, unavailable))
    assert stale["stale"] is True


def test_option_routes_validate_inputs():
    user = AuthUser(id="owner")
    with pytest.raises(HTTPException) as symbol_error:
        asyncio.run(main.market_option_expirations(" ", user))
    assert symbol_error.value.status_code == 400

    with pytest.raises(HTTPException) as expiry_error:
        asyncio.run(main.market_option_chain("AAPL", "09/18/2026", user))
    assert expiry_error.value.status_code == 400
