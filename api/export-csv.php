<?php
// CSVエクスポートAPI
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'db.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        throw new Exception('GETメソッドのみ許可されています');
    }

    $type = isset($_GET['type']) ? $_GET['type'] : '';
    if (!in_array($type, ['players', 'batting', 'pitching'])) {
        throw new Exception('無効なデータ種類です');
    }

    $db = getDB();

    // CSVヘッダーを設定
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $type . '_' . date('Y-m-d') . '.csv"');

    $output = fopen('php://output', 'w');

    // BOM追加（Excel対応）
    fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));

    switch ($type) {
        case 'players':
            // 選手基本情報エクスポート
            fputcsv($output, ['選手ID', 'チームID', '選手名', '背番号', 'ポジション', '投打']);

            $sql = "SELECT player_id, team_id, name, uniform_number, position, batting_side FROM players ORDER BY team_id, uniform_number";
            $stmt = $db->query($sql);

            while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
                fputcsv($output, $row);
            }
            break;

        case 'batting':
            // 打撃成績エクスポート
            fputcsv($output, [
                '成績ID',
                '選手ID',
                '選手名',
                'シーズン',
                '打率',
                '試合',
                '打数',
                '安打',
                '本塁打',
                '打点',
                'OPS'
            ]);

            $sql = "SELECT bs.stat_id, bs.player_id, p.name, bs.season, bs.batting_average, 
                           bs.games, bs.at_bats, bs.hits, bs.home_runs, bs.rbis, bs.ops
                    FROM batting_stats bs
                    JOIN players p ON bs.player_id = p.player_id
                    ORDER BY bs.season DESC, p.name";
            $stmt = $db->query($sql);

            while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
                fputcsv($output, $row);
            }
            break;

        case 'pitching':
            // 投手成績エクスポート
            fputcsv($output, [
                '成績ID',
                '選手ID',
                '選手名',
                'シーズン',
                '防御率',
                '試合',
                '勝利',
                '敗戦',
                'セーブ',
                '投球回',
                '奪三振'
            ]);

            $sql = "SELECT ps.stat_id, ps.player_id, p.name, ps.season, ps.era, 
                           ps.games, ps.wins, ps.losses, ps.saves, ps.innings_pitched, ps.strikeouts
                    FROM pitching_stats ps
                    JOIN players p ON ps.player_id = p.player_id
                    ORDER BY ps.season DESC, p.name";
            $stmt = $db->query($sql);

            while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
                fputcsv($output, $row);
            }
            break;
    }

    fclose($output);

} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $e->getMessage()]);
}
