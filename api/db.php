<?php
// データベース接続設定

function getDB()
{
    $host = 'localhost';
    $dbname = 'baseball_live';
    $username = 'root';
    $password = '';

    try {
        $db = new PDO(
            "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
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
