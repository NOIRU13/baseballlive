/**
 * 野球スコアボード APIサーバー
 * Express + MySQL2
 */

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(cors());
app.use(express.json());

// MySQL接続設定
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'baseball',
    password: process.env.DB_PASSWORD || 'baseball123',
    database: process.env.DB_NAME || 'baseball_live',
    waitForConnections: true,
    connectionLimit: 10
};

// コネクションプール
let pool;

/**
 * データベース接続を初期化
 */
async function initDatabase() {
    try {
        pool = mysql.createPool(dbConfig);
        // 接続テスト
        const connection = await pool.getConnection();
        console.log('✅ MySQL に接続しました');
        connection.release();
    } catch (error) {
        console.error('❌ MySQL 接続エラー:', error.message);
        // リトライ
        setTimeout(initDatabase, 5000);
    }
}

// ==================== API エンドポイント ====================

/**
 * GET /api/state - 現在のゲーム状態を取得
 */
app.get('/api/state', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT state_data, updated_at FROM game_state WHERE id = 1'
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'データが見つかりません' });
        }
        
        res.json({
            state: rows[0].state_data,
            updatedAt: rows[0].updated_at
        });
    } catch (error) {
        console.error('GET /api/state エラー:', error);
        res.status(500).json({ error: 'サーバーエラー' });
    }
});

/**
 * PUT /api/state - ゲーム状態を更新
 */
app.put('/api/state', async (req, res) => {
    try {
        const { state } = req.body;
        
        if (!state) {
            return res.status(400).json({ error: 'state が必要です' });
        }
        
        await pool.execute(
            'UPDATE game_state SET state_data = ? WHERE id = 1',
            [JSON.stringify(state)]
        );
        
        res.json({ success: true, message: '更新しました' });
    } catch (error) {
        console.error('PUT /api/state エラー:', error);
        res.status(500).json({ error: 'サーバーエラー' });
    }
});

/**
 * POST /api/state/reset - ゲーム状態をリセット
 */
app.post('/api/state/reset', async (req, res) => {
    try {
        const defaultState = {
            teams: { home: 'ホーム', away: 'アウェイ' },
            inning: { number: 1, half: 'top' },
            scores: {
                home: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                away: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            },
            count: { ball: 0, strike: 0, out: 0 },
            runners: { first: false, second: false, third: false },
            stats: {
                home: { r: 0, h: 0, e: 0 },
                away: { r: 0, h: 0, e: 0 }
            },
            lineup: {
                home: ['', '', '', '', '', '', '', '', ''],
                away: ['', '', '', '', '', '', '', '', '']
            },
            currentBatter: { home: 0, away: 0 },
            atBatResults: {
                home: [[], [], [], [], [], [], [], [], []],
                away: [[], [], [], [], [], [], [], [], []]
            },
            resultHistory: []
        };
        
        await pool.execute(
            'UPDATE game_state SET state_data = ? WHERE id = 1',
            [JSON.stringify(defaultState)]
        );
        
        res.json({ success: true, state: defaultState });
    } catch (error) {
        console.error('POST /api/state/reset エラー:', error);
        res.status(500).json({ error: 'サーバーエラー' });
    }
});

// ==================== チーム管理 API ====================

/**
 * GET /api/teams - チーム一覧取得
 */
app.get('/api/teams', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM teams ORDER BY id ASC');
        res.json(rows);
    } catch (error) {
        console.error('GET /api/teams エラー:', error);
        res.status(500).json({ error: 'サーバーエラー' });
    }
});

/**
 * POST /api/teams - チーム作成
 */
app.post('/api/teams', async (req, res) => {
    try {
        const { name, short_name } = req.body;
        if (!name) return res.status(400).json({ error: 'チーム名は必須です' });

        const [result] = await pool.execute(
            'INSERT INTO teams (name, short_name) VALUES (?, ?)',
            [name, short_name]
        );
        res.status(201).json({ id: result.insertId, name, short_name });
    } catch (error) {
        console.error('POST /api/teams エラー:', error);
        res.status(500).json({ error: 'サーバーエラー' });
    }
});

/**
 * PUT /api/teams/:id - チーム更新
 */
app.put('/api/teams/:id', async (req, res) => {
    try {
        const { name, short_name } = req.body;
        const { id } = req.params;
        
        await pool.execute(
            'UPDATE teams SET name = ?, short_name = ? WHERE id = ?',
            [name, short_name, id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('PUT /api/teams/:id エラー:', error);
        res.status(500).json({ error: 'サーバーエラー' });
    }
});

/**
 * DELETE /api/teams/:id - チーム削除
 */
app.delete('/api/teams/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM teams WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/teams/:id エラー:', error);
        res.status(500).json({ error: 'サーバーエラー' });
    }
});

// ==================== 選手管理 API ====================

/**
 * GET /api/players - 選手一覧取得 (クエリパラメータ team_id でフィルタ可)
 */
