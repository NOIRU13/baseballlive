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
                    LEFT JOIN teams t ON p.team_id = t.team_id";

            if ($team_id) {
                $sql .= " WHERE p.team_id = :team_id";
            }

            $sql .= " ORDER BY 
                        p.team_id, 

                        CASE 
                            -- Catcher (Priority 1)
                            WHEN TRIM(p.position) IN ('C', '捕', '捕手') THEN 1
                            -- Infield (Priority 2)
                            WHEN TRIM(p.position) IN ('1B', '2B', '3B', 'SS', 'IF', '一', '二', '三', '遊', '内', '一塁手', '二塁手', '三塁手', '遊撃手', '内野手', '2nd', '3rd', '1st', 'Short') THEN 2
                            -- Outfield (Priority 3)
                            WHEN TRIM(p.position) IN ('LF', 'CF', 'RF', 'OF', '左', '中', '右', '外', '左翼手', '中堅手', '右翼手', '外野手', 'Left', 'Center', 'Right') THEN 3
                            -- Pitcher (Priority 4)
                            WHEN TRIM(p.position) IN ('P', '投', '投手') THEN 4
                            -- DH (Priority 5)
                            WHEN TRIM(p.position) IN ('DH', '指', '指名打者') THEN 5
                            ELSE 6
                        END, 
                        CASE WHEN CAST(p.uniform_number AS UNSIGNED) >= 100 THEN 1 ELSE 0 END,
                        CAST(p.uniform_number AS UNSIGNED)";

            $stmt = $db->prepare($sql);
            if ($team_id) {
                $stmt->bindParam(':team_id', $team_id, PDO::PARAM_INT);
            }
            $stmt->execute();

            $players = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // キー名を変換
            // キー名を変換（フロントエンドとの互換性のため）
            $result = array_map(function ($player) {
                return [
                    'id' => $player['player_id'],
                    'team_id' => $player['team_id'],
                    'name' => $player['name'],
                    'number' => $player['uniform_number'],
                    'position' => $player['position'],
                    'hand' => $player['batting_side'] ?? $player['pitching_arm'] ?? '',
                    'team_name' => $player['team_name']
                ];
            }, $players);

            echo json_encode($result);
            break;

        case 'POST':
            // 新規登録
            $data = json_decode(file_get_contents('php://input'), true);

            $sql = "INSERT INTO players (team_id, name, uniform_number, position, batting_side) 
                    VALUES (:team_id, :name, :uniform_number, :position, :batting_side)";

            $stmt = $db->prepare($sql);
            $stmt->bindParam(':team_id', $data['team_id'], PDO::PARAM_INT);
            $stmt->bindParam(':name', $data['name']);
            $stmt->bindParam(':uniform_number', $data['number']);
            $stmt->bindParam(':position', $data['position']);
            $stmt->bindParam(':batting_side', $data['hand']);

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
                        uniform_number = :uniform_number,
                        position = :position,
                        batting_side = :batting_side
                    WHERE player_id = :id";

            $stmt = $db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':team_id', $data['team_id'], PDO::PARAM_INT);
            $stmt->bindParam(':name', $data['name']);
            $stmt->bindParam(':uniform_number', $data['number']);
            $stmt->bindParam(':position', $data['position']);
            $stmt->bindParam(':batting_side', $data['hand']);
            $stmt->execute();

            echo json_encode(['success' => true]);
            break;

        case 'DELETE':
            // 削除
            $id = isset($segments[0]) ? $segments[0] : null;
            if (!$id) {
                throw new Exception('IDが指定されていません');
            }

            $sql = "DELETE FROM players WHERE player_id = :id";
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
