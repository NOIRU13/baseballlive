# データベース管理機能 使用ガイド

## 📋 概要

BaseballLiveアプリケーションのデータベース管理機能では、以下の操作が可能です:

- **チーム管理**: チームの登録・編集・削除
- **選手管理**: 選手の登録・編集・削除
- **打撃成績管理**: 打撃成績の登録・編集・削除
- **投手成績管理**: 投手成績の登録・編集・削除
- **CSVインポート**: CSVファイルから一括データ投入
- **CSVエクスポート**: データをCSV形式でダウンロード

## 🚀 セットアップ

### 1. データベースの作成

MySQLで以下のコマンドを実行してデータベースを作成します:

```sql
CREATE DATABASE baseball_live CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE baseball_live;
```

### 2. テーブルの作成

`docs/データベース投入/schema.sql` を実行してテーブルを作成します:

```bash
mysql -u root -p baseball_live < docs/データベース投入/schema.sql
```

または、MySQLクライアントで:

```sql
SOURCE c:/Users/jingt/dev/BaseballLive/docs/データベース投入/schema.sql;
```

### 3. データベース接続設定

`api/db.php` を開き、データベース接続情報を確認・修正します:

```php
$host = 'localhost';
$dbname = 'baseball_live';
$username = 'root';
$password = '';  // 必要に応じて設定
```

### 4. PHPサーバーの起動

APIを動作させるため、PHPサーバーを起動します:

```bash
cd c:\Users\jingt\dev\BaseballLive
php -S localhost:3000
```

## 📊 CSVインポート

### CSVファイル形式

#### 選手基本情報 (players)

```csv
team_id,name,number,position,hand
1,小深田大翔,0,CF,左投左打
1,宗山塁,1,2B,左投左打
```

#### 打撃成績 (batting)

```csv
player_id,season,batting_average,games,at_bats,hits,home_runs,rbis,ops
1,2025,0.217,124,299,65,1,14,0.568
2,2025,0.260,122,430,112,3,27,0.629
```

#### 投手成績 (pitching)

```csv
player_id,season,era,games,wins,losses,saves,innings_pitched,strikeouts
10,2025,4.38,19,6,6,0,109.0,55
11,2025,3.05,56,3,4,16,56.0,43
```

### インポート手順

1. `admin-db.html` を開く
2. 「CSV管理」タブを選択
3. 「データ種類」でインポートするデータタイプを選択
4. CSVファイルを選択
5. 「インポート実行」ボタンをクリック

## 📤 CSVエクスポート

1. `admin-db.html` を開く
2. 「CSV管理」タブを選択
3. 「データ種類」でエクスポートするデータタイプを選択
4. 「エクスポート実行」ボタンをクリック
5. ダウンロードされたCSVファイルを保存

## 🎯 成績管理

### 打撃成績の登録

1. 「打撃成績」タブを選択
2. 「新規登録」ボタンをクリック
3. フォームに成績データを入力
4. 「保存」ボタンをクリック

### 投手成績の登録

1. 「投手成績」タブを選択
2. 「新規登録」ボタンをクリック
3. フォームに成績データを入力
4. 「保存」ボタンをクリック

## 🔧 トラブルシューティング

### APIエラーが発生する場合

1. PHPサーバーが起動しているか確認
2. `api/db.php` の接続情報が正しいか確認
3. データベースが作成されているか確認
4. ブラウザのコンソールでエラー内容を確認

### CSVインポートが失敗する場合

1. CSVファイルの形式が正しいか確認
2. 文字コードがUTF-8であることを確認
3. 必須項目が全て入力されているか確認
4. 外部キー制約（team_id, player_id）が正しいか確認

## 📝 サンプルデータ

`docs/データベース投入/` ディレクトリに以下のサンプルファイルがあります:

- `sample_players.csv` - 選手基本情報のサンプル
- `rakuten_eagles_data.sql` - 楽天イーグルスの選手データ（SQL形式）
- `batting_stats_part1.sql` - 打撃成績のサンプル（SQL形式）

## 🌐 アクセスURL

- **管理画面**: http://localhost:8080/admin-db.html
- **API Base URL**: http://localhost:3000/api

## 📚 API エンドポイント

- `GET /api/teams` - チーム一覧取得
- `POST /api/teams` - チーム登録
- `GET /api/players` - 選手一覧取得
- `POST /api/players` - 選手登録
- `GET /api/batting-stats` - 打撃成績一覧取得
- `POST /api/batting-stats` - 打撃成績登録
- `GET /api/pitching-stats` - 投手成績一覧取得
- `POST /api/pitching-stats` - 投手成績登録
- `POST /api/import-csv` - CSVインポート
- `GET /api/export-csv?type=players` - CSVエクスポート
