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
let pendingTimelyRBI = 0; // タイムリーボタンの状態 (0, 1, 2, 3)

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
            // Check for lineup change before updating state (or after, using local timestamp)
            if (newState.lastLineupChange && newState.lastLineupChange.timestamp > lastLineupChangeTimestamp) {
                lastLineupChangeTimestamp = newState.lastLineupChange.timestamp;
                Render.showLineupAnimation(newState.lastLineupChange.changes);
            }

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
let lastLineupChangeTimestamp = 0; // 打順変更アニメーション重複防止用

function setupStorageSync() {
    // 初期値を設定（既にstateにlastResultがあれば記録しておく）
    if (State.state.lastResult && State.state.lastResult.timestamp) {
        lastResultTimestamp = State.state.lastResult.timestamp;
    }
    if (State.state.lastLineupChange && State.state.lastLineupChange.timestamp) {
        lastLineupChangeTimestamp = State.state.lastLineupChange.timestamp;
    }

    setInterval(async () => {
        await State.loadState();
        Render.updateDisplay(State.state, State.isAdminMode, State.isDisplayMode);

        // 新しい結果イベントがあればアニメーション表示
        if (State.state.lastResult && State.state.lastResult.timestamp > lastResultTimestamp) {
            lastResultTimestamp = State.state.lastResult.timestamp;
            Render.showResultAnimation(State.state.lastResult.type);
        }

        // 打順変更アニメーション
        if (State.state.lastLineupChange && State.state.lastLineupChange.timestamp > lastLineupChangeTimestamp) {
            lastLineupChangeTimestamp = State.state.lastLineupChange.timestamp;
            Render.showLineupAnimation(State.state.lastLineupChange.changes);
        }
    }, 500);
}

