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
        updateAtBatLogTable(state);
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

    // Pitcher Stats List Update
    updatePitcherStatsList(state, 'away');
    updatePitcherStatsList(state, 'home');
}

/**
 * 投手成績リストを更新 (Admin用 - Table Layout)
 */
function updatePitcherStatsList(state, team) {
    const tbody = document.getElementById(`pitcher-table-body-${team}`);
    if (!tbody) return; // Not in admin mode or missing container

    // Update Team Label
    const labelEl = document.getElementById(`pitcher-log-label-${team}`);
    if (labelEl) {
        const teamName = (state.teamShortNames && state.teamShortNames[team]) ? state.teamShortNames[team] : (team === 'away' ? 'AWAY' : 'HOME');
        labelEl.textContent = teamName;
    }

    // Get ordered list of pitchers
    let pitchers = (state.pitcherHistory && state.pitcherHistory[team]) ? [...state.pitcherHistory[team]] : [];
    
    // Ensure current pitcher is in the list (at end if not present)
    const currentPitcher = state.pitcher ? state.pitcher[team] : '';
    if (currentPitcher && !pitchers.includes(currentPitcher)) {
        pitchers.push(currentPitcher);
    }
    
    // If no pitchers, show empty message
    if (pitchers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:#555; font-size:10px; text-align:center;">(登板なし)</td></tr>';
        return;
    }

    // Check existing rows to decide whether to rebuild
    const existingRows = Array.from(tbody.querySelectorAll('.pitcher-stat-row'));
    const existingNames = existingRows.map(r => r.dataset.pitcher);

    // If list changed (length or content), rebuild
    if (existingNames.join(',') !== pitchers.join(',')) {
        tbody.innerHTML = ''; // Rebuild
        pitchers.forEach(name => {
            const row = createPitcherStatRowTable(team, name);
            tbody.appendChild(row);
        });
    }

    // Now update values
    pitchers.forEach(name => {
        let stats = (state.pitcherStatsHistory && state.pitcherStatsHistory[name]) 
            ? state.pitcherStatsHistory[name] 
            : null;
            
        // If history is missing but it's the current pitcher, use current stats
        if (!stats && name === currentPitcher && state.pitcherStats && state.pitcherStats[team]) {
            stats = state.pitcherStats[team];
        }
        
        if (!stats) stats = { innings: 0, strikeouts: 0, runs: 0, earnedRuns: 0, walks: 0 };
            
        // Find row safely without selector injection issues
        const row = Array.from(tbody.children).find(el => el.dataset.pitcher === name);
        if (!row) return;

         // Highlight current pitcher
        if (name === currentPitcher) {
            row.style.background = 'rgba(255, 215, 0, 0.1)';
        } else {
            row.style.background = 'transparent';
        }

        // Update inputs if not focused
        updateInputIfNotFocused(row, 'innings', stats.innings !== undefined ? stats.innings : 0);
        updateInputIfNotFocused(row, 'k', stats.strikeouts !== undefined ? stats.strikeouts : 0);
        updateInputIfNotFocused(row, 'bb', stats.walks !== undefined ? stats.walks : 0);
        updateInputIfNotFocused(row, 'runs', stats.runs !== undefined ? stats.runs : 0);
        updateInputIfNotFocused(row, 'er', stats.earnedRuns !== undefined ? stats.earnedRuns : 0);
    });
    
    // Add "Add Pitcher" Row
    const addRow = document.createElement('tr');
    const tdAdd = document.createElement('td');
    tdAdd.colSpan = 6;
    tdAdd.style.padding = '5px';
    tdAdd.style.textAlign = 'center';
    tdAdd.style.background = 'rgba(255,255,255,0.05)';
    
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '5px';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    
    const select = document.createElement('select');
    select.id = `add-pitcher-select-${team}`;
    select.style.flex = '1';
    select.style.maxWidth = '120px';
    select.style.fontSize = '10px';
    select.style.padding = '2px';
    select.style.background = '#222';
    select.style.color = '#fff';
    select.style.border = '1px solid #555';
    
    // Populate with all players for the team
    // Need access to allPlayers list. If not available globally in render.js, handle differently.
    // Ideally pass players list to updatePitcherStatsList or use a global if available (window.allPlayersMap?).
    // For now, let's try to assume we can get players from fetching or if they are in state. 
    // State doesn't usually hold all players list (just active lineup).
    // Allow manual text entry if select is hard, OR assume app.js calls this with players?
    // Let's us a simple text input for now as fallback or try to find players in DOM?
    // Actually, app.js has allPlayers. We can dispatch event to populate this?
    // Or simpler: use a text input + button for "Manual Add".
    
    // Changing to Text Input for simplicity and robustness if full roster isn't in state
    const inputName = document.createElement('input');
    inputName.type = 'text';
    inputName.id = `add-pitcher-name-${team}`;
    inputName.placeholder = '選手名追加...';
    inputName.style.flex = '1';
    inputName.style.fontSize = '11px';
    inputName.style.padding = '2px';
    inputName.style.background = '#222';
    inputName.style.color = '#fff';
    inputName.style.border = '1px solid #555';
    inputName.style.maxWidth = '100px';

    const btnAdd = document.createElement('button');
    btnAdd.textContent = '+';
    btnAdd.className = 'btn-add-pitcher';
    btnAdd.dataset.team = team;
    btnAdd.style.cursor = 'pointer';
    btnAdd.style.padding = '2px 8px';
    btnAdd.style.background = '#3498db';
    btnAdd.style.border = 'none';
    btnAdd.style.color = '#fff';
    btnAdd.style.borderRadius = '2px';

    container.appendChild(inputName);
    container.appendChild(btnAdd);
    tdAdd.appendChild(container);
    addRow.appendChild(tdAdd);
    tbody.appendChild(addRow);
}

