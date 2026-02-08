/**
 * 野球スコアボード - メインスクリプト (Refactored)
 */
import * as Constants from './data/constants.js';
import * as State from './data/state.js';
import * as GameLogic from './logic/game.js';
import * as Render from './ui/render.js';
import * as Sync from './infra/sync.js';

// ==================== 初期化 ====================
let gameId = 1; // Default Game ID for now
let allPlayers = []; // 全選手データ
let allTeams = []; // 全チームデータ
let teamSelections = {away: null, home: null}; // 選択されたチームID

document.addEventListener('DOMContentLoaded', async () => {
    // ページモード判定
    checkPageMode();
    
    // 状態の読み込み
    await State.loadState();
    
    // DBからマスタデータ読み込み
    await loadMasterData();
    
    // 管理モードの場合は入力フォーム生成
    if (State.isAdminMode) {
        // チームプルダウンを初期化
        populateTeamSelects();
        Render.generateLineupInputs(State.state, allPlayers, teamSelections);

        // スコア計測の初期化（未設定の場合）
        if (State.state.scoreAtStartOfAtBat === undefined) {
             const currentTeam = State.state.inning.half === 'top' ? 'away' : 'home';
             State.state.scoreAtStartOfAtBat = getTotalScore(State.state, currentTeam);
        }
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
 * 表示モード用：定期的にAPIから状態を同期
 * OBSなど別ブラウザからのアクセスでもリアルタイム反映される
 */
let lastResultTimestamp = 0; // 結果アニメーション重複防止用

function setupStorageSync() {
    // 初期値を設定（既にstateにlastResultがあれば記録しておく）
    if (State.state.lastResult && State.state.lastResult.timestamp) {
        lastResultTimestamp = State.state.lastResult.timestamp;
    }

    setInterval(async () => {
        await State.loadState();
        Render.updateDisplay(State.state, State.isAdminMode, State.isDisplayMode);

        // 新しい結果イベントがあればアニメーション表示
        if (State.state.lastResult && State.state.lastResult.timestamp > lastResultTimestamp) {
            lastResultTimestamp = State.state.lastResult.timestamp;
            Render.showResultAnimation(State.state.lastResult.type);
        }
    }, 500);
}

// ==================== イベントリスナー ====================
function setupEventListeners() {
    function addListener(id, event, handler) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    }

    // 打順保存ボタン (admin-lineup.html)
    addListener('btn-save-lineup', 'click', () => {
        // 全selectから最新値を収集してstateに反映
        ['away', 'home'].forEach(team => {
            for (let i = 0; i < 9; i++) {
                const nameEl = document.querySelector(`.lineup-input-name[data-team="${team}"][data-order="${i}"]`);
                if (nameEl) State.state.lineup[team][i] = nameEl.value;
                const posEl = document.querySelector(`.lineup-input-pos[data-team="${team}"][data-order="${i}"]`);
                if (posEl) {
                    if (!State.state.positions) State.state.positions = JSON.parse(JSON.stringify(Constants.DEFAULT_STATE.positions));
                    State.state.positions[team][i] = posEl.value;
                }
            }
            const pitcherEl = document.querySelector(`.lineup-input-pitcher[data-team="${team}"]`);
            if (pitcherEl) {
                if (!State.state.pitcher) State.state.pitcher = { home: '', away: '' };
                const prevPitcher = State.state.pitcher[team];
                State.state.pitcher[team] = pitcherEl.value;
                // 投手が変わったら旧投手の成績をDB保存してからリセット
                if (prevPitcher && prevPitcher !== pitcherEl.value) {
                    savePitcherStatsToDB(team, prevPitcher);
                    resetPitcherTodayStats(team);
                }
            }
        });
        updateAndSave();
        // 保存完了フィードバック
        const status = document.getElementById('save-status');
        const btn = document.getElementById('btn-save-lineup');
        if (status) {
            status.textContent = '保存しました';
            status.style.opacity = '1';
            setTimeout(() => { status.style.opacity = '0'; }, 2000);
        }
        if (btn) {
            btn.classList.add('saved');
            setTimeout(() => { btn.classList.remove('saved'); }, 1000);
        }
    });

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
            State.resetState();
            Render.generateLineupInputs(State.state);
            const currentTeam = State.state.inning.half === 'top' ? 'away' : 'home';
            State.state.scoreAtStartOfAtBat = getTotalScore(State.state, currentTeam); // Reset score tracker
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
        btn.addEventListener('click', async () => {
            const result = btn.dataset.result;
            
            // 現在の打者・投手・イニング情報を取得
            const currentHalf = State.state.inning.half;
            const currentTeam = currentHalf === 'top' ? 'away' : 'home';
            const pitcherTeam = currentHalf === 'top' ? 'home' : 'away';
            
            const batterIndex = State.state.currentBatter[currentTeam];
            const batterName = State.state.lineup[currentTeam][batterIndex];
            const pitcherName = State.state.pitcher ? State.state.pitcher[pitcherTeam] : ''; 
            
            const batterId = State.playerMap[batterName];
            const pitcherId = State.playerMap[pitcherName];
            
            // 打点(RBI)の計算
            let rbi = 0;
            const currentTotalScore = getTotalScore(State.state, currentTeam);
            
            if (result === 'homerun') {
                // 本塁打の場合は、ランナー数＋１
                let runners = 0;
                if (State.state.runners.first) runners++;
                if (State.state.runners.second) runners++;
                if (State.state.runners.third) runners++;
                rbi = runners + 1;
            } else {
                // そうでない場合は、打席開始時からの得点増分
                const startScore = State.state.scoreAtStartOfAtBat !== undefined ? State.state.scoreAtStartOfAtBat : currentTotalScore;
                rbi = Math.max(0, currentTotalScore - startScore);
            }

            // todayRBIに加算
            if (!State.state.todayRBI) {
                State.state.todayRBI = JSON.parse(JSON.stringify(Constants.DEFAULT_STATE.todayRBI));
            }
            if (State.state.todayRBI[currentTeam][batterIndex] === undefined) {
                 State.state.todayRBI[currentTeam][batterIndex] = 0;
            }
            State.state.todayRBI[currentTeam][batterIndex] += rbi;

            // API送信
            if (batterId) {
                try {
                    await fetch('/api/atbats', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            game_id: gameId,
                            batter_id: batterId,
                            pitcher_id: pitcherId || null,
                            inning: State.state.inning.number,
                            half: currentHalf,
                            result_type: convertResultToDbType(result),
                            rbi: rbi, 
                            is_sac_fly: result === 'sacrifice' ? true : false, // 簡易
                            is_sac_bunt: false
                        })
                    });
                    console.log('Stats recorded for', batterName, 'RBI:', rbi);
                } catch (e) {
                    console.error('Failed to record stats', e);
                }
            } else {
                console.warn('Batter ID not found for:', batterName);
            }

            GameLogic.recordAtBatResult(State.state, result);
            Sync.broadcastResultEvent(result, State.isAdminMode, State.state);

            // 次の打者のためにスコアをリセット記録（HRの場合はrecordAtBatResultでスコアが増えるので再取得）
            // 注意: recordAtBatResult内で batterIndex が進んでいるため、
            // ここで取得する currentTotalScore は「次の打者」の開始時スコアとなる。
            const newTotalScore = getTotalScore(State.state, currentTeam);
            State.state.scoreAtStartOfAtBat = newTotalScore;
            
            updateAndSave();
        });
    });

