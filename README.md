# FreshCare 鮮果選品｜顧客問題反映

FreshCare 是一個繁體中文生鮮電商客服前台展示網站，提供商品問題反映、資料確認、模擬提交成功及案件查詢流程。商品圖片使用專案內的示意占位圖；目前沒有真正送信、外部 API 或後端資料庫。

## 技術架構

- Vue 3 Composition API、`<script setup>` 與 TypeScript
- Vite、Tailwind CSS 4（官方 Vite plugin）、Vue Router Hash History
- Service 層：`src/services/ticketService.ts`，預設使用記憶體 Mock
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
- `/#/success`：顯示模擬工單編號、提交時間與「已受理」狀態。
- `/#/track`：使用工單編號及建立案件時的 Email 查詢模擬進度。

草稿與 Mock 工單只保留在目前頁面工作階段的 JavaScript 記憶體，重新整理或關閉頁面後即清除；不會將真實顧客個資寫入 `localStorage`，Mock 也不會寄送郵件或將資料上傳至外部服務。照片限 JPG、PNG、WebP，最多 5 張、每張 5MB。

## GitHub Pages 部署

預計公開網址：<https://daisy116.github.io/freshcare-web/>


### Base path 與路由

`vite.config.ts` 在本機開發使用 `/`，正式建置使用 `/freshcare-web/`；Vue Router 採 Hash History，因此 GitHub Pages 的頁面連結格式為 `https://daisy116.github.io/freshcare-web/#/contact`，可直接開啟或重新整理。頁面圖片透過 `import.meta.env.BASE_URL` 產生路徑。

若 Repository 更名，請將 `vite.config.ts` 的正式 base path 改成 `/<新 Repository 名稱>/`，並同步更新 README 公開網址。若發布至使用者／組織根目錄，正式 base path 應改為 `/`。

## Mock 與未來 API

預設 `VITE_TICKET_API_MODE=mock`（未設定時亦使用 Mock）。切換 API 需在本機 `.env.local` 設定非機密的公開值：

```dotenv
VITE_TICKET_API_MODE=real
VITE_TICKET_API_URL=https://your-api.example.com
```

真實 API 模式由 Service 層呼叫 `POST /tickets` 與 `POST /tickets/:id/status`，圖片以 multipart form 傳送。正式使用時需提供相容且具安全驗證的後端服務；GitHub Pages 是純靜態託管，不能隱藏 API Key 或代理私人憑證。任何私密密鑰都不可放在 `VITE_*` 環境變數或前端程式中；應由可信任的後端代理處理。

## 安全與資料管理

`.gitignore` 已排除依賴、建置產物、環境檔與本機設定。不要將 API Key、OAuth Token、Webhook 密鑰、顧客個資或真實工單加入公開 Repository。

原始 `design-reference/` 僅供本機設計還原參考，因素材授權未確認，已排除於 Git 版本控制之外；網站建置不依賴該目錄。
