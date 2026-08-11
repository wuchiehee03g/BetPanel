# BetPanel 修復計畫

- [x] 統一派彩預覽與實際結算計算
- [x] 修正玩家身份分組與房間代碼驗證
- [x] 修正房間／盤口封存與結算終態
- [x] 強化下注、審計與戰況 Firebase Rules
- [x] 當時先保留前端儲值、兌換與推薦功能（後續已由單次場次方案取代）
- [x] 更新快取版本與 README
- [x] 完成 JavaScript、HTML inline script、JSON 與規則驗證

## Review

- `npm run check`：6 項核心測試通過，兩頁 inline script 均通過 `node --check`。
- `npm run test:rules`：4 組 Firebase Database Emulator 權限測試通過。
- 正式與範例 Rules 保持完全一致。
- 未部署 Firebase Rules、未推送 Git。
- 此段為前一階段修復紀錄；最新產品決策已移除前端儲值、兌換與推薦流程。

## 單次場次 SaaS 改版

- [x] 盤點儲值、推薦、房間建立與期限相關程式
- [x] 移除錢包／儲值／兌換／推薦產品流程，保留無餘額活動點數
- [x] 加入 NT$200／6 小時單場 Demo 授權與舊房相容期限
- [x] 強化 Firebase Rules 的場次狀態、期限與盤口選項不可變限制
- [x] 更新玩家／莊家文案、README 與快取版本
- [x] 增補核心與 Rules 回歸測試
- [x] 同步至正式工作區並驗證檔案一致

### Review

- `npm run check`：9 項核心／靜態測試通過，兩頁 inline script 通過 `node --check`。
- `npm run test:rules`：7 組 Firebase Database Emulator 測試通過。
- 驗證新場次固定 6 小時、不可延長；到期後阻擋新活動但允許封盤、結算、盤口與房間封存。
- 驗證既有盤口選項／賠率不可修改或刪除，舊房仍可依既有生命週期運作。
- 尚未串接或模擬藍新付款成功；正式付款須由後端 webhook 核發 `roomAccess`。
- 未部署 Firebase Rules、未提交或推送 Git。
