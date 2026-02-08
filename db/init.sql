-- 野球スコアボード データベース初期化スクリプト

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

-- ==========================================
-- 新スキーマ定義
-- ==========================================

-- チームテーブル
CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL COMMENT 'チーム名',
    short_name VARCHAR(10) COMMENT '略称',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 選手テーブル
CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    name VARCHAR(50) NOT NULL COMMENT '選手名',
    number INT COMMENT '背番号',
    position VARCHAR(10) COMMENT '守備位置',
    hand VARCHAR(10) COMMENT '投打 (例: 右投左打)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- 試合テーブル
CREATE TABLE IF NOT EXISTS games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    home_team_id INT NOT NULL,
    away_team_id INT NOT NULL,
    game_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    stadium VARCHAR(100),
    status VARCHAR(20) DEFAULT 'scheduled' COMMENT 'scheduled, live, finished',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (home_team_id) REFERENCES teams(id),
    FOREIGN KEY (away_team_id) REFERENCES teams(id)
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
    FOREIGN KEY (batter_id) REFERENCES players(id),
    FOREIGN KEY (pitcher_id) REFERENCES players(id)
);

-- 投手成績サマリー（イニングごとまたは試合ごとの集計）
CREATE TABLE IF NOT EXISTS pitching_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    pitcher_id INT NOT NULL,
    innings_pitched DECIMAL(4, 1) DEFAULT 0.0 COMMENT '投球回 (例: 1.0, 1.1, 1.2)',
    hits_allowed INT DEFAULT 0,
    runs_allowed INT DEFAULT 0,
    earned_runs INT DEFAULT 0,
    strikeouts INT DEFAULT 0,
    walks INT DEFAULT 0,
    home_runs_allowed INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (pitcher_id) REFERENCES players(id)
);

-- サンプルデータ投入
INSERT INTO teams (name, short_name) VALUES ('Tigers', '阪神'), ('Giants', '巨人');
INSERT INTO players (team_id, name, number, position) VALUES 
(1, '近本', 5, 'CF'), (1, '中野', 51, '2B'), (1, '森下', 1, 'RF'), (1, '佐藤輝', 8, '3B'),
(2, '吉川', 2, '2B'), (2, '坂本', 6, 'SS'), (2, '岡本', 25, '3B'), (2, '戸郷', 20, 'P');

-- サンプル試合
INSERT INTO games (home_team_id, away_team_id, status) VALUES (1, 2, 'live');
