// Stock Decision v0.83 - local port (OpenSearch backend)
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, collection, doc, setDoc, onSnapshot, deleteDoc, getDoc, writeBatch } from './lib/firestoreShim.js';
import { api } from './lib/api.js';
import {
  LOCAL_USER,
  getCurrentSession,
  isCloudAuthEnabled,
  onSessionChange,
  sendMagicLink,
  sessionUser,
  signInWithPassword,
  signOut,
} from './lib/auth.js';
import { createBackup, parseBackup } from './lib/backup.js';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LabelList, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { 
  TrendingUp, TrendingDown, LayoutDashboard, ListTodo, Database, 
  Swords, Plus, Trash2, Edit2, Download, Upload, Play, 
  Save, X, ChevronRight, Search, Clock, CheckCircle2, AlertCircle, RefreshCw, Brain, DownloadCloud,
  HelpCircle, Globe, Settings, Power, Loader2, QrCode, Sparkles, Bot, MessageSquare, Send, UploadCloud, PieChart as PieChartIcon, FileText, Calendar, Activity
} from 'lucide-react';

// --- 0. System Version ---
const SYSTEM_VERSION = "beta v0.83";

// --- 1. Local backend (replaces Firebase) ---
const appId = 'stock-decision-system';

// --- 2. i18n Dictionary ---
const TRANSLATIONS = {
  en: {
    "交易決策系統": "Trading Decision System",
    "語言": "Language",
    "交易大廳": "Dashboard",
    "股票代碼清單": "Stock Checklist",
    "模擬交易大廳": "War Room",
    "績效": "Performance",
    "資料管理 (Data)": "Data Management",
    "匯出備份 (JSON)": "Export Backup (JSON)",
    "匯入還原": "Import Backup",
    "系統初始化中...": "System Initializing...",
    "決策系統": "Decision System",
    "登入失敗，請重新載入": "Login failed, please reload",
    "資料智慧合併匯入成功！": "Data merged successfully!",
    "匯入失敗：檔案格式不正確": "Import failed: Invalid format",
    "確認匯入備份": "Confirm backup import",
    "將合併以下資料，不會刪除現有資料": "The following data will be merged; existing data will not be deleted",
    "模擬": "simulations",
    "交易紀錄": "records",
    "行情快取": "market cache entries",
    
    // Dashboard & Settings
    "交易大廳總覽": "Dashboard Overview",
    "大廳空空如也": "Dashboard is Empty",
    "請前往「股票代碼清單」新增您想追蹤的標的。": "Go to 'Stock Checklist' to add target stocks.",
    "刪除股票": "Delete Stock",
    "確定要將": "Are you sure you want to remove",
    "從追蹤清單移除嗎？": "from the watchlist?",
    "重新抓取真實股價": "Refetch Real Price",
    "編輯名稱": "Edit Name",
    "刪除": "Delete",
    "API 失效 (備用資料)": "API Failed (Fallback Data)",
    "無法抓取": "Failed to fetch",
    "真實資料，維持備用資料。": "real data, keeping fallback.",
    "真實股價更新成功！": "Real price updated successfully!",
    "載入歷史股價中...": "Loading historical prices...",
    "請輸入新的股票/公司名稱": "Enter new stock/company name",
    "儲存": "Save",
    "API 金鑰設定": "API Key Settings",
    "外部備援資料源設定": "External Fallback API Settings",
    "當系統預設的資料源無法抓取特定小型股或新創股時，將會自動使用此備援 API 進行抓取。": "When the default data source fails to fetch specific small-cap stocks, this fallback API will be used automatically.",
    "Alpha Vantage 金鑰 (免費)": "Alpha Vantage API Key (Free)",
    "取得免費金鑰": "Get Free Key",
    "設定已儲存": "Settings saved",
    "已停用": "Inactive",
    "已啟用": "Active",
    "切換狀態": "Toggle Status",
    "此股票已停用，請先啟用才能同步真實資料": "This stock is inactive. Please activate it to sync real data.",
    "真實資料同步失敗，已保留您手動匯入或先前的歷史紀錄。": "Real data sync failed, retained manual or previous historical records.",
    "計算中...": "Calculating...",
    "手動匯入 HTML 歷史資料": "Manual HTML History Import",
    "無法解析 HTML 中的表格資料，請確認格式。": "Cannot parse table data from HTML, please check the format.",
    "匯入失敗，發生未知的錯誤。": "Import failed, unknown error occurred.",
    "成功匯入": "Successfully imported",
    "筆資料": "records",
    "同步失敗，點擊重試": "Sync failed, click to retry",
    "同步成功": "Synced successfully",

    // Records
    "交易績效總覽": "Trading Performance",
    "檢視您所有紀錄的交易損益與資產表現。": "View your trading profit/loss and asset performance.",
    "新增交易記錄": "Add Record",
    "尚未有任何交易記錄": "No trading records found.",
    "總利潤 (Gain)": "Total Gain",
    "總虧損 (Loss)": "Total Loss",
    "淨損益 (Net)": "Net PnL",
    "尚無已實現損益": "No realized PnL yet",
    "詳細交易日誌": "Detailed Trade Log",
    "結算交易": "Settled Trades",
    "期權未平倉排程": "Option Schedule",
    "尚無未平倉的期權部位": "No open option positions",
    "選擇股票": "Select Stock",
    "輸入原始交易紀錄 (例如: Sell ONDS 300@9.5 2026/4/24)": "Enter raw trade record (e.g., Sell ONDS 300@9.5 2026/4/24)",
    "✨ AI 智慧解析": "✨ AI Smart Parse",
    "資產類別": "Asset Class",
    "資產名稱": "Asset Name",
    "動作": "Action",
    "數量": "Quantity",
    "價格": "Price",
    "乘數 (Option通常為100)": "Multiplier (usually 100 for options)",
    "日期": "Date",
    "記錄已儲存！": "Record saved successfully!",
    "為精確計算賺賠，請確保買入與賣出紀錄皆有登記。": "To accurately calculate PnL, ensure both buy and sell records are registered.",
    "買入": "Buy",
    "賣出": "Sell",
    "到期": "Expire",
    "到期獲利": "Expire (Gain)",
    "到期虧損": "Expire (Loss)",
    "解析動作": "Parsed Action",
    "股票": "Stock",
    "選擇權": "Option",
    "口": " contracts",
    "只顯示已結算交易": "Show settled trades only",
    "獲利": "Gained",
    "虧損": "Loss",
    "平倉交易": "Close Trade",
    "平倉": "Close",
    "執行": "Execute",
    "平倉動作": "Close Action",
    "目前未平倉數量": "Open Quantity",
    "成交價（每股／每份）": "Execution Price (per share/contract)",
    "履約價": "Strike Price",
    "原始 premium": "Original premium",
    "原始動作": "Original Action",
    "將新增交易": "The following transaction will be added",
    "確認交易": "Confirm Trade",
    "交易已儲存！": "Trade saved successfully!",
    "請輸入有效的價格": "Please enter a valid price.",
    "請輸入有效的數量": "Please enter a valid quantity.",
    "平倉數量不可超過未平倉數量": "Close quantity cannot exceed open quantity.",
    "請輸入有效的日期": "Please enter a valid date.",
    "找不到有效的未平倉數量": "No valid open quantity was found.",
    "原交易數量": "Original Quantity",
    "Option 名稱缺少 Call/Put": "The option name is missing Call/Put.",
    "無法解析履約價，請輸入履約價": "Strike price could not be parsed; please enter it.",
    "點擊以平倉": "Click to close this trade",
    "到期／執行日期": "Expiration/Execution Date",

    // AI Features & Chat
    "✨ AI 洞察": "✨ AI Insights",
    "AI 正在分析...": "AI is analyzing...",
    "AI 分析失敗，請稍後再試。": "AI analysis failed, please try again later.",
    "✨ AI 輔助下單": "✨ AI Assist",
    "白話文下單 (自然語言)": "Natural Language Ordering",
    "請輸入您的想法，例如：「幫我買 100 股蘋果，用開盤價買入」或「把手上所有的特斯拉在收盤時賣掉」": "Enter your idea, e.g., 'Buy 100 shares of Apple at open' or 'Sell all TSLA at close'",
    "轉換為系統指令": "Convert to Command",
    "指令轉換成功": "Command successfully converted",
    "AI 轉換失敗，請重新嘗試。": "AI conversion failed, please try again.",
    "AI 助理": "AI Assistant",
    "✨ AI 投資助理": "✨ AI Investment Assistant",
    "清除對話": "Clear",
    "發送": "Send",
    "輸入問題 (例如：NVDA 最近5天最高價是多少？)": "Ask a question (e.g., What was NVDA's highest price in the last 5 days?)",
    "您好！我是您的專屬 AI 投資助理。您可以問我關於目前大廳中已啟用 (Active) 股票的任何歷史資料與近期走勢問題！": "Hello! I'm your AI investment assistant. Ask me anything about the historical data and recent trends of your active stocks!",
    "API 連線失敗，請稍後再試。": "API connection failed, please try again later.",

    // QR Code Modal
    "網頁 QR Code": "Webpage QR Code",
    "手機掃描開啟": "Scan to open on mobile",
    "跨裝置分享": "Cross-Device Share",
    "預覽環境提示：": "Preview Environment Notice: ",
    "您目前處於測試沙盒中 (blob 網址)。請在下方貼上您產生的公開連結 (例如 Gemini 分享連結) 來產生可掃描的 QR Code。": "You are currently in a test sandbox (blob URL). Please paste your generated public link (e.g., Gemini share link) below to generate a scannable QR Code.",
    "等待輸入公開網址": "Waiting for public URL",
    "分享網址": "Share URL",
    "關閉視窗": "Close Window",
    "請先輸入網址": "Please enter URL first",
    "複製網址": "Copy URL",
    "網址已複製": "URL Copied",

    // Checklist
    "在此搜尋並配置您欲追蹤與模擬交易的股票標的。": "Search and configure stocks for tracking and simulation.",
    "輸入代碼或公司名稱搜尋 (例如: AAPL)...": "Search symbol or company name (e.g., AAPL)...",
    "搜尋結果": "Search Results",
    "新增": "Add",
    "無符合的股票標的": "No matching stocks",
    "我的追蹤清單": "My Watchlist",
    "尚未加入任何股票": "No stocks added yet",
    "已經在清單中了": "is already in the list",
    "已新增": "Added",
    "已移除股票": "Stock removed",

    // WarRoom List
    "以過往數據為基礎，回合制驗證您的交易策略。": "Validate your trading strategy with historical data turn-by-turn.",
    "建立模擬事件": "Create Simulation",
    "刪除模擬事件": "Delete Simulation Event",
    "確定要刪除此模擬紀錄嗎？將無法復原。": "Are you sure you want to delete this simulation? It cannot be undone.",
    "已結束": "Completed",
    "進行中": "Active",
    "起始日:": "Start Date:",
    "當前資金": "Current Funds",
    "尚未建立任何模擬交易": "No simulation created yet",
    "建立第一場模擬": "Create First Simulation",
    "創建模擬交易事件": "Create Simulation Event",
    "事件名稱": "Event Name",
    "例如：2023科技股波段測試": "e.g., 2023 Tech Stocks Swing Test",
    "模擬起始日 (基準)": "Simulation Start Date (Base)",
    "初始模擬資金：$100,000": "Initial Funds: $100,000",
    "標的池：當前「股票代碼清單」中所有股票": "Target Pool: All stocks in 'Stock Checklist'",
    "歷史資料：真實市場歷史股價 (或備援資料)": "History Data: Real market prices (or fallback)",
    "取消": "Cancel",
    "建立並開始": "Create & Start",
    "請先在清單加入股票再建立模擬": "Please add stocks to checklist before creating a simulation",
    "正在載入歷史股價，請稍後再建立": "Loading historical prices, please try again later",
    "模擬交易事件已建立": "Simulation event created",

    // WarRoom Active
    "當前日期:": "Current Date:",
    "回合": "Turn",
    "可用資金": "Available Funds",
    "盤前價格走勢 (前60天)": "Pre-market Price Trend (Last 60 Days)",
    "當前持股 (Portfolio)": "Current Portfolio",
    "尚無任何持股": "No holdings yet",
    "股": "shares",
    "待執行暫存區": "Staged Commands Area",
    "筆": "items",
    "尚無暫存指令。您可以輸入指令後點擊「加入暫存」。如果直接進入下一天，將會跳過本日不交易。": "No staged commands. Enter commands and click 'Stage'. Skipping will execute no trades today.",
    "草稿輸入區": "Draft Input Area",
    "語法例: BUY $ALL #10 OPEN": "Syntax: BUY $ALL #10 OPEN",
    "輸入您的當天交易指令...\n例如：SELL TSLA #5 CLOSE": "Enter your trading commands...\ne.g., SELL TSLA #5 CLOSE",
    "加入暫存": "Stage",
    "提早結束模擬": "End Simulation Early",
    "執行暫存清單 & 進入下一天": "Execute Staged & Next Day",
    "🤖 產生 AI 決策模型": "🤖 Generate AI Decision Model",
    "檢視 AI 決策模型": "View AI Decision Model",
    "時光跳轉:": "Time Jump:",
    "跳至該日": "Jump to Date",
    "執行日誌": "Execution Log",
    "尚無交易紀錄": "No transaction records",
    "當日策略": "Daily Strategy",
    "已成交 @ $": "Filled @ $",
    "未達條件": "Condition not met",
    "失敗:": "Failed: ",
    "無可執行的有效指令": "No valid commands to execute",
    "餘額:": "Balance: ",
    "🤖 AI 決策模型 (Pattern) 分析": "🤖 AI Decision Model (Pattern) Analysis",
    "分析前備註 (選填)：讓 AI 知道你當時的想法或特定策略": "Pre-analysis Notes (Optional): Let AI know your thoughts or specific strategies",
    "例如：我這次主要是測試跌破月線就停損，並且觀察資金流動的變化...": "e.g., I was testing a stop-loss strategy when the price drops below the monthly moving average...",
    "尚未產生分析報告。\n請填寫上方備註 (可選)，並點擊下方按鈕，讓系統 AI 根據您過去的歷史交易紀錄與指令，自動演算並總結出您的專屬交易決策模型。": "No analysis report generated yet.\nPlease fill in the optional notes above and click the button below to let the AI summarize your trading decision model based on your historical records.",
    "匯出 Pattern (TXT)": "Export Pattern (TXT)",
    "開始 AI 分析": "Start AI Analysis",
    "重新分析最新紀錄": "Re-analyze Latest Records",
    "AI 深度演算中...": "AI Deep Analyzing...",
    "編輯 (退回草稿)": "Edit (Draft)",
    "指令已加入暫存": "Command staged",
    "選擇的日期超出歷史資料範圍": "Selected date is out of historical data range",
    "跳轉日期必須大於當前日期": "Jump date must be greater than current date",
    "結束模擬": "End Simulation",
    "確定要提早結束本次模擬交易嗎？結束後只能檢視無法再交易。": "Are you sure you want to end this simulation early? You can only view it afterwards.",
    "模擬已結束": "Simulation ended",
    "您可以檢視右側的交易日誌，或者讓 AI 幫助您分析這次的交易決策。": "You can view the trading log on the right, or let AI analyze your trading decisions.",
    "尚無有效的交易紀錄可供分析": "No valid transaction records for analysis",
    "AI 正在深度分析您的交易決策模型...": "AI is deeply analyzing your trading decision model...",
    "AI 分析完成！": "AI Analysis Complete!",
    "決策模型已匯出為 TXT": "Decision model exported to TXT",
    "無此標的資料": "No data for target",
    "餘額不足": "Insufficient funds",
    "持股不足": "Insufficient shares",
    "未達設定價格": "Price not reached",
    "[無交易決策，跳過本日]": "[No trading decision, skipping today]",
    "[系統] 玩家手動將時間跳轉至": "[System] Player manually jumped time to",
    "時間已推進至": "Time advanced to",

    // Modals & Misc
    "匯入備份資料": "Import Backup Data",
    "請選擇您之前匯出的 .json 備份檔案。系統將會進行智慧合併，不會刪除您現有的其他資料。": "Please select your exported .json backup file. The system will smartly merge without deleting your existing data.",
    "點擊選擇檔案": "Click to select file",
    "確認執行": "Confirm",
    "交易指令說明 (Command Syntax Guide)": "Command Syntax Guide",
    "系統已全面升級為英文指令語法，請依照以下格式輸入您的交易決策：": "System commands have been upgraded to English syntax. Please use the following format:",
    "或": "or",
    "全部": "all",
    "或具體價格": "or specific price limit",
    "範例 (Examples):": "Examples:",
    "(加井字號)": "(with hash symbol)",
    "自訂股票代碼": "Custom Stock Symbol",
    "自訂股票": "Custom Stock"
  }
};

const US_STOCKS_MOCK = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'AMD', name: 'Advanced Micro Devices' },
  { symbol: 'TSM', name: 'Taiwan Semiconductor' },
  { symbol: 'PLTR', name: 'Palantir Technologies' },
  { symbol: 'FIG', name: 'Figma Inc.' },
];

// --- 3. Utilities & API Handlers ---
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};

const seededRandom = (seed) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

const parseExpiryDate = (assetName) => {
    const monthMap = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
    const match1 = assetName.match(/(?:^|\s)(\d{1,2})\s+([A-Za-z]{3})(\d{2,4})(?:\s|$)/i);
    if (match1) {
        const day = parseInt(match1[1]);
        const month = monthMap[match1[2].toLowerCase()];
        let year = parseInt(match1[3]);
        if (year < 100) year += 2000;
        if (month !== undefined) return new Date(year, month, day);
    }
    const match2 = assetName.match(/(?:^|\s)(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s|$)/);
    if (match2) {
        return new Date(parseInt(match2[1]), parseInt(match2[2]) - 1, parseInt(match2[3]));
    }
    return new Date(2099, 11, 31); 
};

const isOptionTrade = (trade) => {
    const assetName = String(trade?.assetName || '');
    return String(trade?.assetClass || '').toLowerCase() === 'option'
        || /Call|Put/i.test(assetName)
        || Number(trade?.multiplier || 1) > 1;
};

const parseOptionDetails = (assetName) => {
    const name = String(assetName || '');
    const typeMatch = name.match(/\b(Call|Put)\b/i);
    const optionType = typeMatch ? typeMatch[1].toLowerCase() : null;
    const strikeMatch = name.match(/\$?(\d+(?:\.\d+)?)\s*(?=Call|Put\b)/i);
    const strike = strikeMatch ? Number(strikeMatch[1]) : null;

    return {
        optionType,
        strike: Number.isFinite(strike) ? strike : null
    };
};