// ==================== イベントリスナー ====================
function setupEventListeners() {
    // タイムリーボタン (1, 2, 3)
    [1, 2, 3].forEach(val => {
        const btn = document.getElementById(`btn-timely-${val}`);
        if (btn) {
            btn.addEventListener('click', () => {
                if (pendingTimelyRBI === val) {
                    // 解除
                    pendingTimelyRBI = 0;
                    btn.classList.remove('active');
                } else {
                    // 設定
                    pendingTimelyRBI = val;
                    // 他を解除
                    [1, 2, 3].forEach(v => {
                        const b = document.getElementById(`btn-timely-${v}`);
                        if (b) b.classList.remove('active');
                    });
                    btn.classList.add('active');
                }
            });
        }
    });

    function addListener(id, event, handler) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    }

    // 打順保存ボタン (admin-lineup.html)
    addListener('btn-save-lineup', 'click', () => {
        const changes = [];
        const newState = JSON.parse(JSON.stringify(State.state));
        let hasPitcherChange = false;

        // チーム名（選択）の変更確認・反映
        const awaySelect = document.getElementById('away-team-select');
        const homeSelect = document.getElementById('home-team-select');
        
        // Away Team
        if (awaySelect) {
            const newAwayId = parseInt(awaySelect.value);
            const newAwayTeam = allTeams.find(t => t.id === newAwayId);
            if (newAwayTeam && newAwayTeam.name !== State.state.teams.away) {
                // Team Changed
                newState.teams.away = newAwayTeam.name;
                if (!newState.teamShortNames) newState.teamShortNames = { home: '', away: '' };
                newState.teamShortNames.away = newAwayTeam.short_name || newAwayTeam.name;
            }
        }

        // Home Team
        if (homeSelect) {
            const newHomeId = parseInt(homeSelect.value);
            const newHomeTeam = allTeams.find(t => t.id === newHomeId);
            if (newHomeTeam && newHomeTeam.name !== State.state.teams.home) {
                // Team Changed
                newState.teams.home = newHomeTeam.name;
                if (!newState.teamShortNames) newState.teamShortNames = { home: '', away: '' };
                newState.teamShortNames.home = newHomeTeam.short_name || newHomeTeam.name;
            }
        }

        ['away', 'home'].forEach(team => {
            // Batters & Positions
            for (let i = 0; i < 9; i++) {
                const nameEl = document.querySelector(`.lineup-input-name[data-team="${team}"][data-order="${i}"]`);
                const posEl = document.querySelector(`.lineup-input-pos[data-team="${team}"][data-order="${i}"]`);
                
                const currentName = State.state.lineup[team][i];
                const currentPos = State.state.positions ? State.state.positions[team][i] : '';

                let nameChanged = false;
                let posChanged = false;

                if (nameEl && nameEl.value !== currentName) {
                    nameChanged = true;
                    newState.lineup[team][i] = nameEl.value;
                }
                
                if (posEl) {
                    if (!newState.positions) newState.positions = JSON.parse(JSON.stringify(Constants.DEFAULT_STATE.positions));
                    if (posEl.value !== currentPos) {
                        posChanged = true;
                        newState.positions[team][i] = posEl.value;
                    }
                }

                if (nameChanged) {
                    changes.push({
                        type: 'batter',
                        team: team,
                        order: i,
                        oldName: currentName,
                        newName: nameEl.value,
                        pos: posEl ? posEl.value : currentPos
                    });
                } else if (posChanged) {
                    changes.push({
                        type: 'position',
                        team: team,
                        order: i,
                        name: currentName,
                        oldPos: currentPos,
                        newPos: posEl.value
                    });
                }
            }

            // Pitcher
            const pitcherEl = document.querySelector(`.lineup-input-pitcher[data-team="${team}"]`);
            if (pitcherEl) {
                if (!newState.pitcher) newState.pitcher = { home: '', away: '' };
                const prevPitcher = State.state.pitcher ? State.state.pitcher[team] : '';
                
                if (pitcherEl.value !== prevPitcher) {
                    changes.push({
                        type: 'pitcher',
                        team: team,
                        oldName: prevPitcher,
                        newName: pitcherEl.value
                    });
                    
                    newState.pitcher[team] = pitcherEl.value;
                    
                    // 先発投手の設定（スタメンセット時）
                    if (!newState.startingPitcher) newState.startingPitcher = { away: '', home: '' };
                    if (!prevPitcher && pitcherEl.value) {
                        // 初めて投手が設定される場合、先発として記録
                        newState.startingPitcher[team] = pitcherEl.value;
                    }
                    
                    // 投手が変わったら旧投手の成績をDB保存
                    if (prevPitcher && prevPitcher !== pitcherEl.value) {
                        // 旧投手の統計を履歴に保存
                        if (!newState.pitcherStatsHistory) newState.pitcherStatsHistory = {};
                        if (State.state.pitcherStats && State.state.pitcherStats[team]) {
                            newState.pitcherStatsHistory[prevPitcher] = { ...State.state.pitcherStats[team] };
                        }
                        
                        savePitcherStatsToDB(team, prevPitcher);
                        hasPitcherChange = true;
                        
                        // 新しい投手のデータを履歴から復元、またはリセット
                        if (pitcherEl.value && newState.pitcherStatsHistory && newState.pitcherStatsHistory[pitcherEl.value]) {
                            const hist = newState.pitcherStatsHistory[pitcherEl.value];
                            newState.pitcherStats[team] = {
                                innings: hist.innings || 0,
                                strikeouts: hist.strikeouts || 0,
                                walks: hist.walks || 0,
                                runs: hist.runs || 0,
                                earnedRuns: hist.earnedRuns || 0,
                                outs: hist.outs || 0,
                                pitchCount: hist.pitchCount || 0,
                                runsAtStart: 0
                            };
                        } else {
                            resetPitcherTodayStats(team, newState); 
                        }
                    }
                }
            }
        });

        // Apply changes
        State.setState(newState);

        // 表示ページに反映＋スタメン発表アニメーション
        Sync.broadcastResultEvent('LINEUP_ANNOUNCEMENT', State.isAdminMode, State.state);
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

    // 一括交代ボタン
    addListener('btn-apply-changes-away', 'click', () => {
        handleBulkSubstitution('away');
    });
    
    addListener('btn-apply-changes-home', 'click', () => {
        handleBulkSubstitution('home');
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
            if (isChange) {
                // 三振アニメーションを表示してからチェンジ
                Sync.broadcastResultEvent('strikeout', State.isAdminMode, State.state);
                setTimeout(() => {
                    Sync.broadcastResultEvent('CHANGE', State.isAdminMode, State.state);
                    updateAndSave();
                }, 4500);
            } else {
                nextBatter();
            }
        }
        updateAndSave();
    });
    
    addListener('btn-strike-reset', 'click', () => {
        State.state.count.strike = 0;
        updateAndSave();
    });
    
    // アウト
    addListener('btn-out', 'click', () => {
        const isChange = GameLogic.addOut(State.state);
        if (isChange) {
            Sync.broadcastResultEvent('CHANGE', State.isAdminMode, State.state);
        }
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
            // Stateをリセット
            State.resetState();
            
            // チーム選択プルダウンをリセット
            const awaySelect = document.getElementById('away-team-select');
            const homeSelect = document.getElementById('home-team-select');
            if (awaySelect) awaySelect.value = '';
            if (homeSelect) homeSelect.value = '';
            
            // teamSelectionsをクリア
            teamSelections.away = null;
            teamSelections.home = null;
            
            // ラインナップ入力欄を再生成
            Render.generateLineupInputs(State.state, allPlayers, teamSelections);
            
            // スコア追跡をリセット
            const currentTeam = State.state.inning.half === 'top' ? 'away' : 'home';
            State.state.scoreAtStartOfAtBat = getTotalScore(State.state, currentTeam);
            
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
            let result = btn.dataset.result;
            
            // 現在の打者・投手・イニング情報を取得
            const currentHalf = State.state.inning.half;
            const currentTeam = currentHalf === 'top' ? 'away' : 'home';
            const pitcherTeam = currentHalf === 'top' ? 'home' : 'away';

            // タイムリー指定があれば適用（単打・二塁打・三塁打・エラーのみ）
            let forcedRBI = 0;
            // タイムリー指定の対象：単打〜エラーに加え、ゴロ（ゴロの間の1点）とフライ（犠飛）も追加
            if (pendingTimelyRBI > 0 && ['single', 'double', 'triple', 'error', 'groundout', 'flyout'].includes(result)) {
                forcedRBI = pendingTimelyRBI;
                
                // フライで打点がある場合は犠牲フライに変更
                if (result === 'flyout') {
                    result = 'sac_fly';
                }
            }
                // リセット
                pendingTimelyRBI = 0;
                document.querySelectorAll('.btn-timely').forEach(b => b.classList.remove('active'));
            
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
            } else if (forcedRBI > 0) {
                // タイムリー指定の場合はその点数がRBI
                rbi = forcedRBI;
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
                            is_sac_fly: (result === 'sacrifice' || result === 'sac_fly') ? true : false, // 簡易
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

            // 打席結果を記録 (hasLogフラグを渡す)
            const isChange = GameLogic.recordAtBatResult(State.state, result, rbi > 0);

            if (isChange) {
                // 結果アニメーションを表示してからチェンジ
                Sync.broadcastResultEvent(result, State.isAdminMode, State.state);
                
                // 4.5秒後にチェンジアニメーション
                setTimeout(() => {
                    Sync.broadcastResultEvent('CHANGE', State.isAdminMode, State.state);
                    updateAndSave();
                }, 4500);
            } else {
                Sync.broadcastResultEvent(result, State.isAdminMode, State.state);
            }

            // タイムリー指定時のスコア加算（手動加算が必要）
            if (forcedRBI > 0) {
                const inningIndex = State.state.inning.number - 1;
                
                // 得点加算
                if (typeof State.state.scores[currentTeam][inningIndex] !== 'number') {
                    State.state.scores[currentTeam][inningIndex] = 0;
                }
                State.state.scores[currentTeam][inningIndex] += forcedRBI;
                
                // エラーの場合は守備側の失策数加算
                if (result === 'error' && State.state.stats[pitcherTeam]) {
                     if (!State.state.stats[pitcherTeam].e) State.state.stats[pitcherTeam].e = 0;
                     State.state.stats[pitcherTeam].e++;
                }
            }

            // 次の打者のためにスコアをリセット記録（HRの場合はrecordAtBatResultでスコアが増えるので再取得）
            // 注意: recordAtBatResult内で batterIndex が進んでいるため、
            // ここで取得する currentTotalScore は「次の打者」の開始時スコアとなる。
            const newTotalScore = getTotalScore(State.state, currentTeam);
            State.state.scoreAtStartOfAtBat = newTotalScore;
            
            // --- 得点ログ記録 (Result Log) ---
            // 得点が入った場合のみ記録
            if (rbi > 0) {
                const shortResult = getShortResultName(result);
                const rbiStr = getCircledNumber(rbi);
                const halfStr = currentHalf === 'top' ? '表' : '裏';
                
                // 内部用フォーマット: [team] 表示用文字列
                // 表示用: "1回表　佐藤輝明　本③"
                const displayLog = `${State.state.inning.number}回${halfStr}\u3000${batterName}\u3000${shortResult}${rbiStr}`;
                const logString = `[${currentTeam}] ${displayLog}`;
                
                if (!State.state.scoreLogs) State.state.scoreLogs = [];
                State.state.scoreLogs.unshift(logString); // 先頭に追加（最新が上）
                // 最大履歴数を制限（例：最新20件）
                if (State.state.scoreLogs.length > 20) State.state.scoreLogs.pop();
            }


            // --- Special Animations ---
            if (result === 'homerun') {
                if (rbi >= 4) {
                    Render.playSpecialAnimation('grandslam');
                } else {
                    Render.playSpecialAnimation('homerun');
                }
            }
            
            // Walk-off Check (9回裏以降、後攻チームが得点して勝ち越した場合)
            if (rbi > 0 && currentHalf === 'bottom' && State.state.inning.number >= 9) {
                const homeScore = getTotalScore(State.state, 'home');
                const awayScore = getTotalScore(State.state, 'away');
                const prevHomeScore = homeScore - rbi; // 直前のスコアを逆算

                // 勝ち越し成功時 (同点以下 -> 勝ち越し)
                if (homeScore > awayScore && prevHomeScore <= awayScore) {
                    const delay = (result === 'homerun') ? 5000 : 500; // HRの場合は少し待つ
                    setTimeout(() => {
                        Render.playSpecialAnimation('sayonara');
                    }, delay);
                }
            }

            // --- 打席ログ詳細記録 (atBatLog) ---
            if (!State.state.atBatLog) State.state.atBatLog = [];
            
            // エラーによる得点は自責点に含めない
            const earnedRuns = (result === 'error') ? 0 : rbi;
            
            State.state.atBatLog.unshift({
                id: Date.now().toString(),
                inning: State.state.inning.number,
                half: currentHalf,
                team: currentTeam,
                batterName: batterName,
                batterIndex: batterIndex,
                pitcherName: pitcherName,
                result: result,
                rbi: rbi,
                runs: rbi, // 失点
                earnedRuns: earnedRuns // 自責点（エラーの場合は0）
            });

            // --- 投手統計への失点・自責点記録 ---
            if (rbi > 0 && pitcherName) {
                // 投手統計履歴を初期化（存在しない場合）
                if (!State.state.pitcherStatsHistory) State.state.pitcherStatsHistory = {};
                if (!State.state.pitcherStatsHistory[pitcherName]) {
                    // 現在の投手の場合は現在の統計をコピー
                    const isCurrent = (pitcherName === (State.state.pitcher ? State.state.pitcher[pitcherTeam] : ''));
                    if (isCurrent && State.state.pitcherStats && State.state.pitcherStats[pitcherTeam]) {
                        State.state.pitcherStatsHistory[pitcherName] = { ...State.state.pitcherStats[pitcherTeam] };
                    } else {
                        State.state.pitcherStatsHistory[pitcherName] = { 
                            innings: 0, 
                            strikeouts: 0, 
                            walks: 0, 
                            runs: 0, 
                            earnedRuns: 0,
                            outs: 0,
                            pitchCount: 0
                        };
                    }
                }
                
                // 失点・自責点を累積
                if (!State.state.pitcherStatsHistory[pitcherName].runs) {
                    State.state.pitcherStatsHistory[pitcherName].runs = 0;
                }
                if (!State.state.pitcherStatsHistory[pitcherName].earnedRuns) {
                    State.state.pitcherStatsHistory[pitcherName].earnedRuns = 0;
                }
                
                State.state.pitcherStatsHistory[pitcherName].runs += rbi;
                State.state.pitcherStatsHistory[pitcherName].earnedRuns += earnedRuns;
                
                // 現在の投手の場合、pitcherStatsも更新
                const currentPitcher = State.state.pitcher ? State.state.pitcher[pitcherTeam] : '';
                if (pitcherName === currentPitcher && State.state.pitcherStats && State.state.pitcherStats[pitcherTeam]) {
                    if (!State.state.pitcherStats[pitcherTeam].runs) {
                        State.state.pitcherStats[pitcherTeam].runs = 0;
                    }
                    if (!State.state.pitcherStats[pitcherTeam].earnedRuns) {
                        State.state.pitcherStats[pitcherTeam].earnedRuns = 0;
                    }
                    State.state.pitcherStats[pitcherTeam].runs += rbi;
                    State.state.pitcherStats[pitcherTeam].earnedRuns += earnedRuns;
                }
            }
            
            updateAndSave();
        });
    });

    // 選手交代ボタン (Delegation from dynamic elements)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-sub-player')) {
            const team = e.target.dataset.team;
            const order = e.target.dataset.order; // 0-8 or 'pitcher'
            
            if (order === 'pitcher') {
                handlePitcherSubstitution(team);
            } else {
                handleBatterSubstitution(team, parseInt(order));
            }
        }
    });

    // 投手成績の手動編集 (Delegation)
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('pitcher-stat-input')) {
            const team = e.target.dataset.team;
            const pitcherName = e.target.dataset.pitcher;
            const statType = e.target.dataset.stat; // 'innings', 'k', 'runs', 'er'
            let value = parseFloat(e.target.value);
            
            if (isNaN(value)) value = 0;

            // Historyを更新
            if (!State.state.pitcherStatsHistory) State.state.pitcherStatsHistory = {};
            if (!State.state.pitcherStatsHistory[pitcherName]) {
                // If history is missing but it's the current pitcher, copy from current stats
                const isCurrent = (pitcherName === (State.state.pitcher ? State.state.pitcher[team] : ''));
                if (isCurrent && State.state.pitcherStats && State.state.pitcherStats[team]) {
                    State.state.pitcherStatsHistory[pitcherName] = { ...State.state.pitcherStats[team] };
                } else {
                    State.state.pitcherStatsHistory[pitcherName] = { innings: 0, strikeouts: 0, runs: 0, earnedRuns: 0, walks: 0 };
                }
            }
            
            const propMap = {
                'innings': 'innings',
                'k': 'strikeouts',
                'bb': 'walks',
                'runs': 'runs',
                'er': 'earnedRuns'
            };
            const prop = propMap[statType];
            
            if (prop) {
                State.state.pitcherStatsHistory[pitcherName][prop] = value;
                
                // inningsが変更された場合、outsも再計算して同期する（次のプレイでの上書き防止）
                if (statType === 'innings') {
                     const whole = Math.floor(value);
                     const frac = Math.round((value - whole) * 10);
                     // 0.1 => 1 out, 0.2 => 2 outs. 
                     // 注意: ユーザーが 0.3 と入力した場合は 3 outs ＝ 1.0 に補正されるべきだが、
                     // ここでは単純に計算する。game.jsの計算式 (outs % 3 * 0.1) と逆変換。
                     const outs = (whole * 3) + frac;
                     State.state.pitcherStatsHistory[pitcherName].outs = outs;
                }

                // 現在の投手の場合、state.pitcherStats[team] も同期する
                const currentPitcher = State.state.pitcher ? State.state.pitcher[team] : '';
                if (pitcherName === currentPitcher && State.state.pitcherStats && State.state.pitcherStats[team]) {
                    State.state.pitcherStats[team][prop] = value;
                    if (statType === 'innings') {
                        const whole = Math.floor(value);
                        const frac = Math.round((value - whole) * 10);
                        const outs = (whole * 3) + frac;
                        State.state.pitcherStats[team].outs = outs;
                    }
                }
                updateAndSave();
            }
        }
    });

    // 打席ログの編集 (Delegation)
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('log-pitcher-select')) {
            const id = e.target.dataset.id;
            const val = e.target.value;
            updateAtBatLogField(id, 'pitcherName', val);
        }
        else if (e.target.classList.contains('log-result-select')) {
            const id = e.target.dataset.id;
            const val = e.target.value;
            updateAtBatLogField(id, 'result', val);
        }
        else if (e.target.classList.contains('log-rbi-input')) {
            const id = e.target.dataset.id;
            const val = parseInt(e.target.value) || 0;
            updateAtBatLogField(id, 'rbi', val);
        }
    });

    function updateAtBatLogField(id, field, value) {
        if (!State.state.atBatLog) return;
        const log = State.state.atBatLog.find(l => l.id === id);
        if (log) {
            log[field] = value;
            
            // ログ変更を現在の打撃成績(state.atBatResults)に反映
            recalculateStatsFromLogs(State.state);
            
            updateAndSave();
        }
    }

    /**
     * 打席ログから打撃成績(atBatResults, todayRBI)を再計算する
     * これにより、ログの手動修正が「BATTER」表示等に反映される
     */
    function recalculateStatsFromLogs(state) {
        if (!state.atBatLog) return;
        
        // Reset Batter Results & RBI
        state.atBatResults = {
            away: Array(9).fill().map(() => []),
            home: Array(9).fill().map(() => [])
        };
        state.todayRBI = {
            away: Array(9).fill(0),
            home: Array(9).fill(0)
        };
        
        const chronologicalLogs = [...state.atBatLog].reverse(); // copy then reverse
        
        chronologicalLogs.forEach(log => {
             // Validate team and batterIndex
             if (log.team && (log.batterIndex !== undefined)) {
                 const team = log.team;
                 const idx = parseInt(log.batterIndex);
                 
                 // Check if the log's batter name matches the current lineup
                 // This ensures that "Today's Results" only shows results for the CURRENT player
                 const currentLineupName = state.lineup[team][idx];
                 if (log.batterName !== currentLineupName) {
                     return;
                 }
                 
                 // Ensure array exists (just in case)
                 if (!state.atBatResults[team]) state.atBatResults[team] = Array(9).fill().map(() => []);
                 if (!state.atBatResults[team][idx]) state.atBatResults[team][idx] = [];
                 
                 // Add Result
                 if (log.result) {
                     state.atBatResults[team][idx].push(log.result);
                 }
                 
                 // Add RBI
                 if (log.rbi) {
                     if (!state.todayRBI[team]) state.todayRBI[team] = Array(9).fill(0);
                     if (state.todayRBI[team][idx] === undefined) state.todayRBI[team][idx] = 0;
                     state.todayRBI[team][idx] += parseInt(log.rbi || 0);
                 }
             }
        });
    }

