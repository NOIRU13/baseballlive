<?php
require_once 'api/db.php';

try {
    $db = getDB();
    // Hanshin Tigers (ID 2)
    $sql = "INSERT INTO teams (team_id, team_name, team_code, league, short_name) 
            VALUES (2, '阪神タイガース', 'TIGERS', 'セントラル・リーグ', '阪神')
            ON DUPLICATE KEY UPDATE team_name = VALUES(team_name)";

    $stmt = $db->prepare($sql);
    $stmt->execute();

    echo "Team ID 2 (Tigers) inserted/updated successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