app.get('/api/players', async (req, res) => {
    try {
        const { team_id } = req.query;
        let query = 'SELECT p.*, t.name as team_name FROM players p JOIN teams t ON p.team_id = t.id';
        const params = [];

        if (team_id) {
            query += ' WHERE p.team_id = ?';
            params.push(team_id);
        }
        
        query += ' ORDER BY p.team_id ASC, p.number ASC';

        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('GET /api/players エラー:', error);
        res.status(500).json({ error: 'サーバーエラー' });
    }
});

/**
 * POST /api/players - 選手作成
 */
app.post('/api/players', async (req, res) => {
    try {
        const { team_id, name, number, position, hand } = req.body;
        if (!team_id || !name) return res.status(400).json({ error: 'チームIDと選手名は必須です' });

        const [result] = await pool.execute(
            'INSERT INTO players (team_id, name, number, position, hand) VALUES (?, ?, ?, ?, ?)',
            [team_id, name, number, position, hand]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('POST /api/players エラー:', error);
        res.status(500).json({ error: 'サーバーエラー' });
    }
});

/**
 * PUT /api/players/:id - 選手更新
 */
app.put('/api/players/:id', async (req, res) => {
    try {
        const { team_id, name, number, position, hand } = req.body;
        const { id } = req.params;

        await pool.execute(
            'UPDATE players SET team_id = ?, name = ?, number = ?, position = ?, hand = ? WHERE id = ?',
            [team_id, name, number, position, hand, id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('PUT /api/players/:id エラー:', error);
        res.status(500).json({ error: 'サーバーエラー' });
    }
});

/**
 * DELETE /api/players/:id - 選手削除
 */
app.delete('/api/players/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM players WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/players/:id エラー:', error);
        res.status(500).json({ error: 'サーバーエラー' });
    }
});

// ==================== 打席結果登録 API ====================

/**
 * POST /api/atbats - 打席結果登録
 */
