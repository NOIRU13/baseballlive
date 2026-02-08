-- 野球スコアボード データベース初期化スクリプト

-- ゲーム状態テーブル
CREATE TABLE IF NOT EXISTS game_state (
    id INT PRIMARY KEY DEFAULT 1,
    state_data JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT single_row CHECK (id = 1)
);

-- 初期データ投入
INSERT INTO game_state (id, state_data) VALUES (
    1,
    '{
        "teams": {
            "home": "ホーム",
            "away": "アウェイ"
        },
        "inning": {
            "number": 1,
            "half": "top"
        },
        "scores": {
            "home": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            "away": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        "count": {
            "ball": 0,
            "strike": 0,
            "out": 0
        },
        "runners": {
            "first": false,
            "second": false,
            "third": false
        },
        "stats": {
            "home": { "r": 0, "h": 0, "e": 0 },
            "away": { "r": 0, "h": 0, "e": 0 }
        },
        "lineup": {
            "home": ["", "", "", "", "", "", "", "", ""],
            "away": ["", "", "", "", "", "", "", "", ""]
        },
        "currentBatter": {
            "home": 0,
            "away": 0
        },
        "atBatResults": {
            "home": [[], [], [], [], [], [], [], [], []],
            "away": [[], [], [], [], [], [], [], [], []]
        },
        "resultHistory": []
    }'
) ON DUPLICATE KEY UPDATE id = id;