function getCircledNumber(n) {
    const map = { 1:'①', 2:'②', 3:'③', 4:'④' };
    return map[n] || `(${n})`;
}

function getShortResultName(type) {
    const map = {
        'single': '単打', 'double': '二塁打', 'triple': '三塁打', 'homerun': '本塁打',
        'walk': '四球', 'hbp': '死球', 'error': 'エラー',
        'strikeout': '三振', 'groundout': 'ゴロ', 'flyout': 'フライ', 'lineout': 'ライナー',
        'sacrifice': '犠打', 'sac_fly': '犠飛', 'fc': '野選', 'dp': '併殺'
    };
    return map[type] || type;
}

function handlePitcherSubstitution(team) {
    // 投手交代処理
    const pitcherEl = document.querySelector(`.lineup-input-pitcher[data-team="${team}"]`);
    if (!pitcherEl) return;
    
    const newPitcher = pitcherEl.value;
    if (!State.state.pitcher) State.state.pitcher = { away: '', home: '' };
    const oldPitcher = State.state.pitcher[team];
    
    if (newPitcher === oldPitcher) {
        alert('投手の変更がありません。');
        return;
    }
    
    // 履歴初期化
    if (!State.state.pitcherHistory) State.state.pitcherHistory = { away: [], home: [] };
    if (!State.state.pitcherStatsHistory) State.state.pitcherStatsHistory = {};

    // 1. 旧投手の成績をHistoryに保存
    if (oldPitcher) {
        // Stats保存
        const currentStats = State.state.pitcherStats ? State.state.pitcherStats[team] : null;
        if (currentStats) {
            State.state.pitcherStatsHistory[oldPitcher] = {
                innings: currentStats.innings || 0,
                strikeouts: currentStats.strikeouts || 0,
                walks: currentStats.walks || 0,
                runs: currentStats.runsFromLog !== undefined ? currentStats.runsFromLog : (currentStats.runs || 0),
                earnedRuns: currentStats.earnedRunsFromLog !== undefined ? currentStats.earnedRunsFromLog : (currentStats.earnedRuns || 0),
                pitchCount: currentStats.pitchCount || 0
            };
        }
        
        // Historyリストに追加 (存在しなければ)
        if (!State.state.pitcherHistory[team].includes(oldPitcher)) {
             State.state.pitcherHistory[team].push(oldPitcher);
        }
    }

    // 2. 新投手への切り替え
    State.state.pitcher[team] = newPitcher;
    
    // Historyリストに追加 (新投手)
    if (newPitcher && !State.state.pitcherHistory[team].includes(newPitcher)) {
         State.state.pitcherHistory[team].push(newPitcher);
    }
    
    // 3. Statsの切り替え: 履歴があれば復元、なければリセット
    if (newPitcher && State.state.pitcherStatsHistory[newPitcher]) {
        const hist = State.state.pitcherStatsHistory[newPitcher];
        State.state.pitcherStats[team] = {
            innings: hist.innings || 0,
            strikeouts: hist.strikeouts || 0,
            walks: hist.walks || 0,
            runs: hist.runs || 0,
            earnedRuns: hist.earnedRuns || 0,
            pitchCount: hist.pitchCount || 0,
            runsFromLog: hist.runs || 0,
            earnedRunsFromLog: hist.earnedRuns || 0,
            outs: (hist.innings * 3) % 3 // 簡易計算 (正確にはoutsプロパティがあればそれを使う)
        };
        if (hist.outs !== undefined) State.state.pitcherStats[team].outs = hist.outs;

    } else {
        // 新規登板
        if (!State.state.pitcherStats) State.state.pitcherStats = { away: {}, home: {} };
        State.state.pitcherStats[team] = {
            innings: 0, strikeouts: 0, walks: 0, runs: 0, earnedRuns: 0, pitchCount: 0,
            runsFromLog: 0, earnedRunsFromLog: 0, outs: 0
        };
    }

    // DB保存 (Optional)
    if (oldPitcher) {
        savePitcherStatsToDB(team, oldPitcher);
    }
    
    // アニメーション用の変更情報を作成
    const changes = [{
        type: 'pitcher',
        team: team,
        oldName: oldPitcher,
        newName: newPitcher
    }];
    
    State.state.lastLineupChange = {
        timestamp: Date.now(),
        changes: changes
    };
    
    // 保存と反映
    updateAndSave();
}

