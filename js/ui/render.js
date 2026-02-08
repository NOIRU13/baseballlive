/**
 * 表示更新モジュール
 */
import { RESULT_LABELS, POSITIONS } from '../data/constants.js';
import * as GameLogic from '../logic/game.js';
import { playerMap } from '../data/state.js';

let lastBatterId = null;
let lastPitcherId = null;


/**
 * 全ての表示を更新する
 * @param {Object} state 
 * @param {boolean} isAdminMode 
 * @param {boolean} isDisplayMode 
 */
export function updateDisplay(state, isAdminMode, isDisplayMode) {
    updateTeamDisplay(state);
    updateInningDisplay(state);
    updateCountDisplay(state);
    updateRunnerDisplay(state);
    updateScoreDisplay(state);
    updateRHEDisplay(state);
    updateControlPanel(state, isAdminMode);
    updateLineupDisplay(state, isAdminMode); // AdminMode判定内でID切り替えなどは関数内で行う
    updateCurrentBatterDisplay(state, isAdminMode);
    updateBottomStats(state, isDisplayMode);
    
    // New Features
    if (isDisplayMode || isAdminMode) {
        updateScoreLog(state);
        updatePitcherRelay(state);
    }
}

/**
 * チーム名の表示を更新
 * index.html（display-mode）では略称を使用する
 */
export function updateTeamDisplay(state) {
    // 略称があればそちらを使う（index.html表示用）
    const shortNames = state.teamShortNames || {};
    const awayDisplay = shortNames.away || state.teams.away || '';
    const homeDisplay = shortNames.home || state.teams.home || '';

    // サイドバー（略称）
    // アニメーション付きで更新
    updateTextWithAnimation('sidebar-away-name', awayDisplay, 'animate-slide-down');
    updateTextWithAnimation('sidebar-home-name', homeDisplay, 'animate-slide-down');
    
    // スコアボード（略称）
    setText('score-away-code', awayDisplay);
    setText('score-home-code', homeDisplay);
    // Admin（フルネーム）
    const adminAway = document.querySelector('#team-away-display .team-name');
    const adminHome = document.querySelector('#team-home-display .team-name');
    if (adminAway) adminAway.textContent = state.teams.away;
    if (adminHome) adminHome.textContent = state.teams.home;
    // Line Score Table（略称）
    setText('team-name-away', awayDisplay);
    setText('team-name-home', homeDisplay);
}

/**
 * イニング表示を更新
 */
export function updateInningDisplay(state) {
    const halfSymbol = state.inning.half === 'top' ? '\u25B2' : '\u25BC';
    const halfText = state.inning.half === 'top' ? '\u8868' : '\u88CF';
    
    setText('inning-half', halfText);
    setText('inning-number', state.inning.number);
    setText('inning-info', (state.inning.number ? state.inning.number + '\u56DE ' : '') + halfText);
}

/**
 * カウント表示を更新
 */
export function updateCountDisplay(state) {
    updateDots('ball-dots', state.count.ball);
    updateDots('strike-dots', state.count.strike);
    updateDots('out-dots', state.count.out);
}

function updateDots(containerId, count) {
    const dots = document.querySelectorAll(`#${containerId} .dot`);
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i < count);
    });
}

/**
 * ランナー表示を更新
 */
export function updateRunnerDisplay(state) {
    // Display Mode (index.html)
    toggleClass('runner-first', 'active', state.runners.first);
    toggleClass('runner-second', 'active', state.runners.second);
    toggleClass('runner-third', 'active', state.runners.third);

    // Admin Mode (admin-simple.html) & Control Panel (admin-control.html)
    // admin-simple.html uses btn-runner-1/2/3
    toggleClass('btn-runner-1', 'active', state.runners.first);
    toggleClass('btn-runner-2', 'active', state.runners.second);
    toggleClass('btn-runner-3', 'active', state.runners.third);
}

/**
 * 得点表示を更新
 */
export function updateScoreDisplay(state) {
    const awayTotal = state.scores.away.reduce((sum, s) => sum + s, 0);
    const homeTotal = state.scores.home.reduce((sum, s) => sum + s, 0);

    // 1-9回
    for (let i = 0; i < 9; i++) {
        const awayScore = state.scores.away[i];
        const homeScore = state.scores.home[i];
        
        let awayText = '';
        let homeText = '';
        
        if ((i + 1) < state.inning.number) {
            awayText = (awayScore !== undefined && awayScore !== null) ? awayScore : 0;
            homeText = (homeScore !== undefined && homeScore !== null) ? homeScore : 0;
        } else if ((i + 1) === state.inning.number) {
            awayText = (awayScore !== undefined && awayScore !== null) ? awayScore : 0;
            if (state.inning.half === 'bottom') {
                homeText = (homeScore !== undefined && homeScore !== null) ? homeScore : 0;
            }
        }

        setText('score-away-' + (i + 1), awayText);
        setText('score-home-' + (i + 1), homeText);
    }

    setText('score-away-total', awayTotal);
    setText('score-home-total', homeTotal);
    setText('away-total', awayTotal);
    setText('home-total', homeTotal);

    // RHEのRも更新（ステート同期）
    state.stats.away.r = awayTotal;
    state.stats.home.r = homeTotal;
}

/**
 * R (Run/Score), H (Hit), E (Error) の表示を更新
 */
export function updateRHEDisplay(state) {
    setText('stats-away-h', state.stats.away.h);
    setText('stats-home-h', state.stats.home.h);
    setText('stats-away-e', state.stats.away.e);
    setText('stats-home-e', state.stats.home.e);
}

/**
 * コントロールパネル（Admin）の更新
 */
