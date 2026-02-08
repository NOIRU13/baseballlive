<?php
// 試合別投手成績API
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

    // テーブルが無い場合は作成
    $db->exec("CREATE TABLE IF NOT EXISTS game_pitcher_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_id INT NOT NULL,
        pitcher_id INT NOT NULL,
        team VARCHAR(10) NOT NULL COMMENT 'home or away',
        innings_pitched DECIMAL(4,1) DEFAULT 0,
        strikeouts INT DEFAULT 0,
        walks INT DEFAULT 0,
        runs_allowed INT DEFAULT 0,
        pitch_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_game (game_id),
        INDEX idx_pitcher (pitcher_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='試合別投手成績'");

    switch ($method) {
        case 'GET':
            $game_id = isset($_GET['game_id']) ? (int)$_GET['game_id'] : null;
            $pitcher_id = isset($_GET['pitcher_id']) ? (int)$_GET['pitcher_id'] : null;

            $sql = "SELECT gps.*, p.name as pitcher_name
                    FROM game_pitcher_stats gps
                    JOIN players p ON gps.pitcher_id = p.player_id";

            $conditions = [];
            $params = [];
            if ($game_id) {
                $conditions[] = "gps.game_id = :game_id";
                $params[':game_id'] = $game_id;
            }
            if ($pitcher_id) {
                $conditions[] = "gps.pitcher_id = :pitcher_id";
                $params[':pitcher_id'] = $pitcher_id;
            }
            if ($conditions) {
                $sql .= " WHERE " . implode(' AND ', $conditions);
            }
            $sql .= " ORDER BY gps.id ASC";

            $stmt = $db->prepare($sql);
            foreach ($params as $key => $val) {
                $stmt->bindValue($key, $val, PDO::PARAM_INT);
            }
            $stmt->execute();
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);

            if (!isset($data['game_id']) || !isset($data['pitcher_id'])) {
                http_response_code(400);
                echo json_encode(['error' => 'game_id and pitcher_id are required']);
                exit;
            }

            $sql = "INSERT INTO game_pitcher_stats (game_id, pitcher_id, team, innings_pitched, strikeouts, walks, runs_allowed, pitch_count)
                    VALUES (:game_id, :pitcher_id, :team, :innings_pitched, :strikeouts, :walks, :runs_allowed, :pitch_count)";

            $stmt = $db->prepare($sql);
            $stmt->bindValue(':game_id', $data['game_id'], PDO::PARAM_INT);
            $stmt->bindValue(':pitcher_id', $data['pitcher_id'], PDO::PARAM_INT);
            $stmt->bindValue(':team', $data['team'] ?? '', PDO::PARAM_STR);
            $stmt->bindValue(':innings_pitched', $data['innings_pitched'] ?? 0);
            $stmt->bindValue(':strikeouts', $data['strikeouts'] ?? 0, PDO::PARAM_INT);
            $stmt->bindValue(':walks', $data['walks'] ?? 0, PDO::PARAM_INT);
            $stmt->bindValue(':runs_allowed', $data['runs_allowed'] ?? 0, PDO::PARAM_INT);
            $stmt->bindValue(':pitch_count', $data['pitch_count'] ?? 0, PDO::PARAM_INT);
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