const getLocalDateInputValue = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const generateFallbackStockHistory = (symbol, days = 600) => {
  const history = [];
  const seedBase = hashString(symbol);
  let currentPrice = 20 + (seedBase % 480); 
  let currentDate = new Date();
  currentDate.setDate(currentDate.getDate() - days);

  for (let i = 0; i < days; i++) {
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      const dailySeed = seedBase + i;
      const changePercent = (seededRandom(dailySeed) - 0.48) * 0.03;
      const open = currentPrice;
      const close = currentPrice * (1 + changePercent);
      history.push({
        date: currentDate.toISOString().split('T')[0],
        open: Number(open.toFixed(2)),
        high: Number(Math.max(open, close) * 1.01).toFixed(2),
        low: Number(Math.min(open, close) * 0.99).toFixed(2),
        close: Number(close.toFixed(2)),
        volume: Math.floor(1000000 + seededRandom(dailySeed + 3) * 5000000),
        isMock: true
      });
      currentPrice = close;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return history;
};

const validateHistory = (hist) => {
  if (!hist || hist.length < 2) return hist;
  const sorted = hist.sort((a, b) => new Date(a.date) - new Date(b.date));
  const lastDate = new Date(sorted[sorted.length - 1].date);
  const prevDate = new Date(sorted[sorted.length - 2].date);
  if ((lastDate - prevDate) / 86400000 > 30) {
    console.warn("Detected corrupted sparse history with massive gap. Rejecting.");
    return null;
  }
  return sorted;
};

const extractHistoryFromYahooHtml = (symbol, htmlText) => {
  const pricesMatch = htmlText.match(/"HistoricalPriceStore":\{"prices":(\[.*?\])\}/) || htmlText.match(/"prices":(\[.*?\])/);
  if (pricesMatch) {
     try {
       const prices = JSON.parse(pricesMatch[1]);
       const history = [];
       for (const p of prices) {
           if (p.open !== undefined && p.close !== undefined && p.date) {
               const d = new Date(p.date * 1000);
               const formattedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
               history.push({
                   date: formattedDate,
                   open: Number(p.open).toFixed(2) * 1,
                   high: Number(p.high || p.open).toFixed(2) * 1,
                   low: Number(p.low || p.open).toFixed(2) * 1,
                   close: Number(p.close).toFixed(2) * 1,
                   volume: p.volume || 0,
                   isMock: false
               });
           }
       }
       if (history.length > 0) {
           const valid = validateHistory(history);
           if (valid) return valid;
       }
     } catch(e) {}
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const tables = doc.querySelectorAll('table');
  let targetTable = null;
  for (let i = 0; i < tables.length; i++) {
     const t = tables[i];
     const ths = Array.from(t.querySelectorAll('th')).map(th => th.textContent.toLowerCase());
     if (ths.some(h => h.includes('open')) && ths.some(h => h.includes('volume'))) {
        targetTable = t;
        break;
     }
  }
  if (targetTable) {
     const rows = targetTable.querySelectorAll('tbody tr');
     const history = [];
     rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 6) {
           const dateStr = cells[0].textContent.trim();
           const openStr = cells[1].textContent.trim().replace(/,/g, '');
           const highStr = cells[2].textContent.trim().replace(/,/g, '');
           const lowStr = cells[3].textContent.trim().replace(/,/g, '');
           const closeStr = cells[4].textContent.trim().replace(/,/g, '');
           const volIdx = cells.length >= 7 ? 6 : 5;
           const volStr = cells[volIdx].textContent.trim().replace(/,/g, '');
           const timestamp = Date.parse(dateStr);
           if (!isNaN(timestamp) && openStr !== '-' && !isNaN(parseFloat(openStr))) {
              const d = new Date(timestamp);
              const formattedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              history.push({
                 date: formattedDate,
                 open: Number(parseFloat(openStr).toFixed(2)),
                 high: Number(parseFloat(highStr).toFixed(2)),
                 low: Number(parseFloat(lowStr).toFixed(2)),
                 close: Number(parseFloat(closeStr).toFixed(2)),
                 volume: parseInt(volStr, 10) || 0,
                 isMock: false
              });
           }
        }
     });
     if (history.length > 0) {
        const valid = validateHistory(history);
        if (valid) return valid;
     }
  }
  return null;
};

// The backend performs the Yahoo Finance / Alpha Vantage lookups directly, so
// the public CORS proxies the original browser version relied on are gone.
const fetchRealStockHistory = async (symbol, alphaVantageKey = null) => {
  try {
    const { history } = await api.history(symbol, alphaVantageKey || '');
    return history && history.length > 0 ? validateHistory(history) : null;
  } catch (e) {
    console.error('history fetch failed', symbol, e);
    return null;
  }
};

const fetchRealStockQuote = async (symbol) => {
  try {
    const { quote } = await api.quote(symbol);
    return quote || null;
  } catch (e) {
    console.error('quote fetch failed', symbol, e);
    return null;
  }
};

const parseCommands = (text, lang) => {
  const lines = text.split('\n');
  const actions = [];
  const regex = /(BUY|SELL)\s+([A-Za-z0-9\-\.]+|\$ALL)\s+#(\d+)(?:\s+(?:AT|@))?\s+(OPEN|CLOSE|\d+(?:\.\d+)?)/i;
  
  lines.forEach(line => {
    if (!line.trim()) return;
    const match = line.match(regex);
    if (match) {
      const type = match[1].toUpperCase();
      const symbol = match[2].toUpperCase();
      const qty = parseInt(match[3], 10);
      const priceStr = match[4].toUpperCase();
      let priceType = 'LIMIT';
      let price = null;
      if (priceStr === 'OPEN') priceType = 'OPEN';
      else if (priceStr === 'CLOSE') priceType = 'CLOSE';
      else price = parseFloat(priceStr);
      actions.push({ type, symbol, qty, priceType, price, raw: line, valid: true });
    } else {
      actions.push({ raw: line, valid: false, error: lang === 'zh' ? '格式無法解析' : 'Invalid Format' });
    }
  });
  return actions;
};

// Gemini is proxied through the backend so the API key stays out of the browser.
const callGeminiAPI = async (prompt) => {
  try {
    const { text } = await api.aiGenerate(prompt);
    return text || null;
  } catch (err) {
    console.error('AI generate failed', err);
    return null;
  }
};

const callGeminiChatAPI = async (messages, contextStr, lang) => {
  try {
    const { text } = await api.aiChat(messages, contextStr, lang);
    return text || null;
  } catch (err) {
    console.error('AI chat failed', err);
    return null;
  }
};

const analyzeTradePatternWithAI = async (simHistory, userNotes = "", lang = 'zh') => {
  const filteredHistory = simHistory.filter(r => !r.commands.includes('[系統] 玩家手動將時間跳轉至') && !r.commands.includes('[System] Player manually jumped time to'));
  const formattedHistory = filteredHistory.map(r => {
    let executionSummary = r.executions?.filter(e => e.status === 'success')
                            .map(e => `${e.type} #${e.qty} ${e.symbol}@$${e.executedPrice}`)
                            .join(', ') || 'None';
    return `[${r.day}] Cmds:${r.commands.replace(/\n/g, ' ')} | Bal:$${r.balanceAfter} | Executed:${executionSummary}`;
  }).join('\n');

  const langStr = lang === 'en' ? 'English' : '繁體中文';
  let prompt = `你是一位專業的量化交易與策略分析師。請分析以下這段股票模擬交易紀錄，並為使用者總結出其專屬的「交易決策模型 (Pattern)」。\n\n歷史紀錄：\n${formattedHistory || '無交易紀錄'}\n\n`;
  if (userNotes.trim()) {
    prompt += `使用者的分析前備註與心得：\n${userNotes}\n\n請將上述備註納入分析考量，結合使用者的初衷來點評。\n\n`;
  }
  prompt += `請以${langStr}且結構化的方式輸出：\n1. 核心策略歸納 (請總結出使用者的操作邏輯)\n2. 成功與失敗的關鍵因素分析\n3. 針對此 Pattern 的優化建議與改善方向`;

  const result = await callGeminiAPI(prompt);
  if (result) return result;
  return lang === 'zh' ? "AI 分析服務暫時無法連線，請稍後再試。" : "AI service unavailable, try again later.";
};

// --- 4. Shared UI Components ---
const FormattedMessage = ({ text }) => {
  const lines = text.split('\n');
  const elements = [];
  let tableLines = [];
  let inTable = false;

  const formatInline = (str) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-purple-300 font-semibold">$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-blue-300 font-mono text-[11px]">$1</code>');
  };

  const parseRow = (rowStr) => {
    let cols = rowStr.split('|');
    if (cols.length > 0 && cols[0].trim() === '') cols.shift();
    if (cols.length > 0 && cols[cols.length - 1].trim() === '') cols.pop();
    return cols.map(c => c.trim());
  };

  const renderTable = (tLines, keyIdx) => {
    if (tLines.length < 2) return null;
    const headers = parseRow(tLines[0]);
    const rows = tLines.slice(2).map(parseRow);

    return (
      <div key={`table-${keyIdx}`} className="my-3 w-full overflow-x-auto rounded-xl border border-slate-700 shadow-lg">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-800/80 text-slate-300">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-3 font-semibold border-b border-slate-700" dangerouslySetInnerHTML={{__html: formatInline(h)}} />
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50 bg-slate-900/40">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                {row.map((cell, cIdx) => {
                  let cellClass = "px-4 py-2.5 text-slate-300";
                  const cellText = cell.trim();
                  if (cellText.startsWith('-') && /\d/.test(cellText)) {
                    cellClass += " text-rose-400 font-medium";
                  } else if (cellText.startsWith('+') && /\d/.test(cellText)) {
                    cellClass += " text-emerald-400 font-medium";
                  }
                  return (
                    <td key={cIdx} className={cellClass} dangerouslySetInnerHTML={{__html: formatInline(cell)}} />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('|')) {
      inTable = true;
      tableLines.push(trimmed);
    } else {
      if (inTable) {
        elements.push(renderTable(tableLines, i));
        tableLines = [];
        inTable = false;
      }
      
      if (trimmed === '') {
        elements.push(<div key={`empty-${i}`} className="h-1.5" />);
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        let html = formatInline(trimmed).replace(/^[-*]\s+(.*)/, '<span class="mr-2 text-purple-400 select-none flex-shrink-0 mt-0.5">•</span><span class="flex-1">$1</span>');
        elements.push(<div key={`list-${i}`} dangerouslySetInnerHTML={{ __html: html }} className="pl-1 flex items-start" />);
      } else if (/^\d+\.\s/.test(trimmed)) {
        let html = formatInline(trimmed).replace(/^(\d+\.)\s+(.*)/, '<span class="mr-2 text-purple-400 font-mono select-none flex-shrink-0">$1</span><span class="flex-1">$2</span>');
        elements.push(<div key={`num-${i}`} dangerouslySetInnerHTML={{ __html: html }} className="pl-1 flex items-start" />);
      } else {
        elements.push(<div key={`text-${i}`} dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />);
      }
    }
  }
  
  if (inTable) {
    elements.push(renderTable(tableLines, lines.length));
  }

  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed text-slate-300">
      {elements}
    </div>
  );
};

