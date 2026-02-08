<?php
// CSVインポートAPI
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'db.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('POSTメソッドのみ許可されています');
    }

    if (!isset($_FILES['csv']) || $_FILES['csv']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('CSVファイルのアップロードに失敗しました');
    }

    $type = isset($_POST['type']) ? $_POST['type'] : '';
    if (!in_array($type, ['players', 'batting', 'pitching'])) {
        throw new Exception('無効なデータ種類です');
    }

    $db = getDB();
    $db->beginTransaction();

    $file = fopen($_FILES['csv']['tmp_name'], 'r');
    $header = fgetcsv($file); // ヘッダー行をスキップ
    $count = 0;

    switch ($type) {
        case 'players':
            // 選手基本情報インポート
            // CSV形式: team_id, name, number, position, hand
            while (($row = fgetcsv($file)) !== false) {
                if (count($row) < 5)
                    continue;

                $sql = "INSERT INTO players (team_id, name, number, position, hand) 
                        VALUES (:team_id, :name, :number, :position, :hand)
                        ON DUPLICATE KEY UPDATE 
                        name = VALUES(name), 
                        position = VALUES(position), 
                        hand = VALUES(hand)";

                $stmt = $db->prepare($sql);
                $stmt->bindParam(':team_id', $row[0], PDO::PARAM_INT);
                $stmt->bindParam(':name', $row[1]);
                $stmt->bindParam(':number', $row[2]);
                $stmt->bindParam(':position', $row[3]);
                $stmt->bindParam(':hand', $row[4]);
                $stmt->execute();
                $count++;
            }
            break;

        case 'batting':
            // 打撃成績インポート
            // CSV形式: player_id, season, batting_average, games, at_bats, hits, home_runs, rbis, ops
            while (($row = fgetcsv($file)) !== false) {
                if (count($row) < 9)
                    continue;

                $sql = "INSERT INTO batting_stats 
                        (player_id, season, batting_average, games, at_bats, hits, home_runs, rbis, ops) 
                        VALUES (:player_id, :season, :batting_average, :games, :at_bats, :hits, :home_runs, :rbis, :ops)
                        ON DUPLICATE KEY UPDATE 
                        batting_average = VALUES(batting_average),
                        games = VALUES(games),
                        at_bats = VALUES(at_bats),
                        hits = VALUES(hits),
                        home_runs = VALUES(home_runs),
                        rbis = VALUES(rbis),
                        ops = VALUES(ops)";

                $stmt = $db->prepare($sql);
                $stmt->bindParam(':player_id', $row[0], PDO::PARAM_INT);
                $stmt->bindParam(':season', $row[1], PDO::PARAM_INT);
                $stmt->bindParam(':batting_average', $row[2]);
                $stmt->bindParam(':games', $row[3], PDO::PARAM_INT);
                $stmt->bindParam(':at_bats', $row[4], PDO::PARAM_INT);
                $stmt->bindParam(':hits', $row[5], PDO::PARAM_INT);
                $stmt->bindParam(':home_runs', $row[6], PDO::PARAM_INT);
                $stmt->bindParam(':rbis', $row[7], PDO::PARAM_INT);
                $stmt->bindParam(':ops', $row[8]);
                $stmt->execute();
                $count++;
            }
            break;

        case 'pitching':
            // 投手成績インポート
            // CSV形式: player_id, season, era, games, wins, losses, saves, innings_pitched, strikeouts
            while (($row = fgetcsv($file)) !== false) {
                if (count($row) < 9)
                    continue;

                $sql = "INSERT INTO pitching_stats 
                        (player_id, season, era, games, wins, losses, saves, innings_pitched, strikeouts) 
                        VALUES (:player_id, :season, :era, :games, :wins, :losses, :saves, :innings_pitched, :strikeouts)
                        ON DUPLICATE KEY UPDATE 
                        era = VALUES(era),
                        games = VALUES(games),
                        wins = VALUES(wins),
                        losses = VALUES(losses),
                        saves = VALUES(saves),
                        innings_pitched = VALUES(innings_pitched),
                        strikeouts = VALUES(strikeouts)";

                $stmt = $db->prepare($sql);
                $stmt->bindParam(':player_id', $row[0], PDO::PARAM_INT);
                $stmt->bindParam(':season', $row[1], PDO::PARAM_INT);
                $stmt->bindParam(':era', $row[2]);
                $stmt->bindParam(':games', $row[3], PDO::PARAM_INT);
                $stmt->bindParam(':wins', $row[4], PDO::PARAM_INT);
                $stmt->bindParam(':losses', $row[5], PDO::PARAM_INT);
                $stmt->bindParam(':saves', $row[6], PDO::PARAM_INT);
                $stmt->bindParam(':innings_pitched', $row[7]);
                $stmt->bindParam(':strikeouts', $row[8], PDO::PARAM_INT);
                $stmt->execute();
                $count++;
            }
            break;
    }

    fclose($file);
    $db->commit();

    echo json_encode(['success' => true, 'count' => $count]);

} catch (Exception $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