export function updateControlPanel(state, isAdminMode) {
    if (!isAdminMode) return;

    const team = state.inning.half === 'top' ? 'away' : 'home';
    const teamName = state.teams[team];
    setText('scoring-team-label', teamName + '（攻撃）');

    const inningIndex = state.inning.number - 1;
    if (inningIndex >= 0 && inningIndex < state.scores[team].length) {
        setText('current-inning-score', state.scores[team][inningIndex]);
    }

    // 投手成績入力フィールド
    if (state.pitcherStats) {
        // 先攻投手
        const awayPitcherName = state.pitcher ? state.pitcher.away : '';
        const awayStats = (state.pitcherStatsHistory && awayPitcherName) ? state.pitcherStatsHistory[awayPitcherName] : null;
        
        setValue('pitcher-innings-away', awayStats ? (awayStats.innings || 0) : (state.pitcherStats.away.innings || 0));
        setValue('pitcher-k-away', awayStats ? (awayStats.strikeouts || 0) : (state.pitcherStats.away.strikeouts || 0));
        const runsAway = awayStats ? (awayStats.runs || 0) : (state.pitcherStats.away.runsFromLog || state.pitcherStats.away.runs || 0);
        setValue('pitcher-runs-away', runsAway);
        
        // 後攻投手
        const homePitcherName = state.pitcher ? state.pitcher.home : '';
        const homeStats = (state.pitcherStatsHistory && homePitcherName) ? state.pitcherStatsHistory[homePitcherName] : null;

        setValue('pitcher-innings-home', homeStats ? (homeStats.innings || 0) : (state.pitcherStats.home.innings || 0));
        setValue('pitcher-k-home', homeStats ? (homeStats.strikeouts || 0) : (state.pitcherStats.home.strikeouts || 0));
        const runsHome = homeStats ? (homeStats.runs || 0) : (state.pitcherStats.home.runsFromLog || state.pitcherStats.home.runs || 0);
        setValue('pitcher-runs-home', runsHome);
    }
}

/**
 * 下部スタッツ・情報バー更新
 */
export function updateBottomStats(state, isDisplayMode) {
    if (!isDisplayMode) return;
    
    const offenseTeam = state.inning.half === 'top' ? 'away' : 'home';
    const defenseTeam = state.inning.half === 'top' ? 'home' : 'away';

    // BATTER
    const batterIndex = state.currentBatter[offenseTeam];
    const batterName = state.lineup[offenseTeam][batterIndex] || '';
    setText('current-batter-name', batterName);
    setText('batter-name-large', batterName);
    
    // Set Role Label safely (admin mode doesn't have these labels maybe, but index does)
    const batterRoleLabel = document.querySelector('#player-display-left .player-role-label');
    if (batterRoleLabel) batterRoleLabel.textContent = batterName ? 'BATTER' : '';

    // PITCHER
    let pitcherName = '';
    const dhPitcherInput = (state.pitcher && state.pitcher[defenseTeam]) ? state.pitcher[defenseTeam] : '';
    
    if (dhPitcherInput && dhPitcherInput.trim() !== '') {
        pitcherName = dhPitcherInput;
    } else {
        let pitcherInLineup = false;
        if (state.positions && state.positions[defenseTeam]) {
            for (let i = 0; i < 9; i++) {
                if (state.positions[defenseTeam][i] === '投') {
                    pitcherName = state.lineup[defenseTeam][i] || '投手';
                    pitcherInLineup = true;
                    break;
                }
            }
        }
        if (!pitcherInLineup) pitcherName = '';
    }
    setText('current-pitcher-name', pitcherName);
    setText('pitcher-name-large', pitcherName);
    
    const pitcherRoleLabel = document.querySelector('#player-display-right .player-role-label');
    if (pitcherRoleLabel) pitcherRoleLabel.textContent = pitcherName ? 'PITCHER' : '';

    // 打者の当日成績
    const batterStatsToday = document.getElementById('batter-stats-today');
    if (batterStatsToday) {
        batterStatsToday.innerHTML = '';
        const results = state.atBatResults[offenseTeam][batterIndex] || [];
        results.forEach(code => {
            const label = RESULT_LABELS[code] || code;
            const span = document.createElement('span');
            span.className = 'stat-badge';
            span.textContent = label;
            batterStatsToday.appendChild(span);
        });
    }

    // 投手成績
    const historyStats = (state.pitcherStatsHistory && pitcherName) ? state.pitcherStatsHistory[pitcherName] : null;
    
    if (historyStats) {
        setText('pitcher-innings', (historyStats.innings || 0).toFixed(1));
        setText('pitcher-strikeouts', historyStats.strikeouts || 0);
        setText('pitcher-walks', historyStats.walks || 0);
        setText('pitcher-runs', historyStats.runs || 0);
    } else if (state.pitcherStats && state.pitcherStats[defenseTeam]) {
        const innings = state.pitcherStats[defenseTeam].innings || 0;
        setText('pitcher-innings', innings.toFixed(1));
        setText('pitcher-strikeouts', state.pitcherStats[defenseTeam].strikeouts || 0);
        setText('pitcher-walks', state.pitcherStats[defenseTeam].walks || 0);
        const runs = state.pitcherStats[defenseTeam].runsFromLog !== undefined ? state.pitcherStats[defenseTeam].runsFromLog : (state.pitcherStats[defenseTeam].runs || 0);
        setText('pitcher-runs', runs);
    }

    // シーズン成績更新 (API)
    updateSeasonStats(batterName, pitcherName, state);

    // テキストスケーリング適用
    requestAnimationFrame(adjustTextScale);
}

