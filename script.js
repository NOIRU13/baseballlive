/**
 * 野球スコアボード - メインスクリプト
 * OBS Studio ブラウザソース用
 */

// ==================== データモデル ====================
const DEFAULT_STATE = {
    teams: {
        home: '\u30DB\u30FC\u30E0',
        away: '\u30A2\u30A6\u30A7\u30A4'
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
    // 投手成績
    pitcherStats: {
        home: { innings: 0, strikeouts: 0, runs: 0 },
        away: { innings: 0, strikeouts: 0, runs: 0 }
    }
};

// 打席結果のラベルマッピング
const RESULT_LABELS = {
    'single': '\u5358',
    'double': '2',
    'triple': '3',
    'homerun': 'HR',
    'walk': '\u56DB',
    'hbp': '\u6B7B',
    'error': 'E',
    'strikeout': 'K',
    'groundout': '\u30B4',
    'flyout': '\u30D5',
    'lineout': '\u30E9',
    'sacrifice': '\u72A0',
    'fc': 'FC',
    'dp': '\u4F75'
};

// 守備位置のリスト
const POSITIONS = [
    '投', '捕', '一', '二', '三', '遊', '左', '中', '右', '指', '代'
];

// 現在の状態
let state = {};

// LocalStorageキー（フォールバック用）
const STORAGE_KEY = 'baseballScoreboard';

// API設定
const API_BASE_URL = 'http://localhost:3000/api';
let useAPI = true; // APIが利用可能かどうか

// BroadcastChannel（タブ間リアルタイム同期用）
const CHANNEL_NAME = 'baseballScoreboard';
let broadcastChannel = null;

// ページモード判定
let isAdminMode = false;
let isDisplayMode = false;

// ==================== 初期化 ====================
document.addEventListener('DOMContentLoaded', async () => {
    // ページモード判定
    checkPageMode();
    
    // APIヘルスチェック
    await checkAPIHealth();
    
    // 状態の読み込み
    await loadState();
    
    // 管理モードの場合のみ打順入力フォームを生成
    if (isAdminMode) {
        generateLineupInputs();
    }
    
    // UIの更新
    updateDisplay();
    
    // イベントリスナーの設定（管理モードのみ）
    if (isAdminMode) {
        setupEventListeners();
    }
    
    // BroadcastChannelの設定（全モードで有効化）
    setupBroadcastChannel();
    
    // 表示モードの場合、定期的に同期（フォールバック）
    if (isDisplayMode) {
        setupStorageSync();
    }
});

/**
 * ページモードを判定（管理画面 or 表示画面）
 */
function checkPageMode() {
    // bodyのクラスでモードを判定
    isAdminMode = document.body.classList.contains('admin-mode');
    isDisplayMode = document.body.classList.contains('display-mode');
    
    // URLパラメータでオーバーレイモードを判定
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    
    if (mode === 'overlay') {
        document.body.classList.add('overlay-mode');
    }
}

/**
 * APIヘルスチェック
 */
async function checkAPIHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`, { 
            method: 'GET',
            signal: AbortSignal.timeout(3000) // 3秒タイムアウト
        });
        if (response.ok) {
            useAPI = true;
            console.log('✅ APIサーバーに接続しました');
        } else {
            throw new Error('API not available');
        }
    } catch (e) {
        useAPI = false;
        console.warn('⚠️ APIサーバーに接続できません。localStorageを使用します。');
    }
}

/**
 * BroadcastChannelのセットアップ（タブ間リアルタイム同期）
 */
/**
 * BroadcastChannelのセットアップ（タブ間リアルタイム同期）
 */
function setupBroadcastChannel() {
    try {
        broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
        
        // 管理モード以外（表示モードなど）の場合のみメッセージを受信して反映
        if (!isAdminMode) {
            broadcastChannel.onmessage = (event) => {
                if (event.data && event.data.type === 'STATE_UPDATE') {
                    console.log('📡 ブロードキャスト受信: 状態を更新します');
                    // 受信した状態をマージして更新
                    state = deepMerge(JSON.parse(JSON.stringify(DEFAULT_STATE)), event.data.state);
                    // UIを即座に更新
                    updateDisplay();
                    // 受信側ではlocalStorageへの保存は必須ではないが、リロード時のために保存推奨
                    // ただし、管理側と競合しないよう注意（管理側は送信元）
                    // ここでは表示用として保存しておく
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                } else if (event.data && event.data.type === 'SHOW_RESULT') {
                    console.log('📡 結果アニメーション受信:', event.data.result);
                    showResultAnimation(event.data.result);
                }
            };
            console.log('✅ BroadcastChannel受信待機中（表示モード）');
        } else {
            console.log('✅ BroadcastChannel送信専用（管理モード）');
        }
    } catch (e) {
        console.warn('⚠️ BroadcastChannel は利用できません:', e);
    }
}

/**
 * 状態変更を他のタブにブロードキャスト
 */
function broadcastState() {
    // 管理モードからのみ送信する（一方通行）
    if (broadcastChannel && isAdminMode) {
        try {
            broadcastChannel.postMessage({
                type: 'STATE_UPDATE',
                state: state,
                timestamp: Date.now()
            });
            console.log('📤 状態をブロードキャストしました');
        } catch (e) {
            console.warn('ブロードキャスト失敗:', e);
        }
    }
}

/**
 * 表示モード用：定期的に状態を同期（フォールバック）
 */
function setupStorageSync() {
    // BroadcastChannelが使えない場合のフォールバック
    // ポーリング間隔を長めに設定（BroadcastChannelがメインなので）
    setInterval(async () => {
        await loadState();
        updateDisplay();
    }, 2000); // 2秒ごとにチェック（フォールバック用）
}

/**
 * 状態を読み込む（API優先、フォールバックでlocalStorage）
 */
async function loadState() {
    // APIが利用可能な場合
    if (useAPI) {
        try {
            const response = await fetch(`${API_BASE_URL}/state`);
            if (response.ok) {
                const data = await response.json();
                state = deepMerge(JSON.parse(JSON.stringify(DEFAULT_STATE)), data.state);
                // localStorageにもバックアップ
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                return;
            }
        } catch (e) {
            console.warn('APIからの読み込みに失敗:', e);
        }
    }
    
    // フォールバック: localStorage
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            state = deepMerge(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
        } else {
            state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        }
    } catch (e) {
        console.error('状態の読み込みに失敗:', e);
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
}

/**
 * オブジェクトの深いマージ
 */
function deepMerge(target, source) {
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) target[key] = {};
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

/**
 * 状態を保存する（API優先、フォールバックでlocalStorage）
 */
async function saveState() {
    // 常にlocalStorageにも保存（バックアップ）
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('localStorageへの保存に失敗:', e);
    }
    
    // BroadcastChannelで他のタブにリアルタイム同期
    broadcastState();
    
    // APIが利用可能な場合
    if (useAPI) {
        try {
            await fetch(`${API_BASE_URL}/state`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state })
            });
        } catch (e) {
            console.warn('APIへの保存に失敗:', e);
        }
    }
}

// ==================== 表示更新 ====================
/**
 * 全ての表示を更新する
 */
function updateDisplay() {
    updateTeamDisplay();
    updateInningDisplay();
    updateCountDisplay();
    updateRunnerDisplay();
    updateScoreDisplay();
    updateRHEDisplay();
    updateControlPanel();
    updateLineupDisplay();
    updateCurrentBatterDisplay();
    updateBottomStats(); // 下部スタッツ更新
}

/**
 * チーム名の表示を更新
 */
/**
 * チーム名の表示を更新
 */
function updateTeamDisplay() {
    // サイドバーのチーム名
    var sidebarAway = document.getElementById('sidebar-away-name');
    var sidebarHome = document.getElementById('sidebar-home-name');
    if (sidebarAway) sidebarAway.textContent = state.teams.away;
    if (sidebarHome) sidebarHome.textContent = state.teams.home;

    // 下部スコアのチームコード（先頭3文字などを表示、またはそのまま）
    var scoreAwayCode = document.getElementById('score-away-code');
    var scoreHomeCode = document.getElementById('score-home-code');
    if (scoreAwayCode) scoreAwayCode.textContent = state.teams.away; // 必要なら .substring(0,3)
    if (scoreHomeCode) scoreHomeCode.textContent = state.teams.home;
    
    // Admin画面用
    var adminAway = document.querySelector('#team-away-display .team-name');
    var adminHome = document.querySelector('#team-home-display .team-name');
    if (adminAway) adminAway.textContent = state.teams.away;
    if (adminHome) adminHome.textContent = state.teams.home;
}

/**
 * イニング表示を更新
 */
function updateInningDisplay() {
    var halfSymbol = state.inning.half === 'top' ? '\u25B2' : '\u25BC'; // ▲ ▼
    var halfText = state.inning.half === 'top' ? '\u8868' : '\u88CF';
    
    var inningHalfEl = document.getElementById('inning-half');
    var inningNumEl = document.getElementById('inning-number');
    var inningInfoEl = document.getElementById('inning-info'); // Admin用
    
    if (inningHalfEl) inningHalfEl.textContent = halfText; // 新レイアウトは文字で「表/裏」
    if (inningNumEl) inningNumEl.textContent = state.inning.number;
    if (inningInfoEl) inningInfoEl.textContent = state.inning.number + '\u56DE ' + halfText;
}

/**
 * カウント表示を更新
 */
function updateCountDisplay() {
    // ボール
    const ballDots = document.querySelectorAll('#ball-dots .dot');
    ballDots.forEach((dot, i) => {
        dot.classList.toggle('active', i < state.count.ball);
    });
    
    // ストライク
    const strikeDots = document.querySelectorAll('#strike-dots .dot');
    strikeDots.forEach((dot, i) => {
        dot.classList.toggle('active', i < state.count.strike);
    });
    
    // アウト
    const outDots = document.querySelectorAll('#out-dots .dot');
    outDots.forEach((dot, i) => {
        dot.classList.toggle('active', i < state.count.out);
    });
}

/**
 * ランナー表示を更新
 */
function updateRunnerDisplay() {
    var runnerFirst = document.getElementById('runner-first');
    var runnerSecond = document.getElementById('runner-second');
    var runnerThird = document.getElementById('runner-third');
    // Admin用もIDが同じなら更新されるが、クラス名が違う場合があるので注意
    // admin.htmlのランナーは diamond-admin 内の button なのでIDが rubber-btn-1 とか？
    // admin.html を見ると btn-runner-1, btn-runner-2...
    
    if (runnerFirst) runnerFirst.classList.toggle('active', state.runners.first);
    if (runnerSecond) runnerSecond.classList.toggle('active', state.runners.second);
    if (runnerThird) runnerThird.classList.toggle('active', state.runners.third);
}

/**
 * 得点表示を更新 (Bottom Board対応)
 */
function updateScoreDisplay() {
    // 合計得点計算
    var awayTotal = state.scores.away.reduce(function(sum, score) { return sum + score; }, 0);
    var homeTotal = state.scores.home.reduce(function(sum, score) { return sum + score; }, 0);

    // 1-9回スコア更新 (index.html用)
    for (var i = 0; i < 9; i++) {
        var awayEl = document.getElementById('score-away-' + (i + 1));
        var homeEl = document.getElementById('score-home-' + (i + 1));
        
        var awayScore = state.scores.away[i];
        var homeScore = state.scores.home[i];
        
        // 表示テキスト決定ロジック
        var awayText = '';
        var homeText = '';
        
        if ((i + 1) < state.inning.number) {
            // 過去のイニング
            awayText = (awayScore !== undefined && awayScore !== null) ? awayScore : 0;
            homeText = (homeScore !== undefined && homeScore !== null) ? homeScore : 0;
        } else if ((i + 1) === state.inning.number) {
            // 現在のイニング
            awayText = (awayScore !== undefined && awayScore !== null) ? awayScore : 0;
            if (state.inning.half === 'bottom') {
                // 裏の攻撃中または終了
                homeText = (homeScore !== undefined && homeScore !== null) ? homeScore : 0;
            } else {
                // 表の攻撃中（裏はまだ）
                homeText = '';
            }
        } else {
            // 未来のイニング
            awayText = '';
            homeText = '';
        }

        if (awayEl) awayEl.textContent = awayText;
        if (homeEl) homeEl.textContent = homeText;
    }

    // Bottom Board (Total)
    var scoreAwayTotal = document.getElementById('score-away-total');
    var scoreHomeTotal = document.getElementById('score-home-total');
    if (scoreAwayTotal) scoreAwayTotal.textContent = awayTotal;
    if (scoreHomeTotal) scoreHomeTotal.textContent = homeTotal;

    // Admin画面用
    var adminAwayTotal = document.getElementById('away-total');
    var adminHomeTotal = document.getElementById('home-total');
    if (adminAwayTotal) adminAwayTotal.textContent = awayTotal;
    if (adminHomeTotal) adminHomeTotal.textContent = homeTotal;

    state.stats.away.r = awayTotal;
    state.stats.home.r = homeTotal;
    
    // チーム名更新 (Line Score Table)
    var tsAwayName = document.getElementById('team-name-away');
    var tsHomeName = document.getElementById('team-name-home');
    if (tsAwayName) tsAwayName.textContent = state.teams.away;
    if (tsHomeName) tsHomeName.textContent = state.teams.home;
}

/**
 * R (Run/Score), H (Hit), E (Error) の表示を更新
 */
function updateRHEDisplay() {
    // RはupdateScoreDisplayで更新済みだが、再計算しても良い。
    // ここでは H と E をメインに更新
    
    // H
    var ahEl = document.getElementById('stats-away-h');
    if (ahEl) ahEl.textContent = state.stats.away.h;
    
    var hhEl = document.getElementById('stats-home-h');
    if (hhEl) hhEl.textContent = state.stats.home.h;
    
    // E
    var aeEl = document.getElementById('stats-away-e');
    if (aeEl) aeEl.textContent = state.stats.away.e;
    
    var heEl = document.getElementById('stats-home-e');
    if (heEl) heEl.textContent = state.stats.home.e;
}

/**
 * コントロールパネル（Admin）の更新
 * 特に現在のイニングの得点操作部など
 */
function updateControlPanel() {
    if (!isAdminMode) return;

    // 攻撃チームのラベル更新
    var team = state.inning.half === 'top' ? 'away' : 'home';
    var teamName = state.teams[team];
    var labelEl = document.getElementById('scoring-team-label');
    if (labelEl) {
        labelEl.textContent = teamName + '（攻撃）';
    }

    // 現在のイニングの得点表示更新
    var inningIndex = state.inning.number - 1;
    // 配列範囲外チェック
    if (inningIndex >= 0 && inningIndex < state.scores[team].length) {
        var currentScore = state.scores[team][inningIndex];
        var scoreEl = document.getElementById('current-inning-score');
        if (scoreEl) {
            scoreEl.textContent = currentScore;
        }
    }

    // 投手成績入力フィールドの更新
    if (state.pitcherStats) {
        var pitcherInningsAway = document.getElementById('pitcher-innings-away');
        var pitcherKAway = document.getElementById('pitcher-k-away');
        var pitcherRunsAway = document.getElementById('pitcher-runs-away');
        var pitcherInningsHome = document.getElementById('pitcher-innings-home');
        var pitcherKHome = document.getElementById('pitcher-k-home');
        var pitcherRunsHome = document.getElementById('pitcher-runs-home');

        if (pitcherInningsAway) pitcherInningsAway.value = state.pitcherStats.away.innings || 0;
        if (pitcherKAway) pitcherKAway.value = state.pitcherStats.away.strikeouts || 0;
        if (pitcherRunsAway) pitcherRunsAway.value = state.pitcherStats.away.runs || 0;
        if (pitcherInningsHome) pitcherInningsHome.value = state.pitcherStats.home.innings || 0;
        if (pitcherKHome) pitcherKHome.value = state.pitcherStats.home.strikeouts || 0;
        if (pitcherRunsHome) pitcherRunsHome.value = state.pitcherStats.home.runs || 0;
    }
}

/**
 * 下部スタッツ・情報バー更新 (PITCHER / BATTER)
 */
function updateBottomStats() {
    if (!isDisplayMode) return;
    
    var offenseTeam = state.inning.half === 'top' ? 'away' : 'home';
    var defenseTeam = state.inning.half === 'top' ? 'home' : 'away';

    // BATTER
    var batterIndex = state.currentBatter[offenseTeam];
    var batterName = state.lineup[offenseTeam][batterIndex] || '---';
    var batterEl = document.getElementById('current-batter-name');
    if (batterEl) batterEl.textContent = batterName;

    // PITCHER
    // ロジック:
    // 1. 打順(1-9)の中に守備位置「投」がいれば、その選手を表示 (DHなし/解除)
    // 2. いなければ、state.pitcher (投手入力欄) の名前を表示 (DHあり)
    let pitcherName = '---';
    let pitcherInLineup = false;
    
    if (state.positions && state.positions[defenseTeam]) {
        for (var i = 0; i < 9; i++) {
            if (state.positions[defenseTeam][i] === '投') {
                pitcherName = state.lineup[defenseTeam][i] || '投手';
                pitcherInLineup = true;
                break;
            }
        }
    }
    
    if (!pitcherInLineup) {
        // Lineupに投手がいない場合は、投手入力欄の値を使用
        pitcherName = state.pitcher[defenseTeam] || '投手';
    }

    var pitcherEl = document.getElementById('current-pitcher-name');
    if (pitcherEl) pitcherEl.textContent = pitcherName;

    // --- 新しい大型表示エリアの更新 ---
    var batterNameLarge = document.getElementById('batter-name-large');
    var batterStatsToday = document.getElementById('batter-stats-today');
    var pitcherNameLarge = document.getElementById('pitcher-name-large');

    if (batterNameLarge) batterNameLarge.textContent = batterName;
    if (pitcherNameLarge) pitcherNameLarge.textContent = pitcherName;

    // 打者の当日成績リスト更新
    if (batterStatsToday) {
        batterStatsToday.innerHTML = '';
        var results = state.atBatResults[offenseTeam][batterIndex] || [];
        results.forEach(function(code) {
            var label = RESULT_LABELS[code] || code;
            var span = document.createElement('span');
            span.className = 'stat-badge';
            span.textContent = label;
            batterStatsToday.appendChild(span);
        });
    }

    // --- 投手成績の更新 ---
    if (state.pitcherStats && state.pitcherStats[defenseTeam]) {
        var pitcherInnings = document.getElementById('pitcher-innings');
        var pitcherStrikeouts = document.getElementById('pitcher-strikeouts');
        var pitcherRuns = document.getElementById('pitcher-runs');

        if (pitcherInnings) {
            // イニング数を小数点1桁で表示 (例: 5.1, 6.0)
            var innings = state.pitcherStats[defenseTeam].innings || 0;
            pitcherInnings.textContent = innings.toFixed(1);
        }
        if (pitcherStrikeouts) {
            pitcherStrikeouts.textContent = state.pitcherStats[defenseTeam].strikeouts || 0;
        }
        if (pitcherRuns) {
            pitcherRuns.textContent = state.pitcherStats[defenseTeam].runs || 0;
        }
    }
}

/**
 * 打順ボードの表示を更新 (サイドバー対応)
 */
function updateLineupDisplay() {
    // Display Mode: Sidebar
    ['away', 'home'].forEach(function(team) {
        var container = document.getElementById('lineup-' + team + '-display');
        if (!container) {
             // Admin画面用（ID互換性）
             container = document.getElementById(team + '-lineup');
        }
        if (!container) return;
        
        container.innerHTML = '';
        var currentBatterIndex = state.currentBatter[team];
        var isAttacking = (state.inning.half === 'top' && team === 'away') ||
                         (state.inning.half === 'bottom' && team === 'home');
                         
        for (var i = 0; i < 9; i++) {
            var playerName = state.lineup[team][i] || ((i + 1) + '\u756A');
            var pos = (state.positions && state.positions[team][i]) ? state.positions[team][i] : '';
            var isActive = isAttacking && i === currentBatterIndex;
            
            var playerDiv = document.createElement('div');
            playerDiv.className = 'lineup-item' + (isActive ? ' active' : '');
            
            playerDiv.innerHTML = '<span class="order-num">' + (i + 1) + '</span>' +
                '<span class="player-pos">' + pos + '</span>' +
                '<span class="player-name">' + playerName + '</span>';
            container.appendChild(playerDiv);
        }
    });
}

/**
 * 現在の打者情報を更新 (Admin用)
 */
function updateCurrentBatterDisplay() {
    var team = state.inning.half === 'top' ? 'away' : 'home';
    var batterIndex = state.currentBatter[team];
    var batterName = state.lineup[team][batterIndex] || '---';
    var batterOrderEl = document.getElementById('current-batter-order');
    var batterNameEl = document.getElementById('current-batter-name-admin'); // Admin用ID変更検討
    // note: index.htmlのcurrent-batter-nameはBottomStatsで使っている。Adminはcontrol-panel内にある。
    // AdminのHTMLを確認すると id="current-batter-name" がある。
    // IDが重複してしまうとまずいので、index.html側は別IDにするか、あるいは isAdminMode で分岐。
    
    if (isAdminMode) {
        var adminBatterNameEl = document.getElementById('current-batter-name');
        if (adminBatterNameEl) adminBatterNameEl.textContent = batterName;
        var batterOrderEl = document.getElementById('current-batter-order');
        if (batterOrderEl) batterOrderEl.textContent = batterIndex + 1;
    }
}

// ==================== イベントリスナー ====================
// ==================== イベントリスナー ====================
function setupEventListeners() {
    // ヘルパー関数: イベントリスナーを安全に追加
    function addListener(id, event, handler) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener(event, handler);
        }
    }

    // チーム名変更
    addListener('away-name', 'input', function(e) {
        state.teams.away = e.target.value || '\u30A2\u30A6\u30A7\u30A4';
        updateDisplay();
        saveState();
    });
    
    addListener('home-name', 'input', function(e) {
        state.teams.home = e.target.value || '\u30DB\u30FC\u30E0';
        updateDisplay();
        saveState();
    });
    
    // ボール
    addListener('btn-ball', 'click', function() {
        state.count.ball++;
        if (state.count.ball >= 4) {
            // フォアボール（4つ目のボール） - 一塁ランナー追加 & カウントリセット
            state.runners.first = true;
            resetCount();
            // 次の打者へ進める
            var team = state.inning.half === 'top' ? 'away' : 'home';
            state.currentBatter[team] = (state.currentBatter[team] + 1) % 9;
        }
        updateDisplay();
        saveState();
    });
    
    addListener('btn-ball-reset', 'click', function() {
        state.count.ball = 0;
        updateDisplay();
        saveState();
    });
    
    // ストライク
    addListener('btn-strike', 'click', function() {
        state.count.strike++;
        if (state.count.strike >= 3) {
            // 三振（3つ目のストライク） - アウト追加 & カウントリセット
            addOut();
            // 次の打者へ進める
            var team = state.inning.half === 'top' ? 'away' : 'home';
            state.currentBatter[team] = (state.currentBatter[team] + 1) % 9;
        }
        updateDisplay();
        saveState();
    });
    
    addListener('btn-strike-reset', 'click', function() {
        state.count.strike = 0;
        updateDisplay();
        saveState();
    });
    
    // アウト
    addListener('btn-out', 'click', function() {
        addOut();
        updateDisplay();
        saveState();
    });
    
    addListener('btn-out-reset', 'click', function() {
        state.count.out = 0;
        updateDisplay();
        saveState();
    });
    
    // カウントリセット（打席交代）
    addListener('btn-count-reset', 'click', function() {
        resetCount();
        updateDisplay();
        saveState();
    });
    
    // ランナー
    addListener('btn-runner-1', 'click', function() {
        state.runners.first = !state.runners.first;
        updateDisplay();
        saveState();
    });
    
    addListener('btn-runner-2', 'click', function() {
        state.runners.second = !state.runners.second;
        updateDisplay();
        saveState();
    });
    
    addListener('btn-runner-3', 'click', function() {
        state.runners.third = !state.runners.third;
        updateDisplay();
        saveState();
    });
    
    addListener('btn-runner-clear', 'click', function() {
        state.runners.first = false;
        state.runners.second = false;
        state.runners.third = false;
        updateDisplay();
        saveState();
    });
    
    // イニング操作
    addListener('btn-inning-prev', 'click', function() {
        if (state.inning.half === 'bottom') {
            state.inning.half = 'top';
        } else if (state.inning.number > 1) {
            state.inning.number--;
            state.inning.half = 'bottom';
        }
        updateDisplay();
        saveState();
    });
    
    addListener('btn-inning-next', 'click', function() {
        advanceInning();
        updateDisplay();
        saveState();
    });
    
    // 得点操作
    addListener('btn-score-plus', 'click', function() {
        var inningIndex = state.inning.number - 1;
        var team = state.inning.half === 'top' ? 'away' : 'home';
        state.scores[team][inningIndex]++;
        updateDisplay();
        saveState();
    });
    
    addListener('btn-score-minus', 'click', function() {
        var inningIndex = state.inning.number - 1;
        var team = state.inning.half === 'top' ? 'away' : 'home';
        if (state.scores[team][inningIndex] > 0) {
            state.scores[team][inningIndex]--;
        }
        updateDisplay();
        saveState();
    });
    
    // R/H/E操作
    document.querySelectorAll('[data-team][data-stat]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var team = btn.dataset.team;
            var stat = btn.dataset.stat;
            var action = btn.dataset.action;
            
            if (action === 'minus') {
                if (state.stats[team][stat] > 0) {
                    state.stats[team][stat]--;
                }
            } else {
                state.stats[team][stat]++;
            }
            updateDisplay();
            saveState();
        });
    });
    
    // 試合リセット
    addListener('btn-reset-game', 'click', function() {
        if (confirm('\u672C\u5F53\u306B\u8A66\u5408\u30C7\u30FC\u30BF\u3092\u30EA\u30BB\u30C3\u30C8\u3057\u307E\u3059\u304B\uFF1F\n\u3053\u306E\u64CD\u4F5C\u306F\u53D6\u308A\u6D88\u305B\u307E\u305B\u3093\u3002')) {
            state = JSON.parse(JSON.stringify(DEFAULT_STATE));
            generateLineupInputs();
            updateDisplay();
            saveState();
        }
    });
    
    // ==================== 打順関連イベント ====================
    
    // タブ切り替えロジックは廃止（左右並列表示に変更）ため削除
    
    
    // 選手名入力（動的に生成される要素へのイベント委譲は下記で行うか、生成時に追加する）
    // 既存の静的要素に対するリスナー設定はここでは行わない（動的生成時に設定されるため）
    
    // 動的に生成された打順入力にもイベントを設定 (イベント委譲)
    function handleLineupInput(e) {
        if (e.target.classList.contains('lineup-input-name')) {
            var team = e.target.dataset.team;
            var order = parseInt(e.target.dataset.order);
            state.lineup[team][order] = e.target.value;
            updateLineupDisplay();
            updateCurrentBatterDisplay();
            saveState();
        }
    }
    
    addListener('lineup-input-away', 'input', handleLineupInput);
    addListener('lineup-input-home', 'input', handleLineupInput);
    // セレクトボックスの変更イベントも監視
    addListener('lineup-input-away', 'change', handleLineupInput);
    addListener('lineup-input-home', 'change', handleLineupInput);
    
    // 打席結果ボタン
    document.querySelectorAll('[data-result]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var result = btn.dataset.result;
            recordAtBatResult(result);
        });
    });
    
    // 前の打者/次の打者
    addListener('btn-prev-batter', 'click', function() {
        var team = state.inning.half === 'top' ? 'away' : 'home';
        var prevBatterIndex = state.currentBatter[team] - 1;
        if (prevBatterIndex < 0) prevBatterIndex = 8;
        state.currentBatter[team] = prevBatterIndex;
        updateDisplay();
        saveState();
    });
    
    addListener('btn-next-batter', 'click', function() {
        var team = state.inning.half === 'top' ? 'away' : 'home';
        state.currentBatter[team] = (state.currentBatter[team] + 1) % 9;
        updateDisplay();
        saveState();
    });

    // 直前の結果取り消し
    addListener('btn-undo-result', 'click', function() {
        undoLastResult();
    });

    // 投手成績入力
    addListener('pitcher-innings-away', 'input', function(e) {
        if (!state.pitcherStats) state.pitcherStats = { home: { innings: 0, strikeouts: 0, runs: 0 }, away: { innings: 0, strikeouts: 0, runs: 0 } };
        state.pitcherStats.away.innings = parseFloat(e.target.value) || 0;
        saveState();
    });
    addListener('pitcher-k-away', 'input', function(e) {
        if (!state.pitcherStats) state.pitcherStats = { home: { innings: 0, strikeouts: 0, runs: 0 }, away: { innings: 0, strikeouts: 0, runs: 0 } };
        state.pitcherStats.away.strikeouts = parseInt(e.target.value) || 0;
        saveState();
    });
    addListener('pitcher-runs-away', 'input', function(e) {
        if (!state.pitcherStats) state.pitcherStats = { home: { innings: 0, strikeouts: 0, runs: 0 }, away: { innings: 0, strikeouts: 0, runs: 0 } };
        state.pitcherStats.away.runs = parseInt(e.target.value) || 0;
        saveState();
    });
    addListener('pitcher-innings-home', 'input', function(e) {
        if (!state.pitcherStats) state.pitcherStats = { home: { innings: 0, strikeouts: 0, runs: 0 }, away: { innings: 0, strikeouts: 0, runs: 0 } };
        state.pitcherStats.home.innings = parseFloat(e.target.value) || 0;
        saveState();
    });
    addListener('pitcher-k-home', 'input', function(e) {
        if (!state.pitcherStats) state.pitcherStats = { home: { innings: 0, strikeouts: 0, runs: 0 }, away: { innings: 0, strikeouts: 0, runs: 0 } };
        state.pitcherStats.home.strikeouts = parseInt(e.target.value) || 0;
        saveState();
    });
    addListener('pitcher-runs-home', 'input', function(e) {
        if (!state.pitcherStats) state.pitcherStats = { home: { innings: 0, strikeouts: 0, runs: 0 }, away: { innings: 0, strikeouts: 0, runs: 0 } };
        state.pitcherStats.home.runs = parseInt(e.target.value) || 0;
        saveState();
    });
}

/**
 * 打順入力フォームを生成
 */
function generateLineupInputs() {
    ['away', 'home'].forEach(team => {
        const container = document.getElementById(`lineup-input-${team}`);
        if (!container) return;
        
        container.innerHTML = '';
        
        // 1-9番の入力欄
        for (let i = 0; i < 9; i++) {
            const row = document.createElement('div');
            row.className = 'lineup-input-row';
            
            // 打順番号
            const num = document.createElement('span');
            num.className = 'lineup-num';
            num.textContent = (i + 1);
            row.appendChild(num);
            
            // 守備位置セレクト
            const posSelect = document.createElement('select');
            posSelect.className = 'lineup-input-pos';
            posSelect.dataset.team = team;
            posSelect.dataset.order = i;
            
            POSITIONS.forEach(pos => {
                const opt = document.createElement('option');
                opt.value = pos;
                opt.textContent = pos;
                if (state.positions && state.positions[team][i] === pos) {
                    opt.selected = true;
                }
                posSelect.appendChild(opt);
            });
            row.appendChild(posSelect);
            
            // 選手名入力
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'lineup-input-name';
            nameInput.dataset.team = team;
            nameInput.dataset.order = i;
            nameInput.value = state.lineup[team][i] || '';
            nameInput.placeholder = '選手名';
            row.appendChild(nameInput);
            
            container.appendChild(row);
        }

        // ----------------------------------------
        // 投手入力欄 (DH用)
        // ----------------------------------------
        const pRow = document.createElement('div');
        pRow.className = 'lineup-input-row pitcher-row';
        pRow.style.marginTop = '10px';
        pRow.style.paddingTop = '10px';
        pRow.style.borderTop = '1px dashed #ccc';
        
        // ラベル
        const pLabel = document.createElement('span');
        pLabel.className = 'lineup-num';
        pLabel.textContent = 'P'; // 投
        pLabel.style.fontWeight = 'bold';
        pLabel.style.color = '#e74c3c';
        pRow.appendChild(pLabel);
        
        // 守備位置固定表示
        const pPos = document.createElement('span');
        pPos.className = 'lineup-pos-fixed';
        pPos.textContent = '投';
        pPos.style.display = 'inline-block';
        pPos.style.width = '50px'; // selectの幅に合わせる調整
        pPos.style.textAlign = 'center';
        pRow.appendChild(pPos);
        
        // 投手名入力
        const pInput = document.createElement('input');
        pInput.type = 'text';
        pInput.className = 'lineup-input-pitcher'; // 識別用クラス
        pInput.dataset.team = team;
        pInput.value = state.pitcher ? (state.pitcher[team] || '') : '';
        pInput.placeholder = '投手名（DH制・先発）';
        pRow.appendChild(pInput);
        
        container.appendChild(pRow);
    });
}

/**
 * 打順入力ハンドラ
 */
function handleLineupInput(e) {
    // 選手名変更
    if (e.target.classList.contains('lineup-input-name')) {
        const team = e.target.dataset.team;
        const order = parseInt(e.target.dataset.order);
        state.lineup[team][order] = e.target.value;
        updateLineupDisplay();
        updateCurrentBatterDisplay();
        saveState();
    }
    // 守備位置変更
    else if (e.target.classList.contains('lineup-input-pos')) {
        const team = e.target.dataset.team;
        const order = parseInt(e.target.dataset.order);
        
        // positionsオブジェクトがない場合の初期化（既存データ互換性のため）
        if (!state.positions) {
            state.positions = {
                home: ['投', '捕', '一', '二', '三', '遊', '左', '中', '右'],
                away: ['投', '捕', '一', '二', '三', '遊', '左', '中', '右']
            };
        }
        
        state.positions[team][order] = e.target.value;
        updateLineupDisplay();
        updateBottomStats(); // 守備位置変更で投手が打順に入った場合の反映
        saveState();
    }
    // 投手名変更（DH用）
    else if (e.target.classList.contains('lineup-input-pitcher')) {
        const team = e.target.dataset.team;
        if (!state.pitcher) state.pitcher = { home: '', away: '' };
        state.pitcher[team] = e.target.value;
        updateBottomStats(); // 投手名変更の即時反映
        saveState();
    }
}

/**
 * 打席結果を記録
 */
function recordAtBatResult(resultCode) {
    const team = state.inning.half === 'top' ? 'away' : 'home';
    const batterIndex = state.currentBatter[team];
    // 結果を保存
    // state.currentBatter は「現在の打者」を指している状態
    // 結果入力→確定なので、現在の打者の履歴に追加する
    state.atBatResults[team][batterIndex].push(resultCode);
    
    // 履歴に追加（Undo用）
    state.resultHistory.push({
        type: 'atBat',
        team: team,
        batterIndex: batterIndex,
        result: resultCode,
        runnersBefore: {...state.runners},
        countBefore: {...state.count},
        scoreBefore: {...state.scores}, // 簡易的
        outsBefore: state.count.out
    });
    
    // 結果イベントをブロードキャスト（アニメーション用）
    broadcastResultEvent(resultCode);

    // ヒット系の場合、H+1
    if (['single', 'double', 'triple', 'homerun'].includes(resultCode)) {
        state.stats[team].h++;
    }
    
    // カウントリセット
    resetCount();
    
    // 次の打者へ進める
    state.currentBatter[team] = (state.currentBatter[team] + 1) % 9;
    
    // 表示更新 & 保存
    updateDisplay();
    saveState();
}

/**
 * 結果イベントをブロードキャスト
 */
function broadcastResultEvent(result) {
    if (broadcastChannel && isAdminMode) {
        broadcastChannel.postMessage({
            type: 'SHOW_RESULT',
            result: result,
            timestamp: Date.now()
        });
    }
}

/**
 * 結果アニメーション表示 (index.html用)
 */
function showResultAnimation(resultCode) {
    var overlay = document.getElementById('result-overlay');
    var textEl = document.getElementById('result-text');
    if (!overlay || !textEl) return;
    
    // テキスト設定
    // 英語表記に変換などが望ましいが、一旦ラベルまたはコードを使用
    // RESULT_LABELS は日本語短縮形なので、英語用マッピングを定義するか、
    // ここで変換する
    var text = formatResultForAnimation(resultCode);
    textEl.textContent = text;
    
    // クラスリセット
    textEl.className = 'result-text';
    void textEl.offsetWidth; // リフロー強制
    
    // 色クラス追加
    if (['single', 'double', 'triple'].includes(resultCode)) {
        textEl.classList.add('res-hit');
    } else if (resultCode === 'homerun') {
        textEl.classList.add('res-homerun');
    } else if (['strikeout', 'groundout', 'flyout', 'lineout', 'dp'].includes(resultCode)) {
        textEl.classList.add('res-out');
    }
    
    // アニメーション開始
    overlay.classList.add('active'); // 親要素のアクティブ化（必要なら）
    textEl.classList.add('result-animate');
    
    // アニメーション終了後のクリーンアップ
    setTimeout(() => {
        textEl.classList.remove('result-animate');
        overlay.classList.remove('active');
    }, 4500);
}

/**
 * アニメーション用テキスト変換
 */
function formatResultForAnimation(code) {
    const map = {
        'single': 'SINGLE',
        'double': 'DOUBLE',
        'triple': 'TRIPLE',
        'homerun': 'HOMERUN',
        'walk': 'WALK',
        'hbp': 'HIT BY PITCH',
        'error': 'ERROR',
        'strikeout': 'STRIKEOUT',
        'groundout': 'OUT',
        'flyout': 'OUT',
        'lineout': 'OUT',
        'sacrifice': 'SACRIFICE',
        'fc': 'FIELDER CHOICE',
        'dp': 'DOUBLE PLAY'
    };
    return map[code] || code.toUpperCase();
}

/**
 * 直前の結果を取り消す
 */
function undoLastResult() {
    if (state.resultHistory.length === 0) {
        alert('取り消す結果がありません。');
        return;
    }
    
    const lastResult = state.resultHistory.pop();
    const { team, batterIndex, result } = lastResult;
    
    // 結果を削除
    const results = state.atBatResults[team][batterIndex];
    const idx = results.lastIndexOf(result);
    if (idx !== -1) {
        results.splice(idx, 1);
    }
    
    // ヒット系の場合、H-1
    if (['single', 'double', 'triple', 'homerun'].includes(result)) {
        if (state.stats[team].h > 0) {
            state.stats[team].h--;
        }
    }
    
    // 打者を戻す
    state.currentBatter[team] = batterIndex;
    
    updateDisplay();
    saveState();
}

// ==================== ヘルパー関数 ====================
/**
 * カウントをリセット（打席交代時）
 */
function resetCount() {
    state.count.ball = 0;
    state.count.strike = 0;
}

/**
 * アウトを追加（3アウトでイニング進行）
 */
function addOut() {
    state.count.out++;
    resetCount();
    if (state.count.out >= 3) {
        // 3アウトチェンジ
        state.count.out = 0;
        clearRunners();
        advanceInning();
    }
}

/**
 * ランナーをクリア
 */
function clearRunners() {
    state.runners.first = false;
    state.runners.second = false;
    state.runners.third = false;
}

/**
 * イニングを進める
 */
function advanceInning() {
    if (state.inning.half === 'top') {
        state.inning.half = 'bottom';
    } else {
        state.inning.half = 'top';
        if (state.inning.number < 12) {
            state.inning.number++;
        }
    }
}


