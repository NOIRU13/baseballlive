<?php
// データベース接続設定 (Docker対応)

function getDB()
{
    // Docker環境の場合はmysqlコンテナに接続
    // ローカル環境の場合はlocalhostに接続
    $host = getenv('DB_HOST') ?: 'mysql';  // Docker Compose のサービス名
    $dbname = getenv('DB_NAME') ?: 'baseball_live';
    $username = getenv('DB_USER') ?: 'baseball_user';
    $password = getenv('DB_PASS') ?: 'baseball_pass';
    $port = getenv('DB_PORT') ?: '3306';

    try {
        $db = new PDO(
            "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4",
            $username,
            $password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]
        );
        return $db;
    } catch (PDOException $e) {
        http_response_code(500);
        die(json_encode(['error' => 'データベース接続エラー: ' . $e->getMessage()]));
    }
}