async function updateSeasonStats(batterName, pitcherName, state) {
    const offenseTeam = state.inning.half === 'top' ? 'away' : 'home';
    const defenseTeam = state.inning.half === 'top' ? 'home' : 'away';

    // Batter Stats（選手ごとにDBから取得 + 当日成績）
    const batterId = playerMap[batterName];
    if (batterId) {
        // 常に更新するため、IDチェックの最適化は一旦外すか、
        // または当日成績が変わった場合も更新する必要があるため、IDチェックだけでは不十分。
        // ここでは簡易的に毎回計算する（APIリクエストはID変わった時のみに制限したいが...）
        // APIキャッシュ戦略: batterIdが同じなら前回のAPI結果を再利用したいが、
        // 複雑になるので毎回fetchするか、あるいはグローバル変数にキャッシュするか。
        // ここでは lastBatterId を使ったキャッシュは維持しつつ、表示更新は毎回行う。
        
        let dbStats = null;
        if (batterId !== lastBatterId) {
            lastBatterId = batterId;
            try {
                const res = await fetch(`/api/batting-stats?player_id=${batterId}`);
                if (res.ok) {
                    const rows = await res.json();
                    if (rows.length > 0) {
                        dbStats = rows[0]; // 最新シーズン
                        lastBatterDbStats = dbStats; // Cache
                    } else {
                         lastBatterDbStats = null;
                    }
                }
            } catch (e) {
                console.error('Failed to fetch batter stats', e);
            }
        } else {
            dbStats = lastBatterDbStats;
        }

        // 当日成績の集計
        const batterIndex = state.currentBatter[offenseTeam];
        // 名前が一致することを確認（代打などでインデックスと名前がずれる可能性は低いが念のため）
        // しかし batterName は updateBottomStats から渡されているので一致しているはず。
        
        const today = calculateTodayBatterStats(state, offenseTeam, batterIndex);
        
        // 当日+通算の合算
        const merged = mergeBatterStats(dbStats, today);
        
        setText('batter-avg', merged.avg);
        setText('batter-hr', merged.hr);
        setText('batter-rbi', merged.rbi);
        setText('batter-ops', merged.ops);

    } else {
        lastBatterId = null;
        lastBatterDbStats = null;
        setText('batter-avg', '');
        setText('batter-hr', '0');
        setText('batter-rbi', '0');
        setText('batter-ops', '');
    }

    // Pitcher Stats（選手ごとにDBから取得 + 当日成績）
    const pitcherId = playerMap[pitcherName];
    if (pitcherId) {
        let dbStats = null;
        if (pitcherId !== lastPitcherId) {
            lastPitcherId = pitcherId;
            try {
                const res = await fetch(`/api/pitching-stats?player_id=${pitcherId}`);
                if (res.ok) {
                    const rows = await res.json();
                    if (rows.length > 0) {
                        dbStats = rows[0];
                        lastPitcherDbStats = dbStats;
                    } else {
                        lastPitcherDbStats = null;
                    }
                }
            } catch (e) {
                console.error('Failed to fetch pitcher stats', e);
            }
        } else {
            dbStats = lastPitcherDbStats;
        }

        // 当日成績（state.pitcherStats は現在登板中の投手＝pitcherNameと仮定）
        // もしリリーフ画面などで別の投手を見ている場合は todayStats は空にすべきだが、
        // ここでは updateBottomStats が「現在の投手」を表示している前提。
        const pStats = state.pitcherStats ? state.pitcherStats[defenseTeam] : { innings: 0, runs: 0, strikeouts: 0 };
        const today = {
            ip: pStats.innings || 0,
            er: pStats.runs || 0,
            k: pStats.strikeouts || 0
        };

        const merged = mergePitcherStats(dbStats, today);

        setText('pitcher-era', merged.era);
        setText('pitcher-k9', merged.k9);

    } else {
        lastPitcherId = null;
        lastPitcherDbStats = null;
        setText('pitcher-era', '');
        setText('pitcher-k9', '');
    }
}

let lastBatterDbStats = null;
let lastPitcherDbStats = null;

function calculateTodayBatterStats(state, team, batterIndex) {
    const results = state.atBatResults[team][batterIndex] || [];
    const rbi = (state.todayRBI && state.todayRBI[team] && state.todayRBI[team][batterIndex]) || 0;
    
    let ab = 0;
    let h = 0;
    let hr = 0;
    let bb = 0;
    let hbp = 0;
    let sf = 0;
    let tb = 0;
    
    results.forEach(res => {
        // AB計算 (Walk, HBP, Sacrifice, Interference は除外)
        if (!['walk', 'hbp', 'sacrifice'].includes(res)) {
            ab++;
        }
        // Hit計算
        if (['single', 'double', 'triple', 'homerun'].includes(res)) {
            h++;
        }
        // HR
        if (res === 'homerun') hr++;
        
        // その他
        if (res === 'walk') bb++;
        if (res === 'hbp') hbp++;
        if (res === 'sacrifice') sf++; // 犠飛か犠打か区別していないが、一旦すべてSF扱い(OPS計算用)とするか、除外するか。便宜上ABから除外のみ。
        
        // TB
        if (res === 'single') tb += 1;
        if (res === 'double') tb += 2;
        if (res === 'triple') tb += 3;
        if (res === 'homerun') tb += 4;
    });
    
    return { ab, h, hr, rbi, bb, hbp, sf, tb };
}

function mergeBatterStats(db, today) {
    const sAtBats = db ? parseInt(db.at_bats || 0) : 0;
    const sHits = db ? parseInt(db.hits || 0) : 0;
    const sHr = db ? parseInt(db.home_runs || 0) : 0;
    const sRbi = db ? parseInt(db.rbis || 0) : 0;
    const sBb = db ? parseInt(db.walks || 0) : 0;
    const sHbp = db ? parseInt(db.hit_by_pitch || 0) : 0;
    const sSf = db ? parseInt(db.sacrifice_flies || 0) : 0;
    // Total Bases might not be in DB struct passed here, need to approximate or assume 0 if missing
    // DB schema has total_bases based on my check, but let's check fetch result.
    // If not available, we can't perfectly calc SLG. Assume SLG part of OPS is static? No.
    // Let's assume (TotalBases) ~ (Hits + ExtraBases).
    // Or just use existing OPS and update weighted?
    // OPS = OBP + SLG.
    // New OPS = (Total H + Total BB + Total HBP) / (Total PA) + (Total TB) / (Total AB)
    // If we lack Total TB from DB, we can't calc New OPS easily.
    // fallback: use DB OPS if no today stats, else try approximation?
    // Actually schema.sql shows `total_bases` column.
    const sTb = db ? parseInt(db.total_bases || 0) : 0; 
    
    const tAb = sAtBats + today.ab;
    const tH = sHits + today.h;
    const tHr = sHr + today.hr;
    const tRbi = sRbi + today.rbi;
    
    const avg = tAb > 0 ? (tH / tAb).toFixed(3) : '.---';
    
    // OPS Calc
    // OBP = (H + BB + HBP) / (AB + BB + HBP + SF)
    const tBb = sBb + today.bb;
    const tHbp = sHbp + today.hbp;
    const tSf = sSf + today.sf;
    const tTb = sTb + today.tb;
    
    const pa = tAb + tBb + tHbp + tSf;
    let ops = '.---';
    
    if (pa > 0 && tAb > 0) {
        const obp = (tH + tBb + tHbp) / pa;
        const slg = tTb / tAb;
        ops = (obp + slg).toFixed(3);
    } else if (db && db.ops) {
        ops = Number(db.ops).toFixed(3); // Fallback
    }

    return {
        avg: avg.replace('0.', '.'), // Remove leading zero
        hr: tHr,
        rbi: tRbi,
        ops: ops.replace('0.', '.')
    };
}