function handleBatterSubstitution(team, order) {
    // 打者交代処理：プルダウンの値を取得してStateに保存し、アニメーションを発火
    
    // プルダウンから現在の選択値を取得
    const nameEl = document.querySelector(`.lineup-input-name[data-team="${team}"][data-order="${order}"]`);
    const posEl = document.querySelector(`.lineup-input-pos[data-team="${team}"][data-order="${order}"]`);
    
    if (!nameEl) {
        console.warn('打者プルダウンが見つかりません');
        return;
    }
    
    const newName = nameEl.value;
    const newPos = posEl ? posEl.value : '';
    const oldName = State.state.lineup[team][order];
    const oldPos = State.state.positions ? State.state.positions[team][order] : '';
    
    // 変更がない場合は何もしない
    if (newName === oldName && newPos === oldPos) {
        alert('選手の変更がありません。');
        return;
    }
    
    // Stateに反映
    State.state.lineup[team][order] = newName;
    if (posEl) {
        if (!State.state.positions) State.state.positions = { away: [], home: [] };
        State.state.positions[team][order] = newPos;
    }

    // Reset results for the new batter
    if (State.state.atBatResults && State.state.atBatResults[team]) {
        State.state.atBatResults[team][order] = [];
    }
    if (State.state.todayRBI && State.state.todayRBI[team]) {
        State.state.todayRBI[team][order] = 0;
    }
    
    // アニメーション用の変更情報を作成
    const changes = [{
        type: 'batter',
        team: team,
        order: order,
        oldName: oldName,
        newName: newName,
        pos: newPos
    }];
    
    State.state.lastLineupChange = {
        timestamp: Date.now(),
        changes: changes
    };
    
    // 保存と反映
    updateAndSave();
}

