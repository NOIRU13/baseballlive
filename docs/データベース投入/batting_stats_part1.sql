-- ============================================
-- 楽天イーグルス 2025シーズン 打撃成績データ
-- ============================================

-- 打撃成績データ投入（野手）
INSERT INTO batting_stats (player_id, season, batting_average, games, plate_appearances, at_bats, runs, hits, infield_hits, infield_hit_rate, doubles, triples, home_runs, hr_record, total_bases, rbis, strikeouts, walks, intentional_walks, hit_by_pitch, sacrifice_hits, sacrifice_flies, stolen_bases, caught_stealing, stolen_base_percentage, errors, passed_balls, double_plays, risp_average, on_base_percentage, slugging_percentage, ops)
SELECT p.player_id, 2025, 0.217, 124, 357, 299, 36, 65, 9, 13.8, 5, 2, 1, '1-0-0', 77, 14, 65, 40, 0, 1, 16, 1, 28, 8, 77.8, 4, 0, 1, 0.134, 0.311, 0.258, 0.568 FROM players p WHERE p.uniform_number = '0' AND p.team_id = 1
UNION ALL
SELECT p.player_id, 2025, 0.260, 122, 460, 430, 32, 112, 8, 7.1, 19, 3, 3, '2-1-0', 146, 27, 82, 20, 2, 1, 0, 9, 7, 0, 100.0, 12, 0, 10, 0.207, 0.289, 0.340, 0.629 FROM players p WHERE p.uniform_number = '1' AND p.team_id = 1
UNION ALL
SELECT p.player_id, 2025, 0.176, 111, 231, 188, 14, 33, 1, 3.0, 7, 2, 1, '1-0-0', 47, 12, 47, 23, 0, 5, 14, 1, 0, 0, NULL, 0, 6, 6, 0.182, 0.281, 0.250, 0.531 FROM players p WHERE p.uniform_number = '2' AND p.team_id = 1
UNION ALL
SELECT p.player_id, 2025, 0.239, 96, 389, 331, 27, 79, 6, 7.6, 13, 1, 9, '7-2-0', 121, 34, 81, 51, 4, 6, 0, 1, 1, 0, 100.0, 8, 0, 11, 0.225, 0.350, 0.366, 0.715 FROM players p WHERE p.uniform_number = '3' AND p.team_id = 1
UNION ALL
SELECT p.player_id, 2025, 0.219, 43, 129, 105, 11, 23, 2, 8.7, 5, 1, 3, '3-0-0', 39, 8, 31, 22, 0, 0, 1, 1, 1, 1, 50.0, 1, 0, 1, 0.200, 0.352, 0.371, 0.723 FROM players p WHERE p.uniform_number = '4' AND p.team_id = 1
UNION ALL
SELECT p.player_id, 2025, 0.281, 137, 557, 513, 41, 144, 17, 11.8, 14, 0, 3, '1-2-0', 167, 51, 102, 28, 2, 3, 10, 3, 6, 2, 75.0, 10, 0, 14, 0.355, 0.320, 0.326, 0.645 FROM players p WHERE p.uniform_number = '6' AND p.team_id = 1
UNION ALL
SELECT p.player_id, 2025, 0.238, 93, 198, 172, 13, 41, 4, 9.8, 3, 2, 2, '1-1-0', 54, 23, 29, 13, 1, 11, 1, 1, 1, 0, 100.0, 1, 0, 5, 0.259, 0.330, 0.314, 0.644 FROM players p WHERE p.uniform_number = '7' AND p.team_id = 1
UNION ALL
SELECT p.player_id, 2025, 0.240, 114, 422, 367, 36, 88, 8, 9.1, 12, 2, 7, '5-2-0', 125, 32, 91, 40, 0, 9, 1, 5, 20, 0, 100.0, 1, 0, 12, 0.179, 0.325, 0.341, 0.666 FROM players p WHERE p.uniform_number = '8' AND p.team_id = 1;
