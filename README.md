# FreshCare 鮮果選品｜顧客問題反映

FreshCare 是一個繁體中文生鮮電商客服前台，提供商品問題反映、資料確認、提交成功及案件查詢流程。商品圖片使用專案內素材；提交可在本機使用 n8n API 或 Mock，GitHub Pages 正式建置固定使用 Mock。

## 技術架構

- Vue 3 Composition API、`<script setup>` 與 TypeScript
- Vite、Tailwind CSS 4（官方 Vite plugin）、Vue Router Hash History
- 商品查詢由獨立的 `src/services/productService.ts` 提供，支援 n8n API 與本地 Mock
- 工單 Service 層：`src/services/ticketService.ts`，支援本機 n8n 提交與記憶體 Mock
- GitHub Actions 使用官方 Pages Actions 建置並部署 `dist/`

## 本機執行

需求：Node.js 22.12 以上與 npm。

```bash
npm ci
npm run dev
```

開發伺服器預設使用 `/` base path。常用檢查指令：

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

## 頁面功能

- `/#/contact`：填寫客服表單、搜尋商品、驗證欄位與預覽／移除照片。
- `/#/confirm`：檢視全部提交資料，並可返回修改；沒有工作階段草稿時會安全導回表單。
- `/#/success`：顯示工單編號、提交時間與 API 回傳／Mock 狀態。
- `/#/track`：使用工單編號及建立案件時的 Email 查詢案件狀態與事件 Timeline。

草稿與 Mock 工單只保留在目前頁面工作階段的 JavaScript 記憶體，重新整理或關閉頁面後即清除；不會將真實顧客個資寫入 `localStorage`，Mock 也不會寄送郵件或將資料上傳至外部服務。照片限 JPG、PNG、WebP，最多 5 張、每張 5MB。

## GitHub Pages 部署

預計公開網址：<https://daisy116.github.io/freshcare-web/>


### Base path 與路由

`vite.config.ts` 在本機開發使用 `/`，正式建置使用 `/freshcare-web/`；Vue Router 採 Hash History，因此 GitHub Pages 的頁面連結格式為 `https://daisy116.github.io/freshcare-web/#/contact`，可直接開啟或重新整理。頁面圖片透過 `import.meta.env.BASE_URL` 產生路徑。

若 Repository 更名，請將 `vite.config.ts` 的正式 base path 改成 `/<新 Repository 名稱>/`，並同步更新 README 公開網址。若發布至使用者／組織根目錄，正式 base path 應改為 `/`。

## 商品資料 API

本機開發預設以 `.env.development` 啟用 `VITE_PRODUCTS_SOURCE=api`。前端只呼叫同源 `GET /api/products`；Vite 開發伺服器將請求代理至 `http://localhost:5678/webhook/freshcare/products`。請先啟動本機 n8n 並啟用該 Production Webhook。

若要在本機改用示範資料，可在 `.env.local` 設定 `VITE_PRODUCTS_SOURCE=mock` 並重新啟動 Vite；移除此覆寫即可恢復 API 模式。

回應需符合 `{ success: true, count, products }` 格式，且筆數、欄位與唯一 `product_id` 均須有效。若 n8n 無法連線或回應格式錯誤，表單會顯示錯誤及重試按鈕，不會悄悄切換成 Mock。Mock 模式則清楚標示「目前顯示示範商品資料」。Webhook 未提供的圖片使用本地占位圖，未提供的商品規格不會自行假造。

GitHub Pages 正式建置一律鎖定 Mock 商品資料，不會嘗試連線訪客的 `localhost`。未來部署公開 HTTPS API 時，需透過獨立 Service 設定 API 模式及同源代理／後端；勿將私人憑證放入前端。

## 工單提交 API 與 Mock

本機 `.env.development` 預設設定 `VITE_TICKET_API_MODE=api`。前端呼叫同源 `POST /api/tickets`，Vite 開發伺服器代理至 `http://localhost:5678/webhook/freshcare/tickets`；請先啟動本機 n8n 並啟用該 Webhook。切換為 Mock 可在 `.env.local` 設定：

