"""Normalise stock symbols that were stored with stray whitespace.

Early versions of the checklist wrote the search box contents verbatim, so a
symbol typed with a trailing space ("ONDS ") was stored that way and every
later price lookup for it silently returned nothing.

Usage:
    python3 scripts/fix_symbols.py           # report only
    python3 scripts/fix_symbols.py --apply   # write the fixes
"""

import json
import sys
import urllib.request

API = "http://localhost:8000/api"
APPLY = "--apply" in sys.argv


def request(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        f"{API}{path}", data=data, method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as res:
        return json.load(res)


def clean(value):
    return (value or "").strip().upper()


def fix_collection(collection, label):
    fixed = 0
    for doc in request("GET", f"/collections/{collection}"):
        symbol = doc.get("symbol")
        if not isinstance(symbol, str) or symbol == clean(symbol):
            continue
        fixed += 1
        print(f"  {label}: {symbol!r} -> {clean(symbol)!r}  (id={doc.get('id')})")
        if APPLY:
            request(
                "PUT",
                f"/collections/{collection}/{doc['id']}?merge=true",
                {"symbol": clean(symbol)},
            )
    return fixed


print("Scanning for symbols with stray whitespace...\n")
total = fix_collection("stocks", "stock")
total += fix_collection("records", "record")

# Cache documents are keyed by symbol, so a bad key has to be re-created.
for doc in request("GET", "/collections/market_data_cache"):
    doc_id = doc.get("id", "")
    if doc_id == clean(doc_id):
        continue
    total += 1
    print(f"  cache: {doc_id!r} -> {clean(doc_id)!r}")
    if APPLY:
        payload = {**doc, "symbol": clean(doc_id), "id": clean(doc_id)}
        request("PUT", f"/collections/market_data_cache/{clean(doc_id)}", payload)
        request("DELETE", f"/collections/market_data_cache/{doc_id}")

if total == 0:
    print("Nothing to fix.")
elif APPLY:
    print(f"\nFixed {total} document(s).")
else:
    print(f"\n{total} document(s) need fixing. Re-run with --apply to write them.")
