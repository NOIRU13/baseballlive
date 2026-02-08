/**
 * 野球スコアボード - メインスクリプト (Refactored)
 */
import * as Constants from './data/constants.js';
import * as State from './data/state.js';
import * as GameLogic from './logic/game.js';
import * as Render from './ui/render.js';
import * as Sync from './infra/sync.js';

// ==================== 初期化 ====================
document.addEventListener('DOMContentLoaded', async () => {
    // ページモード判定
    checkPageMode();
    
    // 状態の読み込み
    await State.loadState();
    
    // 管理モードの場合は入力フォーム生成
    if (State.isAdminMode) {
        Render.generateLineupInputs(State.state);
    }
    
    // UIの更新
    Render.updateDisplay(State.state, State.isAdminMode, State.isDisplayMode);
    
    // イベントリスナーの設定（管理モードのみ）
    if (State.isAdminMode) {
        setupEventListeners();
    }
    
    // BroadcastChannelの設定
    // 受信時のコールバックもここで定義
    Sync.setupBroadcastChannel(
        State.isAdminMode,
        (newState) => { // onStateUpdate
            State.setState(newState);
            Render.updateDisplay(State.state, State.isAdminMode, State.isDisplayMode);
        },
        (result) => { // onResult
            Render.showResultAnimation(result);
        }
    );
    
    // 表示モードの場合、定期的に同期（フォールバック）
    if (State.isDisplayMode) {
        setupStorageSync();
    }
});

/**
 * ページモードを判定
 */
function checkPageMode() {
    const isAdmin = document.body.classList.contains('admin-mode');
    const isDisplay = document.body.classList.contains('display-mode');
    State.setAdminMode(isAdmin);
    State.setDisplayMode(isDisplay);
    
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    if (mode === 'overlay') {
        document.body.classList.add('overlay-mode');
    }
}

/**
 * 表示モード用：定期的に状態を同期（フォールバック）
 */
function setupStorageSync() {
    setInterval(async () => {
        await State.loadState();
        Render.updateDisplay(State.state, State.isAdminMode, State.isDisplayMode);
    }, 2000);
}

