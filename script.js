/**
 * 野球スコアボード - メインスクリプト
 * OBS Studio ブラウザソース用
 */

// ==================== データモデル ====================
const DEFAULT_STATE = {
    teams: {
        home: 'ホーム',
        away: 'アウェイ'
    },
    inning: {
        number: 1,
        half: 'top' // 'top' = 表, 'bottom' = 裏
    },
    // 各イニングの得点（最大12イニング分）
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
    resultHistory: []
};

// 打席結果のラベルマッピング
const RESULT_LABELS = {
    'single': '単',
    'double': '2',
    'triple': '3',
    'homerun': 'HR',
    'walk': '四',
    'hbp': '死',
    'error': 'E',
    'strikeout': 'K',
    'groundout': 'ゴ',
    'flyout': 'フ',
    'lineout': 'ラ',
    'sacrifice': '犠',
    'fc': 'FC',
    'dp': '併'
};

// 現在の状態
let state = {};

// LocalStorageキー（フォールバック用）
const STORAGE_KEY = 'baseballScoreboard';

// API設定
const API_BASE_URL = 'http://localhost:3000/api';
let useAPI = true; // APIが利用可能かどうか

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
    
    // 表示モードの場合、定期的に同期
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
 * 表示モード用：定期的に状態を同期
 */
function setupStorageSync() {
    // 定期的に状態を確認
    setInterval(async () => {
        await loadState();
        updateDisplay();
    }, 500); // 500msごとにチェック
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
}

/**
 * チーム名の表示を更新
 */
function updateTeamDisplay() {
    document.querySelector('#team-away-display .team-name').textContent = state.teams.away;
    document.querySelector('#team-home-display .team-name').textContent = state.teams.home;
}

/**
 * イニング表示を更新
 */
function updateInningDisplay() {
    const halfSymbol = state.inning.half === 'top' ? '▲' : '▼';
    document.getElementById('inning-half').textContent = halfSymbol;
    document.getElementById('inning-number').textContent = state.inning.number;
    
    // 管理パネルの表示も更新
    const halfText = state.inning.half === 'top' ? '表' : '裏';
    document.getElementById('inning-info').textContent = `${state.inning.number}回 ${halfText}`;
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
    document.getElementById('runner-first').classList.toggle('active', state.runners.first);
    document.getElementById('runner-second').classList.toggle('active', state.runners.second);
    document.getElementById('runner-third').classList.toggle('active', state.runners.third);
}

/**
 * 得点表示を更新
 */
function updateScoreDisplay() {
    // 合計得点を計算
    const awayTotal = state.scores.away.reduce((sum, score) => sum + score, 0);
    const homeTotal = state.scores.home.reduce((sum, score) => sum + score, 0);
    
    document.getElementById('away-total').textContent = awayTotal;
    document.getElementById('home-total').textContent = homeTotal;
    
    // R（得点）の更新
    state.stats.away.r = awayTotal;
    state.stats.home.r = homeTotal;
}

/**
 * R/H/E表示を更新
 */
function updateRHEDisplay() {
    document.getElementById('away-r').textContent = state.stats.away.r;
    document.getElementById('away-h').textContent = state.stats.away.h;
    document.getElementById('away-e').textContent = state.stats.away.e;
    
    document.getElementById('home-r').textContent = state.stats.home.r;
    document.getElementById('home-h').textContent = state.stats.home.h;
    document.getElementById('home-e').textContent = state.stats.home.e;
}

/**
 * 管理パネルの表示を更新
 */
function updateControlPanel() {
    // チーム名入力
    document.getElementById('away-name').value = state.teams.away;
    document.getElementById('home-name').value = state.teams.home;
    
    // ランナーボタンの状態
    document.getElementById('btn-runner-1').classList.toggle('active', state.runners.first);
    document.getElementById('btn-runner-2').classList.toggle('active', state.runners.second);
    document.getElementById('btn-runner-3').classList.toggle('active', state.runners.third);
    
    // 現在の攻撃チーム表示
    const attackingTeam = state.inning.half === 'top' ? state.teams.away : state.teams.home;
    document.getElementById('scoring-team-label').textContent = `${attackingTeam}（攻撃中）`;
    
    // 現在イニングの得点
    const inningIndex = state.inning.number - 1;
    const currentScore = state.inning.half === 'top' 
        ? state.scores.away[inningIndex] 
        : state.scores.home[inningIndex];
    document.getElementById('current-inning-score').textContent = currentScore;
}

/**
 * 打順入力フォームを生成
 */
function generateLineupInputs() {
    ['away', 'home'].forEach(team => {
        const container = document.getElementById(`lineup-input-${team}`);
        container.innerHTML = '';
        
        for (let i = 0; i < 9; i++) {
            const row = document.createElement('div');
            row.className = 'lineup-input-row';
            row.innerHTML = `
                <span class="lineup-input-order">${i + 1}</span>
                <input type="text" 
                       class="lineup-input-name" 
                       data-team="${team}" 
                       data-order="${i}"
                       placeholder="${i + 1}番打者"
                       maxlength="10"
                       value="${state.lineup[team][i] || ''}">
            `;
            container.appendChild(row);
        }
    });
}

