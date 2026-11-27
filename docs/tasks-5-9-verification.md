# 任務五至九驗收紀錄

日期：2026-11-27。專案：theothersideofparadise/gyoza-website。未執行任務十。

## 交付與里程碑

- 任務四 PR #1 已確認 merged，merge commit `0b03d15`；預約浮動連結完整保留。
- 任務五 `f22a349`：hero 圖片改為教材指定的 postimg 網址。
- 任務六：已直接將任務五推到 remote main，非等待手動合併。
- 任務七 `f507da7`：既有 2D 行人增加進店路徑，remote tag `milestone/task-7-2d` 保留可查核版本。
- 任務八 `8e7f740`：本地 Three.js WebGL 立體場景、店面、人物與進店路徑，WebGL 缺失時保留 2D。
- 任務九：更新 manifest、離線 app shell、圖示；本地化 CSS、Lucide 與 Three.js，讓離線重啟有完整介面。

## 真實圖像產生證據

使用 image_gen 影像工具，要求「單顆真實世界鍋貼的寫實食物攝影、金黃煎底、深棕背景、琥珀色發光、無文字」。產生的原始影像為真正的 1254×1254 PNG，保存為 `icons/gyoza-generated-source.png`，非 SVG 改副檔名。以 Pillow 縮放、加安全區輸出 192、512、maskable 512、Apple 180、favicon 32 PNG。保留工具原始輸出於工作區 generated_images。

## 已執行測試

本機 Chromium + Playwright，桌面 1440×900 與手機視窗 390×900：

- WebGL canvas 成功建立，前後畫面像素不同，動畫實際運作；人工查看桌面與手機截圖。
- 頁面無橫向溢出；購物車開關、加入商品及 badge 更新正常。
- 預約按鈕保留新分頁開啟行為。
- Service Worker 啟用後切離線並重新載入，商品介面、本地樣式與 3D 場景仍可使用。
- prefers-reduced-motion 下前後畫面相同，保持靜態。
- 阻擋 Three.js 時，2D 行人與進店備援正常顯示。
- 上述流程沒有 JavaScript pageerror。
- 同一套測試另在 `/gyoza-website/` 子目錄執行，驗證 GitHub Pages 路徑與 Service Worker scope。
- Chromium 非無痕持久化設定檔的 `Page.getInstallabilityErrors` 回傳 `[]`；這是安裝資格檢查，並非已在實體手機安裝。
- Pillow 與 file 驗證 manifest 圖示均為實際 PNG，尺寸符合宣告。
- `git diff --check` 與 JavaScript 語法檢查通過。

重跑：先啟動 `python -m http.server 3000`，再以 `CHROMIUM_PATH=/usr/bin/chromium npm run test:smoke` 及 `npm run test:pwa` 執行。其他系統可安裝 Playwright Chromium，省略 CHROMIUM_PATH。測試不送出真實訂單。

## 尚不能宣稱驗證的項目

- 環境網路政策拒絕 i.postimg.cc、正式 Pages 網域及原有外部照片／字型主機；申請補充授權回覆「The published configuration does not allow this network access」。因此已更新指定圖片網址，但無法在本環境確認來源圖片實際載入；不可把這個限制說成海報網址失效。
- 預期 GitHub Pages 網址為 https://theothersideofparadise.github.io/gyoza-website/ 。本環境無法直接取得其 HTTP 回應，故未宣稱正式部署已驗證。
- 真正 iPhone / Android 的「加入主畫面」、桌面圖示與 standalone 開啟仍需使用者用實體手機驗收。離線無法送出訂單；外部照片沒有列入離線保證。
