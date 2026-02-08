# タスク：スリーアウトチェンジのアニメーション実装

- [ ] `index.html` にアニメーション用HTML要素を追加
- [ ] `css/animation.css` (または `css/overlay.css`) にチェンジ用のアニメーション定義を追加
- [ ] `js/logic/game.js` の `recordAtBatResult` を修正し、チェンジ発生時に `true` を返すようにする
- [ ] `js/app.js` の各ボタンイベントでチェンジを検知し `CHANGE` イベントをブロードキャストする処理を追加
- [ ] `js/ui/render.js` に `playChangeAnimation` 関数を追加し、`CHANGE` 受信時に呼び出す
- [ ] 動作確認
