# FreshCare｜AI 輔助客服工單管理系統

**Vue 3 × n8n × OpenAI × 人工審核 × 營運分析**

FreshCare 是以生鮮電商為情境開發的 AI 客服工單管理 Demo，模擬顧客提交商品問題、系統建立工單、AI 輔助分析、管理人員審核與最終處置的完整流程。

本專案結合 **AI Workflow、自動化流程、資料管理及前後台系統開發**，重點不在讓 AI 完全取代客服，而是讓 AI 協助分類與提供建議，再由管理人員做出最終決策。

> 本專案為個人作品集 Demo，所有訂單與顧客資料皆為模擬資料，不提供實際購物、客服通知、退款或配送服務。

## 線上展示

**GitHub Pages：** https://daisy116.github.io/freshcare-web/

**GitHub Repository：** https://github.com/Daisy116/freshcare-web

主要展示頁面：

- [商品問題反映](https://daisy116.github.io/freshcare-web/#/contact)
- [案件進度查詢](https://daisy116.github.io/freshcare-web/#/track)
- [管理後台登入](https://daisy116.github.io/freshcare-web/#/admin/login)

**展示模式說明：** GitHub Pages 為靜態網站，使用 Mock 模式展示，不直接連線本機 n8n 或 Session API。完整 API、自動化及管理員操作需在本機整合環境執行。

## 專案目標

傳統客服工單需要人工閱讀顧客描述、判斷問題類別、決定負責部門並追蹤處理狀態。當案件數量增加，容易出現分類不一致、資訊分散及人工處理負擔等問題。

FreshCare 以以下目標進行設計：

1. **整合客服資訊**：將顧客問題、商品、訂單與處理紀錄集中管理。
2. **導入 AI 輔助**：分析客訴內容，提供問題分類、建議部門與優先級。
3. **保留人工決策**：由管理人員檢視 AI 建議，或直接採用純人工審核流程。
4. **建立可追蹤紀錄**：記錄工單狀態變更、人工處置及後台事件歷程。
5. **提供營運分析**：以統計報表觀察工單分布及 AI 建議與人工決策的一致情況。

## 核心功能

### 1. 顧客前台｜問題反映與案件查詢

顧客可以透過前台表單提交商品問題。

主要功能包含：

- 顧客姓名、Email、聯絡電話及訂單編號。
- 商品搜尋與選擇。
- 購買數量、購買管道及收貨日期。
- 問題類型、詳細描述與希望處理方式。
- 表單驗證、資料確認與工單提交。
- 提交後取得唯一工單編號。
- 透過工單編號與 Email 驗證，查詢目前工單狀態及基本案件資訊。

前台提供六筆 Demo 測試訂單，涵蓋數量短少、商品破損、配送問題、品質異常、修改訂單及取消訂單等情境。

選擇 Demo 訂單後，可自動帶入商品、購買數量、購買管道及適用的收貨日期，減少測試時重複填寫資料。

### 2. 管理後台｜工單審核與處置

管理員可登入後台檢視與處理工單。

主要功能包含：

- 工單總數、待處理件數與處置完成率 KPI。
- 依工單編號、狀態、問題類型、優先級及日期篩選。
- 檢視顧客描述、購買資訊及後台事件歷程。
- 手動開始審核及選擇是否執行 AI 分析。
- 檢視 AI 建議並由管理人員決定最終處置。
- 匯出符合篩選條件的客服工單 CSV。
- 提供工單流程說明與營運統計報表。

管理員可以採用以下三種最終處置方式：

| 處置方式 | 說明 |
|---|---|
| 確認分派 | 指定負責部門，工單狀態更新為 `assigned` |
| 要求補件 | 記錄需要顧客補充的資料，狀態更新為 `waiting_customer` |
| 直接結案 | 記錄結案說明及時間，狀態更新為 `closed` |

三者代表 Demo 中的**處置決策結果**，不代表所有客訴已經實際解決。

### 3. AI 輔助分析

系統透過 n8n Workflow 串接 OpenAI，協助分析待審核工單。

AI 產生的資訊包含：

- **問題分類**：例如配送延遲、商品品質異常、數量短少、運送損傷等。
- **建議部門**：依問題內容提供處理部門建議。
- **優先級**：高、中、低。
- **分析原因**：說明分類與建議的依據。

AI 分析為選用功能，並非所有工單都必須執行。

管理員可以檢視 AI 建議、調整最終分派部門，或不使用 AI 直接進行人工處置。

這種設計強調 **Human-in-the-Loop（人工參與決策）**，避免將 AI 輸出直接視為最終處置結果。

### 4. 營運統計與資料匯出

管理後台提供統計報表，包含：

- 工單總數、待處理工單與處置完成率。
- AI 分析使用率。
- AI 建議部門與人工最終分派部門一致率。
- 五種工單狀態的數量分布。
- 三種最終處置方式的件數與比例。

系統區分兩種資料匯出用途：

| 匯出功能 | 用途 | 主要資料 |
|---|---|---|
| 工單管理 CSV | 個案查詢與客服明細保存 | 購買資訊、顧客描述、AI 建議、人工處置等 20 欄資料 |
| 統計報表 Excel | 營運分析與 AI 輔助成效檢視 | 營運 KPI、工單狀態分布、AI 使用及部門一致性 |

#### Excel 營運管理報表

已實作的 Excel 管理報表包含三張工作表：

**① 營運總覽**

- 報表產生時間與統計工單總數。
- 工單總數、待處理工單、已完成處置決策及處置完成率四項 KPI。
- 各處理階段的件數與比例摘要。
- 處置完成率與案件實際解決情況的解讀提醒。

**② 工單狀態分析**

- 五種工單狀態的件數、比例及合計。
- 可於 Excel 中編輯的原生長條圖。
- 已分派、待補充資料及已結案的最終處置分布。
- 區分全部工單與已完成處置決策工單的統計分母。

**③ AI 輔助成效**

- AI 分析使用率與已分析／未分析工單分布。
- AI 建議部門與人工最終分派部門一致率。
- 符合比較條件的工單對照明細。
- AI 指標解讀說明，避免將一致率直接解釋為 AI 採納率或處理正確率。

Excel 採用奶油綠與深綠配色，具備表格格式、凍結窗格、原生圖表及 Excel 公式。比例由公式計算，分母為零時顯示「—」。

匯出時會重新讀取完整工單資料，不受後台列表分頁或 CSV 匯出筆數限制。

**指標定義：**

- AI 分析使用率＝具有 AI 分析類別的工單數 ÷ 全部工單數。
- AI 建議部門一致率＝已分派且 AI 與人工部門均有資料的工單中，部門相同的比例。
- 處置完成率＝已分派、待補充資料與已結案工單合計 ÷ 全部工單數。

部門一致率僅代表兩個欄位的結果相符，**不等於 AI 建議採納率，也不能單獨證明 AI 的實際成效**。

## 系統流程

```text
顧客填寫問題反映表單
          ↓
     建立客服工單
          ↓
    工單進入審核階段
          ↓
    管理員選擇處理方式
          ↓
     ┌──────────┐
     │          │
  AI 輔助分析   純人工審核
     │          │
     └────┬─────┘
          ↓
     人工確認與決策
          ↓
   ┌──────┼──────┐
   ↓      ↓      ↓
 確認分派 要求補件 直接結案
   ↓      ↓      ↓
 assigned waiting_customer closed
          ↓
   保存工單與後台事件紀錄
          ↓
   前台狀態查詢／後台營運統計
```

此流程中的 AI 分析並非強制步驟，最終決策由管理員完成。

前台案件查詢以**目前工單狀態及基本案件資訊**為主；完整事件歷程供管理後台檢視，不提供顧客公開版事件時間線。

## 技術架構

| 層級 | 技術 | 主要用途 |
|---|---|---|
| 前端 | Vue 3、TypeScript、Vite | 前台表單與管理後台 |
| 樣式 | Tailwind CSS 4、CSS | UI 與 RWD |
| 路由 | Vue Router（Hash History） | 前後台頁面路由 |
| 自動化後端 | n8n | API、資料查詢、工單處置與 AI Workflow |
| AI | OpenAI API | 客訴分類、部門建議、優先級分析 |
| 資料儲存 | n8n Data Tables | 商品、訂單、工單、聯絡資料與事件紀錄 |
| 管理員驗證 | Node.js Session API | 登入、Session、管理 API 代理 |
| Session 儲存 | SQLite | 管理員 Session 持久化 |
| 部署 | GitHub Pages、GitHub Actions | 靜態展示網站 |
| 開發工具 | VS Code、Codex、Stitch | AI 輔助開發與 UI 設計 |

### n8n Data Tables

專案以五張主要 Data Tables 管理資料：

| Data Table | 內容 |
|---|---|
| `products` | 商品名稱、分類及啟用狀態 |
| `orders` | Demo 訂單、購買資訊及測試情境 |
| `tickets` | 工單主資料、AI 分析結果與處置狀態 |
| `ticket_contacts` | 顧客聯絡資訊與原始描述 |
| `ticket_events` | 工單建立、分析、審核及處置事件 |

透過 `ticket_id`、`product_id`、`order_id` 等欄位建立資料關聯，將工單資料與事件歷程分開管理。

### 主要 n8n Workflows

專案採用編號式 Workflow，方便管理與追蹤功能。

| 編號 | Workflow | 功能 |
|---|---|---|
| 17-1 | Get Products | 查詢商品清單 |
| 17-2 | Create Ticket | 建立客服工單 |
| 17-3 | Track Ticket | 以工單編號與 Email 驗證，查詢目前工單狀態 |
| 17-4 | Admin Login | 管理員登入驗證 |
| 17-5 | Admin List Tickets | 查詢後台工單列表 |
| 17-6 | Admin Get Ticket Detail | 查詢工單詳情及後台處理資訊 |
| 17-7 | Admin Start Review | 開始人工審核 |
| 17-8 | Analyze Pending Tickets | AI 工單分析 |
| 17-9 | Assign Ticket | 確認分派 |
| 17-10 | Request Supplement | 要求補充資料 |
| 17-11 | Close Ticket | 工單結案 |
| 17-12 | Export Tickets | 產生客服工單 CSV |
| 17-13 | Get Demo Orders | 查詢 Demo 測試訂單 |

以上 Workflow 以資料查詢、AI 分析與人工決策為核心，並透過 API 提供前後台操作。

統計報表 Excel 由前端既有匯出功能產生，不需要另外新增 n8n Workflow。

## 本機開發與執行

### 環境需求

- Node.js 22.12 以上
- npm
- 本機 n8n 服務
- 可供測試的 n8n Workflows 與 Data Tables
- AI 分析所需的 OpenAI 憑證（於 n8n 端設定）

### 安裝依賴

```bash
npm ci
```

### 設定環境變數

將 `.env.example` 複製成 `.env.local`，依需要設定本機環境。

管理員 Session 的主要變數：

```dotenv
ADMIN_SESSION_SECRET=<請填入自行產生的隨機密鑰>
ADMIN_SESSION_DB_PATH=./data/admin-sessions.sqlite
ADMIN_SESSION_TTL_HOURS=8
ADMIN_SESSION_COOKIE_SECURE=false
ADMIN_APP_ORIGIN=http://localhost:5173
ADMIN_SESSION_HOST=127.0.0.1
ADMIN_SESSION_TRUST_PROXY=false

SESSION_API_PORT=3001
N8N_BASE_URL=http://localhost:5678
```

可透過以下指令產生 Session 密鑰：

```bash
openssl rand -hex 32
```

請勿將真實密鑰提交至 GitHub。

其他前台商品、工單與管理 API 模式，請參考專案內 `.env.example` 及 `.env.development` 的設定。

### 啟動完整本機環境

先確認 n8n 已啟動，且需要使用的 Production Webhooks 已啟用。

```bash
npm run dev:all
```

預設服務：

| 服務 | 網址 |
|---|---|
| Vue／Vite | `http://localhost:5173` |
| Admin Session API | `http://localhost:3001` |
| n8n | `http://localhost:5678` |

只需要前端 Mock 展示時：

```bash
npm run dev
```

### 測試與建置

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

請注意：通過建置不代表所有 n8n API 或端到端流程均已完成驗證，仍需使用實際整合環境測試。

## API 與登入安全

### 前台 API

本機 API 模式主要使用：

- `GET /api/products`：商品查詢。
- `POST /api/tickets`：建立工單。
- `POST /api/track`：以工單編號及 Email 驗證，查詢目前狀態及基本案件資訊。
- `GET /webhook/freshcare/demo-orders`：Demo 訂單查詢，由前端既有 API 設定或代理方式存取。

實際 Webhook 路徑與 Vite Proxy 設定以專案程式碼為準。

### 管理後台

管理後台使用 Session API 進行登入及 API 存取控制。

基本流程：

```text
管理員登入
    ↓
Session API 驗證
    ↓
建立 HttpOnly Session Cookie
    ↓
後台 API 驗證 Session
    ↓
由伺服器代理呼叫 n8n Webhook
```

管理 API 由伺服器端處理憑證，不將管理員 Basic Auth 帳密直接放入瀏覽器端程式碼。

Session API 採用 SQLite 保存 Session，並包含來源驗證、CSRF 防護及登入限流等保護機制。

**部署限制：** 本機 HTTP 設定僅供開發測試；若部署公開管理系統，應使用 HTTPS、妥善設定 Cookie、密鑰、資料庫權限與備份。

## GitHub Pages 展示模式

本專案使用 GitHub Actions 建置並部署 Vite 靜態網站。

正式建置 Base Path：

```text
/freshcare-web/
```

路由採 Hash History，例如：

```text
https://daisy116.github.io/freshcare-web/#/contact
```

目前 GitHub Pages 為 Mock 展示模式：

- 不直接連線訪客本機的 n8n。
- 不具備正式的管理員身分驗證及後端 Session 服務。
- Mock 工單與草稿不保證跨重新整理或重新開啟後保留。
- 不傳送真實客服通知或 Email。
- 不應輸入真實顧客個資。

若未來需要提供公開、可持久保存資料的完整 Demo，須另行部署可信任的後端服務及 n8n API，並處理 HTTPS、身分驗證、存取權限與資料保存。

## 專案限制與後續擴充

本專案以展示 AI 輔助客服工單管理流程為目標，尚未涵蓋正式電商售後系統所需的全部功能。

目前限制包含：

- 沒有串接真實電商訂單與金流。
- Demo 訂單使用模擬資料。
- AI 提供輔助建議，不自行執行退款、換貨或配送。
- 未整合實際客服通知與顧客補件回傳機制。
- 未實作正式的圖片上傳與檔案儲存。
- GitHub Pages 不執行本機的 n8n 與 Session 後端。
- 前台僅提供工單狀態及基本資訊查詢；完整事件歷程由管理後台查看。

後續可擴充方向：

- 訂單資料與客訴內容的自動比對。
- 顧客補件與客服通知。
- 圖片上傳及檔案權限管理。
- AI 分析結果品質評估與人工修正統計。
- 正式部署的 API、權限控管及監控機制。

## 開發過程與學習重點

本專案的開發採用 **需求規劃 → UI 設計 → 前端實作 → n8n Workflow → 整合測試 → 例外處理 → 成效呈現** 的方式逐步完成。

主要實作與學習重點包含：

**AI Workflow 設計**

利用 n8n 串接 OpenAI，將非結構化客訴內容轉換為分類、部門建議、優先級及分析原因。

**Human-in-the-Loop**

將 AI 建議與人工最終決策分開保存，允許管理員略過 AI、調整部門或進行其他處置。

**資料設計與整合**

利用多張 Data Tables 管理工單、聯絡資訊、訂單及事件，降低重複資料並保留處理歷程。

**API 與例外處理**

處理請求驗證、重複工單、工單狀態限制、錯誤回應，以及前後端 API 串接。

**管理員登入安全**

透過 Node.js Session API 代理管理請求，避免在前端保存管理員 Basic Auth 憑證。

**數據分析與可視化**

從工單資料計算狀態分布、處置完成率及 AI 與人工部門一致率，並區分個案明細 CSV 與營運管理 Excel 報表。

Excel 報表以公式、原生圖表及 AI／人工部門對照資料呈現營運分析結果。

**AI 輔助開發**

使用 Codex 協助前端開發與除錯，Stitch 協助 UI 設計，並透過人工驗證與逐步測試調整實作結果。

---

## 專案定位

FreshCare 不以訓練或開發底層 AI 模型為目標，而是著重於**如何將既有 AI 能力整合到真實業務流程中**。

從客服需求、工單資料結構、AI 輔助分析到人工決策與管理報表，展示 AI Workflow、前後端整合及專案管理能力。

**關鍵字：** AI Workflow、n8n、OpenAI API、Human-in-the-Loop、Vue 3、Type