function convertResultToDbType(type) {
    // Map button data-result to DB enum/varchar
    const map = {
        'single': 'Single', 'double': 'Double', 'triple': 'Triple', 'homerun': 'HR',
        'walk': 'Walk', 'hbp': 'HBP', 'error': 'Error',
        'strikeout': 'Strikeout', 'groundout': 'Groundout', 'flyout': 'Flyout', 'lineout': 'Lineout',
        'sacrifice': 'Sacrifice', 'fc': 'FC', 'dp': 'DP'
    };
    return map[type] || 'Out';
}

    
    // 前の打者/次の打者
    addListener('btn-prev-batter', 'click', () => {
        const team = State.state.inning.half === 'top' ? 'away' : 'home';
        let prevBatterIndex = State.state.currentBatter[team] - 1;
        if (prevBatterIndex < 0) prevBatterIndex = 8;
        State.state.currentBatter[team] = prevBatterIndex;
        // 打手変更時はスコアベースラインもリセット
        State.state.scoreAtStartOfAtBat = getTotalScore(State.state, team);
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
        const prevPitcher = State.state.pitcher[team];
        State.state.pitcher[team] = e.target.value;
        // 投手が変わったら旧投手の成績をDB保存してからリセット
        if (prevPitcher && prevPitcher !== e.target.value) {
            savePitcherStatsToDB(team, prevPitcher);
            resetPitcherTodayStats(team);
        }
        Render.updateBottomStats(State.state, State.isDisplayMode);
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
    
    // 次の打者のためのスコアベースラインを設定
    State.state.scoreAtStartOfAtBat = getTotalScore(State.state, team);
}

function getTotalScore(state, team) {
    return state.scores[team].reduce((sum, s) => sum + (s || 0), 0);
}

/**
 * 投手交代前に現投手の成績をDBに保存
 */
async function savePitcherStatsToDB(team, pitcherName) {
    const pitcherId = State.playerMap[pitcherName];
    const stats = State.state.pitcherStats && State.state.pitcherStats[team];
    if (!pitcherId || !stats) return;
    // 成績が全て0なら保存しない
    if (stats.innings === 0 && stats.strikeouts === 0 && stats.walks === 0 && stats.runs === 0 && stats.pitchCount === 0) return;
    try {
        await fetch('/api/game-pitcher-stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                game_id: gameId,
                pitcher_id: pitcherId,
                team: team,
                innings_pitched: stats.innings,
                strikeouts: stats.strikeouts,
                walks: stats.walks,
                runs_allowed: stats.runs,
                pitch_count: stats.pitchCount
            })
        });
        console.log('Pitcher stats saved for', pitcherName);
    } catch (e) {
        console.error('Failed to save pitcher stats', e);
    }
}

