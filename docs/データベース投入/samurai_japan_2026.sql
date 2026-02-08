-- ============================================
-- 侍ジャパン 2026年メンバー データ
-- 発表日: 2026年2月6日
-- ============================================

-- チーム「侍ジャパン」を登録
INSERT INTO teams (team_id, team_name, team_code, league) 
VALUES (4, '侍ジャパン', 'SAMURAI', '日本代表')
ON DUPLICATE KEY UPDATE team_name = VALUES(team_name);

-- 投手（14名）
INSERT INTO players (uniform_number, name, team_id, position, pitching_arm, is_first_team) VALUES
('13', '松井裕樹', 4, 'P', '右', TRUE),
('14', '宮城大弥', 4, 'P', '左', TRUE),
('15', '伊藤大海', 4, 'P', '右', TRUE),
('17', '大勢', 4, 'P', '右', TRUE),
('18', '菊池雄星', 4, 'P', '左', TRUE),
('19', '山本由伸', 4, 'P', '右', TRUE),
('26', '菅野智之', 4, 'P', '右', TRUE),
('28', '種市篤暉', 4, 'P', '右', TRUE),
('47', '髙橋宏斗', 4, 'P', '右', TRUE),
('57', '曽谷龍平', 4, 'P', '右', TRUE),
('61', '北山亘基', 4, 'P', '左', TRUE),
('66', '平良海馬', 4, 'P', '右', TRUE),
('69', '松本裕樹', 4, 'P', '左', TRUE),
('4', '石井大智', 4, 'P', '右', TRUE);

-- 捕手（3名）
INSERT INTO players (uniform_number, name, team_id, position, batting_side, is_first_team) VALUES
('12', '若月健矢', 4, 'C', '右', TRUE),
('27', '坂本誠志郎', 4, 'C', '右', TRUE),
('2', '中村悠平', 4, 'C', '右', TRUE);

-- 内野手（7名）
INSERT INTO players (uniform_number, name, team_id, position, batting_side, is_first_team) VALUES
('3', '牧秀悟', 4, '2B', '右', TRUE),
('5', '小園海斗', 4, 'SS', '左', TRUE),
('6', '牧原大成', 4, '2B', '右', TRUE),
('7', '源田壮亮', 4, 'SS', '右', TRUE),
('25', '佐藤輝明', 4, '3B', '右', TRUE),
('55', '岡本和真', 4, '1B', '右', TRUE),
('8', '村上宗隆', 4, '3B', '左', TRUE);

-- 外野手（5名）
INSERT INTO players (uniform_number, name, team_id, position, batting_side, is_first_team) VALUES
('20', '近藤健介', 4, 'LF', '左', TRUE),
('23', '周東佑京', 4, 'CF', '左', TRUE),
('34', '森下翔太', 4, 'RF', '右', TRUE),
('51', '吉田正尚', 4, 'LF', '左', TRUE),
('16', '鈴木誠也', 4, 'RF', '右', TRUE);

-- 指名打者（1名）
INSERT INTO players (uniform_number, name, team_id, position, batting_side, pitching_arm, is_first_team) VALUES
('1', '大谷翔平', 4, 'DH', '左', '右', TRUE);

-- 登録完了メッセージ
SELECT '侍ジャパン 2026年メンバー 30名の登録が完了しました' AS message;
SELECT COUNT(*) AS '登録選手数' FROM players WHERE team_id = 4;
