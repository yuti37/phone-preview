# 照片與 KakaoTalk 分享 V1.2

## 範圍與雙入口

照片 App 分享與 KakaoTalk「＋ → 앨범 → 選圖 → 預覽 → 確認」仍共用 photoShareEligibility、photoShareConfirm 及事件庫內的 photoSharesV1。沒有新增儲存鍵、第二套聊天引擎或上傳功能。傳送前必須成功載入照片並再次驗證資格；取消不寫入資料。

| 分享事件 ID | 照片 ID | 接收者 | 照片故事時間 | 新的獨立回覆 |
| --- | --- | --- | --- | --- |
| photo-share-v1:meal-minhyuk | photo-9376 | 玟赫 | 2026/10/21 19:58 | 保留已核准回覆 |
| photo-share-v1:work-manager | photo-9370 | 經紀人 | 2026/10/23 15:05 | 保留已核准回覆 |
| photo-share-v1:restaurant-shownu-9334 | photo-9334 | 賢佑 | 2026/10/21 20:44 | 已核准，僅安全空閒時 direct |

上述日期為既有虛構故事設定，不是真實拍攝日期。照片訊息使用故事時間與該聊天室最新有效訊息的較晚值，再加一秒；不使用裝置日期推進劇情。

## 實際衝突與修正

V1.1 已檢查直接排程至 shownu 聊天室的文字訊息，但仍有兩個缺口：

1. scheduleLostPhoneCall 將來電 ID 存入 scheduledCallId，排程時 call.status 仍可為 idle；來電事件本身沒有 payload.chatId。因此只看 call.status 與聊天室訊息佇列會誤判空閒。
2. processDueGameEvents 批次執行中，主線處理器可以建立並立即送達新訊息。這時 scheduleGameEvents 因 processingGameEvents 而暫停重新驗證；等照片回覆執行時，主線已 completed。舊檢查又只攔截嚴格晚於照片回覆的故事時間，放過同分鐘但早一秒的主線。

隔離測試使用實際的 scheduleLostPhoneFollowupMessage，重現 9:15 照片、9:16 未接來電後續與 9:16 照片回覆同時存在。修正不修改主線內容、時間或排序。

### 賢佑回覆資格

photoShareIsShownuMainEvent 依既有事件類型、ID、接收者、來源與 kind 辨認相關訊息、通話、電話後續、匯流、飲酒及轉場。無法明確排除的 story／phone 轉場採保守處理。

- 通話中：none。
- 主線已有待送回覆：absorbed。
- 相關通話／轉場在佇列中（包括 deferred、failed），或正在等待主線選擇、飲酒／隔天階段：none。
- 能確認空閒，且該照片已有核准回覆：direct。

新 9334 的文案已核准，正式設定 replyApproved 為 true；只有 direct 並通過送達前的主線衝突檢查才送出。absorbed／none 不建立獨立回覆，不沿用或恢復 9333 的舊台詞。

### 執行前與同批事件防護

- 成功建立 shownu direct 回覆時，將既有主線狀態及相關事件清單的唯讀比對快照存入該分享紀錄，不建立另一套主線進度。
- createGameEvent 完成資格判定後，以及 narrativeBeforeEventExecution 執行主線前，都會將衝突的未送照片回覆標記為 inapplicable。取消與原本事件寫入一起保存，即使在同一批處理中也有效。
- 真正送達前再次檢查快照、主線資格、故事時間窗口與原有 30 秒傳輸期限；同分鐘的主線也視為競爭，不只比較嚴格較晚的毫秒值。
- 照片保留，主線不變；失效事件不延後、不重新排程，重載也不復活。已送達回覆不受這些取消處理影響。
- absorbed／none 不新增回覆或對方已讀資訊，也不占用或清除主線 pendingReply。
- 玟赫及經紀人的原有回覆與暫緩機制維持不變。

## 9333 與 9334 的相容處理

既有 photo-9333 與 photo-9334 的路徑、內容、日期、描述及相簿分類完全保留。依使用者確認：前者是賢佑拍攝亨源，後者是亨源拍攝賢佑。這些開發設定不新增為玩家介面的拍攝者標籤。

舊 photo-share-v1:restaurant-shownu 僅保留為舊存檔查找項目，不再提供新分享。其已送達照片、回覆及紀錄保留；未送回覆失效，不重新觸發。新 9334 使用獨立 ID 與 photoId + chatId 去重，不會被舊 9333 分享紀錄阻擋，也不將舊紀錄改寫成新照片。

## KKT 選擇器

kakaoPhotoEligiblePhotos 對目前聊天室逐張引用 STAGE13_PHOTOS，透過 photoShareEligibility 篩選後才渲染。已傳送、不允許、未解鎖及未到故事時間的照片不產生 DOM 格子；沒有灰色停用縮圖、重複原因或完成徽章。

無可傳照片時只顯示：

- 보낼 수 있는 사진이 없어요.
- 目前沒有可以傳送的照片。

保留關閉操作。確認時若資格已改變，不建立訊息／紀錄／事件，返回更新後的清單並顯示韓文提示。照片 App 的 25 張照片與原分享入口不受此清單篩選影響。

## 保留的核准回覆

### 玟赫

- 이거 보니까 또 배고프네 ㅋㅋ 맛있었어?
- 看到這個又餓了ㅋㅋ 好吃嗎？

### 經紀人

- 사진 확인했어요. 기록용으로 보관해 둘게요.
- 照片確認了，我會留作紀錄。

## 賢佑 9334 已核准回覆

- 이 사진 괜찮다. 저장해 둘게.
- 這張照片不錯，我存起來。

此為虛構角色台詞，不會真的收藏照片、寫入新的照片檔案或新增系統儲存照片事件。

## 測試方式

- 自動化：以 node --test 執行 tests 內全部 .test.js。
- 選用瀏覽器測試：node tests/photo-kakao-sharing.browser.cjs，需開發環境提供 Playwright；可用 CHROME_EXECUTABLE 指定 Chromium。
- 瀏覽器使用臨時隔離 context，檢查 320、390、430px；經紀人 UI 送圖使用明確空閒的隔離情境。
- 9334 的直接回覆、重載與主線衝突回歸使用已核准的正式設定；人工快照測試仍僅存在隔離測試環境。原電話、飲酒、隔天及其他 App 回歸繼續執行。
- 桌面行動版 Chrome 不等同真實 iPhone Safari 驗收。
