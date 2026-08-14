# BetPanel · 單場包廂活動點數系統

BetPanel 是給 KTV、酒吧與私人聚會使用的即時活動點數展示工具。目前仍是 Demo／測試階段，沒有玩家錢包、儲值、兌換、提領或現金派彩功能。

## 產品模型

- 主辦方一次購買一個包廂使用權：預計 NT$200／6 小時。
- 不販售或預先分配玩家點數。玩家直接輸入活動點數，系統只記錄盤口、選項、倍率與點數結果。
- 活動點數沒有平台設定的台幣匯率，不可在平台儲值、轉讓、兌現或提領。
- 參與者若在平台外另有約定，屬參與者自行處理；BetPanel 不提供收款、代付、催收、轉帳資訊或「已付款」標記。
- 抽成是活動點數帳本中的計算項目，可設 0%；平台不收取盤口抽成，也不按投注量分潤。

新建 Demo 房間會記錄 `billingMode: single_room_6h_twd_200`、`accessMode: demo`、`activatedAt` 與 `expiresAt`。到期後停止新下注、新盤口與戰況，但仍可讀取資料，主辦方也可封盤、結算與封存。舊房沒有 `expiresAt`，會以 legacy 相容模式繼續運作，不會被回算為已到期。

> 「測試啟用 6 小時」不代表已付款。目前沒有串接任何真實金流。

## 付款整合邊界

正式付款不能由瀏覽器成功頁直接啟用房間。建議流程：

1. 後端建立一筆固定 NT$200 的單場訂單，綁定主辦方 UID 與房間 ID。
2. 使用者跳轉第三方支付商的代管付款頁。
3. Cloud Functions 驗證支付商 webhook 的簽章、金額、幣別、付款狀態與重送冪等性。
4. 驗證成功後，由 Admin SDK 寫入不可由前端修改的 `roomAccess/{roomId}` 六小時授權。
5. 退款、拒付、人工補單與授權復原全部保留伺服器稽核紀錄。

`roomAccess` 與 `privatePayments` 已在 Firebase Rules 中設為前端不可讀寫；真正串接前仍需實作 Cloud Functions、訂單資料庫及正式帳號／跨裝置復原機制。Anonymous Auth 若因清除網站資料而更換 UID，會失去原房間管理權，因此不適合直接承接正式已付款訂單。

藍新金流官方雖允許自然人註冊，但其[商店管理規範](https://www.newebpay.com/website/Page/content/store_policy)把「賭場及博奕相關產業」列為禁止項目。BetPanel 在申請前應如實提供完整流程，先取得藍新業務／法遵的書面可承作確認，並完成台灣法律專業評估；在此之前不要接真實付款。

## 現有功能

- Firebase Anonymous Authentication
- 玩家掃碼／輸入代碼加入包廂
- 固定賠率、下注時鎖定 `oddsAtBet`
- 無餘額活動點數輸入與公開帳本；不設定單注最高活動點數
- 抽成只在結算時從中獎淨利扣除，本金不扣
- 莊家風控、封盤、不可逆結算、封存與審計紀錄
- 即時下注動態與莊家戰況推播
- 骰子、划拳、喝酒挑戰、國王大冒險等快速盤口範本
- 六小時倒數使用 Firebase 伺服器時間，切回頁面會立即刷新；到期或封存後，開盤區會清楚顯示為唯讀
- 玩家下注錯誤會區分盤口／權限、登入失效、離線與暫時連線中斷

地方遊戲規則可能不同，範本只描述常見玩法，均以本局主辦方事前說明為準。

## 資料與安全

- 主要資料：`betpanel/rooms/{roomId}/{config,markets,bets,updates,auditLogs}`。
- 玩家只能新增自己的下注；不能修改或刪除既有下注。
- 新下注的活動點數只要求為正整數，不套用房間或盤口的單注上限；舊資料若含 `maxBet` 仍會保留但不再採用。極端數值仍受 JavaScript 安全整數範圍限制，以避免精度損壞。
- 主辦方只能管理 `hostUid` 與登入 UID 相同的房間。
- 結算結果不可撤銷或更換；封存保留所有盤口、下注與審計資料。
- `updates` 與 `auditLogs` 只能追加，不能修改或刪除。
- 舊 `/hosts` 與 `/redeemCodes` 資料不會被本次改版刪除，但已停止前端使用，且 Rules 禁止公開讀取與前端寫入。
- 房間目前為公開讀取，因此 `config.pin` 仍可被讀到；PIN 只用於本機後台辨識，不是授權邊界，寫入權限由 Firebase Auth UID 與 Rules 保護。

## 主要檔案

```text
index.html                              玩家頁
banker.html                             主辦方後台
app.js                                 共用點數、賠率與結算邏輯
style.css                              視覺樣式
database.rules.json                    正式 Realtime Database Rules
firebase.database.rules.example.json   同步的 Rules 範例
tests/                                 核心與 Rules 回歸測試
```

## 本機驗證

```powershell
npm install
npm run check
npm run test:rules
```

`npm run check` 會檢查 `app.js`、兩頁 inline script、核心測試及 Rules JSON。Rules 測試需要 Firebase Database Emulator 與 Java 21。

## 部署

- GitHub Pages 玩家頁：<https://wuchiehee03g.github.io/BetPanel/index.html>
- GitHub Pages 莊家頁：<https://wuchiehee03g.github.io/BetPanel/banker.html>
- GitHub Pages 由 `main` branch 自動部署。
- Firebase Rules 只有在確認需求及測試通過後才執行：

```powershell
firebase.cmd deploy --only database --project betpanel-249dc
```

`BetPanel` 固定使用 Firebase Project `betpanel-249dc`；`PartyScorePanel` 已移至獨立專案，兩者不共用 Rules、匿名 UID 或新房資料。
