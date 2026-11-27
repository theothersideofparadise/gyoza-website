# 任務十驗收紀錄（2026-11-27）

## 交付狀態

程式及 Google Sheet 已備妥，正式 GAS 部署與實際網站送單仍待本人 Google 授權；不宣稱任務十已完成上線。

- 已建立私人試算表：`1y2nbETPg9Xk-Xf9b_2cX7HbM59yeIGMk4lnrdCKQpR0`，放在 My Drive / ChatGPT。
- 連接器讀回確認時區 Asia/Taipei、訂單 A:Q 標題、訂單明細 A:F 標題、商品 A1:E20 的 19 項種子商品。訂單及明細目前只有標題，沒有把模擬訂單灌入真實 Sheet。
- 凍結標題列、手機文字格式、狀態驗證、上架核取方塊及商品名稱欄寬已設定。驗證依據為 API 值與結構，未進行 Google 原生畫面的視覺檢查。
- GAS `setup` 可重跑並保留資料與價格；`setupAndVerify` 留給本人執行真實 Sheet 寫入、防重送與讀回驗收。
- 前台支援設定切換；在尚無真實 `/exec` URL 時保留 Supabase，沒有假造部署網址。
- ADMIN_KEY 只從指令碼屬性讀取，無新增私人憑證。

## 本機驗證

`npm test`：12/12 通過。涵蓋小數數量／重複商品／不合法門市拒絕、商品表價格重算、相同 requestId 只建一單、不同內容拒絕、明細寫入中斷後修復、公式注入處理、流水號超過 999、初始化保留價格、GAS/Supabase 請求與回應轉接、失敗後與重新載入後沿用請求 ID、未知回應不當成功。

`test:checkout`：Playwright **模擬** GAS，驗證結帳失敗後保留購物車與表單、手動重試使用相同識別碼、只有確認成功才清空購物車，並能查回訂單摘要。

任務九回歸：桌面 1440px／手機 390px smoke、3D 播放控制、離線重啟、2D 備援、PWA 安裝資格檢查均通過。實體手機安裝仍未操作。

獨立程式審查發現「送單途中重新載入，尚未標記不確定」的防重送缺口；補上先持久化不確定狀態再發送的修正，新增測試先失敗後通過，複查無剩餘重要問題。

## 唯一需要本人處理的環節

依 [GAS 部署步驟](../gas/README.md)，在試算表綁定 Apps Script，貼入程式、執行 `setupAndVerify` 並完成 Google 授權，再發布「以我執行／所有人可存取」的網頁應用程式。回傳 `/exec` URL 與自測結果後，才能設定前台、實測跨網域真實送單／讀回及確認切換。

目前沒有 GAS script ID、部署 ID 或可驗證 URL。正式 Pages 網域亦受環境網路政策限制，未宣稱實際部署回應已驗證。


## 正式部署接線更新（2026-11-27）

協作端已使用本人 Brave 帳號完成 Google 授權，發布 GAS version 1，明確允許所有人呼叫 API。執行成功的是 `setup`，不是 `setupAndVerify`。已取得正式 /exec URL 及綁定專案，前台 `provider` 改為 gas、設定檔與轉接程式 URL 升級 v11、PWA 快取升級 v8。

雲端以保留既有代理設定的 curl 請求 health，CONNECT 被網路政策以 403 拒絕（HTTP 狀態 000，沒有收到 API 回應）。補充網路權限申請回覆「The confirmation did not complete. No settings changed.」。未送出任何真實 POST；截至讀回時「訂單」A1:Q5 仍只有標題。

已準備明確標示非實際出餐的固定測試請求，requestId `b3493d07-7322-49a4-912d-cf53c804e1a2`，s1 一份、Email 空白，預期 NT$85。只沿用此 ID 執行驗收，避免後續協作重複建單。`scripts/live-checkout.cjs` 可在獲准連線的環境驗證 health、正式網站設定、建立／同 ID 重送與查單；雲端並未執行成功，不記為已驗收。

本次已重跑單元測試、模擬 GAS 結帳、手機／桌面離線與 PWA 檢查；真實訂單編號、防重送、查單及 Sheet 寫入驗收仍待獲准網路執行。