```dotenv
VITE_TICKET_API_MODE=mock
```

API 提交會以 JSON 傳送表單欄位、`product_id` 與唯一 `request_id`，不傳送照片；如表單附有照片，需先返回表單移除後才能提交。成功回應需包含 `ticket_id`、`created_at` 與 `ticket_status`。

案件查詢 API 模式會以 `POST /api/track` 傳送 `ticket_id` 與 `email`，Vite 代理至 `http://localhost:5678/webhook/freshcare/track`。支援直接回傳工單物件，或 `{ success: true, ticket: { ... } }`（也支援 n8n 常見的單筆陣列包裝）。工單需包含 `ticket_id`、`ticket_status`、`created_at`；可選擇回傳 `product_id`、`product_name`、`issue_type`、`review_status`、`order_number`、`closed_at` 及 `events`／`timeline`。無事件資料時只顯示目前工單狀態，不補造已完成事件。HTTP 404 顯示查無工單，403 顯示驗證失敗，其餘連線或回應錯誤可由頁面重試。Mock 查詢仍使用記憶體中的本機提交工單。

GitHub Pages 建置時不論環境變數設定為何，一律使用 Mock 提交，不會連線訪客的 `localhost`。靜態網站不得存放 API Key 或 Webhook 密鑰；需要私人憑證時應改由可信任的後端代理處理。

## 內部後台登入

`/#/admin/login` 使用 `src/services/adminAuthService.ts` 驗證登入，成功後進入 `/#/admin/dashboard`。後台提供 Stitch 儀表板版型、工單佇列搜尋／篩選、依工單資料動態計算的 KPI、工單詳情與事件歷程；未分析案件顯示「等待 AI 分析」。人工覆核、改部門、要求補件及結案功能為停用展示按鈕，不會改動資料。

本機 `.env.development` 設定 `VITE_ADMIN_AUTH_MODE=api`；頁面以 `POST /api/admin/login` 傳送 HTTP Basic `Authorization` 標頭，由 Vite 代理到 `http://localhost:5678/webhook/freshcare/admin/login`。請先啟動本機 n8n 並啟用該 Webhook；帳密只在登入頁記憶體及 Service 模組記憶體中短暫存在，頁面重新整理即登出，登入成功後清空表單。

共用 `adminApiFetch('/api/admin/...')` 會附上登入時使用的相同 Basic Authorization，未登入時拒絕發出管理 API 請求。正式建置（包括 GitHub Pages）一律強制 Mock，不連線登入 API；Mock 模式任意非空帳密即可進入展示頁，沒有身分驗證或資料存取保護。不得將正式帳密或 API Secret 寫入前端程式碼或環境變數。正式部署仍須搭配可信任後端與適當工作階段／權限保護；純前端記憶體驗證不能保護後端資源。

後台工單列表本機預設由 `.env.development` 的 `VITE_ADMIN_TICKETS_MODE=api` 啟用，使用 `GET /api/admin/tickets` 並由 Vite 代理至 `http://localhost:5678/webhook/freshcare/admin/tickets`；請先以 API 模式登入，列表請求會沿用同一 Basic Authorization。回應格式為 `{ success: true, count, tickets }`。設定 `VITE_ADMIN_TICKETS_MODE=mock` 可切回列表 Mock；正式建置強制使用 Mock。此階段僅接入列表與 KPI，API 模式下右側詳情會明確顯示尚未串接，不會混入 Mock 顧客資料。

## 安全與資料管理

`.gitignore` 已排除依賴、建置產物、環境檔與本機設定。不要將 API Key、OAuth Token、Webhook 密鑰、顧客個資或真實工單加入公開 Repository。

原始 `design-reference/` 僅供本機設計還原參考，因素材授權未確認，已排除於 Git 版本控制之外；網站建置不依賴該目錄。
