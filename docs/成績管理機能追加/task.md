# 成績管理機能追加タスク

- [x] 現状調査・計画
  - [x] プロジェクト構造確認
  - [x] ドキュメント作成 (`docs/成績管理機能追加/`)
  - [ ] ユーザーへの計画提示・承認

- [/] バックエンド実装 (Python + Docker)
  - [ ] `server/python-backend` ディレクトリ作成
  - [ ] `requirements.txt` 作成 (Flask, Pandas, MySQL-Connector)
  - [ ] `Dockerfile` 作成
  - [ ] `docker-compose.yml` 作成
  - [ ] `app.py` 実装 (APIエントリーポイント)
  - [ ] `database.py` 実装 (DB接続処理)
  - [ ] CSVインポートロジック実装 (Pandas, NULLハンドリング)
  - [ ] CSVエクスポートロジック実装

- [ ] フロントエンド実装 (admin-db.html)
  - [ ] 成績管理タブのHTML追加
  - [ ] CSVアップロード機能のJavaScript実装
  - [ ] 成績一覧表示・編集機能のJavaScript実装

- [ ] 動作確認・検証
  - [ ] Dockerビルド & 起動
  - [ ] ローカルMySQLとの接続確認
  - [ ] CSVインポート (NULLデータ含む) テスト
  - [ ] UI操作テスト