app.post('/api/atbats', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const {
            game_id,
            batter_id,
            pitcher_id,
            inning,
            half,
            result_type,
            rbi,
            is_sac_fly,
            is_sac_bunt
        } = req.body;

        // 1. 打席結果テーブルに記録
        const [result] = await connection.execute(
            `INSERT INTO at_bats 
            (game_id, batter_id, pitcher_id, inning, half, result_type, rbi, is_sac_fly, is_sac_bunt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [game_id, batter_id, pitcher_id, inning, half, result_type, rbi || 0, is_sac_fly || false, is_sac_bunt || false]
        );

        // 2. 投手成績サマリーの更新（簡易的実装: 詳細はより複雑なロジックが必要だが、ここでは加算のみ）
        // NOTE: イニング途中での登板交代などを考慮すると複雑になるため、
        // ここでは「その打席の結果」を投手に加算する形にする。
        // ただし、自責点や投球回はここだけでは決まらない（得点が入った場合など）。
        // 今回の要件では「記録できるようにし、自動で計算」なので、
        // 打席ごとの結果から都度集計する方式（ビューまたはクエリ）を採用する方が整合性が保ちやすい。
        // よって、pitching_statsへの都度UPDATEは一旦省略し、GET時にat_batsから集計する方針とする。
        // もしくは、別途「イニング終了」APIを作ってそこでまとめて更新するなど。
        // 今回はシンプルに at_bats にすべて記録し、集計APIで計算する。

        await connection.commit();
        res.status(201).json({ id: result.insertId, message: '打席結果を保存しました' });

    } catch (error) {
        await connection.rollback();
        console.error('POST /api/atbats エラー:', error);
        res.status(500).json({ error: 'サーバーエラー' });
    } finally {
        connection.release();
    }
});

/**
 * GET /api/stats/batter/:id - 打者成績取得
 */
app.get('/api/stats/batter/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 打席数(PA), 打数(AB), 安打(H), 二塁打(2B), 三塁打(3B), 本塁打(HR), 四死球(BB+HBP), 犠飛(SF), 打点(RBI)
        // 出塁率(OBP) = (H + BB + HBP) / (AB + BB + HBP + SF)
        // 長打率(SLG) = (1B + 2x2B + 3x3B + 4xHR) / AB
        // OPS = OBP + SLG
        
        const sql = `
            SELECT 
                COUNT(*) as pa,
                SUM(CASE WHEN result_type NOT IN ('Walk', 'HBP', 'Sacrifice', 'Error') OR (result_type = 'Sacrifice' AND is_sac_fly = 0) THEN 1 ELSE 0 END) as ab,
                SUM(CASE WHEN result_type IN ('Single', 'Double', 'Triple', 'HR') THEN 1 ELSE 0 END) as h,
                SUM(CASE WHEN result_type = 'Double' THEN 1 ELSE 0 END) as double_h,
                SUM(CASE WHEN result_type = 'Triple' THEN 1 ELSE 0 END) as triple_h,
                SUM(CASE WHEN result_type = 'HR' THEN 1 ELSE 0 END) as hr,
                SUM(CASE WHEN result_type IN ('Walk', 'HBP') THEN 1 ELSE 0 END) as bb_hbp,
                SUM(CASE WHEN result_type = 'Sacrifice' AND is_sac_fly = 1 THEN 1 ELSE 0 END) as sf,
                SUM(rbi) as rbi
            FROM at_bats
            WHERE batter_id = ?
        `;
        
        const [rows] = await pool.execute(sql, [id]);
        const stats = rows[0];
        
        // 計算
        const h = parseInt(stats.h) || 0;
        const ab = parseInt(stats.ab) || 0;
        const bb_hbp = parseInt(stats.bb_hbp) || 0;
        const sf = parseInt(stats.sf) || 0;
        const double_h = parseInt(stats.double_h) || 0;
        const triple_h = parseInt(stats.triple_h) || 0;
        const hr = parseInt(stats.hr) || 0;
        const single_h = h - double_h - triple_h - hr;
        
        // 打率
        const avg = ab > 0 ? h / ab : 0;
        
        // 出塁率
        const obpDenom = ab + bb_hbp + sf;
        const obp = obpDenom > 0 ? (h + bb_hbp) / obpDenom : 0;
        
        // 長打率
        const totalBases = single_h + (2 * double_h) + (3 * triple_h) + (4 * hr);
        const slg = ab > 0 ? totalBases / ab : 0;
        
        // OPS
        const ops = obp + slg;
        
        res.json({
            ...stats,
            avg: avg.toFixed(3),
            obp: obp.toFixed(3),
            slg: slg.toFixed(3),
            ops: ops.toFixed(3)
        });
        
    } catch (error) {
        console.error('GET /api/stats/batter/:id エラー:', error);
        res.status(500).json({ error: 'サーバーエラー' });
    }
});

/**
 * GET /api/stats/pitcher/:id - 投手成績取得
 */
app.get('/api/stats/pitcher/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 簡易実装: at_batsから積み上げ計算
        // 投球回はアウトカウントから計算するのが正確だが、詳細なアウト内訳がない場合近似値になる。
        // ここでは、result_typeから推定する。
        // Strikeout, Groundout, Flyout, Sacrifice(フライ/バント), FC, DP(2アウト)
        
        const sql = `
            SELECT 
                COUNT(*) as batters_faced,
                SUM(CASE WHEN result_type IN ('Single', 'Double', 'Triple', 'HR') THEN 1 ELSE 0 END) as hits,
                SUM(CASE WHEN result_type = 'HR' THEN 1 ELSE 0 END) as hr,
                SUM(CASE WHEN result_type IN ('Walk', 'HBP') THEN 1 ELSE 0 END) as bb,
                SUM(CASE WHEN result_type = 'Strikeout' THEN 1 ELSE 0 END) as k,
                SUM(CASE 
                    WHEN result_type IN ('Strikeout', 'Groundout', 'Flyout', 'Lineout') THEN 1 
                    WHEN result_type = 'DP' THEN 2 
                    WHEN result_type = 'Sacrifice' THEN 1
                    ELSE 0 
                END) as outs
            FROM at_bats
            WHERE pitcher_id = ?
        `;
        
        const [rows] = await pool.execute(sql, [id]);
        const stats = rows[0];
        
        const outs = parseInt(stats.outs) || 0;
        const ip = Math.floor(outs / 3) + (outs % 3) / 10; // 1.1, 1.2 形式
        const ip_calc = outs / 3; // 計算用
        
        // 防御率計算には失点(自責点)が必要だが、at_batsには紐付いていない（ランナー状況によるため）。
        // 本来は pitching_stats テーブルに試合/イニング単位で記録すべき。
        // 今回は「自責点」の入力がないと計算できないため、簡易的に
        // pitching_stats テーブルがあればそこから取得、なければ0とする。
        
        const [pRows] = await pool.execute(
            'SELECT SUM(earned_runs) as er, SUM(innings_pitched) as ip_recorded FROM pitching_stats WHERE pitcher_id = ?',
            [id]
        );
        
        const er = parseInt(pRows[0].er) || 0;
        // 投球回はat_batsの積み上げと、手動記録のpitching_statsの併用を考慮
        
        const era = ip_calc > 0 ? (er * 9) / ip_calc : 0;
        const k9 = ip_calc > 0 ? (stats.k * 9) / ip_calc : 0;
        const bb9 = ip_calc > 0 ? (stats.bb * 9) / ip_calc : 0;
        
        res.json({
            ...stats,
            ip,
            er,
            era: era.toFixed(2),
            k9: k9.toFixed(2),
            bb9: bb9.toFixed(2)
        });

    } catch (error) {
        console.error('GET /api/stats/pitcher/:id エラー:', error);
        res.status(500).json({ error: 'サーバーエラー' });
    }
});

// ==================== ヘルスチェック ====================
app.get('/api/health', async (req, res) => {
    try {
        await pool.execute('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        res.status(503).json({ status: 'error', database: 'disconnected' });
    }
});

// サーバー起動
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 APIサーバーが起動しました: http://localhost:${PORT}`);
    });
});
