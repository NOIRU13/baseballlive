<?php
// 投手成績API
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
            // 投手成績一覧取得
            $player_id = isset($_GET['player_id']) ? $_GET['player_id'] : null;

            $sql = "SELECT ps.*, p.name as player_name, t.short_name as team_name
                    FROM pitching_stats ps 
                    JOIN players p ON ps.player_id = p.player_id
                    JOIN teams t ON p.team_id = t.team_id";

            if ($player_id) {
                $sql .= " WHERE ps.player_id = :player_id";
            }

            $sql .= " ORDER BY ps.season DESC, p.name";

            $stmt = $db->prepare($sql);
            if ($player_id) {
                $stmt->bindParam(':player_id', $player_id, PDO::PARAM_INT);
            }
            $stmt->execute();

            $stats = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($stats);
            break;

        case 'POST':
            // 新規登録
            $data = json_decode(file_get_contents('php://input'), true);

            $sql = "INSERT INTO pitching_stats (
                        player_id, season, era, games, wins, losses, 
                        saves, innings_pitched, strikeouts
                    ) VALUES (
                        :player_id, :season, :era, :games, :wins, :losses,
                        :saves, :innings_pitched, :strikeouts
                    )";

            $stmt = $db->prepare($sql);
            $stmt->bindParam(':player_id', $data['player_id'], PDO::PARAM_INT);
            $stmt->bindParam(':season', $data['season'], PDO::PARAM_INT);
            $stmt->bindParam(':era', $data['era']);
            $stmt->bindParam(':games', $data['games'], PDO::PARAM_INT);
            $stmt->bindParam(':wins', $data['wins'], PDO::PARAM_INT);
            $stmt->bindParam(':losses', $data['losses'], PDO::PARAM_INT);
            $stmt->bindParam(':saves', $data['saves'], PDO::PARAM_INT);
            $stmt->bindParam(':innings_pitched', $data['innings_pitched']);
            $stmt->bindParam(':strikeouts', $data['strikeouts'], PDO::PARAM_INT);

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

            $sql = "UPDATE pitching_stats SET
                        player_id = :player_id,
                        season = :season,
                        era = :era,
                        games = :games,
                        wins = :wins,
                        losses = :losses,
                        saves = :saves,
                        innings_pitched = :innings_pitched,
                        strikeouts = :strikeouts
                    WHERE stat_id = :id";

            $stmt = $db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':player_id', $data['player_id'], PDO::PARAM_INT);
            $stmt->bindParam(':season', $data['season'], PDO::PARAM_INT);
            $stmt->bindParam(':era', $data['era']);
            $stmt->bindParam(':games', $data['games'], PDO::PARAM_INT);
            $stmt->bindParam(':wins', $data['wins'], PDO::PARAM_INT);
            $stmt->bindParam(':losses', $data['losses'], PDO::PARAM_INT);
            $stmt->bindParam(':saves', $data['saves'], PDO::PARAM_INT);
            $stmt->bindParam(':innings_pitched', $data['innings_pitched']);
            $stmt->bindParam(':strikeouts', $data['strikeouts'], PDO::PARAM_INT);

            $stmt->execute();

            echo json_encode(['success' => true]);
            break;

        case 'DELETE':
            // 削除
            $id = isset($segments[0]) ? $segments[0] : null;
            if (!$id) {
                throw new Exception('IDが指定されていません');
            }

            $sql = "DELETE FROM pitching_stats WHERE stat_id = :id";
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
