-- ============================================
-- BaseballLive データベーススキーマ
-- 作成日: 2026-02-08
-- ============================================

-- 選手基本情報テーブル
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
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='選手基本情報';

-- 打撃成績テーブル
CREATE TABLE IF NOT EXISTS batting_stats (
    stat_id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL COMMENT '選手ID',
    season YEAR NOT NULL COMMENT 'シーズン年',
    
    -- 基本打撃成績
    batting_average DECIMAL(4,3) COMMENT '打率',
    games INT DEFAULT 0 COMMENT '試合数',
    plate_appearances INT DEFAULT 0 COMMENT '打席',
    at_bats INT DEFAULT 0 COMMENT '打数',
    runs INT DEFAULT 0 COMMENT '得点',
    hits INT DEFAULT 0 COMMENT '安打',
    infield_hits INT DEFAULT 0 COMMENT '内野安打',
    infield_hit_rate DECIMAL(4,1) COMMENT '内安率(%)',
    doubles INT DEFAULT 0 COMMENT '二塁打',
    triples INT DEFAULT 0 COMMENT '三塁打',
    home_runs INT DEFAULT 0 COMMENT '本塁打',
    hr_record VARCHAR(20) COMMENT 'HR勝敗記録',
    total_bases INT DEFAULT 0 COMMENT '塁打',
    rbis INT DEFAULT 0 COMMENT '打点',
    strikeouts INT DEFAULT 0 COMMENT '三振',
    walks INT DEFAULT 0 COMMENT '四球',
    intentional_walks INT DEFAULT 0 COMMENT '敬遠',
    hit_by_pitch INT DEFAULT 0 COMMENT '死球',
    sacrifice_hits INT DEFAULT 0 COMMENT '犠打',
    sacrifice_flies INT DEFAULT 0 COMMENT '犠飛',
    stolen_bases INT DEFAULT 0 COMMENT '盗塁',
    caught_stealing INT DEFAULT 0 COMMENT '盗塁死',
    stolen_base_percentage DECIMAL(4,1) COMMENT '盗塁成功率(%)',
    errors INT DEFAULT 0 COMMENT '失策',
    passed_balls INT DEFAULT 0 COMMENT '捕逸',
    double_plays INT DEFAULT 0 COMMENT '併殺打',
    risp_average DECIMAL(4,3) COMMENT '得点圏打率',
    on_base_percentage DECIMAL(4,3) COMMENT '出塁率',
    slugging_percentage DECIMAL(4,3) COMMENT '長打率',
    ops DECIMAL(4,3) COMMENT 'OPS',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
    UNIQUE KEY unique_batting_stat (player_id, season),
    INDEX idx_season (season),
    INDEX idx_batting_avg (batting_average)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打撃成績';

-- 投手成績テーブル
CREATE TABLE IF NOT EXISTS pitching_stats (
    stat_id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL COMMENT '選手ID',
    season YEAR NOT NULL COMMENT 'シーズン年',
    
    -- 基本投手成績
    last_pitched_date DATE COMMENT '最終登板日',
    era DECIMAL(4,2) COMMENT '防御率',
    games INT DEFAULT 0 COMMENT '試合数',
    games_started INT DEFAULT 0 COMMENT '先発',
    relief_appearances INT DEFAULT 0 COMMENT '救援',
    consecutive_games INT DEFAULT 0 COMMENT '連投(試)',
    consecutive_days INT DEFAULT 0 COMMENT '連投(日)',
    wins INT DEFAULT 0 COMMENT '勝利',
    losses INT DEFAULT 0 COMMENT '敗戦',
    holds INT DEFAULT 0 COMMENT 'ホールド',
    saves INT DEFAULT 0 COMMENT 'セーブ',
    hold_points INT DEFAULT 0 COMMENT 'HP',
    save_points INT DEFAULT 0 COMMENT 'SP',
    relief_wins INT DEFAULT 0 COMMENT '救勝',
    relief_losses INT DEFAULT 0 COMMENT '救敗',
    complete_games INT DEFAULT 0 COMMENT '完投',
    shutouts INT DEFAULT 0 COMMENT '完封',
    no_walks INT DEFAULT 0 COMMENT '無四球',
    win_percentage DECIMAL(4,3) COMMENT '勝率',
    innings_pitched DECIMAL(5,1) COMMENT '投球回',
    batters_faced INT DEFAULT 0 COMMENT '被打者',
    pitches_thrown INT DEFAULT 0 COMMENT '投球数',
    pitches_per_inning DECIMAL(4,1) COMMENT '球数/回',
    hits_allowed INT DEFAULT 0 COMMENT '被安打',
    home_runs_allowed INT DEFAULT 0 COMMENT '被本塁打',
    strikeouts INT DEFAULT 0 COMMENT '三振',
    walks INT DEFAULT 0 COMMENT '四球',
    intentional_walks INT DEFAULT 0 COMMENT '故意四球',
    hit_batsmen INT DEFAULT 0 COMMENT '死球',
    wild_pitches INT DEFAULT 0 COMMENT '暴投',
    balks INT DEFAULT 0 COMMENT 'ボーク',
    runs_allowed INT DEFAULT 0 COMMENT '失点',
    earned_runs INT DEFAULT 0 COMMENT '自責点',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
    UNIQUE KEY unique_pitching_stat (player_id, season),
    INDEX idx_season (season),
    INDEX idx_era (era)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='投手成績';

-- チームテーブル (既存のteamsテーブルがあれば不要)
CREATE TABLE IF NOT EXISTS teams (
    team_id INT AUTO_INCREMENT PRIMARY KEY,
    team_name VARCHAR(100) NOT NULL COMMENT 'チーム名',
    team_code VARCHAR(20) COMMENT 'チームコード',
    league VARCHAR(50) COMMENT 'リーグ',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_team_code (team_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='チーム情報';

-- 楽天イーグルスのチームデータ挿入
INSERT INTO teams (team_id, team_name, team_code, league) 
VALUES (1, '東北楽天ゴールデンイーグルス', 'EAGLES', 'パシフィック・リーグ')
ON DUPLICATE KEY UPDATE team_name = VALUES(team_name);