/**
 * 投手交代時に当日投手成績（IP, K, R, BB, 投球数, アウト数）をリセット
 */
function resetPitcherTodayStats(team) {
    if (!State.state.pitcherStats) {
        State.state.pitcherStats = JSON.parse(JSON.stringify(Constants.DEFAULT_STATE.pitcherStats));
    }
    
    // 相手チームの現在の総得点（＝自チーム投手の総失点）を取得
    const opposingTeam = team === 'home' ? 'away' : 'home';
    const currentTotalRuns = getTotalScore(State.state, opposingTeam);

    State.state.pitcherStats[team] = { 
        innings: 0, 
        strikeouts: 0, 
        walks: 0, 
        runs: 0, 
        pitchCount: 0, 
        outs: 0,
        runsAtStart: currentTotalRuns // 交代時点の失点を記録
    };
}

// Global variables for master data and selections (Moved to top)

/**
 * マスタデータをロードしてキャッシュする
 */
async function loadMasterData() {
    try {
        // 選手一覧取得
        const pRes = await fetch('/api/players');
        let pMap = {};
        if (pRes.ok) {
            const players = await pRes.json();
            allPlayers = players; // 全選手を保存
            players.forEach(p => {
                pMap[p.name] = p.id;
            });
        }
        
        // チーム一覧取得
        const tRes = await fetch('/api/teams');
        let tMap = {};
        if (tRes.ok) {
            const teams = await tRes.json();
            allTeams = teams; // 全チームを保存
            teams.forEach(t => {
                tMap[t.name] = t.id;
            });
        }
        
        State.setMasterData(pMap, tMap);
        console.log('Master data loaded', { playerRecords: Object.keys(pMap).length });
    } catch (e) {
        console.error('Failed to load master data', e);
    }
}

/**
 * チームプルダウンを初期化
 */
function populateTeamSelects() {
    const awaySelect = document.getElementById('away-team-select');
    const homeSelect = document.getElementById('home-team-select');
    
    if (!awaySelect || !homeSelect) return;
    
    // チームオプションを追加
    allTeams.forEach(team => {
        const awayOpt = document.createElement('option');
        awayOpt.value = team.id;
        awayOpt.textContent = team.name;
        awaySelect.appendChild(awayOpt);
        
        const homeOpt = document.createElement('option');
        homeOpt.value = team.id;
        homeOpt.textContent = team.name;
        homeSelect.appendChild(homeOpt);
    });

    // 初期値の設定 (保存された状態から復元)
    if (!State.state.teamShortNames) State.state.teamShortNames = { home: '', away: '' };
    let shortNamesUpdated = false;
    if (State.state.teams.away) {
        const awayTeam = allTeams.find(t => t.name === State.state.teams.away);
        if (awayTeam) {
            awaySelect.value = awayTeam.id;
            teamSelections.away = awayTeam.id;
            State.state.teamShortNames.away = awayTeam.short_name || awayTeam.name;
            shortNamesUpdated = true;
        }
    }
    if (State.state.teams.home) {
        const homeTeam = allTeams.find(t => t.name === State.state.teams.home);
        if (homeTeam) {
            homeSelect.value = homeTeam.id;
            teamSelections.home = homeTeam.id;
            State.state.teamShortNames.home = homeTeam.short_name || homeTeam.name;
            shortNamesUpdated = true;
        }
    }
    // 略称を即座に保存（表示ページで使えるように）
    if (shortNamesUpdated) {
        State.saveState();
    }

    // チーム選択時のイベントリスナー
    awaySelect.addEventListener('change', (e) => {
        teamSelections.away = e.target.value;
        // チーム名を更新
        const selectedTeam = allTeams.find(t => t.id === parseInt(e.target.value));
        if (selectedTeam) {
            State.state.teams.away = selectedTeam.name;
            if (!State.state.teamShortNames) State.state.teamShortNames = { home: '', away: '' };
            State.state.teamShortNames.away = selectedTeam.short_name || selectedTeam.name;
        }
        // 選手プルダウンを再生成
        Render.generateLineupInputs(State.state, allPlayers, teamSelections);
        updateAndSave();
    });

    homeSelect.addEventListener('change', (e) => {
        teamSelections.home = e.target.value;
        // チーム名を更新
        const selectedTeam = allTeams.find(t => t.id === parseInt(e.target.value));
        if (selectedTeam) {
            State.state.teams.home = selectedTeam.name;
            if (!State.state.teamShortNames) State.state.teamShortNames = { home: '', away: '' };
            State.state.teamShortNames.home = selectedTeam.short_name || selectedTeam.name;
        }
        // 選手プルダウンを再生成
        Render.generateLineupInputs(State.state, allPlayers, teamSelections);
        updateAndSave();
    });
}