function mergePitcherStats(db, today) {
    const sIp = db ? parseFloat(db.innings_pitched || 0) : 0;
    const sEr = db ? parseInt(db.earned_runs || db.runs_allowed || 0) : 0; // Use earned_runs if available
    const sK = db ? parseInt(db.strikeouts || 0) : 0;
    
    const tIp = sIp + today.ip;
    const tEr = sEr + today.er;
    const tK = sK + today.k;
    
    const era = tIp > 0 ? ((tEr * 9) / tIp).toFixed(2) : '-.--';
    const k9 = tIp > 0 ? ((tK * 9) / tIp).toFixed(2) : '-.--';
    
    return { era, k9 };
}


/**
 * 打順ボードの表示を更新
 */
export function updateLineupDisplay(state, isAdminMode) {
    ['away', 'home'].forEach(team => {
        let container = document.getElementById('lineup-' + team + '-display');
        if (!container) {
             container = document.getElementById(team + '-lineup'); // Admin互換
        }
        if (!container) return;
        
        // AdminModeで入力フィールド生成済みの場合は、別の関数(generateLineupInputs)で処理されているはずだが、
        // Admin画面の左側（表示確認用）などの更新もある。
        // ここでは「表示用」の更新を行う。
        // もし container が input を含むフォームなら上書きしてはいけない。
        // lineup-item クラスを持つ div が直下にあるか、あるいは中身が空なら描画。
        // Check if this container is intended for display (not inputs)
        // Admin page has #lineup-input-home/away for inputs, and #home/away-lineup for display?
        // Let's check admin.html structure.
        // admin.html: <div id="away-lineup" class="lineup-board">...</div>
        // admin.html also has: <div id="lineup-input-away">...</div>
        
        // So #away-lineup is for display.
        
        container.innerHTML = '';
        const currentBatterIndex = state.currentBatter[team];
        const isAttacking = (state.inning.half === 'top' && team === 'away') ||
                            (state.inning.half === 'bottom' && team === 'home');
                         
        for (let i = 0; i < 9; i++) {
            const playerName = state.lineup[team][i] || '';
            const pos = (state.positions && state.positions[team][i]) ? state.positions[team][i] : '';
            const isActive = isAttacking && i === currentBatterIndex;
            
            const playerDiv = document.createElement('div');
            playerDiv.className = 'lineup-item' + (isActive ? ' active' : '');
            
            const posClass = getPositionClass(pos);
            if (playerName) {
                playerDiv.innerHTML = '<span class="order-num">' + (i + 1) + '</span>' +
                    '<span class="player-pos ' + posClass + '">' + pos + '</span>' +
                    '<span class="player-name">' + playerName + '</span>';
            } else {
                 playerDiv.innerHTML = '';
                 playerDiv.style.border = 'none'; // Hide border if empty
                 playerDiv.style.background = 'transparent';
            }
            container.appendChild(playerDiv);
        }

        // Pitcher Display
        if (state.pitcher && state.pitcher[team]) {
            const pitcherName = state.pitcher[team];
            if (pitcherName) {
                const pitcherDiv = document.createElement('div');
                pitcherDiv.className = 'lineup-item pitcher-item';
                
                // Only show P and Position if pitcherName is present
                if (pitcherName) {
                    pitcherDiv.innerHTML = '<span class="order-num">P</span>' +
                        '<span class="player-pos pos-pitcher">投</span>' +
                        '<span class="player-name">' + pitcherName + '</span>';
                    container.appendChild(pitcherDiv);
                }
            }
        }
    });

    // 入力フォームの値も同期（Adminのみ）
    if (isAdminMode) {
        syncLineupInputs(state);
    }

    // 長い名前の自動縮小
    // DOM更新直後だとレイアウトが確定していない場合があるため、少し待つか
    // 強制レイアウトさせる。ここではrequestAnimationFrameを使用。
    requestAnimationFrame(adjustTextScale);
}

/**
 * 守備位置に応じたクラスを返す
 */
function getPositionClass(pos) {
    if (pos === '投') return 'pos-pitcher';
    if (pos === '捕') return 'pos-catcher';
    if (['一', '二', '三', '遊'].includes(pos)) return 'pos-infielder';
    if (['左', '中', '右'].includes(pos)) return 'pos-outfielder';
    if (['指', 'DH'].includes(pos)) return 'pos-dh';
    return '';
}

/**
 * Admin入力フォームの値を同期
 */
function syncLineupInputs(state) {
    ['away', 'home'].forEach(team => {
        for (let i = 0; i < 9; i++) {
            const nameInput = document.querySelector(`.lineup-input-name[data-team="${team}"][data-order="${i}"]`);
            if (nameInput && document.activeElement !== nameInput) {
                nameInput.value = state.lineup[team][i] || '';
            }
            const posSelect = document.querySelector(`.lineup-input-pos[data-team="${team}"][data-order="${i}"]`);
            if (posSelect && document.activeElement !== posSelect) {
                 if (state.positions && state.positions[team][i]) {
                    posSelect.value = state.positions[team][i];
                 }
            }
        }
        // Pitcher
        const pInput = document.querySelector(`.lineup-input-pitcher[data-team="${team}"]`);
        if (pInput && document.activeElement !== pInput) {
            pInput.value = state.pitcher ? (state.pitcher[team] || '') : '';
        }
    });
}

/**
 * 現在の打者情報を更新 (Admin用)
 */
export function updateCurrentBatterDisplay(state, isAdminMode) {
    if (!isAdminMode) return;
    
    const team = state.inning.half === 'top' ? 'away' : 'home';
    const batterIndex = state.currentBatter[team];
    const batterName = state.lineup[team][batterIndex] || '---';
    
    // Adminのcontrol-panelにあるもの
    setText('current-batter-name', batterName); 
    setText('current-batter-name-control', batterName); // Control Tab
    setText('current-batter-order', batterIndex + 1);
}

/**
 * 結果アニメーション表示
 */
