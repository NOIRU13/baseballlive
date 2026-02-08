# タスク: 打者・投手表示および結果アニメーション実装

- [/] HTML構造の追加 (index.html)
  - [x] 打者情報表示エリア (#player-display-left) の追加
  - [x] 投手情報表示エリア (#player-display-right) の追加
  - [x] アニメーション表示エリア (#result-overlay) の追加
- [/] スタイリングとアニメーション定義 (style.css)
  - [x] 打者・投手表示エリアのレイアウトとデザイン
  - [x] 結果アニメーション用のスタイルと@keyframes定義
- [x] JavaScriptロジック実装 (script.js)
  - [x] `updateBottomStats` 関数の拡張（打者成績・詳細表示）
  - [x] `recordAtBatResult` 関数でのイベント送信処理追加
  - [x] アニメーション発火・制御ロジックの実装
- [ ] 動作確認
  - [ ] 打者・投手名が正しく表示されること
  - [ ] 打席結果を入力した際、アニメーションが表示されること
  - [ ] 打者の過去の成績が表示されること
