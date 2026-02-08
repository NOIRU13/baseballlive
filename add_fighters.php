<?php
require_once 'api/db.php';

try {
    $db = getDB();
    $sql = "INSERT INTO teams (team_id, team_name, team_code, league, short_name) 
            VALUES (5, '北海道日本ハムファイターズ', 'FIGHTERS', 'パシフィック・リーグ', '日本ハム')
            ON DUPLICATE KEY UPDATE team_name = VALUES(team_name)";

    $stmt = $db->prepare($sql);
    $stmt->execute();

    echo "Team ID 5 (Fighters) inserted/updated successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