export function showResultAnimation(resultCode) {
    if (resultCode === 'LINEUP_ANNOUNCEMENT') {
        playLineupAnnouncement();
        return;
    }
    
    if (resultCode === 'CHANGE') {
        playChangeAnimation();
        return;
    }
    
    // 既存のヒット等のアニメーション
    const overlay = document.getElementById('result-overlay');
    const textEl = document.getElementById('result-text');
    if (!overlay || !textEl) return;
    
    const text = GameLogic.formatResultForAnimation(resultCode);
    textEl.textContent = text;
    
    textEl.className = 'result-text';
    void textEl.offsetWidth; // Force Reflow
    
    if (['single', 'double', 'triple'].includes(resultCode)) {
        textEl.classList.add('res-hit');
    } else if (resultCode === 'homerun') {
        textEl.classList.add('res-homerun');
    } else if (['strikeout', 'groundout', 'flyout', 'lineout', 'dp'].includes(resultCode)) {
        textEl.classList.add('res-out');
    }
    
    overlay.classList.add('active');
    textEl.classList.add('result-animate');
    
    setTimeout(() => {
        textEl.classList.remove('result-animate');
        overlay.classList.remove('active');
    }, 4500);
}

/**
 * 打順入力フォームを生成（Admin初期化時）
 * @param {Object} state 
 * @param {Array} players - 選手データ配列
 * @param {Object} teamSelections - 選択されているチームID {away: teamId, home: teamId}
 */
export function generateLineupInputs(state, players = [], teamSelections = {away: null, home: null}) {
    ['away', 'home'].forEach(team => {
        const container = document.getElementById(`lineup-input-${team}`);
        if (!container) return;
        
        // 既存の構造があるか確認
        const hasStructure = container.querySelector('.lineup-item');
        
        // 選択されたチームの選手をフィルタリング
        const teamId = teamSelections[team];
        const teamPlayers = teamId ? players.filter(p => p.team_id === parseInt(teamId)) : [];
        
        if (!hasStructure) {
            // 構造がない場合は動的に生成 (フォールバック)
            // Previously existing logic (re-implemented here for fallback)
            container.innerHTML = '';
            
            for (let i = 0; i < 9; i++) {
                const row = document.createElement('div');
                row.className = 'lineup-item';
                
                const num = document.createElement('span');
                num.className = 'lineup-number';
                num.textContent = (i + 1);
                row.appendChild(num);
                
                const nameSelect = document.createElement('select');
                nameSelect.className = 'lineup-input-name';
                nameSelect.dataset.team = team;
                nameSelect.dataset.order = i;
                
                populatePlayerOptions(nameSelect, teamPlayers, state.lineup[team][i]);
                
                row.appendChild(nameSelect);
                
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
                posSelect.appendChild(opt);
                });
                row.appendChild(posSelect);
                
                // 交代ボタン
                const subBtn = document.createElement('button');
                subBtn.className = 'btn-sub-player';
                subBtn.textContent = '交代';
                subBtn.dataset.team = team;
                subBtn.dataset.order = i;
                row.appendChild(subBtn);
                
                container.appendChild(row);
            }
            
            // Pitcher
            const pRow = document.createElement('div');
            pRow.className = 'lineup-item pitcher-row';
            pRow.style.marginTop = '10px';
            pRow.style.paddingTop = '10px';
            pRow.style.borderTop = '1px dashed rgba(255, 215, 0, 0.3)';
            
            const pLabel = document.createElement('span');
            pLabel.className = 'lineup-number';
            pLabel.textContent = 'P';
            pLabel.style.fontWeight = 'bold';
            pLabel.style.color = '#e74c3c';
            pRow.appendChild(pLabel);
            
            const pSelect = document.createElement('select');
            pSelect.className = 'lineup-input-pitcher';
            pSelect.dataset.team = team;
            
            populatePlayerOptions(pSelect, teamPlayers, state.pitcher ? state.pitcher[team] : '');
            
            pRow.appendChild(pSelect);
            
            const pPos = document.createElement('span');
            pPos.className = 'lineup-pos-fixed';
            pPos.textContent = '投';
            pPos.style.display = 'inline-block';
            pPos.style.width = '55px';
            pPos.style.textAlign = 'center';
            pPos.style.fontSize = '11px';
            pPos.style.color = '#ffd700';
            pRow.appendChild(pPos);
            
            // 交代ボタン(P)
            const subBtnP = document.createElement('button');
            subBtnP.className = 'btn-sub-player';
            subBtnP.textContent = '交代';
            subBtnP.dataset.team = team;
            subBtnP.dataset.order = 'pitcher';
            pRow.appendChild(subBtnP);
            
            container.appendChild(pRow);
            
        } else {
            // 既存の構造がある場合は、中身（オプションと値）だけ更新
            for (let i = 0; i < 9; i++) {
                const nameSelect = container.querySelector(`.lineup-input-name[data-order="${i}"]`);
                if (nameSelect) {
                    populatePlayerOptions(nameSelect, teamPlayers, state.lineup[team][i]);
                }
                
                const posSelect = container.querySelector(`.lineup-input-pos[data-order="${i}"]`);
                if (posSelect && state.positions && state.positions[team][i]) {
                    posSelect.value = state.positions[team][i];
                }
            }
            
            // Pitcher
            const pSelect = container.querySelector(`.lineup-input-pitcher[data-team="${team}"]`);
            if (pSelect) {
                populatePlayerOptions(pSelect, teamPlayers, state.pitcher ? state.pitcher[team] : '');
            }
        }
    });
}

/**
 * 選手プルダウンのオプションを生成・更新するヘルパー関数
 */
function populatePlayerOptions(selectElement, players, currentValue) {
    // 既存のオプションをクリア
    selectElement.innerHTML = '';
    
    // 空のオプション
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '選手を選択...';
    selectElement.appendChild(emptyOpt);
    
    // チームの選手を追加
    players.forEach(player => {
        const opt = document.createElement('option');
        opt.value = player.name;
        opt.textContent = `${player.position} - ${player.name} (#${player.number || '-'})`;
        selectElement.appendChild(opt);
    });
    
    // 値をセット (値が存在すればselectedも設定される)
    if (currentValue) {
        // リストにない場合追加
        if (currentValue !== '' && !players.find(p => p.name === currentValue)) {
            const customOpt = document.createElement('option');
            customOpt.value = currentValue;
            customOpt.textContent = currentValue;
            selectElement.appendChild(customOpt);
        }
        selectElement.value = currentValue;
    }
}

