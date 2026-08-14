# BetPanel 修復計畫

## 固定賠率操作體驗移植與移除單注上限

- [x] 移除後台「單筆最高活動點數」設定與房間／盤口 `maxBet` 新寫入
- [x] 移除玩家端與 Firebase Rules 的單注上限判斷，保留正整數與安全數值驗證
- [x] 加入共用六小時倒數、回到頁面即刷新及到期／封存唯讀提示
- [x] 加入玩家 30 秒說明、莊家四步驟說明與清楚的下注失敗原因
- [x] 更新 README、正式／範例 Rules、核心及 Emulator 回歸測試
- [x] 完成語法、JSON、核心、Rules、正式頁面流程驗證後部署與推送

### 原則

- 保留 BetPanel 原版固定賠率、下注時鎖定倍率、莊家抽水與完整結算帳單。
- 不移植 PartyScorePanel 的正負分數模式、品牌、Firebase 設定或金流／復原資料。
- 舊資料中的 `maxBet` 不刪除，只停止讀取與套用，避免改寫既有房間。

### Review

- `npm.cmd run check`：12 組核心／靜態測試通過，`app.js` 與兩頁 inline script 語法均正確，正式與範例 Rules JSON 完全一致。
- `npm.cmd run test:rules`：7 組 Realtime Database Rules Emulator 測試通過；250,000 Pts 新下注允許，小數與超出 JavaScript 安全整數的值拒絕。
- Firebase Rules 已部署至 `betpanel-249dc`；未修改 `partyscorepanel-249dc`。
- GitHub Pages 正式測試房 `ZZB7ND` 已完成建立房間、固定賠率 x2.00 開盤、250,000 Pts 下注、公開帳本同步與封盤；舊 10,000 Pts 上限已不再生效。
- BetPanel 仍保留固定賠率、5% 預設抽水（可調 0–15%）、本金不抽水與不可逆結算語意。

## 原版固定賠率復原與重新上線

- [x] 保留複製來的 PartyScorePanel 狀態為本機 `partyscorepanel-copy` 分支
- [x] 將 `main` 還原至 `2f18d29` 固定賠率／莊家抽水 checkpoint
- [x] 完成 JavaScript、inline script、JSON、核心與 Rules Emulator 測試
- [x] 恢復 `betpanel-249dc` 固定賠率 Rules，未刪除既有資料
- [x] 推送 `wuchiehee03g/BetPanel` 並啟用 GitHub Pages
- [x] 正式頁建立測試房並完成 x2.00 固定賠率下注

### Review

- `npm run check`：9 項核心／靜態測試與兩頁 inline script 全數通過。
- `npm run test:rules`：7 組 Realtime Database Rules Emulator 測試全數通過。
- 正式測試房 `CDX824` 已接受 100 Pts、x2.00 的玩家下注，公開帳本與鎖定賠率即時同步，兩頁連線正常且無 console error。
- 原版 checkpoint 仍為 `2f18d29541328f05b3f02bfef0de960d66077903`；後續文件提交不改變前端運算與資料結構。

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