/**
 * 一括交代処理
 * チーム全体のプルダウンを確認し、変更があった選手をまとめて交代
 */
function handleBulkSubstitution(team) {
    const changes = [];
    
    // 打者の変更をチェック (0-8)
    for (let i = 0; i < 9; i++) {
        const nameEl = document.querySelector(`.lineup-input-name[data-team="${team}"][data-order="${i}"]`);
        const posEl = document.querySelector(`.lineup-input-pos[data-team="${team}"][data-order="${i}"]`);
        
        if (!nameEl) continue;
        
        const newName = nameEl.value;
        const newPos = posEl ? posEl.value : '';
        const oldName = State.state.lineup[team][i];
        const oldPos = State.state.positions ? State.state.positions[team][i] : '';
        
        // 変更があった場合のみ記録
        if (newName !== oldName || newPos !== oldPos) {
            // Stateに反映
            State.state.lineup[team][i] = newName;
            if (posEl) {
                if (!State.state.positions) State.state.positions = { away: [], home: [] };
                State.state.positions[team][i] = newPos;
            }
            
            // 変更情報を記録
            if (newName !== oldName) {
                changes.push({
                    type: 'batter',
                    team: team,
                    order: i,
                    oldName: oldName,
                    newName: newName,
                    pos: newPos
                });

                // Reset results for the new batter
                if (State.state.atBatResults && State.state.atBatResults[team]) {
                    State.state.atBatResults[team][i] = [];
                }
                if (State.state.todayRBI && State.state.todayRBI[team]) {
                    State.state.todayRBI[team][i] = 0;
                }
            } else if (newPos !== oldPos) {
                changes.push({
                    type: 'position',
                    team: team,
                    order: i,
                    name: newName,
                    oldPos: oldPos,
                    newPos: newPos
                });
            }
        }
    }
    
    // 投手の変更をチェック
    const pitcherEl = document.querySelector(`.lineup-input-pitcher[data-team="${team}"]`);
    if (pitcherEl) {
        const newPitcher = pitcherEl.value;
        if (!State.state.pitcher) State.state.pitcher = { away: '', home: '' };
        const oldPitcher = State.state.pitcher[team];
        
        if (newPitcher !== oldPitcher) {
            // 履歴初期化
            if (!State.state.pitcherHistory) State.state.pitcherHistory = { away: [], home: [] };
            if (!State.state.pitcherStatsHistory) State.state.pitcherStatsHistory = {};

            // 旧投手の成績をHistoryに保存
            if (oldPitcher) {
                const currentStats = State.state.pitcherStats ? State.state.pitcherStats[team] : null;
                if (currentStats) {
                    State.state.pitcherStatsHistory[oldPitcher] = {
                        innings: currentStats.innings || 0,
                        strikeouts: currentStats.strikeouts || 0,
                        walks: currentStats.walks || 0,
                        runs: currentStats.runsFromLog !== undefined ? currentStats.runsFromLog : (currentStats.runs || 0),
                        earnedRuns: currentStats.earnedRunsFromLog !== undefined ? currentStats.earnedRunsFromLog : (currentStats.earnedRuns || 0),
                        pitchCount: currentStats.pitchCount || 0
                    };
                }
                
                if (!State.state.pitcherHistory[team].includes(oldPitcher)) {
                     State.state.pitcherHistory[team].push(oldPitcher);
                }
            }

            // 新投手への切り替え
            State.state.pitcher[team] = newPitcher;
            
            if (newPitcher && !State.state.pitcherHistory[team].includes(newPitcher)) {
                 State.state.pitcherHistory[team].push(newPitcher);
            }
            
            // Statsの切り替え
            if (newPitcher && State.state.pitcherStatsHistory[newPitcher]) {
                const hist = State.state.pitcherStatsHistory[newPitcher];
                State.state.pitcherStats[team] = {
                    innings: hist.innings || 0,
                    strikeouts: hist.strikeouts || 0,
                    walks: hist.walks || 0,
                    runs: hist.runs || 0,
                    earnedRuns: hist.earnedRuns || 0,
                    pitchCount: hist.pitchCount || 0,
                    runsFromLog: hist.runs || 0,
                    earnedRunsFromLog: hist.earnedRuns || 0,
                    outs: (hist.innings * 3) % 3
                };
                if (hist.outs !== undefined) State.state.pitcherStats[team].outs = hist.outs;
            } else {
                if (!State.state.pitcherStats) State.state.pitcherStats = { away: {}, home: {} };
                State.state.pitcherStats[team] = {
                    innings: 0, strikeouts: 0, walks: 0, runs: 0, earnedRuns: 0, pitchCount: 0,
                    runsFromLog: 0, earnedRunsFromLog: 0, outs: 0
                };
            }

            // DB保存
            if (oldPitcher) {
                savePitcherStatsToDB(team, oldPitcher);
            }
            
            // 変更情報を記録
            changes.push({
                type: 'pitcher',
                team: team,
                oldName: oldPitcher,
                newName: newPitcher
            });
        }
    }
    
    // 変更がない場合
    if (changes.length === 0) {
        alert('交代する選手がありません。');
        return;
    }
    
    // アニメーション用の変更情報を保存
    State.state.lastLineupChange = {
        timestamp: Date.now(),
        changes: changes
    };
    
    // 保存と反映
    updateAndSave();
}



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
            const pitcherName = State.state.pitcher ? State.state.pitcher[input.team] : '';
            if (!pitcherName) return;

            if (!State.state.pitcherStatsHistory) State.state.pitcherStatsHistory = {};
            if (!State.state.pitcherStatsHistory[pitcherName]) {
                State.state.pitcherStatsHistory[pitcherName] = { innings: 0, strikeouts: 0, runs: 0, earnedRuns: 0 };
            }
            
            const value = input.parse(e.target.value) || 0;
            State.state.pitcherStatsHistory[pitcherName][input.prop] = value;
            
            // 下換性のために既存のpitcherStatsも更新（必要に応じて）
            if (!State.state.pitcherStats) {
                State.state.pitcherStats = JSON.parse(JSON.stringify(Constants.DEFAULT_STATE.pitcherStats));
            }
            State.state.pitcherStats[input.team][input.prop] = value;

            State.saveState();
        });
    });
}