// Helper Functions
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function toggleClass(id, className, condition) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle(className, condition);
}

function adjustTextScale() {
    const names = document.querySelectorAll('.player-name, .player-name-large');
    
    names.forEach(el => {
        // 幅制約がない場合は何もしない
        if (el.clientWidth === 0) return;
        
        // スタイルリセット
        el.style.transform = 'none';
        
        const containerWidth = el.clientWidth;
        const text = el.textContent;
        
        // テキストの幅を正確に測るために一時的なspanを作成
        const span = document.createElement('span');
        span.style.visibility = 'hidden';
        span.style.position = 'absolute';
        span.style.whiteSpace = 'nowrap';
        // フォントスタイルをコピー
        const style = window.getComputedStyle(el);
        span.style.fontFamily = style.fontFamily;
        span.style.fontSize = style.fontSize;
        span.style.fontWeight = style.fontWeight;
        span.style.letterSpacing = style.letterSpacing;
        span.textContent = text;
        
        document.body.appendChild(span);
        const textWidth = span.offsetWidth;
        document.body.removeChild(span);
        
        if (textWidth > containerWidth) {
            const scale = containerWidth / textWidth;
            // ギリギリだと見切れることがあるので少し余裕を持たせる
            const safeScale = scale * 0.95; 
            
            // 右寄せの場合は右端基準、それ以外は左端基準
            const originX = style.textAlign === 'right' ? 'right' : 'left';
            
            el.style.transformOrigin = `${originX} center`;
            el.style.transform = `scaleX(${safeScale})`;
        }
    });
}

/**
 * 選手交代アニメーション表示
 */
export function showLineupAnimation(changes) {
    let overlay = document.getElementById('lineup-change-overlay');
    
    // Create overlay if not exists
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'lineup-change-overlay';
        overlay.className = 'lineup-change-overlay';
        
        const title = document.createElement('div');
        title.className = 'lineup-change-title';
        title.textContent = 'PLAYER CHANGE';
        overlay.appendChild(title);
        
        const details = document.createElement('div');
        details.id = 'lineup-change-details';
        details.className = 'lineup-change-details';
        overlay.appendChild(details);
        
        document.body.appendChild(overlay);
    }
    
    const detailsEl = document.getElementById('lineup-change-details');
    if (!detailsEl) return; // Should exist

    // Format Message
    let messageHtml = '';
    
    // Prioritize Pitcher Change
    const pitcherChanges = changes.filter(c => c.type === 'pitcher');
    const batterChanges = changes.filter(c => c.type === 'batter');
    const posChanges = changes.filter(c => c.type === 'position');

    if (pitcherChanges.length > 0) {
        // Just show first pitcher change for simplicity or loop
        pitcherChanges.forEach(c => {
             messageHtml += `<div class="lineup-change-row">PITCHER CHANGE<br>${c.oldName || '---'} <span class="change-arrow">▶</span> ${c.newName}</div>`;
        });
    }
    
    // Substitution messages removed as per request
    /*
    if (batterChanges.length > 0) {
        batterChanges.forEach(c => {
             messageHtml += `<div class="lineup-change-row">SUBSTITUTION<br>${c.oldName || '---'} <span class="change-arrow">▶</span> ${c.newName}</div>`;
        });
    }
    */
    
    if (posChanges.length > 0 && messageHtml === '') {
         messageHtml += `<div class="lineup-change-row">DEFENSIVE CHANGE</div>`;
    }

    if (messageHtml === '') return; // No meaningful message

    detailsEl.innerHTML = messageHtml;
    
    // Reset Animation
    overlay.classList.remove('lineup-change-animate');
    void overlay.offsetWidth; // Force Reflow
    overlay.classList.add('lineup-change-animate');
    
    // Remove after animation (optional, but good for cleanup of class)
    setTimeout(() => {
        overlay.classList.remove('lineup-change-animate');
    }, 5500);

    // ==========================================
    // Sidebar Rotation Animation
    // ==========================================
    changes.forEach(c => {
        const team = c.team;
        const container = document.getElementById(`lineup-${team}-display`);
        if (!container) return;

        let targetEl = null;

        if (c.type === 'pitcher') {
            // Pitcher is usually the last item or has class .pitcher-item
            targetEl = container.querySelector('.pitcher-item');
        } else {
            // Batter/Position change (0-indexed order)
            // .lineup-item that is NOT .pitcher-item
            // The order in the DOM corresponds to the batting order
            const items = container.querySelectorAll('.lineup-item:not(.pitcher-item)');
            if (items[c.order]) {
                targetEl = items[c.order];
            }
        }

        if (targetEl) {
            // Reset animation
            targetEl.classList.remove('animate-flip');
            void targetEl.offsetWidth; // Force Reflow
            targetEl.classList.add('animate-flip');

            // Remove class after animation
            setTimeout(() => {
                targetEl.classList.remove('animate-flip');
            }, 1000);
        }
    });
}

// Helper to update text with animation only if changed
function updateTextWithAnimation(id, newText, animationClass) {
    const el = document.getElementById(id);
    if (!el) return;
    
    if (el.textContent !== newText) {
        el.textContent = newText;
        el.classList.remove(animationClass);
        void el.offsetWidth; // Force Reflow
        el.classList.add(animationClass);
        // Remove after (optional, but cleaner)
        setTimeout(() => {
            el.classList.remove(animationClass);
        }, 1000);
    }
}

// 得点ログのキャッシュ（再描画判定用）
let lastScoreLogsHash = '';

/**
 * 得点ログの表示更新
 * 最新5件の得点ログを表示（内容変更時のみ再描画）
 */