function createPitcherStatRowTable(team, name) {
    const row = document.createElement('tr');
    row.className = 'pitcher-stat-row';
    row.dataset.pitcher = name;
    row.dataset.team = team;
    row.style.borderBottom = '1px solid #333';

    // Name (Truncate if long)
    const tdName = document.createElement('td');
    tdName.textContent = name;
    tdName.style.padding = '2px';
    tdName.style.whiteSpace = 'nowrap';
    tdName.style.overflow = 'hidden';
    tdName.style.textOverflow = 'ellipsis';
    tdName.style.maxWidth = '100px';
    tdName.title = name;
    row.appendChild(tdName);

    // Inputs
    ['innings', 'k', 'bb', 'runs', 'er'].forEach(stat => {
        const td = document.createElement('td');
        td.style.padding = '1px';
        td.style.textAlign = 'center';

        const input = document.createElement('input');
        input.type = 'number';
        input.step = stat === 'innings' ? '0.1' : '1';
        input.className = 'pitcher-stat-input';
        input.dataset.team = team;
        input.dataset.pitcher = name;
        input.dataset.stat = stat;
        input.style.width = '100%';
        input.style.minWidth = stat === 'innings' ? '40px' : '30px'; 
        input.style.background = '#222';
        input.style.color = '#fff';
        input.style.border = '1px solid #444';
        input.style.borderRadius = '2px';
        input.style.padding = '2px 0'; // Vertical padding
        input.style.textAlign = 'center';
        input.style.fontSize = '11px';
        input.style.boxSizing = 'border-box'; // Ensure width includes padding/border

        td.appendChild(input);
        row.appendChild(td);
    });

    return row;
}

function getStatLabel(stat) {
    const map = { innings: '回', k: '振', bb: '球', runs: '失', er: '責' };
    return map[stat] || stat;
}

