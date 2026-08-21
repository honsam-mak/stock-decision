#!/usr/bin/env bash
# End-to-end smoke test against the running stack.
set -u

API="${API:-http://localhost:8000/api}"
WEB="${WEB:-http://localhost:8080}"

echo "=== health ==="
curl -s "$API/health"; echo

echo "=== write stock ==="
curl -s -X PUT "$API/collections/stocks/smoke-test" \
  -H 'Content-Type: application/json' \
  -d '{"symbol":"NVDA","name":"NVIDIA","isActive":true,"order":0}'; echo

echo "=== read stock ==="
curl -s "$API/collections/stocks/smoke-test"; echo

echo "=== merge update ==="
curl -s -X PUT "$API/collections/stocks/smoke-test?merge=true" \
  -H 'Content-Type: application/json' -d '{"isActive":false}'; echo

echo "=== list stocks ==="
curl -s "$API/collections/stocks"; echo

echo "=== batch ==="
curl -s -X POST "$API/batch" -H 'Content-Type: application/json' \
  -d '[{"op":"set","collection":"records","id":"smoke-rec","data":{"symbol":"NVDA","action":"buy","qty":10},"merge":false}]'; echo

echo "=== nested doc (simulation with portfolio + history) ==="
curl -s -X PUT "$API/collections/simulations/smoke-sim" -H 'Content-Type: application/json' \
  -d '{"name":"smoke","balance":100000,"portfolio":{"NVDA":10,"TSLA":5},"history":[{"day":"2026-01-02","commands":"BUY NVDA #10 OPEN","executions":[{"type":"BUY","qty":10,"executedPrice":140.5}],"balanceAfter":98595}]}'; echo

echo "=== quote ==="
curl -s "$API/market/quote?symbol=NVDA"; echo

echo "=== history (first 300 chars) ==="
curl -s "$API/market/history?symbol=NVDA" | cut -c1-300; echo

echo "=== history bar count ==="
curl -s "$API/market/history?symbol=NVDA" | grep -o '"date"' | wc -l

echo "=== symbol search ==="
curl -s "$API/market/search?q=apple" | cut -c1-300; echo

echo "=== cleanup ==="
curl -s -X DELETE "$API/collections/stocks/smoke-test"; echo
curl -s -X DELETE "$API/collections/records/smoke-rec"; echo
curl -s -X DELETE "$API/collections/simulations/smoke-sim"; echo

echo "=== frontend http status ==="
curl -s -o /dev/null -w '%{http_code}\n' "$WEB/"

echo "=== frontend -> backend proxy ==="
curl -s "$WEB/api/health"; echo
