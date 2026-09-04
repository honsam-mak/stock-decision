# 股票交易決策系統 (Stock Decision System)

將 Gemini Canvas 上的單檔 React 程式 (`stock_decision_system_v0_83.tsx`) 移植為可在兩種環境執行的應用：

- 本機：Docker + OpenSearch，預設不登入。
- 雲端：GitHub + Vercel + Supabase PostgreSQL，使用 Supabase Auth 單一 owner 登入。

原版依賴 Firebase (Auth + Firestore)、瀏覽器端的公開 CORS proxy，以及由 Canvas 環境注入的
Gemini 金鑰。現在資料層可切換 OpenSearch / PostgreSQL，UI 與交易邏輯維持相同。

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

雲端由 Vercel 同網域提供 `frontend/dist` 與 `/api/*` FastAPI Function；FastAPI 驗證
Supabase access token 後，透過 transaction pooler 存取 PostgreSQL。

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
| `STORE_BACKEND` | `opensearch` | 本機用 `opensearch`；Vercel 用 `postgres` |
| `OPENSEARCH_HOST` | `http://opensearch:9200` | 現有容器停用了 security plugin，故為純 HTTP 免帳密 |
| `OPENSEARCH_USER` / `OPENSEARCH_PASSWORD` | 空 | 若日後啟用 security plugin 才需要 |
| `INDEX_PREFIX` | `sds` | Index 名稱前綴 |
| `DATABASE_URL` | 空 | Supabase transaction pooler URL；雲端需設 `sslmode=require` |
| `AUTH_DISABLED` | `true` | 本機為 `true`；Vercel 必須為 `false` |
| `SUPABASE_URL` | 空 | Supabase project URL，供後端驗 JWT |
| `OWNER_USER_ID` / `OWNER_EMAIL` | 空 | 雲端允許登入的唯一 owner，至少設定一項 |
| `CORS_ORIGINS` | `*` | 逗號分隔的允許來源；同網域部署可設正式站 URL |
| `GEMINI_API_KEY` | 空 | 留空則 AI 功能停用，其餘功能不受影響。金鑰申請：https://aistudio.google.com/apikey |
| `GEMINI_MODEL` | `gemini-3.5-flash` | 見下方說明 |
| `ALPHA_VANTAGE_KEY` | 空 | Yahoo 抓不到時的備援資料源 |
| `FRONTEND_PORT` / `BACKEND_PORT` | `8080` / `8000` | |

前端雲端 build 另需 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`。它們是 Supabase
允許公開使用的 client 設定；資料庫密碼、Gemini key 不可使用 `VITE_` 前綴。

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

## 部署到 GitHub、Vercel 與 Supabase

### 1. 建立 Supabase project

1. 在 SQL Editor 執行 `supabase/migrations/20260904120000_create_documents.sql`。
2. 在 Authentication 建立自己的使用者，並記下使用者 UUID；若使用 magic link，把
   Vercel Preview 與 Production URL 加到 Authentication 的 redirect URLs。
3. 在 Database → Connect 複製 **Transaction pooler** 連線字串（port 6543），將密碼填入並加入
   `?sslmode=require`。不要把此字串放進前端環境變數或 Git。

資料表已啟用 RLS 並撤銷 anon/authenticated 的 Data API 權限；只有持有資料庫連線字串的
FastAPI 能讀寫，而且每筆資料皆以 JWT 的 user ID 隔離。

### 2. 將 repository 連接 Vercel

把本專案 push 到 GitHub，然後在 Vercel 匯入該 repository。專案根目錄維持 repository root；
`vercel.json` 會建置 `frontend/dist`，並把 `/api/*` 交給 `api/index.py`。

在 Vercel 的 Preview 與 Production environments 設定：

```dotenv
STORE_BACKEND=postgres
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?sslmode=require
AUTH_DISABLED=false
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_JWT_AUDIENCE=authenticated
OWNER_USER_ID=YOUR_SUPABASE_USER_UUID
CORS_ORIGINS=https://YOUR_PROJECT.vercel.app
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash
ALPHA_VANTAGE_KEY=
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

若只使用 `OWNER_EMAIL`，亦可不設 `OWNER_USER_ID`；UUID 較不受 email 變更影響，建議優先使用。
部署後先開 Preview URL 登入，再檢查 `/api/health`、新增一支股票與 JSON 往返匯入。

## 測試

```bash
bash scripts/smoke-test.sh   # 資料層與行情
bash scripts/ai-test.sh      # Gemini 代理
python -m pytest backend/tests
npm --prefix frontend test
npm --prefix frontend run build
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

UI 側邊欄的「匯出備份 (JSON)」與「匯入還原」使用同一個跨環境格式，匯入為智慧合併，
不會刪除既有資料。

- 舊版 `1.0` 或未標版本的本機備份可匯入本機及雲端。
- 新版 `1.1` 保留舊版頂層欄位，並加入 canonical IDs 與行情快取，因此可在更新後的本機與雲端雙向交換。
- Alpha Vantage key 不會寫進新版備份；匯入舊備份時也不會覆寫現有 key。
- 缺少 ID 的舊交易會產生內容穩定的 ID，重複匯入不會反覆新增同一筆資料。

## 已知差異

- `onSnapshot` 改為每 2 秒輪詢（本地寫入後會立即重讀），非 Firestore 的即時推送。單機使用無感。
- 「股票代碼清單」的搜尋沿用原版內建的 13 檔清單；輸入任意代碼可用「自訂股票」新增，名稱會由後端自動補上。
- QR Code 分享功能仍呼叫外部 `api.qrserver.com` 產圖。
