# 任務十：Google Sheet + GAS 結帳

目前狀態：本人已授權並發布 GAS version 1，且成功執行 `setup`（未執行 `setupAndVerify`）。前台已設定正式 GAS 網址。雲端環境網路政策拒絕 API 及正式網站網域，故**尚未驗證正式網站抓到新版或實際寫入／防重送／查單**。

- [正式 API](https://script.google.com/macros/s/AKfycbyjeRIXanTWRhSG-nWEZOeFzV9RtqyvZBu3zow4r7G3517UxiLVjFokSWSHcVud1u3oKQ/exec)
- [綁定 Apps Script 專案](https://script.google.com/u/0/home/projects/1cnWb4sPH6jeUZ7g9Dan54TOx6oAz6KqpMXCqZjh4r9F07gXb4h5XkPgv/edit)
- 已準備固定測試請求 `docs/tasks-10-live-request.json`，無 Email、備註為「任務十驗收測試，非實際出餐」。雲端尚未送出此請求。

可在獲准連線的環境執行 `LIVE_CHECKOUT_TEST=1 node scripts/live-checkout.cjs`。此命令先驗證 health 與正式網站設定，再使用同一 requestId 建單、重送與查單；不要修改 requestId 重跑，避免建立多筆邏輯訂單。仍需另外在私人 Sheet 讀回同一訂單與明細。

以下為部署／重新部署參考；目前不需要再重跑初始化或新增第二個部署。

## 唯一需要本人完成的環節：Google 帳號授權及發布 GAS

請使用試算表的擁有者帳號完成以下同一個部署流程：

1. 開啟 [任務十試算表](https://docs.google.com/spreadsheets/d/1y2nbETPg9Xk-Xf9b_2cX7HbM59yeIGMk4lnrdCKQpR0/edit)，選「擴充功能 → Apps Script」。以本資料夾的 [Code.gs](https://github.com/theothersideofparadise/gyoza-website/blob/main/gas/Code.gs) 完整取代預設程式並儲存。若要使用 manifest，先在專案設定勾選顯示 appsscript.json，再貼入本資料夾的 appsscript.json。
2. 從函式選單執行 `setupAndVerify` 並完成 Google 授權。這會在真實試算表寫入 **一筆標記為「任務十驗收測試，非實際出餐」的訂單**，重試相同請求，再讀回結果；執行記錄應顯示 `ok:true`、訂單編號、金額與 `matchingOrderRows:1`。可在「訂單」「訂單明細」核對。每次手動執行這個函式都會建立一筆新的測試單。
3. 選「部署 → 新增部署作業 → 網頁應用程式」，執行身分選「我」，存取權選「所有人」。部署後複製 **以 `/exec` 結尾**的網址，回傳該網址與步驟 2 的結果；不必提供任何密碼、token 或 OAuth 憑證。

若帳號的組織政策不允許「所有人」，請回報限制；不要使用 `/dev` 或只能登入後存取的網址替代。試算表本身保持私人，**不需要公開分享**。

## 取得網址後的切換與驗收

1. 在未登入 Google 的瀏覽器開啟 `/exec`，應得到 JSON：`ok:true`、`ready:true`、`version:2`。
2. 將 `assets/order-config.js` 的 `provider` 改為 `'gas'`，`gasUrl` 填入實際 `/exec` 網址。此網址是公開的接單入口；不得放 ADMIN_KEY 或私人憑證。
3. 更新 Service Worker 快取版本與 order-config/order-client 的 URL 版本，推到 main，重新載入網站。
4. 在網站選一項商品、外帶、測試姓名與手機 `0900000000`，備註標記「任務十驗收測試，非實際出餐」，Email 留空。確認網站顯示成功，並在真實 Sheet 核對一筆訂單、對應明細、伺服器計算金額。
5. 用同一訂單編號執行網站「訂單查詢」，核對金額、品項與狀態。以瀏覽器 Network 確認 GAS 回應是可讀的 JSON；如果是登入頁、CORS 錯誤或不明回應，不能算驗收通過。

`setupAndVerify` 驗證真實 Sheet 的 GAS 寫入、重試與讀回；步驟 4–5 另外驗證跨網域網站實際串接。兩者都需要，不能以本機模擬測試替代。

## 試算表結構

時區：Asia/Taipei。

| 分頁 | 範圍／用途 |
|---|---|
| 訂單 | A:Q：訂單編號、建立時間、狀態、取餐方式、姓名、手機、Email、門市、地址、備註、小計、運費/服務費、應付總額、更新時間、請求ID、請求摘要、寫入狀態 |
| 訂單明細 | A:F：訂單編號、商品ID、品名、單價、數量、小計 |
| 商品 | A:E：商品ID、品名、單價、分類、上架；19 項商品已寫入，請勿隨意更動商品 ID |

`setup` 可重跑，保留既有商品價格與訂單。新增請求欄位放在舊 14 欄後，既有 admin.html 的列表欄位仍相容。手機欄使用文字格式保留開頭 0。

## 防重送與錯誤處理

- 每次 GAS 送單帶隨機 requestId；前台只在 sessionStorage 存請求 ID、雜湊與不確定狀態，不保存姓名／手機／地址。
- 相同資料重試（含同一分頁重新載入後重填）沿用 requestId，伺服器在 ScriptLock 內查重並回傳原訂單。
- 回應不明時不自動重試、不清空購物車／表單；資料不變可手動重試。未確認的訂單若改資料，前台會阻擋新單並提示先確認，避免不知情重複下單。
- 訂單先標「寫入中」，明細完成才標「已建立」。中斷重試會修復同一筆訂單；不完整訂單不出現在成功查詢或後台列表。
- 商品數量必須為 1–50 的整數，最多 30 種；拒絕重複商品 ID，金額從商品表重算，驗證門市、手機、Email、宅配地址並防止試算表公式注入。
- HTTP 使用 `text/plain` POST，避免 JSON 預檢；仍要求瀏覽器可讀回 JSON，**不使用 `no-cors`，不把 opaque 回應當成功**。
- 公開查單只回狀態與商品／金額，不回顧客個資。訂單編號可猜測，這不是完整顧客驗證機制；正式大量接單需另加認證及流量控管。

## 後台與通知

使用 admin.html 時，在 GAS 專案設定的 **指令碼屬性**加入自行產生的 `ADMIN_KEY`，只於後台登入欄輸入，不能提交 repo。未設定時後台 API 關閉。

Email 通知沿用現有功能，有填顧客 Email 才寄；店家通知信箱可設在指令碼屬性 `OWNER_EMAIL`。郵件失敗不撤銷已寫入的訂單；GAS 與 MailApp 有配額，測試單請留空 Email。

## 驗證紀錄的界線

已透過 Google Sheets 連接器建立並讀回欄位、商品與時區；現已取得本人發布的正式 GAS URL，且前台設定已改為 GAS。但雲端 API 健康檢查遭網路代理拒絕（CONNECT 403，未到達 Google），網路授權申請未完成，因此 **尚未實測 GAS 寫單至真實 Sheet 或網站跨網域送單**。不要把部署成功、setup 成功或本機模擬測試視為正式串接驗收完成。
