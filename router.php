<?php
// PHPルーター - APIリクエストを適切なファイルにルーティング

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// APIリクエストの場合
if (strpos($uri, '/api/') === 0) {
    $path = substr($uri, 5);

    // パスからファイル名とIDを抽出
    $segments = explode('/', $path);
    $endpoint = $segments[0];

    error_log("Router: Endpoint = " . $endpoint);

    // エンドポイントに対応するファイルマッピング
    $apiFiles = [
        'teams' => __DIR__ . '/api/teams.php',
        'players' => __DIR__ . '/api/players.php',
        'batting-stats' => __DIR__ . '/api/batting-stats.php',
        'pitching-stats' => __DIR__ . '/api/pitching-stats.php',
        'import-csv' => __DIR__ . '/api/import-csv.php',
        'export-csv' => __DIR__ . '/api/export-csv.php',
        'atbats' => __DIR__ . '/api/atbats.php',
        'game-pitcher-stats' => __DIR__ . '/api/game-pitcher-stats.php',
        'state' => __DIR__ . '/api/state.php',
        'health' => __DIR__ . '/api/health.php'
    ];

    if (isset($apiFiles[$endpoint])) {
        $file = $apiFiles[$endpoint];
        error_log("Router: File = " . $file);

        if (file_exists($file)) {
            // PATH_INFOを設定（IDなどのパラメータ用）
            if (count($segments) > 1) {
                $_SERVER['PATH_INFO'] = '/' . implode('/', array_slice($segments, 1));
            }

            error_log("Router: Loading file " . $file);
            require $file;
            exit;
        } else {
            error_log("Router: File not found " . $file);
        }
    }

    // APIファイルが見つからない場合
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'APIエンドポイントが見つかりません: ' . $endpoint, 'uri' => $uri]);
    exit;
}

// 静的ファイルの場合、そのまま返す
$file = __DIR__ . $uri;
if (is_file($file)) {
    return false; // PHPビルトインサーバーにファイル配信を任せる
}

// ファイルが見つからない
http_response_code(404);
echo "404 Not Found";
exit;