/**
 * 打順ボードの表示を更新
 */
function updateLineupDisplay() {
    // チーム名更新
    document.getElementById('lineup-away-name').textContent = state.teams.away;
    document.getElementById('lineup-home-name').textContent = state.teams.home;
    
    ['away', 'home'].forEach(team => {
        const container = document.getElementById(`${team}-lineup`);
        container.innerHTML = '';
        
        const currentBatterIndex = state.currentBatter[team];
        const isAttacking = (state.inning.half === 'top' && team === 'away') ||
                           (state.inning.half === 'bottom' && team === 'home');
        
        for (let i = 0; i < 9; i++) {
            const playerName = state.lineup[team][i] || `${i + 1}番`;
            const results = state.atBatResults[team][i] || [];
            const isActive = isAttacking && i === currentBatterIndex;
            
            const playerDiv = document.createElement('div');
            playerDiv.className = `lineup-player${isActive ? ' active' : ''}`;
            
            // 結果バッジのHTML生成
            const resultBadges = results.map(result => 
                `<span class="result-badge ${result}">${RESULT_LABELS[result] || result}</span>`
            ).join('');
            
            playerDiv.innerHTML = `
                <span class="player-order">${i + 1}</span>
                <span class="player-name">${playerName}</span>
                <div class="player-results">${resultBadges}</div>
            `;
            container.appendChild(playerDiv);
        }
    });
}

/**
 * 現在の打者情報を更新
 */
function updateCurrentBatterDisplay() {
    const team = state.inning.half === 'top' ? 'away' : 'home';
    const batterIndex = state.currentBatter[team];
    const batterName = state.lineup[team][batterIndex] || '---';
    
    document.getElementById('current-batter-order').textContent = batterIndex + 1;
    document.getElementById('current-batter-name').textContent = batterName;
}