function handleLineupInput(e) {
   // 保存ボタンが押されるまで保存しない
   // 必要であれば入力欄のバリデーションなどをここで行う
}

function updateAndSave() {
    Render.updateDisplay(State.state, State.isAdminMode, State.isDisplayMode);
    renderAtBatLog();
    State.saveState();
}

// ローカル保存のみ（ブロードキャストしない）- 保存ボタン用
function updateAndSaveLocal() {
    Render.updateDisplay(State.state, State.isAdminMode, State.isDisplayMode);
    State.saveState(true); // skipBroadcast = true
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
    
    // 投手統計履歴から自責点を取得
    let earnedRuns = 0;
    if (State.state.pitcherStatsHistory && State.state.pitcherStatsHistory[pitcherName]) {
        earnedRuns = State.state.pitcherStatsHistory[pitcherName].earnedRuns || 0;
    } else if (stats.earnedRuns !== undefined) {
        earnedRuns = stats.earnedRuns;
    }
    
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
                earned_runs: earnedRuns,
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
function resetPitcherTodayStats(team, targetState = null) {
    const s = targetState || State.state;

    if (!s.pitcherStats) {
        s.pitcherStats = JSON.parse(JSON.stringify(Constants.DEFAULT_STATE.pitcherStats));
    }
    
    // 相手チームの現在の総得点（＝自チーム投手の総失点）を取得
    const opposingTeam = team === 'home' ? 'away' : 'home';
    const currentTotalRuns = getTotalScore(s, opposingTeam);

    const pitcherName = s.pitcher ? s.pitcher[team] : '';

    // 新しい投手のための初期値
    s.pitcherStats[team] = { 
        innings: 0, 
        strikeouts: 0, 
        walks: 0, 
        runs: 0, 
        pitchCount: 0, 
        outs: 0,
        runsAtStart: currentTotalRuns // 交代時点の失点をベースラインにする
    };

    // 履歴オブジェクトに初期エントリを作成（未存在の場合）
    if (pitcherName) {
        if (!s.pitcherStatsHistory) s.pitcherStatsHistory = {};
        if (!s.pitcherStatsHistory[pitcherName]) {
            s.pitcherStatsHistory[pitcherName] = { innings: 0, strikeouts: 0, walks: 0, runs: 0, earnedRuns: 0, outs: 0 };
        }
    }
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
        // チーム名は保存ボタン押下時にStateへ反映
        // ここではプルダウンの更新のみ
        Render.generateLineupInputs(State.state, allPlayers, teamSelections);
    });

    homeSelect.addEventListener('change', (e) => {
        teamSelections.home = e.target.value;
        // チーム名は保存ボタン押下時にStateへ反映
        Render.generateLineupInputs(State.state, allPlayers, teamSelections);
    });

    // スタメンテンプレート機能のイベントリスナー
    setupTemplateListeners();
}

