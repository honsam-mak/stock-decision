# 股票交易決策系統 (Stock Decision System)

將 Gemini Canvas 上的單檔 React 程式 (`stock_decision_system_v0_83.tsx`) 移植到本機，
以 Docker 執行，資料改存放於本地既有的 OpenSearch。

原版依賴 Firebase (Auth + Firestore)、瀏覽器端的公開 CORS proxy，以及由 Canvas 環境注入的
Gemini 金鑰。本地版把這三者都換掉了，UI 與交易邏輯維持原樣。

## 功能

| 頁籤 | 說明 |
|---|---|
| 交易大廳 | 追蹤股票的即時報價、走勢圖、AI 洞察、手動匯入 HTML 歷史資料 |
| 股票代碼清單 | 新增/移除/啟用停用追蹤標的 |
| 模擬交易大廳 | 以真實歷史股價做回合制回測，含指令語法下單與 AI 決策模型分析 |
| 績效 | 股票與選擇權的交易紀錄、已實現損益、期權未平倉排程 |

## 架構

```
瀏覽器 (React + Vite + Tailwind + Recharts)
        │
   Nginx :8080 ── /api ──►  FastAPI :8000
                                │
                                ├─► OpenSearch :9200   資料持久化 + 行情快取
                                ├─► Yahoo Finance      伺服器端直抓，免 CORS proxy
                                └─► Gemini API         金鑰只存後端
```

### 與原版的對應關係

| 原版 | 本地版 |
|---|---|
| Firebase 匿名登入 | 無登入，單機單使用者 (`LOCAL_USER`) |
| Firestore `doc/setDoc/onSnapshot/writeBatch` | `frontend/src/lib/firestoreShim.js` — 同名 API，改打後端 REST，`onSnapshot` 以輪詢實作 |
| `artifacts/{appId}/users/{uid}/stocks` 等路徑 | 扁平化為 OpenSearch index `sds-stocks` 等 |
| allorigins / codetabs CORS proxy | 後端直接呼叫 Yahoo Finance |
| 前端硬編 Gemini 金鑰 | 後端 `/api/ai/*` 代理，金鑰放 `.env` |

### OpenSearch Index

`sds-stocks`、`sds-simulations`、`sds-records`、`sds-settings`、`sds-market_data_cache`。

文件實際內容存放在 `data` 欄位並關閉索引 (`"enabled": false`)。原因是 `portfolio` 以股票代碼
為動態鍵、`history` 是數百筆 OHLC 陣列，若讓 OpenSearch 逐欄位建索引會造成 mapping 爆炸。

## 前置需求

- WSL + Docker
- 一個執行中的 OpenSearch 容器，且掛在 `opensearch-net` 這個 docker network 上

本專案的 `docker-compose.yml` 以 `external: true` 沿用該網路，不會另外開一份 OpenSearch。

## 啟動與關閉

> Docker 只安裝在 WSL 內，PowerShell 打 `docker` 會找不到指令。
> 請先開 **Ubuntu (WSL) 終端機**，或在 PowerShell 打 `wsl` 進入。

```bash
cd /mnt/c/Apps/stock-decision
```

### 開啟

```bash
bash scripts/start.sh
```

會自動檢查並啟動 OpenSearch，再把前後端拉起來。之後開 http://localhost:8080

### 關閉

```bash
bash scripts/stop.sh                    # 只關本程式，OpenSearch 保持執行
bash scripts/stop.sh --with-opensearch  # 連 OpenSearch 一起關掉
```

因為 OpenSearch 可能被你機器上其他專案共用，預設不會動它。

### 不用腳本的話

```bash
docker start opensearch     # OpenSearch 沒有 restart 政策，開機後要手動啟動
docker compose up -d        # 開啟
docker compose down         # 關閉
```

改過程式碼後要重新建置：`docker compose up -d --build`

### 常用檢查

```bash
docker compose ps                        # 容器狀態
docker compose logs -f backend           # 看後端日誌
curl -s http://localhost:8000/api/health # 健康檢查
```

關閉不會遺失資料，所有內容都存在 OpenSearch 的 `sds-*` 索引裡。

## 設定 (`.env`)

