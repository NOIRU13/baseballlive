<?php
// 選手API
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
            // 選手一覧取得
            $team_id = isset($_GET['team_id']) ? $_GET['team_id'] : null;

            $sql = "SELECT p.*, t.team_name 
                    FROM players p 
                    LEFT JOIN teams t ON p.team_id = t.id";

            if ($team_id) {
                $sql .= " WHERE p.team_id = :team_id";
            }

            $sql .= " ORDER BY 
                        p.team_id, 
                        FIELD(p.position, 'P', 'C', 'IF', 'OF'), 
                        CAST(p.number AS UNSIGNED)";

            $stmt = $db->prepare($sql);
            if ($team_id) {
                $stmt->bindParam(':team_id', $team_id, PDO::PARAM_INT);
            }
            $stmt->execute();

            $players = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // キー名を変換
            $result = array_map(function ($player) {
                return [
                    'id' => $player['id'],
                    'team_id' => $player['team_id'],
                    'name' => $player['name'],
                    'number' => $player['number'],
                    'position' => $player['position'],
                    'hand' => $player['hand'],
                    'team_name' => $player['team_name']
                ];
            }, $players);

            echo json_encode($result);
            break;

        case 'POST':
            // 新規登録
            $data = json_decode(file_get_contents('php://input'), true);

            $sql = "INSERT INTO players (team_id, name, number, position, hand) 
                    VALUES (:team_id, :name, :number, :position, :hand)";

            $stmt = $db->prepare($sql);
            $stmt->bindParam(':team_id', $data['team_id'], PDO::PARAM_INT);
            $stmt->bindParam(':name', $data['name']);
            $stmt->bindParam(':number', $data['number']);
            $stmt->bindParam(':position', $data['position']);
            $stmt->bindParam(':hand', $data['hand']);

            // 以前の switch 文による投打変換ロジックが不要であれば単純化
            // DBカラム名に合わせて :hand をバインド

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

            $sql = "UPDATE players SET 
                        team_id = :team_id,
                        name = :name,
                        number = :number,
                        position = :position,
                        hand = :hand
                    WHERE id = :id";

            $stmt = $db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':team_id', $data['team_id'], PDO::PARAM_INT);
            $stmt->bindParam(':name', $data['name']);
            $stmt->bindParam(':number', $data['number']);
            $stmt->bindParam(':position', $data['position']);
            $stmt->bindParam(':hand', $data['hand']);
            $stmt->execute();

            echo json_encode(['success' => true]);
            break;

        case 'DELETE':
            // 削除
            $id = isset($segments[0]) ? $segments[0] : null;
            if (!$id) {
                throw new Exception('IDが指定されていません');
            }

            $sql = "DELETE FROM players WHERE id = :id";
            $stmt = $db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            echo json_encode(['success' => true]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'メソッドが許可されていません']);
    }

} catch (PDOException $e) {
    if ($e->getCode() == 23000 && strpos($e->getMessage(), 'Duplicate entry') !== false) {
        http_response_code(409); // Conflict
        echo json_encode(['error' => '背番号または名前が重複しています']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'データベースエラー: ' . $e->getMessage()]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
