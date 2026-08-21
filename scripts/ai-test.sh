#!/usr/bin/env bash
# Verifies the Gemini proxy end to end.
set -u

API="${API:-http://localhost:8000/api}"

echo "=== ai configured? ==="
curl -s "$API/health" | grep -o '"aiConfigured":[a-z]*'

echo "=== generate ==="
curl -s -X POST "$API/ai/generate" -H 'Content-Type: application/json' \
  -d '{"prompt":"用繁體中文一句話回答：什麼是停損？"}'; echo

echo "=== chat (with stock context) ==="
curl -s -X POST "$API/ai/chat" -H 'Content-Type: application/json' -d '{
  "messages":[{"role":"user","text":"NVDA 最近的收盤價是多少？漲還是跌？"}],
  "context":"NVDA (NVIDIA Corporation): latest close 223.96, previous close 218.99, change +4.97 (+2.27%). Recent closes: 2026-07-31 215.40, 2026-08-03 218.99, 2026-08-04 223.96",
  "lang":"zh"
}'; echo
