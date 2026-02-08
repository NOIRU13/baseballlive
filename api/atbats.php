<?php
// 打席結果API
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    $db = getDB();

    switch ($method) {
        case 'GET':
            // 試合別の打席結果取得
            $game_id = isset($_GET['game_id']) ? (int)$_GET['game_id'] : null;
            $batter_id = isset($_GET['batter_id']) ? (int)$_GET['batter_id'] : null;

            $sql = "SELECT ab.*, p.name as batter_name, pp.name as pitcher_name
                    FROM at_bats ab
                    JOIN players p ON ab.batter_id = p.player_id
                    LEFT JOIN players pp ON ab.pitcher_id = pp.player_id";

            $conditions = [];
            $params = [];
            if ($game_id) {
                $conditions[] = "ab.game_id = :game_id";
                $params[':game_id'] = $game_id;
            }
            if ($batter_id) {
                $conditions[] = "ab.batter_id = :batter_id";
                $params[':batter_id'] = $batter_id;
            }
            if ($conditions) {
                $sql .= " WHERE " . implode(' AND ', $conditions);
            }
            $sql .= " ORDER BY ab.id ASC";

            $stmt = $db->prepare($sql);
            foreach ($params as $key => $val) {
                $stmt->bindValue($key, $val, PDO::PARAM_INT);
            }
            $stmt->execute();
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);

            if (!isset($data['game_id']) || !isset($data['batter_id']) || !isset($data['result_type'])) {
                http_response_code(400);
                echo json_encode(['error' => 'game_id, batter_id, result_type are required']);
                exit;
            }

            $sql = "INSERT INTO at_bats (game_id, batter_id, pitcher_id, inning, half, result_type, rbi, is_sac_fly, is_sac_bunt)
                    VALUES (:game_id, :batter_id, :pitcher_id, :inning, :half, :result_type, :rbi, :is_sac_fly, :is_sac_bunt)";

            $stmt = $db->prepare($sql);
            $stmt->bindValue(':game_id', $data['game_id'], PDO::PARAM_INT);
            $stmt->bindValue(':batter_id', $data['batter_id'], PDO::PARAM_INT);
            $stmt->bindValue(':pitcher_id', $data['pitcher_id'] ?? null, $data['pitcher_id'] ? PDO::PARAM_INT : PDO::PARAM_NULL);
            $stmt->bindValue(':inning', $data['inning'] ?? 1, PDO::PARAM_INT);
            $stmt->bindValue(':half', $data['half'] ?? 'top', PDO::PARAM_STR);
            $stmt->bindValue(':result_type', $data['result_type'], PDO::PARAM_STR);
            $stmt->bindValue(':rbi', $data['rbi'] ?? 0, PDO::PARAM_INT);
            $stmt->bindValue(':is_sac_fly', $data['is_sac_fly'] ?? false, PDO::PARAM_BOOL);
            $stmt->bindValue(':is_sac_bunt', $data['is_sac_bunt'] ?? false, PDO::PARAM_BOOL);
            $stmt->execute();

            echo json_encode(['success' => true, 'id' => $db->lastInsertId()]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
