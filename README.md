# 煎福鍋貼專賣 · 品牌官網 PWA

靜態單頁網站，包含線上點餐、購物車、結帳、冷凍禮盒、門市、訂單查詢、3D 行人店面及 PWA。

## 網站與目前接單服務

[GitHub Pages](https://theothersideofparadise.github.io/gyoza-website/)。本環境網路政策禁止存取此網域，未直接驗證正式 HTTP 部署。

`assets/order-config.js` 已設定 `provider: 'gas'` 及本人發布的正式 `/exec` URL。授權的協作端回報已成功執行 `setup` 並發布 version 1；**不是執行 `setupAndVerify`**。

雲端環境仍禁止存取 script.google.com 及正式 Pages 網域，追加網路授權未完成。因此目前只確認原始碼設定與 main 推送，**尚未由此環境確認正式網頁取得新版或實測 GAS 真實寫單／防重送／查單**。Supabase 轉接保留供回復，但目前設定不會同時送到兩個後端。

[部署與驗收流程](gas/README.md)｜[試算表](https://docs.google.com/spreadsheets/d/1y2nbETPg9Xk-Xf9b_2cX7HbM59yeIGMk4lnrdCKQpR0/edit)。後續正式驗收只使用 `docs/tasks-10-live-request.json` 中的固定 requestId，避免跨協作端重複建測試單。

## 檔案

| 檔案 | 用途 |
|---|---|
| index.html | 前台與商品、購物車、結帳介面 |
| assets/order-config.js | 公開後端選擇與 GAS 部署網址 |
| assets/order-client.js | Supabase/GAS 轉接、可讀回應驗證、GAS 重試識別 |
| gas/Code.gs / appsscript.json | Google Apps Script 後端及設定 |
| admin.html | 舊 GAS 後台；ADMIN_KEY 僅放指令碼屬性及登入欄 |
| supabase/ | 原後端 schema、seed、Edge Functions，切換前保留使用 |
| assets/street-3d.js | Three.js 3D 場景及播放控制，2D 備援在 index.html |
| manifest.webmanifest / sw.js | PWA 與離線 app shell；不快取訂單 API 或後台 |
| icons/ | image_gen 生成的真實 PNG 與縮放圖示 |

Supabase 金額及編號由後端計算。前台 anon key 是公開金鑰，**service_role、Google token、ADMIN_KEY 等私人憑證不可放前台或提交 repo**。admin.html 僅連 GAS，尚未切換時看不到 Supabase 新訂單；歷史資料不會自動遷移。

## 本機開發與檢查

```bash
npm ci
npm run build:css
python -m http.server 3000
# 另一終端機，安裝 Playwright Chromium 後執行
npx playwright install chromium
npm test
npm run test:smoke
npm run test:motion
npm run test:pwa
npm run test:checkout
```

使用系統 Chromium 可在瀏覽器測試命令前加 `CHROMIUM_PATH=/usr/bin/chromium`。以 `TEST_URL=http://localhost:3001/gyoza-website/` 等值測試子目錄。`test:checkout` 是模擬 GAS 的契約測試，不會建立真實 Google 訂單。

## 任務五至九

- 海報使用教材指定 postimg 網址；外部照片需要連線。本環境不能確認其實際載入。
- 任務七 2D 進店里程碑：`milestone/task-7-2d`。
- 任務八 3D 模式支援播放／暫停；預設尊重減少動態偏好，離開可視區或切換分頁暫停。
- 任務九圖示於 2026-11-27 由 image_gen 產生寫實發光鍋貼 PNG，原圖 `icons/gyoza-generated-source.png`。非 SVG 改副檔名。
- CSS、Lucide、Three.js 及圖示本地提供，離線可重啟介面；送單仍需連線。
- [完整驗收紀錄](docs/tasks-5-9-verification.md)。實體手機加入主畫面尚需本人驗收：iPhone Safari「分享 → 加入主畫面」；Android Chrome「安裝應用程式／加入主畫面」。

## 發布與資料

GitHub Settings → Pages → Deploy from branch → main / root。修改本地樣式後重建 `assets/site.css`；更新 PWA 資源時同步更新 sw.js 快取版本，後端路由設定亦更新 script URL 版本。

店名、地址及門市資料是示範資料。部分餐點照片來自 Unsplash；正式使用可更換自家照片。既有 Supabase 設定與 GAS 的商品 ID 需和前台一致，價格以後端為準。
