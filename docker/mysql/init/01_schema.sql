-- ============================================
-- Baseball Live データベース初期化スクリプト
-- Docker用
-- ============================================

-- 文字コード設定
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ==========================================
-- テーブル定義
-- ==========================================

-- ゲーム状態テーブル（既存互換用）
CREATE TABLE IF NOT EXISTS game_state (
    id INT PRIMARY KEY DEFAULT 1,
    state_data JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT single_row CHECK (id = 1)
);

-- 初期データ投入（既存互換用）
INSERT IGNORE INTO game_state (id, state_data) VALUES (
    1,
    '{
        "teams": { "home": "ホーム", "away": "アウェイ" },
        "inning": { "number": 1, "half": "top" },
        "scores": { "home": [0,0,0,0,0,0,0,0,0,0], "away": [0,0,0,0,0,0,0,0,0,0] },
        "count": { "ball": 0, "strike": 0, "out": 0 },
        "runners": { "first": false, "second": false, "third": false },
        "stats": { "home": { "r": 0, "h": 0, "e": 0 }, "away": { "r": 0, "h": 0, "e": 0 } },
        "lineup": { "home": ["","","","","","","","",""], "away": ["","","","","","","","",""] }
    }'
);

-- チームテーブル
CREATE TABLE IF NOT EXISTS teams (
    team_id INT AUTO_INCREMENT PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL COMMENT 'チーム名',
    team_code VARCHAR(20) COMMENT 'チームコード',
    league VARCHAR(50) COMMENT 'リーグ',
    short_name VARCHAR(10) COMMENT '略称',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_team_code (team_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='チーム情報';

-- 選手テーブル
CREATE TABLE IF NOT EXISTS players (
    player_id INT AUTO_INCREMENT PRIMARY KEY,
    uniform_number VARCHAR(10) NOT NULL COMMENT '背番号',
    name VARCHAR(100) NOT NULL COMMENT '選手名',
    team_id INT NOT NULL COMMENT 'チームID',
    position VARCHAR(20) COMMENT 'ポジション',
    batting_side VARCHAR(10) COMMENT '打席 (右/左/両)',
    pitching_arm VARCHAR(10) COMMENT '投球腕 (右/左)',
    is_first_team BOOLEAN DEFAULT FALSE COMMENT '1軍選手フラグ',
    is_traded BOOLEAN DEFAULT FALSE COMMENT 'トレード選手フラグ',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_player (team_id, uniform_number),
    INDEX idx_team (team_id),
    INDEX idx_name (name),
    FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='選手基本情報';

-- 試合テーブル
CREATE TABLE IF NOT EXISTS games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    home_team_id INT NOT NULL,
    away_team_id INT NOT NULL,
    game_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    stadium VARCHAR(100),
    status VARCHAR(20) DEFAULT 'scheduled' COMMENT 'scheduled, live, finished',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (home_team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
    FOREIGN KEY (away_team_id) REFERENCES teams(team_id) ON DELETE CASCADE
);

-- 打席結果テーブル（詳細ログ）
CREATE TABLE IF NOT EXISTS at_bats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    batter_id INT NOT NULL COMMENT '打者ID',
    pitcher_id INT COMMENT '投手ID',
    inning INT NOT NULL,
    half VARCHAR(10) NOT NULL COMMENT 'top/bottom',
    result_type VARCHAR(20) NOT NULL COMMENT 'Single, Double, Triple, HR, Walk, HBP, Strikeout, Groundout, Flyout, etc.',
    rbi INT DEFAULT 0 COMMENT '打点',
    is_sac_fly BOOLEAN DEFAULT FALSE COMMENT '犠飛フラグ',
    is_sac_bunt BOOLEAN DEFAULT FALSE COMMENT '犠打フラグ',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (batter_id) REFERENCES players(player_id),
    FOREIGN KEY (pitcher_id) REFERENCES players(player_id)
);

-- 打撃成績テーブル
CREATE TABLE IF NOT EXISTS batting_stats (
    stat_id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL COMMENT '選手ID',
    season YEAR NOT NULL COMMENT 'シーズン年',
    batting_average DECIMAL(4,3) COMMENT '打率',
    games INT DEFAULT 0 COMMENT '試合数',
    plate_appearances INT DEFAULT 0 COMMENT '打席',
    at_bats INT DEFAULT 0 COMMENT '打数',
    runs INT DEFAULT 0 COMMENT '得点',
    hits INT DEFAULT 0 COMMENT '安打',
    doubles INT DEFAULT 0 COMMENT '二塁打',
    triples INT DEFAULT 0 COMMENT '三塁打',
    home_runs INT DEFAULT 0 COMMENT '本塁打',
    total_bases INT DEFAULT 0 COMMENT '塁打',
    rbis INT DEFAULT 0 COMMENT '打点',
    strikeouts INT DEFAULT 0 COMMENT '三振',
    walks INT DEFAULT 0 COMMENT '四球',
    hit_by_pitch INT DEFAULT 0 COMMENT '死球',
    sacrifice_hits INT DEFAULT 0 COMMENT '犠打',
    sacrifice_flies INT DEFAULT 0 COMMENT '犠飛',
    stolen_bases INT DEFAULT 0 COMMENT '盗塁',
    on_base_percentage DECIMAL(4,3) COMMENT '出塁率',
    slugging_percentage DECIMAL(4,3) COMMENT '長打率',
    ops DECIMAL(4,3) COMMENT 'OPS',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
    UNIQUE KEY unique_batting_stat (player_id, season),
    INDEX idx_season (season)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打撃成績';

-- 投手成績テーブル
CREATE TABLE IF NOT EXISTS pitching_stats (
    stat_id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL COMMENT '選手ID',
    season YEAR NOT NULL COMMENT 'シーズン年',
    era DECIMAL(4,2) COMMENT '防御率',
    games INT DEFAULT 0 COMMENT '試合数',
    games_started INT DEFAULT 0 COMMENT '先発',
    wins INT DEFAULT 0 COMMENT '勝利',
    losses INT DEFAULT 0 COMMENT '敗戦',
    holds INT DEFAULT 0 COMMENT 'ホールド',
    saves INT DEFAULT 0 COMMENT 'セーブ',
    innings_pitched DECIMAL(5,1) COMMENT '投球回',
    strikeouts INT DEFAULT 0 COMMENT '三振',
    walks INT DEFAULT 0 COMMENT '四球',
    hits_allowed INT DEFAULT 0 COMMENT '被安打',
    home_runs_allowed INT DEFAULT 0 COMMENT '被本塁打',
    runs_allowed INT DEFAULT 0 COMMENT '失点',
    earned_runs INT DEFAULT 0 COMMENT '自責点',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
    UNIQUE KEY unique_pitching_stat (player_id, season),
    INDEX idx_season (season)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='投手成績';

-- ==========================================
-- 初期データ投入
-- ==========================================

-- チームデータ
INSERT INTO teams (team_id, team_name, team_code, league, short_name) VALUES 
(1, '東北楽天ゴールデンイーグルス', 'EAGLES', 'パシフィック・リーグ', '楽天'),
(2, '阪神タイガース', 'TIGERS', 'セントラル・リーグ', '阪神'),
(3, '読売ジャイアンツ', 'GIANTS', 'セントラル・リーグ', '巨人'),
(4, '侍ジャパン', 'SAMURAI', '日本代表', '侍')
ON DUPLICATE KEY UPDATE team_name = VALUES(team_name);

-- 侍ジャパン 投手（14名）
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
('4', '石井大智', 4, 'P', '右', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 侍ジャパン 捕手（3名）
INSERT INTO players (uniform_number, name, team_id, position, batting_side, is_first_team) VALUES
('12', '若月健矢', 4, 'C', '右', TRUE),
('27', '坂本誠志郎', 4, 'C', '右', TRUE),
('2', '中村悠平', 4, 'C', '右', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 侍ジャパン 内野手（7名）
INSERT INTO players (uniform_number, name, team_id, position, batting_side, is_first_team) VALUES
('3', '牧秀悟', 4, '2B', '右', TRUE),
('5', '小園海斗', 4, 'SS', '左', TRUE),
('6', '牧原大成', 4, '2B', '右', TRUE),
('7', '源田壮亮', 4, 'SS', '右', TRUE),
('25', '佐藤輝明', 4, '3B', '右', TRUE),
('55', '岡本和真', 4, '1B', '右', TRUE),
('8', '村上宗隆', 4, '3B', '左', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 侍ジャパン 外野手（5名）
INSERT INTO players (uniform_number, name, team_id, position, batting_side, is_first_team) VALUES
('20', '近藤健介', 4, 'LF', '左', TRUE),
('23', '周東佑京', 4, 'CF', '左', TRUE),
('34', '森下翔太', 4, 'RF', '右', TRUE),
('51', '吉田正尚', 4, 'LF', '左', TRUE),
('16', '鈴木誠也', 4, 'RF', '右', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 侍ジャパン 指名打者（1名）
INSERT INTO players (uniform_number, name, team_id, position, batting_side, pitching_arm, is_first_team) VALUES
('1', '大谷翔平', 4, 'DH', '左', '右', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- サンプル試合
INSERT INTO games (home_team_id, away_team_id, status) VALUES (1, 4, 'live');

SELECT '初期データ投入完了' AS message;
SELECT COUNT(*) AS '登録チーム数' FROM teams;
SELECT COUNT(*) AS '登録選手数' FROM players;