const Modal = ({ isOpen, title, onClose, children, footer }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b border-slate-700">
          <div className="text-xl font-bold text-white">{title}</div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="p-5 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

const Button = ({ children, onClick, variant = 'primary', icon: Icon, className = '', disabled = false, title }) => {
  const isJustifyOverride = className.includes('justify-');
  const baseStyle = `flex items-center ${isJustifyOverride ? '' : 'justify-center'} gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95`;
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20",
    danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20",
    ghost: "bg-transparent hover:bg-slate-700 text-slate-300",
    outline: "border border-slate-600 hover:border-slate-400 text-slate-200"
  };
  return (
    <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} disabled={disabled} title={title}>
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

const NavButton = ({ active, icon: Icon, label, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
      active ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`}
  >
    <Icon size={20} />
    {label}
  </button>
);

// --- 5. Feature Sub-Views ---

const AiChatSidebar = ({ isOpen, onClose, stocks, marketData, liveQuotes, lang, t }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ id: Date.now(), role: 'ai', text: t("您好！我是您的專屬 AI 投資助理。您可以問我關於目前大廳中已啟用 (Active) 股票的任何歷史資料與近期走勢問題！") }]);
    }
  }, [t, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = { id: Date.now(), role: 'user', text: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const activeStocks = stocks.filter(s => s.isActive !== false);
    let contextStr = activeStocks.map(stock => {
       const sym = stock.symbol;
       const quote = liveQuotes[sym];
       const history = marketData[sym];
       if (!history) return '';
       
       let str = `--- ${sym} (${stock.name}) ---\n`;
       if (quote) {
         str += `Latest Quote: Price $${quote.price?.toFixed(2)}, Change ${quote.change?.toFixed(2)} (${quote.changePct?.toFixed(2)}%)\n`;
       }
       str += `Recent 1 Year History (Oldest to Newest):\n`;
       history.slice(-252).forEach(d => {
          str += `Date: ${d.date}, Open: ${d.open.toFixed(2)}, High: ${d.high.toFixed(2)}, Low: ${d.low.toFixed(2)}, Close: ${d.close.toFixed(2)}, Vol: ${d.volume}\n`;
       });
       return str;
    }).join('\n\n');

    const chatHistoryForAPI = [...messages, userMsg];
    const aiResponse = await callGeminiChatAPI(chatHistoryForAPI, contextStr, lang);

    setIsLoading(false);
    if (aiResponse) {
        setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: aiResponse }]);
    } else {
        setMessages(prev => [...prev, { id: Date.now(), role: 'ai', text: t("API 連線失敗，請稍後再試。") }]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}
      
      <div className={`fixed top-0 right-0 h-full w-full md:w-[400px] bg-slate-900 border-l border-slate-700 shadow-2xl transition-transform duration-300 ease-in-out z-50 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2 text-purple-400 font-bold">
            <Sparkles size={20} />
            <span>{t("✨ AI 投資助理")}</span>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => setMessages([{ id: Date.now(), role: 'ai', text: t("您好！我是您的專屬 AI 投資助理。您可以問我關於目前大廳中已啟用 (Active) 股票的任何歷史資料與近期走勢問題！") }])} className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 transition-colors">
               {t("清除對話")}
             </button>
             <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800">
               <X size={20} />
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-sm' 
                  : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'
              }`}>
                {msg.role === 'ai' && (
                  <div className="flex items-center gap-1.5 mb-2 border-b border-slate-700/50 pb-1.5">
                    <Bot size={16} className="text-purple-400" />
                    <span className="text-xs font-medium text-slate-400">AI {t("助理")}</span>
                  </div>
                )}
                {msg.role === 'ai' ? <FormattedMessage text={msg.text} /> : <p className="whitespace-pre-wrap">{msg.text}</p>}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-purple-400" />
                <span className="text-xs text-slate-400">{t("計算中...")}</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <div className="relative flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("輸入問題 (例如：NVDA 最近5天最高價是多少？)")}
              className="flex-1 max-h-32 min-h-[44px] bg-slate-950 border border-slate-700 rounded-xl py-3 pl-4 pr-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
              rows={1}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`p-3 rounded-xl transition-all flex-shrink-0 ${
                !input.trim() || isLoading 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 active:scale-95'
              }`}
            >
              <Send size={18} />
            </button>
          </div>
        </div>

      </div>
    </>
  );
};

const Dashboard = ({ stocks, marketData, liveQuotes, loadingQuotes, db, user, confirmAction, forceFetchStock, handleManualImportHTML, showToast, t, lang }) => {
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [editingStock, setEditingStock] = useState(null);
  const [editNameInput, setEditNameInput] = useState('');
  
  const [insightModalOpen, setInsightModalOpen] = useState(false);
  const [insightData, setInsightData] = useState({ symbol: '', name: '', text: '', loading: false });
  
  const [isChatOpen, setIsChatOpen] = useState(false);

  const fileInputRef = useRef(null);
  const [importTargetSymbol, setImportTargetSymbol] = useState(null);

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || !importTargetSymbol) return;
    handleManualImportHTML(importTargetSymbol, file);
    e.target.value = ''; 
    setImportTargetSymbol(null);
  };

  const handleDelete = (stock) => {
    confirmAction(t("刪除股票"), `${t("確定要將")} ${stock.symbol} ${t("從追蹤清單移除嗎？")}`, async () => {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'stocks', stock.id));
    });
  };

  const handleEditClick = (stock) => {
    setEditingStock(stock);
    setEditNameInput(stock.name !== stock.symbol && stock.name !== '自訂股票' && stock.name !== 'Custom Stock' ? stock.name : '');
  };

  const handleEditSave = async () => {
    if (!editingStock || !editNameInput.trim()) return;
    try {
      const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'stocks', editingStock.id);
      await setDoc(ref, { 
        name: editNameInput.trim(),
        isManuallyEdited: true
      }, { merge: true });
      setEditingStock(null);
    } catch (e) { console.error(e); }
  };

  const handleToggleActive = async (stock) => {
    try {
      const newStatus = stock.isActive === false ? true : false;
      const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'stocks', stock.id);
      
      await setDoc(ref, { isActive: newStatus }, { merge: true });
      showToast(`${stock.symbol} ${newStatus ? t('已啟用') : t('已停用')}`);
      
      if (newStatus === true) {
         forceFetchStock({ ...stock, isActive: true });
      }
    } catch (e) { console.error(e); }
  };

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e, index) => e.preventDefault();
  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIndex) return;
    const newStocks = [...stocks];
    const draggedItem = newStocks[draggedIdx];
    newStocks.splice(draggedIdx, 1);
    newStocks.splice(dropIndex, 0, draggedItem);
    const batch = writeBatch(db);
    newStocks.forEach((stk, idx) => {
      batch.update(doc(db, 'artifacts', appId, 'users', user.uid, 'stocks', stk.id), { order: idx });
    });
    await batch.commit();
    setDraggedIdx(null);
  };

  const handleFetchInsight = async (stock, history, currentPrice) => {
    setInsightData({ symbol: stock.symbol, name: stock.name, text: '', loading: true });
    setInsightModalOpen(true);
    
    const recentPrices = history.slice(-5).map(d => `$${d.close.toFixed(2)}`).join(', ');
    const langStr = lang === 'en' ? 'English' : '繁體中文 (Traditional Chinese)';
    
    const prompt = `You are an expert Wall Street stock analyst. Please provide a brief technical and fundamental outlook for ${stock.name} (${stock.symbol}).
    Recent 5 days closing prices: ${recentPrices}. 
    Current latest price: $${currentPrice.toFixed(2)}.
    Provide your insights in 3 to 4 concise sentences, explaining the current trend and general market sentiment. Use ${langStr}.`;

    const result = await callGeminiAPI(prompt);
    
    setInsightData(prev => ({ 
      ...prev, 
      text: result || t("AI 分析失敗，請稍後再試。"), 
      loading: false 
    }));
  };

  const locale = lang === 'en' ? 'en-US' : 'zh-TW';
  const todayStr = new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <>
      <div className={`space-y-8 animate-in fade-in duration-500 transition-all ease-in-out ${isChatOpen ? 'md:pr-[400px]' : ''}`}>
        <input 
          type="file" 
          accept=".html,.htm" 
          ref={fileInputRef} 
          onChange={onFileChange} 
          className="hidden" 
        />

        <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">{t("交易大廳總覽")}</h2>
            <p className="text-slate-400 flex items-center gap-2"><Clock size={16}/> {todayStr}</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setIsChatOpen(true)} 
            className="border-purple-600/30 text-purple-400 hover:bg-purple-600/10 shadow-lg shadow-purple-900/20"
            icon={MessageSquare}
          >
            {t("AI 助理")}
          </Button>
        </header>

        {stocks.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800">
            <LayoutDashboard size={48} className="mx-auto text-slate-600 mb-4" />
            <h3 className="text-xl font-medium text-slate-300 mb-2">{t("大廳空空如也")}</h3>
            <p className="text-slate-500">{t("請前往「股票代碼清單」新增您想追蹤的標的。")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stocks.map((stock, idx) => {
              const isActive = stock.isActive !== false; 
              const history = marketData[stock.symbol];
              const quote = liveQuotes[stock.symbol];
              const isQuoteLoading = loadingQuotes[stock.symbol];
              
              if (!history || history.length < 2) {
                 return (
                    <div key={stock.id} className="group relative p-6 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm animate-pulse flex items-center justify-center h-[180px]">
                       <div className="flex flex-col items-center gap-3 text-slate-500">
                         <RefreshCw className="animate-spin text-blue-500" size={28} />
                         <span className="text-sm font-medium">{t("載入歷史股價中...")}</span>
                       </div>
                    </div>
                 );
              }
              
              const todayData = history[history.length - 1];
              const yesterdayData = history[history.length - 2];
              const isMockData = todayData.isMock;

              let trafficLightClass = "";
              let trafficTooltip = "";
              let onLightClick = undefined;

              if (!isActive) {
                  trafficLightClass = "bg-slate-600";
                  trafficTooltip = t("已停用");
              } else if (isMockData) {
                  trafficLightClass = "bg-red-800 shadow-[0_0_8px_rgba(153,27,27,0.8)] animate-pulse cursor-pointer hover:bg-red-700";
                  trafficTooltip = t("同步失敗，點擊重試");
                  onLightClick = () => forceFetchStock(stock);
              } else {
                  trafficLightClass = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]";
                  trafficTooltip = t("同步成功");
              }
              
              const rawSparklineData = history.slice(Math.max(0, history.length - 5));
              let maxVal = -Infinity, minVal = Infinity;
              let maxIdx = 0, minIdx = 0;
              
              rawSparklineData.forEach((d, i) => {
                  if (d.close > maxVal) { maxVal = d.close; maxIdx = i; }
                  if (d.close < minVal) { minVal = d.close; minIdx = i; }
              });
              if (maxVal === minVal) minIdx = -1; 
              
              const sparklineData = rawSparklineData.map((d, i) => ({
                  ...d,
                  highLabel: i === maxIdx ? d.close : null,
                  lowLabel: i === minIdx ? d.close : null
              }));
              
              let currentPrice = todayData.close;
              let change = todayData.close - yesterdayData.close;
              let changePct = yesterdayData.close ? (change / yesterdayData.close) * 100 : 0;

              if (!isMockData && quote && quote.price !== null && quote.price !== undefined && !isNaN(quote.price)) {
                 currentPrice = quote.price;
                 
                 let qChange = quote.change;
                 let qChangePct = quote.changePct;
                 
                 const histChange = currentPrice - yesterdayData.close;
                 const histChangePct = yesterdayData.close ? (histChange / yesterdayData.close) * 100 : 0;

                 if (qChange !== null && qChange !== undefined && !isNaN(qChange)) {
                     if (qChange === 0 && Math.abs(histChange) > 0.005 && Math.abs(histChangePct) < 15) {
                         change = histChange;
                         changePct = histChangePct;
                     } else {
                         change = qChange;
                         changePct = qChangePct;
                     }
                 } else {
                     change = histChange;
                     changePct = histChangePct;
                 }
              }

              const isUp = change >= 0;
              const sign = isUp ? '+' : '-';
              
              const displayPrice = (currentPrice !== null && currentPrice !== undefined && !isNaN(currentPrice)) ? currentPrice.toFixed(2) : '0.00';
              const displayChange = (change !== null && change !== undefined && !isNaN(change)) ? Math.abs(change).toFixed(2) : '0.00';
              const displayChangePct = (changePct !== null && changePct !== undefined && !isNaN(changePct)) ? Math.abs(changePct).toFixed(2) : '0.00';

              const baseCardBg = isUp ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-rose-950/20 border-rose-900/50';
              const baseGlowClass = isUp ? 'shadow-[0_0_30px_-10px_rgba(16,185,129,0.15)]' : 'shadow-[0_0_30px_-10px_rgba(244,63,94,0.15)]';
              
              const cardBg = isActive ? baseCardBg : 'bg-slate-900/50 border-slate-700/50';
              const glowClass = isActive ? baseGlowClass : '';
              const textColor = isActive ? (isUp ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500';
              const opacityClass = isActive ? '' : 'opacity-70 grayscale';
              const Icon = isUp ? TrendingUp : TrendingDown;

              return (
                <div 
                  key={stock.id} draggable onDragStart={(e) => handleDragStart(e, idx)} onDragOver={(e) => handleDragOver(e, idx)} onDrop={(e) => handleDrop(e, idx)}
                  className={`group relative p-6 rounded-2xl border backdrop-blur-sm cursor-grab active:cursor-grabbing transition-all duration-300 hover:-translate-y-1 ${cardBg} ${glowClass} ${opacityClass}`}
                >
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
                    <button onClick={() => { setImportTargetSymbol(stock.symbol); fileInputRef.current?.click(); }} className="p-1.5 bg-slate-800/80 hover:bg-teal-600 text-slate-300 hover:text-white rounded-md transition-colors" title={t("手動匯入 HTML 歷史資料")}>
                      <UploadCloud size={16} />
                    </button>
                    <button onClick={() => handleToggleActive(stock)} className={`p-1.5 bg-slate-800/80 hover:bg-slate-600 text-slate-300 hover:text-white rounded-md transition-colors`} title={t("切換狀態")}>
                      <Power size={16} className={isActive ? "text-emerald-400" : "text-slate-500"} />
                    </button>
                    <button onClick={() => forceFetchStock(stock)} className="p-1.5 bg-slate-800/80 hover:bg-blue-600 text-slate-300 hover:text-white rounded-md transition-colors" title={t("重新抓取真實股價")}>
                      <RefreshCw size={16} />
                    </button>
                    <button onClick={() => handleFetchInsight(stock, sparklineData, currentPrice)} className="p-1.5 bg-slate-800/80 hover:bg-purple-600 text-purple-300 hover:text-white rounded-md transition-colors" title={t("✨ AI 洞察")}>
                      <Sparkles size={16} />
                    </button>
                    <button onClick={() => handleEditClick(stock)} className="p-1.5 bg-slate-800/80 hover:bg-amber-600 text-slate-300 hover:text-white rounded-md transition-colors" title={t("編輯名稱")}>
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(stock)} className="p-1.5 bg-slate-800/80 hover:bg-rose-600 text-slate-300 hover:text-white rounded-md transition-colors" title={t("刪除")}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex justify-between items-start mb-6 pr-12">
                    <div>
                      <h3 className="text-2xl font-bold text-white tracking-tight flex flex-wrap items-center gap-2">
                        <div 
                          onClick={onLightClick}
                          className={`w-3 h-3 rounded-full flex-shrink-0 transition-colors ${trafficLightClass}`}
                          title={trafficTooltip}
                        />
                        {stock.symbol}
                        
                        {!isActive ? (
                          <span title="Inactive" className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full border border-slate-600 whitespace-nowrap font-normal">
                            {t("已停用")}
                          </span>
                        ) : isMockData ? (
                          <span title="Fallback Data" onClick={onLightClick} className="text-[10px] px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded-full border border-rose-500/30 whitespace-nowrap font-normal cursor-pointer hover:bg-rose-500/30 transition-colors">
                            {t("API 失效 (備用資料)")}
                          </span>
                        ) : null}
                      </h3>
                      <p className="text-sm text-slate-400 line-clamp-1">{stock.name}</p>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-3xl font-light text-white mb-1">${displayPrice}</div>
                      <div className={`flex items-center gap-1 font-medium ${textColor}`}>
                        <Icon size={18} />
                        {isQuoteLoading ? (
                          <span className="flex items-center text-blue-400 gap-1.5 text-sm ml-1">
                            <Loader2 size={14} className="animate-spin" />
                            <span>{t("計算中...")}</span>
                          </span>
                        ) : (
                          <>{sign}{displayChange} ({sign}{displayChangePct}%)</>
                        )}
                      </div>
                    </div>
                    
                    <div className="w-36 h-20 opacity-90 flex-shrink-0 ml-2 pointer-events-none">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparklineData} margin={{ top: 16, right: 14, left: 14, bottom: 16 }}>
                          <CartesianGrid strokeDasharray="2 2" stroke="#334155" vertical={true} horizontal={false} opacity={0.6} />
                          <XAxis dataKey="date" hide />
                          <YAxis domain={['dataMin', 'dataMax']} hide />
                          <Line 
                            type="monotone" 
                            dataKey="close" 
                            stroke={isUp ? '#34d399' : '#fb7185'} 
                            strokeWidth={2} 
                            dot={{ r: 2, fill: isUp ? '#34d399' : '#fb7185', strokeWidth: 0 }} 
                            isAnimationActive={false} 
                          >
                             <LabelList 
                               dataKey="highLabel" 
                               position="top" 
                               offset={5} 
                               fill={isActive ? "#94a3b8" : "#475569"} 
                               fontSize={9} 
                               formatter={(val) => val ? (val >= 1000 ? Math.round(val) : Number(val).toFixed(2)) : ''}
                             />
                             <LabelList 
                               dataKey="lowLabel" 
                               position="bottom" 
                               offset={5} 
                               fill={isActive ? "#94a3b8" : "#475569"} 
                               fontSize={9} 
                               formatter={(val) => val ? (val >= 1000 ? Math.round(val) : Number(val).toFixed(2)) : ''}
                             />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Modal 
          isOpen={!!editingStock} 
          title={t("編輯名稱")} 
          onClose={() => setEditingStock(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditingStock(null)}>{t("取消")}</Button>
              <Button variant="primary" onClick={handleEditSave}>{t("儲存")}</Button>
            </>
          }
        >
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-400">{t("請輸入新的股票/公司名稱")}</label>
            <input 
              type="text" 
              value={editNameInput} 
              onChange={(e) => setEditNameInput(e.target.value)}
              placeholder={editingStock?.symbol}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              autoFocus
            />
          </div>
        </Modal>

        <Modal 
          isOpen={insightModalOpen} 
          title={<div className="flex items-center gap-2 text-purple-400"><Sparkles size={20} /> {insightData.symbol} {t("✨ AI 洞察")}</div>} 
          onClose={() => setInsightModalOpen(false)}
          footer={
            <Button variant="ghost" onClick={() => setInsightModalOpen(false)}>{t("關閉視窗")}</Button>
          }
        >
          <div className="flex flex-col space-y-4">
            <div className="text-sm text-slate-400 font-medium">{insightData.name}</div>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 text-slate-300 leading-relaxed min-h-[100px] flex flex-col justify-center">
              {insightData.loading ? (
                <div className="flex flex-col items-center justify-center gap-3 text-purple-400">
                  <Loader2 size={32} className="animate-spin" />
                  <span className="text-sm font-medium">{t("AI 正在分析...")}</span>
                </div>
              ) : (
                <FormattedMessage text={insightData.text} />
              )}
            </div>
          </div>
        </Modal>
      </div>
      
      <AiChatSidebar 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        stocks={stocks} 
        marketData={marketData} 
        liveQuotes={liveQuotes} 
        lang={lang} 
        t={t} 
      />
    </>
  );
};

const Checklist = ({ stocks, db, user, showToast, t, lang }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const handleAdd = async (stock) => {
    // A stray space typed into the search box used to be stored verbatim, and
    // every later price lookup for "ONDS " silently returned nothing.
    const symbol = (stock.symbol || '').trim().toUpperCase();
    if (!symbol) return;

    if (stocks.find(s => (s.symbol || '').trim().toUpperCase() === symbol)) {
      showToast(`${symbol} ${t("已經在清單中了")}`, 'error');
      return;
    }
    const newStock = { symbol, name: stock.name, addedAt: Date.now(), order: stocks.length, isActive: true };
    const ref = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'stocks'));
    await setDoc(ref, newStock);
    showToast(`${t("已新增")} ${symbol}`);
  };

  const handleRemove = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'stocks', id));
    showToast(t("已移除股票"));
  };

  const filteredStocks = US_STOCKS_MOCK.filter(s => 
    s.symbol.toLowerCase().includes(searchTerm.toLowerCase()) || s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isExactMatch = filteredStocks.some(s => s.symbol.toUpperCase() === searchTerm.trim().toUpperCase());
  const showCustomAdd = searchTerm.trim().length > 0 && !isExactMatch;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl">
      <header>
        <h2 className="text-3xl font-bold text-white mb-2">{t("股票代碼清單")}</h2>
        <p className="text-slate-400">{t("在此搜尋並配置您欲追蹤與模擬交易的股票標的。")}</p>
      </header>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="text" placeholder={t("輸入代碼或公司名稱搜尋 (例如: AAPL)...")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>
        {searchTerm && (
          <div className="mb-8">
            <h4 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wider">{t("搜尋結果")}</h4>
            <div className="grid gap-3">
              {showCustomAdd && (
                <div className="flex items-center justify-between p-4 bg-blue-900/20 rounded-xl border border-blue-700/50 hover:border-blue-500 transition-colors">
                  <div>
                    <span className="font-bold text-blue-400 text-lg mr-3">{searchTerm.toUpperCase()}</span>
                    <span className="text-blue-300/70">{t("自訂股票代碼")}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleAdd({ symbol: searchTerm.toUpperCase(), name: t("自訂股票") })} icon={Plus}>{t("新增")}</Button>
                </div>
              )}
              {filteredStocks.map(s => (
                <div key={s.symbol} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors">
                  <div>
                    <span className="font-bold text-white text-lg mr-3">{s.symbol}</span>
                    <span className="text-slate-400">{s.name}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleAdd(s)} icon={Plus}>{t("新增")}</Button>
                </div>
              ))}
              {filteredStocks.length === 0 && !showCustomAdd && <p className="text-slate-500 text-center py-4">{t("無符合的股票標的")}</p>}
            </div>
          </div>
        )}
        <div>
          <h4 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wider">{t("我的追蹤清單")} ({stocks.length})</h4>
          {stocks.length === 0 ? (
            <p className="text-slate-500 py-4 italic">{t("尚未加入任何股票")}</p>
          ) : (
             <div className="grid gap-3">
              {stocks.map(s => (
                <div key={s.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-xl border border-slate-700">
                  <div>
                    <span className="font-bold text-white text-lg mr-3">{s.symbol}</span>
                    <span className="text-slate-400">{s.name}</span>
                  </div>
                  <button onClick={() => handleRemove(s.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const WarRoomActive = ({ sim, stocks, db, user, onBack, marketData, showToast, confirmAction, t, lang }) => {
  const [draftInput, setDraftInput] = useState('');
  const [jumpDate, setJumpDate] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState(stocks[0]?.symbol || '');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [aiNotes, setAiNotes] = useState(sim.aiNotes || '');
  
  const [isAiCommandModalOpen, setIsAiCommandModalOpen] = useState(false);
  const [aiCommandInput, setAiCommandInput] = useState('');
  const [isAiCommandLoading, setIsAiCommandLoading] = useState(false);
  
  const chatBottomRef = useRef(null);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [sim.history]);

  const startIndex = sim.startIndex || 0;
  const currentOffset = sim.currentDayOffset !== undefined ? sim.currentDayOffset : (sim.currentDayIndex || 0);
  const currentIndex = startIndex + currentOffset;
  const stagedCommands = sim.stagedCommands || [];
  
  const dataRefSymbol = stocks[0]?.symbol;
  const isEnd = !dataRefSymbol || currentIndex >= marketData[dataRefSymbol]?.length - 1;
  const isMockData = marketData[dataRefSymbol]?.[currentIndex]?.isMock;
  
  const currentDateStr = marketData[dataRefSymbol]?.[currentIndex]?.date || "EOF";
  const getDayPrice = (symbol, dayIdx) => marketData[symbol]?.[dayIdx];

  const handleStageCommand = async () => {
    if (!draftInput.trim()) return;
    const newStaged = [...stagedCommands, draftInput];
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'simulations', sim.id);
    await setDoc(ref, { stagedCommands: newStaged }, { merge: true });
    setDraftInput('');
    showToast(t('指令已加入暫存'));
  };

  const handleRemoveStaged = async (idx) => {
    const newStaged = [...stagedCommands];
    newStaged.splice(idx, 1);
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'simulations', sim.id);
    await setDoc(ref, { stagedCommands: newStaged }, { merge: true });
  };

  const handleEditStaged = async (idx) => {
    const cmdToEdit = stagedCommands[idx];
    setDraftInput(cmdToEdit);
    await handleRemoveStaged(idx);
  };

  const handleExecuteTurn = async () => {
    if (isEnd || sim.status === 'completed') return;

    const rawCommandsText = stagedCommands.join('\n');
    const parsedCommands = parseCommands(rawCommandsText, lang);
    
    let currentBalance = sim.balance;
    const currentPortfolio = { ...sim.portfolio };
    const executions = [];

    const expandedCommands = [];
    parsedCommands.forEach(cmd => {
      if (!cmd.valid) { expandedCommands.push(cmd); return; }
      if (cmd.symbol === '$ALL') {
        stocks.forEach(stock => { expandedCommands.push({ ...cmd, symbol: stock.symbol, raw: `${cmd.raw} (${stock.symbol})` }); });
      } else { expandedCommands.push(cmd); }
    });

    expandedCommands.forEach(cmd => {
      if (!cmd.valid) return;
      const priceData = getDayPrice(cmd.symbol, currentIndex);
      if (!priceData) {
        executions.push({ ...cmd, status: 'failed', reason: t('無此標的資料') });
        return;
      }

      let executedPrice = 0;
      let executed = false;

      if (cmd.priceType === 'OPEN') {
        executedPrice = priceData.open; executed = true;
      } else if (cmd.priceType === 'CLOSE') {
        executedPrice = priceData.close; executed = true;
      } else {
        if (cmd.type === 'BUY') {
          if (priceData.low <= cmd.price) { executedPrice = cmd.price; executed = true; }
          else if (priceData.open <= cmd.price) { executedPrice = priceData.open; executed = true; }
        } else {
          if (priceData.high >= cmd.price) { executedPrice = cmd.price; executed = true; }
          else if (priceData.open >= cmd.price) { executedPrice = priceData.open; executed = true; }
        }
      }

      if (executed) {
        const total = executedPrice * cmd.qty;
        if (cmd.type === 'BUY') {
          if (currentBalance >= total) {
            currentBalance -= total;
            currentPortfolio[cmd.symbol] = (currentPortfolio[cmd.symbol] || 0) + cmd.qty;
            executions.push({ ...cmd, executedPrice, status: 'success', total });
          } else { executions.push({ ...cmd, status: 'failed', reason: t('餘額不足') }); }
        } else {
          if ((currentPortfolio[cmd.symbol] || 0) >= cmd.qty) {
            currentBalance += total;
            currentPortfolio[cmd.symbol] -= cmd.qty;
            if (currentPortfolio[cmd.symbol] === 0) delete currentPortfolio[cmd.symbol];
            executions.push({ ...cmd, executedPrice, status: 'success', total });
          } else { executions.push({ ...cmd, status: 'failed', reason: t('持股不足') }); }
        }
      } else { executions.push({ ...cmd, status: 'skipped', reason: t('未達設定價格') }); }
    });

    const updatedSim = {
      ...sim,
      balance: currentBalance,
      portfolio: currentPortfolio,
      currentDayOffset: currentOffset + 1,
      currentDayIndex: currentOffset + 1,
      stagedCommands: [],
      history: [
        ...sim.history,
        {
          day: currentDateStr,
          commands: rawCommandsText || t('[無交易決策，跳過本日]'),
          parsed: expandedCommands,
          executions,
          balanceAfter: currentBalance
        }
      ]
    };

    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'simulations', sim.id);
    await setDoc(ref, updatedSim);
    showToast(`${t("回合")} ${currentOffset + 1} OK`);
  };

  const handleJumpDate = async () => {
    if (!jumpDate) return;
    const targetIdx = marketData[dataRefSymbol].findIndex(d => d.date >= jumpDate);
    if (targetIdx === -1) return showToast(t("選擇的日期超出歷史資料範圍"), "error");
    if (targetIdx <= currentIndex) return showToast(t("跳轉日期必須大於當前日期"), "error");

    const newOffset = targetIdx - startIndex;
    const updatedSim = {
      ...sim,
      currentDayOffset: newOffset,
      currentDayIndex: newOffset,
      history: [
        ...sim.history,
        {
          day: currentDateStr,
          commands: `${t("[系統] 玩家手動將時間跳轉至")} ${marketData[dataRefSymbol][targetIdx].date}`,
          parsed: [],
          executions: [],
          balanceAfter: sim.balance
        }
      ]
    };
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'simulations', sim.id);
    await setDoc(ref, updatedSim);
    setJumpDate('');
    showToast(`${t("時間已推進至")} ${marketData[dataRefSymbol][targetIdx].date}`);
  };

  const handleEndSimulation = () => {
    confirmAction(t("結束模擬"), t("確定要提早結束本次模擬交易嗎？結束後只能檢視無法再交易。"), async () => {
      const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'simulations', sim.id);
      await setDoc(ref, { status: 'completed' }, { merge: true });
      showToast(t("模擬已結束"));
    });
  };

  const handleAnalyzePattern = async () => {
    const validHistory = sim.history.filter(r => !r.commands.includes(t('[系統] 玩家手動將時間跳轉至')));
    if (validHistory.length === 0) return showToast(t("尚無有效的交易紀錄可供分析"), "error");
    
    setIsAnalyzing(true);
    showToast(t("AI 正在深度分析您的交易決策模型..."));
    
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'simulations', sim.id);
    await setDoc(ref, { aiNotes }, { merge: true });
    const patternText = await analyzeTradePatternWithAI(sim.history, aiNotes, lang);
    await setDoc(ref, { patternSummary: patternText }, { merge: true });
    
    setIsAnalyzing(false);
    showToast(t("AI 分析完成！"));
  };

  const handleGenerateAICommand = async () => {
    if (!aiCommandInput.trim()) return;
    setIsAiCommandLoading(true);
    
    const prompt = `You are a strict trading command translator system. Convert the user's natural language request into EXACTLY this syntax: [ACTION] [TARGET] #[QTY] [PRICE]
    Rules:
    - ACTION must be 'BUY' or 'SELL'.
    - TARGET must be a valid Stock Symbol (e.g., AAPL, TSLA) or '$ALL' (if the user implies all stocks/entire portfolio).
    - QTY must be a number preceded by '#' (e.g., #10, #50, #100).
    - PRICE must be 'OPEN', 'CLOSE', or a specific numeric price (e.g., 150.5).
    - DO NOT output any conversational text, explanations, or markdown. Only output the raw translated command.
    - If the user provides multiple distinct actions, output each command on a new line.
    
    User Input: "${aiCommandInput}"`;

    const result = await callGeminiAPI(prompt);
    setIsAiCommandLoading(false);

    if (result) {
       setDraftInput(prev => prev ? prev + '\n' + result.trim() : result.trim());
       setIsAiCommandModalOpen(false);
       setAiCommandInput('');
       showToast(t("指令轉換成功"));
    } else {
       showToast(t("AI 轉換失敗，請重新嘗試。"), "error");
    }
  };

  const handleExportPatternTxt = () => {
    const blob = new Blob([sim.patternSummary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-pattern-${sim.name}.txt`;
    a.click();
    showToast(t("決策模型已匯出為 TXT"));
  };

  const chartData = marketData[selectedSymbol]?.slice(Math.max(0, currentIndex - 60), currentIndex + 1) || [];

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-slate-800 rounded-t-2xl border-b border-slate-700 p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {sim.name} {sim.status === 'completed' && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">{t("已結束")}</span>}
            </h2>
            <div className="text-sm text-slate-400 font-mono flex items-center gap-2 mt-1">
              <span>{t("當前日期:")}</span> <span className="text-blue-400 font-bold">{currentDateStr}</span> ({t("回合")} {currentOffset + 1})
              {isMockData && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">{t("API 失效 (備用資料)")}</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-400">{t("可用資金")}</div>
          <div className="text-2xl font-mono font-bold text-emerald-400">${sim.balance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col border-r border-slate-700 bg-slate-900 overflow-y-auto p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center mb-4">
              <select value={selectedSymbol} onChange={e => setSelectedSymbol(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1 outline-none focus:border-blue-500">
                {stocks.map(s => <option key={s.symbol} value={s.symbol}>{s.symbol} - {s.name}</option>)}
              </select>
              <div className="text-sm text-slate-400">{t("盤前價格走勢 (前60天)")}</div>
            </div>
            <div className="h-64 w-full">
               <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => val.substring(5)} />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={['auto', 'auto']} tickFormatter={(val) => `$${val}`} width={60} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }} itemStyle={{ color: '#60a5fa' }} />
                  <Line type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6, fill: '#60a5fa', stroke: '#1e293b', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4 flex-shrink-0">
             <h3 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">{t("當前持股 (Portfolio)")}</h3>
             {Object.keys(sim.portfolio).length === 0 ? (
               <p className="text-slate-500 text-sm">{t("尚無任何持股")}</p>
             ) : (
               <div className="flex flex-wrap gap-2">
                 {Object.entries(sim.portfolio).map(([sym, qty]) => {
                   const latestPrice = getDayPrice(sym, Math.max(0, currentIndex - 1))?.close || 0;
                   const val = qty * latestPrice;
                   return (
                     <div key={sym} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 flex flex-col items-center min-w-[100px]">
                       <span className="font-bold text-white">{sym}</span>
                       <span className="text-xs text-slate-400">{qty} {t("股")}</span>
                       <span className="text-xs text-emerald-500 font-mono mt-1">${val.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                     </div>
                   );
                 })}
               </div>
             )}
          </div>

          {sim.status !== 'completed' ? (
             <div className="mt-auto">
               <div className="mb-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                 <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex justify-between items-center">
                    <span>{t("待執行暫存區")}</span>
                    <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full">{stagedCommands.length} {t("筆")}</span>
                 </div>
                 {stagedCommands.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">{t("尚無暫存指令。您可以輸入指令後點擊「加入暫存」。如果直接進入下一天，將會跳過本日不交易。")}</p>
                 ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                       {stagedCommands.map((cmdStr, idx) => (
                          <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 flex justify-between items-center group">
                             <span className="font-mono text-slate-300 text-sm whitespace-pre-wrap">{cmdStr}</span>
                             <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditStaged(idx)} title={t("編輯 (退回草稿)")} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded"><Edit2 size={14} /></button>
                                <button onClick={() => handleRemoveStaged(idx)} title={t("刪除")} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded"><Trash2 size={14} /></button>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
               </div>

               <div className="mb-2 flex justify-between items-end">
                 <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{t("草稿輸入區")}</label>
                    <button onClick={() => setIsHelpModalOpen(true)} className="text-slate-500 hover:text-blue-400 transition-colors bg-slate-800 rounded-full p-0.5" title={t("交易指令說明 (Command Syntax Guide)")}>
                       <HelpCircle size={16} />
                    </button>
                 </div>
                 <Button variant="ghost" className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/30 text-xs py-1 px-2 h-auto" icon={Sparkles} onClick={() => setIsAiCommandModalOpen(true)}>
                    {t("✨ AI 輔助下單")}
                 </Button>
               </div>
               
               <div className="flex gap-2 mb-4">
                 <textarea 
                    value={draftInput} onChange={(e) => setDraftInput(e.target.value)} placeholder={t("輸入您的當天交易指令...\n例如：SELL TSLA #5 CLOSE")}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono resize-none h-20"
                 />
                 <Button variant="outline" className="flex-col h-20 w-24" onClick={handleStageCommand}>
                    <Save size={18}/><span className="text-xs">{t("加入暫存")}</span>
                 </Button>
               </div>
               
               <div className="mt-2 flex gap-3">
                 <Button variant="outline" className="flex-1 border-rose-600/30 text-rose-400 hover:bg-rose-600/10 hover:border-rose-500" onClick={handleEndSimulation}>{t("提早結束模擬")}</Button>
                 <Button variant="primary" className="flex-1 bg-blue-600 hover:bg-blue-500" icon={Play} onClick={handleExecuteTurn} disabled={isEnd}>
                   {t("執行暫存清單 & 進入下一天")}
                 </Button>
               </div>

               <div className="mt-4 flex items-center gap-3 pt-4 border-t border-slate-800">
                 <span className="text-sm font-semibold text-slate-400 whitespace-nowrap">{t("時光跳轉:")}</span>
                 <input type="date" value={jumpDate} onChange={(e) => setJumpDate(e.target.value)} min={currentDateStr} className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-blue-500 text-sm" />
                 <Button variant="outline" onClick={handleJumpDate} disabled={!jumpDate || isEnd} className="whitespace-nowrap">{t("跳至該日")}</Button>
               </div>
             </div>
          ) : (
             <div className="mt-auto bg-slate-800/50 border border-slate-700 p-6 rounded-xl text-center flex flex-col items-center justify-center space-y-5 animate-in fade-in zoom-in-95">
                 <CheckCircle2 size={54} className="text-emerald-500 opacity-80" />
                 <div>
                     <h3 className="text-xl font-bold text-white mb-2">{t("模擬已結束")}</h3>
                     <p className="text-sm text-slate-400">{t("您可以檢視右側的交易日誌，或者讓 AI 幫助您分析這次的交易決策。")}</p>
                 </div>
                 <Button 
                    variant="primary" 
                    className="w-full max-w-sm bg-purple-600 hover:bg-purple-500 shadow-purple-500/20 py-3 text-md mt-2" 
                    icon={Brain} 
                    onClick={() => setIsAiModalOpen(true)}
                 >
                   {sim.patternSummary ? t("檢視 AI 決策模型") : t("🤖 產生 AI 決策模型")}
                 </Button>
             </div>
          )}
        </div>

        <div className="w-80 bg-slate-950 p-4 overflow-y-auto border-l border-slate-800">
           <h3 className="text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider flex items-center gap-2">
             <Database size={16} /> {t("執行日誌")}
           </h3>
           <div className="space-y-4">
             {sim.history.length === 0 && <p className="text-slate-600 text-sm text-center mt-10">{t("尚無交易紀錄")}</p>}
             {sim.history.map((record, i) => (
               <div key={i} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm animate-in slide-in-from-right-2">
                 <div className="text-xs text-blue-400 mb-2 border-b border-slate-800 pb-1">{record.day}</div>
                 {record.commands && (
                   <div className="mb-2">
                     <div className="text-slate-500 text-[10px] uppercase">{t("當日策略")}</div>
                     <div className="font-mono text-slate-300 whitespace-pre-wrap mt-0.5">{record.commands}</div>
                   </div>
                 )}
                 {record.executions?.length > 0 && (
                   <div className="space-y-1 mt-2 bg-slate-950/50 p-2 rounded">
                     {record.executions.map((exe, idx) => (
                       <div key={idx} className="flex justify-between items-start text-xs border-b border-slate-800/50 last:border-0 pb-1 mb-1">
                         <span className="font-mono text-slate-400 line-clamp-2 flex-1 pr-2">{exe.raw}</span>
                         {exe.status === 'success' ? (
                            <span className="text-emerald-400 whitespace-nowrap">{t("已成交 @ $")}{exe.executedPrice}</span>
                         ) : exe.status === 'skipped' ? (
                            <span className="text-slate-500 whitespace-nowrap">{t("未達條件")}</span>
                         ) : (
                            <span className="text-rose-400 whitespace-nowrap">{t("失敗:")} {exe.reason}</span>
                         )}
                       </div>
                     ))}
                   </div>
                 )}
                 {(!record.executions || record.executions.length === 0) && record.commands && !record.commands.includes('[System]') && !record.commands.includes('[系統]') && !record.commands.includes('[無交易決策') && !record.commands.includes('[No trading decision') && (
                    <div className="text-[10px] text-slate-500 mt-1">{t("無可執行的有效指令")}</div>
                 )}
                 <div className="mt-2 text-right text-xs font-mono text-slate-400">{t("餘額:")} ${record.balanceAfter.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
               </div>
             ))}
             <div ref={chatBottomRef} />
           </div>
        </div>
      </div>

      <Modal isOpen={isAiModalOpen} title={t("🤖 AI 決策模型 (Pattern) 分析")} onClose={() => setIsAiModalOpen(false)}>
         <div className="space-y-4">
           <div>
             <label className="block text-sm font-medium text-slate-400 mb-2">{t("分析前備註 (選填)：讓 AI 知道你當時的想法或特定策略")}</label>
             <textarea value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} placeholder={t("例如：我這次主要是測試跌破月線就停損，並且觀察資金流動的變化...")} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-sans resize-none h-24" />
           </div>
           <div className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed bg-slate-900 p-5 rounded-xl border border-slate-700 max-h-[45vh] overflow-y-auto font-sans">
             {sim.patternSummary ? sim.patternSummary : t("尚未產生分析報告。\n請填寫上方備註 (可選)，並點擊下方按鈕，讓系統 AI 根據您過去的歷史交易紀錄與指令，自動演算並總結出您的專屬交易決策模型。")}
           </div>
         </div>
         <div className="mt-5 flex gap-3 justify-end pt-4 border-t border-slate-800">
           {sim.patternSummary && (
             <Button variant="outline" className="bg-slate-800 hover:bg-slate-700 text-white border-slate-600" onClick={handleExportPatternTxt} icon={DownloadCloud}>
               {t("匯出 Pattern (TXT)")}
             </Button>
           )}
           <Button variant="primary" onClick={handleAnalyzePattern} disabled={isAnalyzing} className={isAnalyzing ? "animate-pulse bg-purple-600" : "bg-purple-600 hover:bg-purple-500 shadow-purple-500/20"}>
             <Brain size={18} /> {isAnalyzing ? t("AI 深度演算中...") : (sim.patternSummary ? t("重新分析最新紀錄") : t("開始 AI 分析"))}
           </Button>
         </div>
      </Modal>

      {/* AI Command Generator Modal */}
      <Modal isOpen={isAiCommandModalOpen} title={<div className="flex items-center gap-2 text-purple-400"><Bot size={20} /> {t("白話文下單 (自然語言)")}</div>} onClose={() => !isAiCommandLoading && setIsAiCommandModalOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-300">{t("請輸入您的想法，例如：「幫我買 100 股蘋果，用開盤價買入」或「把手上所有的特斯拉在收盤時賣掉」")}</p>
          <textarea 
            value={aiCommandInput} 
            onChange={(e) => setAiCommandInput(e.target.value)} 
            placeholder="Type your trading command in natural language..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-sans resize-none h-32"
            disabled={isAiCommandLoading}
          />
          <div className="flex justify-end pt-2">
             <Button variant="primary" onClick={handleGenerateAICommand} disabled={!aiCommandInput.trim() || isAiCommandLoading} className={isAiCommandLoading ? "bg-purple-600 animate-pulse w-full justify-center" : "bg-purple-600 hover:bg-purple-500 w-full justify-center"}>
                {isAiCommandLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {isAiCommandLoading ? t("計算中...") : t("轉換為系統指令")}
             </Button>
          </div>
        </div>
      </Modal>

      {/* Syntax Help Modal */}
      <Modal isOpen={isHelpModalOpen} title={t("交易指令說明 (Command Syntax Guide)")} onClose={() => setIsHelpModalOpen(false)}>
        <div className="space-y-4 text-slate-300">
          <p>{t("系統已全面升級為英文指令語法，請依照以下格式輸入您的交易決策：")}</p>
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 font-mono text-sm space-y-2">
             <div className="text-blue-400 font-bold">[ACTION] [TARGET] #[QTY] [PRICE]</div>
             <ul className="list-disc list-inside space-y-2 mt-2 text-slate-400 font-sans">
               <li><strong className="text-white font-mono">ACTION:</strong> BUY / SELL</li>
               <li><strong className="text-white font-mono">TARGET:</strong> AAPL, TSLA... {t("或")} <strong className="text-amber-400">$ALL</strong> ({t("全部")})</li>
               <li><strong className="text-white font-mono">QTY:</strong> #10, #50... {t("(加井字號)")}</li>
               <li><strong className="text-white font-mono">PRICE:</strong> OPEN, CLOSE, {t("或具體價格")} (e.g., 150)</li>
             </ul>
          </div>
          <div className="mt-4">
             <h4 className="font-semibold text-white mb-2">{t("範例 (Examples):")}</h4>
             <div className="space-y-2 font-mono text-sm bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                <div className="flex gap-2"><span className="text-emerald-400 font-bold w-10">BUY</span> <span>AAPL #10 OPEN</span></div>
                <div className="flex gap-2"><span className="text-rose-400 font-bold w-10">SELL</span> <span>$ALL #5 CLOSE</span></div>
                <div className="flex gap-2"><span className="text-emerald-400 font-bold w-10">BUY</span> <span>TSLA #100 240.5</span></div>
             </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button variant="primary" onClick={() => setIsHelpModalOpen(false)}>{t("確認執行")}</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

const WarRoom = ({ simulations, stocks, marketData, db, user, confirmAction, showToast, t, lang }) => {
  const [activeSimId, setActiveSimId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const handleCreate = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('name');
    const startStr = formData.get('startDate');
    
    if (stocks.length === 0) {
      showToast(t("請先在清單加入股票再建立模擬"), "error");
      return;
    }
    const dataRefSymbol = stocks[0]?.symbol;
    const stockData = marketData[dataRefSymbol];
    if (!stockData || stockData.length === 0) {
      showToast(t("正在載入歷史股價，請稍後再建立"), "error");
      return;
    }

    let startIndex = stockData.findIndex(d => d.date >= startStr);
    if (startIndex === -1) startIndex = stockData.length > 60 ? stockData.length - 60 : 0;

    const newSim = {
      name,
      createdAt: Date.now(),
      status: 'active',
      startDate: startStr,
      startIndex: startIndex,
      currentDayOffset: 0,
      balance: 100000,
      portfolio: {},
      history: [],
      stagedCommands: [],
      patternSummary: "",
      aiNotes: ""
    };

    const docRef = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'simulations'));
    await setDoc(docRef, newSim);
    setIsCreateModalOpen(false);
    showToast(t("模擬交易事件已建立"));
    setActiveSimId(docRef.id);
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    confirmAction(t("刪除模擬事件"), t("確定要刪除此模擬紀錄嗎？將無法復原。"), async () => {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'simulations', id));
      if (activeSimId === id) setActiveSimId(null);
    });
  };

  if (activeSimId) {
    const sim = simulations.find(s => s.id === activeSimId);
    if (!sim) return <div className="text-white">Loading...</div>;
    return <WarRoomActive sim={sim} stocks={stocks} db={db} user={user} onBack={() => setActiveSimId(null)} marketData={marketData} showToast={showToast} confirmAction={confirmAction} t={t} lang={lang}/>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">{t("模擬交易大廳")}</h2>
          <p className="text-slate-400">{t("以過往數據為基礎，回合制驗證您的交易策略。")}</p>
        </div>
        <Button icon={Plus} onClick={() => setIsCreateModalOpen(true)}>{t("建立模擬事件")}</Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {simulations.map(sim => (
          <div key={sim.id} onClick={() => setActiveSimId(sim.id)} className="bg-slate-800 border border-slate-700 rounded-2xl p-6 cursor-pointer hover:bg-slate-750 hover:border-blue-500/50 transition-all group relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${sim.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
            <div className="absolute top-4 right-4">
               <button onClick={(e) => handleDelete(sim.id, e)} className="p-1.5 text-slate-500 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={18} />
              </button>
            </div>
            <h3 className="text-xl font-bold text-white mb-1 pr-8">{sim.name}</h3>
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
              <span className={`px-2 py-0.5 rounded text-xs ${sim.status==='completed'?'bg-emerald-500/20 text-emerald-400':'bg-blue-500/20 text-blue-400'}`}>
                {sim.status === 'completed' ? t("已結束") : t("進行中")}
              </span>
              <span>• {t("起始日:")} {sim.startDate}</span>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 flex justify-between items-center border border-slate-800">
              <div>
                <div className="text-xs text-slate-500 mb-1">{t("當前資金")}</div>
                <div className="font-mono text-lg text-white">${sim.balance.toLocaleString()}</div>
              </div>
              <ChevronRight className="text-slate-600 group-hover:text-blue-400 transition-colors" />
            </div>
          </div>
        ))}
        {simulations.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-800 rounded-2xl">
            <Swords size={48} className="mx-auto text-slate-700 mb-4" />
            <p className="text-slate-500 mb-4">{t("尚未建立任何模擬交易")}</p>
            <Button icon={Plus} variant="outline" onClick={() => setIsCreateModalOpen(true)} className="mx-auto">{t("建立第一場模擬")}</Button>
          </div>
        )}
      </div>

      <Modal isOpen={isCreateModalOpen} title={t("創建模擬交易事件")} onClose={() => setIsCreateModalOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t("事件名稱")}</label>
            <input name="name" required type="text" placeholder={t("例如：2023科技股波段測試")} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t("模擬起始日 (基準)")}</label>
            <input name="startDate" required type="date" defaultValue={new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none" />
          </div>
          <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-4 text-sm text-blue-200">
            <ul className="list-disc list-inside space-y-1">
              <li>{t("初始模擬資金：$100,000")}</li>
              <li>{t("標的池：當前「股票代碼清單」中所有股票")}</li>
              <li>{t("歷史資料：真實市場歷史股價 (或備援資料)")}</li>
            </ul>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>{t("取消")}</Button>
            <Button type="submit" variant="primary">{t("建立並開始")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const RecordsTab = ({ stocks, records, db, user, showToast, confirmAction, t, lang }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStockForDetail, setSelectedStockForDetail] = useState(null);
  const [selectedMonthForDetail, setSelectedMonthForDetail] = useState(null); 
  const [selectedTradeForClose, setSelectedTradeForClose] = useState(null);
  const [selectedStockForSchedule, setSelectedStockForSchedule] = useState(null);
  const [cardViews, setCardViews] = useState({}); 
  const [showOnlyRealized, setShowOnlyRealized] = useState(true);
  const [calendarBaseDate, setCalendarBaseDate] = useState(new Date());

  // 新增拖拉排序的狀態
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [customOrder, setCustomOrder] = useState([]);

  // 從 Firebase 取得之前儲存的自訂排序 (改為 onSnapshot 即時監聽，支援匯入後立即更新)
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'performance');
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists() && snap.data().symbolOrder) {
        setCustomOrder(snap.data().symbolOrder);
      }
    }, (error) => console.error(error));
    
    return () => unsubscribe();
  }, [db, user]);

  const toggleCardView = (symbol, e) => {
    e.stopPropagation();
    setCardViews(prev => ({ ...prev, [symbol]: prev[symbol] === 'bar' ? 'pie' : 'bar' }));
  };

  const pnlByStock = useMemo(() => {
    const pnlMap = {};
    const sortedRecords = records
      .map((record, index) => ({ record, index }))
      .sort((a, b) => {
        const dateDiff = new Date(a.record.date) - new Date(b.record.date);
        if (dateDiff !== 0) return dateDiff;

        const createdAtDiff = Number(a.record.createdAt || 0) - Number(b.record.createdAt || 0);
        return createdAtDiff !== 0 ? createdAtDiff : a.index - b.index;
      })
      .map(({ record }) => ({ ...record }));
    
    sortedRecords.forEach(record => {
        if (!pnlMap[record.symbol]) {
            pnlMap[record.symbol] = { gain: 0, loss: 0, net: 0, positions: {}, trades: [], monthlyPnL: {}, lots: {} };
        }
        const stockData = pnlMap[record.symbol];
        
        record.openQty = Number(record.qty);
        let isRealizing = false; 
        
        if (!stockData.positions[record.assetName]) {
            stockData.positions[record.assetName] = { qty: 0, avgCost: 0 };
        }
        const pos = stockData.positions[record.assetName];
        
        if (!stockData.lots[record.assetName]) {
            stockData.lots[record.assetName] = { direction: 0, queue: [] };
        }
        const lots = stockData.lots[record.assetName];

        const qty = Number(record.qty);
        const price = Number(record.price);
        const mult = Number(record.multiplier || 1);
        const isBuy = record.action.toUpperCase() === 'BUY';
        const isExpire = record.action.toUpperCase() === 'EXPIRE';
        const isLoss = record.action.toUpperCase() === 'LOSS';

        const consumeOpenLots = (quantity, sourceTradeId) => {
            let remaining = Math.max(0, Number(quantity) || 0);
            const consumed = [];
            let usedLinkedLot = false;

            while (remaining > 0 && lots.queue.length > 0) {
                let targetIndex = 0;
                if (sourceTradeId) {
                    const linkedIndex = lots.queue.findIndex(
                        lot => lot.id === sourceTradeId && Number(lot.openQty) > 0
                    );
                    if (linkedIndex !== -1) {
                        targetIndex = linkedIndex;
                        usedLinkedLot = true;
                    }
                }

                const target = lots.queue[targetIndex];
                const targetOpenQty = Number(target.openQty) || 0;
                if (targetOpenQty <= 0) {
                    lots.queue.splice(targetIndex, 1);
                    continue;
                }

                const consumedQty = Math.min(targetOpenQty, remaining);
                consumed.push({ lot: target, qty: consumedQty });
                target.openQty = targetOpenQty - consumedQty;
                remaining -= consumedQty;

                if (target.openQty <= 0) {
                    lots.queue.splice(targetIndex, 1);
                }
            }

            if (lots.queue.length === 0) lots.direction = 0;
            return { remaining, consumed, usedLinkedLot };
        };

        const getConsumedAverageCost = (consumed) => {
            const totalQty = consumed.reduce((sum, item) => sum + item.qty, 0);
            if (totalQty <= 0) return Number(pos.avgCost) || 0;

            const totalCost = consumed.reduce(
                (sum, item) => sum + (Number(item.lot.price) || 0) * item.qty,
                0
            );
            return totalCost / totalQty;
        };

        const syncAverageCostFromLots = () => {
            const openQty = lots.queue.reduce((sum, lot) => sum + (Number(lot.openQty) || 0), 0);
            if (openQty > 0) {
                const totalCost = lots.queue.reduce(
                    (sum, lot) => sum + (Number(lot.price) || 0) * (Number(lot.openQty) || 0),
                    0
                );
                pos.avgCost = totalCost / openQty;
            } else if (pos.qty === 0) {
                pos.avgCost = 0;
            }
        };

        let consumedLots = [];
        let usedLinkedLot = false;
        
        const addRealizedPnL = (amount) => {
             if (amount === 0) return;
             if (amount > 0) stockData.gain += amount;
             else stockData.loss += Math.abs(amount);

             const dateStr = record.date || "2026-01-01";
             const month = dateStr.substring(0, 7);
             if (!stockData.monthlyPnL[month]) stockData.monthlyPnL[month] = 0;
             stockData.monthlyPnL[month] += amount;
        };

        if (isExpire || isLoss) {
            record.openQty = 0; 
            isRealizing = true; 
            record.realizedPnL = 0;
            const consumedResult = consumeOpenLots(qty, record.sourceTradeId);
            consumedLots = consumedResult.consumed;
            usedLinkedLot = consumedResult.usedLinkedLot;
        } else {
            const tradeDir = isBuy ? 1 : -1;
            if (lots.direction === 0 || lots.direction === tradeDir) {
                lots.direction = tradeDir;
                lots.queue.push(record);
            } else {
                const consumedResult = consumeOpenLots(qty, record.sourceTradeId);
                consumedLots = consumedResult.consumed;
                usedLinkedLot = consumedResult.usedLinkedLot;
                const remainingToClose = consumedResult.remaining;
                if (remainingToClose > 0) {
                    record.openQty = remainingToClose;
                    lots.direction = tradeDir;
                    lots.queue.push(record);
                } else {
                    record.openQty = 0; 
                }
                if (lots.queue.length === 0) lots.direction = 0;
            }
        }

        if (isExpire || isLoss) {
            if (pos.qty !== 0) {
                const closeQty = Math.min(qty, Math.abs(pos.qty));
                const isShort = pos.qty < 0;
                const basis = usedLinkedLot && consumedLots.length > 0
                    ? getConsumedAverageCost(consumedLots)
                    : pos.avgCost;
                const pnl = (isShort ? basis : -basis) * closeQty * mult;
                addRealizedPnL(pnl);
                record.realizedPnL += pnl;
                
                pos.qty += isShort ? closeQty : -closeQty;
                
                if (qty > closeQty) {
                    const remainingQty = qty - closeQty;
                    const pnlRemaining = remainingQty * price * mult;
                    if (isExpire) { addRealizedPnL(pnlRemaining); record.realizedPnL += pnlRemaining; }
                    if (isLoss) { addRealizedPnL(-pnlRemaining); record.realizedPnL -= pnlRemaining; }
                }
            } else {
                const pnl = qty * price * mult;
                if (isExpire) { addRealizedPnL(pnl); record.realizedPnL += pnl; }
                if (isLoss) { addRealizedPnL(-pnl); record.realizedPnL -= pnl; }
            }
            syncAverageCostFromLots();
        } else if (pos.qty === 0) {
            pos.qty = isBuy ? qty : -qty;
            pos.avgCost = price;
            isRealizing = false;
        } else if ((pos.qty > 0 && isBuy) || (pos.qty < 0 && !isBuy)) {
            const totalCost = (Math.abs(pos.qty) * pos.avgCost) + (qty * price);
            pos.qty += isBuy ? qty : -qty;
            pos.avgCost = totalCost / Math.abs(pos.qty);
            isRealizing = false;
        } else {
            isRealizing = true; 
            const closeQty = Math.min(qty, Math.abs(pos.qty));
            const basis = usedLinkedLot && consumedLots.length > 0
                ? getConsumedAverageCost(consumedLots)
                : pos.avgCost;
            const pnl = (isBuy ? (basis - price) : (price - basis)) * closeQty * mult;
            addRealizedPnL(pnl);
            record.realizedPnL = pnl;
            
            pos.qty += isBuy ? closeQty : -closeQty;
            
            if (qty > closeQty) {
                const remainingQty = qty - closeQty;
                pos.qty = isBuy ? remainingQty : -remainingQty;
                pos.avgCost = price;
            }
            syncAverageCostFromLots();
        }
        
        record.isRealizing = isRealizing; 
        stockData.trades.push(record);
    });
    
    Object.values(pnlMap).forEach(d => {
       d.net = d.gain - d.loss;
       d.trades.reverse();
    });
    return pnlMap;
  }, [records]);

  const scheduleData = useMemo(() => {
    if (!selectedStockForSchedule) return null;
    const stockData = pnlByStock[selectedStockForSchedule];
    if (!stockData) return null;

    const openOptions = [];
    Object.keys(stockData.lots).forEach(assetName => {
        const lot = stockData.lots[assetName];
        if (lot.queue.length > 0) {
            const first = lot.queue[0];
            const isOpt = isOptionTrade(first);
            if (isOpt) {
                const totalOpen = lot.queue.reduce((sum, r) => sum + r.openQty, 0);
                if (totalOpen > 0) {
                    openOptions.push({
                        assetName,
                        openQty: totalOpen,
                        direction: lot.direction === 1 ? 'Long' : 'Short',
                        expiryDate: parseExpiryDate(assetName)
                    });
                }
            }
        }
    });

    if (openOptions.length === 0) return { options: [], calendarDays: [] };

    const colorClasses = [
        'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 
        'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'
    ];
    const uniqueExpiries = Array.from(new Set(openOptions.map(o => o.expiryDate.getTime()))).sort((a,b)=>a-b);
    openOptions.forEach(o => {
        const colorIdx = uniqueExpiries.indexOf(o.expiryDate.getTime()) % colorClasses.length;
        o.color = colorClasses[colorIdx];
    });

    const year = calendarBaseDate.getFullYear();
    const month = calendarBaseDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    const endDate = new Date(lastDayOfMonth);
    if (endDate.getDay() !== 6) {
        endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    }

    const todayZero = new Date();
    todayZero.setHours(0, 0, 0, 0);

    const calendarDays = [];
    let currDate = new Date(startDate);

    while (currDate <= endDate) {
        const cellDate = new Date(currDate);
        cellDate.setHours(0,0,0,0);
        
        const activeOptionsForDay = openOptions.filter(o => {
            const exp = new Date(o.expiryDate);
            exp.setHours(0,0,0,0);
            return cellDate >= todayZero && cellDate <= exp;
        });

        const isExpiryDay = openOptions.some(o => {
            const exp = new Date(o.expiryDate);
            exp.setHours(0,0,0,0);
            return cellDate.getTime() === exp.getTime();
        });

        calendarDays.push({
            date: cellDate,
            isCurrentMonth: cellDate.getMonth() === month,
            isToday: cellDate.getTime() === todayZero.getTime(),
            isPast: cellDate < todayZero,
            activeOptions: activeOptionsForDay,
            isExpiryDay: isExpiryDay
        });

        currDate.setDate(currDate.getDate() + 1);
    }

    return { options: openOptions, calendarDays };
  }, [selectedStockForSchedule, pnlByStock, calendarBaseDate]);

  // 修改 stockSymbolsWithRecords 以支援自訂排序
  const stockSymbolsWithRecords = useMemo(() => {
    const symbols = Object.keys(pnlByStock);
    return symbols.sort((a, b) => {
       const idxA = customOrder.indexOf(a);
       const idxB = customOrder.indexOf(b);
       if (idxA !== -1 && idxB !== -1) return idxA - idxB;
       if (idxA !== -1) return -1;
       if (idxB !== -1) return 1;
       return a.localeCompare(b);
    });
  }, [pnlByStock, customOrder]);

  // 拖拉事件處理邏輯
  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };
  
  const handleDragOver = (e, index) => e.preventDefault();
  
  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIndex) return;

    const newOrder = [...stockSymbolsWithRecords];
    const draggedItem = newOrder[draggedIdx];
    newOrder.splice(draggedIdx, 1);
    newOrder.splice(dropIndex, 0, draggedItem);

    setCustomOrder(newOrder);
    setDraggedIdx(null);

    // 將新排序儲存至 Firebase
    try {
      const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'performance');
      await setDoc(ref, { symbolOrder: newOrder }, { merge: true });
    } catch (err) { console.error(err); }
  };

  const handleDeleteRecord = async (recordId) => {
    confirmAction(t("刪除"), t("確定要刪除這筆交易紀錄嗎？"), async () => {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'records', recordId));
      showToast(t("記錄已刪除"));
    });
  };

  const handleOpenTradeClick = (trade) => {
    if (Number(trade.openQty) > 0) {
      setSelectedTradeForClose(trade);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">{t("交易績效總覽")}</h2>
          <p className="text-slate-400">{t("檢視您所有紀錄的交易損益與資產表現。")}</p>
        </div>
        <Button icon={Plus} onClick={() => setIsAddModalOpen(true)}>{t("新增交易記錄")}</Button>
      </header>

      {stockSymbolsWithRecords.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800">
          <Activity size={48} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-xl font-medium text-slate-300 mb-2">{t("尚未有任何交易記錄")}</h3>
          <p className="text-slate-500">{t("為精確計算賺賠，請確保買入與賣出紀錄皆有登記。")}</p>
          <Button icon={Plus} variant="outline" onClick={() => setIsAddModalOpen(true)} className="mx-auto mt-6">{t("新增交易記錄")}</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stockSymbolsWithRecords.map((symbol, idx) => {
            const data = pnlByStock[symbol];
            const isBarView = cardViews[symbol] === 'bar';
            const hasRealizedPnL = data.gain > 0 || data.loss > 0;
            
            const pieData = [
              { name: t("總利潤 (Gain)"), value: data.gain },
              { name: t("總虧損 (Loss)"), value: data.loss }
            ];
            
            const barData = Object.keys(data.monthlyPnL).sort().map(m => ({
              month: m,
              pnl: data.monthlyPnL[m]
            }));

            return (
              <div 
                key={symbol} 
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onClick={(e) => toggleCardView(symbol, e)} 
                className="bg-slate-800 border border-slate-700 rounded-2xl p-6 cursor-grab active:cursor-grabbing hover:bg-slate-750 hover:border-blue-500 transition-all group shadow-lg flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">{symbol}</h3>
                  <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedStockForSchedule(symbol); }} 
                        className="p-1.5 text-slate-500 hover:text-purple-400 transition-colors rounded-lg hover:bg-purple-500/10" 
                        title={t("期權未平倉排程")}
                      >
                        <Calendar size={18} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedStockForDetail(symbol); }} 
                        className="p-1.5 text-slate-500 hover:text-blue-400 transition-colors rounded-lg hover:bg-blue-500/10" 
                        title={t("詳細交易日誌")}
                      >
                        <FileText size={18} />
                      </button>
                  </div>
                </div>
                
                <div className="w-full relative mt-4 mb-2" style={{ height: 192 }}>
                  {hasRealizedPnL ? (
                     isBarView ? (
                        <ResponsiveContainer width="100%" height={192}>
                          <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickMargin={5} />
                            <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `$${val}`} />
                            <Tooltip 
                               cursor={{ fill: '#334155', opacity: 0.4 }}
                               contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} 
                               itemStyle={{ color: '#fff' }}
                               formatter={(value) => [`$${Number(value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, t("淨損益 (Net)")]}
                            />
                            <ReferenceLine y={0} stroke="#64748b" />
                            <Bar 
                               dataKey="pnl" 
                               radius={[4, 4, 0, 0]} 
                               isAnimationActive={false}
                               cursor="pointer"
                               onClick={(data, index, e) => {
                                  if (e) e.stopPropagation();
                                  setSelectedStockForDetail(symbol);
                                  setSelectedMonthForDetail(data.month);
                               }}
                            >
                              {barData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#34d399' : '#fb7185'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                     ) : (
                        <>
                          <ResponsiveContainer width="100%" height={192}>
                            <PieChart>
                              <Pie 
                                data={pieData} 
                                dataKey="value" 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={55} 
                                outerRadius={75} 
                                stroke="none" 
                                isAnimationActive={false}
                              >
                                 {pieData.map((entry, index) => (
                                   <Cell key={`cell-${index}`} fill={index === 0 ? '#34d399' : '#fb7185'} />
                                 ))}
                              </Pie>
                              <Tooltip 
                                 contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }} 
                                 itemStyle={{ color: '#fff' }}
                                 formatter={(value) => `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                             <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">{t("淨損益 (Net)")}</div>
                             <div className={`text-base font-mono font-bold ${data.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                               {data.net >= 0 ? '+' : '-'}${Math.abs(data.net).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                             </div>
                          </div>
                        </>
                     )
                  ) : (
                     <div className="absolute inset-0 flex items-center justify-center border-4 border-slate-700/50 rounded-full w-32 h-32 mx-auto">
                        <span className="text-xs text-slate-500 font-medium">{t("尚無已實現損益")}</span>
                     </div>
                  )}
                </div>

                <div className="mt-4 flex justify-between text-sm border-t border-slate-700 pt-4">
                  <div className="text-emerald-400 font-mono">Gain: ${data.gain.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0})}</div>
                  <div className="text-rose-400 font-mono">Loss: ${data.loss.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0})}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddRecordModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        stocks={stocks} 
        db={db} 
        user={user} 
        appId={appId} 
        showToast={showToast} 
        t={t} 
        lang={lang} 
      />

      <Modal 
        isOpen={!!selectedStockForDetail} 
        title={
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-blue-400" />
              {selectedStockForDetail} - {selectedMonthForDetail ? `${selectedMonthForDetail} ${t("結算交易")}` : t("詳細交易日誌")}
            </div>
          </div>
        } 
        onClose={() => { setSelectedStockForDetail(null); setSelectedMonthForDetail(null); }}
      >
        {selectedStockForDetail && (
          <div className="space-y-4">
             <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800">
               <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                 <input 
                   type="checkbox" 
                   checked={showOnlyRealized} 
                   onChange={(e) => setShowOnlyRealized(e.target.checked)} 
                   className="rounded bg-slate-950 border-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900 w-4 h-4 cursor-pointer" 
                 />
                 {t("只顯示已結算交易")}
               </label>
             </div>

             <div className="space-y-3">
               {pnlByStock[selectedStockForDetail].trades
                 .filter(trade => selectedMonthForDetail ? ((trade.date || "").startsWith(selectedMonthForDetail)) : true)
                 .filter(trade => showOnlyRealized ? trade.isRealizing : true)
                 .map(trade => (
                <div
                  key={trade.id}
                  onClick={() => handleOpenTradeClick(trade)}
                  title={Number(trade.openQty) > 0 ? t("點擊以平倉") : undefined}
                  className={`bg-slate-900 border border-slate-700 rounded-xl p-4 group relative ${
                    Number(trade.openQty) > 0
                      ? 'cursor-pointer hover:border-emerald-500/60 transition-colors'
                      : ''
                  }`}
                >
                   <div className="flex justify-between items-start mb-2 border-b border-slate-800 pb-2 pr-6">
                     <div className="flex items-center gap-2 flex-wrap">
                       <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                         trade.action.toUpperCase() === 'BUY' ? 'bg-blue-500/20 text-blue-400' : 
                         trade.action.toUpperCase() === 'SELL' ? 'bg-amber-500/20 text-amber-400' : 
                         trade.action.toUpperCase() === 'LOSS' ? 'bg-rose-500/20 text-rose-400' : 
                         'bg-purple-500/20 text-purple-400'
                       }`}>
                         {trade.action.toUpperCase() === 'BUY' ? t('買入') : 
                          trade.action.toUpperCase() === 'SELL' ? t('賣出') : 
                          trade.action.toUpperCase() === 'LOSS' ? t('到期虧損') : t('到期獲利')}
                       </span>
                       <span className="text-slate-300 font-mono text-sm">{trade.assetName}</span>
                       
                       {trade.openQty > 0 && (
                          <span className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded text-[10px] font-bold tracking-wider uppercase shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                            {trade.openQty === Number(trade.qty) ? "OPEN" : `OPEN (${trade.openQty})`}
                          </span>
                       )}

                       {trade.isRealizing && trade.realizedPnL !== undefined && (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wider border ${
                              trade.realizedPnL >= 0 
                                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
                                  : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                          }`}>
                             {trade.realizedPnL >= 0 ? t('獲利') : t('虧損')} ${Math.abs(trade.realizedPnL).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </span>
                       )}
                     </div>
                   </div>
                   
                   <button onClick={(e) => { e.stopPropagation(); handleDeleteRecord(trade.id); }} className="absolute top-4 right-4 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Trash2 size={16} />
                   </button>

                   <div className="grid grid-cols-2 gap-2 text-sm">
                     <div className="text-slate-400">{t("日期")}: <span className="text-white">{trade.date}</span></div>
                     <div className="text-slate-400">{t("價格")}: <span className="text-white">${Number(trade.price).toFixed(2)}</span></div>
                     <div className="text-slate-400">{t("數量")}: <span className="text-white">{trade.qty}</span></div>
                     <div className="text-slate-400">{t("乘數 (Option通常為100)")}: <span className="text-white">{trade.multiplier || 1}</span></div>
                   </div>
                   {trade.rawText && (
                     <div className="mt-2 text-xs text-slate-600 font-mono truncate border-t border-slate-800 pt-2">
                       "{trade.rawText}"
                     </div>
                   )}
                 </div>
               ))}
               
               {pnlByStock[selectedStockForDetail].trades
                 .filter(trade => selectedMonthForDetail ? ((trade.date || "").startsWith(selectedMonthForDetail)) : true)
                 .filter(trade => showOnlyRealized ? trade.isRealizing : true)
                 .length === 0 && (
                  <div className="text-center py-6 text-slate-500 text-sm">
                     {t("尚未有任何交易記錄")}
                  </div>
               )}
             </div>
          </div>
        )}
      </Modal>

      <CloseTradeModal
        isOpen={!!selectedTradeForClose}
        trade={selectedTradeForClose}
        db={db}
        user={user}
        appId={appId}
        showToast={showToast}
        confirmAction={confirmAction}
        t={t}
        onClose={() => setSelectedTradeForClose(null)}
      />

      <Modal 
        isOpen={!!selectedStockForSchedule} 
        title={<div className="flex items-center gap-2"><Calendar size={20} className="text-purple-400"/> {selectedStockForSchedule} - {t("期權未平倉排程")}</div>}
        onClose={() => {
            setSelectedStockForSchedule(null);
            setCalendarBaseDate(new Date());
        }}
      >
        <div className="py-2">
           {!scheduleData || scheduleData.options.length === 0 ? (
               <div className="text-center py-10 text-slate-500">
                  <Calendar size={48} className="mx-auto mb-3 opacity-20" />
                  <p>{t("尚無未平倉的期權部位")}</p>
               </div>
           ) : (
               <div className="space-y-4">
                   <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                      <button 
                        onClick={() => {
                          const newD = new Date(calendarBaseDate);
                          newD.setMonth(newD.getMonth() - 1);
                          setCalendarBaseDate(newD);
                        }}
                        className="p-1.5 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                      >
                         <ChevronRight size={18} className="rotate-180" />
                      </button>
                      <div className="font-bold text-white tracking-wide">
                        {calendarBaseDate.toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { year: 'numeric', month: 'long' })}
                      </div>
                      <button 
                        onClick={() => {
                          const newD = new Date(calendarBaseDate);
                          newD.setMonth(newD.getMonth() + 1);
                          setCalendarBaseDate(newD);
                        }}
                        className="p-1.5 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                      >
                         <ChevronRight size={18} />
                      </button>
                   </div>

                   <div className="flex flex-wrap gap-2 text-xs">
                     {scheduleData.options.map((o, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2 py-1 rounded">
                           <div className={`w-2.5 h-2.5 rounded-full ${o.color}`}></div>
                           <span className="text-slate-300">{o.assetName} ({o.openQty}{t("口")})</span>
                        </div>
                     ))}
                   </div>

                   <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900">
                       <div className="grid grid-cols-7 bg-slate-800/80 border-b border-slate-700 text-[10px] text-center font-bold text-slate-400 py-2 uppercase">
                           <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                       </div>
                       
                       <div className="grid grid-cols-7 gap-px bg-slate-800">
                           {scheduleData.calendarDays.map((dayObj, i) => (
                               <div 
                                 key={i} 
                                 className={`min-h-[60px] p-1 flex flex-col gap-1 transition-colors ${
                                    dayObj.isCurrentMonth ? 'bg-slate-950' : 'bg-slate-900/50'
                                 } ${dayObj.isToday ? 'ring-1 ring-inset ring-blue-500 bg-blue-950/20' : ''}`}
                               >
                                   <div className={`text-right text-xs font-mono pr-1 ${
                                      dayObj.isPast ? 'text-slate-600' : 
                                      dayObj.isToday ? 'text-blue-400 font-bold' : 
                                      dayObj.isCurrentMonth ? 'text-slate-300' : 'text-slate-600'
                                   }`}>
                                       {dayObj.date.getDate()}
                                   </div>
                                   
                                   <div className="flex-1 flex flex-col gap-0.5 justify-end">
                                      {dayObj.activeOptions.map((opt, oIdx) => {
                                          const isExp = dayObj.date.getTime() === new Date(opt.expiryDate).setHours(0,0,0,0);
                                          return (
                                              <div 
                                                key={oIdx} 
                                                className={`h-1.5 rounded-sm w-full opacity-80 ${opt.color} ${isExp ? 'h-3 animate-pulse ring-1 ring-white/50' : ''}`}
                                                title={isExp ? `${opt.assetName} 到期！` : opt.assetName}
                                              />
                                          );
                                      })}
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
               </div>
           )}
        </div>
      </Modal>
    </div>
  );
};

const CloseTradeModal = ({
  isOpen,
  onClose,
  trade,
  db,
  user,
  appId,
  showToast,
  confirmAction,
  t
}) => {
  const [lifecycle, setLifecycle] = useState('close');
  const [closeQty, setCloseQty] = useState('');
  const [closePrice, setClosePrice] = useState('');
  const [strikePrice, setStrikePrice] = useState('');
  const [date, setDate] = useState(getLocalDateInputValue());
  const [isSaving, setIsSaving] = useState(false);

  const isOption = isOptionTrade(trade);
  const optionDetails = useMemo(
    () => parseOptionDetails(trade?.assetName),
    [trade?.assetName]
  );
  const openQty = Number(trade?.openQty || 0);
  const multiplier = Number(trade?.multiplier || 1);
  const originalAction = String(trade?.action || '').toUpperCase();
  const isLong = originalAction === 'BUY';
  const reverseAction = isLong ? 'Sell' : 'Buy';
  const lifecycleAction = isLong ? 'Loss' : 'Expire';
  const stockQuantity = openQty * multiplier;
  const underlyingAction = optionDetails.optionType === 'call'
    ? (isLong ? 'Buy' : 'Sell')
    : (isLong ? 'Sell' : 'Buy');

  useEffect(() => {
    if (!isOpen || !trade) return;

    setLifecycle('close');
    setCloseQty(String(Number(trade.qty) || openQty));
    setClosePrice('');
    setStrikePrice(optionDetails.strike === null ? '' : String(optionDetails.strike));
    setDate(getLocalDateInputValue());
    setIsSaving(false);
  }, [isOpen, trade?.id, trade?.assetName, trade?.qty, openQty, optionDetails.strike]);

  const formatAmount = (value) => {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
      : '-';
  };

  const actionLabel = (action) => action === 'Buy' ? t("買入") : t("賣出");

  const handleSubmit = () => {
    if (!trade || openQty <= 0) {
      showToast(t("找不到有效的未平倉數量"), "error");
      return;
    }

    if (!date || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
      showToast(t("請輸入有效的日期"), "error");
      return;
    }

    const enteredClosePrice = Number(closePrice);
    const enteredCloseQty = Number(closeQty);
    if (lifecycle === 'close') {
      if (!Number.isFinite(enteredCloseQty) || enteredCloseQty <= 0) {
        showToast(t("請輸入有效的數量"), "error");
        return;
      }
      if (enteredCloseQty > openQty) {
        showToast(t("平倉數量不可超過未平倉數量"), "error");
        return;
      }
      if (!Number.isFinite(enteredClosePrice) || enteredClosePrice <= 0) {
        showToast(t("請輸入有效的價格"), "error");
        return;
      }
    }

    const originalPremium = Number(trade.price);
    if (lifecycle !== 'close' && (!Number.isFinite(originalPremium) || originalPremium < 0)) {
      showToast(t("請輸入有效的價格"), "error");
      return;
    }

    const strike = optionDetails.strike ?? Number(strikePrice);
    if (lifecycle === 'execute') {
      if (!optionDetails.optionType) {
        showToast(t("Option 名稱缺少 Call/Put"), "error");
        return;
      }
      if (!Number.isFinite(strike) || strike <= 0) {
        showToast(t("無法解析履約價，請輸入履約價"), "error");
        return;
      }
    }

    const optionQuantity = lifecycle === 'close' ? enteredCloseQty : openQty;
    const actionText = lifecycle === 'close'
      ? `${actionLabel(reverseAction)} ${trade.assetName}`
      : lifecycle === 'expire'
        ? `${isLong ? t("到期虧損") : t("到期獲利")} ${trade.assetName}`
        : `${t("執行")} ${trade.assetName}`;
    const detailsText = lifecycle === 'close'
      ? `${actionText}, ${t("數量")} ${optionQuantity}, ${t("價格")} $${formatAmount(enteredClosePrice)}, ${t("日期")} ${date}`
      : lifecycle === 'expire'
        ? `${actionText}, ${t("數量")} ${optionQuantity}, ${t("原始 premium")} $${formatAmount(originalPremium)}, ${t("日期")} ${date}`
        : `${actionText}, ${t("原始 premium")} $${formatAmount(originalPremium)}, ${underlyingAction === 'Buy' ? t("買入") : t("賣出")} ${stockQuantity} ${trade.symbol} @ $${formatAmount(strike)}, ${t("日期")} ${date}`;

    confirmAction(t("確認交易"), `${t("將新增交易")}: ${detailsText}`, async () => {
      setIsSaving(true);
      try {
        const batch = writeBatch(db);
        const createdAt = Date.now();

        const addGeneratedRecord = (data) => {
          const ref = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'records'));
          batch.set(ref, {
            id: ref.id,
            createdAt,
            sourceTradeId: trade.id,
            ...data
          });
        };

        if (lifecycle === 'close') {
          addGeneratedRecord({
            symbol: trade.symbol,
            assetClass: isOption ? 'Option' : 'Stock',
            assetName: trade.assetName,
            action: reverseAction,
            qty: optionQuantity,
            price: enteredClosePrice,
            multiplier: multiplier,
            date,
            lifecycleAction: 'close',
            rawText: `Close ${reverseAction} ${trade.assetName} ${optionQuantity}@${enteredClosePrice} ${date}`
          });
        } else {
          addGeneratedRecord({
            symbol: trade.symbol,
            assetClass: 'Option',
            assetName: trade.assetName,
            action: lifecycleAction,
            qty: optionQuantity,
            price: originalPremium,
            multiplier,
            date,
            lifecycleAction: lifecycle,
            rawText: `${lifecycle === 'execute' ? 'Execute' : 'Expire'} ${trade.assetName} ${optionQuantity}@${originalPremium} ${date}`
          });

          if (lifecycle === 'execute') {
            addGeneratedRecord({
              symbol: trade.symbol,
              assetClass: 'Stock',
              assetName: trade.symbol,
              action: underlyingAction,
              qty: stockQuantity,
              price: strike,
              multiplier: 1,
              date,
              lifecycleAction: 'execute-underlying',
              rawText: `Execute ${trade.assetName}: ${underlyingAction} ${trade.symbol} ${stockQuantity}@${strike} ${date}`
            });
          }
        }

        await batch.commit();
        showToast(t("交易已儲存！"));
        onClose();
      } catch (error) {
        console.error(error);
        showToast(t("匯入失敗，發生未知的錯誤。"), "error");
      } finally {
        setIsSaving(false);
      }
    });
  };

  if (!isOpen || !trade) return null;

  return (
    <Modal
      isOpen={isOpen}
      title={<div className="flex items-center gap-2"><Activity size={20} className="text-emerald-400" /> {t("平倉交易")}</div>}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>{t("取消")}</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSaving || openQty <= 0}>
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {t("確認執行")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 space-y-2">
          <div className="text-white font-mono text-sm break-all">{trade.assetName}</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-slate-400">{t("原交易數量")}: <span className="text-white font-mono">{trade.qty}</span></div>
            <div className="text-slate-400">{t("目前未平倉數量")}: <span className="text-emerald-400 font-mono">{openQty}</span></div>
            <div className="text-slate-400">{t("原始動作")}: <span className="text-white">{actionLabel(originalAction === 'BUY' ? 'Buy' : 'Sell')}</span></div>
          </div>
        </div>

        {isOption && (
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t("平倉動作")}</label>
            <select
              value={lifecycle}
              onChange={(event) => setLifecycle(event.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-blue-500"
            >
              <option value="close">{t("平倉")} ({actionLabel(reverseAction)})</option>
              <option value="expire">{t("到期")}</option>
              <option value="execute">{t("執行")}</option>
            </select>
          </div>
        )}

        {!isOption && (
          <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 text-sm text-blue-200">
            {t("平倉動作")}: <span className="font-bold">{actionLabel(reverseAction)}</span>
          </div>
        )}

        {lifecycle === 'close' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t("數量")}</label>
              <input
                type="number"
                min="0"
                max={openQty}
                step="any"
                value={closeQty}
                onChange={(event) => setCloseQty(event.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white font-mono outline-none focus:border-blue-500"
                placeholder="0"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t("成交價（每股／每份）")}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={closePrice}
                onChange={(event) => setClosePrice(event.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white font-mono outline-none focus:border-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>
        ) : (
          <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-3 text-sm text-purple-200">
            {t("原始 premium")}: <span className="font-mono">${formatAmount(trade.price)}</span>
            <span className="ml-2">({isLong ? t("到期虧損") : t("到期獲利")})</span>
          </div>
        )}

        {isOption && lifecycle === 'execute' && (
          <div className="space-y-3">
            {!optionDetails.optionType && (
              <div className="bg-rose-900/20 border border-rose-800/50 rounded-lg p-3 text-sm text-rose-200">
                {t("Option 名稱缺少 Call/Put")}
              </div>
            )}
            {optionDetails.strike === null ? (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">{t("履約價")}</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={strikePrice}
                  onChange={(event) => setStrikePrice(event.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white font-mono outline-none focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
            ) : (
              <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-3 text-sm text-amber-200">
                {t("履約價")}: <span className="font-mono">${formatAmount(optionDetails.strike)}</span>
              </div>
            )}
            <div className="bg-slate-900/70 border border-slate-700 rounded-lg p-3 text-sm text-slate-300">
              {actionLabel(underlyingAction)} {stockQuantity} {trade.symbol} @ ${formatAmount(strikePrice || optionDetails.strike)}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">{t("日期")}</label>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white font-mono outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </Modal>
  );
};

const AddRecordModal = ({ isOpen, onClose, stocks, db, user, appId, showToast, t, lang }) => {
  const [selectedSymbol, setSelectedSymbol] = useState(stocks[0]?.symbol || '');
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedDataList, setParsedDataList] = useState(null);

  useEffect(() => {
    if (isOpen) {
       setSelectedSymbol(stocks[0]?.symbol || '');
       setRawText('');
       setParsedDataList(null);
       setIsParsing(false);
    }
  }, [isOpen, stocks]);

  const handleParse = async () => {
    if (!rawText.trim() || !selectedSymbol) return;
    setIsParsing(true);
    
    const prompt = `You are an expert financial trade parser. Parse the following trade log into an array of structured JSON objects.
    Log: "${rawText}"
    Associated Symbol: "${selectedSymbol}"
    
    Rules for Option Execution/Expiration:
    1. Short Call Executed (default if just "Executed Call" and no "Long" mentioned):
       - Object 1: action="Expire", assetClass="Option", price=premium (premium fully earned)
       - Object 2: action="Sell", assetClass="Stock", price=strike price
    2. Short Put Executed (default if just "Executed Put" and no "Long" mentioned):
       - Object 1: action="Expire", assetClass="Option", price=premium
       - Object 2: action="Buy", assetClass="Stock", price=strike price
    3. Long Call Executed (must be explicitly stated as Long):
       - Object 1: action="Loss", assetClass="Option", price=premium (premium fully lost)
       - Object 2: action="Buy", assetClass="Stock", price=strike price
    4. Long Put Executed (must be explicitly stated as Long):
       - Object 1: action="Loss", assetClass="Option", price=premium
       - Object 2: action="Sell", assetClass="Stock", price=strike price
    5. Option Expired (Worthless):
       - If Short (default): action="Expire", assetClass="Option", price=premium
       - If Long: action="Loss", assetClass="Option", price=premium
    6. Standard Buy/Sell:
       - action="Buy" or "Sell", assetClass="Stock" or "Option", price=execution price

    IMPORTANT: 
    - "assetName" should include strike and expiration for options (e.g., "ONDS 24 Apr26 9.5 Call").
    - For the Stock transaction resulting from an option execution, the "qty" MUST be the option qty multiplied by its multiplier (e.g., 3 options * 100 = 300 stock qty).

    Return ONLY a valid JSON array matching this exact schema (do not include markdown \`\`\`json wrappers):
    [
      {
        "assetClass": "Stock" or "Option",
        "assetName": "string",
        "action": "Buy", "Sell", "Expire", or "Loss",
        "qty": number (positive integer),
        "price": number,
        "multiplier": number (1 for stock, typically 100 for options),
        "date": "YYYY-MM-DD"
      }
    ]
    If the year is missing, assume the current logical year (e.g. 2026).`;

    const result = await callGeminiAPI(prompt);
    setIsParsing(false);

    if (result) {
       try {
         const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
         const data = JSON.parse(cleanJson);
         const dataArray = Array.isArray(data) ? data : [data];
         setParsedDataList(dataArray.map(item => ({ ...item, id: crypto.randomUUID() })));
         showToast(t("指令轉換成功"));
       } catch (err) {
         showToast(t("AI 轉換失敗，請重新嘗試。"), "error");
       }
    } else {
       showToast(t("API 連線失敗，請稍後再試。"), "error");
    }
  };

  const handleAddRecordChange = (id, field, value) => {
    setParsedDataList(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleRemoveParsed = (id) => {
    setParsedDataList(prev => prev.filter(item => item.id !== id));
  };

  const handleSave = async () => {
    if (!parsedDataList || parsedDataList.length === 0) return;
    try {
       const batch = writeBatch(db);
       parsedDataList.forEach(data => {
           const ref = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'records'));
           batch.set(ref, {
             id: ref.id,
             symbol: selectedSymbol,
             assetClass: data.assetClass,
             assetName: data.assetName,
             action: data.action,
             qty: data.qty,
             price: data.price,
             multiplier: data.multiplier,
             date: data.date,
             rawText: rawText,
             createdAt: Date.now()
           });
       });
       await batch.commit();
       showToast(t("記錄已儲存！"));
       onClose();
    } catch (e) {
       showToast(t("匯入失敗，發生未知的錯誤。"), "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b border-slate-700">
          <div className="text-xl font-bold text-white flex items-center gap-2"><Activity size={20} className="text-blue-400" /> {t("新增交易記錄")}</div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>
        
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          {stocks.length === 0 ? (
            <p className="text-amber-400">{t("請先前往「股票代碼清單」新增您想追蹤的標的。")}</p>
          ) : (
            <div className="space-y-4">
               <div>
                 <label className="block text-sm font-medium text-slate-400 mb-1">{t("選擇股票")}</label>
                 <select 
                   value={selectedSymbol} 
                   onChange={(e) => setSelectedSymbol(e.target.value)} 
                   className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 outline-none focus:border-blue-500"
                 >
                   {stocks.map(s => <option key={s.symbol} value={s.symbol}>{s.symbol} - {s.name}</option>)}
                 </select>
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-slate-400 mb-1">{t("輸入原始交易紀錄 (例如: Sell ONDS 300@9.5 2026/4/24)")}</label>
                 <textarea 
                   value={rawText} 
                   onChange={(e) => setRawText(e.target.value)}
                   className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono resize-none h-24"
                 />
                 <Button variant="outline" onClick={handleParse} disabled={isParsing || !rawText.trim()} className={`w-full mt-2 border-purple-600/50 text-purple-400 hover:bg-purple-900/30 ${isParsing ? 'animate-pulse' : ''}`}>
                    {isParsing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} 
                    {isParsing ? t("AI 正在分析...") : t("✨ AI 智慧解析")}
                 </Button>
               </div>

               {parsedDataList && parsedDataList.length > 0 && (
                 <div className="space-y-4 mt-4">
                   {parsedDataList.map((parsedData, index) => (
                     <div key={parsedData.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4 relative animate-in slide-in-from-bottom-2">
                        <button onClick={() => handleRemoveParsed(parsedData.id)} className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 transition-colors">
                          <X size={18} />
                        </button>
                        <div className="text-purple-400 text-xs font-bold mb-3 uppercase tracking-wider">{t("解析動作")} {index + 1}</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-slate-500 uppercase">{t("動作")}</label>
                            <select 
                              value={parsedData.action} 
                              onChange={e => handleAddRecordChange(parsedData.id, 'action', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white"
                            >
                              <option value="Buy">{t("買入")}</option>
                              <option value="Sell">{t("賣出")}</option>
                              <option value="Expire">{t("到期獲利")}</option>
                              <option value="Loss">{t("到期虧損")}</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 uppercase">{t("資產類別")}</label>
                            <select 
                              value={parsedData.assetClass} 
                              onChange={e => handleAddRecordChange(parsedData.id, 'assetClass', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white"
                            >
                              <option value="Stock">{t("股票")}</option>
                              <option value="Option">{t("選擇權")}</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[11px] text-slate-500 uppercase">{t("資產名稱")}</label>
                            <input type="text" value={parsedData.assetName} onChange={e => handleAddRecordChange(parsedData.id, 'assetName', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white font-mono" />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 uppercase">{t("數量")}</label>
                            <input type="number" value={parsedData.qty} onChange={e => handleAddRecordChange(parsedData.id, 'qty', Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white font-mono" />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 uppercase">{t("價格")}</label>
                            <input type="number" value={parsedData.price} onChange={e => handleAddRecordChange(parsedData.id, 'price', Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white font-mono" />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 uppercase">{t("乘數 (Option通常為100)")}</label>
                            <input type="number" value={parsedData.multiplier} onChange={e => handleAddRecordChange(parsedData.id, 'multiplier', Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white font-mono" />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 uppercase">{t("日期")}</label>
                            <input type="text" value={parsedData.date} onChange={e => handleAddRecordChange(parsedData.id, 'date', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white font-mono" />
                          </div>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-700 bg-slate-800/50 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>{t("取消")}</Button>
          <Button variant="primary" onClick={handleSave} disabled={!parsedDataList || parsedDataList.length === 0} icon={Save}>{t("儲存")}</Button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lang, setLang] = useState('zh');
  
  const t = (text) => lang === 'zh' ? text : (TRANSLATIONS.en[text] || text);
  
  const [stocks, setStocks] = useState([]);
  const [simulations, setSimulations] = useState([]);
  const [records, setRecords] = useState([]); 
  const [marketData, setMarketData] = useState({});
  const [liveQuotes, setLiveQuotes] = useState({}); 
  const [loadingQuotes, setLoadingQuotes] = useState({}); 
  const [userSettings, setUserSettings] = useState({ alphaVantageKey: '', lang: 'zh' });
  
  const [toast, setToast] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  
  const [qrUrl, setQrUrl] = useState('');
  const isQrUrlValid = useMemo(() => qrUrl.trim() !== '' && !qrUrl.startsWith('blob:'), [qrUrl]);

  useEffect(() => {
    if (isQrModalOpen) {
      setQrUrl(window.location.href);
    }
  }, [isQrModalOpen]);

  const fallbackCopyTextToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(t("網址已複製"));
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
  };

  const handleCopyUrl = () => {
    if (isQrUrlValid) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(qrUrl)
            .then(() => showToast(t("網址已複製")))
            .catch(() => fallbackCopyTextToClipboard(qrUrl));
        } else {
          fallbackCopyTextToClipboard(qrUrl);
        }
      } catch (err) {
        fallbackCopyTextToClipboard(qrUrl);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (isCloudAuthEnabled) {
      const unsubscribe = onSessionChange((session) => {
        if (!cancelled) {
          setUser(sessionUser(session));
          setAuthReady(true);
        }
      });
      getCurrentSession()
        .then((session) => {
          if (!cancelled) {
            setUser(sessionUser(session));
            setAuthReady(true);
          }
        })
        .catch((error) => {
          console.error(error);
          if (!cancelled) {
            setAuthMessage(error.message);
            setAuthReady(true);
          }
        });
      return () => {
        cancelled = true;
        unsubscribe();
      };
    }

    const waitForBackend = async () => {
      for (let attempt = 0; attempt < 30; attempt++) {
        if (cancelled) return;
        try {
          await api.health();
          if (!cancelled) {
            setUser(LOCAL_USER);
            setAuthReady(true);
          }
          return;
        } catch (err) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      if (!cancelled) {
        setAuthReady(true);
        setAuthMessage(t("登入失敗，請重新載入"));
      }
    };
    waitForBackend();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user) return;
    const stocksRef = collection(db, 'artifacts', appId, 'users', user.uid, 'stocks');
    const unsubStocks = onSnapshot(stocksRef, (snapshot) => {
      const loadedStocks = [];
      snapshot.forEach(doc => loadedStocks.push({ id: doc.id, ...doc.data() }));
      loadedStocks.sort((a, b) => (a.order || 0) - (b.order || 0));
      setStocks(loadedStocks);
    }, (error) => console.error(error));

    const simsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'simulations');
    const unsubSims = onSnapshot(simsRef, (snapshot) => {
      const loadedSims = [];
      snapshot.forEach(doc => loadedSims.push({ id: doc.id, ...doc.data() }));
      setSimulations(loadedSims.sort((a, b) => b.createdAt - a.createdAt));
    }, (error) => console.error(error));

    const recordsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'records');
    const unsubRecords = onSnapshot(recordsRef, (snapshot) => {
      const loadedRecords = [];
      snapshot.forEach(doc => loadedRecords.push({ id: doc.id, ...doc.data() }));
      setRecords(loadedRecords);
    }, (error) => console.error(error));

    const settingsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'api');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserSettings(data);
        setTempApiKey(data.alphaVantageKey || '');
        if (data.lang && (data.lang === 'zh' || data.lang === 'en')) {
          setLang(data.lang);
        }
      }
    }, (error) => console.error(error));

    return () => { unsubStocks(); unsubSims(); unsubRecords(); unsubSettings(); };
  }, [user]);

  const handleToggleLang = async () => {
    const newLang = lang === 'zh' ? 'en' : 'zh';
    setLang(newLang); 
    if (user) {
      try {
        const settingsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'api');
        await setDoc(settingsRef, { lang: newLang }, { merge: true });
      } catch (err) {
        console.error("Failed to sync language to cloud:", err);
      }
    }
  };

  const fetchingSymbols = useRef(new Set());
  const fetchedSymbols = useRef(new Map());

  useEffect(() => {
    if (stocks.length === 0 || !user) return;
    
    stocks.forEach(async (stock) => {
      const isActive = stock.isActive !== false; 

      if (fetchedSymbols.current.get(stock.symbol) === isActive) return;
      if (fetchingSymbols.current.has(stock.symbol)) return;

      fetchingSymbols.current.add(stock.symbol);

      try {
        let history = null;
        let quote = null; 
        let requiresSave = false;
        let cachedData = null;
        const cacheRef = doc(db, 'artifacts', appId, 'public', 'data', 'market_data_cache', stock.symbol);
        
        try {
          const cacheSnap = await getDoc(cacheRef);
          if (cacheSnap.exists()) {
            cachedData = cacheSnap.data();
            const lastUpdated = cachedData.lastUpdatedAt || 0;
            const eightHours = 8 * 60 * 60 * 1000;
            if (Date.now() - lastUpdated < eightHours) {
              history = cachedData.history;
              quote = cachedData.quoteData; 
              console.log(`[Cache Hit] Loaded ${stock.symbol} history and quotes from database. Skipped API fetch.`);
            }
          }
        } catch (err) { console.error(err); }

        if (!isActive) {
          let inactiveHistory = null;
          let inactiveQuote = null;

          if (cachedData?.history?.length > 0 && !cachedData.history[cachedData.history.length - 1].isMock) {
             inactiveHistory = cachedData.history;
             inactiveQuote = cachedData.quoteData || null;
          } else {
             // A deactivated stock that has never been fetched has no real data
             // to show. Fabricating a price here means displaying an invented
             // number as if it were the market price, so fetch it once and cache
             // it; being deactivated only suppresses the recurring refresh.
             inactiveHistory = await fetchRealStockHistory(stock.symbol, userSettings.alphaVantageKey);
             if (inactiveHistory?.length > 0) {
                inactiveQuote = await fetchRealStockQuote(stock.symbol);
                try {
                  await setDoc(cacheRef, {
                    symbol: stock.symbol,
                    history: inactiveHistory,
                    quoteData: inactiveQuote || null,
                    lastUpdatedAt: Date.now()
                  }, { merge: true });
                } catch (err) { console.error(err); }
             } else {
                inactiveHistory = generateFallbackStockHistory(stock.symbol);
                inactiveQuote = null;
             }
          }

          setMarketData(prev => ({ ...prev, [stock.symbol]: inactiveHistory }));
          if (inactiveQuote) {
             setLiveQuotes(prev => ({ ...prev, [stock.symbol]: inactiveQuote }));
          } else {
             setLiveQuotes(prev => {
               const next = { ...prev };
               delete next[stock.symbol];
               return next;
             });
          }

          fetchedSymbols.current.set(stock.symbol, isActive);
          return;
        }

        if (!history || history.length === 0) {
          history = await fetchRealStockHistory(stock.symbol, userSettings.alphaVantageKey);
          if (!history || history.length === 0) {
            if (cachedData && cachedData.history?.length > 0 && !cachedData.history[cachedData.history.length - 1].isMock) {
               history = cachedData.history;
               quote = cachedData.quoteData || null;
               requiresSave = true; 
            } else {
               history = generateFallbackStockHistory(stock.symbol);
               
               setLiveQuotes(prev => {
                 const next = { ...prev };
                 delete next[stock.symbol];
                 return next;
               });
            }
          } else {
            requiresSave = true; 
          }
        }

        if (history && history.length > 0) {
          setMarketData(prev => ({ ...prev, [stock.symbol]: history }));

          const isMockData = history[history.length - 1]?.isMock;
          if (!isMockData) {
            if (!quote) {
              setLoadingQuotes(prev => ({ ...prev, [stock.symbol]: true }));
              quote = await fetchRealStockQuote(stock.symbol);
              setLoadingQuotes(prev => ({ ...prev, [stock.symbol]: false }));
              
              if (quote) requiresSave = true; 
            }

            if (quote) {
              setLiveQuotes(prev => ({ ...prev, [stock.symbol]: quote }));
              
              if (!stock.isManuallyEdited && (stock.name === '自訂股票' || stock.name === 'Custom Stock' || stock.name === stock.symbol)) {
                if (quote.name !== stock.name) {
                  try {
                    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'stocks', stock.id);
                    await setDoc(ref, { name: quote.name }, { merge: true });
                  } catch (err) { console.error(err); }
                }
              }
            }
          }

          if (requiresSave && !isMockData) {
            try {
              await setDoc(cacheRef, { 
                symbol: stock.symbol, 
                history: history, 
                quoteData: quote || null, 
                lastUpdatedAt: Date.now() 
              }, { merge: true });
            } catch (err) { console.error(err); }
          }
          fetchedSymbols.current.set(stock.symbol, isActive);
        }
      } catch (err) {
        console.error(err);
      } finally {
        fetchingSymbols.current.delete(stock.symbol);
      }
    });
  }, [stocks, user, userSettings.alphaVantageKey]);

  // Every caller is an explicit user action (refresh button, retry light, or
  // activating the stock), so a deactivated stock is no longer refused here.
  // "Deactivated" only means "do not sync automatically".
  const forceFetchStock = async (stock) => {
    const symbol = stock.symbol;
    setMarketData(prev => ({ ...prev, [symbol]: null }));
    fetchingSymbols.current.add(symbol);
    fetchedSymbols.current.delete(symbol);
    
    try {
      let history = await fetchRealStockHistory(symbol, userSettings.alphaVantageKey);
      let quote = null;

      if (!history || history.length === 0) {
        const cacheRef = doc(db, 'artifacts', appId, 'public', 'data', 'market_data_cache', symbol);
        const cacheSnap = await getDoc(cacheRef);
        const cachedData = cacheSnap.exists() ? cacheSnap.data() : null;

        if (cachedData && cachedData.history?.length > 0 && !cachedData.history[cachedData.history.length - 1].isMock) {
           showToast(t("真實資料同步失敗，已保留您手動匯入或先前的歷史紀錄。"), 'warning');
           history = cachedData.history;
           quote = cachedData.quoteData || null;
           setMarketData(prev => ({ ...prev, [symbol]: history }));
           if (quote) {
              setLiveQuotes(prev => ({ ...prev, [symbol]: quote }));
           }
           await setDoc(cacheRef, { lastUpdatedAt: Date.now() }, { merge: true });
        } else {
           showToast(`${t("無法抓取")} ${symbol} ${t("真實資料，維持備用資料。")}`, 'error');
           history = generateFallbackStockHistory(symbol);
           setMarketData(prev => ({ ...prev, [symbol]: history }));
           
           setLiveQuotes(prev => {
             const next = { ...prev };
             delete next[symbol];
             return next;
           });
        }

      } else {
        showToast(`${symbol} ${t("真實股價更新成功！")}`);
        
        setMarketData(prev => ({ ...prev, [symbol]: history }));

        setLoadingQuotes(prev => ({ ...prev, [symbol]: true }));
        quote = await fetchRealStockQuote(symbol);
        setLoadingQuotes(prev => ({ ...prev, [symbol]: false }));

        if (quote) {
           setLiveQuotes(prev => ({ ...prev, [symbol]: quote }));
           if (!stock.isManuallyEdited && (stock.name === '自訂股票' || stock.name === 'Custom Stock' || stock.name === symbol)) {
             if (quote.name !== stock.name) {
               const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'stocks', stock.id);
               await setDoc(ref, { name: quote.name }, { merge: true });
             }
           }
        }

        try {
          const cacheRef = doc(db, 'artifacts', appId, 'public', 'data', 'market_data_cache', symbol);
          await setDoc(cacheRef, { symbol: symbol, history: history, quoteData: quote, lastUpdatedAt: Date.now() }, { merge: true });
        } catch (err) {}
      }
      
      // Record the stock's real state, not a hardcoded `true`; otherwise the
      // auto-sync effect sees a mismatch and immediately re-runs for this symbol.
      fetchedSymbols.current.set(symbol, stock.isActive !== false);
    } catch (err) {
      console.error(err);
    } finally {
      fetchingSymbols.current.delete(symbol);
    }
  };

  const handleManualImportHTML = async (symbol, file) => {
    try {
      const htmlText = await file.text();
      const history = extractHistoryFromYahooHtml(symbol, htmlText);

      if (history && history.length > 0) {
        setMarketData(prev => ({ ...prev, [symbol]: history }));

        const todayData = history[history.length - 1];
        const yesterdayData = history.length > 1 ? history[history.length - 2] : todayData;
        const change = todayData.close - yesterdayData.close;
        const changePct = yesterdayData.close ? (change / yesterdayData.close) * 100 : 0;

        const manualQuote = {
           name: symbol,
           price: todayData.close,
           change: change,
           changePct: changePct
        };

        setLiveQuotes(prev => ({ ...prev, [symbol]: manualQuote }));

        const cacheRef = doc(db, 'artifacts', appId, 'public', 'data', 'market_data_cache', symbol);
        await setDoc(cacheRef, { 
          symbol: symbol, 
          history: history, 
          quoteData: manualQuote, 
          lastUpdatedAt: Date.now() 
        }, { merge: true });

        const targetStock = stocks.find(s => s.symbol === symbol);
        const currentIsActive = targetStock ? targetStock.isActive !== false : true;
        fetchedSymbols.current.set(symbol, currentIsActive);
        
        showToast(`${t("成功匯入")} ${symbol} (${history.length} ${t("筆資料")})`);
      } else {
        showToast(t("無法解析 HTML 中的表格資料，請確認格式。"), 'error');
      }
    } catch (e) {
      console.error(e);
      showToast(t("匯入失敗，發生未知的錯誤。"), 'error');
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const confirmAction = (title, message, onConfirm) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm: () => { onConfirm(); setConfirmModal({ isOpen: false }); } });
  };

  const handleCloudSignIn = async (mode) => {
    const email = authEmail.trim();
    if (!email) {
      setAuthMessage('Email is required');
      return;
    }
    setAuthBusy(true);
    setAuthMessage('');
    try {
      if (mode === 'magic') {
        await sendMagicLink(email);
        setAuthMessage('Magic link sent. Please check your email.');
      } else {
        await signInWithPassword(email, authPassword);
      }
    } catch (error) {
      setAuthMessage(error.message || 'Sign in failed');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      showToast(error.message || 'Sign out failed', 'error');
    }
  };

  const handleExport = async () => {
    let performanceSettings = null;
    let marketDataCache = [];
    if (user) {
      try {
        const perfRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'performance');
        const perfSnap = await getDoc(perfRef);
        if (perfSnap.exists()) {
          performanceSettings = perfSnap.data();
        }
        marketDataCache = await api.listDocs('market_data_cache');
      } catch (err) {
        console.error(err);
      }
    }

    const data = createBackup({
      stocks,
      simulations,
      records,
      userSettings,
      performanceSettings,
      marketDataCache,
      source: {
        systemVersion: SYSTEM_VERSION,
        userId: user?.uid || null,
        authMode: isCloudAuthEnabled ? 'supabase' : 'local',
      },
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade-decision-model-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t("資料已成功匯出"));
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        let existingPerformanceSettings = null;
        const perfRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'performance');
        const perfSnap = await getDoc(perfRef);
        if (perfSnap.exists()) existingPerformanceSettings = perfSnap.data();
        const { operations, summary } = parseBackup(data, {
          existingUserSettings: userSettings,
          existingPerformanceSettings,
        });

        const applyImport = async () => {
          try {
            const batch = writeBatch(db);
            operations.forEach((operation) => {
              const ref = doc(db, operation.collection, operation.id);
              batch.set(ref, operation.data, { merge: true });
            });
            await batch.commit();
            setIsImportModalOpen(false);
            showToast(`${t("資料智慧合併匯入成功！")} (${summary.total})`);
          } catch (err) {
            console.error(err);
            showToast(t("匯入失敗，發生未知的錯誤。"), "error");
          }
        };

        confirmAction(
          t("確認匯入備份"),
          `${t("將合併以下資料，不會刪除現有資料")}：`
            + `${t("股票")} ${summary.stocks}、`
            + `${t("模擬")} ${summary.simulations}、`
            + `${t("交易紀錄")} ${summary.records}、`
            + `${t("行情快取")} ${summary.marketDataCache}`,
          applyImport,
        );
      } catch (err) {
        console.error(err);
        showToast(t("匯入失敗：檔案格式不正確"), "error");
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    const settingsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'api');
    await setDoc(settingsRef, { alphaVantageKey: tempApiKey.trim() }, { merge: true });
    setIsSettingsModalOpen(false);
    showToast(t("設定已儲存"));
  };

  if (!user) {
    if (isCloudAuthEnabled && authReady) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-6">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div>
              <h1 className="text-xl font-bold">{t("交易決策系統")}</h1>
              <p className="text-sm text-slate-400 mt-1">Sign in with Supabase</p>
            </div>
            <input
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-blue-500"
            />
            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleCloudSignIn('password')}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 focus:outline-none focus:border-blue-500"
            />
            {authMessage && <p className="text-sm text-amber-300">{authMessage}</p>}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="primary" onClick={() => handleCloudSignIn('password')} disabled={authBusy}>
                {authBusy ? 'Signing in…' : 'Sign in'}
              </Button>
              <Button variant="outline" onClick={() => handleCloudSignIn('magic')} disabled={authBusy}>
                Email magic link
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          {!authReady && <RefreshCw className="animate-spin text-blue-500" size={40} />}
          <p>{authMessage || t("系統初始化中...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30 flex overflow-hidden">
      
      <style>{`
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.15);
          border-radius: 8px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.3);
        }
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.15) transparent;
        }
      `}</style>

      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex z-10 shrink-0">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h1 className="font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2 overflow-hidden">
            <Swords size={24} className="text-blue-400 flex-shrink-0" />
            <div className="flex flex-col min-w-0">
               <span className="text-base lg:text-[1.05rem] whitespace-nowrap tracking-tight">{t("交易決策系統")}</span>
               <span className="text-[10px] text-blue-500 font-mono mt-0 leading-none">{SYSTEM_VERSION}</span>
            </div>
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={LayoutDashboard} label={t("交易大廳")} />
          <NavButton active={activeTab === 'checklist'} onClick={() => setActiveTab('checklist')} icon={ListTodo} label={t("股票代碼清單")} />
          <NavButton active={activeTab === 'warroom'} onClick={() => setActiveTab('warroom')} icon={Swords} label={t("模擬交易大廳")} />
          <NavButton active={activeTab === 'records'} onClick={() => setActiveTab('records')} icon={Activity} label={t("績效")} />
        </nav>
        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="text-xs text-slate-500 mb-2 font-semibold tracking-wider">{t("資料管理 (Data)")}</div>
          <Button variant="ghost" className="w-full justify-start text-sm" icon={Settings} onClick={() => setIsSettingsModalOpen(true)}>{t("API 金鑰設定")}</Button>
          <Button variant="ghost" className="w-full justify-start text-sm" icon={Download} onClick={handleExport}>{t("匯出備份 (JSON)")}</Button>
          <Button variant="ghost" className="w-full justify-start text-sm" icon={Upload} onClick={() => setIsImportModalOpen(true)}>{t("匯入還原")}</Button>
          <Button variant="ghost" className="w-full justify-start text-sm" icon={QrCode} onClick={() => setIsQrModalOpen(true)}>{t("網頁 QR Code")}</Button>
          {isCloudAuthEnabled && (
            <Button variant="ghost" className="w-full justify-start text-sm" icon={Power} onClick={handleSignOut}>Sign out</Button>
          )}
          <div className="pt-2 mt-2 border-t border-slate-800">
             <button onClick={handleToggleLang} className="w-full flex items-center justify-between px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded-lg transition-colors">
                <div className="flex items-center gap-2"><Globe size={16}/> {t("語言")}</div>
                <span className="font-mono text-blue-400 text-xs font-bold">{lang === 'zh' ? 'ZH' : 'EN'}</span>
             </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-y-auto relative">
        <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center sticky top-0 z-20">
           <h1 className="text-lg font-bold text-blue-400 flex items-center gap-2 min-w-0">
            <Swords size={20} className="flex-shrink-0" /> 
            <span className="truncate whitespace-nowrap tracking-tight">{t("決策系統")} <span className="text-xs ml-1 opacity-70">{SYSTEM_VERSION}</span></span>
          </h1>
          <div className="flex gap-2 items-center flex-shrink-0">
            <button onClick={() => setIsQrModalOpen(true)} className="p-1 mr-1 text-slate-400 hover:text-white transition-colors">
               <QrCode size={18} />
            </button>
            <button onClick={handleToggleLang} className="p-1 mr-2 text-slate-400">
               <span className="font-mono text-xs">{lang.toUpperCase()}</span>
            </button>
            {isCloudAuthEnabled && (
              <button onClick={handleSignOut} className="p-1 text-slate-400 hover:text-white" aria-label="Sign out"><Power size={18} /></button>
            )}
            <button onClick={() => setActiveTab('dashboard')} className={`p-2 rounded ${activeTab==='dashboard'?'bg-blue-600':'bg-slate-800'}`}><LayoutDashboard size={18}/></button>
            <button onClick={() => setActiveTab('checklist')} className={`p-2 rounded ${activeTab==='checklist'?'bg-blue-600':'bg-slate-800'}`}><ListTodo size={18}/></button>
            <button onClick={() => setActiveTab('warroom')} className={`p-2 rounded ${activeTab==='warroom'?'bg-blue-600':'bg-slate-800'}`}><Swords size={18}/></button>
            <button onClick={() => setActiveTab('records')} className={`p-2 rounded ${activeTab==='records'?'bg-blue-600':'bg-slate-800'}`}><Activity size={18}/></button>
          </div>
        </div>

        <div className="p-6 lg:p-10 flex-1 w-full max-w-[1600px] mx-auto relative h-full">
          {activeTab === 'dashboard' && <Dashboard stocks={stocks} marketData={marketData} liveQuotes={liveQuotes} loadingQuotes={loadingQuotes} db={db} user={user} confirmAction={confirmAction} forceFetchStock={forceFetchStock} handleManualImportHTML={handleManualImportHTML} showToast={showToast} t={t} lang={lang} />}
          {activeTab === 'checklist' && <Checklist stocks={stocks} db={db} user={user} showToast={showToast} t={t} lang={lang} />}
          {activeTab === 'warroom' && <WarRoom simulations={simulations} stocks={stocks} marketData={marketData} db={db} user={user} confirmAction={confirmAction} showToast={showToast} t={t} lang={lang} />}
          {activeTab === 'records' && <RecordsTab stocks={stocks} records={records} db={db} user={user} showToast={showToast} confirmAction={confirmAction} t={t} lang={lang} />}
        </div>
      </main>

      {/* Global Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 z-[100] ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Settings Modal */}
      <Modal isOpen={isSettingsModalOpen} title={t("外部備援資料源設定")} onClose={() => setIsSettingsModalOpen(false)}>
        <div className="space-y-4">
          <p className="text-slate-300 text-sm">{t("當系統預設的資料源無法抓取特定小型股或新創股時，將會自動使用此備援 API 進行抓取。")}</p>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1 flex justify-between">
              <span>{t("Alpha Vantage 金鑰 (免費)")}</span>
              <a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">{t("取得免費金鑰")}</a>
            </label>
            <input 
              type="password" 
              value={tempApiKey} 
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="Enter free Alpha Vantage API Key..." 
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
            />
          </div>
          <div className="pt-2 flex justify-end gap-3">
             <Button variant="ghost" onClick={() => setIsSettingsModalOpen(false)}>{t("取消")}</Button>
             <Button variant="primary" onClick={handleSaveSettings}>{t("儲存")}</Button>
          </div>
        </div>
      </Modal>

      {/* Global Confirm Modal */}
      <Modal 
        isOpen={confirmModal.isOpen} 
        title={confirmModal.title} 
        onClose={() => setConfirmModal({ isOpen: false })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmModal({ isOpen: false })}>{t("取消")}</Button>
            <Button variant="danger" onClick={confirmModal.onConfirm}>{t("確認執行")}</Button>
          </>
        }
      >
        <p className="text-slate-300">{confirmModal.message}</p>
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={isImportModalOpen} title={t("匯入備份資料")} onClose={() => setIsImportModalOpen(false)}>
        <div className="space-y-4">
          <p className="text-slate-300 text-sm">{t("請選擇您之前匯出的 .json 備份檔案。系統將會進行智慧合併，不會刪除您現有的其他資料。")}</p>
          <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:bg-slate-800/50 transition-colors relative">
            <Upload size={40} className="mx-auto text-slate-400 mb-3" />
            <p className="font-medium text-slate-300">{t("點擊選擇檔案")}</p>
            <input type="file" accept=".json" onChange={handleImport} className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>
        </div>
      </Modal>

      {/* QR Code Modal */}
      <Modal 
        isOpen={isQrModalOpen} 
        title={<div className="flex items-center gap-2"><QrCode size={20} className="text-blue-400" /> {t("跨裝置分享")}</div>} 
        onClose={() => setIsQrModalOpen(false)}
      >
        <div className="flex flex-col space-y-5 py-2">
          {!isQrUrlValid && (
            <div className="bg-amber-950/30 border border-amber-700/50 rounded-xl p-4 flex gap-3 text-amber-200 text-sm">
              <AlertCircle className="flex-shrink-0 mt-0.5 text-amber-500" size={18} />
              <p>
                <strong className="font-bold text-amber-400">{t("預覽環境提示：")}</strong>
                {t("您目前處於測試沙盒中 (blob 網址)。請在下方貼上您產生的公開連結 (例如 Gemini 分享連結) 來產生可掃描的 QR Code。")}
              </p>
            </div>
          )}

          <div className="flex justify-center relative">
            <div className={`bg-white p-3 rounded-2xl transition-all duration-300 ${!isQrUrlValid ? 'opacity-30 blur-[2px]' : 'shadow-xl shadow-blue-500/10'}`}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(isQrUrlValid ? qrUrl : 'https://example.com')}`}
                alt="QR Code"
                className="w-48 h-48 pointer-events-none"
              />
            </div>
            {!isQrUrlValid && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-slate-900/90 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg font-medium shadow-2xl flex items-center gap-2">
                  <span className="text-lg">🚧</span> {t("等待輸入公開網址")}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5 w-full">
            <label className="text-sm font-medium text-slate-400">{t("分享網址")}</label>
            <input
              type="text"
              value={qrUrl}
              onChange={(e) => setQrUrl(e.target.value)}
              className={`w-full bg-slate-950 border rounded-lg p-3 text-slate-200 font-mono text-sm focus:outline-none focus:ring-1 transition-all ${!isQrUrlValid ? 'border-amber-700/50 focus:border-amber-500 focus:ring-amber-500' : 'border-slate-700 focus:border-blue-500 focus:ring-blue-500'}`}
            />
          </div>
        </div>

        <div className="flex justify-between gap-3 mt-6 pt-4 border-t border-slate-800">
           <Button variant="ghost" onClick={() => setIsQrModalOpen(false)} className="flex-1 justify-center">{t("關閉視窗")}</Button>
           <Button
              variant={isQrUrlValid ? 'primary' : 'outline'}
              onClick={handleCopyUrl}
              disabled={!isQrUrlValid}
              className={`flex-1 justify-center ${!isQrUrlValid ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed hover:bg-slate-800' : 'bg-blue-600 hover:bg-blue-500'}`}
           >
             {isQrUrlValid ? t("複製網址") : t("請先輸入網址")}
           </Button>
        </div>
      </Modal>
    </div>
  );
}