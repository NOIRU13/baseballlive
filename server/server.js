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

/**
 * GET /api/health - ヘルスチェック
 */
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