export function updateScoreLog(state) {
    const awayContainer = document.getElementById('score-log-team-away');
    const homeContainer = document.getElementById('score-log-team-home');
    
    // Fallback for old HTML structure
    if (!awayContainer || !homeContainer) return;

    const logs = state.scoreLogs || [];
    
    // Check hash to avoid redraw
    // Entire log history is relevant for chronological display
    const currentHash = logs.join('|||');
    if (currentHash === lastScoreLogsHash) return;
    lastScoreLogsHash = currentHash;
    
    // Clear containers
    awayContainer.innerHTML = '';
    homeContainer.innerHTML = '';
    
    // Show section if logs exist
    const section = document.getElementById('score-log-section');
    if (section) {
        section.style.display = logs.length > 0 ? 'block' : 'none';
    }

    // Process logs: Separate by team and store content
    // logs are Newest First. We want Chronological (Oldest First) for summary.
    const awayLogs = [];
    const homeLogs = [];
    
    // Iterate reverse (Oldest -> Newest)
    for (let i = logs.length - 1; i >= 0; i--) {
        const log = logs[i];
        const match = log.match(/^\[(.+?)\]\s+(.+)$/);
        if (match) {
            const teamKey = match[1]; // 'away' or 'home'
            const content = match[2];
            
            if (teamKey === 'away') awayLogs.push(content);
            else if (teamKey === 'home') homeLogs.push(content);
            // Ignore legacy or unknown format without [team] prefix
        }
    }
    
    // Render Away logs
    awayLogs.forEach(content => {
        const el = document.createElement('div');
        el.className = 'score-log-item compact';
        el.textContent = content;
        awayContainer.appendChild(el);
    });

    // Render Home logs
    homeLogs.forEach(content => {
        const el = document.createElement('div');
        el.className = 'score-log-item compact';
        el.textContent = content;
        homeContainer.appendChild(el);
    });
}

/**
 * 得点ログをパースしてオブジェクトに変換
 * @param {string} log - ログ文字列（例: "[日ハム] 1回裏 佐藤輝明 HR①"）
 * @returns {Object|null} パース結果またはnull
 */
function parseScoreLog(log) {
    if (!log) return null;
    
    // 新パターン: "[チーム名] N回[表/裏] [選手名] [結果][得点]"
    const matchNew = log.match(/^\[(.+?)\]\s+(\d+回[表裏])\s+(.+?)\s+([^\s①②③④⑤]+)(①|②|③|④|⑤)?$/);
    
    if (matchNew) {
        return {
            team: matchNew[1],
            inning: matchNew[2],
            batter: matchNew[3],
            result: matchNew[4],
            rbi: matchNew[5] || ''
        };
    }
    
    // 旧パターン（互換性のため）: "N回[表/裏] [選手名] [結果][得点]"
    const matchOld = log.match(/^(\d+回[表裏])\s+(.+?)\s+([^\s①②③④⑤]+)(①|②|③|④|⑤)?$/);
    
    if (matchOld) {
        return {
            team: '',
            inning: matchOld[1],
            batter: matchOld[2],
            result: matchOld[3],
            rbi: matchOld[4] || ''
        };
    }
    
    // パースできなかった場合
    return null;
}

/**
 * 投手リレー（先発・継投）の表示更新
 * 両チームの投手情報を左右に表示
 */
export function updatePitcherRelay(state) {
    // 新しいHTML構造に対応
    const awayPanel = document.getElementById('away-pitcher-panel');
    const homePanel = document.getElementById('home-pitcher-panel');
    
    // 新構造が無い場合は旧構造互換（フォールバック）
    if (!awayPanel || !homePanel) {
        updatePitcherRelayLegacy(state);
        return;
    }
    
    // 現在守備中のチーム
    const defendingTeam = state.inning.half === 'top' ? 'home' : 'away';
    
    // 両チームの投手情報を更新
    ['away', 'home'].forEach(team => {
        const panel = team === 'away' ? awayPanel : homePanel;
        const isDefending = team === defendingTeam;
        
        // チーム名ラベルを更新
        const teamLabel = document.getElementById(`${team}-pitcher-team-label`);
        if (teamLabel) {
            const teamName = state.teamShortNames && state.teamShortNames[team] 
                ? state.teamShortNames[team] 
                : (state.teams && state.teams[team] ? state.teams[team] : (team === 'away' ? 'AWAY' : 'HOME'));
            teamLabel.textContent = teamName;
        }
        
        // 先発投手名を取得（startingPitcherから）
        const starterName = state.startingPitcher ? (state.startingPitcher[team] || '') : '';
        // 現在の投手名を取得
        const currentPitcherName = state.pitcher ? (state.pitcher[team] || '') : '';
        
        // 先発投手を表示
        const starterEntry = document.getElementById(`${team}-starter-entry`);
        const starterNameEl = document.getElementById(`${team}-starter-name`);
        
        if (starterNameEl) {
            // 先発投手が設定されている場合のみ表示
            starterNameEl.textContent = starterName || '-';
        }
        
        if (starterEntry) {
            // 先発が現在もマウンドにいる場合
            const starterOnMound = isDefending && starterName && starterName === currentPitcherName;
            starterEntry.classList.toggle('on-mound', starterOnMound);
            
            // 先発が未設定の場合は非表示
            starterEntry.style.display = starterName ? 'flex' : 'none';
        }
        
        // リリーフ投手を表示（pitcherHistoryから）
        const relayContainer = document.getElementById(`${team}-relay-container`);
        const reliefSection = document.getElementById(`${team}-relief-section`);
        
        if (relayContainer && reliefSection) {
            relayContainer.innerHTML = '';
            
            // 投手交代履歴から全てのリリーフ投手を表示（登板順 = 配列の順番）
            const pitcherHistory = state.pitcherHistory ? (state.pitcherHistory[team] || []) : [];
            
            if (pitcherHistory.length > 0) {
                // リリーフがいる場合はセクションを表示
                reliefSection.classList.add('has-relievers');
                
                pitcherHistory.forEach(reliefPitcher => {
                    const reliefItem = document.createElement('div');
                    reliefItem.className = 'relief-pitcher-item';
                    
                    // 現在守備中のチームで、かつ現在の投手と一致する場合はアクティブ表示
                    if (isDefending && reliefPitcher === currentPitcherName) {
                        reliefItem.classList.add('on-mound');
                    }
                    
                    reliefItem.textContent = reliefPitcher;
                    
                    relayContainer.appendChild(reliefItem);
                });
            } else {
                // リリーフがいない場合はセクションを非表示
                reliefSection.classList.remove('has-relievers');
            }
        }
        
        // パネル自体の表示/非表示
        // 投手がセットされていない場合は控えめに表示
        const hasContent = starterName || (state.pitcherHistory && state.pitcherHistory[team] && state.pitcherHistory[team].length > 0);
        panel.style.opacity = hasContent ? '1' : '0.3';
    });
}