// ==================== イベントリスナー ====================
function setupEventListeners() {
    // チーム名変更
    document.getElementById('away-name').addEventListener('input', (e) => {
        state.teams.away = e.target.value || 'アウェイ';
        updateDisplay();
        saveState();
    });
    
    document.getElementById('home-name').addEventListener('input', (e) => {
        state.teams.home = e.target.value || 'ホーム';
        updateDisplay();
        saveState();
    });
    
    // ボール
    document.getElementById('btn-ball').addEventListener('click', () => {
        if (state.count.ball < 3) {
            state.count.ball++;
            if (state.count.ball >= 3) {
                // フォアボール（4つ目のボール） - カウントリセット
                resetCount();
            }
        }
        updateDisplay();
        saveState();
    });
    
    document.getElementById('btn-ball-reset').addEventListener('click', () => {
        state.count.ball = 0;
        updateDisplay();
        saveState();
    });
    
    // ストライク
    document.getElementById('btn-strike').addEventListener('click', () => {
        if (state.count.strike < 2) {
            state.count.strike++;
            if (state.count.strike >= 2) {
                // 三振（3つ目のストライク） - アウト追加 & カウントリセット
                addOut();
            }
        }
        updateDisplay();
        saveState();
    });
    
    document.getElementById('btn-strike-reset').addEventListener('click', () => {
        state.count.strike = 0;
        updateDisplay();
        saveState();
    });
    
    // アウト
    document.getElementById('btn-out').addEventListener('click', () => {
        addOut();
        updateDisplay();
        saveState();
    });
    
    document.getElementById('btn-out-reset').addEventListener('click', () => {
        state.count.out = 0;
        updateDisplay();
        saveState();
    });
    
    // カウントリセット（打席交代）
    document.getElementById('btn-count-reset').addEventListener('click', () => {
        resetCount();
        updateDisplay();
        saveState();
    });
    
    // ランナー
    document.getElementById('btn-runner-1').addEventListener('click', () => {
        state.runners.first = !state.runners.first;
        updateDisplay();
        saveState();
    });
    
    document.getElementById('btn-runner-2').addEventListener('click', () => {
        state.runners.second = !state.runners.second;
        updateDisplay();
        saveState();
    });
    
    document.getElementById('btn-runner-3').addEventListener('click', () => {
        state.runners.third = !state.runners.third;
        updateDisplay();
        saveState();
    });
    
    document.getElementById('btn-runner-clear').addEventListener('click', () => {
        state.runners.first = false;
        state.runners.second = false;
        state.runners.third = false;
        updateDisplay();
        saveState();
    });
    
    // イニング操作
    document.getElementById('btn-inning-prev').addEventListener('click', () => {
        if (state.inning.half === 'bottom') {
            state.inning.half = 'top';
        } else if (state.inning.number > 1) {
            state.inning.number--;
            state.inning.half = 'bottom';
        }
        updateDisplay();
        saveState();
    });
    
    document.getElementById('btn-inning-next').addEventListener('click', () => {
        advanceInning();
        updateDisplay();
        saveState();
    });
    
    // 得点操作
    document.getElementById('btn-score-plus').addEventListener('click', () => {
        const inningIndex = state.inning.number - 1;
        const team = state.inning.half === 'top' ? 'away' : 'home';
        state.scores[team][inningIndex]++;
        updateDisplay();
        saveState();
    });
    
    document.getElementById('btn-score-minus').addEventListener('click', () => {
        const inningIndex = state.inning.number - 1;
        const team = state.inning.half === 'top' ? 'away' : 'home';
        if (state.scores[team][inningIndex] > 0) {
            state.scores[team][inningIndex]--;
        }
        updateDisplay();
        saveState();
    });
    
    // R/H/E操作
    document.querySelectorAll('[data-team][data-stat]').forEach(btn => {
        btn.addEventListener('click', () => {
            const team = btn.dataset.team;
            const stat = btn.dataset.stat;
            const action = btn.dataset.action;
            
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
    document.getElementById('btn-reset-game').addEventListener('click', () => {
        if (confirm('本当に試合データをリセットしますか？\nこの操作は取り消せません。')) {
            state = JSON.parse(JSON.stringify(DEFAULT_STATE));
            generateLineupInputs();
            updateDisplay();
            saveState();
        }
    });
    
    // ==================== 打順関連イベント ====================
    
    // 打順入力タブ切り替え
    document.getElementById('btn-tab-away-lineup').addEventListener('click', () => {
        document.getElementById('btn-tab-away-lineup').classList.add('active');
        document.getElementById('btn-tab-home-lineup').classList.remove('active');
        document.getElementById('lineup-input-away').classList.add('active');
        document.getElementById('lineup-input-home').classList.remove('active');
    });
    
    document.getElementById('btn-tab-home-lineup').addEventListener('click', () => {
        document.getElementById('btn-tab-home-lineup').classList.add('active');
        document.getElementById('btn-tab-away-lineup').classList.remove('active');
        document.getElementById('lineup-input-home').classList.add('active');
        document.getElementById('lineup-input-away').classList.remove('active');
    });
    
    // 選手名入力
    document.querySelectorAll('.lineup-input-name').forEach(input => {
        input.addEventListener('input', (e) => {
            const team = e.target.dataset.team;
            const order = parseInt(e.target.dataset.order);
            state.lineup[team][order] = e.target.value;
            updateLineupDisplay();
            updateCurrentBatterDisplay();
            saveState();
        });
    });
    
    // 動的に生成された打順入力にもイベントを設定
    document.getElementById('lineup-input-away').addEventListener('input', handleLineupInput);
    document.getElementById('lineup-input-home').addEventListener('input', handleLineupInput);
    
    // 打席結果ボタン
    document.querySelectorAll('[data-result]').forEach(btn => {
        btn.addEventListener('click', () => {
            const result = btn.dataset.result;
            recordAtBatResult(result);
        });
    });
    
    // 前の打者/次の打者
    document.getElementById('btn-prev-batter').addEventListener('click', () => {
        const team = state.inning.half === 'top' ? 'away' : 'home';
        state.currentBatter[team] = (state.currentBatter[team] - 1 + 9) % 9;
        updateDisplay();
        saveState();
    });
    
    document.getElementById('btn-next-batter').addEventListener('click', () => {
        const team = state.inning.half === 'top' ? 'away' : 'home';
        state.currentBatter[team] = (state.currentBatter[team] + 1) % 9;
        updateDisplay();
        saveState();
    });
    
    // 結果取り消し
    document.getElementById('btn-undo-result').addEventListener('click', () => {
        undoLastResult();
    });
}

/**
 * 打順入力ハンドラ
 */
function handleLineupInput(e) {
    if (e.target.classList.contains('lineup-input-name')) {
        const team = e.target.dataset.team;
        const order = parseInt(e.target.dataset.order);
        state.lineup[team][order] = e.target.value;
        updateLineupDisplay();
        updateCurrentBatterDisplay();
        saveState();
    }
}

/**
 * 打席結果を記録
 */
function recordAtBatResult(result) {
    const team = state.inning.half === 'top' ? 'away' : 'home';
    const batterIndex = state.currentBatter[team];
    
    // 結果を追加
    state.atBatResults[team][batterIndex].push(result);
    
    // 履歴に追加（取り消し用）
    state.resultHistory.push({
        team: team,
        batterIndex: batterIndex,
        result: result
    });
    
    // ヒット系の場合、H+1
    if (['single', 'double', 'triple', 'homerun'].includes(result)) {
        state.stats[team].h++;
    }
    
    // カウントリセット
    resetCount();
    
    // 次の打者へ進める
    state.currentBatter[team] = (state.currentBatter[team] + 1) % 9;
    
    updateDisplay();
    saveState();
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
    if (state.count.out < 2) {
        state.count.out++;
        resetCount();
    } else {
        // 3アウトチェンジ
        state.count.out = 0;
        resetCount();
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
