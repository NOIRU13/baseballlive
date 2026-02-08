/**
 * 定数定義
 */

export const DEFAULT_STATE = {
    teams: {
        home: '\u30DB\u30FC\u30E0',
        away: '\u30A2\u30A6\u30A7\u30A4'
    },
    teamShortNames: {
        home: '',
        away: ''
    },
    inning: {
        number: 1,
        half: 'top' // 'top' = \u8868, 'bottom' = \u88CF
    },
    // \u5404\u30A4\u30CB\u30F3\u30B0\u306E\u5F97\u70B9\uFF08\u6700\u592712\u30A4\u30CB\u30F3\u30B0\u5206\uFF09
    scores: {
        home: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        away: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    count: {
        ball: 0,
        strike: 0,
        out: 0
    },
    runners: {
        first: false,
        second: false,
        third: false
    },
    // R(得点合計), H(ヒット), E(エラー)
    stats: {
        home: { r: 0, h: 0, e: 0 },
        away: { r: 0, h: 0, e: 0 }
    },
    // 打順データ（9人分の選手名）
    lineup: {
        home: ['', '', '', '', '', '', '', '', ''],
        away: ['', '', '', '', '', '', '', '', '']
    },
    // 守備位置データ
    positions: {
        home: ['投', '捕', '一', '二', '三', '遊', '左', '中', '右'],
        away: ['投', '捕', '一', '二', '三', '遊', '左', '中', '右']
    },
    // 現在の打順位置（0-8）
    currentBatter: {
        home: 0,
        away: 0
    },
    // 各選手の打席結果履歴
    // 例: { home: [['single', 'groundout'], [], ...], away: [...] }
    atBatResults: {
        home: [[], [], [], [], [], [], [], [], []],
        away: [[], [], [], [], [], [], [], [], []]
    },
    // 結果取り消し用の履歴
    resultHistory: [],
    // 投手(DH制対応): 1-9番に入らない投手
    pitcher: {
        home: '',
        away: ''
    },
    // 打者ごとの当日打点（RBI）
    todayRBI: {
        home: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        away: [0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    // 投手成績（自動計算）
    pitcherStats: {
        home: { innings: 0, strikeouts: 0, walks: 0, runs: 0, pitchCount: 0, outs: 0, runsAtStart: 0 },
        away: { innings: 0, strikeouts: 0, walks: 0, runs: 0, pitchCount: 0, outs: 0, runsAtStart: 0 }
    }
};

// 打席結果のラベルマッピング
export const RESULT_LABELS = {
    'single': '単打',
    'double': '二塁打',
    'triple': '三塁打',
    'homerun': '本塁打',
    'walk': '四球',
    'hbp': '死球',
    'error': 'エラー',
    'strikeout': '三振',
    'groundout': 'ゴロ',
    'flyout': 'フライ',
    'lineout': 'ライナー',
    'sacrifice': '犠打',
    'fc': '野選',
    'dp': '併殺'
};

// 守備位置のリスト
export const POSITIONS = [
    '投', '捕', '一', '二', '三', '遊', '左', '中', '右', '指', '代'
];

// LocalStorageキー
export const STORAGE_KEY = 'baseballScoreboard';

// API設定 (Docker環境では同一オリジンからnginxがプロキシ)
export const API_BASE_URL = '/api';

// BroadcastChannel（タブ間リアルタイム同期用）
export const CHANNEL_NAME = 'baseballScoreboard';
