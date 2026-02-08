<?php
// 打撃成績API
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
            // 打撃成績一覧取得
            $player_id = isset($_GET['player_id']) ? $_GET['player_id'] : null;

            $sql = "SELECT bs.*, p.name as player_name, t.short_name as team_name
                    FROM batting_stats bs 
                    JOIN players p ON bs.player_id = p.player_id
                    JOIN teams t ON p.team_id = t.team_id";

            if ($player_id) {
                $sql .= " WHERE bs.player_id = :player_id";
            }

            $sql .= " ORDER BY bs.season DESC, p.name";

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

            $sql = "INSERT INTO batting_stats (
                        player_id, season, batting_average, games, at_bats, 
                        hits, home_runs, rbis, ops
                    ) VALUES (
                        :player_id, :season, :batting_average, :games, :at_bats,
                        :hits, :home_runs, :rbis, :ops
                    )";

            $stmt = $db->prepare($sql);
            $stmt->bindParam(':player_id', $data['player_id'], PDO::PARAM_INT);
            $stmt->bindParam(':season', $data['season'], PDO::PARAM_INT);
            $stmt->bindParam(':batting_average', $data['batting_average']);
            $stmt->bindParam(':games', $data['games'], PDO::PARAM_INT);
            $stmt->bindParam(':at_bats', $data['at_bats'], PDO::PARAM_INT);
            $stmt->bindParam(':hits', $data['hits'], PDO::PARAM_INT);
            $stmt->bindParam(':home_runs', $data['home_runs'], PDO::PARAM_INT);
            $stmt->bindParam(':rbis', $data['rbis'], PDO::PARAM_INT);
            $stmt->bindParam(':ops', $data['ops']);

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

            $sql = "UPDATE batting_stats SET
                        player_id = :player_id,
                        season = :season,
                        batting_average = :batting_average,
                        games = :games,
                        at_bats = :at_bats,
                        hits = :hits,
                        home_runs = :home_runs,
                        rbis = :rbis,
                        ops = :ops
                    WHERE stat_id = :id";

            $stmt = $db->prepare($sql);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':player_id', $data['player_id'], PDO::PARAM_INT);
            $stmt->bindParam(':season', $data['season'], PDO::PARAM_INT);
            $stmt->bindParam(':batting_average', $data['batting_average']);
            $stmt->bindParam(':games', $data['games'], PDO::PARAM_INT);
            $stmt->bindParam(':at_bats', $data['at_bats'], PDO::PARAM_INT);
            $stmt->bindParam(':hits', $data['hits'], PDO::PARAM_INT);
            $stmt->bindParam(':home_runs', $data['home_runs'], PDO::PARAM_INT);
            $stmt->bindParam(':rbis', $data['rbis'], PDO::PARAM_INT);
            $stmt->bindParam(':ops', $data['ops']);

            $stmt->execute();

            echo json_encode(['success' => true]);
            break;

        case 'DELETE':
            // 削除
            $id = isset($segments[0]) ? $segments[0] : null;
            if (!$id) {
                throw new Exception('IDが指定されていません');
            }

            $sql = "DELETE FROM batting_stats WHERE stat_id = :id";
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