function updateInputIfNotFocused(row, stat, value) {
    const input = row.querySelector(`input[data-stat="${stat}"]`);
    if (input) {
        // If focused, don't update to avoid interrupting typing
        if (document.activeElement !== input) {
            input.value = value;
        }
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
                if (state.positions[defenseTeam][i] === 'P') {
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

        // 当日成績: Historyがあればそちらを優先（手動編集対応）
        let today = { ip: 0, er: 0, k: 0 };
        const historyStats = (state.pitcherStatsHistory && pitcherName) ? state.pitcherStatsHistory[pitcherName] : null;
        
        if (historyStats) {
             today.ip = historyStats.innings || 0;
             // earnedRunsを優先的に使用（エラーによる得点は自責点に含めない）
             today.er = historyStats.earnedRuns !== undefined ? historyStats.earnedRuns : 0;
             today.k = historyStats.strikeouts || 0;
        } else if (state.pitcherStats && state.pitcherStats[defenseTeam]) {
             // Fallback to active game state
             const pStats = state.pitcherStats[defenseTeam];
             today.ip = pStats.innings || 0;
             today.er = pStats.earnedRuns !== undefined ? pStats.earnedRuns : 0;
             today.k = pStats.strikeouts || 0;
        }

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
                        '<span class="player-pos pos-pitcher">P</span>' +
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
    if (pos === 'P') return 'pos-pitcher';
    if (pos === 'C') return 'pos-catcher';
    if (['1B', '2B', '3B', 'SS'].includes(pos)) return 'pos-infielder';
    if (['LF', 'CF', 'RF'].includes(pos)) return 'pos-outfielder';
    if (['DH', 'PH'].includes(pos)) return 'pos-dh';
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

function adjustChangeTextScale() {
    const rows = document.querySelectorAll('.change-content-row');
    rows.forEach(el => {
        // 親要素の幅を取得 (.lineup-change-row または .lineup-change-overlay)
        // .lineup-change-row のスタイルを確認する必要あり
        const container = el.parentElement; 
        if (!container) return;

        const containerWidth = container.clientWidth;
        if (containerWidth === 0) return; // 表示されていない場合

        // スタイルリセット
        el.style.transform = 'none';
        el.style.display = 'inline-block';
        el.style.whiteSpace = 'nowrap';
        
        const textWidth = el.scrollWidth;

        if (textWidth > containerWidth) {
            const scale = containerWidth / textWidth;
            const safeScale = scale * 0.95; // マージン
            el.style.transformOrigin = 'center';
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
             messageHtml += `<div class="lineup-change-row"><div class="change-label">PITCHER CHANGE</div><div class="change-content-row">${c.oldName || '---'} <span class="change-arrow">▶</span> ${c.newName}</div></div>`;
        });
    }
    
    // Substitution messages enabled
    if (batterChanges.length > 0) {
        batterChanges.forEach(c => {
             // 守備位置も表示
             const pos = c.pos || '';
             messageHtml += `<div class="lineup-change-row"><div class="change-label">PLAYER CHANGE</div><div class="change-content-row"><span style="color: #ffd700; margin-right: 8px;">${pos}</span>${c.oldName || '---'} <span class="change-arrow">▶</span> ${c.newName}</div></div>`;
        });
    }
    
    if (posChanges.length > 0) {
         // Show specific position change details if possible, or generic
         posChanges.forEach(c => {
             messageHtml += `<div class="lineup-change-row"><div class="change-label">POSITION CHANGE</div><div class="change-content-row">${c.name} : ${c.oldPos || '-'} <span class="change-arrow">▶</span> ${c.newPos}</div></div>`;
         });
    }

    if (messageHtml === '') return; // No meaningful message

    detailsEl.innerHTML = messageHtml;
    
    // Apply Scaling
    adjustChangeTextScale();

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
    
    // Render Away logs (Latest 3)
    const displayAwayLogs = awayLogs.slice(-3);
    displayAwayLogs.forEach(content => {
        const el = document.createElement('div');
        el.className = 'score-log-item compact';
        el.textContent = content;
        awayContainer.appendChild(el);
    });

    // Render Home logs (Latest 3)
    const displayHomeLogs = homeLogs.slice(-3);
    displayHomeLogs.forEach(content => {
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
    const awayList = document.getElementById('away-pitcher-list');
    const homeList = document.getElementById('home-pitcher-list');
    
    // 新構造が無い場合は旧構造互換（フォールバック）
    if (!awayList || !homeList) {
        updatePitcherRelayLegacy(state);
        return;
    }
    
    // 現在守備中のチーム
    const defendingTeam = state.inning.half === 'top' ? 'home' : 'away';
    
    // 両チームの投手情報を更新
    ['away', 'home'].forEach(team => {
        const listContainer = team === 'away' ? awayList : homeList;
        const panel = team === 'away' ? document.getElementById('away-pitcher-panel') : document.getElementById('home-pitcher-panel');
        const isDefending = team === defendingTeam;
        
        // チーム名ラベルを更新
        const teamLabel = document.getElementById(`${team}-pitcher-team-label`);
        if (teamLabel) {
            const teamName = state.teamShortNames && state.teamShortNames[team] 
                ? state.teamShortNames[team] 
                : (state.teams && state.teams[team] ? state.teams[team] : (team === 'away' ? 'AWAY' : 'HOME'));
            teamLabel.textContent = teamName;
        }
        
        // 全投手リストを作成（先発 + リリーフ）
        const starterName = state.startingPitcher ? (state.startingPitcher[team] || '') : '';
        const historyNames = state.pitcherHistory && state.pitcherHistory[team] ? state.pitcherHistory[team] : [];
        
        let allPitchers = [];
        if (starterName) allPitchers.push(starterName);
        // 重複チェックしつつ結合
        historyNames.forEach(name => {
            if (!allPitchers.includes(name)) {
                allPitchers.push(name);
            }
        });
        
        // 現在の投手名を取得
        const currentPitcherName = state.pitcher ? (state.pitcher[team] || '') : '';
        
        // 現在の投手がリストにない場合（念のため）
        if (currentPitcherName && !allPitchers.includes(currentPitcherName)) {
            allPitchers.push(currentPitcherName);
        }
        
        // リストをクリア
        listContainer.innerHTML = '';
        
        // パネル自体の表示/非表示
        const hasContent = allPitchers.length > 0;
        panel.style.opacity = hasContent ? '1' : '0.3';
        
        if (hasContent) {
            allPitchers.forEach(name => {
                const item = document.createElement('div');
                item.className = 'pitcher-entry';
                
                // 名前要素
                const nameSpan = document.createElement('span');
                nameSpan.className = 'pitcher-name';
                nameSpan.textContent = name;
                
                // Stats取得
                let stats = { innings: 0, runs: 0, earnedRuns: 0 };
                
                // 1. Historyから取得
                if (state.pitcherStatsHistory && state.pitcherStatsHistory[name]) {
                    const h = state.pitcherStatsHistory[name];
                    stats.innings = h.innings || 0;
                    stats.runs = h.earnedRuns !== undefined ? h.earnedRuns : (h.runs || 0); // 失点or自責点 (User said "Runs Allowed", using Runs for now, actually user said "何失点" which is Runs)
                    stats.runs = h.runs || 0;
                }
                
                // 2. 現在の投手なら、現在のStatsで上書き (最新情報)
                if (name === currentPitcherName && state.pitcherStats && state.pitcherStats[team]) {
                    const c = state.pitcherStats[team];
                    stats.innings = c.innings || 0;
                    stats.runs = c.runsFromLog !== undefined ? c.runsFromLog : (c.runs || 0);
                }
                
                // フォーマット
                const ip = stats.innings.toFixed(1).replace('.0', ''); // 整数なら小数なし
                const runs = stats.runs;
                
                const statsSpan = document.createElement('span');
                statsSpan.className = 'pitcher-stats';
                statsSpan.textContent = `${ip}回 ${runs}失`;
                
                // 現在マウンドにいる場合
                if (isDefending && name === currentPitcherName) {
                    item.classList.add('on-mound');
                }
                
                item.appendChild(nameSpan);
                item.appendChild(statsSpan);
                listContainer.appendChild(item);
            });
        }
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
 * チェンジアニメーション再生
 */
export function playChangeAnimation() {
    let overlay = document.getElementById('change-overlay');
    
    // オーバーレイが存在しない場合は作成
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'change-overlay';
        
        const content = document.createElement('div');
        content.id = 'change-content';
        
        const smallLine = document.createElement('div');
        smallLine.className = 'change-line-small';
        smallLine.textContent = 'CHANGE';
        
        const largeLine = document.createElement('div');
        largeLine.className = 'change-line-large';
        largeLine.textContent = 'INNING';
        
        content.appendChild(smallLine);
        content.appendChild(largeLine);
        overlay.appendChild(content);
        
        document.body.appendChild(overlay);
    }
    
    // アニメーションリセット
    overlay.classList.remove('active');
    void overlay.offsetWidth; // Force Reflow
    overlay.classList.add('active');
    
    // アニメーション終了後に非表示 (CSSのdurationに合わせて調整)
    // changeLargeIn: 3s + 1.5s delay = 4.5s
    // changeGlitter: infinite
    // ここでは7秒程度表示してから消す
    setTimeout(() => {
        overlay.classList.remove('active');
    }, 8000); // 少し長めに
}
/**
 * 得点ログをパースしてオブジェクトに変換
 * (Note: Existing parseScoreLog is kept but maybe not used by at-bat-log logic directly if we use state.atBatLog)
 */

/**
 * 打席ログテーブルの更新
 */
export function updateAtBatLogTable(state) {
    const tbody = document.getElementById('at-bat-log-body');
    if (!tbody) return;

    // state.atBatLog が存在するか確認
    const logs = state.atBatLog || [];
    
    // 現在の入力フォーカスがある要素のIDを記録（再描画時のフォーカス維持用）
    const activeId = document.activeElement ? document.activeElement.id : null;

    tbody.innerHTML = '';
    
    logs.forEach((log, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        
        // イニング
        const tdInning = document.createElement('td');
        tdInning.textContent = `${log.inning}${log.half === 'top' ? '表' : '裏'}`;
        tr.appendChild(tdInning);
        
        // 打者
        const tdBatter = document.createElement('td');
        tdBatter.textContent = log.batterName;
        tr.appendChild(tdBatter);
        
        // 投手 (Editable Select)
        const tdPitcher = document.createElement('td');
        const selectPitcher = document.createElement('select');
        selectPitcher.className = 'log-input log-pitcher-select';
        selectPitcher.dataset.id = log.id;
        selectPitcher.style.width = '100px';
        
        // 投手リストの取得 (相手チームの投手履歴)
        const defenseTeam = log.half === 'top' ? 'home' : 'away'; // 打者がtopなら投手はhome
        const pitchers = (state.pitcherHistory && state.pitcherHistory[defenseTeam]) ? [...state.pitcherHistory[defenseTeam]] : [];
        // ログにある投手が履歴にない場合も追加
        if (log.pitcherName && !pitchers.includes(log.pitcherName)) {
            pitchers.push(log.pitcherName);
        }
        
        populateSimpleOptions(selectPitcher, pitchers, log.pitcherName);
        tdPitcher.appendChild(selectPitcher);
        tr.appendChild(tdPitcher);
        
        // 結果 (Editable Select)
        const tdResult = document.createElement('td');
        const selectResult = document.createElement('select');
        selectResult.className = 'log-input log-result-select';
        selectResult.dataset.id = log.id;
        selectResult.style.width = '70px';
        
        const resultOptions = [
            {v:'strikeout', t:'三振'}, {v:'groundout', t:'ゴロ'}, {v:'flyout', t:'フライ'}, {v:'lineout', t:'ライナー'},
            {v:'single', t:'単打'}, {v:'double', t:'二塁打'}, {v:'triple', t:'三塁打'}, {v:'homerun', t:'本塁打'},
            {v:'walk', t:'四球'}, {v:'hbp', t:'死球'}, {v:'error', t:'エラー'},
            {v:'sacrifice', t:'犠打'}, {v:'sac_fly', t:'犠飛'}, {v:'fc', t:'野選'}, {v:'dp', t:'併殺'}
        ];
        
        resultOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.v;
            option.textContent = opt.t;
            if (log.result === opt.v) option.selected = true;
            selectResult.appendChild(option);
        });
        tdResult.appendChild(selectResult);
        tr.appendChild(tdResult);
        
        // 打点 (Editable Number)
        const tdRBI = document.createElement('td');
        const inputRBI = document.createElement('input');
        inputRBI.type = 'number';
        inputRBI.className = 'log-input log-rbi-input';
        inputRBI.dataset.id = log.id;
        inputRBI.value = log.rbi;
        inputRBI.style.width = '30px';
        inputRBI.style.textAlign = 'center';
        tdRBI.appendChild(inputRBI);
        tr.appendChild(tdRBI);
        
        /* 失点・自責は投手ログ側で管理するので、打席ログからは一旦外す（スペースの都合）
           User Request: "打席ログは全イニング、全打者の結果、打点、相手投手を編集できるようにしてください"
           So Pitcher Name, Result, RBI are key.
        */
       
        // 操作 (削除ボタン等) - ここでは削除機能は要求されていないが、あっても良い。
        // User said: "全イニング、全打者の結果...編集できるように". implying fixing data.
        const tdAction = document.createElement('td');
        tdAction.style.textAlign = 'right';
        /*
        const btnDel = document.createElement('button');
        btnDel.textContent = '×';
        btnDel.className = 'btn btn-danger';
        btnDel.style.padding = '2px 6px';
        btnDel.style.fontSize = '10px';
        btnDel.onclick = () => { if(confirm('削除しますか？')) { ... } };
        tdAction.appendChild(btnDel);
        */
        tr.appendChild(tdAction);
        
        tbody.appendChild(tr);
    });
}

function populateSimpleOptions(select, items, current) {
    select.innerHTML = '';
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item;
        opt.textContent = item;
        if (item === current) opt.selected = true;
        select.appendChild(opt);
    });
    // Add current if missing (fallback)
    if (current && !items.includes(current)) {
         const opt = document.createElement('option');
         opt.value = current;
         opt.textContent = current;
         opt.selected = true;
         select.appendChild(opt);
    }
}


/**
 * スペシャルアニメーション（HR, 満塁HR, サヨナラ）
 * @param {string} type 'homerun', 'grandslam', 'sayonara'
 */
export function playSpecialAnimation(type) {
    let overlay = document.getElementById('special-anim-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'special-anim-overlay';
        document.body.appendChild(overlay);
    }
    
    // Clear Content
    overlay.innerHTML = '';
    
    // Create Text Container
    const textContainer = document.createElement('div');
    textContainer.style.display = 'flex';
    textContainer.style.flexDirection = 'column';
    textContainer.style.alignItems = 'center';
    
    const mainText = document.createElement('div');
    mainText.className = 'anim-text-large';
    
    // Configure based on type
    if (type === 'homerun') {
        const span = document.createElement('span');
        span.textContent = 'HOMERUN';
        span.className = 'text-gold';
        mainText.appendChild(span);
        startFireworks(overlay, 15); 
    } else if (type === 'grandslam') {
        const span = document.createElement('span');
        span.textContent = 'GRAND SLAM';
        span.className = 'text-rainbow';
        mainText.appendChild(span);
        
        const subText = document.createElement('div');
        subText.className = 'anim-text-sub text-rainbow';
        subText.textContent = 'MANRUI HOMERUN'; 
        textContainer.appendChild(subText); // append subText
        
        startFireworks(overlay, 30, true); 
    } else if (type === 'sayonara') {
         const span = document.createElement('span');
         span.textContent = 'SAYONARA';
         span.className = 'text-sayonara';
         mainText.appendChild(span);
         
         const subText = document.createElement('div');
         subText.className = 'anim-text-sub text-sayonara';
         subText.textContent = 'VICTORY'; 
         textContainer.appendChild(subText);

         startFireworks(overlay, 20, true);
    }
    
    textContainer.insertBefore(mainText, textContainer.firstChild); // Ensure mainText is first
    overlay.appendChild(textContainer);
    
    // Activate
    overlay.classList.add('active'); // CSS opacity transition
    
    // Cleanup
    setTimeout(() => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.innerHTML = '', 500);
    }, 6000);
}

function startFireworks(container, count, multiColor = false) {
    const fwContainer = document.createElement('div');
    fwContainer.className = 'fireworks-container';
    container.appendChild(fwContainer);
    
    for (let i=0; i<count; i++) {
        setTimeout(() => {
            createFirework(fwContainer, multiColor);
        }, i * 300);
    }
}

function createFirework(container, multiColor) {
    const fw = document.createElement('div');
    fw.className = 'firework';
    const x = Math.random() * 80 + 10; // 10-90%
    const y = Math.random() * 60 + 10; // 10-70%
    fw.style.left = x + '%';
    fw.style.top = y + '%';
    
    const color = multiColor 
        ? `hsl(${Math.random() * 360}, 100%, 70%)` 
        : '#ffd700';
    
    fw.style.backgroundColor = color;
    fw.style.boxShadow = `0 0 20px 5px ${color}`;
    
    container.appendChild(fw);
    
    // Create sparkles
    for(let j=0; j<8; j++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        sparkle.style.backgroundColor = color;
        sparkle.style.left = x + '%';
        sparkle.style.top = y + '%';
        
        // Random direction
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 100 + 50;
        const tx = Math.cos(angle) * dist + 'px';
        const ty = Math.sin(angle) * dist + 'px';
        
        sparkle.style.setProperty('--tx', tx);
        sparkle.style.setProperty('--ty', ty);
        
        container.appendChild(sparkle);
        setTimeout(() => sparkle.remove(), 1000);
    }

    setTimeout(() => fw.remove(), 1200);
}

