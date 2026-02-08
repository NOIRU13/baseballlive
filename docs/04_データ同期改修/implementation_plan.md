# 実装計画：データ同期の一方通行化

## 概要

管理画面（admin）から表示画面（display）へのデータ同期を一方通行にする。
現在は双方向で受信・送信している可能性があるため、役割分担を明確にする。

## 変更内容

### `script.js`

1. **受信の制限** (`setupBroadcastChannel`)
   - `isAdminMode` が `true` の場合、`broadcastChannel.onmessage` を設定しない（または無視する）。
   - これにより、管理画面が他からの不意な更新で上書きされるのを防ぐ。

2. **送信の制限** (`broadcastState`)
   - `isAdminMode` が `true` の場合のみ `postMessage` を実行する。
   - 表示画面からの状態変更（もしあれば）が管理画面に影響しないようにする。

## 検証計画

1. ブラウザで `admin.html` と `index.html` を開く。
2. `admin.html` で得点やカウントを変更する -> `index.html` に反映されることを確認。
3. `index.html` をリロードしてもデータが維持されることを確認。
4. `admin.html` をリロードして、データが維持されていることを確認（localStorage経由）。
