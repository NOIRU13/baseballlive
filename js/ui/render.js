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
}

/**
 * チーム名の表示を更新
 * index.html（display-mode）では略称を使用する
 */
export function updateTeamDisplay(state) {
    // 略称があればそちらを使う（index.html表示用）
    const shortNames = state.teamShortNames || {};
    const awayDisplay = shortNames.away || state.teams.away;
    const homeDisplay = shortNames.home || state.teams.home;

    // サイドバー（略称）
    setText('sidebar-away-name', awayDisplay);
    setText('sidebar-home-name', homeDisplay);
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
    setText('inning-info', state.inning.number + '\u56DE ' + halfText);
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
        setValue('pitcher-innings-away', state.pitcherStats.away.innings || 0);
        setValue('pitcher-k-away', state.pitcherStats.away.strikeouts || 0);
        setValue('pitcher-runs-away', state.pitcherStats.away.runs || 0);
        setValue('pitcher-innings-home', state.pitcherStats.home.innings || 0);
        setValue('pitcher-k-home', state.pitcherStats.home.strikeouts || 0);
        setValue('pitcher-runs-home', state.pitcherStats.home.runs || 0);
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
    const batterName = state.lineup[offenseTeam][batterIndex] || '---';
    setText('current-batter-name', batterName);
    setText('batter-name-large', batterName);

    // PITCHER
    let pitcherName = '---';
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
        if (!pitcherInLineup) pitcherName = '投手';
    }
    setText('current-pitcher-name', pitcherName);
    setText('pitcher-name-large', pitcherName);

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
    GameLogic.updatePitcherStats(state, defenseTeam);
    if (state.pitcherStats && state.pitcherStats[defenseTeam]) {
        const innings = state.pitcherStats[defenseTeam].innings || 0;
        setText('pitcher-innings', innings.toFixed(1));
        setText('pitcher-strikeouts', state.pitcherStats[defenseTeam].strikeouts || 0);
        setText('pitcher-walks', state.pitcherStats[defenseTeam].walks || 0);
        setText('pitcher-runs', state.pitcherStats[defenseTeam].runs || 0);
    }

    // シーズン成績更新 (API)
    updateSeasonStats(batterName, pitcherName, state);
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
        setText('batter-avg', '.---');
        setText('batter-hr', '0');
        setText('batter-rbi', '0');
        setText('batter-ops', '.---');
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
        setText('pitcher-era', '-.--');
        setText('pitcher-k9', '-.--');
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
            const playerName = state.lineup[team][i] || ((i + 1) + '\u756A');
            const pos = (state.positions && state.positions[team][i]) ? state.positions[team][i] : '';
            const isActive = isAttacking && i === currentBatterIndex;
            
            const playerDiv = document.createElement('div');
            playerDiv.className = 'lineup-item' + (isActive ? ' active' : '');
            
            const posClass = getPositionClass(pos);
            playerDiv.innerHTML = '<span class="order-num">' + (i + 1) + '</span>' +
                '<span class="player-pos ' + posClass + '">' + pos + '</span>' +
                '<span class="player-name">' + playerName + '</span>';
            container.appendChild(playerDiv);
        }

        // Pitcher Display
        if (state.pitcher && state.pitcher[team]) {
            const pitcherName = state.pitcher[team];
            if (pitcherName) {
                const pitcherDiv = document.createElement('div');
                pitcherDiv.className = 'lineup-item pitcher-item';
                
                pitcherDiv.innerHTML = '<span class="order-num">P</span>' +
                    '<span class="player-pos pos-pitcher">投</span>' +
                    '<span class="player-name">' + pitcherName + '</span>';
                container.appendChild(pitcherDiv);
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
    setText('current-batter-name', batterName); // 注意: BottomStatsでも同じIDを使っている場合があるが、updateCurrentBatterDisplayはAdmin用として機能させる
    setText('current-batter-order', batterIndex + 1);
}

/**
 * 結果アニメーション表示
 */
export function showResultAnimation(resultCode) {
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
                });
                row.appendChild(posSelect);
                
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

/**
 * 選手名が長すぎる場合に縮小表示する
 */
function adjustTextScale() {
    const names = document.querySelectorAll('.player-name');
    
    names.forEach(el => {
        // 幅制約がない場合は何もしない
        if (el.clientWidth === 0) return;
        
        // 一旦リセット
        el.style.transform = 'none';
        el.style.width = 'auto'; // 自然な幅に戻す
        
        const scrollW = el.scrollWidth;
        const clientW = el.clientWidth;
        
        if (scrollW > clientW) {
            const scale = clientW / scrollW;
            el.style.transformOrigin = 'left center';
            el.style.transform = `scaleX(${scale})`;
        }
    });
}
