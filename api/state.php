<?php
// 試合状態API (ファイルベース)
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$stateFile = __DIR__ . '/../data/state.json';
$stateDir = dirname($stateFile);

// dataディレクトリが無ければ作成
if (!is_dir($stateDir)) {
    mkdir($stateDir, 0777, true);
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            if (file_exists($stateFile)) {
                $json = file_get_contents($stateFile);
                $data = json_decode($json, true);
                echo json_encode(['state' => $data]);
            } else {
                echo json_encode(['state' => null]);
            }
            break;

        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            if (isset($input['state'])) {
                file_put_contents($stateFile, json_encode($input['state'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
                echo json_encode(['success' => true]);
            } else {
                http_response_code(400);
                echo json_encode(['error' => 'state field is required']);
            }
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