/**
 * スタメンテンプレート機能のイベントリスナーを設定
 */
function setupTemplateListeners() {
    // 先攻チームテンプレート保存
    const btnSaveAway = document.getElementById('btn-save-template-away');
    if (btnSaveAway) {
        btnSaveAway.addEventListener('click', () => saveLineupTemplate('away'));
    }
    
    // 先攻チームテンプレート読み込み
    const btnLoadAway = document.getElementById('btn-load-template-away');
    if (btnLoadAway) {
        btnLoadAway.addEventListener('click', () => loadLineupTemplate('away'));
    }
    
    // 後攻チームテンプレート保存
    const btnSaveHome = document.getElementById('btn-save-template-home');
    if (btnSaveHome) {
        btnSaveHome.addEventListener('click', () => saveLineupTemplate('home'));
    }
    
    // 後攻チームテンプレート読み込み
    const btnLoadHome = document.getElementById('btn-load-template-home');
    if (btnLoadHome) {
        btnLoadHome.addEventListener('click', () => loadLineupTemplate('home'));
    }
}

/**
 * スタメンテンプレートを保存
 * @param {string} side - 'away' または 'home'
 */
function saveLineupTemplate(side) {
    // 現在選択されているチームIDを取得
    const selectId = side === 'away' ? 'away-team-select' : 'home-team-select';
    const selectEl = document.getElementById(selectId);
    const teamId = selectEl ? selectEl.value : null;
    
    if (!teamId) {
        alert('チームを選択してください。');
        return;
    }
    
    // 現在のフォームからラインナップを取得
    const lineup = [];
    const positions = [];
    let pitcher = '';
    
    for (let i = 0; i < 9; i++) {
        const nameEl = document.querySelector(`.lineup-input-name[data-team="${side}"][data-order="${i}"]`);
        const posEl = document.querySelector(`.lineup-input-pos[data-team="${side}"][data-order="${i}"]`);
        lineup.push(nameEl ? nameEl.value : '');
        positions.push(posEl ? posEl.value : '');
    }
    
    const pitcherEl = document.querySelector(`.lineup-input-pitcher[data-team="${side}"]`);
    if (pitcherEl) {
        pitcher = pitcherEl.value;
    }
    
    // テンプレートオブジェクト作成
    const template = {
        teamId: teamId,
        lineup: lineup,
        positions: positions,
        pitcher: pitcher,
        savedAt: new Date().toISOString()
    };
    
    // ローカルストレージに保存（チームIDをキーにする）
    const storageKey = `lineup_template_${teamId}`;
    localStorage.setItem(storageKey, JSON.stringify(template));
    
    // 保存完了メッセージ
    const teamName = allTeams.find(t => t.id == teamId)?.name || 'チーム';
    alert(`「${teamName}」のスタメンテンプレートを保存しました。`);
    
    console.log('Template saved:', storageKey, template);
}

/**
 * スタメンテンプレートを読み込み
 * @param {string} side - 'away' または 'home'
 */
function loadLineupTemplate(side) {
    console.log('loadLineupTemplate called for:', side);
    
    // 現在選択されているチームIDを取得
    const selectId = side === 'away' ? 'away-team-select' : 'home-team-select';
    const selectEl = document.getElementById(selectId);
    const teamId = selectEl ? selectEl.value : null;
    
    console.log('Selected team ID:', teamId);
    
    if (!teamId) {
        alert('チームを選択してください。');
        return;
    }
    
    // ローカルストレージから読み込み
    const storageKey = `lineup_template_${teamId}`;
    const savedData = localStorage.getItem(storageKey);
    
    console.log('Storage key:', storageKey, 'Saved data:', savedData);
    
    if (!savedData) {
        const teamName = allTeams.find(t => t.id == teamId)?.name || 'チーム';
        alert(`「${teamName}」のスタメンテンプレートが見つかりません。\n先にテンプレートを保存してください。`);
        return;
    }
    
    const template = JSON.parse(savedData);
    console.log('Template loaded:', template);
    
    // プルダウンの値のみを更新（Stateには反映しない）
    for (let i = 0; i < 9; i++) {
        const nameEl = document.querySelector(`.lineup-input-name[data-team="${side}"][data-order="${i}"]`);
        const posEl = document.querySelector(`.lineup-input-pos[data-team="${side}"][data-order="${i}"]`);
        
        if (nameEl && template.lineup[i]) {
            nameEl.value = template.lineup[i];
            console.log(`Set batter ${i}:`, template.lineup[i]);
        }
        if (posEl && template.positions[i]) {
            posEl.value = template.positions[i];
        }
    }
    
    // 投手プルダウンの値を更新
    const pitcherEl = document.querySelector(`.lineup-input-pitcher[data-team="${side}"]`);
    if (pitcherEl && template.pitcher) {
        pitcherEl.value = template.pitcher;
        console.log('Set pitcher:', template.pitcher);
    }
    
    // 読み込み完了メッセージ
    const teamName = allTeams.find(t => t.id == teamId)?.name || 'チーム';
    alert(`「${teamName}」のスタメンテンプレートを読み込みました。\n保存ボタンを押すと反映されます。`);
    
    console.log('Template loaded to form (not saved):', storageKey, template);
}

// ==================== Log Functions (Refactored) ====================

// Current filtered team for log view
window.currentLogViewTeam = 'away'; 

window.switchLogTeam = function(team) {
    window.currentLogViewTeam = team;
    renderAtBatLog();
}

/**
 * 打席ログテーブルをレンダリング（選手別・打席ごとのリスト表示）
 */