| 變數 | 預設 | 說明 |
|---|---|---|
| `OPENSEARCH_HOST` | `http://opensearch:9200` | 現有容器停用了 security plugin，故為純 HTTP 免帳密 |
| `OPENSEARCH_USER` / `OPENSEARCH_PASSWORD` | 空 | 若日後啟用 security plugin 才需要 |
| `INDEX_PREFIX` | `sds` | Index 名稱前綴 |
| `GEMINI_API_KEY` | 空 | 留空則 AI 功能停用，其餘功能不受影響。金鑰申請：https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | `gemini-3.5-flash` | 見下方說明 |
| `ALPHA_VANTAGE_KEY` | 空 | Yahoo 抓不到時的備援資料源 |
| `FRONTEND_PORT` / `BACKEND_PORT` | `8080` / `8000` | |

Alpha Vantage 金鑰也可以直接在 UI 的「API 金鑰設定」填寫，會存進 OpenSearch 並優先於 `.env`。

### 關於 Gemini 模型

原版寫死的 `gemini-2.5-flash-preview-09-2025` 以及整個 `gemini-2.x` 系列，對於**新申請的 API 金鑰
已不再開放**，呼叫會得到 404 `no longer available to new users`。此處預設改用 `gemini-3.5-flash`。

若日後換金鑰後 AI 無回應，可用以下指令確認該金鑰實際可用的模型：

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" \
  | grep '"name"'
```

模型列表會列出所有模型，但不代表你的金鑰都有權限，仍需實際呼叫 `:generateContent` 驗證。
後端在遇到 4xx 時會直接把錯誤訊息寫進日誌 (`docker logs sds-backend`) 而不重試。

### `.env` 必須是 LF 行尾

Docker Compose 讀取 `.env` 時不會去除行尾的 `\r`，CRLF 會讓金鑰結尾多出一個控制字元而失效。
專案內的 `.gitattributes` 已強制 LF；若在 Windows 上手動編輯過，可用 `sed -i 's/\r$//' .env` 修正。

## API

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/api/health` | 健康檢查，含 OpenSearch 狀態與 AI 是否已設定 |
| GET | `/api/collections/{collection}` | 列出集合內所有文件 |
| GET/PUT/DELETE | `/api/collections/{collection}/{id}` | 單一文件讀寫刪，`PUT` 支援 `?merge=true` |
| POST | `/api/batch` | 批次寫入/刪除 |
| GET | `/api/market/history?symbol=&avKey=` | 兩年日線 OHLC |
| GET | `/api/market/quote?symbol=` | 即時報價 |
| GET | `/api/market/search?q=` | 代碼搜尋 |
| POST | `/api/ai/generate`、`/api/ai/chat` | Gemini 代理 |

FastAPI 互動式文件：http://localhost:8000/docs

## 開發

前端熱重載（後端仍跑在 Docker 內）：

```bash
cd frontend
npm install
VITE_API_TARGET=http://localhost:8000 npm run dev
```

後端本機執行：

```bash
cd backend
pip install -r requirements.txt
OPENSEARCH_HOST=http://localhost:9200 uvicorn app.main:app --reload
```

## 測試

```bash
bash scripts/smoke-test.sh   # 資料層與行情
bash scripts/ai-test.sh      # Gemini 代理
```

`smoke-test.sh` 涵蓋健康檢查、文件讀寫/合併/批次、巢狀模擬文件往返、真實報價與歷史抓取、
代碼搜尋，以及前端與其 API 代理。`ai-test.sh` 會實際呼叫一次 Gemini 並驗證回覆有引用給定的股價資料。

## 維護：股票代碼含空白

若某支股票的股價「永遠更新失敗」、只顯示明顯不合理的價格，多半是代碼被存成 `'ONDS '` 這種
帶空白的字串，向 Yahoo 查 `ONDS%20` 自然查不到，程式便退回自動產生的模擬價格。

新增股票時已會自動 trim，後端查詢也會去除空白。若要修正既有資料：

```bash
python3 scripts/fix_symbols.py           # 只檢查，不修改
python3 scripts/fix_symbols.py --apply   # 實際修正
```

會一併清理交易紀錄裡的代碼，否則績效頁會把 `'ONDS '` 與 `'ONDS'` 當成兩檔不同的股票分開計算損益。

## 備份

UI 側邊欄的「匯出備份 (JSON)」與「匯入還原」沿用原版行為，匯入為智慧合併，不會刪除既有資料。

## 已知差異

- `onSnapshot` 改為每 2 秒輪詢（本地寫入後會立即重讀），非 Firestore 的即時推送。單機使用無感。
- 「股票代碼清單」的搜尋沿用原版內建的 13 檔清單；輸入任意代碼可用「自訂股票」新增，名稱會由後端自動補上。
- QR Code 分享功能仍呼叫外部 `api.qrserver.com` 產圖。