// ==================== イベントリスナー ====================
function setupEventListeners() {
    function addListener(id, event, handler) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    }

    // チーム名変更
    addListener('away-name', 'input', (e) => {
        State.state.teams.away = e.target.value || Constants.DEFAULT_STATE.teams.away;
        updateAndSave();
    });
    
    addListener('home-name', 'input', (e) => {
        State.state.teams.home = e.target.value || Constants.DEFAULT_STATE.teams.home;
        updateAndSave();
    });
    
    // ボール
    addListener('btn-ball', 'click', () => {
        State.state.count.ball++;
        GameLogic.incrementPitchCount(State.state);
        if (State.state.count.ball >= 4) {
            State.state.runners.first = true;
            GameLogic.resetCount(State.state);
            nextBatter();
        }
        updateAndSave();
    });
    
    addListener('btn-ball-reset', 'click', () => {
        State.state.count.ball = 0;
        updateAndSave();
    });
    
    // ストライク
    addListener('btn-strike', 'click', () => {
        State.state.count.strike++;
        GameLogic.incrementPitchCount(State.state);
        if (State.state.count.strike >= 3) {
            GameLogic.recordStrikeout(State.state);
            const isChange = GameLogic.addOut(State.state);
            if (!isChange) nextBatter(); 
            // チェンジの場合は nextBatter() しない（攻撃側が変わるので、そのイニングの先頭打者になる。
            // advanceInning内で currentBatter のリセットはしていないので、
            // 前のイニングの続きからになるはず（野球のルール）。
            // なので、チェンジ時は単に currentBatter を進めなければよい。
        }
        updateAndSave();
    });
    
    addListener('btn-strike-reset', 'click', () => {
        State.state.count.strike = 0;
        updateAndSave();
    });
    
    // アウト
    addListener('btn-out', 'click', () => {
        GameLogic.addOut(State.state);
        updateAndSave();
    });
    
    addListener('btn-out-reset', 'click', () => {
        State.state.count.out = 0;
        updateAndSave();
    });
    
    // カウントリセット
    addListener('btn-count-reset', 'click', () => {
        GameLogic.resetCount(State.state);
        updateAndSave();
    });
    
    // ランナー
    addListener('btn-runner-1', 'click', () => {
        State.state.runners.first = !State.state.runners.first;
        updateAndSave();
    });
    addListener('btn-runner-2', 'click', () => {
        State.state.runners.second = !State.state.runners.second;
        updateAndSave();
    });
    addListener('btn-runner-3', 'click', () => {
        State.state.runners.third = !State.state.runners.third;
        updateAndSave();
    });
    addListener('btn-runner-clear', 'click', () => {
        GameLogic.clearRunners(State.state);
        updateAndSave();
    });
    
    // イニング操作
    addListener('btn-inning-prev', 'click', () => {
        if (State.state.inning.half === 'bottom') {
            State.state.inning.half = 'top';
        } else if (State.state.inning.number > 1) {
            State.state.inning.number--;
            State.state.inning.half = 'bottom';
        }
        updateAndSave();
    });
    
    addListener('btn-inning-next', 'click', () => {
        GameLogic.advanceInning(State.state);
        updateAndSave();
    });
    
    // 得点操作
    addListener('btn-score-plus', 'click', () => {
        const inningIndex = State.state.inning.number - 1;
        const team = State.state.inning.half === 'top' ? 'away' : 'home';
        State.state.scores[team][inningIndex]++;
        updateAndSave();
    });
    
    addListener('btn-score-minus', 'click', () => {
        const inningIndex = State.state.inning.number - 1;
        const team = State.state.inning.half === 'top' ? 'away' : 'home';
        if (State.state.scores[team][inningIndex] > 0) {
            State.state.scores[team][inningIndex]--;
        }
        updateAndSave();
    });
    
    // R/H/E操作
    document.querySelectorAll('[data-team][data-stat]').forEach(btn => {
        btn.addEventListener('click', () => {
            const team = btn.dataset.team;
            const stat = btn.dataset.stat;
            const action = btn.dataset.action;
            
            if (action === 'minus') {
                if (State.state.stats[team][stat] > 0) {
                    State.state.stats[team][stat]--;
                }
            } else {
                State.state.stats[team][stat]++;
            }
            updateAndSave();
        });
    });
    
    // 試合リセット
    addListener('btn-reset-game', 'click', () => {
        if (confirm('\u672C\u5F53\u306B\u8A66\u5408\u30C7\u30FC\u30BF\u3092\u30EA\u30BB\u30C3\u30C8\u3057\u307E\u3059\u304B\uFF1F\n\u3053\u306E\u64CD\u4F5C\u306F\u53D6\u308A\u6D88\u305B\u307E\u305B\u3093\u3002')) {
            State.resetState();
            Render.generateLineupInputs(State.state);
            updateAndSave();
        }
    });

    // 打順入力イベント（委譲）
    addListener('lineup-input-away', 'input', handleLineupInput);
    addListener('lineup-input-home', 'input', handleLineupInput);
    addListener('lineup-input-away', 'change', handleLineupInput);
    addListener('lineup-input-home', 'change', handleLineupInput);
    
    // 打席結果ボタン
    document.querySelectorAll('[data-result]').forEach(btn => {
        btn.addEventListener('click', () => {
            const result = btn.dataset.result;
            GameLogic.recordAtBatResult(State.state, result);
            Sync.broadcastResultEvent(result, State.isAdminMode);
            updateAndSave();
        });
    });
    
    // 前の打者/次の打者
    addListener('btn-prev-batter', 'click', () => {
        const team = State.state.inning.half === 'top' ? 'away' : 'home';
        let prevBatterIndex = State.state.currentBatter[team] - 1;
        if (prevBatterIndex < 0) prevBatterIndex = 8;
        State.state.currentBatter[team] = prevBatterIndex;
        updateAndSave();
    });
    
    addListener('btn-next-batter', 'click', () => {
        nextBatter();
        updateAndSave();
    });
    
    // Undo
    addListener('btn-undo-result', 'click', () => {
        const success = GameLogic.undoLastResult(State.state);
        if (!success) {
            alert('取り消す結果がありません。');
        } else {
            updateAndSave();
        }
    });
    
    // 投手成績入力
    const pitcherInputs = [
        { id: 'pitcher-innings-away', team: 'away', prop: 'innings', parse: parseFloat },
        { id: 'pitcher-k-away', team: 'away', prop: 'strikeouts', parse: parseInt },
        { id: 'pitcher-runs-away', team: 'away', prop: 'runs', parse: parseInt },
        { id: 'pitcher-innings-home', team: 'home', prop: 'innings', parse: parseFloat },
        { id: 'pitcher-k-home', team: 'home', prop: 'strikeouts', parse: parseInt },
        { id: 'pitcher-runs-home', team: 'home', prop: 'runs', parse: parseInt }
    ];
    
    pitcherInputs.forEach(input => {
        addListener(input.id, 'input', (e) => {
            if (!State.state.pitcherStats) {
                State.state.pitcherStats = JSON.parse(JSON.stringify(Constants.DEFAULT_STATE.pitcherStats));
            }
            State.state.pitcherStats[input.team][input.prop] = input.parse(e.target.value) || 0;
            State.saveState();
        });
    });
}

function handleLineupInput(e) {
    if (e.target.classList.contains('lineup-input-name')) {
        const team = e.target.dataset.team;
        const order = parseInt(e.target.dataset.order);
        State.state.lineup[team][order] = e.target.value;
        Render.updateLineupDisplay(State.state, State.isAdminMode);
        Render.updateCurrentBatterDisplay(State.state, State.isAdminMode);
        State.saveState();
    }
    else if (e.target.classList.contains('lineup-input-pos')) {
        const team = e.target.dataset.team;
        const order = parseInt(e.target.dataset.order);
        
        if (!State.state.positions) {
            State.state.positions = JSON.parse(JSON.stringify(Constants.DEFAULT_STATE.positions));
        }
        
        State.state.positions[team][order] = e.target.value;
        Render.updateLineupDisplay(State.state, State.isAdminMode);
        Render.updateBottomStats(State.state, State.isDisplayMode);
        State.saveState();
    }
    else if (e.target.classList.contains('lineup-input-pitcher')) {
        const team = e.target.dataset.team;
        if (!State.state.pitcher) State.state.pitcher = { home: '', away: '' };
        State.state.pitcher[team] = e.target.value;
        Render.updateBottomStats(State.state, State.isDisplayMode); // 投手名変更の即時反映(Admin画面でBottomは出ないかもしれないが)
        State.saveState();
    }
}

function updateAndSave() {
    Render.updateDisplay(State.state, State.isAdminMode, State.isDisplayMode);
    State.saveState();
}

function nextBatter() {
    const team = State.state.inning.half === 'top' ? 'away' : 'home';
    State.state.currentBatter[team] = (State.state.currentBatter[team] + 1) % 9;
}