function renderAtBatLog() {
    const container = document.getElementById('at-bat-log-container');
    if (!container) return;

    const viewTeam = window.currentLogViewTeam || 'away';

    // Update buttons style
    const btnAway = document.getElementById('btn-log-away');
    const btnHome = document.getElementById('btn-log-home');
    if(btnAway) {
        btnAway.classList.toggle('active', viewTeam === 'away');
        btnAway.style.background = viewTeam === 'away' ? '#e74c3c' : '#444';
    }
    if(btnHome) {
        btnHome.classList.toggle('active', viewTeam === 'home');
        btnHome.style.background = viewTeam === 'home' ? '#e74c3c' : '#444';
    }

    // Clear existing content
    container.innerHTML = '';
    
    const log = State.state.atBatLog || [];
    
    // Filter by team
    // Note: original log is new-first (unshift), so we reverse to get chronological order (old-first)
    // This makes sense for "1st At-Bat, 2nd At-Bat..."
    let teamLogs = log.filter(l => l.team === viewTeam).reverse();
    
    // Group by Order (0-8) -> Player Name
    // Structure: orders[orderIndex] = [ { name: 'PlayerName', logs: [log1, log2] }, ... ]
    const orders = Array(9).fill(null).map(() => []); 

    teamLogs.forEach(entry => {
        const idx = parseInt(entry.batterIndex);
        if (isNaN(idx) || idx < 0 || idx > 8) return;
        
        // Find if the *last* player entry in this order matches the current log's batter name
        let lastEntry = orders[idx][orders[idx].length - 1];
        
        if (lastEntry && lastEntry.name === entry.batterName) {
            lastEntry.logs.push(entry);
        } else {
            // New player entry (substitution or start)
            orders[idx].push({
                name: entry.batterName,
                logs: [entry]
            });
        }
    });

    // Generate HTML
    orders.forEach((playerEntries, orderIdx) => {
        // Order Section Container
        const orderSection = document.createElement('div');
        orderSection.className = 'log-order-section';
        orderSection.style.marginBottom = '8px';
        orderSection.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        orderSection.style.paddingBottom = '4px';

        // Order Header (e.g., "1番")
        const orderHeader = document.createElement('div');
        orderHeader.textContent = `${orderIdx + 1}番`;
        orderHeader.style.fontSize = '12px';
        orderHeader.style.fontWeight = 'bold';
        orderHeader.style.color = '#ffd700';
        orderSection.appendChild(orderHeader);

        // Player Rows
        playerEntries.forEach(player => {
            const playerRow = document.createElement('div');
            playerRow.className = 'log-player-row';
            playerRow.style.display = 'flex';
            playerRow.style.alignItems = 'flex-start'; 
            playerRow.style.marginTop = '4px';

            // Player Name
            const nameEl = document.createElement('div');
            nameEl.textContent = player.name;
            nameEl.style.width = '100px';
            nameEl.style.fontSize = '12px';
            nameEl.style.color = '#fff';
            nameEl.style.paddingTop = '6px'; // align with select box text
            playerRow.appendChild(nameEl);

            // Results List
            const resultsEl = document.createElement('div');
            resultsEl.className = 'log-results-list';
            resultsEl.style.display = 'flex';
            resultsEl.style.flexWrap = 'wrap';
            resultsEl.style.gap = '4px';
            resultsEl.style.flex = '1';

            player.logs.forEach(l => {
                const select = document.createElement('select');
                select.className = 'log-edit-result-select'; // unique class for listener
                select.dataset.id = l.id;
                select.style.fontSize = '11px';
                select.style.padding = '4px';
                select.style.border = l.rbi > 0 ? '1px solid #f39c12' : '1px solid #555'; // Highlight RBI
                select.style.borderRadius = '4px';
                select.style.background = '#222';
                select.style.color = getResultColor(l.result);
                select.style.maxWidth = '80px';
                select.style.cursor = 'pointer';

                // Add RBI info to title
                if (l.rbi > 0) {
                    select.title = `打点: ${l.rbi}`;
                }

                // Options
                let optionsHTML = Object.entries(Constants.RESULT_LABELS).map(([code, label]) => 
                    `<option value="${code}" ${l.result === code ? 'selected' : ''}>${label}</option>`
                ).join('');
                // Add Delete Option
                optionsHTML += `<option value="DELETE" style="color: #e74c3c;">(削除)</option>`;
                
                select.innerHTML = optionsHTML;
                
                // Change Log Logic
                select.addEventListener('change', (e) => {
                    const val = e.target.value;
                    const logId = e.target.dataset.id;
                    
                    if (val === 'DELETE') {
                        if (confirm('この打席記録を削除しますか？\n（スコアや個人成績も再計算されます）')) {
                            deleteAtBatLog(logId);
                        } else {
                            // Revert by re-rendering
                            renderAtBatLog();
                        }
                    } else {
                        updateAtBatLogField(logId, 'result', val);
                        e.target.style.color = getResultColor(val);
                    }
                });

                resultsEl.appendChild(select);
            });

            playerRow.appendChild(resultsEl);
            orderSection.appendChild(playerRow);
        });

        container.appendChild(orderSection);
    });
}

function getResultColor(res) {
    if(['single','double','triple','homerun'].includes(res)) return '#ff7675'; // Hit (Light Red)
    if(['walk','hbp'].includes(res)) return '#55efc4'; // Walk (Green)
    if(['strikeout'].includes(res)) return '#74b9ff'; // SO (Blue)
    return '#dfe6e9'; // Out (Gray/White)
}

function deleteAtBatLog(id) {
     if (!State.state.atBatLog) return;
     // Filter out
     State.state.atBatLog = State.state.atBatLog.filter(l => l.id !== id);
     
     // Recalculate stats & Today RBI
     recalculateStatsFromLogs(State.state);
     
     updateAndSave();
}

/**
 * ログの編集ハンドル
 */
function handleLogEdit(e) {
    // Legacy mapping if needed, otherwise handled inline above
    const id = e.target.dataset.id;
    const entry = State.state.atBatLog.find(l => l.id === id);
    
    if (!entry) return;

    if (e.target.classList.contains('log-edit-result')) {
        entry.result = e.target.value;
    } else if (e.target.classList.contains('log-edit-pitcher')) {
        entry.pitcherName = e.target.value;
    } else if (e.target.classList.contains('log-edit-rbi')) {
        entry.rbi = parseInt(e.target.value) || 0;
    } else if (e.target.classList.contains('log-edit-runs')) {
        entry.runs = parseInt(e.target.value) || 0;
    } else if (e.target.classList.contains('log-edit-er')) {
        entry.earnedRuns = parseInt(e.target.value) || 0;
    }

    recalculateStatsFromLogs(State.state);
}

/**
 * ログの削除ハンドル
 */
function handleLogDelete(e) {
    if (!confirm('この打席データを削除しますか？')) return;
    const id = e.target.dataset.id;
    State.state.atBatLog = State.state.atBatLog.filter(l => l.id !== id);
    recalculateStatsFromLogs(State.state);
    updateAndSave();
}

// recalculateStatsFromLog function removed (duplicate of recalculateStatsFromLogs)
