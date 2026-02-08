<?php
// チームAPI
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_SERVER['PATH_INFO']) ? $_SERVER['PATH_INFO'] : '/';
$segments = explode('/', trim($path, '/'));

try {
    $db = getDB();

    switch ($method) {
        case 'GET':
            // チーム一覧取得
            $sql = "SELECT team_id, team_name, team_code, league, short_name FROM teams ORDER BY team_id";
            $stmt = $db->query($sql);
            $teams = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // キー名を変換（フロントエンドとの互換性のため）
            $result = array_map(function ($team) {
                return [
                    'id' => $team['team_id'],
                    'name' => $team['team_name'],
                    'code' => $team['team_code'],
                    'league' => $team['league'],
                    'short_name' => $team['short_name']
                ];
            }, $teams);

            echo json_encode($result);
            break;

        case 'POST':
            // 新規登録
            $data = json_decode(file_get_contents('php://input'), true);

            $sql = "INSERT INTO teams (team_name, team_code, short_name) VALUES (:team_name, :team_code, :short_name)";
            $stmt = $db->prepare($sql);
            $stmt->bindParam(':team_name', $data['name']);
            $stmt->bindParam(':team_code', $data['code'] ?? null);
            $stmt->bindParam(':short_name', $data['short_name']);
            $stmt->execute();

            echo json_encode(['success' => true, 'id' => $db->lastInsertId()]);
            break;

        case 'PUT':
            // 更新
            $id = isset($segments[0]) ? $segments[0] : null;
            if (!$id) {
                throw new Exception('IDが指定されていません');
            }

            $data = json_decode(file_get_contents('php://input'), true);

            $sql = "UPDATE teams SET team_name = :team_name, short_name = :short_name WHERE team_id = :id";
            $stmt = $db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':team_name', $data['name']);
            $stmt->bindParam(':short_name', $data['short_name']);
            $stmt->execute();

            echo json_encode(['success' => true]);
            break;

        case 'DELETE':
            // 削除
            $id = isset($segments[0]) ? $segments[0] : null;
            if (!$id) {
                throw new Exception('IDが指定されていません');
            }

            $sql = "DELETE FROM teams WHERE team_id = :id";
            $stmt = $db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            echo json_encode(['success' => true]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'メソッドが許可されていません']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