/**
 * 旧HTML構造用のフォールバック関数
 */
function updatePitcherRelayLegacy(state) {
    const starterInfo = document.getElementById('starter-info');
    const reliefInfo = document.getElementById('relief-info');
    if (!starterInfo || !reliefInfo) return;

    const currentTeam = state.inning.half === 'top' ? 'home' : 'away';
    
    const starterName = state.startingPitcher ? state.startingPitcher[currentTeam] : '';
    const currentPitcherName = state.pitcher ? state.pitcher[currentTeam] : '';
    
    const starterEl = document.getElementById('display-starter-name');
    if (starterEl) starterEl.textContent = starterName || '';
    
    const starterLabel = document.querySelector('#starter-info .role-label');
    if (starterLabel) starterLabel.textContent = starterName ? 'STARTING PITCHER' : '';
    
    const reliefEl = document.getElementById('display-relief-name');
    const reliefLabel = document.querySelector('#relief-info .role-label');
    
    if (starterName && currentPitcherName && starterName !== currentPitcherName) {
        reliefInfo.style.display = 'flex';
        if (reliefEl) reliefEl.textContent = currentPitcherName;
        if (reliefLabel) reliefLabel.textContent = 'RELIEF PITCHER';
        
        starterInfo.classList.remove('active');
        reliefInfo.classList.add('active');
    } else {
        reliefInfo.style.display = 'none';
        
        starterInfo.classList.add('active');
        reliefInfo.classList.remove('active');
    }
    
    if (!starterName) {
        starterInfo.style.display = 'none';
    } else {
        starterInfo.style.display = 'flex';
    }
}



/**
 * スタメン発表アニメーション
 */
export function playLineupAnnouncement() {
    // 演出: 
    // 1. 全画面オーバーレイで "STARTING LINEUP"
    // 2. サイドバーをクリアし、1番から順にスライドインで登場
    
    const overlay = document.createElement('div');
    overlay.className = 'lineup-announcement-overlay';
    overlay.innerHTML = '<div class="announcement-title">STARTING LINEUP</div>';
    document.body.appendChild(overlay);
    
    // Styles for overlay
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0,0,0,0.8)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '1000';
    overlay.style.animation = 'fadeIn 0.5s forwards';
    
    const title = overlay.querySelector('.announcement-title');
    title.style.fontFamily = "'Oswald', sans-serif";
    title.style.fontSize = '80px';
    title.style.color = '#ffd700';
    title.style.textShadow = '0 0 20px rgba(255, 215, 0, 0.8)';
    title.style.animation = 'scaleUp 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    
    // Add CSS for animations if not exists
    if (!document.getElementById('anim-styles')) {
        const style = document.createElement('style');
        style.id = 'anim-styles';
        style.textContent = `
            @keyframes scaleUp { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            @keyframes highlightRow { 
                0% { background: rgba(255,255,255,0.1); transform: translateX(0); }
                50% { background: rgba(255, 215, 0, 0.5); transform: translateX(20px) scale(1.05); box-shadow: 0 0 20px #ffd700; }
                100% { background: rgba(255,255,255,0.1); transform: translateX(0); }
            }
            @keyframes slideInLeft {
                from { opacity: 0; transform: translateX(-50px); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes slideInRight {
                from { opacity: 0; transform: translateX(50px); }
                to { opacity: 1; transform: translateX(0); }
            }
            .lineup-item.hidden-for-animation {
                opacity: 0;
                visibility: hidden;
            }
            .lineup-item.animate-slide-in-left {
                animation: slideInLeft 0.5s ease-out forwards;
            }
            .lineup-item.animate-slide-in-right {
                animation: slideInRight 0.5s ease-out forwards;
            }
        `;
        document.head.appendChild(style);
    }

    // サイドバーの選手を一旦非表示にする
    hideAllLineupItems('away');
    hideAllLineupItems('home');

    // Sequence
    setTimeout(() => {
        // Remove overlay title, show sidebar focus
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);
        
        // Animate Lineup Rows - ビジターとホームを同時にアニメーション
        animateLineupRows('away', 0, 'left');
        animateLineupRows('home', 0, 'right');
        
    }, 2000);
}

/**
 * サイドバーの全選手を非表示にする
 */
function hideAllLineupItems(team) {
    const container = document.getElementById(`lineup-${team}-display`);
    if (!container) return;
    
    const items = container.querySelectorAll('.lineup-item');
    items.forEach(item => {
        item.classList.add('hidden-for-animation');
    });
}

/**
 * サイドバーの選手を順番にアニメーション表示
 */
function animateLineupRows(team, delayStart = 0, direction = 'left') {
    const container = document.getElementById(`lineup-${team}-display`);
    if (!container) return;
    
    const items = container.querySelectorAll('.lineup-item');
    const animationClass = direction === 'left' ? 'animate-slide-in-left' : 'animate-slide-in-right';
    
    items.forEach((item, index) => {
        setTimeout(() => {
            // 非表示クラスを外してアニメーションクラスを追加
            item.classList.remove('hidden-for-animation');
            item.classList.add(animationClass);
            
            // ハイライトも追加
            item.style.animation = `${direction === 'left' ? 'slideInLeft' : 'slideInRight'} 0.5s ease-out, highlightRow 0.8s ease-out 0.3s`;
            
            // アニメーション終了後にクラスをクリーンアップ
            setTimeout(() => {
                item.classList.remove(animationClass);
                item.style.animation = '';
            }, 1500);
        }, delayStart + (index * 600)); // 0.6秒間隔
    });
}

/**
 * 3アウトチェンジ用アニメーション
 */
export function playChangeAnimation() {
    const overlay = document.getElementById('change-overlay');
    if (!overlay) return;
    
    // 他のアニメーションをクリア（重なり防止）
    const resultOverlay = document.getElementById('result-overlay');
    if (resultOverlay) resultOverlay.classList.remove('active');
    
    // 表示開始
    overlay.classList.add('active');
    
    // 約6秒後に非表示にする（ゆったりめ）
    setTimeout(() => {
        overlay.classList.remove('active');
    }, 6500);
}
